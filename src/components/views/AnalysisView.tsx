import React, { useState, useMemo, useEffect } from 'react';
import { 
  Clock, 
  Activity, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  BarChart2, 
  User, 
  CircleDollarSign, 
  Skull,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Map,
  Crown,
  Medal,
  ArrowUpRight
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { SalesRecord, MonthlyStats, PaymentMethod } from '@/types';
import { 
  getBillingPeriod, 
  formatCurrency, 
  PAYMENT_LABELS, 
  getPaymentColorClass,
  getBusinessDate,
  formatDate,
  RIDE_LABELS,
  getGoogleMapsUrl 
} from '../utils';

// ★管理者設定
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

interface AnalysisViewProps { 
  history: SalesRecord[]; 
  stats: MonthlyStats; 
  onNavigateToHistory: (date: string | Date) => void;
}

interface RankingEntry extends SalesRecord {
    userName: string;
    isMe: boolean;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ history, stats, onNavigateToHistory }) => {
  // --- State ---
  const [rankingTab, setRankingTab] = useState<'allTime' | 'monthly'>('allTime');
  const [targetDate, setTargetDate] = useState(new Date()); // 分析対象月
  const [publicStatusData, setPublicStatusData] = useState<any[]>([]);

  const businessStartHour = stats.businessStartHour ?? 9;
  const shimebiDay = stats.shimebiDay ?? 20;
  const currentUserId = auth.currentUser?.uid;

  // --- Data Fetching ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      setPublicStatusData(users);
    });
    return () => unsub();
  }, []);

  // --- Logic: Month Navigation ---
  const shiftMonth = (delta: number) => {
    const newDate = new Date(targetDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setTargetDate(newDate);
  };

  const currentMonthLabel = useMemo(() => {
     const { end } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
     return `${end.getFullYear()}年 ${end.getMonth() + 1}月度`;
  }, [targetDate, shimebiDay, businessStartHour]);

  // --- Logic: Rankings ---
  
  // 1. 歴代最高記録 (All-Time High)
  const allTimeRanking = useMemo(() => {
    let entries: RankingEntry[] = [];
    publicStatusData.forEach((u: any) => {
        const records: SalesRecord[] = u.topRecords || []; 
        const userName = u.name || 'Unknown';
        const isMe = u.uid === currentUserId; 
        if (Array.isArray(records)) {
            records.forEach(r => { entries.push({ ...r, userName, isMe }); });
        }
    });
    // 重複排除とソート
    return entries
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20); // Top 20
  }, [publicStatusData, currentUserId]);

  // 2. 月間売上ランキング (Monthly Total)
  const monthlyRanking = useMemo(() => {
    return [...publicStatusData]
      .sort((a, b) => (b.monthlyTotal || 0) - (a.monthlyTotal || 0))
      .map((u, i) => ({ 
          uid: u.uid,
          rank: i + 1,
          name: u.name || 'Unknown',
          amount: u.monthlyTotal || 0,
          rideCount: u.rideCount || 0,
          isMe: u.uid === currentUserId
      }));
  }, [publicStatusData, currentUserId]);

  // --- Logic: Personal Analytics (Monthly) ---
  const monthlyMetrics = useMemo(() => {
    const { start, end } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
    const adjustedEnd = new Date(end);
    if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
    
    const startStr = formatDate(start);
    const endStr = formatDate(adjustedEnd);

    const filteredRecords = history.filter(r => {
        const bDate = getBusinessDate(r.timestamp, businessStartHour);
        return bDate >= startStr && bDate <= endStr;
    });

    const totalSales = filteredRecords.reduce((s, r) => s + r.amount, 0);
    const count = filteredRecords.length;
    const avg = count > 0 ? totalSales / count : 0;
    const badCustomers = filteredRecords.filter(r => r.isBadCustomer).length;
    
    // 男女比
    let male = 0, female = 0;
    filteredRecords.forEach(r => { male += (r.passengersMale || 0); female += (r.passengersFemale || 0); });
    const totalPax = male + female;
    
    // 決済比率
    const payMap: Record<string, number> = {}; 
    let payTotal = 0;
    filteredRecords.forEach(r => { 
        const val = r.amount + r.toll; 
        payMap[r.paymentMethod] = (payMap[r.paymentMethod] || 0) + val; 
        payTotal += val; 
    });
    const paymentData = Object.entries(payMap)
        .sort(([, a], [, b]) => b - a)
        .map(([method, amount]) => ({ 
            method: method as PaymentMethod, 
            amount, 
            percent: payTotal > 0 ? (amount / payTotal) * 100 : 0 
        }));

    // 時間帯別
    const hours = Array(8).fill(0);
    filteredRecords.forEach(r => { hours[Math.floor(new Date(r.timestamp).getHours() / 3)] += r.amount; });
    const maxHourVal = Math.max(...hours, 1);
    const hourlyData = hours.map((val, i) => ({ 
        label: ["0-3", "3-6", "6-9", "9-12", "12-15", "15-18", "18-21", "21-24"][i], 
        value: val, 
        percent: (val / maxHourVal) * 100 
    }));

    // 曜日別
    const days = Array(7).fill(0);
    filteredRecords.forEach(r => { days[new Date(r.timestamp).getDay()] += r.amount; });
    const maxDayVal = Math.max(...days, 1);
    const dayOfWeekData = days.map((val, i) => ({ value: val, percent: (val / maxDayVal) * 100 }));

    return {
        totalSales,
        count,
        avg,
        badCustomers,
        badCustomerRate: count > 0 ? (badCustomers / count) * 100 : 0,
        gender: { male, female, total: totalPax, malePer: totalPax > 0 ? (male/totalPax)*100 : 0, femalePer: totalPax > 0 ? (female/totalPax)*100 : 0 },
        paymentData,
        hourlyData,
        dayOfWeekData,
        records: filteredRecords
    };
  }, [history, targetDate, shimebiDay, businessStartHour]);

  const weekNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="p-4 pb-32 space-y-8 w-full overflow-hidden animate-in fade-in duration-500">
      
      {/* --- Section 1: Ranking Tabs & List --- */}
      <section className="space-y-4">
        {/* Tabs */}
        <div className="flex bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 backdrop-blur-sm sticky top-0 z-20 shadow-lg">
            <button 
                onClick={() => setRankingTab('allTime')} 
                className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${rankingTab === 'allTime' ? 'bg-[#EAB308] text-black shadow-lg scale-[1.02]' : 'text-gray-500 hover:bg-white/5'}`}
            >
                <Trophy className="w-4 h-4" /> 歴代最高記録
            </button>
            <button 
                onClick={() => setRankingTab('monthly')} 
                className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${rankingTab === 'monthly' ? 'bg-blue-500 text-white shadow-lg scale-[1.02]' : 'text-gray-500 hover:bg-white/5'}`}
            >
                <Crown className="w-4 h-4" /> 月間ランキング
            </button>
        </div>

        {/* Content */}
        <div className="space-y-3 min-h-[300px]">
            {rankingTab === 'allTime' ? (
                // --- All Time Records ---
                allTimeRanking.length > 0 ? allTimeRanking.map((e, idx) => (
                    <div 
                        key={`${e.id}-${idx}`}
                        className={`group relative overflow-hidden bg-[#1A222C] border ${e.isMe ? 'border-amber-500/50 bg-amber-900/10' : 'border-gray-800'} rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-gray-600`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                            idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-600 text-black shadow-lg shadow-amber-500/30' :
                            idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                            idx === 2 ? 'bg-gradient-to-br from-orange-700 to-orange-900 text-white border border-white/20' : 
                            'bg-gray-800 text-gray-500'
                        }`}>
                            {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className={`text-2xl font-black tracking-tighter ${e.isMe ? 'text-amber-500' : 'text-white'}`}>
                                    {formatCurrency(e.amount)}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">{formatDate(new Date(e.timestamp))}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${e.isMe ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-800 border-gray-700'}`}>
                                    {e.userName}
                                </span>
                                <span className="truncate opacity-70">{e.pickupLocation || '---'} → {e.dropoffLocation || '---'}</span>
                            </div>
                        </div>
                        {e.isMe && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
                    </div>
                )) : (
                    <div className="text-center py-12 text-gray-600 font-bold bg-gray-900/50 rounded-3xl border border-gray-800">
                        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>記録がありません</p>
                    </div>
                )
            ) : (
                // --- Monthly Ranking ---
                monthlyRanking.length > 0 ? monthlyRanking.map((u, idx) => (
                    <div 
                        key={u.uid}
                        className={`group relative overflow-hidden bg-[#1A222C] border ${u.isMe ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-800'} rounded-2xl p-4 flex items-center justify-between transition-all hover:border-gray-600`}
                    >
                         <div className="flex items-center gap-4 z-10">
                            <div className={`text-xl font-black italic w-6 text-center ${idx < 3 ? 'text-white drop-shadow-md' : 'text-gray-600'}`}>
                                #{u.rank}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${u.isMe ? 'text-blue-400' : 'text-gray-200'}`}>{u.name}</span>
                                    {u.isMe && <span className="text-[9px] bg-blue-500 text-white px-1.5 rounded font-black">YOU</span>}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5 flex gap-2">
                                    <span>{u.rideCount}回</span>
                                </div>
                            </div>
                         </div>
                         <div className="text-right z-10">
                            <p className="text-lg font-black text-white tracking-tight">{formatCurrency(u.amount)}</p>
                         </div>
                         {/* Bar */}
                         <div 
                           className="absolute inset-y-0 left-0 bg-white/5 z-0 transition-all duration-1000 origin-left" 
                           style={{ width: `${Math.min(100, (u.amount / (monthlyRanking[0]?.amount || 1)) * 100)}%` }}
                         />
                    </div>
                )) : (
                    <div className="text-center py-12 text-gray-600 font-bold bg-gray-900/50 rounded-3xl border border-gray-800">
                        <Crown className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>今月のデータがありません</p>
                    </div>
                )
            )}
        </div>
      </section>

      {/* --- Section 2: Personal Monthly Analytics --- */}
      <section className="space-y-5 pt-8 border-t border-gray-800">
         
         <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2 italic uppercase tracking-tighter">
               <Activity className="w-5 h-5 text-indigo-500" /> 月間詳細分析
            </h3>
            <div className="flex items-center bg-gray-900 rounded-full border border-gray-800 p-1">
                <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-black text-white px-2 tabular-nums">{currentMonthLabel}</span>
                <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>

         {/* 1. Main Metrics Grid */}
         <div className="grid grid-cols-2 gap-3">
             <div className="col-span-2 bg-gradient-to-br from-[#1A222C] to-[#131a22] p-5 rounded-[28px] border border-gray-800 shadow-xl relative overflow-hidden">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-amber-500" /> 総売上</p>
                <p className="text-[clamp(2.5rem,10vw,3.5rem)] font-black text-white leading-none tracking-tighter">{formatCurrency(monthlyMetrics.totalSales)}</p>
                <div className="absolute top-4 right-4 opacity-10"><BarChart2 className="w-24 h-24 text-white" /></div>
             </div>
             
             <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex flex-col justify-center min-h-[100px]">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">平均単価</p>
                <p className="text-xl font-black text-indigo-300 tracking-tight">{formatCurrency(Math.round(monthlyMetrics.avg))}</p>
             </div>
             <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex flex-col justify-center min-h-[100px]">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">乗車回数</p>
                <p className="text-xl font-black text-white tracking-tight">{monthlyMetrics.count}<span className="text-sm text-gray-500 ml-1">回</span></p>
             </div>
         </div>

         {/* 2. Bad Customer Rate & Gender */}
         <div className="grid grid-cols-1 gap-3">
            <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-900/20 rounded-xl border border-red-900/30"><Skull className="w-5 h-5 text-red-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">要注意客率</p>
                        <p className="text-lg font-black text-white">{monthlyMetrics.badCustomerRate.toFixed(1)}% <span className="text-[10px] text-gray-500">({monthlyMetrics.badCustomers}件)</span></p>
                    </div>
                </div>
            </div>

            <div className="bg-[#1A222C] p-5 rounded-[24px] border border-gray-800 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-pink-400" /> 男女比 (総数 {monthlyMetrics.gender.total}名)</span>
                </div>
                <div className="h-6 w-full flex rounded-full overflow-hidden bg-gray-900 border border-gray-800">
                     <div className="h-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${monthlyMetrics.gender.malePer}%` }}>
                        {monthlyMetrics.gender.malePer > 10 && `${Math.round(monthlyMetrics.gender.malePer)}%`}
                     </div>
                     <div className="h-full bg-pink-500 flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${monthlyMetrics.gender.femalePer}%` }}>
                        {monthlyMetrics.gender.femalePer > 10 && `${Math.round(monthlyMetrics.gender.femalePer)}%`}
                     </div>
                </div>
            </div>
         </div>

         {/* 3. Graphs (Grid layout) */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Payment Methods */}
             <div className="bg-[#1A222C] p-5 rounded-[28px] border border-gray-800 shadow-lg space-y-4">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" /> 決済比率
                </h4>
                <div className="space-y-3">
                    {monthlyMetrics.paymentData.slice(0, 4).map(p => (
                        <div key={p.method} className="space-y-1">
                             <div className="flex justify-between text-[10px] font-bold">
                                 <span className="text-gray-300">{PAYMENT_LABELS[p.method] || p.method}</span>
                                 <span className="text-gray-500">{Math.round(p.percent)}%</span>
                             </div>
                             <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden">
                                 <div className={`h-full ${getPaymentColorClass(p.method)}`} style={{ width: `${p.percent}%` }} />
                             </div>
                        </div>
                    ))}
                </div>
             </div>

             {/* Hourly & Daily Trends */}
             <div className="bg-[#1A222C] p-5 rounded-[28px] border border-gray-800 shadow-lg space-y-6">
                
                {/* Hourly */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" /> 時間帯別
                    </h4>
                    <div className="h-24 flex items-end gap-1">
                        {monthlyMetrics.hourlyData.map((d, i) => (
                            <div key={i} className="flex-1 bg-gray-800/50 rounded-t-sm relative group">
                                <div className="absolute bottom-0 w-full bg-amber-500/80 rounded-t-sm transition-all duration-500" style={{ height: `${d.percent}%` }} />
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Day of Week */}
                <div className="space-y-3 pt-2 border-t border-gray-800/50">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" /> 曜日別
                    </h4>
                    <div className="flex justify-between gap-1 h-16 items-end">
                         {weekNames.map((day, i) => {
                             const d = monthlyMetrics.dayOfWeekData[i];
                             const color = i === 0 ? 'bg-red-500' : i === 6 ? 'bg-blue-500' : 'bg-green-500';
                             return (
                                 <div key={day} className="flex-1 flex flex-col items-center gap-1">
                                     <div className={`w-1.5 rounded-full ${color}/40 transition-all duration-500`} style={{ height: `${Math.max(10, d.percent)}%` }}>
                                        <div className={`w-full h-full ${color} opacity-80`} />
                                     </div>
                                     <span className={`text-[9px] font-bold ${i===0||i===6 ? 'text-white':'text-gray-600'}`}>{day}</span>
                                 </div>
                             )
                         })}
                    </div>
                </div>

             </div>
         </div>

      </section>
    </div>
  );
};

export default AnalysisView;