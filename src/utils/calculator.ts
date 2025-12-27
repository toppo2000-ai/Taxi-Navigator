import { MonthlyStats, SalesRecord, Shift } from '@/types';
import { getBillingPeriod, formatDate, getBusinessDate } from './date';

// 請求期間の統計情報を計算
export const calculatePeriodStats = (
  monthlyStats: MonthlyStats,
  history: SalesRecord[],
  shift: Shift | null
) => {
  const startHour = monthlyStats.businessStartHour ?? 9;
  const { start, end } = getBillingPeriod(new Date(), monthlyStats.shimebiDay, startHour);
  const adjustedEnd = new Date(end);
  if (monthlyStats.shimebiDay !== 0) adjustedEnd.setDate(monthlyStats.shimebiDay);
  
  const startDateStr = formatDate(start);
  const endDateStr = formatDate(adjustedEnd);
  
  // 履歴と現在のシフトのレコードを結合
  const allRecords = [...history, ...(shift?.records || [])];
  
  // 請求期間内の有効なレコードをフィルタ
  const validRecords = allRecords.filter(r => {
    const rDate = getBusinessDate(r.timestamp, startHour);
    return rDate >= startDateStr && rDate <= endDateStr;
  });

  // 合計売上と乗車件数を計算
  const totalSales = validRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalRides = validRecords.length;

  return {
    totalSales,
    totalRides,
    validRecords,
    startDateStr,
    endDateStr
  };
};
