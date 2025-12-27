import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MonthlyStats, DEFAULT_PAYMENT_ORDER, ALL_RIDE_TYPES } from '@/types';

// 月間統計情報を管理するカスタムフック
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

    // ゲストユーザーの場合はローカルストレージから読み込み
    if (targetUid === 'guest-user') {
      const guestData = localStorage.getItem('taxi_navigator_guest_data');
      if (guestData) {
        const data = JSON.parse(guestData);
        if (data.stats) {
          setMonthlyStats(prev => ({ ...prev, ...data.stats }));
        }
      }
      return;
    }

    // 月間統計をリアルタイム監視
    const unsubStats = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.monthlyStats) {
          setMonthlyStats(prev => ({ ...prev, ...data.monthlyStats }));
        }
      }
    });

    // クリーンアップ
    return () => unsubStats();
  }, [targetUid]);

  return { monthlyStats, setMonthlyStats };
};
