import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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

      if (shift) {
        const count = shift.records.length;
        const dispatchCount = shift.records.filter(r => r.rideType !== 'FLOW' && r.rideType !== 'WAIT').length;
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
