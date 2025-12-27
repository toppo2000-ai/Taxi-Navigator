import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  MapPinned, 
  Loader2, 
  Edit2, 
  Trash2, 
  CheckCircle2,
  Users,
  MessageSquare,
  Info,
  Clock,
  ChevronDown,
  Skull,
  CalendarDays,
  User,
  Car,
  Settings,
  CreditCard,
  DollarSign,
  LogOut,
  PlusCircle,
  Globe,      
  Lock,       
  Search,     
  UserPlus,   
  UserCheck,
  FileUp,
  Map as MapIcon // 追加
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore'; 
import { MonthlyStats, PaymentMethod, SalesRecord, RideType, Shift, DEFAULT_PAYMENT_ORDER, ALL_RIDE_TYPES, VisibilityMode } from '../types';
import { 
  toCommaSeparated, 
  fromCommaSeparated, 
  getBusinessDate, 
  formatBusinessTime, 
  getBillingPeriod, 
  PAYMENT_LABELS, 
  formatDate, 
  formatJapaneseAddress, 
  RIDE_LABELS, 
  formatCurrency, 
  getGoogleMapsUrl 
} from '../utils';
import { ReportSummaryView } from './HistoryView';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase'; 
import { CsvImportSection } from './CsvImportSection';
import { findTaxiStand, TaxiStandDef } from '../taxiStands'; // 追加

// --- Shared Wrapper ---

export const ModalWrapper: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="absolute inset-0" onClick={onClose} />
    <div className="relative w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-5 shadow-2xl border-t border-gray-700 flex flex-col max-h-[90vh]">
      <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6 opacity-50 flex-shrink-0" />
      <div className="overflow-y-auto custom-scrollbar flex-1 pb-safe">
        {children}
      </div>
    </div>
  </div>
);

// --- Keypad Component ---

const KeypadView: React.FC<{
  label: string;
  value: string;
  colorClass: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
}> = ({ label, value, colorClass, onChange, onConfirm }) => {
  const appendDigit = (digit: string) => {
    const current = value.replace(/,/g, '');
    const updated = current === "0" ? digit : current + digit;
    onChange(toCommaSeparated(updated));
  };

  const handleDelete = () => {
    const current = value.replace(/,/g, '');
    const updated = current.length <= 1 ? "0" : current.slice(0, -1);
    onChange(toCommaSeparated(updated));
  };

  const handleClear = () => {
    onChange("0");
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col space-y-2">
        <span className="text-lg font-bold ml-2 uppercase tracking-widest text-gray-400">{label}入力</span>
        <div className={`rounded-3xl p-5 flex items-center justify-end border min-h-[80px] shadow-inner overflow-hidden ${colorClass.replace('text-', 'border-').split(' ')[0]} bg-[#1A2536]`}>
           <span className={`text-[clamp(3rem,12vw,4.5rem)] font-black tracking-tighter truncate w-full text-right ${colorClass}`}>¥{value}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[7, 8, 9, 'DEL', 4, 5, 6, 'C', 1, 2, 3, '00'].map((key) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'DEL') handleDelete();
              else if (key === 'C') handleClear();
              else appendDigit(key.toString());
            }}
            className={`h-16 rounded-2xl text-3xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-md ${
              key === 'DEL' || key === 'C' ? 'bg-red-600/90 text-white' : 'bg-[#2D3848] text-white'
            }`}
          >
            {key === 'DEL' ? '←' : key}
          </button>
        ))}
        <button onClick={() => appendDigit('0')} className="h-16 rounded-2xl text-3xl font-bold bg-[#2D3848] text-white flex items-center justify-center active:scale-95 shadow-md">0</button>
        <button onClick={onConfirm} className="col-span-3 h-16 bg-green-600 text-white rounded-2xl text-2xl font-black shadow-xl active:scale-95 flex items-center justify-center gap-2">
          <Check className="w-8 h-8" /> 確定
        </button>
      </div>
    </div>
  );
};

// --- Shift Edit Modal ---

