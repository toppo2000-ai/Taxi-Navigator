import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  CircleDollarSign, 
  BarChart2, 
  Skull,
  Users,
  CreditCard,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod } from '../../types';
import { 
  getBillingPeriod, 
  formatCurrency, 
  PAYMENT_LABELS, 
  getBusinessDate,
  formatDate
} from '../../utils';

interface AnalyticsViewProps {
  history: SalesRecord[];
  stats: MonthlyStats;
}

// 決済比率のバー用の明るい色クラス
const getPaymentBarColorClass = (method: PaymentMethod) => {
  switch (method) {
    case 'CASH': return 'bg-amber-400';
    case 'CARD': return 'bg-blue-400';
    case 'NET': return 'bg-purple-400';
    case 'E_MONEY': return 'bg-emerald-400';
    case 'TRANSPORT': return 'bg-cyan-400';
    case 'DIDI': return 'bg-orange-400';
    case 'QR': return 'bg-teal-400';
    case 'TICKET': return 'bg-rose-400';
    default: return 'bg-gray-400';
  }
};

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ history, stats }) => {
  const [targetDate, setTargetDate] = useState(new Date());
  
  const businessStartHour = stats.businessStartHour ?? 9;
  const shimebiDay = stats.shimebiDay ?? 20;

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
    filteredRecords.forEach(r => { 
      male += (r.passengersMale || 0); 
      female += (r.passengersFemale || 0); 
    });
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

    // 時間帯別（24時間を8つの時間帯に分割）
    const hours = Array(8).fill(0);
    filteredRecords.forEach(r => {
      const hour = new Date(r.timestamp).getHours();
      // 0-2: 0, 3-5: 1, 6-8: 2, 9-11: 3, 12-14: 4, 15-17: 5, 18-20: 6, 21-23: 7
      const index = Math.floor(hour / 3);
      if (index >= 0 && index < 8) {
        hours[index] += r.amount;
      }
    });
    const maxHourVal = Math.max(...hours, 1);
    const hourlyData = hours.map((val, i) => {
      const labels = ["0-3", "3-6", "6-9", "9-12", "12-15", "15-18", "18-21", "21-24"];
      return {
        label: labels[i],
        value: val,
        percent: maxHourVal > 0 ? (val / maxHourVal) * 100 : 0
      };
    });

    // 曜日別
    const days = Array(7).fill(0);
    filteredRecords.forEach(r => { 
      const dayOfWeek = new Date(r.timestamp).getDay();
      days[dayOfWeek] += r.amount; 
    });
    const maxDayVal = Math.max(...days, 1);
    const dayOfWeekData = days.map((val, i) => ({ 
      value: val, 
      percent: maxDayVal > 0 ? (val / maxDayVal) * 100 : 0 
    }));

    return {
      totalSales,
      count,
      avg,
      badCustomers,
      badCustomerRate: count > 0 ? (badCustomers / count) * 100 : 0,
      gender: { 
        male, 
        female, 
        total: totalPax, 
        malePer: totalPax > 0 ? (male/totalPax)*100 : 0, 
        femalePer: totalPax > 0 ? (female/totalPax)*100 : 0 
      },
      paymentData,
      hourlyData,
      dayOfWeekData,
      records: filteredRecords
    };
  }, [history, targetDate, shimebiDay, businessStartHour]);

  const weekNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="p-4 pb-32 space-y-5 w-full overflow-hidden animate-in fade-in duration-500">
      {/* --- Section: Personal Monthly Analytics --- */}
      <section className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-black text-white flex items-center gap-2 italic uppercase tracking-tighter">
            <Activity className="w-5 h-5 text-indigo-500" /> 月間詳細分析
          </h3>
          <div className="flex items-center bg-gray-800 rounded-full border-2 border-blue-500 p-1">
            <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-white px-2 tabular-nums">{currentMonthLabel}</span>
            <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 1. Main Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 bg-gray-800 p-5 rounded-[28px] border-2 border-blue-500 shadow-xl relative overflow-hidden">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <CircleDollarSign className="w-4 h-4 text-amber-500" /> 総売上
            </p>
            <p className="text-[clamp(2.5rem,10vw,3.5rem)] font-black text-white leading-none tracking-tighter">
              {formatCurrency(monthlyMetrics.totalSales)}
            </p>
            <div className="absolute top-4 right-4 opacity-10">
              <BarChart2 className="w-24 h-24 text-white" />
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-[24px] border-2 border-blue-500 flex flex-col justify-center min-h-[100px]">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">平均単価</p>
            <p className="text-xl font-black text-indigo-300 tracking-tight">{formatCurrency(Math.round(monthlyMetrics.avg))}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-[24px] border-2 border-blue-500 flex flex-col justify-center min-h-[100px]">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">乗車回数</p>
            <p className="text-xl font-black text-white tracking-tight">
              {monthlyMetrics.count}<span className="text-sm text-gray-500 ml-1">回</span>
            </p>
          </div>
        </div>

        {/* 2. Bad Customer Rate & Gender */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-gray-800 p-4 rounded-[24px] border-2 border-blue-500 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-900/20 rounded-xl border border-red-900/30">
                <Skull className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">要注意客率</p>
                <p className="text-lg font-black text-white">
                  {monthlyMetrics.badCustomerRate.toFixed(1)}% 
                  <span className="text-[10px] text-gray-500"> ({monthlyMetrics.badCustomers}件)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-5 rounded-[24px] border-2 border-blue-500 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-gray-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pink-400" /> 男女比 (総数 {monthlyMetrics.gender.total}名)
              </span>
            </div>
            <div className="h-6 w-full flex rounded-full overflow-hidden bg-gray-900 border border-gray-800">
              <div 
                className="h-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white" 
                style={{ width: `${monthlyMetrics.gender.malePer}%` }}
              >
                {monthlyMetrics.gender.malePer > 10 && `${Math.round(monthlyMetrics.gender.malePer)}%`}
              </div>
              <div 
                className="h-full bg-pink-500 flex items-center justify-center text-[10px] font-black text-white" 
                style={{ width: `${monthlyMetrics.gender.femalePer}%` }}
              >
                {monthlyMetrics.gender.femalePer > 10 && `${Math.round(monthlyMetrics.gender.femalePer)}%`}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Graphs (Grid layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payment Methods */}
          <div className="bg-gray-800 p-5 rounded-[28px] border-2 border-blue-500 shadow-lg space-y-4">
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
                    <div 
                      className={`h-full ${getPaymentBarColorClass(p.method)}`} 
                      style={{ width: `${p.percent}%` }} 
                    />
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
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-gray-800/50 rounded-t-sm relative group" style={{ height: '100%' }}>
                      <div 
                        className="absolute bottom-0 w-full bg-amber-500 rounded-t-sm transition-all duration-500" 
                        style={{ height: `${d.percent}%` }} 
                      />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400">{d.label}</span>
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
                      <div 
                        className={`w-1.5 rounded-full ${color}/40 transition-all duration-500`} 
                        style={{ height: `${Math.max(10, d.percent)}%` }}
                      >
                        <div className={`w-full h-full ${color} opacity-80`} />
                      </div>
                      <span className={`text-[9px] font-bold ${i===0||i===6 ? 'text-white':'text-gray-600'}`}>
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsView;
