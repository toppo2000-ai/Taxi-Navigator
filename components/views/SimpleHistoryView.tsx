import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Edit } from 'lucide-react';
import { SalesRecord, MonthlyStats } from '../../types';
import { getBusinessDate, formatDate, getBillingPeriod } from '../../utils';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

interface SimpleHistoryViewProps {
  stats: MonthlyStats;
  onEditRecord?: (record: SalesRecord) => void;
  onBack?: () => void;
}

interface DailyRecord {
  date: string;
  dateObj: Date;
  rideCount: number;
  sales: number;
  record: SalesRecord;
}

export const SimpleHistoryView: React.FC<SimpleHistoryViewProps> = ({ stats, onEditRecord }) => {
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const businessStartHour = stats.businessStartHour ?? 9;

  // 履歴データの読み込み
  useEffect(() => {
    const userRef = doc(db, 'users', auth.currentUser?.uid || '');
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const records: SalesRecord[] = data.history || [];
        // 簡易モードのレコードのみをフィルタリング
        const simpleRecords = records.filter(r => r.remarks?.includes('簡易モード'));
        console.log('[SimpleHistoryView] Loaded records:', {
          total: records.length,
          simple: simpleRecords.length,
          records: simpleRecords
        });
        setHistory(simpleRecords);
      } else {
        console.log('[SimpleHistoryView] User document does not exist');
        setHistory([]);
      }
    }, (error) => {
      console.error('[SimpleHistoryView] Error loading history:', error);
      setHistory([]);
    });

    return () => unsubscribe();
  }, []);

  // 日別レコードを集計
  const dailyRecords = useMemo(() => {
    const recordsMap: Record<string, DailyRecord[]> = {};

    history.forEach(record => {
      const dateStr = getBusinessDate(record.timestamp, businessStartHour);
      const recordDate = new Date(record.timestamp);
      
      // 月の範囲チェック（営業日基準で判定）
      const recordYear = recordDate.getFullYear();
      const recordMonth = recordDate.getMonth();
      const currentYear = currentMonth.getFullYear();
      const currentMonthIndex = currentMonth.getMonth();
      
      if (recordYear === currentYear && recordMonth === currentMonthIndex) {
        const dateObj = new Date(record.timestamp);
        
        // remarksから乗車回数を抽出
        let rideCount = 0;
        const rideCountMatch = record.remarks?.match(/乗車回数=(\d+)/);
        if (rideCountMatch) {
          rideCount = parseInt(rideCountMatch[1], 10);
        }

        if (!recordsMap[dateStr]) {
          recordsMap[dateStr] = [];
        }

        recordsMap[dateStr].push({
          date: dateStr,
          dateObj,
          rideCount,
          sales: record.amount,
          record
        });
      }
    });

    // 日付順にソート（新しい日付が上）
    const sortedDates = Object.keys(recordsMap).sort((a, b) => {
      const dateA = new Date(a.replace(/\//g, '-'));
      const dateB = new Date(b.replace(/\//g, '-'));
      return dateB.getTime() - dateA.getTime();
    });

    const result = sortedDates.map(date => recordsMap[date]).flat();
    console.log('[SimpleHistoryView] Daily records:', {
      month: `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`,
      count: result.length,
      records: result
    });
    return result;
  }, [history, currentMonth, businessStartHour]);

  // 月間統計を計算
  const monthlyStats = useMemo(() => {
    const totalSales = dailyRecords.reduce((sum, r) => sum + r.sales, 0);
    const totalRides = dailyRecords.reduce((sum, r) => sum + r.rideCount, 0);
    const dayCount = new Set(dailyRecords.map(r => r.date)).size;
    
    return {
      totalSales,
      averageSales: dayCount > 0 ? Math.round(totalSales / dayCount) : 0,
      totalRides,
      averageRides: dayCount > 0 ? Math.round(totalRides / dayCount) : 0
    };
  }, [dailyRecords]);

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  // 日付フォーマット（曜日付き）
  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr.replace(/\//g, '-'));
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日(${weekday})`;
  };

  const monthDisplay = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  return (
    <div className="w-full bg-[#0A0E14] min-h-screen pb-32">
      {/* ヘッダー */}
      <div className="bg-[#0A0E14] border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="w-8"></div>
        <h1 className="text-lg font-black text-white">営業履歴</h1>
        <div className="w-8"></div>
      </div>

      <div className="p-4 space-y-4">
        {/* 月選択 */}
        <div className="flex items-center justify-center">
          <button
            onClick={() => changeMonth('prev')}
            className="p-2 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="mx-4 px-4 py-2 border-2 border-orange-500 rounded-lg bg-white flex items-center gap-2">
            <span className="text-base font-black text-gray-900">{monthDisplay}</span>
            <div className="flex flex-col">
              <ChevronUp className="w-3 h-3 text-gray-600" />
              <ChevronDown className="w-3 h-3 text-gray-600" />
            </div>
          </div>
          <button
            onClick={() => changeMonth('next')}
            className="p-2 text-gray-400 hover:text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 月間サマリー */}
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h2 className="text-base font-black text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-500" />
            サマリー
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <div className="text-xs text-orange-400 font-bold mb-1">売上合計</div>
              <div className="text-xl font-black text-white">¥{monthlyStats.totalSales.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <div className="text-xs text-orange-400 font-bold mb-1">1日平均</div>
              <div className="text-xl font-black text-white">¥{monthlyStats.averageSales.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <div className="text-xs text-orange-400 font-bold mb-1">回数合計</div>
              <div className="text-xl font-black text-white">{monthlyStats.totalRides}回</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <div className="text-xs text-orange-400 font-bold mb-1">平均回数</div>
              <div className="text-xl font-black text-white">{monthlyStats.averageRides}回</div>
            </div>
          </div>
        </div>

        {/* 日別履歴リスト */}
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="space-y-3">
            {dailyRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-900/50 rounded-2xl border border-gray-800">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-bold">この月のデータがありません</p>
              </div>
            ) : (
              dailyRecords.map((record, index) => (
                <div
                  key={`${record.date}-${index}`}
                  className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50 hover:border-orange-500 transition-colors shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg font-black text-white">
                      {formatDateWithDay(record.date)}
                    </div>
                    {onEditRecord && (
                      <button
                        onClick={() => onEditRecord(record.record)}
                        className="px-4 py-2 bg-orange-500 rounded-lg text-sm font-black text-white hover:bg-orange-600 transition-colors active:scale-95 shadow-md whitespace-nowrap"
                      >
                        変更
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-orange-400 font-bold whitespace-nowrap">回数</span>
                      <span className="text-lg font-black text-white whitespace-nowrap">
                        {record.rideCount}回
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-orange-400 font-bold whitespace-nowrap">売上</span>
                      <span className="text-lg font-black text-yellow-400 whitespace-nowrap">
                        {record.sales.toLocaleString()}円
                      </span>
                    </div>
                  </div>
                </div>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