export const ShiftEditModal: React.FC<{
  shift: Shift;
  onClose: () => void;
  onSave: (startTime: number, plannedHours: number) => void;
}> = ({ shift, onClose, onSave }) => {
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(shift.startTime);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState(() => {
    return new Date(shift.startTime).toTimeString().slice(0, 5);
  });
  const [hours, setHours] = useState(shift.plannedHours);

  const handleSave = () => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    const newStart = new Date(year, month - 1, day, h, m).getTime();
    onSave(newStart, hours);
    onClose();
  };

  const hoursOptions = Array.from({ length: 21 }, (_, i) => i + 4); 

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <h3 className="text-2xl font-black text-white text-center">営業情報の修正</h3>
        
        <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-5">
          <div>
            <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" /> 開始日時
            </label>
            <div className="flex gap-3">
              <input 
                type="date" 
                value={dateStr} 
                onChange={(e) => setDateStr(e.target.value)} 
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-black outline-none focus:border-amber-500" 
              />
              <input 
                type="time" 
                value={timeStr} 
                onChange={(e) => setTimeStr(e.target.value)} 
                className="w-28 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-black outline-none focus:border-amber-500" 
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">予定営業時間</label>
            <div className="relative">
              <select 
                value={hours} 
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-lg font-black appearance-none focus:border-amber-500 outline-none"
              >
                {hoursOptions.map(h => (
                  <option key={h} value={h}>{h} 時間</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleSave} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform">
          変更を保存
        </button>
      </div>
    </ModalWrapper>
  );
};

// --- Settings Modal ---

