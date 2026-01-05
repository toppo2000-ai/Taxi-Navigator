import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, 
  TrendingUp, 
  Zap, 
  Timer, 
  ClipboardList, 
  Target, 
  CalendarDays, 
  LayoutList, 
  ArrowUpDown, 
  Play, 
  Coffee, 
  StopCircle, 
  ChevronDown, 
  Users, 
  X, 
  ChevronRight, 
  ChevronLeft,
  ArrowLeft, 
  LogOut, 
  Car, 
  Globe, 
  Lock, 
  ShieldCheck,
  Gauge
} from 'lucide-react';
import { auth } from '../../services/firebase';
import { Shift, MonthlyStats, SalesRecord, BreakState, DayMetadata } from '../../types';
import { 
  formatCurrency, 
  formatTime, 
  formatDate, 
  toCommaSeparated, 
  fromCommaSeparated, 
  calculateNetTotal, 
  getBusinessDate, 
  getBillingPeriod, 
  getPaymentBreakdown,
  getRideBreakdown,
  filterRecordsWithSimpleModePriority
} from '../../utils';
import { SalesRecordCard } from '../history/SalesRecordCard';
import { PaymentBreakdownList, getPaymentCounts } from '../history/PaymentBreakdownList';
import { ModalWrapper } from '../common/modals/ModalWrapper';
import { FullScreenClock } from '../common/FullScreenClock';
import { ColleagueStatusList } from '../common/ColleagueStatusList';

// ★追加: assetsフォルダから画像をインポート
import taxiImage from '../../assets/top.png';

// ★管理者設定: ここにご自身のGoogleメールアドレスを入力してください
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// --- Local Helper Components ---

export const NeonProgressBar: React.FC<{ progress: number, color: 'amber' | 'blue' }> = ({ progress, color }) => {
  const isAmber = color === 'amber';
  const barColorClass = isAmber ? 'bg-amber-500 shadow-[0_0_15px_#F59E0B]' : 'bg-blue-500 shadow-[0_0_15px_#3B82F6]';
  const borderColorClass = isAmber ? 'border-amber-400/40' : 'border-blue-400/40';
  
  return (
    <div className={`w-full bg-[#05080C] border-2 ${borderColorClass} rounded-full h-8 p-1 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]`}>
      <div 
        className={`h-full transition-all duration-1000 ease-out rounded-full ${barColorClass}`} 
        style={{ width: `${Math.min(100, progress)}%` }} 
      />
    </div>
  );
};

// --- Dashboard Component ---

