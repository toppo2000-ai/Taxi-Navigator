// 設定モーダルコンポーネント - アプリ設定とユーザー管理
// 基本設定（目標・スケジュール）・表示設定（支払い方法・乗車区分）・管理者機能（ユーザー管理・CSVインポート）
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Settings, 
  User, 
  Globe, 
  Lock, 
  Users, 
  Search, 
  UserPlus, 
  UserCheck, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  Car, 
  LogOut,
  PlusCircle
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { 
  MonthlyStats, 
  PaymentMethod, 
  SalesRecord, 
  RideType, 
  DEFAULT_PAYMENT_ORDER, 
  ALL_RIDE_TYPES, 
  VisibilityMode 
} from '@/types';
import { 
  toCommaSeparated, 
  fromCommaSeparated, 
  getBusinessDate, 
  getBillingPeriod, 
  PAYMENT_LABELS, 
  formatDate, 
  RIDE_LABELS 
} from '@/utils';
import { ModalWrapper } from './ModalWrapper';
import { CsvImportSection } from '@/components/dashboard/CsvImportSection';

// モーダルプロパティ
// stats: 月間統計（設定値を含む）
// isAdmin: 管理者権限の有無
// onUpdateStats: 設定更新時のコールバック
// onImportRecords: CSVインポート時のコールバック
// onClose: モーダル閉じるコールバック
// onImpersonate: 管理者による代理操作時のコールバック
interface SettingsModalProps { 
  stats: MonthlyStats; 
  isAdmin: boolean;
  onUpdateStats: (newStats: Partial<MonthlyStats>) => void;
  onImportRecords?: (records: SalesRecord[], targetUid?: string) => void;
  onClose: () => void;
  onImpersonate?: (uid: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  stats, 
  isAdmin, 
  onUpdateStats, 
  onImportRecords, 
  onClose, 
  onImpersonate 
}) => {  const { logout } = useAuth();
  
  // タブ管理：'basic'（基本）→ 'display'（表示）→ 'admin'（管理者）
  const [activeTab, setActiveTab] = useState<'basic' | 'display' | 'admin'>('basic');
  
  // 基本設定のフォーム状態
  const [shimebi, setShimebi] = useState(stats.shimebiDay.toString());
  const [businessStartHour, setBusinessStartHour] = useState(stats.businessStartHour ?? 9);
  const [monthlyGoalStr, setMonthlyGoalStr] = useState(stats.monthlyGoal.toLocaleString());
  const [defaultDailyGoalStr, setDefaultDailyGoalStr] = useState(stats.defaultDailyGoal.toLocaleString());
  const [dutyDays, setDutyDays] = useState<string[]>(stats.dutyDays || []);
  const [viewDate, setViewDate] = useState(new Date());
  
  // 表示設定のフォーム状態
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>(stats.enabledPaymentMethods || DEFAULT_PAYMENT_ORDER);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(stats.customPaymentLabels || {});
  const [userName, setUserName] = useState(stats.userName || "");
  const [enabledRideTypes, setEnabledRideTypes] = useState<RideType[]>(stats.enabledRideTypes || ALL_RIDE_TYPES);

  // 稼働状況公開設定
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>(stats.visibilityMode || 'PUBLIC');
  const [allowedViewers, setAllowedViewers] = useState<string[]>(stats.allowedViewers || []);
  const [otherUsers, setOtherUsers] = useState<{uid: string, name: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // フォロー中のユーザーと管理者用ユーザーリスト
  const [followingUsers, setFollowingUsers] = useState<string[]>(stats.followingUsers || []);
  const [adminUserList, setAdminUserList] = useState<any[]>([]);

  useEffect(() => {
    // 他のユーザーリストを取得
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "public_status"));
        const users = querySnapshot.docs
          .map(doc => ({ uid: doc.id, name: doc.data().name || '名称未設定' }))
          .filter(u => u.uid !== stats.uid);
        setOtherUsers(users);
      } catch (e) {
        console.error("Failed to fetch users", e);
      }
    };
    fetchUsers();
  }, [stats.uid]);

  useEffect(() => {
    // 管理者タブ時に全ユーザーリストを取得
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

  // 請求期間内のカレンダー日付を計算
  const calendarDates = useMemo(() => {
    const sDay = parseInt(shimebi);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start, end } = getBillingPeriod(viewDate, effectiveShimebi, businessStartHour);
    const dates = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [viewDate, shimebi, businessStartHour]);

  // カレンダー表示月を計算
  const displayScheduleMonth = useMemo(() => {
    if (calendarDates.length === 0) return '';
    const mid = calendarDates[Math.floor(calendarDates.length / 2)];
    return `${mid.getFullYear()} / ${String(mid.getMonth() + 1).padStart(2, '0')}`;
  }, [calendarDates]);

  // カレンダー表示期間内の出勤日数
  const dutyCountInView = useMemo(() => {
    return calendarDates.filter(d => dutyDays.includes(formatDate(d))).length;
  }, [calendarDates, dutyDays]);

  // 出勤日をトグル
  const toggleDutyDay = (dateStr: string) => {
    setDutyDays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  // 支払い方法の有効/無効をトグル
  const togglePaymentMethod = (m: PaymentMethod) => {
    setEnabledMethods(prev => 
      prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
    );
  };

  // 乗車区分の有効/無効をトグル
  const toggleRideType = (r: RideType) => {
    setEnabledRideTypes(prev => 
      prev.includes(r) ? prev.filter(i => i !== r) : [...prev, r]
    );
  };

  // 支払い方法のカスタムラベルを変更
  const handleLabelChange = (method: string, value: string) => {
    setCustomLabels(prev => ({ ...prev, [method]: value }));
  };

  // 支払い方法の順序を変更
  const moveMethod = (index: number, direction: 'up' | 'down') => {
    const newMethods = [...enabledMethods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMethods.length) return;
    const temp = newMethods[index];
    newMethods[index] = newMethods[targetIndex];
    newMethods[targetIndex] = temp;
    setEnabledMethods(newMethods);
  };

  // 公開許可ユーザーをトグル
  const toggleAllowedUser = (uid: string) => {
    setAllowedViewers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // フォロー中のユーザーをトグル
  const toggleFollowingUser = (uid: string) => {
    setFollowingUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // ユーザー検索
  const filteredUsers = otherUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 設定を保存
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
      followingUsers: followingUsers
    });
    onClose();
  };

  // 今日の営業日
  const todayStr = getBusinessDate(Date.now(), businessStartHour);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        {/* ヘッダー */}
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
             <Settings className="w-6 h-6 text-gray-400" /> 設定
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
             <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl">
            <button onClick={() => setActiveTab('basic')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'basic' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>基本</button>
            <button onClick={() => setActiveTab('display')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'display' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>表示</button>
            {isAdmin && (
                <button onClick={() => setActiveTab('admin')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-purple-900/50 text-purple-300 shadow border border-purple-500/30' : 'text-gray-500'}`}>管理者</button>
            )}
        </div>

        <div className="overflow-y-auto max-h-[60vh] space-y-6 pr-1 custom-scrollbar">
            {/* === 基本タブ === */}
            {activeTab === 'basic' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    {/* ユーザー名 */}
                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-3">
                        <label className="text-sm font-bold text-gray-400 block uppercase tracking-widest flex items-center gap-2">
                            <User className="w-4 h-4"/> ユーザー名
                        </label>
                        <input 
                            type="text" 
                            value={userName} 
                            onChange={(e) => setUserName(e.target.value)} 
                            placeholder="未設定" 
                            className="bg-gray-800 text-white font-black w-full outline-none p-3 rounded-2xl border border-gray-700" 
                        />
                    </div>

                    {/* 目標売上の設定 */}
                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-5">
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block">目標売上の設定</label>
                        <div className="grid grid-cols-1 gap-5">
                            {/* 月間目標 */}
                            <div>
                                <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">月間目標</label>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-blue-400">¥</span>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={monthlyGoalStr} 
                                        onChange={(e) => setMonthlyGoalStr(toCommaSeparated(e.target.value))} 
                                        className="bg-gray-800 text-white text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border border-gray-700"
                                    />
                                </div>
                            </div>
                            {/* 日別デフォルト目標 */}
                            <div>
                                <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">日別デフォルト目標</label>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-amber-400">¥</span>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={defaultDailyGoalStr} 
                                        onChange={(e) => setDefaultDailyGoalStr(toCommaSeparated(e.target.value))} 
                                        className="bg-gray-800 text-white text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border border-gray-700"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 締め日・切替時間 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 relative">
                            <label className="text-lg font-bold text-gray-400 mb-2 block uppercase tracking-widest">締め日</label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={shimebi}
                                    onChange={(e) => setShimebi(e.target.value)}
                                    className="bg-gray-800 text-white text-2xl font-black w-full outline-none p-2 rounded-xl border border-gray-700 appearance-none cursor-pointer"
                                >
                                    <option value="0">末日</option>
                                    {Array.from({ length: 28 }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}日</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-12 pointer-events-none text-gray-500 w-6 h-6" />
                            </div>
                        </div>
                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 relative">
                            <label className="text-lg font-bold text-gray-400 mb-2 block uppercase tracking-widest text-nowrap">切替時間</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    value={businessStartHour} 
                                    onChange={(e) => setBusinessStartHour(parseInt(e.target.value))}
                                    className="bg-gray-800 text-white text-2xl font-black w-full outline-none p-2 rounded-xl border border-gray-700 appearance-none cursor-pointer"
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-12 pointer-events-none text-gray-500 w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* 出勤予定カレンダー */}
                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 shadow-inner">
                        <div className="flex flex-col mb-4">
                            <div className="flex justify-between items-center">
                                <label className="text-lg font-black text-gray-500 uppercase tracking-widest">出勤予定</label>
                            </div>
                            <div className="mt-2 text-right">
                                <span className="text-xs font-bold text-gray-400">
                                    {displayScheduleMonth} の出勤予定: <span className="text-white text-sm">{dutyCountInView}日</span>
                                </span>
                            </div>
                            <div className="mt-4 flex items-center justify-between bg-gray-950 rounded-2xl p-2 border border-gray-800">
                                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-3 text-gray-400 active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
                                <span className="text-xl font-black text-white">{displayScheduleMonth}</span>
                                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-3 text-gray-400 active:scale-90"><ChevronRight className="w-6 h-6" /></button>
                            </div>
                        </div>
                        
                        {/* カレンダーグリッド */}
                        <div className="grid grid-cols-7 gap-2">
                            {/* 曜日ヘッダー */}
                            {['日', '月', '火', '水', '木', '金', '土'].map(w => (
                                <div key={w} className="text-xl text-center font-black text-gray-500 mb-2">{w}</div>
                            ))}
                            {/* 空白セル（前の月の日付まで） */}
                            {Array.from({ length: calendarDates[0]?.getDay() || 0 }).map((_, i) => <div key={i} />)}
                            {/* 日付セル */}
                            {calendarDates.map(date => {
                                const dateStr = formatDate(date);
                                const isDuty = dutyDays.includes(dateStr);
                                const isToday = dateStr === todayStr;
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => toggleDutyDay(dateStr)}
                                        className={`relative aspect-square rounded-2xl flex items-center justify-center border transition-all ${
                                            isDuty ? 'bg-amber-500 border-amber-400 text-black' : 'bg-gray-800 border-gray-700 text-gray-400'
                                        } ${isToday ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-[#131C2B]' : ''} active:scale-95`}
                                    >
                                        <span className="text-base font-black">{date.getDate()}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* === 表示タブ === */}
            {activeTab === 'display' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                            <Lock className="w-5 h-5"/> 稼働状況の公開設定
                        </label>
                        <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-300 mb-2">
                            <p className="mb-1">※売上ランキングは設定に関わらず全員に公開されます。</p>
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

                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                            <Users className="w-5 h-5"/> 表示するユーザーの選択
                        </label>
                        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                                <Search size={16} className="text-gray-500" />
                                <input type="text" placeholder="ユーザーを検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                {filteredUsers.length > 0 ? filteredUsers.map(u => {
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

                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800">
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest mb-5 block">支払い項目の管理</label>
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

                    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800">
                        <label className="text-lg font-black text-gray-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <Car className="w-5 h-5"/> 売上画面の乗車区分
                        </label>
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
                </div>
            )}

            {/* === 管理者タブ === */}
            {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="bg-purple-900/20 p-4 rounded-2xl border border-purple-500/30">
                        <h4 className="text-sm font-black text-purple-300 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> ユーザー切り替え (代理操作)
                        </h4>
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

                    {onImportRecords && (
                        <CsvImportSection 
                            onImport={onImportRecords} 
                            isAdmin={isAdmin} 
                            users={otherUsers} 
                        />
                    )}
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

        <div className="pt-6 border-t border-gray-800">
           <button 
             onClick={() => {
               if (window.confirm('ログアウトしますか？')) {
                 logout();
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
