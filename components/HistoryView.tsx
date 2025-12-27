import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft,
  Target,
  ArrowUpDown,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Coffee,
  Skull,
  Timer,
  Car,
  Wallet,
  Coins,
  CreditCard,
  User as UserIcon,
  Users,
  LayoutList,
  MapPin,
  MapPinned,
  Calendar,
  Database,
  ChevronDown,
  ChevronUp,
  Banknote,
  Smartphone,
  Ticket,
  QrCode,
  Navigation,
  ShieldCheck,
  Trophy,
  Check
} from 'lucide-react';
import { collection, onSnapshot, query, doc, orderBy, limit } from 'firebase/firestore'; 
import { db, auth } from '../firebase'; 
import { SalesRecord, PaymentMethod, DayMetadata, DEFAULT_PAYMENT_ORDER, MonthlyStats, RideType } from '../types';
import { 
  formatBusinessTime,
  formatCurrency, 
  calculateTaxAmount,
  PAYMENT_LABELS, 
  RIDE_LABELS,
  getBusinessDate,
  getPaymentBreakdown,
  getPaymentColorClass,
  getBillingPeriod,
  formatDate,
  getGoogleMapsUrl
} from '../utils';

// 管理者メールアドレス
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// --- Helper Functions ---
export const getPaymentCounts = (records: SalesRecord[]) => {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    counts[r.paymentMethod] = (counts[r.paymentMethod] || 0) + 1;
  });
  return counts;
};

// ヘルパー: 配車かどうか
const isDispatch = (r: SalesRecord) => r.rideType !== 'FLOW' && r.rideType !== 'WAIT';

// --- Shared Components ---

const PaymentIcon: React.FC<{ method: PaymentMethod, className?: string }> = ({ method, className }) => {
  switch (method) {
    case 'CASH': return <Banknote className={className} />;
    case 'CARD': return <CreditCard className={className} />;
    case 'DIDI': return <Smartphone className={className} />;
    case 'TICKET': return <Ticket className={className} />;
    case 'QR': return <QrCode className={className} />;
    default: return <CreditCard className={className} />;
  }
};

// ★完全復元: カラフルで大きな支払い内訳リスト
export const PaymentBreakdownList: React.FC<{
  breakdown: Record<string, number>;
  counts: Record<string, number>;
  customLabels: Record<string, string>;
  enabledMethods?: PaymentMethod[];
}> = ({ breakdown, counts, customLabels, enabledMethods }) => {
  const methodsToList = enabledMethods || DEFAULT_PAYMENT_ORDER;
  
  let nonCashAmountTotal = 0;
  let nonCashCountTotal = 0;
  Object.keys(breakdown).forEach(key => { if (key !== 'CASH') nonCashAmountTotal += breakdown[key]; });
  Object.keys(counts).forEach(key => { if (key !== 'CASH') nonCashCountTotal += counts[key]; });

  const safeCustomLabels = customLabels || {};

  return (
    <div className="space-y-4">
       {/* キャッシュレス計を大きく表示 */}
       {nonCashAmountTotal > 0 && (
         <div className="bg-gradient-to-r from-indigo-900/60 to-blue-900/60 p-4 rounded-2xl border border-indigo-500/30 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/20 rounded-full">
                 <Coins className="w-6 h-6 text-indigo-300" />
               </div>
               <div>
                 <span className="text-xs font-bold text-indigo-200 block uppercase tracking-widest">キャッシュレス計</span>
                 <span className="text-sm font-medium text-indigo-400">{nonCashCountTotal}回</span>
               </div>
            </div>
            <span className="text-3xl font-black text-white tracking-tight">
               {formatCurrency(nonCashAmountTotal)}
            </span>
         </div>
       )}

       <h4 className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest flex items-center gap-2 mt-6">
         <CreditCard className="w-3 h-3" /> 決済別内訳
       </h4>
       
       {/* カラフルなグリッド表示 */}
       <div className="grid grid-cols-2 gap-3">
         {methodsToList.map(method => {
            const amt = breakdown[method] || 0;
            const cnt = counts[method] || 0;
            if (amt === 0 && cnt === 0) return null;
            
            const label = safeCustomLabels[method] || PAYMENT_LABELS[method];
            
            // 各支払い方法ごとの色クラスを取得してスタイルに適用
            const colorClass = getPaymentColorClass(method);
            let bgClass = "bg-gray-900/50 border-gray-800";
            if (colorClass.includes("amber") || colorClass.includes("yellow")) bgClass = "bg-amber-900/20 border-amber-500/30";
            else if (colorClass.includes("blue") || colorClass.includes("sky")) bgClass = "bg-blue-900/20 border-blue-500/30";
            else if (colorClass.includes("green") || colorClass.includes("emerald")) bgClass = "bg-green-900/20 border-green-500/30";
            else if (colorClass.includes("purple") || colorClass.includes("indigo")) bgClass = "bg-purple-900/20 border-purple-500/30";
            else if (colorClass.includes("pink") || colorClass.includes("red")) bgClass = "bg-pink-900/20 border-pink-500/30";

            return (
               <div key={method} className={`${bgClass} p-3 rounded-xl border flex flex-col justify-between shadow-sm`}>
                  <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2">
                        <PaymentIcon method={method} className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-bold opacity-80 truncate max-w-[80px]">
                            {label}
                        </span>
                     </div>
                     <span className="text-xs font-medium opacity-60">
                        {cnt}回
                     </span>
                  </div>
                  <div className="text-right">
                     <span className="text-xl font-black block tracking-tight">
                        {formatCurrency(amt)}
                     </span>
                  </div>
               </div>
            )
         })}
       </div>
    </div>
  );
};