export const SettingsModal: React.FC<{ 
  stats: MonthlyStats; 
  isAdmin: boolean;
  onUpdateStats: (newStats: Partial<MonthlyStats>) => void;
  onImportRecords?: (records: SalesRecord[], targetUid?: string) => void;
  onClose: () => void 
}> = ({ stats, isAdmin, onUpdateStats, onImportRecords, onClose }) => {
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
  const [otherUsers, setOtherUsers] = useState<{uid: string, name: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [followingUsers, setFollowingUsers] = useState<string[]>(stats.followingUsers || []);

  useEffect(() => {
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

  const displayScheduleMonth = useMemo(() => {
    if (calendarDates.length === 0) return '';
    const mid = calendarDates[Math.floor(calendarDates.length / 2)];
    return `${mid.getFullYear()} / ${String(mid.getMonth() + 1).padStart(2, '0')}`;
  }, [calendarDates]);

  const dutyCountInView = useMemo(() => {
    return calendarDates.filter(d => dutyDays.includes(formatDate(d))).length;
  }, [calendarDates, dutyDays]);

  const toggleDutyDay = (dateStr: string) => {
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

  const filteredUsers = otherUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const todayStr = getBusinessDate(Date.now(), businessStartHour);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <div className="text-center">
          <h3 className="text-2xl font-black text-white">設定</h3>
        </div>

        {/* ユーザー名設定 */}
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

        {/* プライバシー設定セクション */}
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

          {/* CUSTOMモードの場合のみ、ユーザー選択リストを表示 */}
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

        {/* 表示するユーザーの設定（フォロー機能） */}
        <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
          <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
             <Users className="w-5 h-5"/> 表示するユーザーの選択
          </label>
          <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-[10px] text-gray-400 mb-2">
            <p>※あなたが稼働状況を表示したい（フォローする）ユーザーを選択してください。</p>
            <p>※相手が公開を許可している場合のみ表示されます。</p>
          </div>

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

        <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-5">
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
                  className="bg-gray-800 text-white text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border border-gray-700"
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
                  className="bg-gray-800 text-white text-[clamp(1.6rem,6vw,2.2rem)] font-black w-full outline-none p-3 rounded-2xl border border-gray-700"
                />
              </div>
            </div>
          </div>
        </div>

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

        {/* 乗車区分の表示設定 */}
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
          
          <div className="grid grid-cols-7 gap-2">
            {['日', '月', '火', '水', '木', '金', '土'].map(w => (
              <div key={w} className="text-xl text-center font-black text-gray-500 mb-2">{w}</div>
            ))}
            {Array.from({ length: calendarDates[0]?.getDay() || 0 }).map((_, i) => <div key={i} />)}
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

        {/* CSVインポートセクション（管理者のみ機能有効、それ以外はメッセージ） */}
        {onImportRecords && (
            isAdmin ? (
                <CsvImportSection 
                    onImport={onImportRecords} 
                    isAdmin={isAdmin} 
                    users={otherUsers} 
                />
            ) : (
                <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
                    <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                        <FileUp className="w-5 h-5"/> 過去データの取り込み
                    </label>
                    <div className="p-4 bg-gray-950 rounded-2xl border border-gray-700 text-center">
                        <p className="text-sm font-bold text-gray-400">この機能は管理者専用です。</p>
                        <p className="text-xs text-gray-500 mt-1">希望される方は管理者までご連絡ください。</p>
                    </div>
                </div>
            )
        )}

        <button 
          onClick={saveSettings}
          className="w-full bg-amber-500 py-4 rounded-2xl font-black text-2xl text-black shadow-lg active:scale-95 transition-transform mt-5"
        >
          保存
        </button>

        {/* ログアウトボタン */}
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

// --- Daily Report Modal ---

export const DailyReportModal: React.FC<{
  shift: Shift;
  customLabels: Record<string, string>;
  enabledMethods?: PaymentMethod[];
  businessStartHour: number;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ shift, customLabels, enabledMethods, businessStartHour, onConfirm, onClose }) => {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-white">日報確認</h3>
            <p className="text-sm font-bold text-gray-500">シフトを終了して日報を作成します</p>
        </div>
        
        <div className="bg-gray-900/30 rounded-3xl p-2 border border-gray-800">
             <ReportSummaryView 
                records={shift.records} 
                customLabels={customLabels} 
                startTime={shift.startTime}
                endTime={Date.now()}
                totalRestMinutes={shift.totalRestMinutes}
                enabledMethods={enabledMethods}
            />
        </div>

        <div className="flex flex-col gap-3 pt-2">
            <button onClick={onConfirm} className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 border border-red-400/30">
                <CheckCircle2 className="w-8 h-8" /> 業務終了
            </button>
            <button onClick={onClose} className="w-full py-4 text-lg font-bold text-gray-500 uppercase active:scale-95 tracking-widest">閉じる</button>
        </div>
      </div>
    </ModalWrapper>
  );
};

// --- Record Modal ---

export const RecordModal: React.FC<{ 
  initialData?: Partial<SalesRecord>;
  enabledMethods: PaymentMethod[];
  enabledRideTypes: RideType[];
  customLabels: Record<string, string>;
  onClose: () => void; 
  onSave: (
    amount: number, 
    toll: number, 
    method: PaymentMethod, 
    ride: RideType, 
    nonCashAmount: number, 
    timestamp: number, 
    pickup?: string, 
    dropoff?: string, 
    pickupCoords?: string, 
    dropoffCoords?: string, 
    pMale?: number, 
    pFemale?: number,
    remarks?: string,
    isBadCustomer?: boolean
  ) => Promise<void>;
  onDelete: () => void;
  businessStartHour: number;
}> = ({ initialData, enabledMethods, enabledRideTypes, customLabels, onClose, onSave, onDelete, businessStartHour }) => {
  // Keypad State
  const [activeInput, setActiveInput] = useState<'amount' | 'toll' | 'nonCash' | null>(null);
  
  const [amountStr, setAmountStr] = useState(initialData?.amount ? initialData.amount.toLocaleString() : "0");
  const [tollStr, setTollStr] = useState(initialData?.toll ? initialData.toll.toLocaleString() : "0");
  const [method, setMethod] = useState<PaymentMethod>(initialData?.paymentMethod || (enabledMethods[0] || 'CASH'));
  
  const safeEnabledRideTypes = (enabledRideTypes && enabledRideTypes.length > 0) ? enabledRideTypes : ALL_RIDE_TYPES;
  const [rideType, setRideType] = useState<RideType>(initialData?.rideType || safeEnabledRideTypes[0]);

  const [otherAmountStr, setOtherAmountStr] = useState(initialData?.nonCashAmount ? initialData.nonCashAmount.toLocaleString() : "0");
  
  // 住所・座標ステート
  const [pickup, setPickup] = useState(initialData?.pickupLocation || "");
  const [dropoff, setDropoff] = useState(initialData?.dropoffLocation || "");
  const [pickupCoords, setPickupCoords] = useState(initialData?.pickupCoords || ""); 
  const [dropoffCoords, setDropoffCoords] = useState(initialData?.dropoffCoords || ""); 

  const [passengersMale, setPassengersMale] = useState(initialData?.passengersMale ?? 0); 
  const [passengersFemale, setPassengersFemale] = useState(initialData?.passengersFemale ?? 0);
  const [remarks, setRemarks] = useState(initialData?.remarks || "");
  const [isBadCustomer, setIsBadCustomer] = useState(initialData?.isBadCustomer || false);

  const [isLocating, setIsLocating] = useState<'pickup' | 'dropoff' | 'stopover' | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // ★追加: 乗り場選択用State
  const [standSelection, setStandSelection] = useState<TaxiStandDef | null>(null);

  const rideTypeRef = useRef<HTMLDivElement>(null);
  const amountSectionRef = useRef<HTMLDivElement>(null);
  const prevActiveInputRef = useRef<string | null>(null);

  const [recordDate, setRecordDate] = useState(() => {
    const d = initialData?.timestamp ? new Date(initialData.timestamp) : new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [recordTime, setRecordTime] = useState(() => {
    const d = initialData?.timestamp ? new Date(initialData.timestamp) : new Date();
    return d.toTimeString().split(' ')[0].slice(0, 5);
  });

  const businessTimePreview = useMemo(() => {
    if (!recordDate || !recordTime) return '';
    const [year, month, day] = recordDate.split('-').map(Number);
    const [hour, min] = recordTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour, min);
    
    const bDate = getBusinessDate(d.getTime(), businessStartHour);
    const bTime = formatBusinessTime(d.getTime(), businessStartHour);
    return `${bDate} ${bTime}`;
  }, [recordDate, recordTime, businessStartHour]);

  useEffect(() => {
    if (!activeInput) {
        setTimeout(() => {
            rideTypeRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
    }
  }, []);

  useEffect(() => {
    if (activeInput === null && (prevActiveInputRef.current === 'amount' || prevActiveInputRef.current === 'toll')) {
        setTimeout(() => {
            amountSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
    }
    prevActiveInputRef.current = activeInput;
  }, [activeInput]);

  useEffect(() => {
    if (!initialData?.id && pickup === "") {
      fetchAddress('pickup');
    }
  }, []);

  useEffect(() => {
    if (method !== 'CASH' && activeInput !== 'nonCash') {
      const fare = fromCommaSeparated(amountStr);
      const toll = fromCommaSeparated(tollStr);
      setOtherAmountStr((fare + toll).toLocaleString());
    }
  }, [amountStr, tollStr, method]);

  const fetchAddress = async (type: 'pickup' | 'dropoff' | 'stopover') => {
    setIsLocating(type);
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          timeout: 10000,
          enableHighAccuracy: true 
        });
      });
      const { latitude, longitude } = pos.coords;
      const coordsString = `${latitude},${longitude}`; 

      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ja' }
      });
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      const formatted = formatJapaneseAddress(data);
      if (formatted) {
        if (type === 'pickup') { 
            setPickup(formatted); 
            setPickupCoords(coordsString); 
            
            // ★乗り場判定ロジック
            const stand = findTaxiStand(formatted);
            if (stand) {
                setStandSelection(stand);
            }
        }
        else if (type === 'dropoff') { setDropoff(formatted); setDropoffCoords(coordsString); }
        return formatted;
      }
    } catch (err) {
      console.error("Geolocation failed", err);
    } finally {
      setIsLocating(null);
    }
    return '';
  };

  const handleAddStopover = async () => {
    const formattedAddr = await fetchAddress('stopover');
    if (!formattedAddr) return;

    setRemarks(prev => {
      if (!prev.includes('(経由)')) {
        const base = prev.trim() ? prev.trim() + "\n" : "";
        return base + `(経由)${formattedAddr}`;
      }

      const parts = prev.split('(経由)');
      const lastStop = parts[1].split('→').pop()?.trim();
      if (lastStop === formattedAddr) return prev;
      return prev + `→${formattedAddr}`;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    let finalDropoff = dropoff;
    let finalDropoffCoords = dropoffCoords;
    if (!initialData?.id && !finalDropoff) {
      setIsLocating('dropoff');
      try {
        const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        finalDropoffCoords = `${pos.coords.latitude},${pos.coords.longitude}`;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'ja' } });
        const data = await res.json();
        const autoAddress = formatJapaneseAddress(data);
        if (autoAddress) finalDropoff = autoAddress;
      } catch (e) { console.error(e); }
      setIsLocating(null);
    }

    const finalAmount = fromCommaSeparated(amountStr);
    const finalToll = fromCommaSeparated(tollStr);
    const nonCash = method !== 'CASH' ? fromCommaSeparated(otherAmountStr) : 0;
    
    const [year, month, day] = recordDate.split('-').map(Number);
    const [hour, min] = recordTime.split(':').map(Number);
    const finalTimestamp = new Date(year, month - 1, day, hour, min).getTime();
    
    await onSave(
      finalAmount, 
      finalToll, 
      method, 
      rideType, 
      nonCash, 
      finalTimestamp, 
      pickup, 
      finalDropoff,
      pickupCoords, 
      finalDropoffCoords, 
      passengersMale,
      passengersFemale,
      remarks,
      isBadCustomer
    );
    setIsSaving(false);
  };

  const cyclePassenger = (type: 'male' | 'female') => {
    if (type === 'male') {
      setPassengersMale(prev => (prev + 1) > 4 ? 0 : prev + 1);
    } else {
      setPassengersFemale(prev => (prev + 1) > 4 ? 0 : prev + 1);
    }
  };

  const currentKeypadValue = activeInput === 'amount' ? amountStr 
                            : activeInput === 'toll' ? tollStr 
                            : activeInput === 'nonCash' ? otherAmountStr : "0";
  
  const handleKeypadChange = (val: string) => {
    if (activeInput === 'amount') setAmountStr(val);
    else if (activeInput === 'toll') setTollStr(val);
    else if (activeInput === 'nonCash') setOtherAmountStr(val);
  };

  const getKeypadLabel = () => {
    if (activeInput === 'amount') return '運賃';
    if (activeInput === 'toll') return '高速代';
    if (activeInput === 'nonCash') return '決済額';
    return '';
  };

  const getKeypadColor = () => {
    if (activeInput === 'amount') return 'text-amber-500';
    if (activeInput === 'toll') return 'text-white';
    if (activeInput === 'nonCash') return 'text-blue-500';
    return 'text-white';
  };

  const handleStandSelect = (option: string) => {
      if (standSelection) {
          setPickup(`${standSelection.name} ${option}`);
          setStandSelection(null);
      }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 flex flex-col justify-end animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-5 shadow-2xl space-y-5 border-t border-gray-700" onClick={(e) => e.stopPropagation()}>
          
          {standSelection ? (
              // ★乗り場選択画面
              <div className="space-y-6 py-6 animate-in slide-in-from-bottom-4">
                  <div className="text-center space-y-2">
                      <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                          <MapIcon className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-2xl font-black text-white">{standSelection.name} からですか？</h3>
                      <p className="text-sm font-bold text-gray-400">乗り場番号か場所を選択してください</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                      {standSelection.options.map(opt => (
                          <button
                              key={opt}
                              onClick={() => handleStandSelect(opt)}
                              className="bg-gray-800 hover:bg-blue-900/50 border border-gray-700 hover:border-blue-500 text-white font-black py-4 rounded-xl text-lg transition-all active:scale-95"
                          >
                              {opt}
                          </button>
                      ))}
                  </div>
                  
                  <button 
                      onClick={() => setStandSelection(null)}
                      className="w-full py-4 text-gray-500 font-bold border-t border-gray-800 mt-2"
                  >
                      いいえ、通常の乗車です
                  </button>
              </div>
          ) : activeInput ? (
            <KeypadView 
              label={getKeypadLabel()}
              value={currentKeypadValue}
              colorClass={getKeypadColor()}
              onChange={handleKeypadChange}
              onConfirm={() => setActiveInput(null)}
            />
          ) : (
            <div className="space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar pb-2 relative">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <div className="flex flex-col w-full">
                  <h2 className="text-2xl font-black text-white">{initialData?.id ? '記録の修正' : '詳細入力'}</h2>
                </div>
                
                <div className="absolute top-0 right-14 flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsBadCustomer(!isBadCustomer)}
                      className={`p-2 rounded-full border-2 transition-all ${
                        isBadCustomer 
                          ? 'bg-red-900/50 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                          : 'bg-gray-900 border-gray-700 text-gray-600'
                      }`}
                    >
                      <Skull className="w-6 h-6" />
                    </button>
                </div>

                <button onClick={onClose} className="text-gray-500 p-2 absolute top-0 right-0"><X className="w-8 h-8" /></button>
              </div>

              <div className="bg-gray-900/80 p-4 rounded-3xl border-2 border-gray-700/50 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
                  <label className="text-xs font-black text-amber-500 uppercase tracking-widest block mb-1 flex items-center justify-center gap-2">
                      <CalendarDays className="w-4 h-4" /> 入力対象日
                  </label>
                  <input 
                    type="date" 
                    value={recordDate} 
                    onChange={(e) => setRecordDate(e.target.value)} 
                    className="bg-transparent text-white text-3xl font-black w-full text-center outline-none uppercase tracking-widest"
                  />
              </div>

              <div className="space-y-6">
                <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                  <label className="text-xl font-black text-gray-500 uppercase block tracking-widest mb-3">1. 時間</label>
                  <div className="flex gap-3">
                    <input type="time" value={recordTime} onChange={(e) => setRecordTime(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-2xl font-black outline-none focus:border-amber-500 shadow-inner text-gray-400 text-center" />
                  </div>
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold px-1 mt-2 justify-center">
                      <Info className="w-4 h-4" />
                      <span>営業日換算: {businessTimePreview}</span>
                  </div>
                </div>

                <div className="space-y-4 bg-gray-900/20 p-2 rounded-3xl border border-gray-800/50 opacity-80 hover:opacity-100 transition-opacity">
                  <label className="text-xl font-black text-gray-500 uppercase block tracking-widest px-2 mb-3">2. 乗降地</label>
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-green-400" /> 乗車地
                      </label>
                      <button 
                        onClick={() => fetchAddress('pickup')}
                        className="text-[10px] bg-gray-800 text-green-400 font-black px-2 py-1 rounded-lg border border-green-500/20 active:scale-90 flex items-center gap-1 whitespace-nowrap"
                      >
                        {isLocating === 'pickup' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                        現在地
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={pickup} 
                        onChange={(e) => { setPickup(e.target.value); if(!e.target.value) setPickupCoords(""); }}
                        placeholder="例: 巽東３" 
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-2xl p-3 text-lg font-black outline-none focus:border-green-500 shadow-inner"
                      />
                      {pickupCoords && (
                        <a 
                          href={getGoogleMapsUrl(pickupCoords) || "#"} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 active:scale-90 flex items-center justify-center"
                        >
                          <MapPinned className="w-6 h-6" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPinned className="w-3 h-3 text-red-400" /> 降車地
                      </label>
                      <button 
                        onClick={() => fetchAddress('dropoff')}
                        className="text-[10px] bg-gray-800 text-red-400 font-black px-2 py-1 rounded-lg border border-red-500/20 active:scale-90 flex items-center gap-1 whitespace-nowrap"
                      >
                        {isLocating === 'dropoff' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPinned className="w-3 h-3" />}
                        現在地
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={dropoff} 
                        onChange={(e) => { setDropoff(e.target.value); if(!e.target.value) setDropoffCoords(""); }}
                        placeholder="保存時に自動取得" 
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-2xl p-3 text-lg font-black outline-none focus:border-red-500 shadow-inner"
                      />
                      {dropoffCoords && (
                        <a 
                          href={getGoogleMapsUrl(dropoffCoords) || "#"} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 active:scale-90 flex items-center justify-center"
                        >
                          <MapPinned className="w-6 h-6" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div ref={rideTypeRef} className="scroll-mt-4">
                  <label className="text-xl font-black text-gray-500 uppercase mb-3 block tracking-widest">3. 乗車区分</label>
                  <div className="grid grid-cols-3 gap-3">
                    {safeEnabledRideTypes.map(r => (
                      <button
                        key={r}
                        onClick={() => setRideType(r)}
                        className={`py-4 rounded-2xl font-black text-xl border-2 transition-all shadow-sm ${
                          rideType === r ? 'bg-amber-500 border-amber-400 text-black' : 'bg-gray-800 border-gray-700 text-gray-400'
                        } active:scale-95`}
                      >
                        {RIDE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-950 p-4 rounded-3xl border border-gray-800">
                  <label className="text-xl font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-amber-500" /> 4. 乗車人数
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => cyclePassenger('male')}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 h-32 ${
                        passengersMale > 0 
                          ? 'bg-blue-900/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                          : 'bg-gray-900/50 border-gray-700 text-gray-500'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest mb-1">男性</span>
                      <span className={`text-6xl font-black ${passengersMale > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {passengersMale}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cyclePassenger('female')}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 h-32 ${
                        passengersFemale > 0 
                          ? 'bg-pink-900/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                          : 'bg-gray-900/50 border-gray-700 text-gray-500'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest mb-1">女性</span>
                      <span className={`text-6xl font-black ${passengersFemale > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {passengersFemale}
                      </span>
                    </button>
                  </div>
                </div>

                <div ref={amountSectionRef} className="scroll-mt-4">
                    <label className="text-xl font-black text-gray-400 uppercase tracking-widest block mb-3">5. 金額入力</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => setActiveInput('amount')}
                        className="bg-gray-950 p-4 rounded-3xl border border-amber-500/30 flex flex-col items-center justify-center shadow-inner cursor-pointer active:scale-[0.98] transition-all min-h-[100px]"
                      >
                        <span className="text-amber-500 font-bold text-sm uppercase mb-1 tracking-widest">運賃</span>
                        <div className="flex items-baseline">
                           <span className="text-amber-500 font-black text-xl mr-1">¥</span>
                           <span className="text-white text-[clamp(2rem,8vw,2.5rem)] font-black truncate leading-none">
                             {amountStr || "0"}
                           </span>
                        </div>
                      </div>
                      
                      <div
                        onClick={() => setActiveInput('toll')}
                        className="bg-gray-900 border border-gray-700 rounded-3xl p-4 flex flex-col items-center justify-center shadow-inner cursor-pointer active:scale-[0.98] transition-all min-h-[100px]"
                      >
                        <span className="text-gray-400 font-bold text-sm uppercase mb-1 tracking-widest">高速代</span>
                        <div className="flex items-baseline">
                           <span className="text-white text-[clamp(2rem,8vw,2.5rem)] font-black truncate leading-none">
                             {tollStr || "0"}
                           </span>
                        </div>
                      </div>
                    </div>
                </div>

                <div>
                  <label className="text-xl font-black text-gray-400 uppercase mb-3 block tracking-widest">6. 決済方法</label>
                  <div className="relative">
                    <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 text-white text-xl font-black outline-none appearance-none focus:border-blue-500 cursor-pointer shadow-inner">
                      {enabledMethods.map(m => (
                        <option key={m} value={m}>{customLabels[m] || PAYMENT_LABELS[m]}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"><ChevronRight className="w-6 h-6 rotate-90" /></div>
                  </div>
                </div>

                {method !== 'CASH' && (
                  <div className="bg-blue-900/10 p-4 rounded-3xl border border-blue-900/30 shadow-inner">
                    <label className="text-xs text-blue-400 font-bold uppercase mb-1 block tracking-widest">{customLabels[method] || PAYMENT_LABELS[method]}決済額</label>
                    <div 
                      onClick={() => setActiveInput('nonCash')}
                      className="flex items-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <span className="text-blue-500 font-black text-2xl">¥</span>
                      <span className="w-full bg-transparent border-b border-blue-900/50 p-1 text-3xl font-black text-white outline-none">
                        {otherAmountStr || "0"}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xl font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                      <MessageSquare className="w-5 h-5" /> 7. 備考
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStopover}
                      className="text-xs bg-blue-600/20 text-blue-400 font-black px-3 py-1.5 rounded-full border border-blue-500/20 active:scale-95 flex items-center gap-1 transition-all"
                    >
                      {isLocating === 'stopover' ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
                      経由地追加
                    </button>
                  </div>
                  <textarea 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    placeholder="メモ、待機時間など..." 
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-3 text-white text-base min-h-[80px] outline-none focus:border-amber-500 shadow-inner" 
                  />
                </div>

                <div className="flex flex-col gap-3 pt-5 pb-5">
                  <button 
                    disabled={isSaving}
                    onClick={handleSave} 
                    className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
                  >
                    {isSaving ? <><Loader2 className="w-6 h-6 animate-spin" /> 保存中...</> : (initialData?.id ? '保存する' : 'この内容で完了')}
                  </button>
                  {initialData?.id && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (isConfirmingDelete) { onDelete(); } else { setIsConfirmingDelete(true); } }} 
                      className={`w-full py-4 font-black text-lg flex items-center justify-center gap-2 rounded-2xl transition-all border-2 active:scale-95 ${
                        isConfirmingDelete ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'text-red-500 border-red-500/30'
                      }`}
                    >
                      {isConfirmingDelete ? '本当に削除しますか？' : <><Trash2 className="w-5 h-5" /> 記録を削除</>}
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="w-full py-4 text-xl font-bold active:scale-90 tracking-widest text-gray-500 uppercase">Cancel</button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};