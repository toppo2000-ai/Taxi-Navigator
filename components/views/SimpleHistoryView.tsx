import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Edit } from 'lucide-react';
import { SalesRecord, MonthlyStats } from '../../types';
import { getBusinessDate, formatDate, getBillingPeriod } from '../../utils';
import { onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
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
  startTime?: string; // 出庫時間
  endTime?: string; // 入庫時間
  hourlySales?: number; // 時間あたりの売上
}

export const SimpleHistoryView: React.FC<SimpleHistoryViewProps> = ({ stats, onEditRecord }) => {
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 降順（新しい順）がデフォルト
  const shimebiDay = parseInt(stats.shimebiDay?.toString() || '20');
  const businessStartHour = stats.businessStartHour ?? 9;
  // 営業期間の終了日（締め日がある月）を初期値とする
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const { start, end } = getBillingPeriod(now, shimebiDay, businessStartHour);
    console.log('[SimpleHistoryView] Initializing currentMonth:', {
      now: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`,
      billingPeriod: `${formatDate(start)} ～ ${formatDate(end)}`,
      end: `${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()}`
    });
    return end;
  });

  // 履歴データの読み込み
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setHistory([]);
      return;
    }

    // ★修正: public_statusサブコレクションから読み込む（App.tsxと同じ）
    const loadHistory = async () => {
      try {
        const subcollectionRef = collection(db, 'public_status', currentUid, 'history');
        const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
        const subcollectionSnap = await getDocs(subcollectionQuery);
        
        const records: SalesRecord[] = [];
        subcollectionSnap.forEach((doc) => {
          records.push(doc.data() as SalesRecord);
        });
        const simpleRecords = records
          .filter(r => r.remarks?.includes('簡易モード'))
          .sort((a, b) => a.timestamp - b.timestamp);
        setHistory(simpleRecords);
        console.log('[SimpleHistoryView] Loaded', simpleRecords.length, 'records from public_status subcollection (total:', records.length, ')');
      } catch (error) {
        console.error('[SimpleHistoryView] Error loading history:', error);
        setHistory([]);
      }
    };

    // 初回読み込み
    loadHistory();

    // ★修正: リアルタイム更新をpublic_statusサブコレクション対応に変更
    const subcollectionRef = collection(db, 'public_status', currentUid, 'history');
    const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(subcollectionQuery, (snap) => {
      const records: SalesRecord[] = [];
      snap.forEach((doc) => {
        records.push(doc.data() as SalesRecord);
      });
      const simpleRecords = records
        .filter(r => r.remarks?.includes('簡易モード'))
        .sort((a, b) => a.timestamp - b.timestamp);
      setHistory(simpleRecords);
      console.log('[SimpleHistoryView] Subcollection updated:', simpleRecords.length, 'simple mode records (total:', records.length, ')');
    }, (error) => {
      console.error('[SimpleHistoryView] Error in subcollection snapshot:', error);
      // エラー時は空配列を設定
      setHistory([]);
    });

    return () => unsubscribe();
  }, []);

  // 日別レコードを集計（営業期間ベース）
  const dailyRecords = useMemo(() => {
    const recordsMap: Record<string, DailyRecord[]> = {};

    // currentMonthは営業期間の終了日（締め日がある月）を表す
    // currentMonthから直接営業期間を計算（currentMonth自体が終了日なので、それを使って期間を逆算）
    const targetReferenceDate = new Date(
      currentMonth.getFullYear(), 
      currentMonth.getMonth(), 
      shimebiDay === 0 ? 28 : shimebiDay
    );
    // targetReferenceDateを使って営業期間を計算
    const { start: billingStart, end: billingEnd } = getBillingPeriod(targetReferenceDate, shimebiDay, businessStartHour);
    // adjustedEndは締め日に設定
    const adjustedEnd = new Date(billingEnd);
    if (shimebiDay !== 0) {
      adjustedEnd.setDate(shimebiDay);
      adjustedEnd.setHours(23, 59, 59, 999);
    }
    const billingStartStr = formatDate(billingStart);
    const billingEndStr = formatDate(adjustedEnd);

    // IDで重複排除（念のため）
    const uniqueHistory = Array.from(
      new Map(history.map(r => [r.id, r])).values()
    );

    uniqueHistory.forEach(record => {
      const dateStr = getBusinessDate(record.timestamp, businessStartHour);
      
      // 営業期間内のレコードのみをフィルタリング
      if (dateStr >= billingStartStr && dateStr <= billingEndStr) {
        const dateObj = new Date(record.timestamp);
        
        // remarksから乗車回数を抽出
        let rideCount = 0;
        const rideCountMatch = record.remarks?.match(/乗車回数=(\d+)/);
        if (rideCountMatch) {
          rideCount = parseInt(rideCountMatch[1], 10);
        }

        // remarksから出庫時間・入庫時間を抽出
        let startTime: string | undefined;
        let endTime: string | undefined;
        const startTimeMatch = record.remarks?.match(/出庫時間=(\d{2}:\d{2})/);
        const endTimeMatch = record.remarks?.match(/入庫時間=(\d{2}:\d{2})/);
        if (startTimeMatch) {
          startTime = startTimeMatch[1];
        }
        if (endTimeMatch) {
          endTime = endTimeMatch[1];
        }

        // 時間あたりの売上を計算（出庫時間と入庫時間がある場合）
        let hourlySales: number | undefined;
        if (startTime && endTime) {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          let workMinutes = endMinutes - startMinutes;
          // 日をまたぐ場合の処理
          if (workMinutes < 0) {
            workMinutes += 24 * 60;
          }
          if (workMinutes > 0) {
            const workHours = workMinutes / 60;
            hourlySales = Math.round(record.amount / workHours);
          }
        }

        // 同じ日付のレコードが既にある場合は、最新のもの（IDが大きいもの、またはタイムスタンプが新しいもの）を使用
        if (!recordsMap[dateStr]) {
          recordsMap[dateStr] = [];
        }

        // 同じIDのレコードが既に存在する場合はスキップ（重複防止）
        const existingRecord = recordsMap[dateStr].find(r => r.record.id === record.id);
        if (!existingRecord) {
          recordsMap[dateStr].push({
            date: dateStr,
            dateObj,
            rideCount,
            sales: record.amount,
            record,
            startTime,
            endTime,
            hourlySales
          });
        }
      }
    });

    // 日付順にソート（sortOrderに基づいて昇順/降順を切り替え）
    const sortedDates = Object.keys(recordsMap).sort((a, b) => {
      const dateA = new Date(a.replace(/\//g, '-'));
      const dateB = new Date(b.replace(/\//g, '-'));
      if (sortOrder === 'desc') {
        // 降順（新しい日付が上）
        return dateB.getTime() - dateA.getTime();
      } else {
        // 昇順（古い日付が上）
        return dateA.getTime() - dateB.getTime();
      }
    });

    // 同じ日付のレコードが複数ある場合、最新のもの（タイムスタンプが新しいもの）のみを使用
    const result = sortedDates.map(date => {
      const records = recordsMap[date];
      // タイムスタンプが新しい順にソートして、最初の1つだけを使用
      const sortedRecords = records.sort((a, b) => b.record.timestamp - a.record.timestamp);
      return sortedRecords[0];
    }).filter(Boolean); // undefinedを除外
    console.log('[SimpleHistoryView] Daily records:', {
      currentMonth: `${currentMonth.getFullYear()}/${currentMonth.getMonth() + 1}/${currentMonth.getDate()}`,
      targetReferenceDate: `${targetReferenceDate.getFullYear()}/${targetReferenceDate.getMonth() + 1}/${targetReferenceDate.getDate()}`,
      month: `${adjustedEnd.getFullYear()}年${adjustedEnd.getMonth() + 1}月`,
      billingPeriod: `${billingStartStr} ～ ${billingEndStr}`,
      count: result.length,
      records: result.map(r => r.date)
    });
    return result;
  }, [history, currentMonth, shimebiDay, businessStartHour, sortOrder]);

  // 月間統計を計算
  const monthlyStats = useMemo(() => {
    const totalSales = dailyRecords.reduce((sum, r) => sum + r.sales, 0);
    const totalRides = dailyRecords.reduce((sum, r) => sum + r.rideCount, 0);
    const dayCount = new Set(dailyRecords.map(r => r.date)).size;
    
    // 時間あたりの売上を計算（時間売りが入っている日の数値を全て合計して出勤数で割る）
    const recordsWithTime = dailyRecords.filter(r => r.hourlySales !== undefined);
    const totalHourlySales = recordsWithTime.reduce((sum, r) => sum + (r.hourlySales || 0), 0);
    const workDaysWithTime = recordsWithTime.length;
    const averageHourlySales = workDaysWithTime > 0 ? Math.round(totalHourlySales / workDaysWithTime) : 0;
    
    return {
      totalSales,
      averageSales: dayCount > 0 ? Math.round(totalSales / dayCount) : 0,
      totalRides,
      averageRides: dayCount > 0 ? Math.round(totalRides / dayCount) : 0,
      averageHourlySales
    };
  }, [dailyRecords]);

  // 月を変更（営業期間ベース）
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      // prevは既に営業期間の終了日（締め日がある月）を表している
      // 前後の営業期間の終了日を計算
      const targetDate = new Date(prev);
      if (direction === 'prev') {
        // 前の営業期間：終了日を1ヶ月前に移動
        targetDate.setMonth(targetDate.getMonth() - 1);
      } else {
        // 次の営業期間：終了日を1ヶ月後に移動
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      // その日付を基準に営業期間の終了日を取得（締め日に基づいて）
      const { end: newEnd } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
      return newEnd;
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

  // 表示する月は営業期間の終了月（締め日がある月）
  const monthDisplay = useMemo(() => {
    const targetReferenceDate = new Date(
      currentMonth.getFullYear(), 
      currentMonth.getMonth(), 
      shimebiDay === 0 ? 28 : shimebiDay
    );
    const { end } = getBillingPeriod(targetReferenceDate, shimebiDay, businessStartHour);
    const adjustedEnd = new Date(end);
    if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
    return `${adjustedEnd.getFullYear()}年${adjustedEnd.getMonth() + 1}月`;
  }, [currentMonth, shimebiDay, businessStartHour]);

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
          {monthlyStats.averageHourlySales > 0 && (
            <div className="mt-3">
              <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
                <div className="text-xs text-orange-400 font-bold mb-1">時間あたりの平均売上</div>
                <div className="text-xl font-black text-white">¥{monthlyStats.averageHourlySales.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        {/* 日別履歴リスト */}
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          {/* ソートボタン */}
          <div className="mb-4">
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="w-full py-4 px-4 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg active:scale-95"
            >
              {sortOrder === 'desc' ? (
                <>
                  <ChevronDown className="w-6 h-6 text-white" />
                  <span className="text-lg font-black text-white">新しい順（降順）</span>
                  <ChevronDown className="w-6 h-6 text-white" />
                </>
              ) : (
                <>
                  <ChevronUp className="w-6 h-6 text-white" />
                  <span className="text-lg font-black text-white">古い順（昇順）</span>
                  <ChevronUp className="w-6 h-6 text-white" />
                </>
              )}
            </button>
          </div>
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
                  <div className="flex flex-col gap-2">
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
                    {record.hourlySales !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-orange-400 font-bold whitespace-nowrap">時間あたりの売上</span>
                        <span className="text-lg font-black text-green-400 whitespace-nowrap">
                          {record.hourlySales.toLocaleString()}円
                        </span>
                      </div>
                    )}
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
