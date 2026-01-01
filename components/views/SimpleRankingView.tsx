import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Crown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { MonthlyStats } from '../../types';
import { formatCurrency, formatDate, getBusinessDate } from '../../utils';

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

export const SimpleRankingView: React.FC<SimpleRankingViewProps> = ({ stats }) => {
  const [rankingTab, setRankingTab] = useState<'monthly' | 'daily'>('monthly');
  const [publicStatusData, setPublicStatusData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyRankingData, setDailyRankingData] = useState<any[]>([]);

  const businessStartHour = stats.businessStartHour ?? 9;
  const currentUserId = auth.currentUser?.uid;

  // public_statusの監視
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      setPublicStatusData(users);
    });
    return () => unsub();
  }, []);

  // 日別ランキングデータの取得
  useEffect(() => {
    if (rankingTab === 'daily') {
      const loadDailyRanking = async () => {
        try {
          const dateStr = getBusinessDate(selectedDate.getTime(), businessStartHour);
          const ranking: RankingEntry[] = [];

          // 各ユーザーのpublic_statusからhistoryを取得して、選択日のデータを抽出
          for (const user of publicStatusData) {
            const history = user.history || [];
            const dayRecords = history.filter((r: any) => {
              const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
              return recordDateStr === dateStr;
            });

            if (dayRecords.length > 0) {
              const dayTotal = dayRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
              if (dayTotal > 0) {
                ranking.push({
                  uid: user.uid,
                  rank: 0, // 後でソートして設定
                  name: user.name || 'Unknown',
                  amount: dayTotal,
                  isMe: user.uid === currentUserId,
                });
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
  }, [rankingTab, selectedDate, publicStatusData, businessStartHour, currentUserId]);

  // 月間ランキング
  const monthlyRanking = useMemo(() => {
    return [...publicStatusData]
      .sort((a, b) => (b.monthlyTotal || 0) - (a.monthlyTotal || 0))
      .map((u, i) => ({
        uid: u.uid,
        rank: i + 1,
        name: u.name || 'Unknown',
        amount: u.monthlyTotal || 0,
        monthlyGoal: u.monthlyGoal || 1000000, // デフォルト100万円
        isMe: u.uid === currentUserId,
      }));
  }, [publicStatusData, currentUserId]);

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
