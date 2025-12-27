// ========== 売上分析コンポーネント ==========
// ランキング表示（歴代最高記録・月間ランキング）と個人の月間詳細分析（統計グラフ）を提供
// - 全時間帯ユーザーのトップ記録を表示
// - 月間売上ランキングの集計
// - 個人の月間売上・平均単価・要注意客率・男女比・決済方法別・時間帯別・曜日別の詳細分析
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
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
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
} from '@/utils';

// ========== 定数 ==========
// 管理者メールアドレスリスト（全機能アクセス権限）
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// ========== Props インターフェース ==========
interface AnalysisViewProps { 
  history: SalesRecord[];                           // 全売上記録の履歴
  stats: MonthlyStats;                              // 月間統計（業務開始時刻・〆日など）
  onNavigateToHistory: (date: string | Date) => void;  // 日付タップ時に履歴ビューに遷移
}

// ランキングエントリーの拡張型（ユーザー名とフラグを追加）
interface RankingEntry extends SalesRecord {
    userName: string;   // 記録者の名前
    isMe: boolean;      // 現在のユーザーか否か（自分の記録をハイライト）
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ history, stats, onNavigateToHistory }) => {
  // ========== 認証 ==========
  const { user } = useAuth();  // 現在のログインユーザー情報

  // ========== State 管理 ==========
  // ランキングタブ表示状態（歴代最高記録/月間ランキング）
  const [rankingTab, setRankingTab] = useState<'allTime' | 'monthly'>('allTime');
  
  // 月間分析対象の日付（月ナビゲーションで変更可能）
  const [targetDate, setTargetDate] = useState(new Date());
  
  // Firestore から取得した全ユーザーの公開ステータスデータ（topRecords, monthlyTotal など）
  const [publicStatusData, setPublicStatusData] = useState<any[]>([]);

  // ========== 定数抽出 ==========
  // 業務開始時刻（例：9時）- ビジネスデート計算用
  const businessStartHour = stats.businessStartHour ?? 9;
  
  // 〆日（例：20日）- 請求期間計算用
  const shimebiDay = stats.shimebiDay ?? 20;
  
  // 現在のユーザーID（ランキングで自分をハイライト判定用）
  const currentUserId = user?.uid;

  // ========== Effects ==========
  // Firestore の public_status コレクションをリアルタイムで監視
  // 全ユーザーの topRecords (歴代最高記録) と monthlyTotal (月間売上) を取得
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "public_status"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      setPublicStatusData(users);
    });
    return () => unsub();
  }, []);

  // ========== ロジック：月間ナビゲーション ==========
  // 分析対象月を前後に移動（delta=+1 で翌月、-1 で前月）
  const shiftMonth = (delta: number) => {
    const newDate = new Date(targetDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setTargetDate(newDate);
  };

  // 表示用の月ラベル（例："2025年 1月度"）
  const currentMonthLabel = useMemo(() => {
     const { end } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
     return `${end.getFullYear()}年 ${end.getMonth() + 1}月度`;
  }, [targetDate, shimebiDay, businessStartHour]);

  // ========== ロジック：ランキング計算 ==========
  
  // 1. 歴代最高記録ランキング（全ユーザーのトップ記録から Top 20）
  const allTimeRanking = useMemo(() => {
    let entries: RankingEntry[] = [];
    
    // 全ユーザーの topRecords を集約
    publicStatusData.forEach((u: any) => {
        const records: SalesRecord[] = u.topRecords || []; 
        const userName = u.name || 'Unknown';
        const isMe = u.uid === currentUserId; 
        if (Array.isArray(records)) {
            records.forEach(r => { entries.push({ ...r, userName, isMe }); });
        }
    });
    
    // 売上金額でソートし、トップ 20 を抽出
    return entries
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);
  }, [publicStatusData, currentUserId]);

  // 2. 月間売上ランキング（各ユーザーの monthlyTotal でランキング）
  const monthlyRanking = useMemo(() => {
    return [...publicStatusData]
      .sort((a, b) => (b.monthlyTotal || 0) - (a.monthlyTotal || 0))  // 月間売上で降順ソート
      .map((u, i) => ({ 
          uid: u.uid,
          rank: i + 1,                      // ランキング順位
          name: u.name || 'Unknown',        // ユーザー名
          amount: u.monthlyTotal || 0,      // 月間売上合計
          rideCount: u.rideCount || 0,      // 乗車回数
          isMe: u.uid === currentUserId     // 現在のユーザーか否か
      }));
  }, [publicStatusData, currentUserId]);

  // ========== ロジック：個人月間詳細分析 ==========
  const monthlyMetrics = useMemo(() => {
    // 請求期間の計算（〆日を考慮）
    const { start, end } = getBillingPeriod(targetDate, shimebiDay, businessStartHour);
    const adjustedEnd = new Date(end);
    if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
    
    const startStr = formatDate(start);
    const endStr = formatDate(adjustedEnd);

    // 対象期間の売上記録をフィルタリング
    const filteredRecords = history.filter(r => {
        const bDate = getBusinessDate(r.timestamp, businessStartHour);
        return bDate >= startStr && bDate <= endStr;
    });

    // 基本統計の計算
    const totalSales = filteredRecords.reduce((s, r) => s + r.amount, 0);  // 月間売上合計
    const count = filteredRecords.length;                                   // 乗車回数
    const avg = count > 0 ? totalSales / count : 0;                         // 平均単価
    const badCustomers = filteredRecords.filter(r => r.isBadCustomer).length;  // 要注意客の件数
    
    // 男女比の計算（乗客数で集計）
    let male = 0, female = 0;
    filteredRecords.forEach(r => { 
      male += (r.passengersMale || 0);
      female += (r.passengersFemale || 0);
    });
    const totalPax = male + female;
    
    // 決済方法別の売上内訳
    const payMap: Record<string, number> = {}; 
    let payTotal = 0;
    filteredRecords.forEach(r => { 
        const val = r.amount + r.toll;  // 売上 + 料金
        payMap[r.paymentMethod] = (payMap[r.paymentMethod] || 0) + val; 
        payTotal += val; 
    });
    // 決済方法ごとの割合を計算
    const paymentData = Object.entries(payMap)
        .sort(([, a], [, b]) => b - a)  // 金額の大きい順
        .map(([method, amount]) => ({ 
            method: method as PaymentMethod, 
            amount, 
            percent: payTotal > 0 ? (amount / payTotal) * 100 : 0 
        }));

    // 時間帯別売上（3時間ごとに集計）
    const hours = Array(8).fill(0);
    filteredRecords.forEach(r => { 
      hours[Math.floor(new Date(r.timestamp).getHours() / 3)] += r.amount; 
    });
    const maxHourVal = Math.max(...hours, 1);
    const hourlyData = hours.map((val, i) => ({ 
        label: ["0-3", "3-6", "6-9", "9-12", "12-15", "15-18", "18-21", "21-24"][i], 
        value: val, 
        percent: (val / maxHourVal) * 100 
    }));

    // 曜日別売上（日～土）
    const days = Array(7).fill(0);
    filteredRecords.forEach(r => { 
      days[new Date(r.timestamp).getDay()] += r.amount; 
    });
    const maxDayVal = Math.max(...days, 1);
    const dayOfWeekData = days.map((val, i) => ({ 
      value: val, 
      percent: (val / maxDayVal) * 100 
    }));

    // 計算結果をまとめて返す
    return {
        totalSales,                                    // 月間売上合計
        count,                                         // 乗車回数
        avg,                                           // 平均単価
        badCustomers,                                  // 要注意客の件数
        badCustomerRate: count > 0 ? (badCustomers / count) * 100 : 0,  // 要注意客率（%）
        gender: {                                      // 男女比
          male,                                        // 男性乗客数
          female,                                      // 女性乗客数
          total: totalPax,                             // 総乗客数
          malePer: totalPax > 0 ? (male/totalPax)*100 : 0,      // 男性割合（%）
          femalePer: totalPax > 0 ? (female/totalPax)*100 : 0   // 女性割合（%）
        },
        paymentData,                                   // 決済方法別内訳
        hourlyData,                                    // 時間帯別売上
        dayOfWeekData,                                 // 曜日別売上
        records: filteredRecords                       // フィルタ済みの売上記録一覧
    };
  }, [history, targetDate, shimebiDay, businessStartHour]);

  // ========== JSX レンダリング準備 ==========
  // 曜日名の配列（日～土）
  const weekNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="p-4 pb-32 space-y-8 w-full overflow-hidden animate-in fade-in duration-500">
      
      {/* ========== セクション 1：ランキング表示 ========== */}
      <section className="space-y-4">
        {/* ランキング表示方式の選択タブ */}
        <div className="flex bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 backdrop-blur-sm sticky top-0 z-20 shadow-lg">
            {/* 歴代最高記録タブ */}
            <button 
                onClick={() => setRankingTab('allTime')} 
                className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${rankingTab === 'allTime' ? 'bg-[#EAB308] text-black shadow-lg scale-[1.02]' : 'text-gray-500 hover:bg-white/5'}`}
            >
                <Trophy className="w-4 h-4" /> 歴代最高記録
            </button>
            {/* 月間ランキングタブ */}
            <button 
                onClick={() => setRankingTab('monthly')} 
                className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap ${rankingTab === 'monthly' ? 'bg-blue-500 text-white shadow-lg scale-[1.02]' : 'text-gray-500 hover:bg-white/5'}`}
            >
                <Crown className="w-4 h-4" /> 月間ランキング
            </button>
        </div>

        {/* ランキング内容の表示 */}
        <div className="space-y-3 min-h-[300px]">
            {/* 歴代最高記録の表示 */}
            {rankingTab === 'allTime' ? (
                // 歴代最高記録一覧（売上金額でソート）
                allTimeRanking.length > 0 ? allTimeRanking.map((e, idx) => (
                    <div 
                        key={`${e.id}-${idx}`}
                        className={`group relative overflow-hidden bg-[#1A222C] border ${e.isMe ? 'border-amber-500/50 bg-amber-900/10' : 'border-gray-800'} rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-gray-600`}
                    >
                        {/* ランキング順位バッジ（1位：金、2位：銀、3位：銅） */}
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
                // 月間ランキング一覧（各ユーザーの月間売上でランキング）
                monthlyRanking.length > 0 ? monthlyRanking.map((u, idx) => (
                    <div 
                        key={u.uid}
                        className={`group relative overflow-hidden bg-[#1A222C] border ${u.isMe ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-800'} rounded-2xl p-4 flex items-center justify-between transition-all hover:border-gray-600`}
                    >
                         {/* ユーザー情報と売上を表示 */}
                         <div className="flex items-center gap-4 z-10">
                            {/* 順位表示（トップ3は強調） */}
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
                         {/* 順位1位と比較したプログレスバー */}
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

      {/* ========== セクション 2：個人月間詳細分析 ========== */}
      <section className="space-y-5 pt-8 border-t border-gray-800">
         
         {/* 月間分析のヘッダー（月ナビゲーション付き） */}
         <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2 italic uppercase tracking-tighter">
               <Activity className="w-5 h-5 text-indigo-500" /> 月間詳細分析
            </h3>
            {/* 月ナビゲーション（前月/翌月切り替え） */}
            <div className="flex items-center bg-gray-900 rounded-full border border-gray-800 p-1">
                {/* 前月ボタン */}
                <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-black text-white px-2 tabular-nums">{currentMonthLabel}</span>
                {/* 翌月ボタン */}
                <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 active:scale-90 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>

         {/* 1. 主要統計グリッド */}
         <div className="grid grid-cols-2 gap-3">
             {/* 月間総売上（大きく表示） */}
             <div className="col-span-2 bg-gradient-to-br from-[#1A222C] to-[#131a22] p-5 rounded-[28px] border border-gray-800 shadow-xl relative overflow-hidden">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-amber-500" /> 総売上</p>
                <p className="text-[clamp(2.5rem,10vw,3.5rem)] font-black text-white leading-none tracking-tighter">{formatCurrency(monthlyMetrics.totalSales)}</p>
                <div className="absolute top-4 right-4 opacity-10"><BarChart2 className="w-24 h-24 text-white" /></div>
             </div>
             
             {/* 平均単価 */}
             <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex flex-col justify-center min-h-[100px]">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">平均単価</p>
                <p className="text-xl font-black text-indigo-300 tracking-tight">{formatCurrency(Math.round(monthlyMetrics.avg))}</p>
             </div>
             {/* 乗車回数 */}
             <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex flex-col justify-center min-h-[100px]">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">乗車回数</p>
                <p className="text-xl font-black text-white tracking-tight">{monthlyMetrics.count}<span className="text-sm text-gray-500 ml-1">回</span></p>
             </div>
         </div>

         {/* 2. 要注意客率と男女比 */}
         <div className="grid grid-cols-1 gap-3">
            {/* 要注意客率 */}
            <div className="bg-[#1A222C] p-4 rounded-[24px] border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* 警告アイコン */}
                    <div className="p-2 bg-red-900/20 rounded-xl border border-red-900/30"><Skull className="w-5 h-5 text-red-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">要注意客率</p>
                        <p className="text-lg font-black text-white">{monthlyMetrics.badCustomerRate.toFixed(1)}% <span className="text-[10px] text-gray-500">({monthlyMetrics.badCustomers}件)</span></p>
                    </div>
                </div>
            </div>

            {/* 男女比 */}
            <div className="bg-[#1A222C] p-5 rounded-[24px] border border-gray-800 space-y-3">
                {/* 男女比ラベル */}
                <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-pink-400" /> 男女比 (総数 {monthlyMetrics.gender.total}名)</span>
                </div>
                {/* 男女比の視覚化（プログレスバー） */}
                <div className="h-6 w-full flex rounded-full overflow-hidden bg-gray-900 border border-gray-800">
                     {/* 男性比率（青） */}
                     <div className="h-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${monthlyMetrics.gender.malePer}%` }}>
                        {monthlyMetrics.gender.malePer > 10 && `${Math.round(monthlyMetrics.gender.malePer)}%`}
                     </div>
                     {/* 女性比率（ピンク） */}
                     <div className="h-full bg-pink-500 flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${monthlyMetrics.gender.femalePer}%` }}>
                        {monthlyMetrics.gender.femalePer > 10 && `${Math.round(monthlyMetrics.gender.femalePer)}%`}
                     </div>
                </div>
            </div>
         </div>

         {/* 3. グラフ表示（決済方法・時間帯・曜日） */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* 決済方法別内訳グラフ */}
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

             {/* 時間帯別・曜日別売上トレンド */}
             <div className="bg-[#1A222C] p-5 rounded-[28px] border border-gray-800 shadow-lg space-y-6">
                
                {/* 時間帯別売上（3時間ごと） */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" /> 時間帯別
                    </h4>
                    {/* 時間帯別の棒グラフ */}
                    <div className="h-24 flex items-end gap-1">
                        {monthlyMetrics.hourlyData.map((d, i) => (
                            <div key={i} className="flex-1 bg-gray-800/50 rounded-t-sm relative group">
                                <div className="absolute bottom-0 w-full bg-amber-500/80 rounded-t-sm transition-all duration-500" style={{ height: `${d.percent}%` }} />
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 曜日別売上 */}
                <div className="space-y-3 pt-2 border-t border-gray-800/50">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" /> 曜日別
                    </h4>
                    {/* 曜日別の棒グラフ（日曜：赤、土曜：青、平日：緑） */}
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

// ========== エクスポート ==========
// AnalysisViewコンポーネント をデフォルトエクスポート

export default AnalysisView;