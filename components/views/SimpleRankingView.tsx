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
          const dateStr = getBusinessDate(selectedDate.getTime(), businessStartHour);
          const ranking: RankingEntry[] = [];

          // 選択日の開始時刻と終了時刻を計算
          const selectedDateStart = new Date(selectedDate);
          selectedDateStart.setHours(businessStartHour, 0, 0, 0);
          const selectedDateEnd = new Date(selectedDateStart);
          selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
          const startTimestamp = selectedDateStart.getTime();
          const endTimestamp = selectedDateEnd.getTime() - 1;

          // 各ユーザーについてサブコレクションからデータを取得
          for (const user of publicStatusData.filter(shouldShowUserInRanking)) {
            try {
              // サブコレクションから選択日のデータを取得
              const subcollectionRef = collection(db, "public_status", user.uid, "history");
              const subcollectionQuery = query(
                subcollectionRef,
                where('timestamp', '>=', startTimestamp),
                where('timestamp', '<=', endTimestamp),
                orderBy('timestamp', 'asc')
              );
              const subcollectionSnap = await getDocs(subcollectionQuery);

              let dayTotal = 0;
              if (!subcollectionSnap.empty) {
                // サブコレクションから選択日のデータを取得
                const dayRecords: any[] = [];
                subcollectionSnap.forEach((doc) => {
                  const record = doc.data() as any;
                  const recordDateStr = getBusinessDate(record.timestamp, businessStartHour);
                  if (recordDateStr === dateStr) {
                    dayRecords.push(record);
                  }
                });
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, businessStartHour);
                dayTotal = filteredRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
              } else {
                // サブコレクションにデータがない場合、配列形式から読み込む（後方互換性）
                const history = user.history || [];
                const dayRecords = history.filter((r: any) => {
                  const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
                  return recordDateStr === dateStr;
                });
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, businessStartHour);
                dayTotal = filteredRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
              }

              if (dayTotal > 0) {
                ranking.push({
                  uid: user.uid,
                  rank: 0, // 後でソートして設定
                  name: user.name || 'Unknown',
                  amount: dayTotal,
                  isMe: user.uid === currentUserId,
                });
              }
            } catch (userError: any) {
              // インデックスエラーの場合、配列形式から読み込む（後方互換性）
              if (userError?.code === 'failed-precondition') {
                const history = user.history || [];
                const dayRecords = history.filter((r: any) => {
                  const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
                  return recordDateStr === dateStr;
                });
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, businessStartHour);
                const dayTotal = filteredRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                if (dayTotal > 0) {
                  ranking.push({
                    uid: user.uid,
                    rank: 0,
                    name: user.name || 'Unknown',
                    amount: dayTotal,
                    isMe: user.uid === currentUserId,
                  });
                }
              }
            }
          }

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
