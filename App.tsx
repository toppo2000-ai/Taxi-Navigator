import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef
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
  Shield,
  Trophy,
  ClipboardList
} from 'lucide-react';

import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore'; 
import { auth, googleProvider, db } from './services/firebase';

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
  calculatePeriodStats,
  filterRecordsWithSimpleModePriority,
} from './utils';
import DebugView from './components/views/DebugView';
import Dashboard from './components/dashboard/Dashboard';
import HistoryView from './components/views/HistoryView';
import AnalysisView from './components/views/AnalysisView';
import AnalyticsView from './components/views/AnalyticsView';
import MangaView from './components/views/MangaView';
import { CalendarView } from './components/views/CalendarView';
import { 
  RecordModal, 
  DailyReportModal, 
  SettingsModal,
  ShiftEditModal,
  CsvImportModal
} from './components/Modals';
import { ModeSelectionModal } from './components/common/modals/ModeSelectionModal';
import { SimpleInputView } from './components/views/SimpleInputView';
import { SimpleRankingView } from './components/views/SimpleRankingView';
import { SimpleHistoryView } from './components/views/SimpleHistoryView';
import { SimpleDashboard } from './components/views/SimpleDashboard';
import { InputMode } from './types';

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
  const [targetHistoryRecordId, setTargetHistoryRecordId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const showModeSelectionRef = useRef(false);

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
    followingUsers: []
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
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // デバッグ: isSettingsOpenの状態変化を監視
  useEffect(() => {
    console.log('[App.tsx] isSettingsOpen changed to:', isSettingsOpen);
  }, [isSettingsOpen]);

  // --- 7. オンボーディング（名前登録）用状態 ---
  const [tempUserName, setTempUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  // ★追加: isSavingNameの最新値を保持するためのref（onSnapshotのコールバックで使用）
  const isSavingNameRef = useRef(false);

  /**
   * 起動時演出タイマー
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppInitLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);
  
// App.tsx の useEffect 内に追加
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 何か入力中や、シフト中（shift !== null）の場合だけ警告を出す
      if (shift || recordModalState.open) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shift, recordModalState.open]);

  /**
   * sanitizeShift
   * Firestoreデータを安全な型に変換
   */
  const sanitizeShift = (rawShift: any): Shift | null => {
    if (!rawShift) return null;
    const safeNum = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
    
    const sanitized: any = {
      ...rawShift,
      dailyGoal: safeNum(rawShift.dailyGoal, 50000),
      plannedHours: safeNum(rawShift.plannedHours, 12),
      totalRestMinutes: safeNum(rawShift.totalRestMinutes, 0),
      startTime: safeNum(rawShift.startTime, Date.now()),
      records: (rawShift.records || []).map((r: any) => {
        const record: any = {
          ...r,
          amount: safeNum(r.amount, 0),
          toll: safeNum(r.toll, 0),
          nonCashAmount: safeNum(r.nonCashAmount, 0),
          passengersMale: safeNum(r.passengersMale, 0),
          passengersFemale: safeNum(r.passengersFemale, 0),
          timestamp: safeNum(r.timestamp, Date.now()),
          pickupCoords: r.pickupCoords || "", 
          dropoffCoords: r.dropoffCoords || "" 
        };
        // returnTollがundefinedの場合はフィールド自体を追加しない
        if (r.returnToll !== undefined) {
          record.returnToll = safeNum(r.returnToll, 0);
        }
        return record;
      })
    };
    
    // startOdoが存在する場合のみ追加（undefinedの場合はフィールド自体を追加しない）
    if (rawShift.startOdo !== undefined) {
      sanitized.startOdo = safeNum(rawShift.startOdo, 0);
    }
    
    return sanitized as Shift;
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
    // ★修正: currentUser.uidではなく、actingUser.uid（targetUid）を使用するため、currentUser.uidをtargetUidとして使用
    const targetUidForBroadcast = currentUser.uid;
    
    try {
      const startHour = stats.businessStartHour ?? 9;
      const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, startHour);
      const adjustedEnd = new Date(end);
      if (stats.shimebiDay !== 0) {
        adjustedEnd.setDate(stats.shimebiDay);
      }
      
      const startStr = formatDate(start);
      const endStr = formatDate(adjustedEnd);
      
      // 簡易モード優先で月間合計を計算
      const periodStats = calculatePeriodStats(stats, currentHistory, currentShift);
      const totalMonthlySales = periodStats.totalSales;

      // 1. 過去最高記録（トップ5）の計算（簡易モードのレコードは除外）
      const allHistoryRecords = [...currentHistory, ...(currentShift ? currentShift.records : [])]
        .filter(r => !r.remarks?.includes('簡易モード')); // 簡易モードのレコードを除外
      allHistoryRecords.sort((a, b) => b.amount - a.amount);
      const topRecords = allHistoryRecords.slice(0, 5);

      // 2. 全履歴データの構築と月別アーカイブの作成
      const allRecords = [...currentHistory, ...(currentShift?.records || [])];
      
      // 重複排除 (念のためIDで)
      const uniqueRecordsMap = new Map();
      allRecords.forEach(r => uniqueRecordsMap.set(r.id, r));
      const uniqueRecords = Array.from(uniqueRecordsMap.values()) as SalesRecord[];

      // 月別にグループ化 (monthsデータ作成)
      const monthsData: Record<string, any> = {};
      
      // まず月別にグループ化
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
      });
      
      // 各月について簡易モード優先でフィルタリングしてからsalesを計算
      Object.keys(monthsData).forEach(sortKey => {
          const monthRecords = monthsData[sortKey].records;
          const filteredRecords = filterRecordsWithSimpleModePriority(monthRecords, startHour);
          monthsData[sortKey].records = filteredRecords;
          monthsData[sortKey].sales = filteredRecords.reduce((sum: number, r: SalesRecord) => sum + r.amount, 0);
      });

      // 現在進行中のレコード (records)
      const activeRecords = currentShift ? currentShift.records : [];

      const statusData = {
          uid: targetUidForBroadcast, // ★修正: currentUser.uidではなく、targetUidForBroadcastを使用
          name: stats.userName,
          monthlyTotal: totalMonthlySales,
          monthlyGoal: stats.monthlyGoal || 1000000, // 月間目標を保存
          status: currentStatus, 
          lastUpdated: Date.now(),
          businessStartHour: stats.businessStartHour,
          visibilityMode: stats.visibilityMode, 
          allowedViewers: stats.allowedViewers,
          
          // ★新しいデータ構造
          topRecords: topRecords,
          records: activeRecords,
          months: monthsData,
          // ★追加: historyフィールドを保存（カレンダーやColleagueStatusListで使用）
          history: uniqueRecords
      };

      if (currentShift) {
        const count = currentShift.records.length;
        const dispatchCount = currentShift.records.filter(r => 
          r.rideType !== 'FLOW' && r.rideType !== 'WAIT'
        ).length;
        const endTime = currentShift.startTime + (currentShift.plannedHours * 3600000);
        const currentShiftSales = currentShift.records.reduce((sum, r) => sum + r.amount, 0);

        const publicStatusData = {
          ...statusData,
          startTime: currentShift.startTime,
          plannedEndTime: endTime,
          sales: currentShiftSales,
          rideCount: count,
          dispatchCount: dispatchCount,
        };
        
        // undefinedを削除してから保存
        const cleanedPublicStatus = removeUndefinedFields(publicStatusData);
        const timestamp = Date.now();
        cleanedPublicStatus.lastUpdated = timestamp; // 必ずlastUpdatedを更新
        console.log('[broadcastStatus] Saving public_status for uid:', targetUidForBroadcast, 'at', new Date(timestamp).toISOString(), 'data:', {
          status: cleanedPublicStatus.status,
          sales: cleanedPublicStatus.sales,
          rideCount: cleanedPublicStatus.rideCount,
          name: cleanedPublicStatus.name
        });
        
        // awaitを削除して非同期実行とし、リアルタイム更新の遅延を最小化
        setDoc(doc(db, "public_status", targetUidForBroadcast), cleanedPublicStatus, { merge: true }).then(() => {
          console.log('[broadcastStatus] Successfully saved public_status for uid:', targetUidForBroadcast);
        }).catch((e) => {
          console.error('[broadcastStatus] Failed to save public_status:', e);
        });
      } else {
        // オフライン時も営収を計算（当日の売上）
        const todayBusinessDate = getBusinessDate(Date.now(), startHour);
        const todaySales = currentHistory
          .filter(r => getBusinessDate(r.timestamp, startHour) === todayBusinessDate)
          .reduce((sum, r) => sum + r.amount, 0);
        
        const publicStatusData = {
          ...statusData,
          status: 'offline',
          sales: todaySales, // ★追加: オフライン時も営収を表示（ColleagueStatusListで使用）
          rideCount: 0, // オフライン時は0
          dispatchCount: 0, // オフライン時は0
        };
        
        // undefinedを削除してから保存
        const cleanedPublicStatus = removeUndefinedFields(publicStatusData);
        const timestamp = Date.now();
        cleanedPublicStatus.lastUpdated = timestamp; // 必ずlastUpdatedを更新
        console.log('[broadcastStatus] Saving offline status for uid:', targetUidForBroadcast, 'at', new Date(timestamp).toISOString());
        
        // awaitを削除して非同期実行とし、リアルタイム更新の遅延を最小化
        setDoc(doc(db, "public_status", targetUidForBroadcast), cleanedPublicStatus, { merge: true }).then(() => {
          console.log('[broadcastStatus] Successfully saved offline status for uid:', targetUidForBroadcast);
        }).catch((e) => {
          console.error('[broadcastStatus] Failed to save offline status:', e);
        });
      }
    } catch (e) {
      console.error("Broadcast failed:", e);
    }
  };

