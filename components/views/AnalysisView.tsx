import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trophy,
  Map,
  Crown,
  Medal,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { SalesRecord, MonthlyStats, PaymentMethod } from '../../types';
import { 
  getBillingPeriod, 
  formatCurrency, 
  PAYMENT_LABELS, 
  getPaymentColorClass,
  getBusinessDate,
  formatDate,
  RIDE_LABELS,
  getGoogleMapsUrl,
  filterRecordsWithSimpleModePriority
} from '../../utils';

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

// 乗降地のスクロールアニメーション用コンポーネント
const LocationScrollText: React.FC<{ text: string; isScrolling: boolean; cardId: string; onAnimationComplete: (id: string) => void }> = ({ text, isScrolling, cardId, onAnimationComplete }) => {
    const textRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [needsScroll, setNeedsScroll] = useState(false);
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (textRef.current && containerRef.current) {
            const textWidth = textRef.current.scrollWidth;
            const containerWidth = containerRef.current.clientWidth;
            setNeedsScroll(textWidth > containerWidth);
        }
    }, [text]);

    useEffect(() => {
        if (!needsScroll || !isScrolling) {
            // スクロールが停止した場合、リセット
            if (textRef.current) {
                textRef.current.style.transition = '';
                textRef.current.style.transform = '';
            }
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
                animationTimeoutRef.current = null;
            }
            return;
        }
        
        if (textRef.current && containerRef.current) {
            const textWidth = textRef.current.scrollWidth;
            const containerWidth = containerRef.current.clientWidth;
            const scrollDistance = textWidth - containerWidth;
            
            if (scrollDistance > 0) {
                // アニメーション開始（3倍速 = 約1.33秒）
                textRef.current.style.transition = 'transform 1.33s linear';
                textRef.current.style.transform = `translateX(-${scrollDistance}px)`;
                
                animationTimeoutRef.current = setTimeout(() => {
                    // アニメーション完了後、元の位置に戻す
                    if (textRef.current) {
                        textRef.current.style.transition = 'transform 0.3s ease-out';
                        textRef.current.style.transform = '';
                        onAnimationComplete(cardId);
                    }
                }, 1330);
            }
        }

        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, [isScrolling, needsScroll, cardId, onAnimationComplete]);

    return (
        <div ref={containerRef} className="overflow-hidden flex-1 min-w-0 opacity-70">
            <span ref={textRef} className="whitespace-nowrap inline-block">
                {text}
            </span>
        </div>
    );
};

