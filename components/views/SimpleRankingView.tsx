import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Crown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, onSnapshot, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { MonthlyStats } from '../../types';
import { formatCurrency, formatDate, getBusinessDate, filterRecordsWithSimpleModePriority } from '../../utils';

interface SimpleRankingViewProps {
  stats: MonthlyStats;
}

interface RankingEntry {
  uid: string;
  rank: number;
  name: string;
  amount: number;
  monthlyGoal?: number; // 日別ランキングでは未定義
  isMe: boolean;
}

// ★管理者設定
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

export const SimpleRankingView: React.FC<SimpleRankingViewProps> = ({ stats }) => {
  const [rankingTab, setRankingTab] = useState<'monthly' | 'daily'>('monthly');
  const [publicStatusData, setPublicStatusData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyRankingData, setDailyRankingData] = useState<any[]>([]);

  const businessStartHour = stats.businessStartHour ?? 9;
  const currentUserId = auth.currentUser?.uid;
  const currentUserEmail = auth.currentUser?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  // public_statusの監視
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      setPublicStatusData(users);
    });
    return () => unsub();
  }, []);

  // フィルタリング関数（管理者以外のランキング表示を制限）
  const shouldShowUserInRanking = (user: any): boolean => {
    // 自分は常に表示
    if (user.uid === currentUserId) return true;
    
    // 管理者は全員表示
    if (isAdmin) return true;
    
    // フォローリストに含まれていない場合は非表示
    if (!stats.followingUsers.includes(user.uid)) return false;
    
    // 相手の公開設定をチェック
    const mode = user.visibilityMode || 'PUBLIC';
    
    if (mode === 'PRIVATE') return false;
    
    if (mode === 'CUSTOM') {
      return user.allowedViewers && user.allowedViewers.includes(currentUserId || '');
    }
    
    return true; // PUBLIC
  };

  // 日別ランキングデータの取得
  useEffect(() => {
    if (rankingTab === 'daily') {
      const loadDailyRanking = async () => {
        try {
          // 選択された日付を営業開始時刻に設定してから営業日を計算
          // これにより、1/4を選択した場合は1/4の営業分（1/4 9:00～1/5 8:59）を取得
          const selectedDateWithBusinessHour = new Date(selectedDate);
          selectedDateWithBusinessHour.setHours(businessStartHour, 0, 0, 0);
          const dateStr = getBusinessDate(selectedDateWithBusinessHour.getTime(), businessStartHour);
          const ranking: RankingEntry[] = [];

          // publicStatusDataが空の場合は早期リターン
          if (publicStatusData.length === 0) {
            console.log('[SimpleRankingView] publicStatusData is empty');
            setDailyRankingData([]);
            return;
          }

          // 選択日の開始時刻と終了時刻を計算
          // 選択された日付の営業開始時刻から、次の日の営業開始時刻の1ミリ秒前まで
          // 例：12/26 9:00 ～ 12/27 8:59:59.999（12/26 32:59:59.999）
          const selectedDateStart = new Date(selectedDate);
          selectedDateStart.setHours(businessStartHour, 0, 0, 0);
          const selectedDateEnd = new Date(selectedDateStart);
          selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
          selectedDateEnd.setHours(businessStartHour, 0, 0, 0);
          selectedDateEnd.setMilliseconds(selectedDateEnd.getMilliseconds() - 1);
          const startTimestamp = selectedDateStart.getTime();
          const endTimestamp = selectedDateEnd.getTime();

          console.log(`[SimpleRankingView] Selected date: ${formatDate(selectedDate)}, Business date: ${dateStr}`);
          console.log(`[SimpleRankingView] Timestamp range: ${new Date(startTimestamp).toISOString()} to ${new Date(endTimestamp).toISOString()}`);
          console.log(`[SimpleRankingView] Start: ${formatDate(selectedDateStart)} ${selectedDateStart.getHours()}:00, End: ${formatDate(selectedDateEnd)} ${selectedDateEnd.getHours()}:00`);

          const filteredUsers = publicStatusData.filter(shouldShowUserInRanking);
          console.log(`[SimpleRankingView] Date: ${dateStr}, Total users: ${publicStatusData.length}, Filtered users: ${filteredUsers.length}`);

          // 各ユーザーについてサブコレクションからデータを取得
          for (const user of filteredUsers) {
            try {
              let dayTotal = 0;
              let dayRecords: any[] = [];
              
              // 各ユーザーの営業開始時刻を取得（デフォルトは自分の営業開始時刻）
              const userBusinessStartHour = user.businessStartHour ?? businessStartHour;
              
              // このユーザーの営業日を計算（ユーザーの営業開始時刻を使用）
              const userSelectedDateWithBusinessHour = new Date(selectedDate);
              userSelectedDateWithBusinessHour.setHours(userBusinessStartHour, 0, 0, 0);
              const userDateStr = getBusinessDate(userSelectedDateWithBusinessHour.getTime(), userBusinessStartHour);
              
              // このユーザーのタイムスタンプ範囲を計算
              const userSelectedDateStart = new Date(selectedDate);
              userSelectedDateStart.setHours(userBusinessStartHour, 0, 0, 0);
              const userSelectedDateEnd = new Date(userSelectedDateStart);
              userSelectedDateEnd.setDate(userSelectedDateEnd.getDate() + 1);
              userSelectedDateEnd.setHours(userBusinessStartHour, 0, 0, 0);
              userSelectedDateEnd.setMilliseconds(userSelectedDateEnd.getMilliseconds() - 1);
              const userStartTimestamp = userSelectedDateStart.getTime();
              const userEndTimestamp = userSelectedDateEnd.getTime();
              
              console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), businessStartHour: ${userBusinessStartHour}, business date: ${userDateStr}`);
              console.log(`[SimpleRankingView] User ${user.name}, timestamp range: ${new Date(userStartTimestamp).toISOString()} to ${new Date(userEndTimestamp).toISOString()}`);
              
              // まずサブコレクションからデータを取得を試みる
              try {
                const subcollectionRef = collection(db, "public_status", user.uid, "history");
                
                // まずorderByなしでクエリを試す（インデックスエラーを回避）
                let subcollectionSnap;
                try {
                  const subcollectionQuery = query(
                    subcollectionRef,
                    where('timestamp', '>=', userStartTimestamp),
                    where('timestamp', '<=', userEndTimestamp),
                    orderBy('timestamp', 'asc')
                  );
                  subcollectionSnap = await getDocs(subcollectionQuery);
                } catch (indexError: any) {
                  // インデックスエラーの場合、orderByなしでクエリを試す
                  console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), index error, trying without orderBy:`, indexError?.code);
                  const subcollectionQueryWithoutOrder = query(
                    subcollectionRef,
                    where('timestamp', '>=', userStartTimestamp),
                    where('timestamp', '<=', userEndTimestamp)
                  );
                  subcollectionSnap = await getDocs(subcollectionQueryWithoutOrder);
                }

                if (!subcollectionSnap.empty) {
                  // サブコレクションから選択日のデータを取得
                  const allRecordsInRange: any[] = [];
                  subcollectionSnap.forEach((doc) => {
                    const record = doc.data() as any;
                    allRecordsInRange.push(record);
                    // このユーザーの営業開始時刻を使って営業日を計算
                    const recordDateStr = getBusinessDate(record.timestamp, userBusinessStartHour);
                    if (recordDateStr === userDateStr) {
                      dayRecords.push(record);
                    }
                  });
                  
                  console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Found ${allRecordsInRange.length} records in timestamp range, ${dayRecords.length} records match business date`);
                  console.log(`[SimpleRankingView] User ${user.name}, records in range:`, allRecordsInRange.map(r => ({ 
                    timestamp: new Date(r.timestamp).toISOString(), 
                    businessDate: getBusinessDate(r.timestamp, userBusinessStartHour),
                    amount: r.amount, 
                    isSimple: r.remarks?.includes('簡易モード') 
                  })));
                  console.log(`[SimpleRankingView] User ${user.name}, matching records:`, dayRecords.map(r => ({ id: r.id, amount: r.amount, isSimple: r.remarks?.includes('簡易モード') })));
                  
                  // タイムスタンプ範囲のクエリが空の場合、または営業日に一致するレコードが少ない場合、全件スキャンも試す
                  // これは、タイムスタンプ範囲のクエリがインデックスエラーなどで正しく動作していない可能性があるため
                  if (dayRecords.length === 0 || allRecordsInRange.length < 5) {
                    console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Trying full scan as backup`);
                    try {
                      const allRecordsQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
                      const allRecordsSnap = await getDocs(allRecordsQuery);
                      if (!allRecordsSnap.empty) {
                        const fullScanRecords: any[] = [];
                        allRecordsSnap.forEach((doc) => {
                          const record = doc.data() as any;
                          // このユーザーの営業開始時刻を使って営業日を計算
                          const recordDateStr = getBusinessDate(record.timestamp, userBusinessStartHour);
                          if (recordDateStr === userDateStr) {
                            fullScanRecords.push(record);
                          }
                        });
                        // 全件スキャンで見つかったレコードを追加（重複排除は後で行う）
                        dayRecords.push(...fullScanRecords);
                        console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Found ${fullScanRecords.length} additional records from full subcollection scan`);
                      }
                    } catch (fullScanError: any) {
                      console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), full scan error:`, fullScanError?.code);
                    }
                  }
                } else {
                  console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Subcollection query returned empty`);
                  
                  // クエリが空の場合、全件取得してからフィルタリングを試す
                  try {
                    const allRecordsQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
                    const allRecordsSnap = await getDocs(allRecordsQuery);
                    if (!allRecordsSnap.empty) {
                      allRecordsSnap.forEach((doc) => {
                        const record = doc.data() as any;
                        // このユーザーの営業開始時刻を使って営業日を計算
                        const recordDateStr = getBusinessDate(record.timestamp, userBusinessStartHour);
                        if (recordDateStr === userDateStr) {
                          dayRecords.push(record);
                        }
                      });
                      console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Found ${dayRecords.length} records from full subcollection scan`);
                    }
                  } catch (fullScanError: any) {
                    console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), full scan error:`, fullScanError?.code);
                  }
                }
              } catch (subcollectionError: any) {
                console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), subcollection query error:`, subcollectionError?.code, subcollectionError?.message);
                // サブコレクションのクエリが失敗した場合、配列形式から読み込む
              }
              
              // サブコレクションからデータが取得できなかった場合、配列形式から読み込む（後方互換性）
              if (dayRecords.length === 0) {
                const history = user.history || [];
                dayRecords = history.filter((r: any) => {
                  // このユーザーの営業開始時刻を使って営業日を計算
                  const recordDateStr = getBusinessDate(r.timestamp, userBusinessStartHour);
                  return recordDateStr === userDateStr;
                });
                
                console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: Found ${dayRecords.length} records from history array`);
              }
              
              // 重複排除（同じIDのレコードが複数ある場合、最初の1つだけを使用）
              const uniqueRecordsMap: Record<string, any> = {};
              dayRecords.forEach((r: any) => {
                if (r.id && !uniqueRecordsMap[r.id]) {
                  uniqueRecordsMap[r.id] = r;
                } else if (!r.id) {
                  // IDがない場合はタイムスタンプで重複排除
                  const key = `${r.timestamp}_${r.amount}_${r.pickupLocation || ''}`;
                  if (!uniqueRecordsMap[key]) {
                    uniqueRecordsMap[key] = r;
                  }
                }
              });
              const uniqueDayRecords = Object.values(uniqueRecordsMap);
              
              console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), date ${userDateStr}: After deduplication: ${uniqueDayRecords.length} records (was ${dayRecords.length})`);
              console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), records before filtering:`, uniqueDayRecords.map(r => ({ id: r.id, amount: r.amount, isSimple: r.remarks?.includes('簡易モード') })));
              
              // ★修正: 簡易モード優先でフィルタリングしてから合計を計算（このユーザーの営業開始時刻を使用）
              const filteredRecords = filterRecordsWithSimpleModePriority(uniqueDayRecords, userBusinessStartHour);
              dayTotal = filteredRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
              console.log(`[SimpleRankingView] User ${user.name}, after filtering: ${filteredRecords.length} records, total: ${dayTotal}`);
              console.log(`[SimpleRankingView] User ${user.name}, filtered records:`, filteredRecords.map(r => ({ id: r.id, amount: r.amount, isSimple: r.remarks?.includes('簡易モード') })));

              if (dayTotal > 0) {
                ranking.push({
                  uid: user.uid,
                  rank: 0, // 後でソートして設定
                  name: user.name || 'Unknown',
                  amount: dayTotal,
                  isMe: user.uid === currentUserId,
                });
                console.log(`[SimpleRankingView] Added user ${user.name} to ranking with amount: ${dayTotal}`);
              }
            } catch (userError: any) {
              console.error(`[SimpleRankingView] Error processing user ${user.name} (${user.uid}):`, userError);
              // インデックスエラーの場合、配列形式から読み込む（後方互換性）
              if (userError?.code === 'failed-precondition' || userError?.code === 'unavailable') {
                const userBusinessStartHour = user.businessStartHour ?? businessStartHour;
                const userSelectedDateWithBusinessHour = new Date(selectedDate);
                userSelectedDateWithBusinessHour.setHours(userBusinessStartHour, 0, 0, 0);
                const userDateStr = getBusinessDate(userSelectedDateWithBusinessHour.getTime(), userBusinessStartHour);
                
                const history = user.history || [];
                const dayRecords = history.filter((r: any) => {
                  const recordDateStr = getBusinessDate(r.timestamp, userBusinessStartHour);
                  return recordDateStr === userDateStr;
                });
                
                console.log(`[SimpleRankingView] User ${user.name} (${user.uid}), fallback to history array: Found ${dayRecords.length} records`);
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算（このユーザーの営業開始時刻を使用）
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, userBusinessStartHour);
                const dayTotal = filteredRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                console.log(`[SimpleRankingView] User ${user.name}, after filtering: ${filteredRecords.length} records, total: ${dayTotal}`);
                if (dayTotal > 0) {
                  ranking.push({
                    uid: user.uid,
                    rank: 0,
                    name: user.name || 'Unknown',
                    amount: dayTotal,
                    isMe: user.uid === currentUserId,
                  });
                  console.log(`[SimpleRankingView] Added user ${user.name} to ranking with amount: ${dayTotal}`);
                }
              }
            }
          }

          console.log(`[SimpleRankingView] Final ranking count: ${ranking.length}`);

          // ソートしてランク付け
          ranking.sort((a, b) => b.amount - a.amount);
          ranking.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          setDailyRankingData(ranking);
        } catch (error) {
          console.error('日別ランキング取得エラー:', error);
        }
      };

      loadDailyRanking();
    }
  }, [rankingTab, selectedDate, publicStatusData, businessStartHour, currentUserId, stats.followingUsers, isAdmin]);

  // 月間ランキング
  const monthlyRanking = useMemo(() => {
    return [...publicStatusData]
      .filter(shouldShowUserInRanking)
      .sort((a, b) => (b.monthlyTotal || 0) - (a.monthlyTotal || 0))
      .map((u, i) => ({
        uid: u.uid,
        rank: i + 1,
        name: u.name || 'Unknown',
        amount: u.monthlyTotal || 0,
        monthlyGoal: u.monthlyGoal || 1000000, // デフォルト100万円
        isMe: u.uid === currentUserId,
      }));
  }, [publicStatusData, currentUserId, stats.followingUsers, isAdmin]);

  // 日付変更
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const renderRankingList = (ranking: RankingEntry[]) => {
    if (ranking.length === 0) {
      return (
        <div className="text-center py-12 text-gray-600 font-bold bg-gray-900/50 rounded-3xl border border-gray-800">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>データがありません</p>
        </div>
      );
    }

    return ranking.map((entry, idx) => (
      <div
        key={entry.uid}
        className={`group relative overflow-hidden bg-[#1A222C] border ${
          entry.isMe ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-800'
        } rounded-2xl p-4 flex items-center justify-between transition-all hover:border-gray-600`}
      >
        <div className="flex items-center gap-4 z-10">
          <div
            className={`text-xl font-black italic w-6 text-center ${
              idx < 3 ? 'text-white drop-shadow-md' : 'text-gray-600'
            }`}
          >
            #{entry.rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold ${
                  entry.isMe ? 'text-blue-400' : 'text-gray-200'
                }`}
              >
                {entry.name}
              </span>
              {entry.isMe && (
                <span className="text-[9px] bg-blue-500 text-white px-1.5 rounded font-black">
                  YOU
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right z-10">
          <p className="text-lg font-black text-white tracking-tight">
            {formatCurrency(entry.amount)}
          </p>
        </div>
        {/* Bar - 月間目標に対する進捗率（月間ランキング）または1位に対する相対比率（日別ランキング） */}
        <div
          className="absolute inset-y-0 left-0 bg-white/5 z-0 transition-all duration-1000 origin-left"
          style={{
            width: `${Math.min(
              100,
              entry.monthlyGoal && entry.monthlyGoal > 0
                ? (entry.amount / entry.monthlyGoal) * 100 // 月間ランキング：月間目標に対する進捗率
                : ranking.length > 0
                  ? (entry.amount / (ranking[0]?.amount || 1)) * 100 // 日別ランキング：1位に対する相対比率
                  : 0
            )}%`,
          }}
        />
      </div>
    ));
  };

  return (
    <div className="p-4 pb-32 space-y-6 w-full overflow-hidden animate-in fade-in duration-500">
      {/* タブ */}
      <div className="flex bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 backdrop-blur-sm sticky top-0 z-20 shadow-lg">
        <button
          onClick={() => setRankingTab('monthly')}
          className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${
            rankingTab === 'monthly'
              ? 'bg-blue-500 text-white shadow-lg scale-[1.02]'
              : 'text-gray-500 hover:bg-white/5'
          }`}
        >
          <Crown className="w-4 h-4" /> 月間ランキング
        </button>
        <button
          onClick={() => setRankingTab('daily')}
          className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${
            rankingTab === 'daily'
              ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
              : 'text-gray-500 hover:bg-white/5'
          }`}
        >
          <Calendar className="w-4 h-4" /> 日別ランキング
        </button>
      </div>

      {/* 日別ランキングの日付選択 */}
      {rankingTab === 'daily' && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 text-center">
              <input
                type="date"
                value={formatDate(selectedDate).replace(/\//g, '-')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white font-black text-center focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ランキングリスト */}
      <div className="space-y-3 min-h-[300px]">
        {rankingTab === 'monthly'
          ? renderRankingList(monthlyRanking)
          : renderRankingList(dailyRankingData)}
      </div>
    </div>
  );
};
