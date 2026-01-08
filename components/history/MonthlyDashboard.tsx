import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Database,
  ArrowUpDown,
  User as UserIcon
} from 'lucide-react';
import { SalesRecord, PaymentMethod } from '../../types';
import { 
  getBillingPeriod,
  formatDate,
  getBusinessDate,
  formatCurrency,
  calculateTaxAmount,
  getPaymentBreakdown,
  PAYMENT_LABELS,
  filterRecordsWithSimpleModePriority,
  getRideBreakdown,
  getRideCounts,
  RIDE_LABELS
} from '../../utils';
import { PaymentBreakdownList, getPaymentCounts } from './PaymentBreakdownList';
import { RideBreakdownList } from './RideBreakdownList';

interface MonthlyDashboardProps {
  displayMonth: Date;
  setCurrentMonth: (d: Date) => void;
  monthData: SalesRecord[];
  dailyGroups: [string, SalesRecord[]][];
  customLabels: Record<string, string>;
  onSelectDay: (date: string) => void;
  isMe: boolean;
  userName?: string;
  history: SalesRecord[];
  shimebiDay: number;
  businessStartHour: number;
  monthsData?: Record<string, any>; // ★追加: 事前計算済みの月別集計データ
}

const isDispatch = (r: SalesRecord) => r.rideType !== 'FLOW' && r.rideType !== 'WAIT';

