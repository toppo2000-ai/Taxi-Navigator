import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MonthlyStats, DEFAULT_PAYMENT_ORDER, ALL_RIDE_TYPES } from '@/types';

export const useStats = (targetUid: string | undefined) => {
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    monthLabel: '',
    totalSales: 0,
    totalRides: 0,
    monthlyGoal: 1000000,
    defaultDailyGoal: 50000,
    shimebiDay: 20,
    businessStartHour: 9,
    dutyDays: [],
    enabledPaymentMethods: DEFAULT_PAYMENT_ORDER,
    customPaymentLabels: {},
    userName: '', 
    enabledRideTypes: ALL_RIDE_TYPES,
    visibilityMode: 'PUBLIC', 
    allowedViewers: [],
    followingUsers: []
  });

  useEffect(() => {
    if (!targetUid) return;

    const unsubStats = onSnapshot(doc(db, 'users', targetUid, 'settings', 'monthly_stats'), (docSnap) => {
      if (docSnap.exists()) {
        setMonthlyStats(prev => ({ ...prev, ...docSnap.data() }));
      }
    });

    return () => unsubStats();
  }, [targetUid]);

  return { monthlyStats, setMonthlyStats };
};
