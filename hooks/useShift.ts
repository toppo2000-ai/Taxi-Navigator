import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../services/firebase';
import { Shift, SalesRecord, MonthlyStats, BreakState } from '../types';
import { getBusinessDate, getBillingPeriod, formatDate } from '../utils';

export const sanitizeShift = (rawShift: any): Shift | null => {
  if (!rawShift) return null;
  const safeNum = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  
  return {
    ...rawShift,
    dailyGoal: safeNum(rawShift.dailyGoal, 50000),
    plannedHours: safeNum(rawShift.plannedHours, 12),
    totalRestMinutes: safeNum(rawShift.totalRestMinutes, 0),
    startTime: safeNum(rawShift.startTime, Date.now()),
    startOdo: rawShift.startOdo !== undefined ? safeNum(rawShift.startOdo, 0) : undefined,
    records: (rawShift.records || []).map((r: any) => ({
      ...r,
      amount: safeNum(r.amount, 0),
      toll: safeNum(r.toll, 0),
      returnToll: r.returnToll !== undefined ? safeNum(r.returnToll, 0) : undefined,
      nonCashAmount: safeNum(r.nonCashAmount, 0),
      passengersMale: safeNum(r.passengersMale, 0),
      passengersFemale: safeNum(r.passengersFemale, 0),
      timestamp: safeNum(r.timestamp, Date.now()),
      pickupCoords: r.pickupCoords || "", 
      dropoffCoords: r.dropoffCoords || "" 
    }))
  };
};