/**
   * 1. 認証状態の監視 (ログイン/ログアウトのみ管理)
   */
  useEffect(() => {
    // リダイレクト結果を処理
    const handleRedirectResult = async () => {
      try {
        // Firebase Hostingの認証ハンドラーページにいる場合は、元の環境に戻す
        // （この処理はReactアプリが読み込まれる前に実行される必要があるため、
        //  index.htmlでも同様の処理を追加しているが、念のためここでも処理）
        if (window.location.hostname.includes('firebaseapp.com') && window.location.pathname.includes('/__/auth/handler')) {
          console.log('[App.tsx] Detected Firebase Hosting auth handler, redirecting to original environment...');
          console.log('[App.tsx] Current URL:', window.location.href);
          
          // URLパラメータを取得（認証コードを含む）
          const params = new URLSearchParams(window.location.search);
          console.log('[App.tsx] URL params:', Object.fromEntries(params.entries()));
          console.log('[App.tsx] Has code:', params.has('code'));
          console.log('[App.tsx] Has state:', params.has('state'));
          
          // 保存されたオリジン情報を取得（本番環境または開発環境のURL）
          let savedOrigin = null;
          let savedHostname = null;
          let savedPort = '';
          
          try {
            savedOrigin = localStorage.getItem('auth_redirect_origin');
            savedHostname = localStorage.getItem('auth_redirect_hostname');
            savedPort = localStorage.getItem('auth_redirect_port') || '';
          } catch (e) {
            console.warn('[App.tsx] localStorage access failed:', e);
          }
          
          if (!savedOrigin) {
            try {
              savedOrigin = sessionStorage.getItem('auth_redirect_origin');
              savedHostname = sessionStorage.getItem('auth_redirect_hostname');
              savedPort = sessionStorage.getItem('auth_redirect_port') || '';
            } catch (e) {
              console.warn('[App.tsx] sessionStorage access failed:', e);
            }
          }
          
          console.log('[App.tsx] Saved redirect info:', { savedOrigin, savedHostname, savedPort });
          
          let redirectUrl: string;
          if (savedOrigin) {
            // 保存されたオリジンを使用（本番環境または開発環境のURL）
            redirectUrl = savedOrigin;
          } else if (savedHostname) {
            // ホスト名が保存されている場合
            const protocol = savedHostname === 'localhost' ? 'http' : window.location.protocol;
            redirectUrl = `${protocol}//${savedHostname}${savedPort ? ':' + savedPort : ''}`;
          } else {
            // フォールバック: context_uriパラメータから取得を試みる
            const contextUri = params.get('context_uri') || params.get('continue');
            if (contextUri) {
              try {
                const contextUrl = new URL(decodeURIComponent(contextUri));
                if (contextUrl.hostname.includes('web.app') || contextUrl.hostname.includes('firebaseapp.com')) {
                  redirectUrl = contextUrl.origin;
                  console.log('[App.tsx] Using context_uri:', redirectUrl);
                } else {
                  redirectUrl = window.location.protocol + '//pro-taxi-d3945.web.app';
                  console.warn('[App.tsx] context_uri not usable, using fallback:', redirectUrl);
                }
              } catch (e) {
                redirectUrl = window.location.protocol + '//pro-taxi-d3945.web.app';
                console.warn('[App.tsx] Failed to parse context_uri, using fallback:', redirectUrl);
              }
            } else {
              redirectUrl = window.location.protocol + '//pro-taxi-d3945.web.app';
              console.warn('[App.tsx] No saved origin found, using fallback:', redirectUrl);
            }
          }
          
          // URLパラメータを保持して元の環境にリダイレクト
          const paramsString = params.toString();
          const finalUrl = redirectUrl + (paramsString ? '?' + paramsString : '');
          console.log('[App.tsx] Redirecting to:', finalUrl);
          console.log('[App.tsx] Preserving params:', paramsString);
          
          // パラメータがない場合は警告
          if (!paramsString || (!params.has('code') && !params.has('state'))) {
            console.error('[App.tsx] ⚠️ WARNING: No auth params found in URL!');
            console.error('[App.tsx] This might cause authentication to fail.');
            console.error('[App.tsx] Current search:', window.location.search);
          }
          
          window.location.href = finalUrl;
          return;
        }
        
        // ローカル環境でリダイレクト結果を処理
        console.log('[App.tsx] Processing redirect result...');
        
        // URLパラメータを確認（認証コードがあるかチェック）
        const params = new URLSearchParams(window.location.search);
        const hasAuthParams = params.has('code') || params.has('state') || params.has('authuser') || params.has('prompt');
        
        console.log('[App.tsx] Current URL:', window.location.href);
        console.log('[App.tsx] URL params:', Object.fromEntries(params.entries()));
        console.log('[App.tsx] Has auth params:', hasAuthParams);
        
        if (hasAuthParams) {
          console.log('[App.tsx] Auth parameters detected in URL:', {
            hasCode: params.has('code'),
            hasState: params.has('state'),
            hasAuthUser: params.has('authuser'),
            hasPrompt: params.has('prompt'),
            code: params.get('code') ? params.get('code')?.substring(0, 20) + '...' : null,
            state: params.get('state') ? params.get('state')?.substring(0, 20) + '...' : null
          });
          
          // ★重要: 認証パラメータがある場合、isAuthCheckingをtrueのままにして認証状態の更新を待つ
          // これにより、ログイン画面が表示されない
          console.log('[App.tsx] Auth params detected, keeping isAuthChecking=true until auth state updates');
          
          // 認証パラメータがある場合、getRedirectResultを試行
          try {
            console.log('[App.tsx] Calling getRedirectResult...');
            const result = await getRedirectResult(auth);
            if (result) {
              console.log('[App.tsx] ✅ Redirect login successful:', result.user.email);
              console.log('[App.tsx] User UID:', result.user.uid);
              console.log('[App.tsx] User:', result.user);
              
              // 保存しておいた元のURLを取得
              const savedRedirectUrl = localStorage.getItem('login_redirect_url') || sessionStorage.getItem('login_redirect_url');
              if (savedRedirectUrl) {
                console.log('[App.tsx] Restoring saved URL:', savedRedirectUrl);
                // 用が済んだので削除
                try {
                  localStorage.removeItem('login_redirect_url');
                  sessionStorage.removeItem('login_redirect_url');
                } catch (e) {
                  console.warn('[App.tsx] Failed to remove saved URL:', e);
                }
                
                // 現在のURLと保存していたURLが違う場合のみ移動（無限ループ防止）
                if (window.location.href !== savedRedirectUrl) {
                  // URLパラメータをクリアしてからリダイレクト
                  const savedUrlObj = new URL(savedRedirectUrl);
                  const cleanUrl = savedUrlObj.origin + savedUrlObj.pathname;
                  console.log('[App.tsx] Redirecting to saved URL:', cleanUrl);
                  window.location.replace(cleanUrl);
                  return;
                }
              }
              
              // 認証成功後、URLパラメータをクリア
              if (window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            } else {
              console.warn('[App.tsx] ⚠️ No redirect result, but auth params exist. Waiting for onAuthStateChanged...');
              console.warn('[App.tsx] This might indicate a sessionStorage issue on mobile devices.');
              // 認証パラメータがあるが結果がない場合、onAuthStateChangedを待つ
              // URLパラメータは後でクリア（認証が成功した場合）
            }
          } catch (e: any) {
            // sessionStorageエラーの場合は無視（リダイレクトが完了していれば認証状態は更新される）
            if (e?.message?.includes('sessionStorage') || e?.message?.includes('initial state') || e?.message?.includes('missing initial state')) {
              console.warn('[App.tsx] sessionStorage error - this is common on mobile devices. Auth state will be updated by onAuthStateChanged if login was successful.');
              console.warn('[App.tsx] Error details:', e?.message);
              // エラーを無視して続行（onAuthStateChangedが認証状態を更新する）
              // 認証パラメータがあるので、認証は進行中とみなす
            } else {
              console.error("[App.tsx] Auth redirect error:", e);
              console.error("[App.tsx] Error details:", {
                message: e?.message,
                code: e?.code,
                stack: e?.stack
              });
            }
          }
        } else {
          // 認証パラメータがない場合、通常のgetRedirectResultを試行
          // （firebaseapp.comからリダイレクトされた後、パラメータが失われている可能性がある）
          try {
            const result = await getRedirectResult(auth);
            if (result) {
              console.log('[App.tsx] ✅ Redirect login successful (no params):', result.user.email);
              console.log('[App.tsx] User UID:', result.user.uid);
              
              // 保存しておいた元のURLを取得
              const savedRedirectUrl = localStorage.getItem('login_redirect_url') || sessionStorage.getItem('login_redirect_url');
              if (savedRedirectUrl) {
                console.log('[App.tsx] Restoring saved URL:', savedRedirectUrl);
                // 用が済んだので削除
                try {
                  localStorage.removeItem('login_redirect_url');
                  sessionStorage.removeItem('login_redirect_url');
                } catch (e) {
                  console.warn('[App.tsx] Failed to remove saved URL:', e);
                }
                
                // 現在のURLと保存していたURLが違う場合のみ移動（無限ループ防止）
                if (window.location.href !== savedRedirectUrl) {
                  const savedUrlObj = new URL(savedRedirectUrl);
                  const cleanUrl = savedUrlObj.origin + savedUrlObj.pathname;
                  console.log('[App.tsx] Redirecting to saved URL:', cleanUrl);
                  window.location.replace(cleanUrl);
                  return;
                }
              }
            } else {
              console.log('[App.tsx] No redirect result and no auth code in URL');
            }
          } catch (e: any) {
            // sessionStorageエラーの場合は無視
            if (e?.message?.includes('sessionStorage') || e?.message?.includes('initial state') || e?.message?.includes('missing initial state')) {
              console.warn('[App.tsx] sessionStorage error - this is common on mobile devices.');
            } else {
              console.error("[App.tsx] Auth redirect error:", e);
            }
          }
        }
      } catch (e) {
        console.error("[App.tsx] Unexpected error in handleRedirectResult:", e);
      }
    };
    
    handleRedirectResult();
    
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[App.tsx] ===== Auth state changed =====');
      console.log('[App.tsx] Current user:', currentUser ? {
        email: currentUser.email,
        uid: currentUser.uid,
        emailVerified: currentUser.emailVerified
      } : 'null (signed out)');
      console.log('[App.tsx] Current URL:', window.location.href);
      
      // ★重要: 認証パラメータがある場合、認証状態が更新されるまで少し待つ
      const params = new URLSearchParams(window.location.search);
      const hasAuthParams = params.has('code') || params.has('state') || params.has('authuser') || params.has('prompt');
      
      if (hasAuthParams && currentUser) {
        console.log('[App.tsx] Auth params exist and user is authenticated, clearing URL params');
        // 認証成功後、URLパラメータをクリア（リダイレクト後のパラメータを削除）
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        // 少し待ってからユーザー状態を更新（確実に認証状態が反映されるように）
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // ★重要: 認証パラメータがあるが、ユーザーがnullの場合（モバイルでのsessionStorage問題）
      // または、firebaseapp.comからリダイレクトされた直後で認証状態がまだ更新されていない場合
      if (hasAuthParams && !currentUser) {
        console.log('[App.tsx] ⚠️ Auth params exist but user is null. This might be a sessionStorage issue on mobile.');
        console.log('[App.tsx] Waiting for auth state to update...');
        // 認証状態の更新を待機（最大5秒）
        setIsAuthChecking(true);
        
        // 即座にgetRedirectResultを試行
        getRedirectResult(auth).then((result) => {
          if (result && result.user) {
            console.log('[App.tsx] ✅ getRedirectResult succeeded immediately:', result.user.email);
            setUser(result.user);
            setIsAuthChecking(true); // userProfileの取得を待つ
          } else {
            console.warn('[App.tsx] ⚠️ getRedirectResult returned no result, waiting for onAuthStateChanged...');
            // onAuthStateChangedを待つ（最大5秒）
            const timeout = setTimeout(() => {
              const retryUser = auth.currentUser;
              if (retryUser) {
                console.log('[App.tsx] ✅ Auth state updated after waiting:', retryUser.email);
                setUser(retryUser);
                setIsAuthChecking(true); // userProfileの取得を待つ
              } else {
                console.error('[App.tsx] ❌ Auth state still null after waiting');
                setIsAuthChecking(false);
              }
            }, 5000);
            
            // 認証状態が更新されたらタイムアウトをクリア
            const checkInterval = setInterval(() => {
              const checkUser = auth.currentUser;
              if (checkUser) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                console.log('[App.tsx] ✅ Auth state updated during wait:', checkUser.email);
                setUser(checkUser);
                setIsAuthChecking(true); // userProfileの取得を待つ
              }
            }, 100);
            
            setTimeout(() => {
              clearInterval(checkInterval);
            }, 5000);
          }
        }).catch((e: any) => {
          console.error('[App.tsx] ❌ getRedirectResult failed:', e);
          // sessionStorageエラーの場合は無視して、onAuthStateChangedを待つ
          if (e?.message?.includes('sessionStorage') || e?.message?.includes('initial state') || e?.message?.includes('missing initial state')) {
            console.warn('[App.tsx] sessionStorage error - waiting for onAuthStateChanged to update auth state');
            setIsAuthChecking(true);
          } else {
            setIsAuthChecking(false);
          }
        });
        
        // この時点ではユーザーを設定しない（待機中）
        return;
      }
      
      // ★重要: 認証パラメータがないが、firebaseapp.comからリダイレクトされた可能性がある場合
      // （Firebase認証ハンドラーで認証コードが処理された後、パラメータなしでリダイレクトされる）
      if (!hasAuthParams && !currentUser) {
        // firebaseapp.comからリダイレクトされた可能性をチェック
        const referrer = document.referrer;
        if (referrer.includes('firebaseapp.com') || referrer.includes('__/auth/handler')) {
          console.log('[App.tsx] ⚠️ No auth params but might have come from firebaseapp.com');
          console.log('[App.tsx] Referrer:', referrer);
          console.log('[App.tsx] Trying getRedirectResult...');
          setIsAuthChecking(true);
          
          getRedirectResult(auth).then((result) => {
            if (result && result.user) {
              console.log('[App.tsx] ✅ getRedirectResult succeeded (no params):', result.user.email);
              setUser(result.user);
              setIsAuthChecking(true); // userProfileの取得を待つ
            } else {
              console.warn('[App.tsx] ⚠️ getRedirectResult returned no result');
              // onAuthStateChangedを待つ
              setTimeout(() => {
                const retryUser = auth.currentUser;
                if (retryUser) {
                  console.log('[App.tsx] ✅ Auth state updated after waiting:', retryUser.email);
                  setUser(retryUser);
                  setIsAuthChecking(true); // userProfileの取得を待つ
                } else {
                  console.error('[App.tsx] ❌ Auth state still null');
                  setIsAuthChecking(false);
                }
              }, 2000);
            }
          }).catch((e: any) => {
            console.error('[App.tsx] ❌ getRedirectResult failed:', e);
            if (e?.message?.includes('sessionStorage') || e?.message?.includes('initial state') || e?.message?.includes('missing initial state')) {
              console.warn('[App.tsx] sessionStorage error - waiting for onAuthStateChanged');
              setIsAuthChecking(true);
            } else {
              setIsAuthChecking(false);
            }
          });
          
          return;
        }
      }
      
      setUser(currentUser);
      
      // ログアウト時は代理モードも解除し、isAuthCheckingをfalseにする
      if (!currentUser) {
          // ★重要: 認証パラメータがない場合のみログアウトとみなす
          if (!hasAuthParams) {
            console.log('[App.tsx] User logged out, resetting state');
            setViewingUid(null);
            setIsDataLoading(false);
            setShift(null);
            setUserProfile(null);
            setIsAuthChecking(false);
          } else {
            console.log('[App.tsx] ⚠️ User is null but auth params exist. This might be a sessionStorage issue on mobile.');
            console.log('[App.tsx] Keeping isAuthChecking=true and waiting for auth state to update...');
            // 認証パラメータがある場合は、認証状態の更新を待つ
            setIsAuthChecking(true);
            
            // 認証状態の更新を待機（最大3秒）
            setTimeout(async () => {
              const retryUser = auth.currentUser;
              if (retryUser) {
                console.log('[App.tsx] ✅ Auth state updated after waiting:', retryUser.email);
                setUser(retryUser);
              } else {
                console.warn('[App.tsx] ⚠️ Auth state still null after waiting. Trying getRedirectResult...');
                try {
                  const result = await getRedirectResult(auth);
                  if (result && result.user) {
                    console.log('[App.tsx] ✅ getRedirectResult succeeded:', result.user.email);
                    setUser(result.user);
                  }
                } catch (e: any) {
                  console.error('[App.tsx] ❌ getRedirectResult failed:', e);
                }
              }
            }, 3000);
          }
      } else {
          // ★重要: ログイン時は、userProfileが取得されるまでisAuthCheckingをtrueのままにする
          // これにより、userProfileがnullの状態でログイン画面が表示されることを防ぐ
          console.log('[App.tsx] User logged in, isAuthChecking will remain true until userProfile is loaded');
          console.log('[App.tsx] Current state - user:', currentUser.email, 'isAuthChecking: true (will be set to false after userProfile is loaded)');
          // isAuthCheckingは、データ同期のuseEffectでuserProfileが取得された後にfalseになる
          // この間、スプラッシュ画面が表示される
          // ★重要: 既にisAuthCheckingがfalseになっている場合は、trueに戻す（リダイレクト後の再レンダリング対策）
          // ただし、userProfileが既に取得されている場合は、falseのままにする
          if (!userProfile) {
            console.log('[App.tsx] userProfile is null, setting isAuthChecking to true');
            setIsAuthChecking(true);
          } else {
            console.log('[App.tsx] userProfile already exists:', userProfile, 'keeping isAuthChecking as is');
          }
      }
    });
    return () => unsubAuth();
  }, []);

  /**
   * 2. データ同期 (targetUid が変わるたびに実行)
   */
  useEffect(() => {
    // ユーザーがいない、またはターゲットが決まっていない場合は何もしない
    if (!user || !targetUid) {
      console.log('[App.tsx] Data sync useEffect skipped - user:', user?.email || 'null', 'targetUid:', targetUid);
      return;
    }

    console.log('[App.tsx] Data sync useEffect started - user:', user.email, 'targetUid:', targetUid);

    const initUserData = async () => {
       setIsDataLoading(true);
       try {
         // ★自分のプロフィール(権限)は常に自分のIDから取得して維持する
         if (targetUid === user.uid) {
             console.log('[App.tsx] Fetching userProfile for:', user.uid);
             const userRef = doc(db, 'users', user.uid);
             
             // ★重要: タイムアウトを設定（10秒でタイムアウト）
             const timeoutPromise = new Promise((_, reject) => {
               setTimeout(() => {
                 reject(new Error('タイムアウト: userProfileの取得が10秒以内に完了しませんでした。'));
               }, 10000);
             });
             
             try {
               const userSnap = await Promise.race([
                 getDoc(userRef),
                 timeoutPromise
               ]) as any;
               
               if (userSnap.exists()) {
                 const data = userSnap.data();
                 const profile = {
                     role: data.role || 'user',
                     status: data.status || 'pending'
                 };
                 console.log('[App.tsx] UserProfile loaded from Firestore:', profile);
                 setUserProfile(profile);
                 // ★重要: userProfileが取得されたら、isAuthCheckingをfalseにする
                 console.log('[App.tsx] Setting isAuthChecking to false after userProfile loaded');
                 setIsAuthChecking(false);
              } else {
                // 新規ユーザー作成
                const newProfile = { role: 'user', status: 'pending' } as const;
                console.log('[App.tsx] Creating new user profile:', newProfile);
                try {
                  await Promise.race([
                    setDoc(userRef, { ...newProfile, email: user.email, createdAt: serverTimestamp() }, { merge: false }),
                    timeoutPromise
                  ]);
                  console.log('[App.tsx] New user profile created successfully in users collection');
                  setUserProfile(newProfile);
                  // ★重要: userProfileが取得されたら、isAuthCheckingをfalseにする
                  console.log('[App.tsx] Setting isAuthChecking to false after new userProfile created');
                  setIsAuthChecking(false);
                } catch (createError: any) {
                  console.error('[App.tsx] Error creating user profile:', createError);
                  // エラーが発生した場合でも、デフォルトのプロフィールを設定して続行
                  setUserProfile(newProfile);
                  setIsAuthChecking(false);
                  // ユーザープロファイルの作成を再試行（非同期で実行、エラーは無視）
                  setDoc(userRef, { ...newProfile, email: user.email, createdAt: serverTimestamp() }, { merge: false }).catch((retryError) => {
                    console.error('[App.tsx] Retry failed to create user profile:', retryError);
                  });
                }
              }
             } catch (e: any) {
               console.error('[App.tsx] Error fetching/creating userProfile:', e);
               // エラーが発生した場合でも、デフォルトのプロフィールを設定
               const defaultProfile = { role: 'user', status: 'pending' } as const;
               console.warn('[App.tsx] Using default profile due to error:', defaultProfile);
               setUserProfile(defaultProfile);
               setIsAuthChecking(false);
             }
         } else {
             // 代理モードの場合でも、isAuthCheckingをfalseにする（プロフィール取得は不要）
             console.log('[App.tsx] Proxy mode, skipping userProfile check');
             setIsAuthChecking(false);
         }

         // ★データ監視: targetUid (自分または代理先) のデータをリッスン
         const unsubDB = onSnapshot(doc(db, "users", targetUid), (docSnap) => {
           console.log('[onSnapshot] Document snapshot received, exists:', docSnap.exists(), 'isSavingNameRef.current:', isSavingNameRef.current);
           setIsDataLoading(false);
           
           // ★重要: 登録処理中（isSavingNameRef.currentがtrue）の場合は、onSnapshotの更新をスキップ
           // これにより、handleSaveInitialNameで設定したuserNameが上書きされない
           if (isSavingNameRef.current) {
             console.log('[onSnapshot] Skipping update during name registration (isSavingNameRef.current = true)');
             return;
           }
           
           if (docSnap.exists()) {
             const data = docSnap.data();
             console.log('[onSnapshot] Data exists, shift:', data.shift ? 'exists' : 'null', 'startOdo:', data.shift?.startOdo);
             
             // --- データセット処理 (中身は以前と同じ) ---
             const safeShift = sanitizeShift(data.shift);
             console.log('[onSnapshot] safeShift after sanitize:', safeShift ? 'exists' : 'null', 'startOdo:', safeShift?.startOdo);
             
             // 古い形式なら更新（ただし、無限ループを防ぐため、実際に値が変わった場合のみ更新）
             // JSON.stringifyでは順序の違いなどで誤検出される可能性があるため、
             // 重要なフィールドのみをチェック
             let needsUpdate = false;
             if (data.shift && safeShift) {
               // 重要なフィールドを個別にチェック
               if (data.shift.dailyGoal !== safeShift.dailyGoal ||
                   data.shift.plannedHours !== safeShift.plannedHours ||
                   data.shift.totalRestMinutes !== safeShift.totalRestMinutes ||
                   data.shift.startTime !== safeShift.startTime ||
                   data.shift.startOdo !== safeShift.startOdo ||
                   JSON.stringify(data.shift.records) !== JSON.stringify(safeShift.records)) {
                 needsUpdate = true;
               }
             } else if (data.shift !== safeShift) {
               // null/undefinedの違いをチェック
               needsUpdate = true;
             }
             
             if (needsUpdate) {
                console.log('[onSnapshot] Shift format changed, updating...');
                setDoc(doc(db, "users", targetUid), { shift: safeShift }, { merge: true });
                // 更新後、再度onSnapshotがトリガーされるため、ここでは状態を更新せずに終了
                // ただし、breakStateなどの他の更新は必要なので、returnしない
                // 代わりに、状態更新は次のonSnapshotで行われる
             }

             // シフトデータが変更された場合のみ更新（無駄な再レンダリングを防ぐ）
             // ODOの有無に関わらず、shiftオブジェクト全体を比較
             setShift(prevShift => {
               // 両方がnullの場合はそのまま
               if (!prevShift && !safeShift) {
                 console.log('[onSnapshot] Both shifts are null, keeping prev');
                 return prevShift;
               }
               // 片方だけがnullの場合は更新
               if (!prevShift || !safeShift) {
                 console.log('[onSnapshot] One shift is null, updating:', { prev: !!prevShift, safe: !!safeShift });
                 return safeShift;
               }
               // オブジェクトの内容を比較（startOdoを含む）
               const prevJson = JSON.stringify(prevShift);
               const safeJson = JSON.stringify(safeShift);
               if (prevJson !== safeJson) {
                 console.log('[onSnapshot] Shift changed, updating. prevOdo:', prevShift.startOdo, 'newOdo:', safeShift.startOdo);
                 return safeShift;
               } else {
                 console.log('[onSnapshot] Shift unchanged, keeping prev');
                 return prevShift;
               }
             });
             
             setHistory(data.history || []);
             setDayMetadata(data.dayMetadata || {});
             
             const bState = data.breakState || { isActive: false, startTime: null };
             // breakStateも変更があった場合のみ更新
             setBreakState(prevBreakState => {
               const prevJson = JSON.stringify(prevBreakState);
               const newJson = JSON.stringify(bState);
               if (prevJson !== newJson) {
                 console.log('[onSnapshot] BreakState changed:', prevBreakState, '->', bState);
                 return bState;
               }
               return prevBreakState;
             });

            const savedStats = data.stats || {};
            const shimebiDay = savedStats.shimebiDay !== undefined ? savedStats.shimebiDay : 20;
            const businessStartHour = savedStats.businessStartHour ?? 9;
            
            // ★修正: userNameが空の場合、既存のmonthlyStats.userNameを保持（登録中の状態を維持）
            setMonthlyStats(prev => {
              // ★重要: userNameの処理
              // 1. savedStats.userNameが存在する場合はそれを使う（保存された値）
              // 2. savedStats.userNameが空で、prev.userNameが存在する場合はprev.userNameを保持（登録処理中の値を保持）
              // 3. 両方とも空の場合は空文字列
              const finalUserName = savedStats.userName 
                ? savedStats.userName 
                : (prev.userName || '');
              
              const newStats = {
                  monthLabel: savedStats.monthLabel || prev.monthLabel || '',
                  totalSales: savedStats.totalSales || prev.totalSales || 0,
                  totalRides: savedStats.totalRides || prev.totalRides || 0,
                  monthlyGoal: savedStats.monthlyGoal || prev.monthlyGoal || 1000000, 
                  defaultDailyGoal: savedStats.defaultDailyGoal ?? prev.defaultDailyGoal ?? 50000,
                  shimebiDay: shimebiDay,
                  businessStartHour: businessStartHour,
                  dutyDays: savedStats.dutyDays || prev.dutyDays || [],
                  enabledPaymentMethods: savedStats.enabledPaymentMethods || prev.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER,
                  customPaymentLabels: savedStats.customPaymentLabels || prev.customPaymentLabels || {},
                  // ★重要: userNameは上記のロジックで決定
                  userName: finalUserName,
                  enabledRideTypes: savedStats.enabledRideTypes || prev.enabledRideTypes || ALL_RIDE_TYPES,
                  visibilityMode: savedStats.visibilityMode || prev.visibilityMode || 'PUBLIC',
                  allowedViewers: savedStats.allowedViewers || prev.allowedViewers || [],
                  followingUsers: savedStats.followingUsers || prev.followingUsers || [],
                  // 簡易モード用設定
                  // showModeSelectionRefがtrueの場合はinputModeを設定しない（モード選択画面を表示するため）
                  inputMode: showModeSelectionRef.current 
                    ? (savedStats.inputMode || prev.inputMode) // モード選択中は既存の値のみ使用（未設定の場合はundefined）
                    : (savedStats.inputMode || prev.inputMode || 'DETAILED'), // 通常時はデフォルトで'DETAILED'
                  plannedWorkDays: savedStats.plannedWorkDays ?? prev.plannedWorkDays ?? 0,
                  dailyGoalSimple: savedStats.dailyGoalSimple ?? prev.dailyGoalSimple ?? 0,
                  workingHours: savedStats.workingHours ?? prev.workingHours ?? 0
              };
              console.log('[onSnapshot] Updating monthlyStats, userName:', newStats.userName, 'from savedStats:', savedStats.userName, 'from prev:', prev.userName, 'final:', finalUserName);
              
              // 新規ログイン時（inputModeが未設定）のモード選択表示
              // ただし、名前入力後のモード選択は別途処理されるため、名前が設定されている場合はスキップ
              if (!savedStats.inputMode && !prev.inputMode && userProfile?.status === 'active' && savedStats.userName && prev.userName) {
                console.log('[onSnapshot] Existing user without mode detected, showing mode selection');
                setTimeout(() => {
                  setShowModeSelection(true);
                  showModeSelectionRef.current = true;
                }, 500);
              }
              
              return newStats;
            });
             
             // onSnapshotのコールバックではbroadcastStatusを呼ばない
             // （saveToDBや各操作で明示的に呼ばれるため、二重実行を防ぐ）
             // ただし、データ読み込み時のみ更新が必要な場合はコメントを外す
             // const actingUser = { ...user, uid: targetUid } as User;
             // broadcastStatus(actingUser, safeShift, data.history || [], newStats, bState.isActive ? 'break' : 'active');

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
  }, [user, targetUid]);

  // URLパラメータ?calをチェック
  useEffect(() => {
    const checkCalendarParam = () => {
      const params = new URLSearchParams(window.location.search);
      const hasCal = params.has('cal');
      console.log('[App] Checking calendar param:', { hasCal, search: window.location.search });
      setShowCalendar(hasCal);
    };
    
    checkCalendarParam();
    
    // URL変更を監視（ブラウザの戻る/進むボタン対応）
    const handlePopState = () => {
      checkCalendarParam();
    };
    window.addEventListener('popstate', handlePopState);
    
    // hashchangeイベントも監視（SPAでのルーティング対応）
    window.addEventListener('hashchange', checkCalendarParam);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', checkCalendarParam);
    };
  }, []);

  // showModeSelectionの変更をrefに反映
  useEffect(() => {
    showModeSelectionRef.current = showModeSelection;
  }, [showModeSelection]);

  // URLパラメータ?firstLoginをチェック（初回ログインフローを確認するため）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasFirstLogin = params.has('firstLogin');
    if (hasFirstLogin && user && monthlyStats.userName) {
      // 初回ログインフローを強制的に表示（モード選択画面を表示）
      // inputModeが設定されていても、?firstLoginがある場合は表示する
      console.log('[App] firstLogin param detected, forcing mode selection screen');
      setShowModeSelection(true);
      showModeSelectionRef.current = true;
    }
  }, [user, monthlyStats.userName]);

  /**
   * currentPeriodStats
   */
  const currentPeriodStats = useMemo(() => {
    const periodStats = calculatePeriodStats(monthlyStats, history, shift);
    return { 
      ...monthlyStats, 
      totalSales: periodStats.totalSales, 
      totalRides: periodStats.totalRides 
    };
  }, [history, shift, monthlyStats]);

  /**
   * removeUndefinedFields
   * Firebaseはundefinedをサポートしていないため、undefinedのフィールドを削除
   */
  const removeUndefinedFields = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedFields(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = removeUndefinedFields(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  };

  /**
   * saveToDB
   */
  const saveToDB = async (
    updates: any, 
    statusOverride?: 'active' | 'break' | 'riding'
  ) => {
    if (!user || !targetUid) {
      throw new Error('User or targetUid is not available');
    }
    
    // ★重要: ユーザーIDとターゲットUIDが一致しているか確認
    if (user.uid !== targetUid) {
      console.warn('[saveToDB] WARNING: user.uid !== targetUid', { userUid: user.uid, targetUid });
      // 代理モードの場合は許可（将来的な拡張のため）
      // ただし、セキュリティルールでは自分のドキュメントのみ書き込み可能なので、403エラーになる可能性がある
    }
    
    try {
        // usersコレクションを更新（broadcastStatusは呼び出し側で行う）
        const cleanedUpdates = removeUndefinedFields(updates);
        console.log('[saveToDB] Saving to users collection:', Object.keys(cleanedUpdates), 'for uid:', targetUid, 'user.uid:', user.uid);
        console.log('[saveToDB] Updates preview:', JSON.stringify(cleanedUpdates).substring(0, 200));
        
        // ★タイムアウトを設定（30秒でタイムアウト - ネットワークが遅い場合に対応）
        const startTime = Date.now();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            const elapsed = Date.now() - startTime;
            reject(new Error(`タイムアウト: Firestoreへの書き込みが30秒以内に完了しませんでした（経過時間: ${elapsed}ms）。ネットワーク接続を確認してください。`));
          }, 30000);
        });
        
        await Promise.race([
          setDoc(doc(db, "users", targetUid), cleanedUpdates, { merge: true }),
          timeoutPromise
        ]);
        
        const elapsed = Date.now() - startTime;
        console.log('[saveToDB] Successfully saved to users collection (took', elapsed, 'ms)');
    } catch (e: any) {
      console.error("Save to DB failed:", e);
      
      // タイムアウトエラーの場合
      if (e?.message?.includes('タイムアウト')) {
        console.error('[saveToDB] Timeout error. Possible causes:');
        console.error('  1. ネットワーク接続が遅い、または不安定');
        console.error('  2. Firestoreのパフォーマンス問題');
        console.error('  3. データサイズが大きすぎる');
        console.error('  4. Firestoreのクォータ制限に達している可能性');
        console.error('[saveToDB] Troubleshooting:');
        console.error('  - ネットワーク接続を確認');
        console.error('  - Firebase ConsoleでFirestoreの状態を確認');
        console.error('  - ブラウザのキャッシュをクリア');
      }
      
      // 403エラー（権限エラー）の場合は詳細をログ出力
      if (e?.code === 403 || e?.code === 'permission-denied') {
        console.error('[saveToDB] Permission denied. Details:', {
          userUid: user.uid,
          targetUid: targetUid,
          uidMatch: user.uid === targetUid,
          errorCode: e?.code,
          errorMessage: e?.message,
          errorStack: e?.stack
        });
        console.error('[saveToDB] This usually means:');
        console.error('  1. Firestore security rules are blocking the write');
        console.error('  2. user.uid does not match targetUid');
        console.error('  3. Security rules are not deployed correctly');
      }
      
      // ネットワークエラーの場合
      if (e?.code === 'unavailable' || e?.message?.includes('network') || e?.message?.includes('Network')) {
        console.error('[saveToDB] Network error. Check internet connection.');
      }
      
      // エラーを再スローして呼び出し元で処理できるようにする
      throw e;
    }
  };

  /**
   * ハンドラ群
   */
  const handleNavigateToHistory = useCallback((date: string | Date) => {
    setTargetHistoryDate(date);
    setActiveTab('history');
  }, []);