const AnalysisView: React.FC<AnalysisViewProps> = ({ history, stats, onNavigateToHistory }) => {
  // --- State ---
  const [rankingTab, setRankingTab] = useState<'allTime' | 'monthly' | 'daily'>('allTime');
  const [publicStatusData, setPublicStatusData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyRankingData, setDailyRankingData] = useState<any[]>([]);
  // スクロールアニメーション用の状態管理（カードID → スクロール状態）
  const [scrollingCards, setScrollingCards] = useState<Record<string, boolean>>({});

  const businessStartHour = stats.businessStartHour ?? 9;
  const shimebiDay = stats.shimebiDay ?? 20;
  const currentUserId = auth.currentUser?.uid;
  const currentUserEmail = auth.currentUser?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  // --- Data Fetching ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      setPublicStatusData(users);
    });
    return () => unsub();
  }, []);

  // --- Logic: Rankings ---
  
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

  // 1. 歴代最高記録 (All-Time High) - サブコレクション対応
  const [allTimeRanking, setAllTimeRanking] = useState<RankingEntry[]>([]);
  
  useEffect(() => {
    const loadAllTimeRanking = async () => {
      try {
        let entries: RankingEntry[] = [];
        
        // 各ユーザーについて処理
        for (const user of publicStatusData.filter(shouldShowUserInRanking)) {
          let records: SalesRecord[] = [];
          
          // ★修正: 常にサブコレクションから読み込む（過去データの移行状況に関わらず）
          try {
            // サブコレクションから全データを取得（簡易モードを除外して上位20件）
            const subcollectionRef = collection(db, "public_status", user.uid, "history");
            const subcollectionQuery = query(subcollectionRef, orderBy('amount', 'desc'), limit(100));
            const subcollectionSnap = await getDocs(subcollectionQuery);
            
            const allRecords: SalesRecord[] = [];
            subcollectionSnap.forEach((doc) => {
              const record = doc.data() as SalesRecord;
              // 簡易モードを除外
              if (!record.remarks?.includes('簡易モード')) {
                allRecords.push(record);
              }
            });
            
            // 売上額の高い順にソートして上位20件を取得
            records = allRecords.sort((a, b) => b.amount - a.amount).slice(0, 20);
          } catch (subError: any) {
            console.warn(`[AnalysisView] Failed to load records from subcollection for user ${user.uid}:`, subError);
            // サブコレクションの読み込みに失敗した場合、topRecordsまたは配列形式から読み込む（後方互換性）
            if (user.topRecords && Array.isArray(user.topRecords) && user.topRecords.length > 0) {
              records = user.topRecords;
            } else if (user.history && Array.isArray(user.history) && user.history.length > 0) {
              records = user.history
                .filter((r: SalesRecord) => !r.remarks?.includes('簡易モード'))
                .sort((a: SalesRecord, b: SalesRecord) => b.amount - a.amount)
                .slice(0, 20);
            }
          }
          
          const userName = user.name || 'Unknown';
          const isMe = user.uid === currentUserId;
          if (Array.isArray(records)) {
            records.forEach(r => { entries.push({ ...r, userName, isMe }); });
          }
        }
        
        // 重複排除とソート
        const finalEntries = entries
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 20); // Top 20
        
        setAllTimeRanking(finalEntries);
      } catch (error) {
        console.error('[AnalysisView] Error loading all-time ranking:', error);
        setAllTimeRanking([]);
      }
    };
    
    if (publicStatusData.length > 0) {
      loadAllTimeRanking();
    } else {
      setAllTimeRanking([]);
    }
  }, [publicStatusData, currentUserId, stats.followingUsers, isAdmin]);

  // 2. 月間売上ランキング (Monthly Total)
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
          rideCount: u.rideCount || 0,
          isMe: u.uid === currentUserId
      }));
  }, [publicStatusData, currentUserId, stats.followingUsers, isAdmin]);

  // 3. 日別ランキングデータの取得
  useEffect(() => {
    if (rankingTab === 'daily') {
      const loadDailyRanking = async () => {
        try {
          const dateStr = getBusinessDate(selectedDate.getTime(), businessStartHour);
          const ranking: any[] = [];

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
                const dayRecords: SalesRecord[] = [];
                subcollectionSnap.forEach((doc) => {
                  const record = doc.data() as SalesRecord;
                  const recordDateStr = getBusinessDate(record.timestamp, businessStartHour);
                  if (recordDateStr === dateStr) {
                    dayRecords.push(record);
                  }
                });
                
                console.log(`[AnalysisView] User ${user.uid}, date ${dateStr}: Found ${dayRecords.length} records:`, 
                  dayRecords.map(r => ({ id: r.id, amount: r.amount, isSimple: r.remarks?.includes('簡易モード') })));
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, businessStartHour);
                console.log(`[AnalysisView] User ${user.uid}, date ${dateStr}: After filtering: ${filteredRecords.length} records, total:`, 
                  filteredRecords.reduce((sum, r) => sum + r.amount, 0));
                dayTotal = filteredRecords.reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
              } else {
                // サブコレクションにデータがない場合、配列形式から読み込む（後方互換性）
                const history = user.history || [];
                const dayRecords = history.filter((r: any) => {
                  const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
                  return recordDateStr === dateStr;
                });
                
                // ★修正: 簡易モード優先でフィルタリングしてから合計を計算
                const filteredRecords = filterRecordsWithSimpleModePriority(dayRecords, businessStartHour);
                dayTotal = filteredRecords.reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
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
                const dayTotal = filteredRecords.reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
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

  // 日付変更
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // --- Logic: Personal Analytics (Monthly) ---
  // 注意: monthlyMetricsは現在使用されていませんが、エラーを防ぐために残しています
  const targetDate = new Date(); // デフォルト値として現在の日付を使用
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
    <div className="p-4 pb-32 space-y-8 w-full overflow-hidden animate-in fade-in duration-500 bg-[#0A0E14] min-h-screen">
      
      {/* --- Section 1: Ranking Tabs & List --- */}
      <section className="space-y-4">
        {/* タイトル */}
        <div className="sticky top-0 z-20 bg-[#0A0E14] pb-2">
          <h2 className="text-2xl font-black text-white mb-3 tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#EAB308]" />
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              売上ランキング
            </span>
          </h2>
        </div>
        
        {/* 独立したボタン */}
        <div className="flex gap-2 sticky top-16 z-10">
            <button 
                onClick={() => setRankingTab('allTime')} 
                className={`flex-1 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg border-2 whitespace-nowrap ${
                  rankingTab === 'allTime' 
                    ? 'bg-[#EAB308] text-black border-[#EAB308] scale-[1.02] shadow-[#EAB308]/50' 
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                }`}
            >
                <Trophy className="w-4 h-4" /> 歴代最高記録
            </button>
            <button 
                onClick={() => setRankingTab('monthly')} 
                className={`flex-1 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg border-2 whitespace-nowrap ${
                  rankingTab === 'monthly' 
                    ? 'bg-blue-500 text-white border-blue-500 scale-[1.02] shadow-blue-500/50' 
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                }`}
            >
                <Crown className="w-4 h-4" /> 月間Rank
            </button>
            <button 
                onClick={() => setRankingTab('daily')} 
                className={`flex-1 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg border-2 whitespace-nowrap ${
                  rankingTab === 'daily' 
                    ? 'bg-purple-500 text-white border-purple-500 scale-[1.02] shadow-purple-500/50' 
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                }`}
            >
                <Calendar className="w-4 h-4" /> 日別Rank
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

        {/* Content */}
        <div className="space-y-3 min-h-[300px]">
            {rankingTab === 'allTime' && (
                // --- All Time Records ---
                allTimeRanking.length > 0 ? allTimeRanking.map((e, idx) => {
                    const cardId = `${e.id}-${idx}`;
                    const locationText = `${e.pickupLocation || '---'} → ${e.dropoffLocation || '---'}`;
                    const isScrolling = scrollingCards[cardId] || false;
                    
                    return (
                    <div 
                        key={cardId}
                        onClick={() => {
                            setScrollingCards(prev => ({
                                ...prev,
                                [cardId]: !prev[cardId]
                            }));
                        }}
                        className="cursor-pointer"
                    >
                        <div 
                            className={`group relative overflow-hidden bg-gray-800 border-2 ${e.isMe ? 'border-amber-500 bg-amber-900/10' : 'border-blue-500'} rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-blue-400`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                                idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-600 text-black shadow-lg shadow-amber-500/30' :
                                idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                                idx === 2 ? 'bg-gradient-to-br from-orange-700 to-orange-900 text-white border border-white/20' : 
                                'bg-gradient-to-br from-gray-600 to-gray-800 text-gray-300'
                            }`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0 z-10">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className={`text-[2.2rem] font-black tracking-tighter ${e.isMe ? 'text-amber-500' : 'text-white'}`}>
                                        {formatCurrency(e.amount)}
                                    </span>
                                    <span className="text-[15px] font-bold text-gray-500 uppercase">{formatDate(new Date(e.timestamp))}</span>
                                </div>
                                <div className="flex items-center gap-2 text-lg font-bold text-gray-400">
                                    <span className={`px-1.5 py-0.5 rounded text-[15px] uppercase border ${e.isMe ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-800 border-gray-700'}`}>
                                        {e.userName}
                                    </span>
                                    <LocationScrollText 
                                        text={locationText}
                                        isScrolling={isScrolling}
                                        cardId={cardId}
                                        onAnimationComplete={(id) => {
                                            setScrollingCards(prev => ({
                                                ...prev,
                                                [id]: false
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                            {e.isMe && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
                        </div>
                    </div>
                    );
                }) : (
                        <div className="text-center py-12 text-gray-600 font-bold bg-gray-800 rounded-3xl border-2 border-blue-500">
                            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>記録がありません</p>
                        </div>
                    )
            )}
            {rankingTab === 'monthly' && (
                monthlyRanking.length > 0 ? monthlyRanking.map((u, idx) => (
                    <div 
                        key={u.uid}
                        className={`group relative overflow-hidden bg-gray-800 border-2 ${u.isMe ? 'border-blue-500 bg-blue-900/10' : 'border-blue-500'} rounded-2xl p-4 flex items-center justify-between transition-all hover:border-blue-400`}
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
                         {/* Bar - 月間目標に対する進捗率 */}
                         <div 
                           className="absolute inset-y-0 left-0 bg-white/5 z-0 transition-all duration-1000 origin-left" 
                           style={{ width: `${Math.min(100, u.monthlyGoal > 0 ? (u.amount / u.monthlyGoal) * 100 : 0)}%` }}
                         />
                    </div>
                )) : (
                    <div className="text-center py-12 text-gray-600 font-bold bg-gray-900/50 rounded-3xl border border-gray-800">
                        <Crown className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>今月のデータがありません</p>
                    </div>
                )
            )}
            {rankingTab === 'daily' && (
                // --- Daily Ranking ---
                dailyRankingData.length > 0 ? dailyRankingData.map((u, idx) => (
                    <div 
                        key={u.uid}
                        className={`group relative overflow-hidden bg-gray-800 border-2 ${u.isMe ? 'border-orange-500 bg-orange-900/10' : 'border-blue-500'} rounded-2xl p-4 flex items-center justify-between transition-all hover:border-blue-400`}
                    >
                        <div className="flex items-center gap-4 z-10">
                            <div className={`text-xl font-black italic w-6 text-center ${idx < 3 ? 'text-white drop-shadow-md' : 'text-gray-600'}`}>
                                #{u.rank}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${u.isMe ? 'text-orange-400' : 'text-gray-200'}`}>{u.name}</span>
                                    {u.isMe && <span className="text-[9px] bg-orange-500 text-white px-1.5 rounded font-black">YOU</span>}
                                </div>
                            </div>
                        </div>
                        <div className="text-right z-10">
                            <p className="text-lg font-black text-white tracking-tight">{formatCurrency(u.amount)}</p>
                        </div>
                        {/* Bar */}
                        {dailyRankingData.length > 0 && (
                            <div 
                                className="absolute inset-y-0 left-0 bg-white/5 z-0 transition-all duration-1000 origin-left" 
                                style={{ width: `${Math.min(100, (u.amount / (dailyRankingData[0]?.amount || 1)) * 100)}%` }}
                            />
                        )}
                    </div>
                    )) : (
                        <div className="text-center py-12 text-gray-600 font-bold bg-gray-800 rounded-3xl border-2 border-blue-500">
                            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>この日のデータがありません</p>
                        </div>
                    )
            )}
        </div>
      </section>
    </div>
  );
};

export default AnalysisView;