export const SalesRecordCard: React.FC<{ 
  record: SalesRecord; 
  index: number; 
  isDetailed: boolean; 
  customLabels: Record<string, string>;
  businessStartHour: number;
  onClick: () => void;
}> = ({ record, index, isDetailed, customLabels, businessStartHour, onClick }) => {
  const safeCustomLabels = customLabels || {};
  const paymentName = safeCustomLabels[record.paymentMethod] || PAYMENT_LABELS[record.paymentMethod];
  const totalAmount = record.amount + record.toll;
  const passengerStr = `[${record.passengersMale || 0}${record.passengersFemale || 0}]`;

  return (
    <div onClick={onClick} className="bg-[#1A222C] p-5 rounded-[24px] border border-gray-800 active:scale-[0.98] transition-all shadow-md flex flex-col gap-3 w-full relative overflow-hidden group cursor-pointer">
      {record.isBadCustomer && (
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none text-red-500/20">
          <Skull className="w-16 h-16" />
        </div>
      )}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-base font-black text-amber-500 border border-gray-700 shadow-inner">
                    {index}
                </div>
                <span className="text-xl font-black text-gray-300 font-mono tracking-wide">
                    {formatBusinessTime(record.timestamp, businessStartHour)}
                </span>
            </div>
            <div className="ml-11">
                <span className="text-slate-400 text-lg font-black tracking-widest font-mono">
                    {passengerStr}
                </span>
            </div>
        </div>
        <div className="text-right">
          <span className="text-[clamp(2.2rem,10vw,2.8rem)] font-black text-amber-500 leading-none block drop-shadow-md tracking-tighter">
            {formatCurrency(totalAmount)}
          </span>
          {record.toll > 0 && (
            <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/30 inline-block mt-1">
              (高速 {record.toll})
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 my-1 pl-1 border-l-2 border-gray-700 ml-2 py-1">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">{record.pickupLocation || '---'}</span>
            {record.pickupCoords && (
              <a 
                href={getGoogleMapsUrl(record.pickupCoords) || "#"} 
                target="_blank" 
                rel="noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 active:scale-90 ml-2"
              >
                <MapPin size={14} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">{record.dropoffLocation || '---'}</span>
            {record.dropoffCoords && (
              <a 
                href={getGoogleMapsUrl(record.dropoffCoords) || "#"} 
                target="_blank" 
                rel="noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 active:scale-90 ml-2"
              >
                <MapPinned size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border flex-1 text-center whitespace-nowrap ${getPaymentColorClass(record.paymentMethod)}`}>
          {paymentName}
        </span>
        {record.rideType !== 'FLOW' && (
           <span className="text-xs font-black text-gray-300 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 whitespace-nowrap">
             {RIDE_LABELS[record.rideType]}
           </span>
        )}
      </div>
      {isDetailed && record.remarks && (
        <div className="mt-2 pt-3 border-t border-gray-800/50 animate-in slide-in-from-top-2 duration-200">
           <div className="bg-yellow-900/20 p-4 rounded-xl border border-yellow-700/30 flex items-start gap-3">
             <MessageSquare className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
             <p className="text-base font-bold text-yellow-100 whitespace-pre-wrap leading-relaxed">{record.remarks}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export const ReportSummaryView: React.FC<{ 
  records: SalesRecord[], 
  customLabels: Record<string, string>, 
  startTime?: number, 
  endTime?: number,
  totalRestMinutes?: number,
  enabledMethods?: PaymentMethod[]
}> = ({ records, customLabels, startTime, endTime, totalRestMinutes, enabledMethods }) => {
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);
  const taxAmount = calculateTaxAmount(totalAmount);
  const breakdown = getPaymentBreakdown(records);
  const counts = getPaymentCounts(records);
  const cashAmount = breakdown['CASH'] || 0;
  
  const displayStart = startTime || (records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : 0);
  const displayEnd = endTime || (records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : 0);
  const workDurationMs = (displayEnd - displayStart);
  const durationHrs = Math.floor(workDurationMs / 3600000);
  const durationMins = Math.floor((workDurationMs % 3600000) / 60000);
  const durationStr = displayStart && displayEnd ? `${durationHrs}時間${String(durationMins).padStart(2, '0')}分` : '--時間--分';
  const breakH = Math.floor((totalRestMinutes || 0) / 60);
  const breakM = (totalRestMinutes || 0) % 60;
  const breakStr = `${breakH}時間${String(breakM).padStart(2, '0')}分`;
  const maleTotal = records.reduce((s, r) => s + (r.passengersMale || 0), 0);
  const femaleTotal = records.reduce((s, r) => s + (r.passengersFemale || 0), 0);
  const totalPassengers = maleTotal + femaleTotal;

  // customLabelsの安全策
  const safeCustomLabels = customLabels || {};

  return (
    <div className="w-full space-y-6">
      <div className="text-center py-8 bg-[#1A222C] rounded-[32px] border border-gray-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
          <p className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] mb-2 opacity-80">本日の営収 (税込)</p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-6xl font-black text-amber-600/80">¥</span>
            {/* ★修正: 金額のフォントサイズを以前の80%に縮小 */}
            <span className="text-[clamp(4rem,16vw,6.4rem)] font-black text-amber-500 leading-none tracking-tighter drop-shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
              {totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 mb-8">
             <p className="text-xl font-bold text-gray-400">(内消費税 {formatCurrency(taxAmount)})</p>
             <p className="text-xl font-bold text-gray-400">本日の営収(税抜き) {formatCurrency(totalAmount - taxAmount)}</p>
          </div>
          <div className="bg-gray-950/50 mx-6 p-5 rounded-3xl border border-gray-700/50 flex flex-col items-center gap-2 shadow-inner">
              <span className="text-sm text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <Wallet className="w-5 h-5" /> 納金額 (現金)
              </span>
              <span className="text-5xl font-black text-white tracking-tight">{formatCurrency(cashAmount)}</span>
          </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Car className="w-6 h-6 text-blue-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">総回数</span>
             <span className="text-2xl font-black text-white leading-none">{records.length}<span className="text-xs text-gray-600 ml-1">回</span></span>
          </div>
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Timer className="w-6 h-6 text-green-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">稼働時間</span>
             {/* ★修正: 稼働時間のフォントサイズを80%に縮小 */}
             <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{durationStr}</span>
          </div>
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Coffee className="w-6 h-6 text-amber-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">休憩</span>
             {/* ★修正: 休憩時間のフォントサイズを80%に縮小 */}
             <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{breakStr}</span>
          </div>
      </div>
      <div className="bg-gray-900/30 p-6 rounded-[32px] border border-gray-800/50 flex justify-around items-center">
          <div className="text-center">
             <span className="text-sm font-bold text-blue-400 block mb-2 uppercase tracking-widest">男性総数</span>
             <span className="text-4xl font-black text-white">{maleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
          </div>
          <div className="text-center">
             <span className="text-sm font-bold text-pink-400 block mb-2 uppercase tracking-widest">女性総数</span>
             <span className="text-4xl font-black text-white">{femaleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
          </div>
          <div className="w-px h-12 bg-gray-800"></div>
          <div className="text-center">
             <span className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest">総合計人数</span>
             <span className="text-5xl font-black text-white">{totalPassengers}<span className="text-lg text-gray-600 ml-1">名</span></span>
          </div>
      </div>

      {/* ★完全復元: 支払い種別内訳リスト (PaymentBreakdownList) をここに配置 */}
      <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl">
          <PaymentBreakdownList 
              breakdown={breakdown} 
              counts={counts} 
              customLabels={safeCustomLabels} 
              enabledMethods={enabledMethods} 
          />
      </div>
    </div>
  );
};

// --- ★共通コンポーネント: Daily Detail View (日報詳細) ---
export const DailyDetailView: React.FC<{
  date: string,
  records: SalesRecord[],
  meta: DayMetadata,
  customLabels: Record<string, string>,
  businessStartHour: number,
  onBack: () => void,
  isMe: boolean, 
  onUpdateMetadata?: (date: string, meta: Partial<DayMetadata>) => void,
  onEditRecord?: (rec: SalesRecord) => void
}> = ({ date, records, meta, customLabels, businessStartHour, onBack, isMe, onUpdateMetadata, onEditRecord }) => {
  const [isDetailed, setIsDetailed] = useState(false);
  const [isDetailReversed, setIsDetailReversed] = useState(true);

  const sortedRecords = isDetailReversed 
    ? [...records].sort((a,b)=>b.timestamp-a.timestamp) 
    : [...records].sort((a,b)=>a.timestamp-b.timestamp);

  // customLabels安全策
  const safeCustomLabels = customLabels || {};

  return (
    <div className="p-4 pb-28 space-y-5 animate-in slide-in-from-right duration-300 w-full overflow-hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-gray-800 rounded-full active:scale-90 shadow-lg border border-gray-700 flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-[clamp(1.6rem,7vw,2.2rem)] font-black text-white truncate">{date}</h2>
        </div>
        
        <ReportSummaryView records={sortedRecords} customLabels={safeCustomLabels} totalRestMinutes={meta.totalRestMinutes} enabledMethods={Object.keys(PAYMENT_LABELS) as PaymentMethod[]} />
        
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1 flex-wrap gap-4">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4" /> 履歴</h3>
            <div className="flex gap-2">
              <button onClick={() => setIsDetailed(!isDetailed)} className={`text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border transition-all whitespace-nowrap ${isDetailed ? 'bg-amber-500 text-black border-amber-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>詳細</button>
              <button onClick={() => setIsDetailReversed(!isDetailReversed)} className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border border-gray-700 whitespace-nowrap"><ArrowUpDown className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="space-y-3">
            {sortedRecords.length === 0 ? (
                <div className="text-center py-10 text-gray-600 font-bold">データがありません</div>
            ) : (
                sortedRecords.map((r, i) => (
                <SalesRecordCard key={r.id} record={r} index={isDetailReversed ? sortedRecords.length - i : i + 1} isDetailed={isDetailed} customLabels={safeCustomLabels} businessStartHour={businessStartHour} onClick={() => isMe && onEditRecord ? onEditRecord(r) : {}} />
                ))
            )}
          </div>
        </section>

        {isMe && onUpdateMetadata && (
            <section className="space-y-5 pt-5 border-t border-gray-800">
              <div className="bg-[#1A222C] p-4 rounded-[28px] border border-gray-800 space-y-4 shadow-2xl">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Settings className="w-4 h-4" /> 属性</h3>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-widest">帰属月</label>
                  <select value={meta.attributedMonth || date.split('/').slice(0, 2).join('-')} onChange={(e) => onUpdateMetadata(date, { attributedMonth: e.target.value })} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-3 text-white text-base font-black outline-none focus:border-amber-500 appearance-none">
                    {Array.from({ length: 12 }).map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 6 + i); const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return <option key={val} value={val}>{d.getFullYear()}年 {d.getMonth()+1}月分</option> })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-2 flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-4 h-4" /> メモ</label>
                  <textarea value={meta.memo} onChange={(e) => onUpdateMetadata(date, { memo: e.target.value })} placeholder="記録..." className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-3 text-white text-base min-h-[100px] outline-none focus:border-amber-500 shadow-inner" />
                </div>
              </div>
            </section>
        )}
    </div>
  );
};

// --- ★Export: Monthly Dashboard View (月間ダッシュボード) ---
export const MonthlyDashboard: React.FC<{
    displayMonth: Date,
    setCurrentMonth: (d: Date) => void,
    monthData: SalesRecord[],
    dailyGroups: [string, SalesRecord[]][],
    customLabels: Record<string, string>,
    onSelectDay: (date: string) => void,
    isMe: boolean,
    userName?: string,
    history: SalesRecord[], 
    shimebiDay: number,
    businessStartHour: number,
    showSummary?: boolean
}> = ({ displayMonth, setCurrentMonth, monthData, dailyGroups, customLabels, onSelectDay, isMe, userName, history, shimebiDay, businessStartHour, showSummary = false }) => {
    const [isHistoryReversed, setIsHistoryReversed] = useState(true);
    const displayMonthStr = `${displayMonth.getFullYear()}年 ${displayMonth.getMonth() + 1}月度`;
    
    // --- Table Logic ---
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [tableTargetDate, setTableTargetDate] = useState(new Date());
    // ★修正: デフォルトで閉じる
    const [isTableOpen, setIsTableOpen] = useState(false);

    useEffect(() => {
        setTableTargetDate(new Date(displayMonth));
    }, [displayMonth]);

    const getBillingMonthDate = (date: Date) => {
        const { end } = getBillingPeriod(date, shimebiDay, businessStartHour);
        return end;
    };

    const shiftPeriod = (delta: number) => {
        const newDate = new Date(tableTargetDate);
        if (viewMode === 'monthly') {
          newDate.setMonth(newDate.getMonth() + delta);
        } else {
          newDate.setFullYear(newDate.getFullYear() + delta);
        }
        setTableTargetDate(newDate);
    };

    const yearlyData = useMemo(() => {
        const baseYearDate = getBillingMonthDate(tableTargetDate);
        const currentYear = baseYearDate.getFullYear();
        const months = [];
        let totalDays = 0, totalCount = 0, totalDispatch = 0, totalSales = 0;
        
        // 安全策
        const safeHistory = history || [];

        for (let m = 0; m < 12; m++) {
          const monthRefDate = new Date(currentYear, m, shimebiDay === 0 ? 28 : shimebiDay);
          const { start, end } = getBillingPeriod(monthRefDate, shimebiDay, businessStartHour);
          const adjustedEnd = new Date(end);
          if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
          const startStr = formatDate(start), endStr = formatDate(adjustedEnd);
          const monthRecords = safeHistory.filter(r => {
            const bDate = getBusinessDate(r.timestamp, businessStartHour);
            return bDate >= startStr && bDate <= endStr;
          });
          const uniqueDays = new Set(monthRecords.map(r => getBusinessDate(r.timestamp, businessStartHour)));
          totalDays += uniqueDays.size; totalCount += monthRecords.length; totalDispatch += monthRecords.filter(isDispatch).length; totalSales += monthRecords.reduce((sum, r) => sum + r.amount, 0);
          months.push({ label: `${m + 1}月`, fullLabel: `${currentYear}年${m + 1}月度`, referenceDate: monthRefDate, dutyDays: uniqueDays.size, count: monthRecords.length, dispatch: monthRecords.filter(isDispatch).length, sales: monthRecords.reduce((sum, r) => sum + r.amount, 0), records: monthRecords });
        }
        return { yearLabel: `${currentYear}年度`, periodLabel: `${(shimebiDay === 0 ? currentYear : currentYear - 1)}年${(shimebiDay === 0 ? 1 : 12)}月度 〜 ${currentYear}年12月度`, months, totals: { dutyDays: totalDays, count: totalCount, dispatch: totalDispatch, sales: totalSales } };
    }, [history, tableTargetDate, shimebiDay, businessStartHour]);

    const tableMonthlyData = useMemo(() => {
        const { start, end } = getBillingPeriod(tableTargetDate, shimebiDay, businessStartHour);
        const adjustedEnd = new Date(end);
        if (shimebiDay !== 0 && adjustedEnd.getDate() !== shimebiDay) adjustedEnd.setDate(shimebiDay);
        const startStr = formatDate(start), endStr = formatDate(adjustedEnd);
        const days = []; const curr = new Date(start);
        while (curr <= adjustedEnd) { days.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
        
        // 安全策
        const safeHistory = history || [];

        const rows = days.map(day => {
          const dateStr = formatDate(day);
          const dayRecords = safeHistory.filter(r => getBusinessDate(r.timestamp, businessStartHour) === dateStr);
          let startTimeStr = '—', endTimeStr = '—';
          if (dayRecords.length > 0) {
            const sorted = [...dayRecords].sort((a, b) => a.timestamp - b.timestamp);
            startTimeStr = formatBusinessTime(sorted[0].timestamp, businessStartHour);
            endTimeStr = formatBusinessTime(sorted[sorted.length - 1].timestamp, businessStartHour);
          }
          return { dateStr, dateLabel: `${day.getMonth() + 1}/${day.getDate()}`, weekDay: day.getDay(), startTimeStr, endTimeStr, count: dayRecords.length, dispatch: dayRecords.filter(isDispatch).length, sales: dayRecords.reduce((sum, r) => sum + r.amount, 0), hasData: dayRecords.length > 0, records: dayRecords };
        });
        return { monthLabel: `${getBillingMonthDate(tableTargetDate).getFullYear()}年 ${getBillingMonthDate(tableTargetDate).getMonth() + 1}月度`, periodLabel: `${startStr} 〜 ${endStr}`, rows, totals: { workDays: rows.filter(r => r.hasData).length, count: rows.reduce((s, r) => s + r.count, 0), dispatch: rows.reduce((s, r) => s + r.dispatch, 0), sales: rows.reduce((s, r) => s + r.sales, 0) } };
    }, [history, tableTargetDate, shimebiDay, businessStartHour]);

    const weekNames = ['日', '月', '火', '水', '木', '金', '土'];
    const weekColors = ['text-red-400', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-blue-400'];

    const sortedGroups = useMemo(() => {
        return [...dailyGroups].sort((a, b) => isHistoryReversed ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]));
    }, [dailyGroups, isHistoryReversed]);

    // サマリー用
    const summaryStats = useMemo(() => {
        if (!showSummary) return null;
        const records = monthData;
        const totalAmount = records.reduce((s, r) => s + r.amount, 0);
        const taxAmount = calculateTaxAmount(totalAmount);
        const breakdown = getPaymentBreakdown(records);
        const cashAmount = breakdown['CASH'] || 0;
        const counts = getPaymentCounts(records);
        return { totalAmount, taxAmount, cashAmount, breakdown, counts };
    }, [monthData, showSummary]);

    const avgAmount = useMemo(() => {
        if (!showSummary) return 0;
        return monthData.length > 0 ? Math.round(summaryStats!.totalAmount / monthData.length) : 0;
    }, [monthData, summaryStats, showSummary]);

    // customLabels安全策
    const safeCustomLabels = customLabels || {};

    return (
        <div className="space-y-5 animate-in slide-in-from-right duration-300">
             {!isMe && userName && (
                <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl flex items-center justify-center gap-2 mb-2">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-200 font-bold">{userName} さんの履歴</span>
                </div>
             )}

             <div className="space-y-4">
                <div className="flex bg-gray-900 p-1.5 rounded-2xl border border-gray-800 shadow-sm">
                    <button onClick={() => { setViewMode('monthly'); setIsTableOpen(true); }} className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${viewMode === 'monthly' ? 'bg-[#1A222C] text-amber-500 shadow-md border border-gray-700' : 'text-gray-500'}`}><Calendar className="w-4 h-4" /> 月間実績表</button>
                    <button onClick={() => { setViewMode('yearly'); setIsTableOpen(true); }} className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${viewMode === 'yearly' ? 'bg-[#1A222C] text-blue-400 shadow-md border border-gray-700' : 'text-gray-500'}`}><Database className="w-4 h-4" /> 年間推移表</button>
                </div>

                <div className="space-y-0">
                    <div 
                    onClick={() => setIsTableOpen(!isTableOpen)}
                    className={`rounded-t-2xl p-4 text-center shadow-lg cursor-pointer active:brightness-95 transition-all ${viewMode === 'monthly' ? 'bg-[#EAB308]' : 'bg-[#CC6600]'}`}
                    >
                    <div className={`flex justify-between items-center ${viewMode === 'monthly' ? 'text-black' : 'text-white'}`}>
                        <button onClick={(e) => { e.stopPropagation(); shiftPeriod(-1); }} className="p-1 hover:bg-black/10 rounded-full active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                            <span className="text-xl font-black tracking-tighter">{viewMode === 'monthly' ? tableMonthlyData.monthLabel : `${yearlyData.yearLabel} 通期実績`}</span>
                            {isTableOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                            <span className={`text-xs font-bold opacity-80 ${viewMode === 'yearly' && 'text-orange-100'}`}>{viewMode === 'monthly' ? tableMonthlyData.periodLabel : yearlyData.periodLabel}</span>
                        </div>
                        <div className="flex gap-2">
                            {/* ★削除: CSVダウンロードボタン削除済み */}
                            <button onClick={(e) => { e.stopPropagation(); shiftPeriod(1); }} className="p-1 hover:bg-black/10 rounded-full active:scale-90"><ChevronRight className="w-6 h-6" /></button>
                        </div>
                    </div>
                    </div>

                    <div className={`bg-[#1A222C] rounded-b-2xl overflow-hidden border-x border-b border-gray-800 shadow-2xl transition-all duration-300 ${isTableOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="overflow-x-auto">
                        {viewMode === 'monthly' ? (
                        <table className="w-full text-center text-sm">
                            <thead>
                            <tr className="bg-[#0f371d] text-white text-xs border-b border-green-800/50">
                                <th className="py-3 px-1 font-bold w-[12%]">日付</th><th className="py-3 px-1 font-bold w-[10%]">曜</th><th className="py-3 px-1 font-bold w-[15%]">出庫</th><th className="py-3 px-1 font-bold w-[15%]">入庫</th><th className="py-3 px-1 font-bold w-[12%]">回数</th><th className="py-3 px-1 font-bold w-[12%]">配車</th><th className="py-3 px-2 font-bold w-[24%] text-right">営収</th>
                            </tr>
                            </thead>
                            <tbody className="text-gray-300 font-medium">
                            {tableMonthlyData.rows.map((row, i) => (
                                <tr 
                                    key={i} 
                                    className={`${i % 2 === 0 ? 'bg-[#1A222C]' : 'bg-[#151b24]'} border-b border-gray-800/50 hover:bg-white/5 cursor-pointer`}
                                    onClick={() => row.hasData && onSelectDay(row.dateStr)}
                                >
                                <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${weekColors[row.weekDay]} ${row.hasData && 'underline decoration-amber-500/50'}`}>{row.dateLabel}</td>
                                <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${weekColors[row.weekDay]}`}>{weekNames[row.weekDay]}</td>
                                <td className={`py-3 px-1 font-mono tracking-tighter border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>{row.startTimeStr}</td>
                                <td className={`py-3 px-1 font-mono tracking-tighter border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>{row.endTimeStr}</td>
                                <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>{row.hasData ? row.count : '-'}</td>
                                <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>{row.hasData ? row.dispatch : '-'}</td>
                                <td className={`py-3 px-2 text-right font-mono font-black tracking-tight ${row.sales > 0 ? 'text-amber-400' : 'text-gray-700'}`}>{row.sales > 0 ? row.sales.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                            <tr className="bg-[#EAB308] text-black font-black border-t-2 border-amber-600 text-base">
                                <td className="py-3 px-1" colSpan={2}>合計</td><td className="py-3 px-1 text-sm" colSpan={2}>{tableMonthlyData.totals.workDays}出番</td><td className="py-3 px-1">{tableMonthlyData.totals.count}</td><td className="py-3 px-1">{tableMonthlyData.totals.dispatch}</td><td className="py-3 px-2 text-right">{tableMonthlyData.totals.sales.toLocaleString()}</td>
                            </tr>
                            </tbody>
                        </table>
                        ) : (
                        <table className="w-full text-center text-sm">
                            <thead>
                            <tr className="bg-[#004d00] text-white text-xs border-b border-green-800/50">
                                <th className="py-3 px-2 font-bold w-[20%]">月度</th><th className="py-3 px-2 font-bold w-[15%]">日数</th><th className="py-3 px-2 font-bold w-[15%]">件数</th><th className="py-3 px-2 font-bold w-[15%]">配車</th><th className="py-3 px-4 font-bold w-[35%] text-right">営収</th>
                            </tr>
                            </thead>
                            <tbody className="text-gray-200 font-medium">
                            {yearlyData.months.map((m, i) => (
                                <tr 
                                    key={i} 
                                    className={`${i % 2 === 0 ? 'bg-[#1A222C]' : 'bg-[#151b24]'} border-b border-gray-800/50 hover:bg-white/5 cursor-pointer`}
                                    onClick={() => {
                                        if (m.sales > 0) {
                                            setCurrentMonth(m.referenceDate);
                                            setViewMode('monthly');
                                            setIsTableOpen(true);
                                        }
                                    }}
                                >
                                <td className="py-3 px-2 font-bold text-blue-400 border-r border-gray-800/50 underline decoration-blue-500/30">{m.fullLabel}</td>
                                <td className="py-3 px-2 font-bold border-r border-gray-800/50">{m.sales > 0 ? m.dutyDays : '-'}</td>
                                <td className="py-3 px-2 font-bold border-r border-gray-800/50">{m.sales > 0 ? m.count : '-'}</td>
                                <td className="py-3 px-2 font-bold border-r border-gray-800/50">{m.sales > 0 ? m.dispatch : '-'}</td>
                                <td className={`py-3 px-4 text-right font-mono font-black tracking-tight ${m.sales > 0 ? 'text-white' : 'text-gray-700'}`}>{m.sales > 0 ? m.sales.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                            <tr className="bg-[#FFE4B5] text-black font-black border-t-2 border-orange-400 text-base">
                                <td className="py-3 px-2">合計</td><td className="py-3 px-2">{yearlyData.totals.dutyDays}</td><td className="py-3 px-2">{yearlyData.totals.count.toLocaleString()}</td><td className="py-3 px-2">{yearlyData.totals.dispatch}</td><td className="py-3 px-4 text-right">{yearlyData.totals.sales.toLocaleString()}</td>
                            </tr>
                            </tbody>
                        </table>
                        )}
                    </div>
                    </div>
                </div>
             </div>

             <div className="flex items-center justify-between bg-gray-900 rounded-[24px] p-2 border border-gray-800 shadow-inner">
                <button onClick={() => setCurrentMonth(new Date(new Date(displayMonth).setMonth(displayMonth.getMonth()-1)))} className="p-3 text-gray-400 active:scale-90 flex-shrink-0"><ChevronLeft className="w-7 h-7" /></button>
                <span className="font-black text-[clamp(1.4rem,6vw,2rem)] text-white tracking-tight whitespace-nowrap">{displayMonthStr}</span>
                <button onClick={() => setCurrentMonth(new Date(new Date(displayMonth).setMonth(displayMonth.getMonth()+1)))} className="p-3 text-gray-400 active:scale-90 flex-shrink-0"><ChevronRight className="w-7 h-7" /></button>
             </div>

             {showSummary && summaryStats && (
                <section className="space-y-6">
                    <div className="text-center py-8 bg-[#1A222C] rounded-[32px] border border-gray-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
                        <p className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] mb-2 opacity-80">月間累計営収 (税込)</p>
                        <div className="flex items-baseline justify-center gap-2 mb-2">
                            <span className="text-6xl font-black text-amber-600/80">¥</span>
                            <span className="text-[clamp(5rem,20vw,8rem)] font-black text-amber-500 leading-none tracking-tighter drop-shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
                            {summaryStats.totalAmount.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 mb-8">
                            <p className="text-xl font-bold text-gray-400">(内消費税 {formatCurrency(summaryStats.taxAmount)})</p>
                            <p className="text-xl font-bold text-gray-400">税抜 {formatCurrency(summaryStats.totalAmount - summaryStats.taxAmount)}</p>
                        </div>
                        <div className="bg-gray-950/50 mx-6 p-5 rounded-3xl border border-gray-700/50 flex flex-col items-center gap-2 shadow-inner">
                            <span className="text-sm text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Wallet className="w-5 h-5" /> 現金売上
                            </span>
                            <span className="text-5xl font-black text-white tracking-tight">{formatCurrency(summaryStats.cashAmount)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#1A222C] p-5 rounded-[28px] border border-gray-800 shadow-xl space-y-3 relative overflow-hidden">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><Target className="w-4 h-4 text-amber-500" /> 期間総売上</p>
                            <p className="text-[clamp(1.5rem,7vw,2rem)] font-black text-white truncate tracking-tight">{formatCurrency(summaryStats.totalAmount)}</p>
                        </div>
                        <div className="bg-[#1A222C] p-5 rounded-[28px] border border-gray-800 shadow-xl space-y-3 relative overflow-hidden">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><TrendingUp className="w-4 h-4 text-indigo-400" /> 平均単価</p>
                            <p className="text-[clamp(1.5rem,7vw,2rem)] font-black text-indigo-300 truncate tracking-tight">{formatCurrency(avgAmount)}</p>
                        </div>
                    </div>

                    <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl space-y-6">
                        <PaymentBreakdownList 
                            breakdown={summaryStats.breakdown} 
                            counts={summaryStats.counts} 
                            customLabels={safeCustomLabels} 
                            enabledMethods={Object.keys(PAYMENT_LABELS) as PaymentMethod[]}
                        />
                    </div>
                </section>
             )}

             <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-500 uppercase px-1 tracking-widest flex justify-between items-center italic flex-wrap gap-2"><span>履歴リスト</span><button onClick={() => setIsHistoryReversed(!isHistoryReversed)} className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full flex items-center gap-2 font-black active:scale-95 shadow-sm border border-gray-700 whitespace-nowrap"><ArrowUpDown className="w-3.5 h-3.5" />最新から</button></h3>
                <div className="space-y-3">
                  {sortedGroups.length > 0 ? sortedGroups.map(([date, records]) => (
                    <div key={date} onClick={() => onSelectDay(date)} className="bg-[#1A222C] rounded-[24px] p-4 border border-gray-800 flex justify-between items-center active:bg-gray-800 transition-all shadow-md group cursor-pointer gap-3 w-full">
                      <div className="z-10 overflow-hidden min-w-0 flex-1"><p className="font-black text-white text-[clamp(1.2rem,6vw,1.6rem)] tracking-tight truncate">{date}</p><div className="flex gap-2 mt-1 items-center"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">{records.length}回</p></div></div>
                      <div className="text-right flex items-center gap-2 flex-shrink-0"><p className="font-black text-amber-500 text-[clamp(1.4rem,7vw,2rem)] truncate leading-tight">{formatCurrency(records.reduce((sum, r) => sum + r.amount, 0))}</p><ChevronRight className="w-5 h-5 text-gray-700" /></div>
                    </div>
                  )) : <p className="text-center text-gray-600 font-bold py-10 italic uppercase tracking-widest">No Data in this period</p>}
                </div>
             </div>
        </div>
    );
};

// --- Main HistoryView Component ---
interface HistoryViewProps { 
  history: SalesRecord[]; 
  dayMetadata: Record<string, DayMetadata>;
  customPaymentLabels: Record<string, string>;
  businessStartHour: number;
  shimebiDay: number; 
  onEditRecord: (rec: SalesRecord) => void;
  onUpdateMetadata: (date: string, meta: Partial<DayMetadata>) => void;
  stats: MonthlyStats; 
  initialTargetDate?: string | Date | null;
  onClearTargetDate?: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ 
  history: myHistory, 
  dayMetadata: myDayMetadata, 
  customPaymentLabels: myCustomLabels, 
  businessStartHour, 
  shimebiDay, 
  onEditRecord, 
  onUpdateMetadata, 
  stats,
  initialTargetDate,
  onClearTargetDate
}) => {
  const [viewingUid, setViewingUid] = useState(auth.currentUser?.uid);
  const [isViewingMe, setIsViewingMe] = useState(true);

  const [colleagues, setColleagues] = useState<any[]>([]);
  const [selectedUserObj, setSelectedUserObj] = useState<any | null>(null);
  const [otherHistory, setOtherHistory] = useState<SalesRecord[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const { end } = getBillingPeriod(new Date(), shimebiDay, businessStartHour);
    return end;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const processedTargetDateRef = useRef<string | null>(null);

  // 公開ステータスからユーザー一覧を取得
  useEffect(() => {
    const q = query(collection(db, "public_status"), orderBy("lastUpdated", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
        const users: any[] = [];
        snap.forEach(doc => {
            const data = doc.data();
            users.push(data);
        });
        setColleagues(users);
    });
    return () => unsub();
  }, []);

  // ユーザー選択変更時の処理
  // ★修正: usersコレクションではなく public_status のデータを使用する
  useEffect(() => {
      const currentUid = auth.currentUser?.uid;
      if (viewingUid === currentUid) {
          setIsViewingMe(true);
          setSelectedUserObj(null);
          setOtherHistory([]);
      } else {
          setIsViewingMe(false);
          const user = colleagues.find(u => u.uid === viewingUid);
          setSelectedUserObj(user || null);
          
          if (user) {
              // public_status のデータから履歴を生成
              const activeRecords = user.records || [];
              let pastRecords: SalesRecord[] = [];
              if (user.months) {
                   pastRecords = Object.values(user.months).flatMap((m: any) => m.records || []);
              }
              
              // 重複を排除し、降順にソートして結合
              const combined = [...pastRecords, ...activeRecords]
                .filter((r: SalesRecord, index: number, self: SalesRecord[]) => index === self.findIndex((t) => t.id === r.id))
                .sort((a: SalesRecord, b: SalesRecord) => b.timestamp - a.timestamp);

              setOtherHistory(combined);
          } else {
              setOtherHistory([]);
          }
      }
  }, [viewingUid, colleagues]);

  // ディープリンク対応
  useEffect(() => {
    if (initialTargetDate) {
        const targetStr = initialTargetDate.toString();
        if (processedTargetDateRef.current === targetStr) return;

        if (typeof initialTargetDate === 'string') {
            const d = new Date(initialTargetDate);
            const { end } = getBillingPeriod(d, shimebiDay, businessStartHour);
            setCurrentMonth(new Date(end)); 
            setSelectedDay(initialTargetDate);
        } else if (initialTargetDate instanceof Date) {
            const { end } = getBillingPeriod(initialTargetDate, shimebiDay, businessStartHour);
            setCurrentMonth(new Date(end));
            setSelectedDay(null);
        }
        
        processedTargetDateRef.current = targetStr;
        if (onClearTargetDate) onClearTargetDate();
    }
  }, [initialTargetDate, shimebiDay, businessStartHour]);

  // ★修正: ユーザー選択リストのフィルタリングを修正
  const selectableUsers = useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    const currentUserEmail = auth.currentUser?.email;
    const isAdmin = currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail);

    return colleagues.filter(u => {
      if (u.uid === currentUid) return true; // 自分は必ず表示
      if (isAdmin) return true; // 管理者は全員表示
      
      const mode = u.visibilityMode || 'PUBLIC'; // デフォルトはPUBLIC
      
      if (mode === 'PRIVATE') return false; // 非公開は非表示
      
      if (mode === 'CUSTOM') {
        // カスタムの場合は許可リストに含まれているか
        return u.allowedViewers && u.allowedViewers.includes(currentUid);
      }
      
      return true; // PUBLICなら表示
    }).sort((a, b) => {
        if (a.uid === currentUid) return -1;
        if (b.uid === currentUid) return 1;
        return 0;
    });
  }, [colleagues]);

  const targetHistory = isViewingMe ? myHistory : otherHistory;
  const targetStartHour = isViewingMe ? businessStartHour : (selectedUserObj?.businessStartHour || 9);
  const targetLabels = isViewingMe ? myCustomLabels : {}; 

  const renderContent = () => {
      if (selectedDay) {
          const meta = isViewingMe ? (myDayMetadata[selectedDay] || { memo: '', attributedMonth: '', totalRestMinutes: 0 }) : { memo: '', attributedMonth: '', totalRestMinutes: 0 };
          const records = targetHistory.filter(r => getBusinessDate(r.timestamp, targetStartHour) === selectedDay);
          return (
              <DailyDetailView 
                  date={selectedDay} 
                  records={records} 
                  meta={meta} 
                  customLabels={targetLabels} 
                  businessStartHour={targetStartHour} 
                  onBack={() => setSelectedDay(null)}
                  isMe={isViewingMe}
                  onUpdateMetadata={onUpdateMetadata}
                  onEditRecord={onEditRecord}
              />
          );
      }
      const { monthData, dailyGroups } = (() => {
          const targetReferenceDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), shimebiDay === 0 ? 28 : shimebiDay);
          const { start, end } = getBillingPeriod(targetReferenceDate, shimebiDay, targetStartHour);
          const adjustedEnd = new Date(end);
          if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
          const startStr = formatDate(start);
          const endDateStr = formatDate(adjustedEnd);
          const safeTargetHistory = targetHistory || [];
          const monthData = safeTargetHistory.filter(r => {
              const bDate = getBusinessDate(r.timestamp, targetStartHour);
              return bDate >= startStr && bDate <= endDateStr;
          });
          const groups: Record<string, SalesRecord[]> = {};
          monthData.forEach(r => {
            const bDate = getBusinessDate(r.timestamp, targetStartHour);
            if (!groups[bDate]) groups[bDate] = [];
            groups[bDate].push(r);
          });
          return { monthData, dailyGroups: Object.entries(groups) };
      })();

      return (
          <div className="p-4 pb-32 w-full overflow-hidden">
             <MonthlyDashboard 
                displayMonth={currentMonth} 
                setCurrentMonth={setCurrentMonth} 
                monthData={monthData} 
                dailyGroups={dailyGroups} 
                customLabels={targetLabels} 
                onSelectDay={setSelectedDay}
                isMe={isViewingMe}
                userName={selectedUserObj?.name}
                history={targetHistory} 
                shimebiDay={shimebiDay} 
                businessStartHour={targetStartHour} 
             />
          </div>
      );
  };

  return (
    <div className="w-full">
        {!selectedDay && (
            <div className="p-4 pb-0">
                <div className="relative">
                    <select 
                        value={viewingUid || ''} 
                        onChange={(e) => setViewingUid(e.target.value)}
                        className="w-full appearance-none bg-gray-900 border border-gray-800 text-white font-bold py-3 px-4 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    >
                        {selectableUsers.map(u => (
                            <option key={u.uid} value={u.uid}>
                                {u.uid === auth.currentUser?.uid ? `自分 (${stats.userName})` : u.name || '名称未設定'}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                        <ChevronDown className="w-5 h-5" />
                    </div>
                </div>
            </div>
        )}
        {renderContent()}
    </div>
  );
};

export default HistoryView;