export const MonthlyDashboard: React.FC<MonthlyDashboardProps> = ({
  displayMonth,
  setCurrentMonth,
  monthData,
  dailyGroups,
  customLabels,
  onSelectDay,
  isMe,
  userName,
  history,
  shimebiDay,
  businessStartHour,
  monthsData
}) => {
  const [isHistoryReversed, setIsHistoryReversed] = useState(true);
  const displayMonthStr = `${displayMonth.getFullYear()}年 ${displayMonth.getMonth() + 1}月度`;
  
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [tableTargetDate, setTableTargetDate] = useState(new Date());
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  React.useEffect(() => {
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
    
    // ★最適化: monthsDataがあればそれを優先使用、なければhistoryから計算
    const safeMonthsData = monthsData || {};
    const safeHistory = history || [];

    for (let m = 0; m < 12; m++) {
      const monthRefDate = new Date(currentYear, m, shimebiDay === 0 ? 28 : shimebiDay);
      const { start, end } = getBillingPeriod(monthRefDate, shimebiDay, businessStartHour);
      const adjustedEnd = new Date(end);
      if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
      
      const sortKey = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
      const cachedMonth = safeMonthsData[sortKey];
      
      let monthRecords: SalesRecord[] = [];
      let dutyDays = 0;
      let count = 0;
      let dispatch = 0;
      let sales = 0;
      
      // ★修正: monthsDataからrecordsは削除されているため、historyから期間内のデータを取得（簡易モード優先）
      const startStr = formatDate(start), endStr = formatDate(adjustedEnd);
      const periodRecords = safeHistory.filter(r => {
        const bDate = getBusinessDate(r.timestamp, businessStartHour);
        return bDate >= startStr && bDate <= endStr;
      });
      
      // 簡易モード優先でフィルタリング
      monthRecords = filterRecordsWithSimpleModePriority(periodRecords, businessStartHour);
      
      const uniqueDaysSet = new Set(monthRecords.map(r => getBusinessDate(r.timestamp, businessStartHour)));
      dutyDays = uniqueDaysSet.size;
      count = monthRecords.length;
      dispatch = monthRecords.filter(isDispatch).length;
      // monthsDataにsalesがある場合はそれを使用、なければ計算
      sales = cachedMonth?.sales ?? monthRecords.reduce((sum, r) => sum + r.amount, 0);
      
      totalDays += dutyDays;
      totalCount += count;
      totalDispatch += dispatch;
      totalSales += sales;
      
      months.push({
        label: `${m + 1}月`,
        fullLabel: `${currentYear}年${m + 1}月度`,
        referenceDate: monthRefDate,
        dutyDays,
        count,
        dispatch,
        sales,
        records: monthRecords
      });
    }
    
    return {
      yearLabel: `${currentYear}年度`,
      periodLabel: `${(shimebiDay === 0 ? currentYear : currentYear - 1)}年${(shimebiDay === 0 ? 1 : 12)}月度 〜 ${currentYear}年12月度`,
      months,
      totals: { dutyDays: totalDays, count: totalCount, dispatch: totalDispatch, sales: totalSales }
    };
  }, [history, monthsData, tableTargetDate, shimebiDay, businessStartHour]);

  const tableMonthlyData = useMemo(() => {
    const { start, end } = getBillingPeriod(tableTargetDate, shimebiDay, businessStartHour);
    const adjustedEnd = new Date(end);
    if (shimebiDay !== 0 && adjustedEnd.getDate() !== shimebiDay) {
      adjustedEnd.setDate(shimebiDay);
    }
    
    const startStr = formatDate(start), endStr = formatDate(adjustedEnd);
    const baseYearDate = getBillingMonthDate(tableTargetDate);
    const sortKey = `${baseYearDate.getFullYear()}-${String(baseYearDate.getMonth() + 1).padStart(2, '0')}`;
    
    // ★修正: monthsDataからrecordsは削除されているため、historyから期間内のデータを取得
    const safeMonthsData = monthsData || {};
    const cachedMonth = safeMonthsData[sortKey];
    
    // historyから期間内のデータを取得
    const safeHistory = history || [];
    const periodRecords = safeHistory.filter(r => {
      const bDate = getBusinessDate(r.timestamp, businessStartHour);
      return bDate >= startStr && bDate <= endStr;
    });
    
    // 簡易モード優先でフィルタリング
    const allRecords = filterRecordsWithSimpleModePriority(periodRecords, businessStartHour);

    const days = [];
    const curr = new Date(start);
    while (curr <= adjustedEnd) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const rows = days.map(day => {
      const dateStr = formatDate(day);
      // ★最適化: 事前フィルタリングされたrecordsを使用
      const dayRecords = allRecords.filter(r => 
        getBusinessDate(r.timestamp, businessStartHour) === dateStr
      );
      
      let startTimeStr = '—', endTimeStr = '—';
      if (dayRecords.length > 0) {
        const sorted = [...dayRecords].sort((a, b) => a.timestamp - b.timestamp);
        const formatBusinessTimeStr = (ts: number) => {
          const d = new Date(ts);
          return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        };
        startTimeStr = formatBusinessTimeStr(sorted[0].timestamp);
        endTimeStr = formatBusinessTimeStr(sorted[sorted.length - 1].timestamp);
      }
      
      return {
        dateStr,
        dateLabel: `${day.getMonth() + 1}/${day.getDate()}`,
        weekDay: day.getDay(),
        startTimeStr,
        endTimeStr,
        count: dayRecords.length,
        dispatch: dayRecords.filter(isDispatch).length,
        sales: dayRecords.reduce((sum, r) => sum + r.amount, 0),
        hasData: dayRecords.length > 0,
        records: dayRecords
      };
    });
    
    return {
      monthLabel: `${getBillingMonthDate(tableTargetDate).getFullYear()}年 ${getBillingMonthDate(tableTargetDate).getMonth() + 1}月度`,
      periodLabel: `${startStr} 〜 ${endStr}`,
      rows,
      totals: {
        workDays: rows.filter(r => r.hasData).length,
        count: rows.reduce((s, r) => s + r.count, 0),
        dispatch: rows.reduce((s, r) => s + r.dispatch, 0),
        sales: rows.reduce((s, r) => s + r.sales, 0)
      }
    };
  }, [history, monthsData, tableTargetDate, shimebiDay, businessStartHour]);

  const weekNames = ['日', '月', '火', '水', '木', '金', '土'];
  const weekColors = ['text-red-400', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-blue-400'];

  const sortedGroups = useMemo(() => {
    return [...dailyGroups].sort((a, b) => 
      isHistoryReversed ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
  }, [dailyGroups, isHistoryReversed]);

  const totalAmount = monthData.reduce((s, r) => s + r.amount, 0);
  const taxAmount = calculateTaxAmount(totalAmount);
  const breakdown = getPaymentBreakdown(monthData);
  const counts = getPaymentCounts(monthData);
  const avgAmount = monthData.length > 0 ? Math.round(totalAmount / monthData.length) : 0;
  const rideBreakdown = getRideBreakdown(monthData);
  const rideCounts = getRideCounts(monthData);

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
        <div className="flex bg-gray-800 p-1.5 rounded-2xl border-2 border-blue-500 shadow-sm">
          <button 
            onClick={() => { setViewMode('monthly'); setIsTableOpen(true); }} 
            className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${viewMode === 'monthly' ? 'bg-gray-700 text-amber-500 shadow-md border-2 border-amber-500' : 'text-gray-500'}`}
          >
            <Calendar className="w-4 h-4" /> 月間実績表
          </button>
          <button 
            onClick={() => { setViewMode('yearly'); setIsTableOpen(true); }} 
            className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${viewMode === 'yearly' ? 'bg-gray-700 text-blue-400 shadow-md border-2 border-blue-400' : 'text-gray-500'}`}
          >
            <Database className="w-4 h-4" /> 年間推移表
          </button>
        </div>

        <div className="space-y-0">
          <div 
            onClick={() => setIsTableOpen(!isTableOpen)}
            className={`rounded-t-2xl p-4 text-center shadow-lg cursor-pointer active:brightness-95 transition-all ${viewMode === 'monthly' ? 'bg-[#EAB308]' : 'bg-[#CC6600]'}`}
          >
            <div className={`flex justify-between items-center ${viewMode === 'monthly' ? 'text-black' : 'text-white'}`}>
              <button 
                onClick={(e) => { e.stopPropagation(); shiftPeriod(-1); }} 
                className="p-1 hover:bg-black/10 rounded-full active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tighter">
                    {viewMode === 'monthly' ? tableMonthlyData.monthLabel : `${yearlyData.yearLabel} 通期実績`}
                  </span>
                  {isTableOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                <span className={`text-xs font-bold opacity-80 ${viewMode === 'yearly' && 'text-orange-100'}`}>
                  {viewMode === 'monthly' ? tableMonthlyData.periodLabel : yearlyData.periodLabel}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); shiftPeriod(1); }} 
                  className="p-1 hover:bg-black/10 rounded-full active:scale-90"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className={`bg-gray-800 rounded-b-2xl overflow-hidden border-x-2 border-b-2 border-blue-500 shadow-2xl transition-all duration-300 ${isTableOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="overflow-x-auto">
              {viewMode === 'monthly' ? (
                <table className="w-full text-center text-base">
                  <thead>
                    <tr className="bg-[#0f371d] text-white text-sm border-b border-green-800/50">
                      <th className="py-3 px-1 font-bold w-[12%]">日付</th>
                      <th className="py-3 px-1 font-bold w-[10%]">曜</th>
                      <th className="py-3 px-1 font-bold w-[15%]">出庫</th>
                      <th className="py-3 px-1 font-bold w-[15%]">入庫</th>
                      <th className="py-3 px-1 font-bold w-[12%]">回数</th>
                      <th className="py-3 px-1 font-bold w-[12%]">配車</th>
                      <th className="py-3 px-2 font-bold w-[24%] text-right">営収</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300 font-medium text-base">
                    {tableMonthlyData.rows.map((row, i) => (
                      <tr 
                        key={i} 
                        className={`${i % 2 === 0 ? 'bg-[#1A222C]' : 'bg-[#151b24]'} border-b border-gray-800/50 hover:bg-white/5 cursor-pointer`}
                        onClick={() => row.hasData && onSelectDay(row.dateStr)}
                      >
                        <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${weekColors[row.weekDay]} ${row.hasData && 'underline decoration-amber-500/50'}`}>
                          {row.dateLabel}
                        </td>
                        <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${weekColors[row.weekDay]}`}>
                          {weekNames[row.weekDay]}
                        </td>
                        <td className={`py-3 px-1 font-mono tracking-tighter border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>
                          {row.startTimeStr}
                        </td>
                        <td className={`py-3 px-1 font-mono tracking-tighter border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>
                          {row.endTimeStr}
                        </td>
                        <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>
                          {row.hasData ? row.count : '-'}
                        </td>
                        <td className={`py-3 px-1 font-bold border-r border-gray-800/50 ${row.hasData ? 'text-white' : 'text-gray-600'}`}>
                          {row.hasData ? row.dispatch : '-'}
                        </td>
                        <td className={`py-3 px-2 text-right font-mono font-black tracking-tight ${row.sales > 0 ? 'text-amber-400' : 'text-gray-700'}`}>
                          {row.sales > 0 ? row.sales.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#EAB308] text-black font-black border-t-2 border-amber-600 text-lg">
                      <td className="py-3 px-1" colSpan={2}>合計</td>
                      <td className="py-3 px-1 text-base" colSpan={2}>{tableMonthlyData.totals.workDays}出番</td>
                      <td className="py-3 px-1">{tableMonthlyData.totals.count}</td>
                      <td className="py-3 px-1">{tableMonthlyData.totals.dispatch}</td>
                      <td className="py-3 px-2 text-right">{tableMonthlyData.totals.sales.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-center text-base">
                  <thead>
                    <tr className="bg-[#004d00] text-white text-sm border-b border-green-800/50">
                      <th className="py-3 px-2 font-bold w-[28%] whitespace-nowrap">月度</th>
                      <th className="py-3 px-2 font-bold w-[15%]">日数</th>
                      <th className="py-3 px-2 font-bold w-[15%]">件数</th>
                      <th className="py-3 px-2 font-bold w-[15%]">配車</th>
                      <th className="py-3 px-2 font-bold w-[27%] text-right">営収</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200 font-medium text-base">
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
                        <td className="py-3 px-2 font-bold text-blue-400 border-r border-gray-800/50 underline decoration-blue-500/30 whitespace-nowrap">
                          {m.fullLabel}
                        </td>
                        <td className="py-3 px-2 font-bold border-r border-gray-800/50">
                          {m.sales > 0 ? m.dutyDays : '-'}
                        </td>
                        <td className="py-3 px-2 font-bold border-r border-gray-800/50">
                          {m.sales > 0 ? m.count : '-'}
                        </td>
                        <td className="py-3 px-2 font-bold border-r border-gray-800/50">
                          {m.sales > 0 ? m.dispatch : '-'}
                        </td>
                        <td className={`py-3 px-2 text-right font-mono font-black tracking-tight ${m.sales > 0 ? 'text-white' : 'text-gray-700'}`}>
                          {m.sales > 0 ? m.sales.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#FFE4B5] text-black font-black border-t-2 border-orange-400 text-lg">
                      <td className="py-3 px-2">合計</td>
                      <td className="py-3 px-2">{yearlyData.totals.dutyDays}</td>
                      <td className="py-3 px-2">{yearlyData.totals.count.toLocaleString()}</td>
                      <td className="py-3 px-2">{yearlyData.totals.dispatch}</td>
                      <td className="py-3 px-2 text-right">{yearlyData.totals.sales.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-800 rounded-[24px] p-2 border-2 border-blue-500 shadow-inner relative">
        <button 
          onClick={() => setCurrentMonth(new Date(new Date(displayMonth).setMonth(displayMonth.getMonth()-1)))} 
          className="p-3 text-gray-400 active:scale-90 flex-shrink-0"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <button
          onClick={() => {
            setSelectedYear(null);
            setIsMonthPickerOpen(true);
          }}
          className="font-black text-[clamp(1.4rem,6vw,2rem)] text-white tracking-tight whitespace-nowrap hover:text-blue-400 transition-colors cursor-pointer"
        >
          {displayMonthStr}
        </button>
        <button 
          onClick={() => setCurrentMonth(new Date(new Date(displayMonth).setMonth(displayMonth.getMonth()+1)))} 
          className="p-3 text-gray-400 active:scale-90 flex-shrink-0"
        >
          <ChevronRight className="w-7 h-7" />
        </button>

        {/* 年月選択プルダウン */}
        {isMonthPickerOpen && (
          <>
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setIsMonthPickerOpen(false);
                setSelectedYear(null);
              }}
            />
            {/* プルダウンメニュー */}
            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 rounded-xl border-2 border-blue-500 shadow-2xl p-4 min-w-[280px] max-h-[400px] overflow-y-auto">
              <div className="text-sm font-bold text-blue-400 mb-3 text-center">年月を選択</div>
              <div className="space-y-4">
                {/* 年選択 */}
                <div>
                  <div className="text-xs text-gray-400 font-bold mb-2">年</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(() => {
                      const currentYearNum = new Date().getFullYear();
                      const yearsList: number[] = [];
                      for (let i = 0; i <= 5; i++) {
                        yearsList.push(currentYearNum - i);
                      }
                      const displayYear = selectedYear !== null ? selectedYear : displayMonth.getFullYear();
                      return yearsList.map(year => (
                        <button
                          key={year}
                          onClick={() => setSelectedYear(year)}
                          className={`px-3 py-2 rounded-lg text-sm font-black transition-colors ${
                            year === displayYear
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {year}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                {/* 月選択 */}
                <div>
                  <div className="text-xs text-gray-400 font-bold mb-2">月</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                      const targetYear = selectedYear !== null ? selectedYear : displayMonth.getFullYear();
                      const isCurrentMonth = month === displayMonth.getMonth() + 1 && targetYear === displayMonth.getFullYear();
                      return (
                        <button
                          key={month}
                          onClick={() => {
                            const targetDate = new Date(targetYear, month - 1, shimebiDay === 0 ? 28 : shimebiDay);
                            const { end } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
                            setCurrentMonth(end);
                            setIsMonthPickerOpen(false);
                            setSelectedYear(null);
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-black transition-colors ${
                            isCurrentMonth
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {month}月
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <section className="space-y-6">
        <div className="bg-[#1A222C] rounded-[32px] border border-gray-800 shadow-2xl relative overflow-hidden p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
          <p className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] mb-4 text-center">月間累計営収 (税込)</p>
          <div className="text-center mb-4">
            <span className="text-[clamp(2.5rem,12vw,5.5rem)] font-black text-amber-500 leading-none tracking-tighter">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-base font-bold text-gray-400">(内消費税 {formatCurrency(taxAmount)})</p>
            <p className="text-base font-bold text-gray-400">税抜 {formatCurrency(totalAmount - taxAmount)}</p>
          </div>
        </div>

        <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl">
          <PaymentBreakdownList 
            breakdown={breakdown} 
            counts={counts} 
            customLabels={safeCustomLabels} 
            enabledMethods={Object.keys(PAYMENT_LABELS) as PaymentMethod[]}
          />
        </div>

        <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl">
          <RideBreakdownList 
            breakdown={rideBreakdown} 
            counts={rideCounts} 
            enabledRideTypes={Object.keys(RIDE_LABELS) as any[]} 
          />
        </div>
      </section>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase px-1 tracking-widest flex justify-between items-center italic flex-wrap gap-2">
          <span>履歴リスト</span>
          <button 
            onClick={() => setIsHistoryReversed(!isHistoryReversed)} 
            className="text-[12px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full flex items-center gap-2 font-black active:scale-95 shadow-sm border border-gray-700 whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />最新から
          </button>
        </h3>
        <div className="space-y-3">
          {sortedGroups.length > 0 ? sortedGroups.slice(0, 100).map(([date, records]) => (
            <div 
              key={date} 
              onClick={() => onSelectDay(date)} 
              className="bg-[#1A222C] rounded-[24px] p-4 border border-gray-800 flex justify-between items-center active:bg-gray-800 transition-all shadow-md group cursor-pointer gap-3 w-full"
            >
              <div className="z-10 overflow-hidden min-w-0 flex-1">
                <p className="font-black text-white text-[clamp(1.2rem,6vw,1.6rem)] tracking-tight truncate">
                  {date}
                </p>
                <div className="flex gap-2 mt-1 items-center">
                  <p className="text-[12px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">
                    {records.length}回
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2 flex-shrink-0">
                <p className="font-black text-amber-500 text-[clamp(1.4rem,7vw,2rem)] truncate leading-tight">
                  {formatCurrency(records.reduce((sum, r) => sum + r.amount, 0))}
                </p>
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </div>
            </div>
          )) : (
            <p className="text-center text-gray-600 font-bold py-10 italic uppercase tracking-widest">
              No Data in this period
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
