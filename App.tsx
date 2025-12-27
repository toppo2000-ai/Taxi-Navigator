import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo 
} from 'react';
import { 
  Car, 
  BarChart3, 
  Calendar, 
  Loader2,
  Settings,
  User as UserIcon,
  ArrowRight,
  BookOpen,
  Bug, // ★追加
  Shield // 管理者アイコン
} from 'lucide-react';

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
import { auth, googleProvider, db } from './firebase';

// ★新機能コンポーネント
import UnauthorizedView from './UnauthorizedView';
import AdminDashboard from './AdminDashboard';

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
} from './types';

import {
  getBusinessDate,
  getBillingPeriod,
  formatDate,
} from './utils';
import DebugView from './components/DebugView'; // ファイル上部に追加
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import AnalysisView from './components/AnalysisView';
import MangaView from './components/MangaView';
import { 
  RecordModal, 
  DailyReportModal, 
  SettingsModal,
  ShiftEditModal
} from './components/Modals';

// 画像インポート
import naviLoadingImage from './assets/navi-loading.png';
import naviChibiImage from './assets/navi-chibi.png';

/**
 * generateDefaultDutyDays
 * 締め日に基づいて初期の出番日を生成するロジック
 */
const generateDefaultDutyDays = (
  shimebiDay: number = 20, 
  startHour: number = 9
) => {
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

export default function App() {
  // --- 1. アプリケーション共通状態 ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
// ★ユーザー権限・管理者モード状態
  const [userProfile, setUserProfile] = useState<{ role: 'admin' | 'user'; status: 'active' | 'pending' | 'banned' } | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // ★追加: 代理操作（なりすまし）用のID管理
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  // ★追加: 操作対象ID (viewingUidがあればそれ、なければ自分のID)
  const targetUid = viewingUid || user?.uid;

  // --- 2. スプラッシュ画面（起動時演出）状態 ---
  const [appInitLoading, setAppInitLoading] = useState(true);

  // --- 3. ナビゲーション状態 ---
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'analysis' | 'guide'>('home');
  const [targetHistoryDate, setTargetHistoryDate] = useState<string | Date | null>(null);

  // --- 4. 業務コアデータ状態 ---
  const [shift, setShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [dayMetadata, setDayMetadata] = useState<Record<string, DayMetadata>>({});
  const [breakState, setBreakState] = useState<BreakState>({ 
    isActive: false, 
    startTime: null 
  });

  // --- 5. ユーザー設定・統計状態 ---
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
    followingUsers: [] // 初期値
  });

  // --- 6. モーダル・UI制御状態 ---
  const [recordModalState, setRecordModalState] = useState<{ 
    open: boolean; 
    initialData?: Partial<SalesRecord> 
  }>({ 
    open: false 
  });
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShiftEditOpen, setIsShiftEditOpen] = useState(false);

  // --- 7. オンボーディング（名前登録）用状態 ---
  const [tempUserName, setTempUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  /**
   * 起動時演出タイマー
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppInitLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  /**
   * sanitizeShift
   * Firestoreデータを安全な型に変換
   */
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

  /**
   * broadcastStatus
   * 公開ランキング用ステータスの更新
   */
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
      if (stats.shimebiDay !== 0) {
        adjustedEnd.setDate(stats.shimebiDay);
      }
      
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

      // 1. 過去最高記録（トップ5）の計算
      const allHistoryRecords = [...currentHistory, ...(currentShift ? currentShift.records : [])];
      allHistoryRecords.sort((a, b) => b.amount - a.amount);
      const topRecords = allHistoryRecords.slice(0, 5);

// ----- 変更後のコード (ここに貼り付け) -----

      // 2. 全履歴データの構築と月別アーカイブの作成
      const allRecords = [...currentHistory, ...(currentShift?.records || [])];
      
      // 重複排除 (念のためIDで)
      const uniqueRecordsMap = new Map();
      allRecords.forEach(r => uniqueRecordsMap.set(r.id, r));
      const uniqueRecords = Array.from(uniqueRecordsMap.values()) as SalesRecord[];

      // 月別にグループ化 (monthsデータ作成)
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

      // 現在進行中のレコード (records)
      const activeRecords = currentShift ? currentShift.records : [];

      const statusData = {
          uid: currentUser.uid,
          name: stats.userName,
          monthlyTotal: totalMonthlySales,
          status: currentStatus, 
          lastUpdated: Date.now(),
          businessStartHour: stats.businessStartHour,
          visibilityMode: stats.visibilityMode, 
          allowedViewers: stats.allowedViewers,
          
          // ★新しいデータ構造
          topRecords: topRecords, // 歴代記録
          records: activeRecords, // 現在のシフト詳細
          months: monthsData      // 過去の履歴詳細
      };

      if (currentShift) {
        const count = currentShift.records.length;
        const dispatchCount = currentShift.records.filter(r => 
          r.rideType !== 'FLOW' && r.rideType !== 'WAIT'
        ).length;
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

// ----- (ここまで貼り付け) -----
/**
   * 1. 認証状態の監視 (ログイン/ログアウトのみ管理)
   */
  useEffect(() => {
    getRedirectResult(auth).catch(e => console.error("Auth error:", e));
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
      // ログアウト時は代理モードも解除
      if (!currentUser) {
          setViewingUid(null);
          setIsDataLoading(false);
          setShift(null);
          setUserProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  /**
   * 2. データ同期 (targetUid が変わるたびに実行)
   */
  useEffect(() => {
    // ユーザーがいない、またはターゲットが決まっていない場合は何もしない
    if (!user || !targetUid) return;

    const initUserData = async () => {
       setIsDataLoading(true);
       try {
         // ★自分のプロフィール(権限)は常に自分のIDから取得して維持する
         // (これをしないと、一般ユーザーになりすました瞬間に管理者権限を失って戻れなくなるため)
         if (targetUid === user.uid) {
             const userRef = doc(db, 'users', user.uid);
             const userSnap = await getDoc(userRef);
             if (userSnap.exists()) {
                 const data = userSnap.data();
                 setUserProfile({
                     role: data.role || 'user',
                     status: data.status || 'pending'
                 });
             } else {
                 // 新規ユーザー作成
                 const newProfile = { role: 'user', status: 'pending' } as const;
                 await setDoc(userRef, { ...newProfile, email: user.email, createdAt: serverTimestamp() }, { merge: true });
                 setUserProfile(newProfile);
             }
         }

         // ★データ監視: targetUid (自分または代理先) のデータをリッスン
         const unsubDB = onSnapshot(doc(db, "users", targetUid), (docSnap) => {
           setIsDataLoading(false);
           if (docSnap.exists()) {
             const data = docSnap.data();
             
             // --- データセット処理 (中身は以前と同じ) ---
             const safeShift = sanitizeShift(data.shift);
             // 古い形式なら更新
             if (JSON.stringify(safeShift) !== JSON.stringify(data.shift)) {
                setDoc(doc(db, "users", targetUid), { shift: safeShift }, { merge: true });
             }

             setShift(safeShift);
             setHistory(data.history || []);
             setDayMetadata(data.dayMetadata || {});
             
             const bState = data.breakState || { isActive: false, startTime: null };
             setBreakState(bState);

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
                 dutyDays: savedStats.dutyDays || [],
                 enabledPaymentMethods: savedStats.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER,
                 customPaymentLabels: savedStats.customPaymentLabels || {},
                 userName: savedStats.userName || '',
                 enabledRideTypes: savedStats.enabledRideTypes || ALL_RIDE_TYPES,
                 visibilityMode: savedStats.visibilityMode || 'PUBLIC',
                 allowedViewers: savedStats.allowedViewers || [],
                 followingUsers: savedStats.followingUsers || []
             };
             setMonthlyStats(newStats);
             
             // 公開ステータス更新も代理実行
             const actingUser = { ...user, uid: targetUid } as User;
             broadcastStatus(actingUser, safeShift, data.history || [], newStats, bState.isActive ? 'break' : 'active');

           } else {
             // データが存在しない場合 (初期化)
             setShift(null);
             setHistory([]);
             setMonthlyStats(prev => ({ ...prev, uid: targetUid }));
           }
         });
         return unsubDB;
       } catch (e) {
         console.error("Data sync failed", e);
         setIsDataLoading(false);
       }
    };

    let unsubscribe: (() => void) | undefined;
    initUserData().then(unsub => { unsubscribe = unsub; });

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [user, targetUid]); // ★userかtargetUidが変わったら再実行
  /**
   * currentPeriodStats
   */
  const currentPeriodStats = useMemo(() => {
    const startHour = monthlyStats.businessStartHour ?? 9;
    const { start, end } = getBillingPeriod(new Date(), monthlyStats.shimebiDay, startHour);
    const adjustedEnd = new Date(end);
    if (monthlyStats.shimebiDay !== 0) {
      adjustedEnd.setDate(monthlyStats.shimebiDay);
    }
    
    const startDateStr = formatDate(start);
    const endDateStr = formatDate(adjustedEnd);
    const allRecords = [...history, ...(shift?.records || [])];
    
    const validRecords = allRecords.filter(r => {
      const rDate = getBusinessDate(r.timestamp, startHour);
      return rDate >= startDateStr && rDate <= endDateStr;
    });

    const totalSales = validRecords.reduce((sum, r) => sum + r.amount, 0);
    return { 
      ...monthlyStats, 
      totalSales, 
      totalRides: validRecords.length 
    };
  }, [history, shift, monthlyStats]);

  /**
   * saveToDB
   */
  const saveToDB = async (
    updates: any, 
    statusOverride?: 'active' | 'break' | 'riding'
  ) => {
    if (!user || !targetUid) return; // ★変更: userだけでなくtargetUidもチェック
    try { 
        // ★変更: targetUid (代理先) に保存
        await setDoc(doc(db, "users", targetUid), updates, { merge: true });
        
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

        // ★変更: 代理ユーザーとしてランキング等に通知するため、IDを一時的に書き換え
        const actingUser = { ...user, uid: targetUid } as User;
        broadcastStatus(actingUser, currentShift, currentHistory, currentStats, nextStatus);
    } catch (e) {
      console.error("Save to DB failed:", e);
    }
  };

  /**
   * ハンドラ群
   */
  const handleNavigateToHistory = useCallback((date: string | Date) => {
    setTargetHistoryDate(date);
    setActiveTab('history');
  }, []);

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

      const { start, end } = getBillingPeriod(new Date(), monthlyStats.shimebiDay, startHour);
      const adjustedEnd = new Date(end);
      if (monthlyStats.shimebiDay !== 0) adjustedEnd.setDate(monthlyStats.shimebiDay);
      const startStr = formatDate(start);
      const endStr = formatDate(adjustedEnd);

      const updatedMonthlySales = newHistory
        .filter(r => {
          const rd = getBusinessDate(r.timestamp, startHour);
          return rd >= startStr && rd <= endStr;
        })
        .reduce((sum, r) => sum + r.amount, 0);

      const finalRideCount = shift.records.length;
      const finalDispatchCount = shift.records.filter(r => r.rideType !== 'FLOW' && r.rideType !== 'WAIT').length;
      const finalShiftSales = shift.records.reduce((sum, r) => sum + r.amount, 0);

      setDoc(doc(db, "users", user.uid), { 
        shift: null, 
        history: newHistory, 
        dayMetadata: newMeta, 
        breakState: { isActive: false, startTime: null } 
      }, { merge: true });

      setDoc(doc(db, "public_status", user.uid), {
          uid: user.uid,
          name: monthlyStats.userName,
          status: 'completed',
          sales: finalShiftSales,
          rideCount: finalRideCount,
          dispatchCount: finalDispatchCount,
          monthlyTotal: updatedMonthlySales,
          plannedEndTime: Date.now(),
          lastUpdated: Date.now(),
          businessStartHour: monthlyStats.businessStartHour,
          visibilityMode: monthlyStats.visibilityMode,
          allowedViewers: monthlyStats.allowedViewers
      }, { merge: true });
    }
    
    setShift(null);
    setBreakState({ isActive: false, startTime: null });
    setActiveTab('home'); 
    setIsDailyReportOpen(false);
  };

  const handleOpenRecordModal = (initialData?: Partial<SalesRecord>) => {
    setRecordModalState({ open: true, initialData });
    saveToDB({}, 'riding');
  };

  const handleCloseRecordModal = () => {
    setRecordModalState({ open: false });
    saveToDB({}); 
  };

  const handleSaveRecord = useCallback(async (
    amt: number, 
    toll: number, 
    method: PaymentMethod, 
    ride: RideType, 
    nonCash: number, 
    timestamp: number, 
    pickup?: string, 
    dropoff?: string, 
    pickupCoords?: string, 
    dropoffCoords?: string,
    pMale?: number, 
    pFemale?: number, 
    remarks?: string, 
    isBadCustomer?: boolean
  ) => {
    if (!user) return;
    const editId = recordModalState.initialData?.id;
    const startHour = monthlyStats.businessStartHour ?? 9;
    
    const recordObj: SalesRecord = { 
      id: editId || Math.random().toString(36).substr(2, 9), 
      amount: amt, 
      toll, 
      paymentMethod: method, 
      nonCashAmount: nonCash, 
      rideType: ride, 
      timestamp, 
      pickupLocation: pickup, 
      dropoffLocation: dropoff, 
      pickupCoords: pickupCoords || "",
      dropoffCoords: dropoffCoords || "",
      passengersMale: pMale, 
      passengersFemale: pFemale, 
      remarks: remarks, 
      isBadCustomer: isBadCustomer
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

  const handleSaveInitialName = async () => {
    if (!tempUserName.trim()) return;
    setIsSavingName(true);
    const updatedStats = { ...monthlyStats, userName: tempUserName.trim() };
    await saveToDB({ stats: updatedStats });
    setIsSavingName(false);
  };

  const handleClearTargetDate = useCallback(() => {
    setTargetHistoryDate(null);
  }, []);

  const isOnDuty = !!shift;

  // --- スプラッシュ画面 ---
  if (appInitLoading || isAuthChecking || isDataLoading) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center text-amber-500 space-y-8 animate-in fade-in duration-500">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 bg-amber-500/20 blur-[60px] rounded-full animate-pulse"></div>
          <img 
            src={naviLoadingImage} 
            alt="System Navi" 
            className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
          />
        </div>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-amber-500" size={40} />
          <div className="flex flex-col items-center">
            <span className="text-amber-500 font-black tracking-[0.3em] uppercase text-xs animate-pulse">Initializing Navi System</span>
            <div className="h-[2px] w-48 bg-gray-800 mt-2 overflow-hidden rounded-full">
              <div className="h-full bg-amber-500 w-1/3 animate-[loading_1.5s_infinite_linear]"></div>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  // --- ログイン画面 ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center p-8 relative overflow-hidden">
          
          {/* 背景装飾 */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
            
            {/* キャラクター画像 */}
            <div className="relative w-64 h-64 animate-bounce-slow">
              <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full"></div>
              <img 
                src={naviChibiImage} 
                alt="Navi Chibi" 
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
              />
            </div>

            {/* タイトルロゴ */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-200 to-amber-500 tracking-tighter filter drop-shadow-lg">
                TAXI-NAVIGATOR
              </h1>
              <p className="text-gray-500 text-xs font-bold tracking-[0.5em] uppercase">System Login</p>
            </div>

            {/* 豪華なログインボタン */}
            <button 
              onClick={() => signInWithRedirect(auth, googleProvider)} 
              className="group relative w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shine" />
              <div className="flex items-center justify-center gap-3 relative z-10">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                <span>Googleでログイン</span>
              </div>
            </button>
            
            <p className="text-[10px] text-gray-600 font-bold">
              © 2025 Taxi Navigator System
            </p>
          </div>
          
          <style>{`
            @keyframes shine {
              100% { transform: translateX(200%); }
            }
            .animate-shine {
              animation: shine 1s;
            }
            @keyframes bounce-slow {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            .animate-bounce-slow {
              animation: bounce-slow 3s infinite ease-in-out;
            }
          `}</style>
      </div>
    );
  }

  // ★承認待ち・BAN画面のガード
  if (user && userProfile?.status !== 'active') {
    return <UnauthorizedView />;
  }

  // ★名前登録ガード (承認済みの場合のみ表示)
  if (user && !monthlyStats.userName) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-700">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="bg-amber-500/10 w-20 h-20 rounded-3xl border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <Car size={40} className="text-amber-500" />
            </div>
            <h2 className="text-3xl font-black italic text-white tracking-tighter">WELCOME</h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">登録を完了しましょう</p>
          </div>

          <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">担当者名を入力してください</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-600">
                  <UserIcon size={18} />
                </div>
                <input 
                  type="text"
                  placeholder="例: 山田 太郎"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black outline-none focus:border-amber-500/50 transition-all"
                />
              </div>
            </div>

            <button 
              disabled={!tempUserName.trim() || isSavingName}
              onClick={handleSaveInitialName}
              className="w-full bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSavingName ? <Loader2 className="animate-spin" size={20} /> : <>利用を開始する <ArrowRight size={20} /></>}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-600 font-bold px-8">※名前は後から「設定」より変更可能です。</p>
        </div>
      </div>
    );
  }

  // ★管理者ダッシュボード
  if (user && isAdminMode) {
    return <AdminDashboard onBack={() => setIsAdminMode(false)} />;
  }

  // --- メインアプリ表示 ---
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0E14] text-white font-sans pb-28 overflow-x-hidden relative w-full">
      
      {/* ★追加: 代理操作モード中の警告・解除バー */}
      {viewingUid && viewingUid !== user?.uid && (
        <div className="bg-red-600 text-white px-4 py-2 flex justify-between items-center sticky top-0 z-50 shadow-md safe-top animate-in slide-in-from-top">
            <span className="text-xs font-bold animate-pulse flex items-center gap-2">
                <Shield size={16} />
                代理操作中: {monthlyStats.userName || '名称未設定'}
            </span>
            <button 
                onClick={() => setViewingUid(null)} 
                className="bg-white text-red-600 text-xs font-black px-3 py-1.5 rounded-full active:scale-95 shadow-sm"
            >
                解除する
            </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1A222C] border-b border-gray-800 p-4 safe-top sticky top-0 z-30 overflow-hidden relative">
        <div className="flex justify-between items-center relative z-10">
          
          {/* ★変更箇所: キャラクター画像とタイトルロゴ */}
          <div className="flex items-center transform active:scale-95 transition-transform cursor-default">
            {/* キャラクター画像 */}
            <div className="relative z-10 flex items-center -space-x-2 mr-1">
                <div className="relative w-12 h-12 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-bounce-slow">
                    <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
                    <img 
                        src={naviChibiImage} 
                        alt="Navi" 
                        className="w-full h-full object-contain"
                    />
                </div>
            </div>
            
            {/* タイトルロゴ */}
            <div className="flex flex-col -space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-yellow-600 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">TAXI</span>
                <span className="text-sm font-bold italic tracking-widest text-amber-500/80 uppercase">navigator</span>
              </div>
              <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 to-transparent rounded-full opacity-50"></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ★削除: ステータスアイコン（空車/実車）を完全に削除しました */}

            {/* ★管理者ボタン（権限がある場合のみ表示） */}
            {userProfile?.role === 'admin' && (
              <button 
                onClick={() => setIsAdminMode(true)} 
                className="p-2 bg-purple-900/50 border border-purple-500/50 rounded-full text-purple-400 hover:text-white transition-all active:scale-90"
                title="管理者メニュー"
              >
                <Shield size={22} />
              </button>
            )}

            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all active:scale-90 border border-gray-700">
              <Settings size={22} />
            </button>
          </div>
        </div>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>
      </header>

      <main className="w-full overflow-x-hidden">
        {activeTab === 'home' && (
          <Dashboard 
            shift={shift} 
            stats={currentPeriodStats} 
            breakState={breakState}
            onStart={handleStart} 
            onEnd={() => setIsDailyReportOpen(true)} 
            onAdd={(rm) => handleOpenRecordModal(rm ? { remarks: rm } : undefined)} 
            onEdit={(rec) => handleOpenRecordModal(rec)} 
            onUpdateGoal={(val) => handleUpdateMonthlyStats({ monthlyGoal: val })} 
            onUpdateShiftGoal={(val) => { 
                if(shift) { 
                    const s = {...shift, dailyGoal: val}; 
                    setShift(s); 
                    saveToDB({shift: s}); 
                }
            }} 
            onAddRestMinutes={(m) => { 
                if(shift) { 
                    const s = {...shift, totalRestMinutes: (shift.totalRestMinutes||0)+m}; 
                    setShift(s); 
                    saveToDB({shift: s}); 
                }
            }}
            onToggleBreak={() => { 
                let newState = breakState.isActive ? {isActive:false, startTime:null} : {isActive:true, startTime:Date.now()}; 
                setBreakState(newState); 
                saveToDB({breakState: newState}, newState.isActive ? 'break' : 'active'); 
            }}
            setBreakState={(s) => { 
                setBreakState(s); 
                saveToDB({breakState: s}); 
            }}
            onShiftEdit={() => setIsShiftEditOpen(true)}
          />
        )}
        
        {activeTab === 'history' && (
          <HistoryView 
            history={[...history, ...(shift?.records || [])]} 
            dayMetadata={dayMetadata} 
            customPaymentLabels={monthlyStats.customPaymentLabels || {}} 
            businessStartHour={monthlyStats.businessStartHour ?? 9} 
            shimebiDay={monthlyStats.shimebiDay}
            onEditRecord={(rec) => handleOpenRecordModal(rec)} 
            onUpdateMetadata={(date, meta) => { 
                const m = { ...dayMetadata, [date]: { ...(dayMetadata[date] || {}), ...meta } }; 
                setDayMetadata(m); 
                saveToDB({ dayMetadata: m }); 
            }} 
            stats={monthlyStats}
            initialTargetDate={targetHistoryDate}
            onClearTargetDate={handleClearTargetDate}
          />
        )}
        
        {activeTab === 'analysis' && (
          <AnalysisView 
            history={[...history, ...(shift?.records || [])]} 
            stats={monthlyStats} 
            onNavigateToHistory={handleNavigateToHistory}
          />
        )}

{activeTab === 'guide' && (
  <MangaView />
)}
{/* ★追加: デバッグタブの内容 */}
        {activeTab === 'debug' && (
          <DebugView />
        )}
        
      </main>
      
      {/* モーダル群 */}
      {recordModalState.open && (
          <RecordModal 
            initialData={recordModalState.initialData} 
            enabledMethods={monthlyStats.enabledPaymentMethods} 
            enabledRideTypes={monthlyStats.enabledRideTypes || ALL_RIDE_TYPES} 
            customLabels={monthlyStats.customPaymentLabels || {}} 
            onClose={handleCloseRecordModal} 
            onSave={handleSaveRecord} 
            onDelete={handleDeleteRecord} 
            businessStartHour={monthlyStats.businessStartHour ?? 9} 
          />
      )}
      
      {isDailyReportOpen && shift && (
          <DailyReportModal 
            shift={shift} 
            customLabels={monthlyStats.customPaymentLabels || {}} 
            enabledMethods={monthlyStats.enabledPaymentMethods} 
            businessStartHour={monthlyStats.businessStartHour ?? 9} 
            onConfirm={finalizeShift} 
            onClose={() => setIsDailyReportOpen(false)} 
          />
      )}
      
      {isSettingsOpen && (
          <SettingsModal 
            stats={monthlyStats} 
            isAdmin={userProfile?.role === 'admin'} 
            onUpdateStats={handleUpdateMonthlyStats} 
            onClose={() => setIsSettingsOpen(false)} 
            // ★追加: 代理ログイン関数を渡す
            onImpersonate={(uid) => {
                setViewingUid(uid);
                setIsSettingsOpen(false);
            }}
          />
      )}
      
      {isShiftEditOpen && shift && (
          <ShiftEditModal 
            shift={shift} 
            onClose={() => setIsShiftEditOpen(false)} 
            onSave={(st, ph) => { 
                if(shift) { 
                    const s = {...shift, startTime:st, plannedHours:ph}; 
                    setShift(s); 
                    saveToDB({shift: s}); 
                }
            }} 
          />
      )}
      
      {/* 日本語化ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0A0E14]/95 backdrop-blur-2xl border-t border-gray-800 flex justify-around pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-15px_45px_rgba(0,0,0,0.8)]">
        <button 
          onClick={() => setActiveTab('home')} 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'home' ? 'text-amber-500' : 'text-gray-500'}`}
        >
          <Car className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">ホーム</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
        >
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('analysis')} 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">分析</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('guide')} 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'guide' ? 'text-amber-500' : 'text-gray-500'}`}
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">ガイド</span>
        </button>

        {/* ★追加: デバッグボタン */}
        <button 
          onClick={() => setActiveTab('debug')} 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'debug' ? 'text-red-500' : 'text-gray-600'}`}
        >
          <Bug className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Debug</span>
        </button>

      </nav>
    </div>
  );
}