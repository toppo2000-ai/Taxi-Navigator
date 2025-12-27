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
  Globe, 
  Lock, 
  ShieldCheck,
  Users
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Shift, MonthlyStats, SalesRecord, BreakState } from '@/types';
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
  getPaymentCounts
} from '@/utils';
import { SalesRecordCard } from '@/components/common/SalesRecordCard';
import { PaymentBreakdownList } from '@/components/common/PaymentBreakdownList';
import { ModalWrapper } from '@/components/common/Modals';
import { FullScreenClock } from '@/components/common/FullScreenClock';
import { NeonProgressBar } from '@/components/common/NeonProgressBar';
import { ColleagueStatusList } from '@/components/dashboard/ColleagueStatusList';

// ========== 定数 ==========
// 管理者メールアドレスリスト（全機能アクセス権限）
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// ========== Props インターフェース ==========
// Dashboard コンポーネントのプロパティ定義
interface DashboardProps { 
  shift: Shift | null;                                    // 現在のシフト情報（null の場合はシフト前）
  stats: MonthlyStats;                                    // 月間統計情報（目標、売上、出勤日など）
  breakState: BreakState;                                 // 休憩状態（休憩中かどうか、開始時刻）
  onStart: (goal: number, hours: number) => void;         // シフト開始時のコールバック（目標金額と予定時間）
  onEnd: () => void;                                      // シフト終了時のコールバック
  onAdd: (initialRemarks?: string) => void;               // 乗車記録追加のコールバック（初期備考オプション）
  onEdit: (record: SalesRecord) => void;                  // 乗車記録編集のコールバック
  onUpdateGoal: (newGoal: number) => void;                // 月間目標更新のコールバック
  onUpdateShiftGoal: (newGoal: number) => void;           // 本日の目標更新のコールバック
  onAddRestMinutes: (minutes: number) => void;            // 休憩時間追加のコールバック（分単位）
  onToggleBreak: () => void;                              // 休憩開始/終了トグルのコールバック
  setBreakState: (state: BreakState) => void;             // 休憩状態直接設定のコールバック
  onShiftEdit: () => void;                                // シフト情報編集のコールバック
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
  onShiftEdit
}) => {
  // ========== 認証 ==========
  const { user } = useAuth();  // 現在のログインユーザー情報

  // ========== State管理 ==========
  // シフト開始時の入力値
  const [goalIn, setGoalIn] = useState(stats.defaultDailyGoal.toLocaleString());  // 目標金額（カンマ区切り文字列）
  const [plannedHours, setPlannedHours] = useState(12);  // 予定営業時間（デフォルト12時間）

  // モーダル表示制御
  const [isGoalEditOpen, setIsGoalEditOpen] = useState(false);  // 月間目標編集モーダル
  const [isShiftGoalEditOpen, setIsShiftGoalEditOpen] = useState(false);  // 本日の目標編集モーダル
  const [isClockOpen, setIsClockOpen] = useState(false);  // 全画面時計モーダル

  // 目標編集用の一時入力値
  const [newMonthlyGoal, setNewMonthlyGoal] = useState(stats.monthlyGoal.toLocaleString());  // 月間目標（編集中）
  const [newShiftGoal, setNewShiftGoal] = useState(shift?.dailyGoal.toLocaleString() || stats.defaultDailyGoal.toLocaleString());  // 本日の目標（編集中）

  // 履歴表示制御
  const [isHistoryReversed, setIsHistoryReversed] = useState(true);  // 履歴を新しい順に表示するか
  const [isDetailed, setIsDetailed] = useState(false);  // 履歴を詳細表示するか

  // 時刻管理
  const [now, setNow] = useState(Date.now());  // 現在時刻（1秒ごとに更新）

  // 休憩タイマー管理
  const [breakDurationMs, setBreakDurationMs] = useState(0);  // 休憩経過時間（ミリ秒）
  const breakIntervalRef = useRef<number | null>(null);  // 休憩タイマーのインターバルID

  // ========== Effects ==========
  // 現在時刻を1秒ごとに更新
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // シフト終了時に目標金額入力をリセット
  useEffect(() => {
    if (!shift) {
      setGoalIn(stats.defaultDailyGoal.toLocaleString());
    }
  }, [stats.defaultDailyGoal, shift]);

  // 休憩タイマーの管理（休憩中は1秒ごとに経過時間を更新）
  useEffect(() => {
    if (breakState.isActive && breakState.startTime) {
      // 初回の経過時間を設定
      setBreakDurationMs(Date.now() - breakState.startTime);
      // 1秒ごとに経過時間を更新
      breakIntervalRef.current = window.setInterval(() => {
        if (breakState.startTime) {
          setBreakDurationMs(Date.now() - breakState.startTime);
        }
      }, 1000);
    } else {
      // 休憩終了時はタイマーをクリア
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
      }
      setBreakDurationMs(0);
    }
    return () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    };
  }, [breakState]);

  // ========== イベントハンドラー ==========
  // 休憩を終了して休憩時間を登録（売上記録なし）
  const handleStopBreakAndRegister = () => {
    const minutes = Math.floor(breakDurationMs / 60000);  // ミリ秒を分に変換
    if (minutes > 0) {
      onAddRestMinutes(minutes);  // 休憩時間を記録
    }
    setBreakState({ isActive: false, startTime: null });  // 休憩状態をリセット
  };

  // 休憩を終了して乗車記録を追加（待機時間を備考に記入）
  const handleStopBreakAndRide = () => {
    const minutes = Math.floor(breakDurationMs / 60000);  // ミリ秒を分に変換
    setBreakState({ isActive: false, startTime: null });  // 休憩状態をリセット
    onAdd(`待機時間: ${minutes}分`);  // 待機時間を備考に入れて乗車記録へ
  };

  // ミリ秒を HH:MM:SS 形式にフォーマット
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ========== 計算ロジック（useMemo で最適化） ==========
  // シフト中の乗車記録一覧
  const shiftRecords = useMemo(() => shift?.records || [], [shift]);
  
  // 本日の売上合計（税込）
  const dailyTotal = useMemo(() => shiftRecords.reduce((s: number, r: SalesRecord) => s + r.amount, 0), [shiftRecords]);
  
  // 本日の売上合計（税抜）
  const dailyNet = useMemo(() => calculateNetTotal(dailyTotal), [dailyTotal]);
  
  // 支払方法別の売上内訳
  const currentShiftBreakdown = useMemo(() => getPaymentBreakdown(shiftRecords), [shiftRecords]);
  
  // 支払方法別の件数
  const currentShiftCounts = useMemo(() => getPaymentCounts(shiftRecords), [shiftRecords]);

  // シフト開始からの経過時間（分単位）
  const elapsedMinutes = useMemo(() => {
    if (!shift) return 0;
    return (now - shift.startTime) / 60000;
  }, [shift, now]);

  // シフト開始からの経過時間（文字列表示用）
  const elapsedTimeStr = useMemo(() => {
    if (!shift) return "";
    const diff = now - shift.startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  }, [shift, now]);

  // 時間あたりの売上（1時間あたり何円稼いでいるか）
  const hourlySales = useMemo(() => {
    if (elapsedMinutes <= 0) return 0;
    return (dailyTotal / elapsedMinutes) * 60;  // 分単位を時間単位に変換
  }, [dailyTotal, elapsedMinutes]);

  // 目標まで残り（あと何円必要か）
  const remainingToGoal = useMemo(() => {
    if (!shift) return 0;
    return Math.max(0, shift.dailyGoal - dailyTotal);
  }, [shift, dailyTotal]);

  // 基準値（予定営業時間に対する進捗の過不足）
  // プラス：予定より進んでいる、マイナス：予定より遅れている
  const referenceValue = useMemo(() => {
    if (!shift || !shift.plannedHours || shift.plannedHours === 0) return 0;
    const currentElapsedHours = (now - shift.startTime) / (1000 * 60 * 60);  // 現在の経過時間
    const hourlyTarget = shift.dailyGoal / shift.plannedHours;  // 1時間あたりの目標売上
    const idealCurrentSales = hourlyTarget * currentElapsedHours;  // この時点での理想的な売上
    return dailyTotal - idealCurrentSales;  // 実際の売上との差
  }, [shift, now, dailyTotal]);

  // 本日の目標達成率（%）
  const dailyProgress = shift ? (dailyTotal / (shift.dailyGoal || 1)) * 100 : 0;
  
  // 履歴表示用にソートされた乗車記録（新しい順/古い順）
  const sortedRecords = useMemo(() => isHistoryReversed ? [...shiftRecords].reverse() : [...shiftRecords], [shiftRecords, isHistoryReversed]);
  
  // 請求期間（締日から次の締日まで）
  const billingPeriod = useMemo(() => getBillingPeriod(new Date(), stats.shimebiDay, stats.businessStartHour), [stats.shimebiDay, stats.businessStartHour]);
  
  // 本日の営業日付（業務開始時刻基準）
  const todayBusinessDate = getBusinessDate(Date.now(), stats.businessStartHour);

  // 今期の残り出勤日数
  const remainingDutyDays = useMemo(() => {
    if (!stats.dutyDays) return 0;
    return stats.dutyDays.filter((dStr: string) => dStr >= todayBusinessDate && dStr <= formatDate(billingPeriod.end)).length;
  }, [stats.dutyDays, todayBusinessDate, billingPeriod.end]);

  // 1日あたりに必要な売上（月間目標達成のため）
  const requiredPerDay = useMemo(() => {
    const remainingGoal = Math.max(0, stats.monthlyGoal - stats.totalSales);  // 残りの目標金額
    return remainingDutyDays <= 0 ? 0 : remainingGoal / remainingDutyDays;  // 残り出勤日で割る
  }, [stats.monthlyGoal, stats.totalSales, remainingDutyDays]);

  // 予想終了時刻（シフト開始時刻 + 予定営業時間）
  const estimatedEndTime = useMemo(() => {
    if (!shift) return null;
    return shift.startTime + (shift.plannedHours * 3600000);  // ミリ秒に変換
  }, [shift]);

  // 予定営業時間の選択肢（4時間〜24時間）
  const hoursOptions = Array.from({ length: 21 }, (_, i) => i + 4);

  // ========== コンポーネント ==========
  // プライバシーバッジ：ユーザーの権限・公開設定を表示
  const PrivacyBadge = () => {
    const currentUserEmail = user?.email || "";
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

    // 管理者の場合
    if (isAdmin) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.2)]">
          <ShieldCheck size={12} />
          <span>管理者</span>
        </div>
      );
    }

    // 一般ユーザーの公開設定に応じてバッジを表示
    const mode = stats.visibilityMode || 'PUBLIC';
    
    // 公開中
    if (mode === 'PUBLIC') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-[10px] font-black text-green-400 uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.2)]">
          <Globe size={12} />
          <span>公開中</span>
        </div>
      );
    }
    // 非公開
    if (mode === 'PRIVATE') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[10px] font-black text-red-400 uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">
          <Lock size={12} />
          <span>非公開</span>
        </div>
      );
    }
    // 限定公開（カスタム）
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

  // ========== JSX レンダリング ==========
  return (
    <div className="p-4 pb-32 space-y-5 w-full max-w-full overflow-hidden">
      
      {/* 全画面時計モーダル（ポータル表示） */}
      {isClockOpen && createPortal(<FullScreenClock onClose={() => setIsClockOpen(false)} />, document.body)}

      {/* シフト中の場合：現在時刻とプライバシーバッジを表示 */}
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
          <PrivacyBadge />
        </div>
      )}

      {/* シフト前の場合：月間売上状況を表示 */}
      {!shift && (
        <div className="bg-[#1A222C] rounded-[28px] px-5 py-6 border border-gray-800 shadow-2xl animate-in fade-in duration-300 space-y-6 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-black tracking-widest uppercase text-gray-400 whitespace-nowrap">売上状況</span>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full min-w-0 flex-shrink">
              <span className="text-xs font-black text-indigo-400 uppercase tracking-tighter whitespace-nowrap block truncate">
                {formatDate(billingPeriod.start)} 〜 {formatDate(billingPeriod.end)}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-end gap-2 w-full">
            <div className="flex-1 min-w-0 flex items-baseline text-white font-black tracking-tighter leading-none overflow-hidden">
              <span className="text-[clamp(1.8rem,8vw,2.5rem)] mr-1 flex-shrink-0">¥</span>
              <span className="text-[clamp(2.5rem,12vw,4rem)] min-w-0 truncate">
                {Math.round(stats.totalSales).toLocaleString()}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 whitespace-nowrap">残り出勤</p>
              <p className="text-[clamp(1.8rem,8vw,2.5rem)] font-black text-amber-500 leading-none whitespace-nowrap">
                {remainingDutyDays} <span className="text-lg font-bold">日</span>
              </p>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800 flex justify-between items-center shadow-inner gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 whitespace-nowrap">必要売上 (1日当り)</p>
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

      {/* シフト前の場合：同僚の稼働状況リストを表示 */}
      {!shift && <ColleagueStatusList followingUsers={stats.followingUsers || []} />}

      {/* 月間目標編集モーダル */}
      {isGoalEditOpen && (
        <ModalWrapper onClose={() => setIsGoalEditOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
            <h3 className="text-xl font-black text-white">月間目標を変更</h3>
            <div className="bg-gray-950 p-5 rounded-2xl border-2 border-gray-700 flex items-center shadow-inner">
              <span className="text-blue-400 font-black mr-2 text-3xl">¥</span>
              <input type="text" inputMode="numeric" value={newMonthlyGoal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonthlyGoal(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.2rem,10vw,3.5rem)] font-black w-full outline-none" autoFocus />
            </div>
            <button onClick={() => { onUpdateGoal(fromCommaSeparated(newMonthlyGoal)); setIsGoalEditOpen(false); }} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-transform">保存</button>
          </div>
        </ModalWrapper>
      )}

      {/* 本日の目標編集モーダル */}
      {isShiftGoalEditOpen && (
        <ModalWrapper onClose={() => setIsShiftGoalEditOpen(false)}>
          <div className="space-y-6 pb-4 text-center">
            <h3 className="text-xl font-black text-white">本日の目標を変更</h3>
            <div className="bg-gray-950 p-5 rounded-2xl border-2 border-gray-700 flex items-center shadow-inner">
              <span className="text-amber-500 font-black mr-2 text-3xl">¥</span>
              <input type="text" inputMode="numeric" value={newShiftGoal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewShiftGoal(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.2rem,10vw,3.5rem)] font-black w-full outline-none" autoFocus />
            </div>
            <button onClick={() => { onUpdateShiftGoal(fromCommaSeparated(newShiftGoal)); setIsShiftGoalEditOpen(false); }} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform">保存</button>
          </div>
        </ModalWrapper>
      )}

      {/* ========== シフト前/シフト中の画面切り替え ========== */}
      {!shift ? (
        /* シフト前：出庫画面 */
        <div className="bg-[#1A222C] rounded-[32px] p-6 border border-gray-800 text-center space-y-6 shadow-2xl">
          <Zap className="text-amber-500 w-16 h-16 mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-[clamp(2.2rem,10vw,3rem)] font-black text-white tracking-tight">出庫</h3>
            <p className="text-lg text-gray-500 font-black uppercase tracking-widest">{todayBusinessDate}</p>
          </div>
          <div className="flex items-center bg-gray-950 rounded-2xl p-5 border-2 border-gray-700 focus-within:border-amber-500 transition-all shadow-inner">
            <span className="text-amber-500 font-black text-4xl mr-2">¥</span>
            <input type="text" inputMode="numeric" value={goalIn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalIn(toCommaSeparated(e.target.value))} className="bg-transparent text-white text-[clamp(2.8rem,12vw,4.5rem)] font-black w-full outline-none text-center" />
          </div>
          
          <div className="space-y-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">予定営業時間の選択</p>
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlannedHours(parseInt(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 text-white text-lg font-black appearance-none focus:border-amber-500 outline-none"
              >
                {hoursOptions.map(h => (
                  <option key={h} value={h}>{h} 時間</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-800">
               <span className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">予想終了時刻</span>
               <span className="text-xl font-black text-white">{formatTime(Date.now() + plannedHours * 3600000)}</span>
            </div>
          </div>

          <button onClick={() => onStart(fromCommaSeparated(goalIn), plannedHours)} className="w-full bg-[#EAB308] text-black py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform">シフト開始</button>
        </div>
      ) : (
        /* シフト中：売上実績と記録管理 */
        <div className="space-y-5 w-full">
          <div className="bg-[#1A222C] rounded-[28px] p-5 border border-gray-800 shadow-2xl w-full">
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
              <div className="bg-gray-950/60 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800/50 shadow-inner min-h-[110px]">
                <Timer className="w-6 h-6 text-blue-400 mb-2" />
                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1 tracking-widest whitespace-nowrap">時間あたりの売上</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">¥{Math.round(hourlySales).toLocaleString()}</p>
              </div>
              <div className="bg-gray-950/60 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800/50 shadow-inner min-h-[110px]">
                <ClipboardList className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1 tracking-widest whitespace-nowrap">乗車回数</p>
                <p className="text-[clamp(1.8rem,7vw,2.5rem)] font-black text-white leading-none whitespace-nowrap">
                  {shiftRecords.length}<span className="text-sm font-bold text-gray-400 ml-1">回</span>
                </p>
              </div>
              <div className="bg-gray-950/60 rounded-2xl p-3 flex flex-col items-center justify-center border border-red-500/20 shadow-inner min-h-[110px]">
                <CalendarDays className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1 tracking-widest whitespace-nowrap">月間必要 / 日</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">
                  {requiredPerDay > 0 ? `¥${Math.round(requiredPerDay).toLocaleString()}` : '---'}
                </p>
              </div>
              <div 
                className="bg-gray-950/60 rounded-2xl p-3 flex flex-col items-center justify-center border border-red-500/20 shadow-inner min-h-[110px] cursor-pointer active:bg-gray-900 transition-colors"
                onClick={() => { setNewShiftGoal(shift.dailyGoal.toLocaleString()); setIsShiftGoalEditOpen(true); }}
              >
                <Target className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1 tracking-widest whitespace-nowrap">目標まで残り</p>
                <p className="text-[clamp(1.4rem,6vw,2rem)] font-black text-white leading-none truncate w-full text-center">¥{remainingToGoal.toLocaleString()}</p>
              </div>
            </div>

            {/* 休憩中/非休憩中の UI 切り替え */}
            {breakState.isActive ? (
              /* 休憩中：休憩タイマーと終了ボタン */
              <div className="bg-gray-900/80 rounded-2xl p-5 border-2 border-indigo-500/50 shadow-2xl mb-4 animate-in fade-in">
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
              /* 非休憩中：休憩開始ボタンと乗車記録ボタン */
              <div className="flex gap-3 h-20">
                <button 
                  onClick={onToggleBreak}
                  className="w-1/3 bg-gray-800 text-indigo-300 rounded-[24px] flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 transition-transform border border-indigo-500/20"
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

          {/* ========== 履歴・記録セクション ========== */}
          <div className="space-y-4 w-full">
            {/* 同僚の稼働状況リスト */}
            <ColleagueStatusList followingUsers={stats.followingUsers || []} />

            {/* 本日の売上履歴ヘッダー */}
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-black px-2 text-white flex justify-between items-center tracking-tight italic uppercase flex-wrap gap-2">
                <span className="whitespace-nowrap">今回の履歴</span>
                <div className="flex gap-2">
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

            {/* 売上記録カード一覧 */}
            <div className="space-y-3 w-full">
              {sortedRecords.length === 0 ? (
                <div className="bg-[#1A222C] p-8 rounded-[28px] border border-gray-800 text-center text-gray-600 font-black uppercase tracking-widest text-sm">記録がありません</div>
              ) : (
                sortedRecords.map((r: SalesRecord, idx: number) => {
                  const displayIdx = isHistoryReversed ? shiftRecords.length - idx : idx + 1;
                  return (
                    <SalesRecordCard 
                      key={r.id}
                      record={r} 
                      index={displayIdx} 
                      isDetailed={isDetailed} 
                      customLabels={stats.customPaymentLabels || {}} 
                      businessStartHour={stats.businessStartHour}
                      onClick={() => onEdit(r)}
                    />
                  );
                })
              )}
            </div>

            {/* 支払方法別の内訳表示 */}
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
    </div>
  );
};

export default Dashboard;
