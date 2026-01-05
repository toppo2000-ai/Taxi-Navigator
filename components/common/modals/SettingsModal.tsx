import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Settings, 
  User, 
  Users, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  UserCheck, 
  UserPlus, 
  PlusCircle,
  Check, 
  ArrowUp, 
  ArrowDown, 
  Car, 
  LogOut, 
  Globe, 
  Lock, 
  CalendarDays,
  FileText,
  Info
} from 'lucide-react';
import { collection, getDocs, query, orderBy, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { MonthlyStats, PaymentMethod, SalesRecord, RideType, DEFAULT_PAYMENT_ORDER, ALL_RIDE_TYPES, VisibilityMode, InputMode } from '../../../types';
import { 
  toCommaSeparated, 
  fromCommaSeparated, 
  getBusinessDate, 
  getBillingPeriod, 
  PAYMENT_LABELS, 
  formatDate, 
  RIDE_LABELS 
} from '../../../utils';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../services/firebase'; 
import { CsvImportSection } from '../CsvImportSection';
import { ModalWrapper } from './ModalWrapper';

export const SettingsModal: React.FC<{ 
  stats: MonthlyStats; 
  isAdmin: boolean;
  onUpdateStats: (newStats: Partial<MonthlyStats>) => void;
  onImportRecords?: (
    records: SalesRecord[], 
    targetUid?: string, 
    options?: { mergeMode: 'overwrite' | 'skip' },
    onProgress?: (current: number, total: number, message: string) => void
  ) => Promise<{ addedCount: number, replaceCount: number }>;
  onClose: () => void;
  onImpersonate?: (uid: string) => void;
  onNavigateToDashboard?: () => void;
  history?: SalesRecord[];
}> = ({ stats, isAdmin, onUpdateStats, onImportRecords, onClose, onImpersonate, onNavigateToDashboard, history = [] }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'display' | 'admin'>('basic');
  
  const [shimebi, setShimebi] = useState(stats.shimebiDay.toString());
  const [businessStartHour, setBusinessStartHour] = useState(stats.businessStartHour ?? 9);
  const [monthlyGoalStr, setMonthlyGoalStr] = useState(stats.monthlyGoal.toLocaleString());
  const [defaultDailyGoalStr, setDefaultDailyGoalStr] = useState(stats.defaultDailyGoal.toLocaleString());
  const [dutyDays, setDutyDays] = useState<string[]>(stats.dutyDays || []);
  const [viewDate, setViewDate] = useState(new Date());
  
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>(stats.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(stats.customPaymentLabels || {});
  const [userName, setUserName] = useState(stats.userName || "");
  const [enabledRideTypes, setEnabledRideTypes] = useState<RideType[]>(stats.enabledRideTypes || ALL_RIDE_TYPES);

  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>(stats.visibilityMode || 'PUBLIC');
  const [allowedViewers, setAllowedViewers] = useState<string[]>(stats.allowedViewers || []);
  const [otherUsers, setOtherUsers] = useState<{uid: string, name: string, visibilityMode?: VisibilityMode, allowedViewers?: string[]}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [followingUsers, setFollowingUsers] = useState<string[]>(stats.followingUsers || []);

  // 簡易モード用の設定
  const [inputMode, setInputMode] = useState<InputMode>(stats.inputMode || 'DETAILED');
  const [plannedWorkDays, setPlannedWorkDays] = useState<string>((stats.plannedWorkDays || 0).toString());
  const [dailyGoalSimple, setDailyGoalSimple] = useState<string>((stats.dailyGoalSimple || 0).toLocaleString());
  const [workingHours, setWorkingHours] = useState<string>((stats.workingHours || 0).toString());
  
  // モード切り替え確認モーダルの表示状態
  const [showModeConfirmModal, setShowModeConfirmModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<InputMode | null>(null);
  const [showModeExplanation, setShowModeExplanation] = useState(false);

  const [adminUserList, setAdminUserList] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "public_status"));
        const users = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            return { 
              uid: doc.id, 
              name: data.name || '名称未設定',
              visibilityMode: data.visibilityMode as VisibilityMode,
              allowedViewers: data.allowedViewers as string[] || []
            };
          })
          .filter(u => u.uid !== (stats.uid || auth.currentUser?.uid));
        const currentUid = stats.uid || auth.currentUser?.uid;
        console.log('[SettingsModal] Fetched users:', users.map(u => ({ uid: u.uid, name: u.name, visibilityMode: u.visibilityMode, allowedViewers: u.allowedViewers })));
        console.log('[SettingsModal] Current user uid:', currentUid);
        setOtherUsers(users);
      } catch (e) {
        console.error("Failed to fetch users", e);
      }
    };
    fetchUsers();
    
    // public_statusの変更を監視して、名前登録時に選択肢に反映
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return { 
            uid: doc.id, 
            name: data.name || '名称未設定',
            visibilityMode: data.visibilityMode as VisibilityMode,
            allowedViewers: data.allowedViewers as string[] || []
          };
        })
        .filter(u => u.uid !== stats.uid);
      setOtherUsers(users);
    });
    
    return () => unsub();
  }, [stats.uid]);

  useEffect(() => {
      if (activeTab === 'admin' && isAdmin) {
          const fetchAdminUsers = async () => {
              try {
                  const q = query(collection(db, "public_status"), orderBy("lastUpdated", "desc"));
                  const snap = await getDocs(q);
                  setAdminUserList(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
              } catch (e) {
                  console.error("Admin fetch failed", e);
              }
          };
          fetchAdminUsers();
      }
  }, [activeTab, isAdmin]);

  const calendarDates = useMemo(() => {
    const sDay = parseInt(shimebi);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start: billingStart, end: billingEnd } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
    
    // 営業期間の開始日の月を表示
    const displayYear = billingStart.getFullYear();
    const displayMonth = billingStart.getMonth();
    
    // 営業期間の開始日（21日）を含む週の最初の日（日曜日）から表示
    const firstDay = new Date(displayYear, displayMonth, billingStart.getDate());
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    // 営業期間の終了日を含む週の最後の日（土曜日）まで表示
    const lastDay = new Date(displayYear, billingEnd.getMonth(), billingEnd.getDate());
    const endDate = new Date(lastDay);
    const endDayOfWeek = lastDay.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));
    
    // 5週分（35日）を生成（6段目は不要なので表示しない）
    const dates: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 35; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [viewDate, shimebi, businessStartHour]);

  const displayScheduleMonth = useMemo(() => {
    // viewDateは営業期間の終了日（締め日がある月）を表す（簡易モードと同じ）
    const sDay = parseInt(shimebi);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { end } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
    return `${end.getFullYear()} / ${String(end.getMonth() + 1).padStart(2, '0')}`;
  }, [viewDate, shimebi, businessStartHour]);

  // 売上データがある日を判定する関数
  // 簡易モードと詳細モードの両方のデータを考慮
  const hasSalesData = useMemo(() => {
    const salesDateMap: Record<string, boolean> = {};
    // 重複排除のため、日付ごとにグループ化
    const dateMap: Record<string, SalesRecord[]> = {};
    
    history.forEach(record => {
      const businessDateStr = getBusinessDate(record.timestamp, businessStartHour);
      if (!dateMap[businessDateStr]) {
        dateMap[businessDateStr] = [];
      }
      dateMap[businessDateStr].push(record);
    });
    
    // 各日付について、簡易モードがあれば簡易モードのみ、なければ詳細モードのみをカウント
    Object.keys(dateMap).forEach(dateStr => {
      const dayRecords = dateMap[dateStr];
      const hasSimpleMode = dayRecords.some(r => r.remarks?.includes('簡易モード'));
      
      if (hasSimpleMode) {
        // 簡易モードがあれば、簡易モードのレコードがある日としてマーク
        const simpleRecords = dayRecords.filter(r => r.remarks?.includes('簡易モード'));
        if (simpleRecords.length > 0) {
          salesDateMap[dateStr] = true;
        }
      } else {
        // 簡易モードがなければ、詳細モードのレコードがある日としてマーク
        const detailedRecords = dayRecords.filter(r => !r.remarks?.includes('簡易モード'));
        if (detailedRecords.length > 0) {
          salesDateMap[dateStr] = true;
        }
      }
    });
    
    return salesDateMap;
  }, [history, businessStartHour]);

  const dutyCountInView = useMemo(() => {
    const sDay = parseInt(shimebi);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start: billingStart, end: billingEnd } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
    const billingStartStr = formatDate(billingStart);
    const billingEndStr = formatDate(billingEnd);
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    
    // 営業期間内の日付を集計
    const selectedDaysSet = new Set<string>();
    
    calendarDates.forEach(d => {
      const dateWithHour = new Date(d);
      dateWithHour.setHours(businessStartHour, 0, 0, 0);
      const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
      const isInBillingPeriod = businessDateStr >= billingStartStr && businessDateStr <= billingEndStr;
      
      if (isInBillingPeriod) {
        const isPast = businessDateStr < todayBusinessDate;
        const hasSales = hasSalesData[businessDateStr] || false;
        const isDuty = dutyDays.includes(businessDateStr);
        
        // 選択されている日（dutyDaysに含まれている日）または過去の出勤日（売上データがある過去日）をカウント
        if (isDuty || (isPast && hasSales)) {
          selectedDaysSet.add(businessDateStr);
        }
      }
    });
    
    return selectedDaysSet.size;
  }, [calendarDates, dutyDays, viewDate, shimebi, businessStartHour, hasSalesData]);

  const toggleDutyDay = (dateStr: string) => {
    // 過去日は選択/解除できない（売上データの有無に関係なく）
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    const isPast = dateStr < todayBusinessDate;
    if (isPast) {
      return; // 過去日は何もしない（選択日数を変動させない）
    }
    
    setDutyDays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const togglePaymentMethod = (m: PaymentMethod) => {
    setEnabledMethods(prev => 
      prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
    );
  };

  const toggleRideType = (r: RideType) => {
    setEnabledRideTypes(prev => 
      prev.includes(r) ? prev.filter(i => i !== r) : [...prev, r]
    );
  };

  const handleLabelChange = (method: string, value: string) => {
    setCustomLabels(prev => ({ ...prev, [method]: value }));
  };

  const moveMethod = (index: number, direction: 'up' | 'down') => {
    const newMethods = [...enabledMethods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMethods.length) return;
    const temp = newMethods[index];
    newMethods[index] = newMethods[targetIndex];
    newMethods[targetIndex] = temp;
    setEnabledMethods(newMethods);
  };

  const toggleAllowedUser = (uid: string) => {
    setAllowedViewers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

const toggleFollowingUser = (uid: string) => {
    setFollowingUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleAutoSetDutyDays = () => {
    const sDay = parseInt(shimebi);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    // viewDateは営業期間の終了日（締め日がある月）を表す（簡易モードと同じ）
    const { start, end } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
    
    const newDutyDays: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateWithHour = new Date(curr);
        dateWithHour.setHours(businessStartHour, 0, 0, 0);
        const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
        newDutyDays.push(businessDateStr);
      }
      curr.setDate(curr.getDate() + 1);
    }
    setDutyDays(newDutyDays);
  };

  // 検索語でフィルタリング
  const usersBySearchTerm = otherUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // 現在のユーザーIDを取得（stats.uidが未設定の場合はauth.currentUser?.uidを使用）
  const currentUserId = stats.uid || auth.currentUser?.uid;
  
  // 公開設定を考慮したフィルタリング関数
  // 管理者の場合は全ユーザーを表示、それ以外は公開設定に応じてフィルタリング
  const filterByVisibility = (users: typeof otherUsers) => {
    if (!currentUserId) {
      console.warn('[SettingsModal] currentUserId is undefined, cannot filter by visibility');
      return users;
    }
    
    const filtered = users.filter(u => {
      // 管理者の場合は全て表示
      if (isAdmin) {
        console.log(`[SettingsModal] Admin user, showing ${u.uid} (${u.name})`);
        return true;
      }
      
      const userVisibilityMode = u.visibilityMode || 'PUBLIC';
      
      // 非公開（PRIVATE）の場合は表示しない
      if (userVisibilityMode === 'PRIVATE') {
        console.log(`[SettingsModal] User ${u.uid} (${u.name}) is PRIVATE, hiding`);
        return false;
      }
      
      // 全員に公開（PUBLIC）の場合は表示
      if (userVisibilityMode === 'PUBLIC') {
        console.log(`[SettingsModal] User ${u.uid} (${u.name}) is PUBLIC, showing`);
        return true;
      }
      
      // 限定公開（CUSTOM）の場合、現在のユーザーがallowedViewersに含まれている場合のみ表示
      if (userVisibilityMode === 'CUSTOM') {
        const userAllowedViewers = u.allowedViewers || [];
        const isAllowed = userAllowedViewers.includes(currentUserId);
        console.log(`[SettingsModal] User ${u.uid} (${u.name}) is CUSTOM, allowedViewers=${JSON.stringify(userAllowedViewers)}, currentUser=${currentUserId}, isAllowed=${isAllowed}`);
        return isAllowed;
      }
      
      // デフォルトは表示（安全のため）
      return true;
    });
    console.log(`[SettingsModal] Filtered users: ${filtered.length} out of ${users.length}, currentUser=${currentUserId}, isAdmin=${isAdmin}`);
    return filtered;
  };
  
  // 「限定公開設定」の選択欄用（検索語 + 限定公開フィルタリング）
  const filteredUsers = filterByVisibility(usersBySearchTerm);
  
  // 「表示するユーザーの選択欄」用（検索語 + 限定公開フィルタリング）
  const filteredUsersForFollowing = filterByVisibility(usersBySearchTerm);
 

  const handleModeConfirm = async () => {
    if (!pendingMode) return;
    
    const sDay = parseInt(shimebi);
    onUpdateStats({
      inputMode: pendingMode,
      shimebiDay: isNaN(sDay) ? 20 : sDay,
      businessStartHour: businessStartHour,
      monthlyGoal: fromCommaSeparated(monthlyGoalStr),
      defaultDailyGoal: fromCommaSeparated(defaultDailyGoalStr),
      dutyDays: dutyDays,
      enabledPaymentMethods: enabledMethods,
      customPaymentLabels: customLabels,
      enabledRideTypes: enabledRideTypes,
      visibilityMode: visibilityMode,
      allowedViewers: allowedViewers,
      followingUsers: followingUsers,
    });
    
    setInputMode(pendingMode);
    setShowModeConfirmModal(false);
    setPendingMode(null);
    
    // 簡易モードに切り替える場合、ダッシュボードに移動
    if (pendingMode === 'SIMPLE' && onNavigateToDashboard) {
      onClose();
      setTimeout(() => onNavigateToDashboard(), 100);
    }
  };

  const saveSettings = () => {
    const sDay = parseInt(shimebi);
    onUpdateStats({
      shimebiDay: isNaN(sDay) ? 20 : sDay,
      businessStartHour: businessStartHour,
      monthlyGoal: fromCommaSeparated(monthlyGoalStr),
      defaultDailyGoal: fromCommaSeparated(defaultDailyGoalStr),
      dutyDays: dutyDays,
      enabledPaymentMethods: enabledMethods,
      customPaymentLabels: customLabels,
      userName: userName,
      enabledRideTypes: enabledRideTypes,
      visibilityMode: visibilityMode,
      allowedViewers: allowedViewers,
      followingUsers: followingUsers,
      // 詳細モードの場合のみ入力モードを更新（簡易モードは名前入力時に設定）
      inputMode: inputMode === 'DETAILED' ? 'DETAILED' : stats.inputMode,
    });
    onClose();
  };

  const todayStr = getBusinessDate(Date.now(), businessStartHour);

  console.log('[SettingsModal] Rendering modal, activeTab:', activeTab);
  
  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6 bg-[#131C2B]">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
             <Settings className="w-6 h-6 text-gray-400" /> 設定
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl">
            <button onClick={() => setActiveTab('basic')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'basic' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>基本</button>
            <button onClick={() => setActiveTab('display')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'display' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>表示</button>
            {isAdmin && (
                <button onClick={() => setActiveTab('admin')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-purple-900/50 text-purple-300 shadow border border-purple-500/30' : 'text-gray-500'}`}>管理者</button>
            )}
        </div>

        <div className="overflow-y-auto max-h-[60vh] space-y-6 pr-1 custom-scrollbar">
            {/* 入力モード切り替え */}
            <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} space-y-3`}>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-400 block uppercase tracking-widest">入力モードを選択してください</label>
                  <button
                    onClick={() => setShowModeExplanation(true)}
                    className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                          if (inputMode !== 'DETAILED') {
                            setPendingMode('DETAILED');
                            setShowModeConfirmModal(true);
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                            inputMode === 'DETAILED'
                                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                : 'border-gray-600 bg-gray-800 text-gray-500 hover:border-gray-500'
                        }`}
                    >
                        <div className="text-xs font-black whitespace-nowrap leading-tight">詳細入力モード</div>
                    </button>
                    <button
                        onClick={() => {
                          if (inputMode !== 'SIMPLE') {
                            setPendingMode('SIMPLE');
                            setShowModeConfirmModal(true);
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                            inputMode === 'SIMPLE'
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-600 bg-gray-800 text-gray-500 hover:border-gray-500'
                        }`}
                    >
                        <div className="text-xs font-black whitespace-nowrap leading-tight">簡易入力モード</div>
                    </button>
                </div>
            </div>
            
            {activeTab === 'basic' && inputMode !== 'SIMPLE' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    {/* ユーザー名 */}
                    <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} space-y-3`}>
                        <label className="text-sm font-bold text-gray-400 block uppercase tracking-widest flex items-center gap-2">
                            <User className="w-4 h-4"/> ユーザー名
                        </label>
                        <input 
                            type="text" 
                            value={userName} 
                            onChange={(e) => setUserName(e.target.value)} 
                            placeholder="未設定" 
                            className="bg-white text-gray-900 font-black w-full outline-none p-3 rounded-2xl border-2 border-gray-700" 
                        />
                    </div>

                    {/* 目標売上の設定 */}
                    <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} space-y-5`}>
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block">目標売上の設定</label>
                        <div className="grid grid-cols-1 gap-5">
                            <div>
                                <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">月間目標</label>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-blue-400">¥</span>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={monthlyGoalStr} 
                                        onChange={(e) => setMonthlyGoalStr(toCommaSeparated(e.target.value))} 
                                        className="bg-white text-gray-900 text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border-2 border-gray-700"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">日別デフォルト目標</label>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-amber-400">¥</span>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={defaultDailyGoalStr} 
                                        onChange={(e) => setDefaultDailyGoalStr(toCommaSeparated(e.target.value))} 
                                        className="bg-white text-gray-900 text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border-2 border-gray-700"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 締め日・切替時間 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`bg-gray-800 p-4 rounded-2xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} relative`}>
                            <label className="text-lg font-bold text-gray-400 mb-2 block uppercase tracking-widest">締め日</label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={shimebi}
                                    onChange={(e) => setShimebi(e.target.value)}
                                    className="bg-white text-gray-900 text-2xl font-black w-full outline-none p-2 rounded-xl border-2 border-gray-700 appearance-none cursor-pointer"
                                >
                                    <option value="0">末日</option>
                                    {Array.from({ length: 28 }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}日</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-12 pointer-events-none text-gray-500 w-6 h-6" />
                            </div>
                        </div>
                        <div className={`bg-gray-800 p-4 rounded-2xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} relative`}>
                            <label className="text-lg font-bold text-gray-400 mb-2 block uppercase tracking-widest text-nowrap">切替時間</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    value={businessStartHour} 
                                    onChange={(e) => setBusinessStartHour(parseInt(e.target.value))}
                                    className="bg-white text-gray-900 text-2xl font-black w-full outline-none p-2 rounded-xl border-2 border-gray-700 appearance-none cursor-pointer"
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-12 pointer-events-none text-gray-500 w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* 出勤予定日を選択してください */}
                    <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} shadow-inner`}>
                        <div className="flex flex-col mb-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    <CalendarDays className="w-6 h-6 text-yellow-500" /> 出勤予定日を選択してください
                                </h3>
                            </div>
                            {/* 選択した日数を簡易モードと同じ形式で表示 */}
                            <div className="mt-4 bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
                                <div className="text-sm text-gray-400 mb-1">選択した日数</div>
                                <div className="text-2xl font-black text-white">{dutyCountInView} 日</div>
                            </div>
                            <div className="mt-4 flex items-center justify-between bg-gray-950 rounded-2xl p-2 border-2 border-gray-700">
                                <button 
                                  onClick={() => {
                                    // 前の営業期間の開始日を計算
                                    const sDay = parseInt(shimebi);
                                    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
                                    const { start: currentStart } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
                                    // 前月の同じ日付に移動してから営業期間を計算
                                    const prevMonth = new Date(currentStart);
                                    prevMonth.setMonth(prevMonth.getMonth() - 1);
                                    const { start: prevStart } = getBillingPeriod(prevMonth, effectiveShimebi, businessStartHour);
                                    setViewDate(prevStart);
                                  }} 
                                  className="p-3 text-gray-400 active:scale-90"
                                >
                                  <ChevronLeft className="w-6 h-6" />
                                </button>
                                <span className="text-xl font-black text-white">{displayScheduleMonth}</span>
                                <button 
                                  onClick={() => {
                                    // 次の営業期間の開始日を計算
                                    const sDay = parseInt(shimebi);
                                    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
                                    const { start: currentStart } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
                                    // 次月の同じ日付に移動してから営業期間を計算
                                    const nextMonth = new Date(currentStart);
                                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                                    const { start: nextStart } = getBillingPeriod(nextMonth, effectiveShimebi, businessStartHour);
                                    setViewDate(nextStart);
                                  }} 
                                  className="p-3 text-gray-400 active:scale-90"
                                >
                                  <ChevronRight className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-2 mb-2">
                            {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                                <div key={day} className="text-center text-sm font-bold text-gray-400">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDates.map(date => {
                                // カレンダーの日付を営業開始時刻に設定してから営業日を計算
                                // これにより、時刻00:00:00でも正しい営業日が取得できる
                                const dateWithBusinessHour = new Date(date);
                                dateWithBusinessHour.setHours(businessStartHour, 0, 0, 0);
                                const businessDateStr = getBusinessDate(dateWithBusinessHour.getTime(), businessStartHour);
                                
                                const dateStr = formatDate(date);
                                const isDuty = dutyDays.includes(businessDateStr);
                                const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
                                const isToday = businessDateStr === todayBusinessDate;
                                const isPast = businessDateStr < todayBusinessDate;
                                const hasSales = hasSalesData[businessDateStr] || false;
                                
                                // 売上データがある過去日は黄色、解除不可
                                // 売上データがない過去日は選択解除可能（非選択状態）
                                // 未来日は通常通り選択可能
                                const isLocked = isPast && hasSales; // 売上データがある過去日はロック
                                const isSelectable = !isPast || !hasSales; // 過去日でも売上データがなければ選択可能
                                
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => toggleDutyDay(businessDateStr)}
                                        disabled={isLocked}
                                        className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                                            isPast && hasSales
                                                ? 'bg-yellow-500 text-gray-900 font-black cursor-not-allowed' // 売上データがある過去日は黄色（選択状態に関係なく）
                                                : isPast && !hasSales
                                                ? 'bg-gray-800/50 text-gray-500' // 売上データがない過去日は非選択状態（グレー、isDutyに関係なく）
                                                : isDuty
                                                ? 'bg-orange-500 text-gray-900 font-black' // 未来日の選択日はオレンジ
                                                : 'bg-gray-800 text-white font-bold hover:bg-gray-700'
                                        } ${isToday ? 'ring-2 ring-orange-500' : ''} ${isSelectable ? 'active:scale-95' : ''}`}
                                    >
                                        <span className="text-base">{date.getDate()}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            onClick={handleAutoSetDutyDays}
                            className="w-full mt-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <CalendarDays className="w-4 h-4" />
                            平日のみ自動選択 (約20日)
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'display' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    {/* 稼働状況の公開設定 */}
                    <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} space-y-4`}>
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                            <Lock className="w-5 h-5"/> 稼働状況の公開設定
                        </label>
                        <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl text-[15px] text-blue-300 mb-2">
                            <p>※稼働状況（現在地や現在のステータス）の表示範囲を選択してください。</p>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setVisibilityMode('PUBLIC')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${visibilityMode === 'PUBLIC' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700'}`}>
                                <Globe size={24} />
                                <div className="text-center"><p className="text-xs font-bold">全員に公開</p><p className="text-[9px] opacity-70">制限なし</p></div>
                            </button>
                            <button onClick={() => setVisibilityMode('CUSTOM')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${visibilityMode === 'CUSTOM' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700'}`}>
                                <Users size={24} />
                                <div className="text-center"><p className="text-xs font-bold">限定公開</p><p className="text-[9px] opacity-70">指定した人のみ</p></div>
                            </button>
                            <button onClick={() => setVisibilityMode('PRIVATE')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${visibilityMode === 'PRIVATE' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700'}`}>
                                <Lock size={24} />
                                <div className="text-center"><p className="text-xs font-bold">非公開</p><p className="text-[9px] opacity-70">誰にも見せない</p></div>
                            </button>
                        </div>

                        {visibilityMode === 'CUSTOM' && (
                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                                    <Search size={16} className="text-gray-500" />
                                    <input type="text" placeholder="ユーザーを検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                    {filteredUsers.length > 0 ? filteredUsers.map(u => {
                                        const isAllowed = allowedViewers.includes(u.uid);
                                        return (
                                            <div key={u.uid} onClick={() => toggleAllowedUser(u.uid)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${isAllowed ? 'bg-amber-500/10 border-amber-500/30' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-full ${isAllowed ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                        {isAllowed ? <UserCheck size={14} /> : <UserPlus size={14} />}
                                                    </div>
                                                    <span className={`text-sm font-bold ${isAllowed ? 'text-white' : 'text-gray-500'}`}>{u.name}</span>
                                                </div>
                                                {isAllowed && <Check size={16} className="text-amber-500" />}
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-center text-[10px] text-gray-600 py-4">ユーザーが見つかりません</p>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500 text-right">現在 {allowedViewers.length} 名にのみ公開中</p>
                            </div>
                        )}
                    </div>

                    <div className={`bg-gray-800 p-5 rounded-3xl border-2 ${inputMode === 'DETAILED' ? 'border-blue-500' : 'border-gray-700'} space-y-4`}>
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                            <Users className="w-5 h-5"/> 表示するユーザーの選択
                        </label>
                        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-[15px] text-gray-400 mb-2">
                            <p>※あなたが稼働状況を表示したい（フォローする）ユーザーを選択してください。</p>
                            <p>※相手が公開を許可している場合のみ表示されます。</p>
                        </div>

                        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                                <Search size={16} className="text-gray-500" />
                                <input type="text" placeholder="ユーザーを検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                {filteredUsersForFollowing.length > 0 ? filteredUsersForFollowing.map(u => {
                                    const isFollowing = followingUsers.includes(u.uid);
                                    return (
                                        <div key={u.uid} onClick={() => toggleFollowingUser(u.uid)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${isFollowing ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-full ${isFollowing ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                                    {isFollowing ? <Check size={14} /> : <PlusCircle size={14} />}
                                                </div>
                                                <span className={`text-sm font-bold ${isFollowing ? 'text-white' : 'text-gray-500'}`}>{u.name}</span>
                                            </div>
                                            {isFollowing && <span className="text-[10px] font-bold text-blue-400">表示中</span>}
                                        </div>
                                    );
                                }) : (
                                    <p className="text-center text-[10px] text-gray-600 py-4">ユーザーが見つかりません</p>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 text-right">現在 {followingUsers.length} 名をフォロー中</p>
                        </div>
                    </div>

                    {inputMode === 'DETAILED' && (
                        <div className={`bg-gray-800 p-5 rounded-3xl border-2 border-blue-500`}>
                            <label className="text-lg font-black text-gray-500 uppercase tracking-widest mb-2 block">支払い項目の管理</label>
                            <p className="text-sm text-gray-400 mb-5">自身の環境に合わせて、ご自由に書き換えてお使い下さい。</p>
                        <div className="space-y-3 mb-5">
                            {enabledMethods.map((m, idx) => (
                            <div key={m} className="flex flex-col gap-2 bg-[#1A2536] border border-gray-700 p-3 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="text"
                                        value={customLabels[m] !== undefined ? customLabels[m] : ""} 
                                        placeholder={PAYMENT_LABELS[m]}
                                        onChange={(e) => handleLabelChange(m, e.target.value)}
                                        className="w-1/2 bg-gray-900 text-white text-lg font-black px-3 py-2 rounded-xl border border-gray-700 outline-none focus:border-blue-500"
                                    />
                                    <div className="flex-1 flex justify-end gap-2">
                                        <button onClick={() => moveMethod(idx, 'up')} disabled={idx === 0} className="p-2 bg-gray-800 rounded-xl text-gray-400 disabled:opacity-20 active:scale-90"><ArrowUp className="w-5 h-5" /></button>
                                        <button onClick={() => moveMethod(idx, 'down')} disabled={idx === enabledMethods.length - 1} className="p-2 bg-gray-800 rounded-xl text-gray-400 disabled:opacity-20 active:scale-90"><ArrowDown className="w-5 h-5" /></button>
                                        <button onClick={() => togglePaymentMethod(m)} className="p-2 bg-red-500/20 text-red-500 rounded-xl active:scale-90"><X className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>
                        
                        <div className="border-t border-gray-800 pt-4">
                            <p className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-widest">非表示の項目</p>
                            <div className="grid grid-cols-2 gap-3">
                            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).filter(m => !enabledMethods.includes(m)).map(m => (
                                <button
                                    key={m}
                                    onClick={() => togglePaymentMethod(m)}
                                    className="p-3 bg-gray-800/50 border border-gray-700 rounded-2xl text-gray-500 text-base font-bold active:scale-95 text-left flex items-center justify-between"
                                >
                                    <span className="truncate mr-1">{customLabels[m] || PAYMENT_LABELS[m]}</span>
                                    <Check className="w-5 h-5 opacity-10 flex-shrink-0" />
                                </button>
                            ))}
                            </div>
                        </div>
                        </div>
                    )}

                    {inputMode === 'DETAILED' && (
                        <div className={`bg-gray-800 p-5 rounded-3xl border-2 border-blue-500`}>
                            <label className="text-lg font-black text-gray-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                <Car className="w-5 h-5"/> 売上画面の乗車区分
                            </label>
                            <p className="text-sm text-gray-400 mb-3">表示したい区分を選択してください</p>
                            <div className="grid grid-cols-3 gap-2">
                            {ALL_RIDE_TYPES.map(r => (
                                <button 
                                    key={r} 
                                    onClick={() => toggleRideType(r)} 
                                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                                        enabledRideTypes.includes(r) 
                                        ? 'bg-amber-500 text-black border-amber-400' 
                                        : 'bg-gray-800 text-gray-500 border-gray-700'
                                    }`}
                                >
                                    {RIDE_LABELS[r]}
                                </button>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="bg-purple-900/20 p-4 rounded-2xl border border-purple-500/30">
                        <h4 className="text-sm font-black text-purple-300 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> ユーザー切り替え (代理操作)
                        </h4>
                        <p className="text-[10px] text-gray-400 mb-4">
                            選択したユーザーとしてログインしているかのように画面を切り替えます。<br/>
                            <span className="text-red-400 font-bold">※データの閲覧・編集が可能です。取り扱いに注意してください。</span>
                        </p>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {adminUserList.map(u => (
                                <button 
                                    key={u.uid}
                                    onClick={() => onImpersonate && onImpersonate(u.uid)}
                                    className="w-full bg-gray-900 hover:bg-gray-800 p-3 rounded-xl flex justify-between items-center border border-gray-700 active:scale-95 transition-all"
                                >
                                    <div className="text-left">
                                        <span className="block text-sm font-bold text-white">{u.name || '名称未設定'}</span>
                                        <span className="text-[10px] text-gray-500">{u.uid}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400">
                                            {u.lastUpdated ? new Date(u.lastUpdated).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && onImportRecords && (
                <div className="pt-4 border-t border-gray-800 animate-in fade-in">
                    <CsvImportSection 
                        onImport={onImportRecords} 
                        isAdmin={isAdmin} 
                        users={otherUsers}
                        customPaymentLabels={stats.customPaymentLabels}
                        enabledPaymentMethods={stats.enabledPaymentMethods}
                    />
                </div>
            )}
        </div>

        {activeTab !== 'admin' && (
            <button 
              onClick={saveSettings}
              className="w-full bg-amber-500 py-4 rounded-2xl font-black text-2xl text-black shadow-lg active:scale-95 transition-transform mt-5"
            >
              保存
            </button>
        )}
        
        {activeTab === 'basic' && inputMode === 'SIMPLE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200 mt-4">
                <div className="bg-orange-900/20 p-5 rounded-3xl border border-orange-500/30 space-y-3">
                    <div className="text-center text-orange-300 font-black text-base">
                        簡易入力モードが有効です
                    </div>
                    <div className="text-xs text-orange-200 text-center">
                        設定はダッシュボードから行えます
                    </div>
                </div>
            </div>
        )}

        {/* モード切り替え確認モーダル */}
        {showModeConfirmModal && pendingMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white">
                  {pendingMode === 'DETAILED' ? '詳細入力モード' : '簡易入力モード'}に切り替えますか？
                </h3>
                <button 
                  onClick={() => {
                    setShowModeConfirmModal(false);
                    setPendingMode(null);
                  }} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModeConfirmModal(false);
                    setPendingMode(null);
                  }}
                  className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleModeConfirm}
                  className="flex-1 py-3 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 active:scale-95 transition-all"
                >
                  開始
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 入力モード説明モーダル */}
        {showModeExplanation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Info className="w-6 h-6 text-blue-400" /> 入力モードについて
                </h3>
                <button 
                  onClick={() => setShowModeExplanation(false)} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* 詳細入力モード */}
                <div className="bg-gray-800 p-5 rounded-2xl border-2 border-blue-500">
                  <h4 className="text-lg font-black text-blue-400 mb-3">詳細入力モード</h4>
                  <p className="text-sm text-white leading-relaxed">
                    1乗車ごとに詳細を記録するモードです。
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2">
                    売上分析や乗降地の傾向など、本アプリの全ての機能をご利用いただけます。
                  </p>
                </div>
                
                {/* 簡易入力モード */}
                <div className="bg-gray-800 p-5 rounded-2xl border-2 border-orange-500">
                  <h4 className="text-lg font-black text-orange-400 mb-3">簡易入力モード</h4>
                  <p className="text-sm text-white leading-relaxed">
                    1日の終わりに結果だけをまとめて入力するモードです。
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2">
                    入力は手軽ですが、乗降地データの分析など一部の機能が制限されます。
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowModeExplanation(false)}
                className="w-full py-4 bg-blue-500 text-white font-black rounded-xl hover:bg-blue-600 active:scale-95 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-gray-800">
           <button 
             onClick={() => {
               if (window.confirm('ログアウトしますか？')) {
                 signOut(auth);
               }
             }} 
             className="w-full bg-red-900/20 text-red-500 font-bold py-3 rounded-xl border border-red-900/50 hover:bg-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
           >
             <LogOut className="w-4 h-4" /> ログアウト
           </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