interface DashboardProps { 
  shift: Shift | null; 
  stats: MonthlyStats; 
  breakState: BreakState;
  onStart: (goal: number, hours: number, startOdo?: number) => void;
  onUpdateStartOdo?: (newOdo: number) => void; 
  onEnd: () => void;
  onAdd: (initialRemarks?: string) => void;
  onEdit: (record: SalesRecord) => void;
  onUpdateGoal: (newGoal: number) => void;
  onUpdateShiftGoal: (newGoal: number) => void;
  onAddRestMinutes: (minutes: number) => void;
  onToggleBreak: () => void;
  setBreakState: (state: BreakState) => void;
  onShiftEdit: () => void;
  history?: SalesRecord[];
  dayMetadata?: Record<string, DayMetadata>;
  onUpdateStats?: (newStats: Partial<MonthlyStats>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  shift, 
  stats, 
  breakState,
  onStart, 
  onEnd, 
  onAdd, 
  onEdit, 
  onUpdateGoal, 
  onUpdateShiftGoal,
  onAddRestMinutes,
  onToggleBreak,
  setBreakState,
  onShiftEdit,
  onUpdateStartOdo,
  history = [],
  dayMetadata = {},
  onUpdateStats
}) => {
  const [goalIn, setGoalIn] = useState(stats.defaultDailyGoal.toLocaleString()); 
  const [plannedHours, setPlannedHours] = useState(12);
  const [isGoalEditOpen, setIsGoalEditOpen] = useState(false);
  const [isShiftGoalEditOpen, setIsShiftGoalEditOpen] = useState(false);
  const [newMonthlyGoal, setNewMonthlyGoal] = useState(stats.monthlyGoal.toLocaleString());
  const [newShiftGoal, setNewShiftGoal] = useState(shift?.dailyGoal.toLocaleString() || stats.defaultDailyGoal.toLocaleString());
  const [isHistoryReversed, setIsHistoryReversed] = useState(true);
  const [isDetailed, setIsDetailed] = useState(false);
  const [isSlim, setIsSlim] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  // 時計表示用ステート
  const [isClockOpen, setIsClockOpen] = useState(false);
  // カレンダー表示用ステート
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // 出勤予定日カレンダー用ステート
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [calendarDutyDays, setCalendarDutyDays] = useState<string[]>(stats.dutyDays || []);
  
  const businessStartHour = stats.businessStartHour ?? 9;
  const shimebiDay = stats.shimebiDay ?? 20;
  
  // カレンダーの日付配列を生成（SettingsModalと同じロジック）
  const calendarDates = useMemo(() => {
    const sDay = parseInt(shimebiDay.toString());
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start: billingStart, end: billingEnd } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
    
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
    
    // 5週分（35日）を生成
    const dates: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 35; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [calendarViewDate, shimebiDay, businessStartHour]);

  // 表示する月のラベル
  const displayScheduleMonth = useMemo(() => {
    const sDay = parseInt(shimebiDay.toString());
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { end } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
    return `${end.getFullYear()} / ${String(end.getMonth() + 1).padStart(2, '0')}`;
  }, [calendarViewDate, shimebiDay, businessStartHour]);

  // 売上データがある日を判定
  const hasSalesData = useMemo(() => {
    const salesDateMap: Record<string, boolean> = {};
    const dateMap: Record<string, SalesRecord[]> = {};
    
    history.forEach(record => {
      const businessDateStr = getBusinessDate(record.timestamp, businessStartHour);
      if (!dateMap[businessDateStr]) {
        dateMap[businessDateStr] = [];
      }
      dateMap[businessDateStr].push(record);
    });
    
    Object.keys(dateMap).forEach(dateStr => {
      const dayRecords = dateMap[dateStr];
      const hasSimpleMode = dayRecords.some(r => r.remarks?.includes('簡易モード'));
      
      if (hasSimpleMode) {
        const simpleRecords = dayRecords.filter(r => r.remarks?.includes('簡易モード'));
        if (simpleRecords.length > 0) {
          salesDateMap[dateStr] = true;
        }
      } else {
        const detailedRecords = dayRecords.filter(r => !r.remarks?.includes('簡易モード'));
        if (detailedRecords.length > 0) {
          salesDateMap[dateStr] = true;
        }
      }
    });
    
    return salesDateMap;
  }, [history, businessStartHour]);

  // 選択した日数をカウント
  const dutyCountInView = useMemo(() => {
    const sDay = parseInt(shimebiDay.toString());
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start: billingStart, end: billingEnd } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
    const billingStartStr = formatDate(billingStart);
    const billingEndStr = formatDate(billingEnd);
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    
    const selectedDaysSet = new Set<string>();
    
    calendarDates.forEach(d => {
      const dateWithHour = new Date(d);
      dateWithHour.setHours(businessStartHour, 0, 0, 0);
      const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
      const isInBillingPeriod = businessDateStr >= billingStartStr && businessDateStr <= billingEndStr;
      
      if (isInBillingPeriod) {
        const isPast = businessDateStr < todayBusinessDate;
        const hasSales = hasSalesData[businessDateStr] || false;
        const isDuty = calendarDutyDays.includes(businessDateStr);
        
        if (isDuty || (isPast && hasSales)) {
          selectedDaysSet.add(businessDateStr);
        }
      }
    });
    
    return selectedDaysSet.size;
  }, [calendarDates, calendarDutyDays, calendarViewDate, shimebiDay, businessStartHour, hasSalesData]);

  // stats.dutyDaysが変更されたときにcalendarDutyDaysを更新
  useEffect(() => {
    setCalendarDutyDays(stats.dutyDays || []);
  }, [stats.dutyDays]);

  // 日付の選択/解除
  const toggleDutyDay = (dateStr: string) => {
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    const isPast = dateStr < todayBusinessDate;
    if (isPast) {
      return;
    }
    
    setCalendarDutyDays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  // 平日のみ自動選択
  const handleAutoSetDutyDays = () => {
    const sDay = parseInt(shimebiDay.toString());
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start, end } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
    
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
    setCalendarDutyDays(newDutyDays);
  };

  // ODOメーター用ステート
  const [startOdoIn, setStartOdoIn] = useState('');
  const [isOdoWarningOpen, setIsOdoWarningOpen] = useState(false);
  const [isOdoEditOpen, setIsOdoEditOpen] = useState(false);

  // 必要売上ポップアップ用ステート
  const [isRequiredSalesModalOpen, setIsRequiredSalesModalOpen] = useState(false);

  const [breakDurationMs, setBreakDurationMs] = useState(0);
  const breakIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!shift) {
      setGoalIn(stats.defaultDailyGoal.toLocaleString());
    } else if (shift.startOdo) {
      setStartOdoIn(shift.startOdo.toString());
    }
  }, [stats.defaultDailyGoal, shift]);

  useEffect(() => {
    if (breakState.isActive && breakState.startTime) {
      setBreakDurationMs(Date.now() - breakState.startTime);
      breakIntervalRef.current = window.setInterval(() => {
        if (breakState.startTime) {
            setBreakDurationMs(Date.now() - breakState.startTime);
        }
      }, 1000);
    } else {
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
      }
      setBreakDurationMs(0);
    }
    return () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    };
  }, [breakState]);

  const handleStartShift = () => {
    if (!startOdoIn) {
      setIsOdoWarningOpen(true);
      return;
    }
    onStart(fromCommaSeparated(goalIn), plannedHours, Number(startOdoIn));
  };

  const confirmStartWithoutOdo = () => {
    setIsOdoWarningOpen(false);
    onStart(fromCommaSeparated(goalIn), plannedHours);
  };

  const handleUpdateOdo = () => {
    if (onUpdateStartOdo && startOdoIn) {
      onUpdateStartOdo(Number(startOdoIn));
      setIsOdoEditOpen(false);
    }
  };

  const handleStopBreakAndRegister = () => {
    const minutes = Math.floor(breakDurationMs / 60000);
    if (minutes > 0) {
      onAddRestMinutes(minutes);
    }
    setBreakState({ isActive: false, startTime: null });
  };

  const handleStopBreakAndRide = () => {
    const minutes = Math.floor(breakDurationMs / 60000);
    // 休憩から乗車記録へ移行する際は実車状態にする
    // onAddを先に呼んでモーダルを開き、その後でbreakStateを更新する
    // これにより、useEffectが'riding'状態を維持できる
    onAdd(`待機時間: ${minutes}分`);
    // モーダルが開いた後にbreakStateを更新（useEffectが'riding'を維持する）
    setTimeout(() => {
      setBreakState({ isActive: false, startTime: null });
    }, 100);
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const shiftRecords = useMemo(() => shift?.records || [], [shift]);
  const dailyTotal = useMemo(() => shiftRecords.reduce((s, r) => s + r.amount, 0), [shiftRecords]);
  const dailyNet = useMemo(() => calculateNetTotal(dailyTotal), [dailyTotal]);
  const currentShiftBreakdown = useMemo(() => getPaymentBreakdown(shiftRecords), [shiftRecords]);
  const currentShiftCounts = useMemo(() => getPaymentCounts(shiftRecords), [shiftRecords]);

  const elapsedMinutes = useMemo(() => {
    if (!shift) return 0;
    return (now - shift.startTime) / 60000;
  }, [shift, now]);

  const elapsedTimeStr = useMemo(() => {
    if (!shift) return "";
    const diff = now - shift.startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  }, [shift, now]);

  const hourlySales = useMemo(() => {
    if (elapsedMinutes <= 0) return 0;
    return (dailyTotal / elapsedMinutes) * 60;
  }, [dailyTotal, elapsedMinutes]);

  const remainingToGoal = useMemo(() => {
    if (!shift) return 0;
    return Math.max(0, shift.dailyGoal - dailyTotal);
  }, [shift, dailyTotal]);

  const referenceValue = useMemo(() => {
    if (!shift || !shift.plannedHours || shift.plannedHours === 0) return 0;
    const currentElapsedHours = (now - shift.startTime) / (1000 * 60 * 60);
    const hourlyTarget = shift.dailyGoal / shift.plannedHours;
    const idealCurrentSales = hourlyTarget * currentElapsedHours;
    return dailyTotal - idealCurrentSales;
  }, [shift, now, dailyTotal]);

  const dailyProgress = shift ? (dailyTotal / (shift.dailyGoal || 1)) * 100 : 0;
  const sortedRecords = useMemo(() => isHistoryReversed ? [...shiftRecords].reverse() : [...shiftRecords], [shiftRecords, isHistoryReversed]);
  const billingPeriod = useMemo(() => getBillingPeriod(new Date(), stats.shimebiDay, stats.businessStartHour), [stats.shimebiDay, stats.businessStartHour]);
  const todayBusinessDate = getBusinessDate(Date.now(), stats.businessStartHour);

  const remainingDutyDays = useMemo(() => {
    if (!stats.dutyDays) return 0;
    return stats.dutyDays.filter(dStr => dStr >= todayBusinessDate && dStr <= formatDate(billingPeriod.end)).length;
  }, [stats.dutyDays, todayBusinessDate, billingPeriod.end]);

  const requiredPerDay = useMemo(() => {
    const remainingGoal = Math.max(0, stats.monthlyGoal - stats.totalSales);
    return remainingDutyDays <= 0 ? 0 : remainingGoal / remainingDutyDays;
  }, [stats.monthlyGoal, stats.totalSales, remainingDutyDays]);

  // 今日までの出勤日数を計算（今日も含む）
  // 実際の売上データがある日数をカウント（簡易モード優先でフィルタリング）
  const completedDutyDays = useMemo(() => {
    const startStr = formatDate(billingPeriod.start);
    const endStr = formatDate(billingPeriod.end);
    
    // 営業期間内のレコードを取得
    const periodRecords = (history || []).filter(r => {
      const bDate = getBusinessDate(r.timestamp, businessStartHour);
      return bDate >= startStr && bDate <= endStr && bDate <= todayBusinessDate;
    });
    
    // 簡易モード優先でフィルタリング
    const filteredRecords = filterRecordsWithSimpleModePriority(periodRecords, businessStartHour);
    
    // 営業日ごとにグループ化して、ユニークな営業日数をカウント
    const uniqueDaysSet = new Set<string>();
    filteredRecords.forEach(r => {
      const businessDateStr = getBusinessDate(r.timestamp, businessStartHour);
      uniqueDaysSet.add(businessDateStr);
    });
    
    const result = uniqueDaysSet.size;
    console.log('[Dashboard] completedDutyDays calculation:', {
      historyCount: history?.length || 0,
      periodRecordsCount: periodRecords.length,
      filteredRecordsCount: filteredRecords.length,
      uniqueDaysCount: result,
      todayBusinessDate,
      billingPeriodStart: startStr,
      billingPeriodEnd: endStr
    });
    return result;
  }, [history, todayBusinessDate, billingPeriod.start, billingPeriod.end, businessStartHour]);

  // 出勤予定日数（期間全体）
  const plannedDutyDays = useMemo(() => {
    if (!stats.dutyDays) return 0;
    return stats.dutyDays.filter(dStr => dStr >= formatDate(billingPeriod.start) && dStr <= formatDate(billingPeriod.end)).length;
  }, [stats.dutyDays, billingPeriod]);

  // 現時点での平均売上: 現時点の売上 ÷ 出勤日数
  const averageDailySales = useMemo(() => {
    if (completedDutyDays <= 0) {
      console.log('[Dashboard] averageDailySales: completedDutyDays is 0 or less, returning 0');
      return 0;
    }
    const result = stats.totalSales / completedDutyDays;
    console.log('[Dashboard] averageDailySales calculation:', {
      totalSales: stats.totalSales,
      completedDutyDays: completedDutyDays,
      calculation: `${stats.totalSales} / ${completedDutyDays}`,
      result: result
    });
    return result;
  }, [stats.totalSales, completedDutyDays]);

  // 予想月間売上: 現時点での平均売上 × (出勤日数 + 予定出勤日数)
  const estimatedMonthlySales = useMemo(() => {
    if (completedDutyDays <= 0) return 0;
    return averageDailySales * (completedDutyDays + remainingDutyDays);
  }, [averageDailySales, completedDutyDays, remainingDutyDays]);

  const estimatedEndTime = useMemo(() => {
    if (!shift) return null;
    return shift.startTime + (shift.plannedHours * 3600000);
  }, [shift]);

  const hoursOptions = Array.from({ length: 21 }, (_, i) => i + 4);

  const PrivacyBadge = () => {
    const currentUserEmail = auth.currentUser?.email || "";
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

    if (isAdmin) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.2)]">
          <ShieldCheck size={12} />
          <span>管理者</span>
        </div>
      );
    }

    const mode = stats.visibilityMode || 'PUBLIC';
    
    if (mode === 'PUBLIC') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-[10px] font-black text-green-400 uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.2)]">
          <Globe size={12} />
          <span>公開中</span>
        </div>
      );
    }
    if (mode === 'PRIVATE') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[10px] font-black text-red-400 uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">
          <Lock size={12} />
          <span>非公開</span>
        </div>
      );
    }
    if (mode === 'CUSTOM') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest shadow-[0_0_10px_rgba(59,130,246,0.2)]">
          <Users size={12} />
          <span>限定公開</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 pb-32 space-y-5 w-full max-w-full overflow-hidden">
      
      {isClockOpen && createPortal(<FullScreenClock onClose={() => setIsClockOpen(false)} />, document.body)}

      {isOdoWarningOpen && (
        <ModalWrapper onClose={() => setIsOdoWarningOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
             <div className="flex justify-center mb-4">
                <div className="bg-amber-500/10 p-4 rounded-full">
                    <Car className="w-12 h-12 text-amber-500" />
                </div>
             </div>
            <h3 className="text-xl font-black text-white">確認</h3>
            <p className="text-gray-300 font-bold">
              「開始ODO入力」がされていませんが<br/>よろしいですか？
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                    onClick={() => setIsOdoWarningOpen(false)} 
                    className="bg-gray-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform"
                >
                    いいえ
                </button>
                <button 
                    onClick={confirmStartWithoutOdo} 
                    className="bg-amber-500 text-black py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform"
                >
                    はい
                </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {isOdoEditOpen && (
        <ModalWrapper onClose={() => setIsOdoEditOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
            <h3 className="text-xl font-black text-white">開始メーター修正</h3>
            <div className="flex items-center bg-gray-800 rounded-2xl p-5 border-2 border-blue-500 focus-within:border-blue-400 transition-all shadow-inner">
                <Gauge className="text-gray-500 w-8 h-8 mr-3" />
                <input 
                    type="number" 
                    inputMode="numeric" 
                    value={startOdoIn} 
                    onChange={(e) => setStartOdoIn(e.target.value)} 
                    placeholder="開始ODO"
                    className="bg-transparent text-white text-[clamp(1.5rem,8vw,2.5rem)] font-black w-full outline-none text-center placeholder-gray-700" 
                />
                <span className="text-gray-500 font-bold ml-2">km</span>
            </div>
            <button onClick={handleUpdateOdo} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform">
              保存
            </button>
          </div>
        </ModalWrapper>
      )}

      {shift && (
        <div className="flex justify-between items-end px-2 mb-2">
          <div 
            className="flex flex-col cursor-pointer active:scale-95 transition-transform" 
            onClick={() => setIsClockOpen(true)}
          >
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Current Time</span>
            <span className="text-3xl font-black text-white leading-none font-mono">
              {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsOdoEditOpen(true)}
              className="bg-gray-800 p-2 rounded-full border border-gray-700 text-gray-400 active:scale-95 transition-transform hover:text-white hover:border-gray-500"
            >
              <Gauge size={20} />
            </button>
            <PrivacyBadge />
          </div>
        </div>
      )}

      {!shift && (
        <div className="bg-gray-800 rounded-[28px] px-5 py-6 border-2 border-blue-500 shadow-2xl animate-in fade-in duration-300 space-y-6 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-black tracking-widest uppercase text-gray-400 whitespace-nowrap">売上状況</span>
            </div>
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full min-w-0 flex-shrink cursor-pointer active:scale-95 transition-transform hover:bg-indigo-500/20"
            >
              <span className="text-xs font-black text-indigo-400 uppercase tracking-tighter whitespace-nowrap block truncate">
                {formatDate(billingPeriod.start)} 〜 {formatDate(billingPeriod.end)}
              </span>
            </button>
          </div>
          
          <div className="flex justify-between items-end gap-2 w-full">
            <div className="flex-1 min-w-0 flex items-baseline text-white font-black tracking-tighter leading-none overflow-hidden">
              <span className="text-[clamp(1.8rem,8vw,2.5rem)] mr-1 flex-shrink-0">¥</span>
              <span className="text-[clamp(2.5rem,12vw,4rem)] min-w-0 truncate">
                {Math.round(stats.totalSales).toLocaleString()}
              </span>
            </div>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              className="text-right flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            >
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 whitespace-nowrap">残り出勤</p>
              <p className="text-[clamp(1.8rem,8vw,2.5rem)] font-black text-amber-500 leading-none whitespace-nowrap">
                {remainingDutyDays} <span className="text-lg font-bold">日</span>
              </p>
            </button>
          </div>

          <div 
            className="bg-gray-800 rounded-2xl p-4 border-2 border-blue-500 flex justify-between items-center shadow-inner gap-3 cursor-pointer active:scale-95 transition-transform hover:border-blue-400"
            onClick={() => setIsRequiredSalesModalOpen(true)}
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 whitespace-nowrap">必要売上 (1日あたり)</p>
              <p className="text-[clamp(1.6rem,8vw,2.2rem)] font-black text-white leading-none truncate">
                {formatCurrency(requiredPerDay)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-500/10 flex-shrink-0" />
          </div>

          <div className="space-y-3">
            <NeonProgressBar progress={(stats.totalSales / (stats.monthlyGoal || 1)) * 100} color="blue" />
            <div onClick={() => { setNewMonthlyGoal(stats.monthlyGoal.toLocaleString()); setIsGoalEditOpen(true); }} className="flex justify-between items-center text-base font-black text-gray-400 cursor-pointer active:scale-95 gap-3">
              <span className="whitespace-nowrap">{Math.round((stats.totalSales / (stats.monthlyGoal || 1)) * 100)}% 達成</span>
              <span className="flex items-center gap-1 uppercase underline underline-offset-4 decoration-amber-500/50 decoration-2 truncate min-w-0 justify-end">
                <span className="truncate">目標 {formatCurrency(stats.monthlyGoal)}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {!shift && <ColleagueStatusList followingUsers={stats.followingUsers || []} />}

      {isGoalEditOpen && (
        <ModalWrapper onClose={() => setIsGoalEditOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
            <h3 className="text-xl font-black text-white">月間目標を変更</h3>
            <div className="bg-gray-800 p-5 rounded-2xl border-2 border-blue-500 flex items-center shadow-inner">
              <span className="text-blue-400 font-black mr-2 text-3xl">¥</span>
              <input type="text" inputMode="numeric" value={newMonthlyGoal} onChange={(e) => setNewMonthlyGoal(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.2rem,10vw,3.5rem)] font-black w-full outline-none" autoFocus />
            </div>
            <button onClick={() => { onUpdateGoal(fromCommaSeparated(newMonthlyGoal)); setIsGoalEditOpen(false); }} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-transform">保存</button>
          </div>
        </ModalWrapper>
      )}

      {isShiftGoalEditOpen && (
        <ModalWrapper onClose={() => setIsShiftGoalEditOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
            <h3 className="text-xl font-black text-white">本日の目標を変更</h3>
            <div className="bg-gray-900 p-5 rounded-2xl border-2 border-gray-700 flex items-center shadow-inner">
              <span className="text-amber-500 font-black mr-2 text-3xl">¥</span>
              <input type="text" inputMode="numeric" value={newShiftGoal} onChange={(e) => setNewShiftGoal(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.2rem,10vw,3.5rem)] font-black w-full outline-none" autoFocus />
            </div>
            <button onClick={() => { onUpdateShiftGoal(fromCommaSeparated(newShiftGoal)); setIsShiftGoalEditOpen(false); }} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform">保存</button>
          </div>
        </ModalWrapper>
      )}

      {isRequiredSalesModalOpen && (
        <ModalWrapper onClose={() => setIsRequiredSalesModalOpen(false)}>
          <div className="space-y-6 pb-4">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="bg-amber-500/10 p-4 rounded-full">
                  <Target className="w-12 h-12 text-amber-500" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">売上分析</h3>
              <p className="text-sm text-gray-400 font-bold">現時点での売上状況</p>
            </div>

            <div className="space-y-4">
              {/* 予想月間売上 */}
              <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl p-5 border-2 border-blue-500/50 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-6 h-6 text-blue-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">予想月間売上</p>
                </div>
                <div className="flex items-baseline text-white font-black leading-none">
                  <span className="text-2xl mr-1 text-blue-400">¥</span>
                  <span className="text-[clamp(2rem,10vw,3rem)]">
                    {Math.round(estimatedMonthlySales).toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-bold mt-2 leading-tight">
                  現時点までの総売上 ÷ 出勤日数 × 出勤予定日数
                </p>
              </div>

              {/* 現時点での１日辺りの平均売上（日売り） */}
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-5 border-2 border-amber-500/50 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-6 h-6 text-amber-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">現時点での平均売上（日売り）</p>
                </div>
                <div className="flex items-baseline text-white font-black leading-none">
                  <span className="text-2xl mr-1 text-amber-400">¥</span>
                  <span className="text-[clamp(2rem,10vw,3rem)]">
                    {Math.round(averageDailySales).toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-bold mt-2 leading-tight">
                  現時点までの総売上 ÷ 出勤日数
                </p>
              </div>

              {/* 目標達成に必要な１日当りの売上 */}
              <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-2xl p-5 border-2 border-red-500/50 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="w-6 h-6 text-red-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">目標達成に必要な１日あたりの売上</p>
                </div>
                <div className="flex items-baseline text-white font-black leading-none">
                  <span className="text-2xl mr-1 text-red-400">¥</span>
                  <span className="text-[clamp(2rem,10vw,3rem)]">
                    {requiredPerDay > 0 ? Math.round(requiredPerDay).toLocaleString() : '---'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-bold mt-2 leading-tight">
                  （月間目標 - 現時点までの総売上）÷ 残り出勤日数
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsRequiredSalesModalOpen(false)} 
              className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform mt-6"
            >
              閉じる
            </button>
          </div>
        </ModalWrapper>
      )}

{!shift ? (
        // ★変更: relative と overflow-hidden を追加して画像のはみ出し防止と配置基準を作成
        <div className="bg-gray-800 rounded-[32px] p-6 border-2 border-blue-500 text-center space-y-6 shadow-2xl relative overflow-hidden">
          
          {/* ★変更: Zapアイコンを削除し、加工した画像とエフェクトを追加 */}
          <div className="relative w-40 h-40 mx-auto mb-2 animate-floating z-10">
            {/* 背後の発光エフェクト */}
            <div className="absolute inset-0 bg-amber-500 rounded-full blur-[50px] opacity-20 mix-blend-screen animate-pulse"></div>
            
            {/* 画像本体 (インポートした taxiImage を使用) */}
            <img 
              src={taxiImage}
              alt="Taxi" 
              className="w-full h-full object-contain"
              style={{
                // 色抜けの原因となる mixBlendMode と sepia フィルタを削除しました。
                // 元の色を少し鮮やかにし(saturate)、アンバー色の影(drop-shadow)で発光感を足しています。
                filter: 'brightness(1.05) saturate(1.2) drop-shadow(0 0 10px rgba(245, 158, 11, 0.5))'
              }}
            />
          </div>

          <div className="space-y-2 relative z-10">
            <h3 className="text-[clamp(2.2rem,10vw,3rem)] font-black text-white tracking-tight">出庫</h3>
            <p className="text-lg text-gray-500 font-black uppercase tracking-widest">{todayBusinessDate}</p>
          </div>


          <div className="space-y-1">
            <p className="text-[18px] font-black text-gray-500 uppercase tracking-widest text-left pl-1">今日の目標金額</p>
            <div className="flex items-center bg-gray-800 rounded-2xl p-5 border-2 border-blue-500 focus-within:border-blue-400 transition-all shadow-inner">
              <span className="text-amber-500 font-black text-3xl mr-2">¥</span>
              <input type="text" inputMode="numeric" value={goalIn} onChange={(e) => setGoalIn(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.2rem,10vw,3.5rem)] font-black w-full outline-none text-center" />
            </div>
          </div>

          <div className="space-y-1">
             <p className="text-[18px] font-black text-gray-500 uppercase tracking-widest text-left pl-1">開始メーター</p>
             <div className="flex items-center bg-gray-800 rounded-2xl p-5 border-2 border-blue-500 focus-within:border-blue-400 transition-all shadow-inner">
                <Gauge className="text-gray-500 w-8 h-8 mr-3" />
                <input 
                    type="number" 
                    inputMode="numeric" 
                    value={startOdoIn} 
                    onChange={(e) => setStartOdoIn(e.target.value)} 
                    placeholder="開始ODO"
                    className="bg-transparent text-white text-[clamp(1.5rem,8vw,2.5rem)] font-black w-full outline-none text-center placeholder-gray-700" 
                />
                <span className="text-gray-500 font-bold ml-2">km</span>
             </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-[18px] font-black text-gray-400 uppercase tracking-widest">予定営業時間の選択</p>
            <div className="grid grid-cols-4 gap-3">
              {[8, 10, 12, 14].map(h => (
                <button
                  key={h}
                  onClick={() => setPlannedHours(h)}
                  className={`py-3 rounded-xl font-black text-xl border-2 transition-all ${
                    plannedHours === h ? 'bg-amber-500 border-amber-400 text-black' : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
            
            <div className="relative">
              <select 
                value={plannedHours} 
                onChange={(e) => setPlannedHours(parseInt(e.target.value))}
                className="w-full bg-gray-800 border-2 border-blue-500 rounded-2xl p-4 text-white text-lg font-black appearance-none focus:border-blue-400 outline-none"
              >
                {hoursOptions.map(h => (
                  <option key={h} value={h}>{h} 時間</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-2xl flex items-center justify-between border-2 border-blue-500">
               <span className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">予想終了時刻</span>
               <span className="text-xl font-black text-white">{formatTime(Date.now() + plannedHours * 3600000)}</span>
            </div>
          </div>

          <button onClick={handleStartShift} className="w-full bg-[#EAB308] text-black py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform">営 業 開 始</button>
        </div>
      ) : (
        <div className="space-y-5 w-full">
          <div className="bg-gray-800 rounded-[28px] p-5 border-2 border-blue-500 shadow-2xl w-full">
            <div className="flex justify-between items-start mb-5 gap-3">
              <div 
                className="flex flex-col min-w-0 cursor-pointer active:opacity-70 transition-opacity"
                onClick={onShiftEdit}
              >
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-lg font-black text-gray-400 uppercase flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-[0_0_12px_#22C55E]" /> 営業中
                  </span>
                  <span className="text-base font-bold text-white/90 font-mono underline decoration-dotted decoration-gray-600 underline-offset-4">
                    {elapsedTimeStr}
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-bold mt-1 tracking-widest uppercase truncate">
                  {todayBusinessDate} (〜{estimatedEndTime ? formatTime(estimatedEndTime) : ''})
                </span>
              </div>
              <button onClick={onEnd} className="bg-red-500/10 text-red-500 text-sm font-black py-2.5 px-5 rounded-full border border-red-500/30 active:scale-95 shadow-sm whitespace-nowrap flex-shrink-0">終了</button>
            </div>
            
            <div className="mb-6">
              <div className="flex items-baseline text-white font-black tracking-tighter leading-none min-w-0 w-full overflow-hidden">
                <span className="text-[clamp(2.2rem,8vw,3rem)] mr-1 text-amber-500 font-black flex-shrink-0">¥</span>
                <span className="text-[clamp(3.5rem,12vw,5.5rem)] min-w-0 truncate">
                  {dailyTotal.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 text-lg font-black text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2 overflow-hidden min-w-0">
                    <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 font-black uppercase tracking-tighter whitespace-nowrap flex-shrink-0">税抜合計</span> 
                    <span className="truncate">{formatCurrency(dailyNet)}</span>
                </span>

                <span className="flex items-center gap-2 overflow-hidden min-w-0">
                    <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 font-black uppercase tracking-tighter whitespace-nowrap flex-shrink-0">基準値</span> 
                    <span className={`truncate font-black ${referenceValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {referenceValue >= 0 ? '+' : ''}{Math.round(referenceValue).toLocaleString()}
                    </span>
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <NeonProgressBar progress={dailyProgress} color="amber" />
              <div onClick={() => { setNewShiftGoal(shift.dailyGoal.toLocaleString()); setIsShiftGoalEditOpen(true); }} className="flex justify-between items-center text-sm font-black text-gray-500 active:scale-95 gap-3">
                <span className="whitespace-nowrap flex-shrink-0">{Math.round(dailyProgress)}% 達成</span>
                <span className="flex items-center gap-1 uppercase underline decoration-amber-500/50 decoration-2 underline-offset-4 truncate min-w-0 justify-end">
                  <span className="truncate">今日の目標 {formatCurrency(shift.dailyGoal)}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
              <div className="bg-gray-800 rounded-2xl p-3 flex flex-col items-center justify-center border-2 border-blue-400 shadow-inner min-h-[110px]">
                <Timer className="w-6 h-6 text-blue-400 mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest whitespace-nowrap">時間あたりの売上</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">¥{Math.round(hourlySales).toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-3 flex flex-col items-center justify-center border-2 border-amber-400 shadow-inner min-h-[110px]">
                <ClipboardList className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest whitespace-nowrap">乗車回数</p>
                <p className="text-[clamp(1.8rem,7vw,2.5rem)] font-black text-white leading-none whitespace-nowrap">
                  {shiftRecords.length}<span className="text-sm font-bold text-gray-400 ml-1">回</span>
                </p>
              </div>
              <div 
                className="bg-gray-800 rounded-2xl p-3 flex flex-col items-center justify-center border-2 border-red-500 shadow-inner min-h-[110px] cursor-pointer active:scale-95 transition-transform hover:border-red-400"
                onClick={() => setIsRequiredSalesModalOpen(true)}
              >
                <CalendarDays className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest whitespace-nowrap">月間必要 / 日</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">
                  {requiredPerDay > 0 ? `¥${Math.round(requiredPerDay).toLocaleString()}` : '---'}
                </p>
              </div>
              <div 
                className="bg-gray-800 rounded-2xl p-3 flex flex-col items-center justify-center border-2 border-red-500 shadow-inner min-h-[110px] cursor-pointer active:bg-gray-700 transition-colors"
                onClick={() => { setNewShiftGoal(shift.dailyGoal.toLocaleString()); setIsShiftGoalEditOpen(true); }}
              >
                <Target className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest whitespace-nowrap">目標まで残り</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">¥{remainingToGoal.toLocaleString()}</p>
              </div>
            </div>

            {breakState.isActive ? (
              <div className="bg-gray-800 rounded-2xl p-5 border-2 border-blue-500 shadow-2xl mb-4 animate-in fade-in">
                <div className="flex flex-col items-center mb-5">
                  <span className="text-indigo-400 font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-2">
                    <Coffee className="w-5 h-5 animate-bounce" /> 休憩中
                  </span>
                  <span className="text-5xl font-black text-white font-mono tracking-wider">
                    {formatDuration(breakDurationMs)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleStopBreakAndRide}
                    className="bg-green-600 text-white py-4 rounded-xl font-black text-sm active:scale-95 shadow-lg flex flex-col items-center justify-center gap-1 leading-none"
                  >
                    <Play className="w-6 h-6" />
                    乗車記録へ (待機)
                  </button>
                  <button 
                    onClick={handleStopBreakAndRegister}
                    className="bg-gray-800 text-gray-300 py-4 rounded-xl font-black text-sm active:scale-95 shadow-lg border border-gray-700 flex flex-col items-center justify-center gap-1 leading-none"
                  >
                    <StopCircle className="w-6 h-6 text-gray-500" />
                    休憩登録 (売上なし)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 h-20">
                <button 
                  onClick={onToggleBreak}
                  className="w-1/3 bg-gray-800 text-indigo-300 rounded-[24px] flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 transition-transform border-2 border-indigo-300"
                >
                  <Coffee className="w-6 h-6" />
                  <span className="text-xs font-black uppercase tracking-widest">休憩</span>
                </button>
                <button 
                  onClick={() => onAdd()} 
                  className="flex-1 bg-[#EAB308] text-black rounded-[24px] font-black text-2xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform"
                >
                  <Play className="w-8 h-8" /> 乗車記録
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 w-full">
            <ColleagueStatusList followingUsers={stats.followingUsers || []} />

            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-black px-2 text-white flex justify-between items-center tracking-tight italic uppercase flex-wrap gap-2">
                <span className="whitespace-nowrap">今回の履歴</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsSlim(!isSlim)} 
                    className={`text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border transition-all whitespace-nowrap ${isSlim ? 'bg-amber-500 text-black border-amber-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                  >
                    スリム
                  </button>
                  <button 
                    onClick={() => setIsDetailed(!isDetailed)} 
                    className={`text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border transition-all whitespace-nowrap ${isDetailed ? 'bg-amber-500 text-black border-amber-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                  >
                    <LayoutList className="w-3.5 h-3.5" /> 詳細
                  </button>
                  <button onClick={() => setIsHistoryReversed(!isHistoryReversed)} className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border border-gray-700 whitespace-nowrap">
                    <ArrowUpDown className="w-3.5 h-3.5" /> {isHistoryReversed ? '新しい順' : '古い順'}
                  </button>
                </div>
              </h3>
            </div>

            {isSlim ? (
              <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-orange-500 text-white">
                      <th className="py-2 px-1 border-r border-orange-600 text-center text-base font-black w-[40px]">回数</th>
                      <th className="py-2 px-1 border-r border-orange-600 text-center text-base font-black w-[85px]">時刻</th>
                      <th className="py-2 px-2 border-r border-orange-600 text-center text-base font-black flex-1">乗車地/降車地</th>
                      <th className="py-2 px-1 text-center text-base font-black w-[75px]">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400 font-black uppercase tracking-widest text-sm">
                          記録がありません
                        </td>
                      </tr>
                    ) : (
                      sortedRecords.map((r, idx) => {
                        const displayIdx = isHistoryReversed ? shiftRecords.length - idx : idx + 1;
                        return (
                          <SalesRecordCard 
                            key={r.id}
                            record={r} 
                            index={displayIdx} 
                            isDetailed={isDetailed} 
                            isSlim={isSlim}
                            customLabels={stats.customPaymentLabels || {}} 
                            businessStartHour={stats.businessStartHour}
                            onClick={() => onEdit(r)}
                          />
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3 w-full">
                {sortedRecords.length === 0 ? (
                  <div className="bg-gray-800 p-8 rounded-[28px] border-2 border-blue-500 text-center text-gray-600 font-black uppercase tracking-widest text-sm">記録がありません</div>
                ) : (
                  sortedRecords.map((r, idx) => {
                    const displayIdx = isHistoryReversed ? shiftRecords.length - idx : idx + 1;
                    return (
                      <div key={r.id} className="relative">
                        {/* ★追加: 一時保存（金額0）の場合のバッジ表示 */}
                        {r.amount === 0 && (
                          <div className="absolute -top-2 -right-1 z-10">
                            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg border border-red-400 animate-pulse">
                              一時保存中
                            </span>
                          </div>
                        )}
                        
                        {/* ★追加: 一時保存の場合は赤い枠線で強調 */}
                        <div className={r.amount === 0 ? "ring-2 ring-red-500 ring-offset-2 ring-offset-[#0A0E14] rounded-[24px]" : ""}>
                          <SalesRecordCard 
                            record={r} 
                            index={displayIdx} 
                            isDetailed={isDetailed} 
                            isSlim={isSlim}
                            customLabels={stats.customPaymentLabels || {}} 
                            businessStartHour={stats.businessStartHour}
                            onClick={() => onEdit(r)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {shiftRecords.length > 0 && (
                <div className="mt-4">
                    <PaymentBreakdownList 
                      breakdown={currentShiftBreakdown} 
                      counts={currentShiftCounts}
                      customLabels={stats.customPaymentLabels || {}} 
                      enabledMethods={stats.enabledPaymentMethods}
                    />
                </div>
            )}
          </div>
        </div>
      )}

      {/* 出勤予定日カレンダーポップアップ */}
      {isCalendarOpen && (
        <ModalWrapper onClose={() => {
          // 閉じる時に変更を保存
          if (onUpdateStats) {
            onUpdateStats({ dutyDays: calendarDutyDays });
          }
          setIsCalendarOpen(false);
        }}>
          <div className="bg-gray-800 p-5 rounded-3xl border-2 border-blue-500 shadow-inner w-full max-w-md">
            <div className="flex flex-col mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <CalendarDays className="w-6 h-6 text-yellow-500" /> 出勤予定日を選択してください
                </h3>
                <button
                  onClick={() => {
                    if (onUpdateStats) {
                      onUpdateStats({ dutyDays: calendarDutyDays });
                    }
                    setIsCalendarOpen(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {/* 選択した日数を簡易モードと同じ形式で表示 */}
              <div className="mt-4 bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
                <div className="text-sm text-gray-400 mb-1">選択した日数</div>
                <div className="text-2xl font-black text-white">{dutyCountInView} 日</div>
              </div>
              <div className="mt-4 flex items-center justify-between bg-gray-950 rounded-2xl p-2 border-2 border-gray-700">
                <button 
                  onClick={() => {
                    const sDay = parseInt(shimebiDay.toString());
                    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
                    const { start: currentStart } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
                    const prevMonth = new Date(currentStart);
                    prevMonth.setMonth(prevMonth.getMonth() - 1);
                    const { start: prevStart } = getBillingPeriod(prevMonth, effectiveShimebi, businessStartHour);
                    setCalendarViewDate(prevStart);
                  }} 
                  className="p-3 text-gray-400 active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-xl font-black text-white">{displayScheduleMonth}</span>
                <button 
                  onClick={() => {
                    const sDay = parseInt(shimebiDay.toString());
                    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
                    const { start: currentStart } = getBillingPeriod(calendarViewDate, effectiveShimebi, businessStartHour);
                    const nextMonth = new Date(currentStart);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const { start: nextStart } = getBillingPeriod(nextMonth, effectiveShimebi, businessStartHour);
                    setCalendarViewDate(nextStart);
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
                const dateWithBusinessHour = new Date(date);
                dateWithBusinessHour.setHours(businessStartHour, 0, 0, 0);
                const businessDateStr = getBusinessDate(dateWithBusinessHour.getTime(), businessStartHour);
                
                const dateStr = formatDate(date);
                const isDuty = calendarDutyDays.includes(businessDateStr);
                const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
                const isToday = businessDateStr === todayBusinessDate;
                const isPast = businessDateStr < todayBusinessDate;
                const hasSales = hasSalesData[businessDateStr] || false;
                
                const isLocked = isPast && hasSales;
                const isSelectable = !isPast || !hasSales;
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => toggleDutyDay(businessDateStr)}
                    disabled={isLocked}
                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                      isPast && hasSales
                        ? 'bg-yellow-500 text-gray-900 font-black cursor-not-allowed'
                        : isPast && !hasSales
                        ? 'bg-gray-800/50 text-gray-500'
                        : isDuty
                        ? 'bg-orange-500 text-gray-900 font-black'
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
        </ModalWrapper>
      )}
    </div>
  );
};

export default Dashboard;
