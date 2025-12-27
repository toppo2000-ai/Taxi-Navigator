import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore'; 
import { auth, googleProvider, db } from '../firebase';
import { 
  Shift, 
  SalesRecord, 
  PaymentMethod, 
  MonthlyStats, 
  RideType, 
  DayMetadata, 
  BreakState,
  DEFAULT_PAYMENT_ORDER,
  ALL_RIDE_TYPES
} from '../types';
import { getBusinessDate, getBillingPeriod, formatDate } from '../utils';

// 管理者メールアドレス設定
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// ヘルパー関数: デフォルト出勤日の生成
const generateDefaultDutyDays = (shimebiDay: number = 20, startHour: number = 9) => {
  const now = new Date();
  const { start, end } = getBillingPeriod(now, shimebiDay, startHour);
  const candidates: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 3) {
      candidates.push(formatDate(new Date(current)));
    }
    current.setDate(current.getDate() + 1);
  }
  
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  return candidates.slice(0, 20).sort();
};

// ヘルパー関数: シフトデータのサニタイズ
const sanitizeShift = (rawShift: any): Shift | null => {
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

export const useAppLogic = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ role: 'admin' | 'user'; status: 'active' | 'pending' | 'banned' } | null>(null);
  
  const [shift, setShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [dayMetadata, setDayMetadata] = useState<Record<string, DayMetadata>>({});
  const [breakState, setBreakState] = useState<BreakState>({ isActive: false, startTime: null });

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

  const [recordModalState, setRecordModalState] = useState<{ open: boolean; initialData?: Partial<SalesRecord> }>({ open: false });
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShiftEditOpen, setIsShiftEditOpen] = useState(false);

  // --- Logic: Broadcast Status ---
  const broadcastStatus = async (
    currentUser: User, 
    currentShift: Shift | null, 
    currentHistory: SalesRecord[],
    stats: MonthlyStats,
    currentStatus: 'active' | 'break' | 'riding' | 'completed' | 'offline'
  ) => {
    if (!currentUser || !stats.userName) return;
    try {
      const startHour = stats.businessStartHour ?? 9;
      const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, startHour);
      const adjustedEnd = new Date(end);
      if (stats.shimebiDay !== 0) adjustedEnd.setDate(stats.shimebiDay);
      
      const startStr = formatDate(start);
      const endStr = formatDate(adjustedEnd);
      
      const periodHistorySales = currentHistory
        .filter(r => {
          const rDate = getBusinessDate(r.timestamp, startHour);
          return rDate >= startStr && rDate <= endStr;
        })
        .reduce((sum, r) => sum + r.amount, 0);

      const currentShiftSales = currentShift 
        ? currentShift.records.reduce((sum, r) => sum + r.amount, 0) 
        : 0;
      
      const totalMonthlySales = periodHistorySales + currentShiftSales;

      const statusData = {
          uid: currentUser.uid,
          name: stats.userName,
          monthlyTotal: totalMonthlySales,
          status: currentStatus, 
          lastUpdated: Date.now(),
          businessStartHour: stats.businessStartHour,
          visibilityMode: stats.visibilityMode, 
          allowedViewers: stats.allowedViewers
      };

      if (currentShift) {
        const count = currentShift.records.length;
        const dispatchCount = currentShift.records.filter(r => r.rideType !== 'FLOW' && r.rideType !== 'WAIT').length;
        const endTime = currentShift.startTime + (currentShift.plannedHours * 3600000);

        await setDoc(doc(db, "public_status", currentUser.uid), {
          ...statusData,
          startTime: currentShift.startTime,
          plannedEndTime: endTime,
          sales: currentShiftSales,
          rideCount: count,
          dispatchCount: dispatchCount,
        }, { merge: true });
      } else {
        await setDoc(doc(db, "public_status", currentUser.uid), {
          ...statusData,
          status: 'offline',
        }, { merge: true });
      }
    } catch (e) {
      console.error("Broadcast failed:", e);
    }
  };

  // --- Logic: Save to DB ---
  const saveToDB = async (updates: any, statusOverride?: 'active' | 'break' | 'riding') => {
    if (!user) return;
    try { 
        await setDoc(doc(db, "users", user.uid), updates, { merge: true });
        
        const currentShift = updates.shift !== undefined ? updates.shift : shift;
        const currentHistory = updates.history !== undefined ? updates.history : history;
        const currentStats = updates.stats !== undefined ? { ...monthlyStats, ...updates.stats } : monthlyStats;
        const currentBreakState = updates.breakState !== undefined ? updates.breakState : breakState;

        let nextStatus: 'active' | 'break' | 'riding' = 'active';
        if (statusOverride) {
            nextStatus = statusOverride;
        } else if (currentBreakState.isActive) {
            nextStatus = 'break';
        }

        broadcastStatus(user, currentShift, currentHistory, currentStats, nextStatus);
    } catch (e) {
      console.error("Save to DB failed:", e);
    }
  };

  // --- Effects ---
  useEffect(() => {
    getRedirectResult(auth).catch(e => console.error("Auth error:", e));
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
      
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            const updates: any = {};
            let needsUpdate = false;

            if (!data.displayName && currentUser.displayName) {
              updates.displayName = currentUser.displayName;
              needsUpdate = true;
            }
            if (!data.role) {
              updates.role = 'user';
              needsUpdate = true;
            }
            if (!data.status) {
              updates.status = 'pending';
              needsUpdate = true;
            }
            if (needsUpdate) {
              await setDoc(userRef, updates, { merge: true });
            }
            setUserProfile({
              role: data.role || updates.role || 'user',
              status: data.status || updates.status || 'pending'
            });
          } else {
            const newProfile = { role: 'user', status: 'pending' } as const;
            await setDoc(userRef, {
              ...newProfile,
              email: currentUser.email,
              displayName: currentUser.displayName || '名無し',
              createdAt: serverTimestamp()
            }, { merge: true });
            setUserProfile(newProfile);
          }
        } catch (e) {
          console.error("User profile fetch failed:", e);
        }

        setIsDataLoading(true);
        const unsubDB = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          setIsDataLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role && data.status) setUserProfile({ role: data.role, status: data.status });

            const safeShift = sanitizeShift(data.shift);
            if (JSON.stringify(safeShift) !== JSON.stringify(data.shift)) {
               setDoc(doc(db, "users", currentUser.uid), { shift: safeShift }, { merge: true });
            }

            setShift(safeShift);
            setHistory(data.history || []);
            setDayMetadata(data.dayMetadata || {});
            setBreakState(data.breakState || { isActive: false, startTime: null });

            const savedStats = data.stats || {};
            const shimebiDay = savedStats.shimebiDay !== undefined ? savedStats.shimebiDay : 20;
            const businessStartHour = savedStats.businessStartHour ?? 9;
            
            const newStats = {
                monthLabel: savedStats.monthLabel || '',
                totalSales: savedStats.totalSales || 0,
                totalRides: savedStats.totalRides || 0,
                monthlyGoal: savedStats.monthlyGoal || 1000000, 
                defaultDailyGoal: savedStats.defaultDailyGoal ?? 50000,
                shimebiDay: shimebiDay,
                businessStartHour: businessStartHour,
                dutyDays: savedStats.dutyDays && savedStats.dutyDays.length > 0 
                    ? savedStats.dutyDays 
                    : generateDefaultDutyDays(shimebiDay, businessStartHour),
                enabledPaymentMethods: savedStats.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER,
                customPaymentLabels: savedStats.customPaymentLabels || {},
                userName: savedStats.userName || '',
                enabledRideTypes: savedStats.enabledRideTypes || ALL_RIDE_TYPES,
                uid: currentUser.uid,
                visibilityMode: savedStats.visibilityMode || 'PUBLIC',
                allowedViewers: savedStats.allowedViewers || [],
                followingUsers: savedStats.followingUsers || [] 
            };
            setMonthlyStats(newStats);
            broadcastStatus(currentUser, safeShift, data.history || [], newStats, data.breakState?.isActive ? 'break' : 'active');
          } else {
            setShift(null);
            setHistory([]);
            setMonthlyStats(prev => ({ 
              ...prev, 
              dutyDays: generateDefaultDutyDays(20, 9),
              visibilityMode: 'PUBLIC',
              allowedViewers: [],
              followingUsers: [] 
            }));
          }
        });
        return () => unsubDB();
      } else {
        setIsDataLoading(false);
        setShift(null);
        setUserProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  // --- Computed Stats ---
  const currentPeriodStats = useMemo(() => {
    const startHour = monthlyStats.businessStartHour ?? 9;
    const { start, end } = getBillingPeriod(new Date(), monthlyStats.shimebiDay, startHour);
    const adjustedEnd = new Date(end);
    if (monthlyStats.shimebiDay !== 0) adjustedEnd.setDate(monthlyStats.shimebiDay);
    
    const startDateStr = formatDate(start);
    const endDateStr = formatDate(adjustedEnd);
    const allRecords = [...history, ...(shift?.records || [])];
    
    const validRecords = allRecords.filter(r => {
      const rDate = getBusinessDate(r.timestamp, startHour);
      return rDate >= startDateStr && rDate <= endDateStr;
    });

    const totalSales = validRecords.reduce((sum, r) => sum + r.amount, 0);
    return { ...monthlyStats, totalSales, totalRides: validRecords.length };
  }, [history, shift, monthlyStats]);

  // --- Handlers ---
  const handleStart = (goal: number, hours: number) => {
    if (!user) return;
    const startHour = monthlyStats.businessStartHour ?? 9;
    const todayBusinessDate = getBusinessDate(Date.now(), startHour);
    const todaysRecords = history.filter(r => getBusinessDate(r.timestamp, startHour) === todayBusinessDate);
    const otherRecords = history.filter(r => getBusinessDate(r.timestamp, startHour) !== todayBusinessDate);
    
    const startTime = todaysRecords.length > 0 
      ? Math.min(...todaysRecords.map(r => r.timestamp)) 
      : Date.now();
    
    const meta = dayMetadata[todayBusinessDate];
    const existingRest = meta?.totalRestMinutes || 0;

    const newShift: Shift = { 
      id: Math.random().toString(36).substr(2, 9), 
      startTime: startTime, 
      dailyGoal: goal, 
      plannedHours: hours, 
      records: todaysRecords,
      totalRestMinutes: existingRest 
    };

    setShift(newShift);
    setHistory(otherRecords);
    saveToDB({ shift: newShift, history: otherRecords }, 'active'); 
    window.scrollTo(0, 0);
  };

  const finalizeShift = () => {
    if (shift && user) {
      const newHistory = [...history, ...shift.records].sort((a, b) => a.timestamp - b.timestamp);
      const startHour = monthlyStats.businessStartHour ?? 9;
      const bDate = getBusinessDate(shift.startTime, startHour);
      
      const newMeta = {
        ...dayMetadata,
        [bDate]: { 
          ...(dayMetadata[bDate] || { memo: '', attributedMonth: '' }), 
          totalRestMinutes: shift.totalRestMinutes 
        }
      };

      const finalRideCount = shift.records.length;
      const finalShiftSales = shift.records.reduce((sum, r) => sum + r.amount, 0);

      setDoc(doc(db, "users", user.uid), { 
        shift: null, 
        history: newHistory, 
        dayMetadata: newMeta, 
        breakState: { isActive: false, startTime: null } 
      }, { merge: true });

      setDoc(doc(db, "public_status", user.uid), {
          status: 'completed',
          sales: finalShiftSales,
          rideCount: finalRideCount,
          lastUpdated: Date.now(),
      }, { merge: true });
    }
    
    setShift(null);
    setBreakState({ isActive: false, startTime: null });
    setIsDailyReportOpen(false);
  };

  const handleSaveRecord = useCallback(async (
    amt: number, toll: number, method: PaymentMethod, ride: RideType, nonCash: number, timestamp: number, 
    pickup?: string, dropoff?: string, pickupCoords?: string, dropoffCoords?: string, 
    pMale?: number, pFemale?: number, remarks?: string, isBadCustomer?: boolean
  ) => {
    if (!user) return;
    const editId = recordModalState.initialData?.id;
    const startHour = monthlyStats.businessStartHour ?? 9;
    
    const recordObj: SalesRecord = { 
      id: editId || Math.random().toString(36).substr(2, 9), 
      amount: amt, toll, paymentMethod: method, nonCashAmount: nonCash, rideType: ride, timestamp, 
      pickupLocation: pickup, dropoffLocation: dropoff, pickupCoords: pickupCoords || "", dropoffCoords: dropoffCoords || "",
      passengersMale: pMale, passengersFemale: pFemale, remarks: remarks, isBadCustomer: isBadCustomer
    };

    const recordBusinessDate = getBusinessDate(timestamp, startHour);
    const shiftBusinessDate = shift ? getBusinessDate(shift.startTime, startHour) : null;
    const shouldBeInShift = shift && (shiftBusinessDate === recordBusinessDate);

    let newShift = shift;
    let newHistory = history;

    if (editId) {
      const isInShift = shift?.records.some(r => r.id === editId);
      if (isInShift) {
        if (shouldBeInShift) {
          newShift = { ...shift!, records: shift!.records.map(r => r.id === editId ? recordObj : r).sort((a, b) => a.timestamp - b.timestamp) };
        } else {
          newShift = { ...shift!, records: shift!.records.filter(r => r.id !== editId) };
          newHistory = [...history, recordObj].sort((a, b) => a.timestamp - b.timestamp);
        }
      } else {
        if (shouldBeInShift) {
          newHistory = history.filter(r => r.id !== editId);
          newShift = { ...shift!, records: [...shift!.records, recordObj].sort((a, b) => a.timestamp - b.timestamp) };
        } else { 
          newHistory = history.map(r => r.id === editId ? recordObj : r).sort((a, b) => a.timestamp - b.timestamp); 
        }
      }
    } else {
      if (shouldBeInShift) {
        newShift = { ...shift!, records: [...shift!.records, recordObj].sort((a, b) => a.timestamp - b.timestamp) };
      } else { 
        newHistory = [...history, recordObj].sort((a, b) => a.timestamp - b.timestamp); 
      }
    }

    setShift(newShift);
    setHistory(newHistory);
    await saveToDB({ shift: newShift, history: newHistory }, 'active'); 
    setRecordModalState({ open: false });
  }, [shift, history, recordModalState.initialData, monthlyStats, user]);

  const handleDeleteRecord = useCallback(() => {
    if (!user) return;
    const editId = recordModalState.initialData?.id;
    if (!editId) return;
    
    const newShift = shift ? { ...shift, records: shift.records.filter(r => r.id !== editId) } : null;
    const newHistory = history.filter(r => r.id !== editId);
    
    setShift(newShift);
    setHistory(newHistory);
    saveToDB({ shift: newShift, history: newHistory }, 'active'); 
    setRecordModalState({ open: false });
  }, [recordModalState.initialData, shift, history, user]);

  const handleUpdateMonthlyStats = (newStats: Partial<MonthlyStats>) => {
    setMonthlyStats(prev => {
      let updatedDutyDays = newStats.dutyDays || prev.dutyDays;
      if (newStats.shimebiDay !== undefined && newStats.shimebiDay !== prev.shimebiDay) {
         updatedDutyDays = generateDefaultDutyDays(newStats.shimebiDay, newStats.businessStartHour ?? prev.businessStartHour);
      }
      const updated = { ...prev, ...newStats, dutyDays: updatedDutyDays };
      saveToDB({ stats: updated });
      return updated;
    });
  };

  const handleImportRecords = async (importedRecords: SalesRecord[], targetUid?: string) => {
    if (!user) return;
    const uid = targetUid || user.uid;
    const isSelf = uid === user.uid;

    let existingHistory: SalesRecord[] = [];
    if (isSelf) {
        existingHistory = [...history, ...(shift?.records || [])];
    } else {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            existingHistory = [...(data.history || []), ...(data.shift?.records || [])];
        }
    }

    const mergedHistory = [...existingHistory];
    let updatedCount = 0;
    let addedCount = 0;

    importedRecords.forEach(newRec => {
        const matchIndex = mergedHistory.findIndex(existing => {
            const timeDiff = Math.abs(existing.timestamp - newRec.timestamp);
            const isTimeMatch = timeDiff < 60000;
            const isSameAmount = existing.amount === newRec.amount;
            const isSamePickup = newRec.pickupLocation && existing.pickupLocation === newRec.pickupLocation;
            return isTimeMatch && (isSameAmount || isSamePickup);
        });

        if (matchIndex !== -1) {
            mergedHistory[matchIndex] = { ...newRec, id: mergedHistory[matchIndex].id };
            updatedCount++;
        } else {
            mergedHistory.push(newRec);
            addedCount++;
        }
    });

    mergedHistory.sort((a, b) => a.timestamp - b.timestamp);

    if (isSelf) {
        if (shift) {
            const shiftStart = shift.startTime;
            const newHistoryPart = mergedHistory.filter(r => r.timestamp < shiftStart);
            const newShiftPart = mergedHistory.filter(r => r.timestamp >= shiftStart);
            const newShift = { ...shift, records: newShiftPart };
            setHistory(newHistoryPart);
            setShift(newShift);
            await saveToDB({ history: newHistoryPart, shift: newShift });
        } else {
            setHistory(mergedHistory);
            await saveToDB({ history: mergedHistory });
        }
    } else {
        await setDoc(doc(db, "users", uid), { history: mergedHistory }, { merge: true });
    }
    alert(`取り込み完了\n新規: ${addedCount}件\n更新: ${updatedCount}件`);
  };

  return {
    user,
    userProfile,
    isAdmin: user && ADMIN_EMAILS.includes(user.email || ""),
    isAuthChecking,
    isDataLoading,
    shift,
    setShift,
    history,
    dayMetadata,
    setDayMetadata,
    breakState,
    setBreakState,
    monthlyStats,
    setMonthlyStats,
    currentPeriodStats,
    recordModalState,
    setRecordModalState,
    isDailyReportOpen,
    setIsDailyReportOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isShiftEditOpen,
    setIsShiftEditOpen,
    saveToDB,
    handleStart,
    finalizeShift,
    handleSaveRecord,
    handleDeleteRecord,
    handleUpdateMonthlyStats,
    handleImportRecords,
    signInWithRedirect
  };
};