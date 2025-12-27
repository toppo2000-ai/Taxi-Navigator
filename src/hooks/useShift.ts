import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '@/services/firebase';
import { Shift, SalesRecord, MonthlyStats, BreakState } from '@/types';
import { getBusinessDate, getBillingPeriod, formatDate, calculatePeriodStats } from '@/utils';

// シフトデータを検証・正規化する
export const sanitizeShift = (rawShift: any): Shift | null => {
  if (!rawShift) return null;
  // 安全な数値変換 (デフォルト値使用)
  const safeNum = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  
  return {
    ...rawShift,
    dailyGoal: safeNum(rawShift.dailyGoal, 50000),
    plannedHours: safeNum(rawShift.plannedHours, 12),
    totalRestMinutes: safeNum(rawShift.totalRestMinutes, 0),
    startTime: safeNum(rawShift.startTime, Date.now()),
    records: (rawShift.records || []).map((r: any) => ({
      ...r,
      amount: safeNum(r.amount, 0),
      toll: safeNum(r.toll, 0),
      nonCashAmount: safeNum(r.nonCashAmount, 0),
      passengersMale: safeNum(r.passengersMale, 0),
      passengersFemale: safeNum(r.passengersFemale, 0),
      timestamp: safeNum(r.timestamp, Date.now()),
      pickupCoords: r.pickupCoords || "", 
      dropoffCoords: r.dropoffCoords || "" 
    }))
  };
};

// シフト情報と休憩状態を管理するカスタムフック
export const useShift = (user: User | null, targetUid: string | undefined, stats: MonthlyStats, history: SalesRecord[]) => {
  const [shift, setShift] = useState<Shift | null>(null);
  const [breakState, setBreakState] = useState<BreakState>({ isActive: false, startTime: null });

  // シフトと休憩状態をリアルタイム監視
  useEffect(() => {
    if (!targetUid) {
      setShift(null);
      return;
    }

    // ゲストユーザーの場合はローカルストレージから読み込み
    if (targetUid === 'guest-user') {
      const guestData = localStorage.getItem('taxi_navigator_guest_data');
      if (guestData) {
        const data = JSON.parse(guestData);
        setShift(sanitizeShift(data.shift));
        setBreakState(data.breakState || { isActive: false, startTime: null });
      }
      return;
    }

    // 現在のシフト情報をリアルタイム監視
    const unsubShift = onSnapshot(doc(db, 'users', targetUid, 'current_data', 'current_shift'), (docSnap) => {
      if (docSnap.exists()) {
        setShift(sanitizeShift(docSnap.data()));
      } else {
        setShift(null);
      }
    });

    // 休憩状態をリアルタイム監視
    const unsubBreak = onSnapshot(doc(db, 'users', targetUid, 'current_data', 'break_state'), (docSnap) => {
      if (docSnap.exists()) {
        setBreakState(docSnap.data() as BreakState);
      } else {
        setBreakState({ isActive: false, startTime: null });
      }
    });

    // クリーンアップ
    return () => {
      unsubShift();
      unsubBreak();
    };
  }, [targetUid]);

  // ステータスを公開データベースにブロードキャスト
  const broadcastStatus = useCallback(async (
    currentStatus: 'active' | 'break' | 'riding' | 'completed' | 'offline'
  ) => {
    if (!user || !stats.userName) return;
    
    try {
      // 営業開始時刻を取得
      const startHour = stats.businessStartHour ?? 9;
      // 請求期間を計算
      const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, startHour);
      const adjustedEnd = new Date(end);
      if (stats.shimebiDay !== 0) {
        adjustedEnd.setDate(stats.shimebiDay);
      }
      
      const startStr = formatDate(start);
      const endStr = formatDate(adjustedEnd);
      
      // 月間売上を計算
      const { totalSales: totalMonthlySales } = calculatePeriodStats(stats, history, shift);

      // 現在のシフトの売上を計算
      const currentShiftSales = shift 
        ? shift.records.reduce((sum, r) => sum + r.amount, 0) 
        : 0;
            allRecords.forEach(r => uniqueRecordsMap.set(r.id, r));
      const uniqueRecords = Array.from(uniqueRecordsMap.values()) as SalesRecord[];

      // 月別のデータを集計
      const monthsData: Record<string, any> = {};
      uniqueRecords.forEach(record => {
          const period = getBillingPeriod(new Date(record.timestamp), stats.shimebiDay, startHour);
          const year = period.end.getFullYear();
          const month = period.end.getMonth() + 1;
          const sortKey = `${year}-${String(month).padStart(2, '0')}`;
          
          if (!monthsData[sortKey]) {
              monthsData[sortKey] = {
                  label: `${year}年${month}月度`,
                  sortKey,
                  sales: 0,
                  records: [],
                  startStr: formatDate(period.start),
                  endStr: formatDate(period.end)
              };
          }
          
          monthsData[sortKey].records.push(record);
          monthsData[sortKey].sales += record.amount;
      });

      // 現在のシフト記録を取得
      const activeRecords = shift ? shift.records : [];

      // ステータスデータを構築
      const statusData = {
          uid: user.uid,
          name: stats.userName,
          monthlyTotal: totalMonthlySales,
          status: currentStatus, 
          lastUpdated: Date.now(),
          businessStartHour: stats.businessStartHour,
          visibilityMode: stats.visibilityMode, 
          allowedViewers: stats.allowedViewers,
          topRecords: topRecords,
          records: activeRecords,
          months: monthsData
      };

      if (shift) {
        // シフト稼働中の場合
        const count = shift.records.length;
        const dispatchCount = shift.records.filter(r => 
          r.rideType !== 'FLOW' && r.rideType !== 'WAIT'
        ).length;
        const endTime = shift.startTime + (shift.plannedHours * 3600000);

        await setDoc(doc(db, "public_status", user.uid), {
          ...statusData,
          startTime: shift.startTime,
          plannedEndTime: endTime,
          sales: currentShiftSales,
          rideCount: count,
          dispatchCount: dispatchCount,
        }, { merge: true });
      } else {
        // シフト終了時
        await setDoc(doc(db, "public_status", user.uid), {
          ...statusData,
          status: 'offline',
        }, { merge: true });
      }
    } catch (e) {
      // ブロードキャスト処理のエラーをログ出力
      console.error("Broadcast failed:", e);
    }
  }, [user, shift, history, stats]);

  return { shift, setShift, breakState, setBreakState, broadcastStatus };
};