export const useShift = (user: User | null, targetUid: string | undefined, stats: MonthlyStats, history: SalesRecord[]) => {
  const [shift, setShift] = useState<Shift | null>(null);
  const [breakState, setBreakState] = useState<BreakState>({ isActive: false, startTime: null });

  useEffect(() => {
    if (!targetUid) {
      setShift(null);
      return;
    }

    if (targetUid === 'guest-user') {
      const guestData = localStorage.getItem('taxi_navigator_guest_data');
      if (guestData) {
        const data = JSON.parse(guestData);
        setShift(sanitizeShift(data.shift));
        setBreakState(data.breakState || { isActive: false, startTime: null });
      }
      return;
    }

    const unsubData = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setShift(sanitizeShift(data.shift));
        setBreakState(data.breakState || { isActive: false, startTime: null });
      } else {
        setShift(null);
        setBreakState({ isActive: false, startTime: null });
      }
    });

    return () => {
      unsubData();
    };
  }, [targetUid]);

  const broadcastStatus = useCallback(async (
    currentStatus: 'active' | 'break' | 'riding' | 'completed' | 'offline'
  ) => {
    if (!user || !stats.userName) return;
    
    try {
      const startHour = stats.businessStartHour ?? 9;
      const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, startHour);
      const adjustedEnd = new Date(end);
      if (stats.shimebiDay !== 0) {
        adjustedEnd.setDate(stats.shimebiDay);
      }
      
      const startStr = formatDate(start);
      const endStr = formatDate(adjustedEnd);
      
      const periodHistorySales = history
        .filter(r => {
          const rDate = getBusinessDate(r.timestamp, startHour);
          return rDate >= startStr && rDate <= endStr;
        })
        .reduce((sum, r) => sum + r.amount, 0);

      const currentShiftSales = shift 
        ? shift.records.reduce((sum, r) => sum + r.amount, 0) 
        : 0;
      
      const totalMonthlySales = periodHistorySales + currentShiftSales;

      const statusData = {
          uid: user.uid,
          name: stats.userName,
          monthlyTotal: totalMonthlySales,
          status: currentStatus, 
          lastUpdated: Date.now(),
          businessStartHour: stats.businessStartHour,
          visibilityMode: stats.visibilityMode, 
          allowedViewers: stats.allowedViewers
      };

      // 当日の最初の出庫時刻と累計データを取得
      // public_statusから現在のtodayStartTimeを取得して、当日の営業日で最初の出庫時刻を保持
      const publicStatusRef = doc(db, "public_status", user.uid);
      const publicStatusSnap = await getDoc(publicStatusRef);
      const existingData = publicStatusSnap.exists() ? publicStatusSnap.data() : null;
      
      const currentBusinessDate = getBusinessDate(Date.now(), startHour);
      
      if (shift) {
        const endTime = shift.startTime + (shift.plannedHours * 3600000);
        
        // 当日の全レコードを取得（再出庫前のデータも含む）
        // history + shift.recordsから当日のレコードを抽出
        const allTodayRecords = [...history, ...shift.records]
          .filter(r => getBusinessDate(r.timestamp, startHour) === currentBusinessDate);
        
        // 当日の累計データを計算（全レコードから直接計算）
        const todaySales = allTodayRecords.reduce((sum, r) => sum + r.amount, 0);
        const todayRideCount = allTodayRecords.length;
        const todayDispatchCount = allTodayRecords.filter(r => r.rideType !== 'FLOW' && r.rideType !== 'WAIT').length;
        
        // 当日の最初の出庫時刻を取得
        let todayStartTime = shift.startTime; // デフォルトは現在のシフトの開始時刻
        
        if (allTodayRecords.length > 0) {
          // 当日の全レコードから最初のタイムスタンプを取得
          todayStartTime = Math.min(...allTodayRecords.map(r => r.timestamp));
        } else if (existingData?.todayStartTime) {
          // レコードがない場合でも、既存のtodayStartTimeが当日の営業日であれば保持
          const existingTodayStartTime = existingData.todayStartTime;
          const existingBusinessDate = getBusinessDate(existingTodayStartTime, startHour);
          if (existingBusinessDate === currentBusinessDate) {
            todayStartTime = existingTodayStartTime;
          }
        }

        // 業務終了時（statusが'completed'）でも、当日の営業日の累計データを保持
        await setDoc(doc(db, "public_status", user.uid), {
          ...statusData,
          startTime: shift.startTime,
          todayStartTime: todayStartTime, // 当日の最初の出庫時刻
          plannedEndTime: endTime,
          sales: todaySales, // 当日の累計営収
          rideCount: todayRideCount, // 当日の累計回数
          dispatchCount: todayDispatchCount, // 当日の累計配車
        }, { merge: true });
      } else {
        // 営業終了時（shiftがnull）でも、当日の営業日の累計データを保持
        const publicStatusRef = doc(db, "public_status", user.uid);
        const publicStatusSnap = await getDoc(publicStatusRef);
        const existingData = publicStatusSnap.exists() ? publicStatusSnap.data() : null;
        
        const currentBusinessDate = getBusinessDate(Date.now(), startHour);
        let todaySales = 0;
        let todayRideCount = 0;
        let todayDispatchCount = 0;
        let todayStartTime: number | undefined = undefined;
        
        // ★修正: statusが'completed'の場合は、finalizeShiftで保存されたデータを必ず保持（再計算しない）
        if (existingData?.status === 'completed') {
          // 当日の営業日か確認
          if (existingData.todayStartTime) {
            const existingBusinessDate = getBusinessDate(existingData.todayStartTime, startHour);
            if (existingBusinessDate === currentBusinessDate) {
              // 当日の営業日であれば、既存の累計データをそのまま保持
              todayStartTime = existingData.todayStartTime;
              todaySales = existingData.sales !== undefined && existingData.sales !== null ? existingData.sales : 0;
              todayRideCount = existingData.rideCount !== undefined && existingData.rideCount !== null ? existingData.rideCount : 0;
              todayDispatchCount = existingData.dispatchCount !== undefined && existingData.dispatchCount !== null ? existingData.dispatchCount : 0;
            }
          } else {
            // todayStartTimeがない場合でも、既存のデータを保持
            todaySales = existingData.sales !== undefined && existingData.sales !== null ? existingData.sales : 0;
            todayRideCount = existingData.rideCount !== undefined && existingData.rideCount !== null ? existingData.rideCount : 0;
            todayDispatchCount = existingData.dispatchCount !== undefined && existingData.dispatchCount !== null ? existingData.dispatchCount : 0;
          }
        } else if (existingData) {
          // statusが'completed'でない場合のみ、既存データから取得を試みる
          if (existingData.todayStartTime) {
            const existingBusinessDate = getBusinessDate(existingData.todayStartTime, startHour);
            if (existingBusinessDate === currentBusinessDate) {
              // 当日の営業日であれば、既存の累計データを保持
              todayStartTime = existingData.todayStartTime;
              todaySales = existingData.sales || 0;
              todayRideCount = existingData.rideCount || 0;
              todayDispatchCount = existingData.dispatchCount || 0;
            }
          }
        }
        
        // 営業終了時でも、当日の営業日の累計データを必ず保存
        // statusが'completed'の場合は、既存の累計データを保持（finalizeShiftで保存されたデータを上書きしない）
        const updateData: any = {
          ...statusData,
          // statusが'completed'の場合は、既存のstatusを保持（finalizeShiftで設定された'completed'を維持）
          status: existingData?.status === 'completed' ? 'completed' : 'offline',
        };
        
        // ★修正: statusが'completed'の場合は、必ず既存データを保持
        if (existingData?.status === 'completed') {
          // finalizeShiftで保存されたデータをそのまま保持
          if (todayStartTime !== undefined) {
            updateData.todayStartTime = todayStartTime;
          } else if (existingData.todayStartTime) {
            updateData.todayStartTime = existingData.todayStartTime;
          }
          updateData.sales = todaySales;
          updateData.rideCount = todayRideCount;
          updateData.dispatchCount = todayDispatchCount;
        } else if (todayStartTime !== undefined) {
          // statusが'completed'でない場合のみ、計算した値を保存
          updateData.todayStartTime = todayStartTime;
          updateData.sales = todaySales;
          updateData.rideCount = todayRideCount;
          updateData.dispatchCount = todayDispatchCount;
        } else if (existingData?.todayStartTime) {
          // todayStartTimeが異なる営業日の場合でも、既存のデータを保持（念のため）
          const existingTodayStartTime = existingData.todayStartTime;
          const existingBusinessDate = getBusinessDate(existingTodayStartTime, startHour);
          if (existingBusinessDate === currentBusinessDate) {
            updateData.todayStartTime = existingTodayStartTime;
            updateData.sales = existingData.sales || 0;
            updateData.rideCount = existingData.rideCount || 0;
            updateData.dispatchCount = existingData.dispatchCount || 0;
          }
        }
        
        await setDoc(doc(db, "public_status", user.uid), updateData, { merge: true });
      }
    } catch (e) {
      console.error("Broadcast failed:", e);
    }
  }, [user, shift, history, stats]);

  return { shift, setShift, breakState, setBreakState, broadcastStatus };
};
