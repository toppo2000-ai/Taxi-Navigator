import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '@/services/firebase';
import { Shift, SalesRecord, MonthlyStats, BreakState } from '@/types';
import { getBusinessDate, getBillingPeriod, formatDate } from '@/utils';

export const sanitizeShift = (rawShift: any): Shift | null => {
  if (!rawShift) return null;
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

    const unsubShift = onSnapshot(doc(db, 'users', targetUid, 'current_data', 'current_shift'), (docSnap) => {
      if (docSnap.exists()) {
        setShift(sanitizeShift(docSnap.data()));
      } else {
        setShift(null);
      }
    });

    const unsubBreak = onSnapshot(doc(db, 'users', targetUid, 'current_data', 'break_state'), (docSnap) => {
      if (docSnap.exists()) {
        setBreakState(docSnap.data() as BreakState);
      } else {
        setBreakState({ isActive: false, startTime: null });
      }
    });

    return () => {
      unsubShift();
      unsubBreak();
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

      const allHistoryRecords = [...history, ...(shift ? shift.records : [])];
      allHistoryRecords.sort((a, b) => b.amount - a.amount);
      const topRecords = allHistoryRecords.slice(0, 5);

      const allRecords = [...history, ...(shift?.records || [])];
      const uniqueRecordsMap = new Map();
      allRecords.forEach(r => uniqueRecordsMap.set(r.id, r));
      const uniqueRecords = Array.from(uniqueRecordsMap.values()) as SalesRecord[];

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

      const activeRecords = shift ? shift.records : [];

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
        await setDoc(doc(db, "public_status", user.uid), {
          ...statusData,
          status: 'offline',
        }, { merge: true });
      }
    } catch (e) {
      console.error("Broadcast failed:", e);
    }
  }, [user, shift, history, stats]);

  return { shift, setShift, breakState, setBreakState, broadcastStatus };
};