const handleStart = (goal: number, hours: number, startOdo?: number) => {
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
      totalRestMinutes: existingRest,
      startOdo: startOdo
    };

    setShift(newShift);
    setHistory(otherRecords);
    saveToDB({ shift: newShift }, 'active').catch((e) => {
      console.error("[handleStart] Failed to save shift:", e);
    }); 
    window.scrollTo(0, 0);
  };

  const finalizeShift = (endOdo?: number) => {
    if (shift && user) {
      const newHistory = [...history, ...shift.records].sort((a, b) => a.timestamp - b.timestamp);
      const startHour = monthlyStats.businessStartHour ?? 9;
      const bDate = getBusinessDate(shift.startTime, startHour);
      
      const newMeta = {
        ...dayMetadata,
        [bDate]: { 
          ...(dayMetadata[bDate] || { memo: '', attributedMonth: '' }), 
          totalRestMinutes: shift.totalRestMinutes,
          startOdo: shift.startOdo || null,
          endOdo: endOdo !== undefined ? endOdo : null 
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
    // モーダルを開いた時は'riding'状態に更新（実車表示）
    const actingUser = { ...user, uid: targetUid } as User;
    if (user && monthlyStats.userName && shift) {
      broadcastStatus(actingUser, shift, history, monthlyStats, 'riding').catch((e) => {
        console.error("[handleOpenRecordModal] Broadcast status (riding) failed:", e);
      });
    }
    saveToDB({}, 'riding').catch((e) => {
      console.error("[handleAddRecord] Failed to save:", e);
    });
  };

  const handleCloseRecordModal = () => {
    setRecordModalState({ open: false });
    // モーダルを閉じた時は'active'状態に戻す
    const actingUser = { ...user, uid: targetUid } as User;
    if (user && monthlyStats.userName && shift) {
      broadcastStatus(actingUser, shift, history, monthlyStats, 'active').catch((e) => {
        console.error("[handleCloseRecordModal] Broadcast status failed:", e);
      });
    }
    saveToDB({}, 'active').catch((e) => {
      console.error("[handleCloseRecordModal] Failed to save:", e);
    }); 
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
    isBadCustomer?: boolean,
    returnToll?: number,
    idOverride?: string,
    keepOpen?: boolean
  ) => {
    if (!user) return;
    const editId = recordModalState.initialData?.id || idOverride;
    const startHour = monthlyStats.businessStartHour ?? 9;
    
    const recordObj: SalesRecord = { 
      id: editId || Math.random().toString(36).substr(2, 9), 
      amount: amt, 
      toll, 
      returnToll: returnToll || 0,
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
      // 編集時: 元のレコードがshiftにあるかhistoryにあるかを確認
      const originalRecord = [...(shift?.records || []), ...history].find(r => r.id === editId);
      const originalBusinessDate = originalRecord ? getBusinessDate(originalRecord.timestamp, startHour) : null;
      const isInShift = shift?.records.some(r => r.id === editId);
      
      // 元のレコードを削除
      if (isInShift) {
        newShift = { ...shift!, records: shift!.records.filter(r => r.id !== editId) };
      } else {
        newHistory = history.filter(r => r.id !== editId);
      }
      
      // 新しい日付に応じて適切な場所に追加
      if (shouldBeInShift) {
        newShift = { ...shift!, records: [...(newShift?.records || []), recordObj].sort((a, b) => a.timestamp - b.timestamp) };
      } else {
        newHistory = [...newHistory, recordObj].sort((a, b) => a.timestamp - b.timestamp);
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
    
    // 乗車記録保存時は'riding'状態を維持（実車中）
    const actingUser = { ...user, uid: targetUid } as User;
    if (user && monthlyStats.userName) {
      // 'riding'状態で即座に更新
      broadcastStatus(actingUser, newShift, newHistory, monthlyStats, 'riding').catch((e) => {
        console.error("[handleSaveRecord] Broadcast status (riding) failed:", e);
      });
    }
    
    // usersコレクションとpublic_statusの両方を更新
    await saveToDB({ shift: newShift, history: newHistory }, 'riding').catch((e) => {
      console.error("[handleSaveRecord] Failed to save (riding):", e);
    }); 
    
    // 「この内容で完了」を押した場合（keepOpen=false）のみ、モーダルを閉じて'active'に戻す
    if (!keepOpen) {
      if (user && monthlyStats.userName) {
        // モーダルを閉じる前に'active'に戻す
        broadcastStatus(actingUser, newShift, newHistory, monthlyStats, 'active').catch((e) => {
          console.error("[handleSaveRecord] Broadcast status (active) failed:", e);
        });
        saveToDB({ history: newHistory }, 'active').catch((e) => {
          console.error("[handleSaveRecord] Failed to save (active):", e);
        });
      }
      setRecordModalState({ open: false });
    }
  }, [shift, history, recordModalState.initialData, monthlyStats, user, targetUid]);

  const handleDeleteRecord = useCallback(() => {
    if (!user) return;
    const editId = recordModalState.initialData?.id;
    if (!editId) return;
    
    const newShift = shift ? { ...shift, records: shift.records.filter(r => r.id !== editId) } : null;
    const newHistory = history.filter(r => r.id !== editId);
    
    setShift(newShift);
    setHistory(newHistory);
    
    // 即座にbroadcastStatusを呼んでリアルタイム更新を優先（public_statusにhistoryも保存される）
    const actingUser = { ...user, uid: targetUid } as User;
    if (user && monthlyStats.userName) {
      broadcastStatus(actingUser, newShift, newHistory, monthlyStats, 'active').catch((e) => {
        console.error("[handleDeleteRecord] Broadcast status failed:", e);
      });
    }
    
    // usersコレクションとpublic_statusの両方を更新
    saveToDB({ shift: newShift, history: newHistory }, 'active').catch((e) => {
      console.error("[handleDeleteRecord] Failed to save:", e);
    }); 
    setRecordModalState({ open: false });
  }, [recordModalState.initialData, shift, history, user, targetUid, monthlyStats]);

  const handleUpdateMonthlyStats = (newStats: Partial<MonthlyStats>) => {
    setMonthlyStats(prev => {
      let updatedDutyDays = newStats.dutyDays || prev.dutyDays;
      if (newStats.shimebiDay !== undefined && newStats.shimebiDay !== prev.shimebiDay) {
         updatedDutyDays = generateDefaultDutyDays(newStats.shimebiDay, newStats.businessStartHour ?? prev.businessStartHour);
      }
      const updated = { ...prev, ...newStats, dutyDays: updatedDutyDays };
      
      // モードが変更された場合、タブをリセット
      if (newStats.inputMode && newStats.inputMode !== prev.inputMode) {
        if (newStats.inputMode === 'SIMPLE') {
          setActiveTab('home'); // 簡易モードでは'home'が入力画面
        } else {
          setActiveTab('home'); // 詳細モードでも'home'に戻す
        }
      }
      
      saveToDB({ stats: updated }).catch((e) => {
        console.error("[handleUpdateMonthlyStats] Failed to save stats:", e);
      });
      return updated;
    });
  };

  const handleSaveInitialName = async () => {
    if (!tempUserName.trim()) {
      console.warn('[handleSaveInitialName] tempUserName is empty');
      return;
    }
    
    console.log('[DEBUG] handleSaveInitialName called');
    console.log('[DEBUG] tempUserName:', tempUserName);
    console.log('[DEBUG] user:', user?.uid);
    console.log('[DEBUG] targetUid:', targetUid);
    console.log('[DEBUG] monthlyStats:', monthlyStats);
    
    setIsSavingName(true);
    isSavingNameRef.current = true; // refも更新
    
      // ★タイムアウトを設定（60秒でタイムアウト - ネットワークが遅い場合に対応）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('タイムアウト: 登録処理が60秒以内に完了しませんでした。ネットワーク接続を確認してください。'));
        }, 60000);
      });
    
    try {
      // 名前保存時はinputModeを保存しない（モード選択画面を表示するため）
      const { inputMode, ...statsWithoutInputMode } = monthlyStats;
      const updatedStats = { ...statsWithoutInputMode, userName: tempUserName.trim() };
      console.log('[DEBUG] updatedStats:', updatedStats);
      console.log('[DEBUG] Calling saveToDB with:', { stats: updatedStats });
      
      // ★Promise.raceでタイムアウトとsaveToDBを競争させる
      await Promise.race([
        saveToDB({ stats: updatedStats }),
        timeoutPromise
      ]);
      
      // 成功した場合、ローカルステートも即座に更新（onSnapshotが更新されるまでの間、画面遷移を可能にする）
      const savedUserName = tempUserName.trim();
      console.log('[handleSaveInitialName] Setting userName to:', savedUserName);
      setMonthlyStats(prev => {
        // 名前保存時はinputModeを削除（モード選択画面を表示するため）
        const { inputMode, ...prevWithoutInputMode } = prev;
        const updated = { ...prevWithoutInputMode, userName: savedUserName };
        console.log('[handleSaveInitialName] Updating monthlyStats, prev.userName:', prev.userName, 'new userName:', savedUserName);
        return updated;
      });
      console.log('[handleSaveInitialName] Name saved successfully:', savedUserName);
      
      // 状態更新を確実にするため、少し待つ
      // Reactの状態更新は非同期なので、次のレンダリングサイクルで反映される
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 再度確認（デバッグ用）
      console.log('[handleSaveInitialName] After state update, checking if userName is set...');
      
      // ★成功後、モード選択画面を表示
      setIsSavingName(false);
      isSavingNameRef.current = false;
      setShowModeSelection(true);
      showModeSelectionRef.current = true;
    } catch (e: any) {
      console.error("[handleSaveInitialName] Failed to save stats:", e);
      console.error("[handleSaveInitialName] Error details:", {
        code: e?.code,
        message: e?.message,
        stack: e?.stack
      });
      
      // ★エラー発生時は即座にisSavingNameをfalseに戻す
      setIsSavingName(false);
      isSavingNameRef.current = false;
      
      // エラーの詳細を表示
      if (e?.code === 403 || e?.code === 'permission-denied') {
        alert('権限エラー: データベースへの書き込み権限がありません。\n\nFirebase ConsoleでFirestoreのセキュリティルールを確認してください。\n\nエラーコード: ' + e?.code + '\n\nユーザーID: ' + user?.uid + '\nターゲットUID: ' + targetUid);
      } else if (e?.code === 'unavailable') {
        alert('ネットワークエラー: Firebaseに接続できません。\n\nインターネット接続を確認してください。');
      } else if (e?.message?.includes('タイムアウト')) {
        alert('タイムアウトエラー: 登録処理が30秒以内に完了しませんでした。\n\nネットワーク接続を確認するか、しばらく待ってから再度お試しください。');
      } else {
        alert('名前の登録に失敗しました。\n\nエラー: ' + (e?.message || 'Unknown error') + '\n\n詳細はブラウザのコンソールを確認してください。');
      }
    }
  };

  const handleClearTargetDate = useCallback(() => {
    setTargetHistoryDate(null);
  }, []);

  const handleUpdateStartOdo = (newOdo: number) => {
    if (shift) {
      const s = { ...shift, startOdo: newOdo };
      setShift(s);
      saveToDB({ shift: s }).catch((e) => {
        console.error("[handleUpdateStartOdo] Failed to save shift:", e);
      });
    }
  };

  const isOnDuty = !!shift;

  // デバッグ: スプラッシュ画面表示条件をログ出力
  if (appInitLoading || isAuthChecking || isDataLoading) {
    console.log('[App] Showing splash screen:', { 
      appInitLoading, 
      isAuthChecking, 
      isDataLoading,
      user: user?.email || 'null',
      userProfile: userProfile ? { role: userProfile.role, status: userProfile.status } : 'null'
    });
  }

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
  // ★重要: isAuthCheckingがtrueの間は、認証状態の確認中なのでログイン画面を表示しない
  // これにより、リダイレクト後の認証状態更新を待つことができる
  // また、userが存在する場合は、userProfileの取得を待つため、ログイン画面を表示しない
  if (!user && !isAuthChecking) {
    console.log('[App] Showing login screen - user:', user?.email || 'null', 'isAuthChecking:', isAuthChecking, 'userProfile:', userProfile);
    
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
              type="button"
              onClick={async () => {
                try {
                  console.log('Login button clicked');
                  
                  // ★モバイル環境を検出
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
                  
                  // モバイル環境またはスタンドアロンモードの場合は、最初からリダイレクト方式を使用
                  if (isMobile || isStandalone) {
                    console.log('Mobile/Standalone detected, using redirect method');
                    // ★重要: 現在のURL（パラメータ含む）を保存（リダイレクト後に戻るため）
                    if (typeof window !== 'undefined') {
                      const currentUrl = window.location.href;
                      const hostname = window.location.hostname;
                      const port = window.location.port || '';
                      const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
                      
                      console.log('[Login] Saving redirect info (mobile):', { 
                        currentUrl, 
                        hostname, 
                        port, 
                        origin 
                      });
                      
                      // localStorageとsessionStorageの両方に保存（モバイルでsessionStorageが制限される場合があるため）
                      try {
                        // 現在のURL全体を保存（パラメータ含む）
                        localStorage.setItem('login_redirect_url', currentUrl);
                        localStorage.setItem('auth_redirect_origin', origin);
                        localStorage.setItem('auth_redirect_hostname', hostname);
                        if (port) {
                          localStorage.setItem('auth_redirect_port', port);
                        }
                        // ログイン試行の記録
                        localStorage.setItem('auth_login_attempt', new Date().toISOString());
                        console.log('[Login] Successfully saved redirect info to localStorage');
                      } catch (e) {
                        console.error('[Login] Failed to save redirect info to localStorage:', e);
                        alert('ローカルストレージへの保存に失敗しました。プライベートブラウジングモードを無効にしてください。');
                      }
                      // sessionStorageも試行（利用可能な場合のみ）
                      try {
                        sessionStorage.setItem('login_redirect_url', currentUrl);
                        sessionStorage.setItem('auth_redirect_origin', origin);
                        sessionStorage.setItem('auth_redirect_hostname', hostname);
                        if (port) {
                          sessionStorage.setItem('auth_redirect_port', port);
                        }
                        console.log('[Login] Successfully saved redirect info to sessionStorage');
                      } catch (e) {
                        console.warn('[Login] sessionStorage not available (this is normal on some mobile browsers):', e);
                      }
                    }
                    console.log('[Login] Calling signInWithRedirect...');
                    console.log('[Login] Current URL before redirect:', window.location.href);
                    console.log('[Login] Auth domain:', auth.config.authDomain);
                    console.log('[Login] Google provider:', googleProvider);
                    
                    // リダイレクト前に最終確認
                    const savedOrigin = localStorage.getItem('auth_redirect_origin');
                    console.log('[Login] Saved redirect origin:', savedOrigin);
                    
                    try {
                      // signInWithRedirectは非同期だが、リダイレクトが発生するとこのコードは実行されない
                      const redirectPromise = signInWithRedirect(auth, googleProvider);
                      console.log('[Login] signInWithRedirect called, waiting for redirect...');
                      
                      // リダイレクトが発生しない場合のタイムアウト（5秒）
                      const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                          reject(new Error('Redirect timeout: signInWithRedirect did not redirect within 5 seconds'));
                        }, 5000);
                      });
                      
                      await Promise.race([redirectPromise, timeoutPromise]);
                      
                      // ここに到達した場合はリダイレクトが発生しなかった
                      console.warn('[Login] ⚠️ signInWithRedirect completed without redirect');
                      alert('リダイレクトが発生しませんでした。ページをリロードして再度お試しください。');
                    } catch (redirectError: any) {
                      console.error('[Login] ❌ signInWithRedirect error:', redirectError);
                      console.error('[Login] Error code:', redirectError?.code);
                      console.error('[Login] Error message:', redirectError?.message);
                      console.error('[Login] Error stack:', redirectError?.stack);
                      
                      // エラーの種類に応じて適切なメッセージを表示
                      let errorMessage = 'ログインリダイレクトエラーが発生しました。\n\n';
                      if (redirectError?.code === 'auth/unauthorized-domain') {
                        errorMessage += 'エラー: 承認済みドメインが設定されていません。\nFirebase Consoleで承認済みドメインを確認してください。';
                      } else if (redirectError?.code === 'auth/operation-not-allowed') {
                        errorMessage += 'エラー: Google認証が有効になっていません。\nFirebase ConsoleでGoogle認証を有効にしてください。';
                      } else if (redirectError?.message?.includes('timeout')) {
                        errorMessage += 'エラー: リダイレクトがタイムアウトしました。\nページをリロードして再度お試しください。';
                      } else {
                        errorMessage += `エラーコード: ${redirectError?.code || 'unknown'}\nエラーメッセージ: ${redirectError?.message || 'Unknown error'}`;
                      }
                      
                      alert(errorMessage + '\n\n詳細はブラウザのコンソールを確認してください。');
                    }
                  }
                  
                  // デスクトップ環境ではポップアップ方式を試行
                  console.log('Desktop detected, trying popup method');
                  // 現在のホスト名、ポート番号を保存（リダイレクト後に戻るため、フォールバック用）
                  if (typeof window !== 'undefined') {
                    const hostname = window.location.hostname;
                    const port = window.location.port || '5173';
                    const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
                    
                    localStorage.setItem('local_dev_hostname', hostname);
                    localStorage.setItem('local_dev_port', port);
                    localStorage.setItem('local_dev_origin', origin);
                    try {
                      sessionStorage.setItem('local_dev_hostname', hostname);
                      sessionStorage.setItem('local_dev_port', port);
                      sessionStorage.setItem('local_dev_origin', origin);
                    } catch (e) {
                      console.warn('sessionStorage not available:', e);
                    }
                  }
                  
                  await signInWithPopup(auth, googleProvider);
                  console.log('Login successful');
                } catch (error: any) {
                  console.error('Login error:', error);
                  
                  // エラーコードに基づいて適切なメッセージを表示
                  if (error?.code === 'auth/popup-blocked') {
                    const useRedirect = confirm(
                      'ポップアップがブロックされています。\n\n' +
                      'リダイレクト方式でログインしますか？\n\n' +
                      '（リダイレクト方式では、Firebaseの認証ページに移動してから戻ってきます）'
                    );
                    
                    if (useRedirect) {
                      try {
                        // リダイレクト方式にフォールバック
                        if (typeof window !== 'undefined') {
                          const hostname = window.location.hostname;
                          const port = window.location.port || '';
                          const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
                          
                          console.log('[Login] Saving redirect info (fallback):', { hostname, port, origin });
                          
                          localStorage.setItem('auth_redirect_origin', origin);
                          localStorage.setItem('auth_redirect_hostname', hostname);
                          if (port) {
                            localStorage.setItem('auth_redirect_port', port);
                          }
                          try {
                            sessionStorage.setItem('auth_redirect_origin', origin);
                            sessionStorage.setItem('auth_redirect_hostname', hostname);
                            if (port) {
                              sessionStorage.setItem('auth_redirect_port', port);
                            }
                          } catch (e) {
                            console.warn('sessionStorage not available:', e);
                          }
                        }
                        await signInWithRedirect(auth, googleProvider);
                        // リダイレクト後はこのコードは実行されない
                        return;
                      } catch (redirectError) {
                        console.error('Redirect login error:', redirectError);
                        alert('リダイレクトログインにも失敗しました。ページをリロードして再度お試しください。');
                      }
                    }
                  } else if (error?.code === 'auth/popup-closed-by-user') {
                    console.log('User closed popup');
                    // ユーザーが閉じた場合は何もしない
                  } else if (error?.code === 'auth/cancelled-popup-request') {
                    console.log('Popup request cancelled');
                    // 複数のポップアップリクエストが同時に発生した場合
                  } else {
                    const errorMessage = error?.message || '不明なエラー';
                    alert(`ログインエラー: ${errorMessage}\n\nエラーコード: ${error?.code || 'unknown'}`);
                  }
                }
              }} 
              className="group relative w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 transition-all duration-300 overflow-hidden cursor-pointer z-10"
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
  // userProfileが取得され、statusが'active'でない場合はUnauthorizedViewを表示
  // isAuthCheckingがtrueの間は、userProfileの取得を待つ（スプラッシュ画面が表示される）
  // ★重要: userが存在し、isAuthCheckingがfalseの場合、userProfileの状態を確認する
  if (user && !isAuthChecking) {
    console.log('[App] Checking user authorization:', {
      user: user.email,
      userProfile: userProfile ? { role: userProfile.role, status: userProfile.status } : 'null',
      isAuthChecking,
      userUid: user.uid
    });
    
    // ★重要: userProfileがnullで、isAuthCheckingがfalseの場合（エラーなどで取得に失敗した場合）
    // この場合は、ログイン画面に戻すのではなく、UnauthorizedViewを表示する
    // （新規ユーザーの場合、userProfileは'pending'として作成されるはずなので、nullの場合はエラー）
    if (!userProfile) {
      console.warn('[App] User is logged in but userProfile is null. This might be an error. Showing UnauthorizedView.');
      console.warn('[App] Attempting to re-fetch userProfile...');
      // エラーとして扱い、UnauthorizedViewを表示（または、再度userProfileの取得を試みる）
      // とりあえず、UnauthorizedViewを表示して、ユーザーに状況を伝える
      // ただし、少し待ってから再度userProfileの取得を試みる
      setTimeout(async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const profile = {
              role: data.role || 'user',
              status: data.status || 'pending'
            };
            console.log('[App] UserProfile re-fetched successfully:', profile);
            setUserProfile(profile);
          } else {
            console.warn('[App] UserProfile still does not exist after re-fetch');
          }
        } catch (e) {
          console.error('[App] Error re-fetching userProfile:', e);
        }
      }, 1000);
      return <UnauthorizedView />;
    }
    
    // userProfileが存在し、statusが'active'でない場合
    if (userProfile.status !== 'active') {
      console.log('[App] User status is not active:', userProfile.status, '- showing UnauthorizedView');
      return <UnauthorizedView />;
    }
  }

  // ★モード選択画面 (名前登録後の初回ログイン時、または?firstLoginパラメータがある場合)
  // showModeSelectionがtrueの場合は表示（onSnapshotでinputModeがデフォルト設定される前に対応）
  if (user && monthlyStats.userName && showModeSelection) {
    const handleModeSelect = async (mode: InputMode) => {
      try {
        // 選択されたモードを保存
        const updatedStats = { ...monthlyStats, inputMode: mode };
        await saveToDB({ stats: updatedStats });
        setMonthlyStats(prev => ({ ...prev, inputMode: mode }));
        setShowModeSelection(false);
        showModeSelectionRef.current = false;
        
        // 簡易モードの場合は簡易ダッシュボードに遷移
        if (mode === 'SIMPLE') {
          setActiveTab('home');
        }
      } catch (error) {
        console.error('[handleModeSelect] Failed to save mode:', error);
        alert('モードの保存に失敗しました');
      }
    };

    return (
      <ModeSelectionModal 
        onSelect={handleModeSelect}
        isInitialLogin={true}
      />
    );
  }

  // ★名前登録ガード (承認済みの場合のみ表示)
  // 注意: isSavingNameがtrueの場合は登録処理中なので、ローディング画面を表示
  if (user && !monthlyStats.userName && !isSavingName) {
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
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">お名前を入力してください</label>
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

  // ★カレンダービュー（認証前でも表示可能）
  if (showCalendar) {
    return (
      <div className="w-full min-h-screen bg-[#0A0E14]">
        {user ? (
          <CalendarView
            history={[...history, ...(shift?.records || [])]}
            dayMetadata={dayMetadata}
            businessStartHour={monthlyStats.businessStartHour ?? 9}
            shimebiDay={monthlyStats.shimebiDay}
            monthlyStats={monthlyStats}
          />
        ) : (
          <div className="flex items-center justify-center min-h-screen text-white">
            <div className="text-center">
              <p className="text-lg font-bold mb-4">ログインが必要です</p>
              <p className="text-sm text-gray-400">カレンダーを表示するにはログインしてください</p>
            </div>
          </div>
        )}
      </div>
    );
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
          <div 
            onClick={() => {
              if (userProfile?.role === 'admin') {
                console.log('Logo clicked - opening CSV modal');
                setIsCsvModalOpen(true);
              }
            }}
            className={`flex items-center transform active:scale-95 transition-transform select-none ${userProfile?.role === 'admin' ? 'cursor-pointer' : 'cursor-default'}`}
          >
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
            {/* ★管理者ボタン（権限がある場合のみ表示） */}
            {userProfile?.role === 'admin' && (
              <button 
                type="button"
                onClick={() => {
                  console.log('Admin button clicked');
                  setIsAdminMode(true);
                }} 
                className="p-2 bg-purple-900/50 border border-purple-500/50 rounded-full text-purple-400 hover:text-white transition-all active:scale-90 cursor-pointer"
                title="管理者メニュー"
              >
                <Shield size={22} />
              </button>
            )}

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // イベントのバブリングを停止
                console.log('Settings button clicked');
                console.log('Current isSettingsOpen:', isSettingsOpen);
                setIsSettingsOpen(true);
                console.log('setIsSettingsOpen(true) called');
              }} 
              className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all active:scale-90 border border-gray-700 cursor-pointer z-50 relative"
            >
              <Settings size={22} />
            </button>
          </div>
        </div>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>
      </header>

      <main className="w-full overflow-x-hidden">
        {/* 簡易モード時の画面表示 */}
        {(monthlyStats.inputMode || 'DETAILED') === 'SIMPLE' ? (
          <>
            {activeTab === 'home' && !targetHistoryDate && (
              <SimpleDashboard 
                stats={monthlyStats}
                onUpdateStats={handleUpdateMonthlyStats}
                onNavigateToInput={() => setTargetHistoryDate(new Date())}
                history={history}
              />
            )}
            {(activeTab === 'home' && targetHistoryDate) && (
              <SimpleInputView 
                stats={monthlyStats}
                onUpdateStats={handleUpdateMonthlyStats}
                initialDate={targetHistoryDate}
                initialRecordId={targetHistoryRecordId}
                onClearInitialDate={() => {
                  setTargetHistoryDate(null);
                  setTargetHistoryRecordId(null);
                }}
                onBack={() => {
                  setTargetHistoryDate(null);
                  setTargetHistoryRecordId(null);
                }}
              />
            )}
            {activeTab === 'history' && (
              <SimpleHistoryView 
                stats={monthlyStats}
                onEditRecord={(record) => {
                  // 編集時は入力画面に移動し、該当日付を選択
                  const recordDate = new Date(record.timestamp);
                  setTargetHistoryDate(recordDate);
                  setTargetHistoryRecordId(record.id);
                  setActiveTab('home');
                }}
              />
            )}
            {activeTab === 'analysis' && (
              <SimpleRankingView stats={monthlyStats} />
            )}
          </>
        ) : (
          /* 通常のタブコンテンツ */
          <>
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
                    saveToDB({shift: s}).catch((e) => {
                      console.error("[onUpdateShiftGoal] Failed to save shift:", e);
                    }); 
                }
            }} 
            onAddRestMinutes={(m) => { 
                if(shift) { 
                    const s = {...shift, totalRestMinutes: (shift.totalRestMinutes||0)+m}; 
                    setShift(s); 
                    saveToDB({shift: s}).catch((e) => {
                      console.error("[onUpdateRestMinutes] Failed to save shift:", e);
                    }); 
                }
            }}
            onToggleBreak={() => { 
                console.log('[onToggleBreak] Called, current breakState:', breakState);
                console.log('[onToggleBreak] Current shift:', shift ? 'exists' : 'null', 'startOdo:', shift?.startOdo);
                const newState = breakState.isActive ? {isActive:false, startTime:null} : {isActive:true, startTime:Date.now()}; 
                const nextStatus: 'active' | 'break' = newState.isActive ? 'break' : 'active';
                console.log('[onToggleBreak] New breakState:', newState, 'nextStatus:', nextStatus);
                
                // 状態を先に更新
                setBreakState(newState);
                
                // 即座にbroadcastStatusを呼んでリアルタイム更新を最優先（新しい状態を明示的に使用）
                if (user && monthlyStats.userName) {
                  const actingUser = { ...user, uid: targetUid } as User;
                  console.log('[onToggleBreak] Broadcasting status immediately, status:', nextStatus, 'newState:', newState);
                  // 明示的に新しい状態を渡してbroadcastStatusを呼ぶ（breakStateの非同期更新を待たない）
                  broadcastStatus(actingUser, shift, history, monthlyStats, nextStatus).catch((e) => {
                    console.error("[onToggleBreak] Broadcast status failed:", e);
                  });
                }
                
                // saveToDBでusersコレクションを更新（broadcastStatusは既に呼ばれているので重複しない）
                console.log('[onToggleBreak] Calling saveToDB...');
                saveToDB({breakState: newState}).catch((e) => {
                  console.error("[onToggleBreak] Failed to save break state:", e);
                });
            }}
            setBreakState={(s) => { 
                console.log('[setBreakState] Setting breakState:', s);
                setBreakState(s);
                // broadcastStatusを即座に実行
                const nextStatus: 'active' | 'break' = s.isActive ? 'break' : 'active';
                if (user && monthlyStats.userName) {
                  const actingUser = { ...user, uid: targetUid } as User;
                  console.log('[setBreakState] Broadcasting status immediately, status:', nextStatus);
                  broadcastStatus(actingUser, shift, history, monthlyStats, nextStatus).catch((e) => {
                    console.error("[setBreakState] Broadcast status failed:", e);
                  });
                }
                // saveToDBでusersコレクションを更新
                saveToDB({breakState: s}).catch((e) => {
                  console.error("[setBreakState] Failed to save break state:", e);
                });
            }}
            onShiftEdit={() => setIsShiftEditOpen(true)}
            onUpdateStartOdo={handleUpdateStartOdo}
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
                saveToDB({ dayMetadata: m }).catch((e) => {
                  console.error("[onUpdateMetadata] Failed to save dayMetadata:", e);
                }); 
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

        {activeTab === 'analytics' && (
          <AnalyticsView 
            history={[...history, ...(shift?.records || [])]} 
            stats={monthlyStats}
          />
        )}

            {activeTab === 'guide' && (
              <MangaView />
            )}
            {/* ★追加: デバッグタブの内容 */}
          </>
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
            followingUsers={monthlyStats.followingUsers || []}
            shift={shift}
            history={history}
            monthlyStats={monthlyStats}
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
            onClose={() => {
              console.log('SettingsModal onClose called');
              setIsSettingsOpen(false);
            }} 
            onNavigateToDashboard={() => {
              if ((monthlyStats.inputMode || 'DETAILED') === 'SIMPLE') {
                setActiveTab('home');
                setTargetHistoryDate(null);
              }
            }}
            onImpersonate={(uid) => {
                setViewingUid(uid);
                setIsSettingsOpen(false);
            }}
            onImportRecords={async (records, importTargetUid, options, onProgress) => {
              if (!user) return { addedCount: 0, replaceCount: 0 };
              const uid = importTargetUid || targetUid;
              if (!uid) return { addedCount: 0, replaceCount: 0 };

              try {
                setIsDataLoading(true);
                onProgress?.(0, 100, 'データを読み込み中...');
                const userRef = doc(db, "users", uid);
                const pubRef = doc(db, "public_status", uid);
                
                onProgress?.(10, 100, '既存データを取得中...');
                const [userSnap, pubSnap] = await Promise.all([
                  getDoc(userRef),
                  getDoc(pubRef)
                ]);
                
                // ★修正: historyはpublic_statusから読み込む（usersには保存していないため）
                let currentHistory: SalesRecord[] = [];
                if (pubSnap.exists()) {
                  currentHistory = pubSnap.data().history || [];
                } else if (userSnap.exists()) {
                  // フォールバック: 古いデータがある場合は使用
                  currentHistory = userSnap.data().history || [];
                }

                // ★追加: インポート先ユーザーの設定を取得（決済方法判定に使用）
                const targetUserStats = userSnap.data()?.stats || {};
                const targetCustomLabels = targetUserStats.customPaymentLabels || {};
                const targetEnabledMethods = targetUserStats.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER;

                const userName = pubSnap.data()?.name || "あなた";
                let addedCount = 0;
                let replaceCount = 0;

                onProgress?.(20, 100, 'データを統合中...');

                // 重複チェックと上書きロジック（日時と金額で判定）
                const mergeMode = options?.mergeMode || 'skip';
                if (mergeMode === 'overwrite') {
                  records.forEach(record => {
                    const dupIndex = currentHistory.findIndex(
                      h => h.timestamp === record.timestamp && h.amount === record.amount
                    );
                    if (dupIndex !== -1) {
                      // 既存のIDを保持して上書き
                      const existingId = currentHistory[dupIndex].id;
                      currentHistory[dupIndex] = { ...record, id: existingId };
                      replaceCount++;
                    } else {
                      currentHistory.push(record);
                      addedCount++;
                    }
                  });
                } else {
                  // スキップモード（既存のロジック）
                  const existingIds = new Set(currentHistory.map(r => r.id));
                  const newRecords = records.filter(r => !existingIds.has(r.id));
                  currentHistory = [...currentHistory, ...newRecords];
                  addedCount = newRecords.length;
                }

                onProgress?.(50, 100, 'データを並び替え中...');
                const updatedHistory = currentHistory.sort((a, b) => a.timestamp - b.timestamp);

                onProgress?.(60, 100, '月別データを再構成中...');
                // 月別フォルダ（months）の再構成
                const stats = userSnap.data()?.stats || {};
                const shimebiDay = stats.shimebiDay ?? 20;
                const startHour = stats.businessStartHour ?? 9;

                const monthsMap: Record<string, any> = {};
                updatedHistory.forEach((record, index) => {
                  const period = getBillingPeriod(new Date(record.timestamp), shimebiDay, startHour);
                  const year = period.end.getFullYear();
                  const month = period.end.getMonth() + 1;
                  const sortKey = `${year}-${String(month).padStart(2, '0')}`;
                  
                  if (!monthsMap[sortKey]) {
                    monthsMap[sortKey] = {
                      label: `${year}年${month}月度`,
                      startStr: formatDate(period.start),
                      endStr: formatDate(period.end),
                      records: [],
                      sales: 0
                    };
                  }
                  monthsMap[sortKey].records.push(record);
                  monthsMap[sortKey].sales += record.amount;

                  // 進捗更新（月別データの再構成中）
                  if ((index + 1) % 100 === 0) {
                    const progress = 60 + Math.floor((index / updatedHistory.length) * 20);
                    onProgress?.(progress, 100, `月別データを再構成中... (${index + 1}/${updatedHistory.length})`);
                  }
                });

                onProgress?.(90, 100, 'データを保存中...');
                // historyはpublic_statusにのみ保存（usersドキュメントのサイズ制限回避）
                // usersコレクションには最小限のデータのみ保存
                await Promise.all([
                  setDoc(userRef, { records: updatedHistory, history: updatedHistory }, { merge: true }),
                  setDoc(pubRef, {
                    months: monthsMap,
                    history: updatedHistory,
                    lastUpdated: Date.now()
                  }, { merge: true })
                ]);

                // ★追加: broadcastStatusを呼び出してpublic_statusを正しく更新（topRecords、monthlyTotalなどを計算）
                const actingUser = { ...user, uid: uid } as User;
                const targetStats = userSnap.data()?.stats || monthlyStats;
                if (actingUser && targetStats.userName) {
                  onProgress?.(95, 100, '統計情報を更新中...');
                  await broadcastStatus(actingUser, null, updatedHistory, targetStats, 'offline').catch((e) => {
                    console.error("[onImportRecords] Broadcast status failed:", e);
                  });
                }

                onProgress?.(100, 100, '完了！');
                // アラートはCsvImportSectionで表示するため、ここでは削除
                return { addedCount, replaceCount };
              } catch (e) {
                console.error("Import failed", e);
                alert("インポートに失敗しました");
                return { addedCount: 0, replaceCount: 0 };
              } finally {
                setIsDataLoading(false);
              }
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
                    saveToDB({shift: s}).catch((e) => {
                      console.error("[onSave] Failed to save shift:", e);
                    }); 
                }
            }} 
          />
      )}

      {/* ★追加: CSVインポートモーダル */}
      {isCsvModalOpen && (
        <CsvImportModal 
          onClose={() => setIsCsvModalOpen(false)}
          isAdmin={userProfile?.role === 'admin'}
          currentUid={user?.uid || ''}
          onImport={async (records, importTargetUid) => {
            if (!user) return { addedCount: 0, replaceCount: 0 };
            const uid = importTargetUid || targetUid;
            if (!uid) return { addedCount: 0, replaceCount: 0 };

            try {
              setIsDataLoading(true);
              const userRef = doc(db, "users", uid);
              const pubRef = doc(db, "public_status", uid);
              
              const [userSnap, pubSnap] = await Promise.all([
                getDoc(userRef),
                getDoc(pubRef)
              ]);
              
              // ★修正: historyはpublic_statusから読み込む（usersには保存していないため）
              let currentHistory: SalesRecord[] = [];
              if (pubSnap.exists()) {
                currentHistory = pubSnap.data().history || [];
              } else if (userSnap.exists()) {
                // フォールバック: 古いデータがある場合は使用
                currentHistory = userSnap.data().history || [];
              }

              // 重複チェックと上書きロジック（日時と金額で判定）
              let addedCount = 0;
              let replaceCount = 0;
              
              records.forEach(record => {
                const dupIndex = currentHistory.findIndex(
                  h => h.timestamp === record.timestamp && h.amount === record.amount
                );
                if (dupIndex !== -1) {
                  // 既存のIDを保持して上書き
                  const existingId = currentHistory[dupIndex].id;
                  currentHistory[dupIndex] = { ...record, id: existingId };
                  replaceCount++;
                } else {
                  currentHistory.push(record);
                  addedCount++;
                }
              });

              // データを並び替え
              const updatedHistory = currentHistory.sort((a, b) => a.timestamp - b.timestamp);

              // 月別データを再構成
              const stats = userSnap.data()?.stats || monthlyStats;
              const shimebiDay = stats.shimebiDay ?? 20;
              const startHour = stats.businessStartHour ?? 9;

              const monthsMap: Record<string, any> = {};
              updatedHistory.forEach((record) => {
                const period = getBillingPeriod(new Date(record.timestamp), shimebiDay, startHour);
                const year = period.end.getFullYear();
                const month = period.end.getMonth() + 1;
                const sortKey = `${year}-${String(month).padStart(2, '0')}`;
                
                if (!monthsMap[sortKey]) {
                  monthsMap[sortKey] = {
                    label: `${year}年${month}月度`,
                    startStr: formatDate(period.start),
                    endStr: formatDate(period.end),
                    records: [],
                    sales: 0
                  };
                }
                monthsMap[sortKey].records.push(record);
                monthsMap[sortKey].sales += record.amount;
              });

              // historyはpublic_statusにのみ保存（usersドキュメントのサイズ制限回避）
              // ただし、App.tsxのonSnapshotがusersコレクションのhistoryフィールドを参照しているため、
              // 互換性のためにusersコレクションのhistoryフィールドにも保存する
              await Promise.all([
                setDoc(userRef, { 
                  records: updatedHistory,
                  history: updatedHistory  // ★追加: App.tsxのonSnapshotが参照するため
                }, { merge: true }),
                setDoc(pubRef, {
                  months: monthsMap,
                  history: updatedHistory,
                  lastUpdated: Date.now()
                }, { merge: true })
              ]);

              // ★追加: broadcastStatusを呼び出してpublic_statusを正しく更新（topRecords、monthlyTotalなどを計算）
              const actingUser = { ...user, uid: uid } as User;
              const targetStats = userSnap.data()?.stats || monthlyStats;
              if (actingUser && targetStats.userName) {
                await broadcastStatus(actingUser, null, updatedHistory, targetStats, 'offline').catch((e) => {
                  console.error("[CsvImportModal] Broadcast status failed:", e);
                });
              }
              
              setIsCsvModalOpen(false);
              return { addedCount, replaceCount };
            } catch (e) {
              console.error("Import failed", e);
              alert("インポートに失敗しました");
              return { addedCount: 0, replaceCount: 0 };
            } finally {
              setIsDataLoading(false);
            }
          }} 
        />
      )}
      
      {/* 日本語化ナビゲーション（カレンダー表示時は非表示） */}
      {!showCalendar && user && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0A0E14]/95 backdrop-blur-2xl border-t border-gray-800 flex justify-around pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-15px_45px_rgba(0,0,0,0.8)] pointer-events-auto">
          {(monthlyStats.inputMode || 'DETAILED') === 'SIMPLE' ? (
            // 簡易モード用のタブ（管理、履歴、ランキング）
            <>
              <button 
                onClick={() => {
                  console.log('Simple Dashboard clicked');
                  setActiveTab('home');
                  setTargetHistoryDate(null);
                  setTargetHistoryRecordId(null);
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'home' && !targetHistoryDate ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <ClipboardList className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">管理</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('Simple History clicked');
                  setActiveTab('history');
                  setTargetHistoryDate(null);
                  setTargetHistoryRecordId(null);
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('Simple Ranking clicked');
                  setActiveTab('analysis');
                  setTargetHistoryDate(null);
                  setTargetHistoryRecordId(null);
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <Trophy className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">ランキング</span>
              </button>
            </>
          ) : (
            // 詳細モード用のタブ（通常のタブ）
            <>
              <button 
                onClick={() => {
                  console.log('Home clicked');
                  setActiveTab('home');
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'home' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <Car className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">ホーム</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('History clicked');
                  setActiveTab('history');
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('Analysis clicked');
                  setActiveTab('analysis');
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <Trophy className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">ランキング</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('Analytics clicked');
                  setActiveTab('analytics');
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analytics' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <BarChart3 className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">解析</span>
              </button>
              
              <button 
                onClick={() => {
                  console.log('Guide clicked');
                  setActiveTab('guide');
                }} 
                type="button"
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'guide' ? 'text-amber-500' : 'text-gray-500'}`}
              >
                <BookOpen className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">ガイド</span>
              </button>
            </>
          )}
        </nav>
      )}

      {/* モード選択モーダル（新規ログイン時） */}
      {showModeSelection && (
        <ModeSelectionModal
          onSelect={async (mode: InputMode) => {
            setShowModeSelection(false);
            showModeSelectionRef.current = false;
            await handleUpdateMonthlyStats({ inputMode: mode });
          }}
        />
      )}
    </div>
  );
}
