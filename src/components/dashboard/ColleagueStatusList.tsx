// 同乗務者ステータスリストコンポーネント
// 同僚の稼働状況（売上、回数、配車状況、位置情報など）をリアルタイムで表示します。
// Firestore の public_status コレクションから多人数のシフトデータを監視し、
// テーブル形式で一覧表示し、クリックで詳細モーダルを開けます。
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPinned, Lock } from 'lucide-react';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { SalesRecord } from '@/types';
import { 
  formatCurrency, 
  getBusinessDate 
} from '@/utils';
import { SalesRecordCard } from '@/components/common/SalesRecordCard';

// ========== Types & Interfaces =========="

// 月別集計データ
interface MonthData {
    label: string;              // 表示用月ラベル（例: '2025年1月'）
    sortKey: string;             // ソート用キー
    sales: number;               // その月の売上合計
    records: SalesRecord[];       // その月の売上記録
    startStr: string;             // 月の開始日時文字列
    endStr: string;               // 月の終了日時文字列
}

// 同僚の稼働状況データ
export interface ColleagueData {
  uid: string;                        // ユーザーID（Firestore doc id）
  name: string;                       // 同僚の名前
  startTime: number;                  // シフト開始時刻（タイムスタンプ）
  plannedEndTime: number;             // 予定終了時刻（タイムスタンプ）
  sales: number;                      // 本日の売上合計（円）
  rideCount: number;                  // 本日の配車回数
  dispatchCount?: number;             // 本日の配車件数（オプション）
  status: 'active' | 'break' | 'offline' | 'completed' | 'riding'; // 現在のステータス
  records?: SalesRecord[];             // 当日の売上記録リスト（オプション）
  months?: Record<string, MonthData>;  // 月別の集計データ（オプション）
  currentMonthKey?: string;            // 現在の月キー（オプション）
  lastUpdated: number;                // 最後の更新時刻（タイムスタンプ）
  businessStartHour?: number;          // 業務開始時刻（時）- デフォルト9
  visibilityMode?: 'PUBLIC' | 'PRIVATE' | 'CUSTOM'; // 情報公開範囲
  allowedViewers?: string[];           // カスタム公開の場合の許可ユーザーID一覧
  // リアルタイム位置情報
  currentLocation?: {
      lat: number;                     // 緯度
      lng: number;                     // 経度
      timestamp: number;               // 位置情報取得時刻
  };
}

// 管理者メールアドレスリスト（これらのユーザーは全同僚の情報を見られる）
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// ========== 詳細モーダルコンポーネント ==========
// クリックされた同僚の詳細情報（直近の売上記録、位置情報など）をモーダルで表示します。
// Firestore から該当ユーザーの public_status ドキュメントをリアルタイムリッスンし、
// 売上記録と位置情報を更新します。

const ColleagueDetailModal: React.FC<{ 
    user: ColleagueData,        // 表示対象の同僚データ
    date: string,               // 表示日付文字列
    onClose: () => void         // モーダル閉じるコールバック
}> = ({ user, date, onClose }) => {
    // リアルタイム売上データと位置情報の状態
    const [realtimeData, setRealtimeData] = useState<{
        records: SalesRecord[], 
        total: number, 
        currentLocation?: { lat: number, lng: number, timestamp: number } 
    } | null>(null);

    // Firestore リアルタイムリスナー：public_status/{uid} のドキュメントを監視
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "public_status", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // 売上記録を取得（records がなければ recentRecords にフォールバック）
                const activeRecords: SalesRecord[] = data.records || data.recentRecords || [];
                
                // 過去の月別レコードを展開
                let pastRecords: SalesRecord[] = [];
                if (data.months) {
                     pastRecords = Object.values(data.months).flatMap((m: any) => m.records || []);
                }

                // 24時間以内のデータをフィルタリング
                const now = Date.now();
                const oneDayAgo = now - 24 * 60 * 60 * 1000;

                // 全レコード結合 → 24時間以内抽出 → 重複排除 → 時系列逆順ソート
                const allRecords = [...pastRecords, ...activeRecords]
                    .filter((r: SalesRecord) => r.timestamp > oneDayAgo)
                    .filter((r, index, self) => index === self.findIndex((t) => t.id === r.id))
                    .sort((a, b) => b.timestamp - a.timestamp);

                const total = allRecords.reduce((sum, r) => sum + r.amount, 0);
                
                setRealtimeData({ 
                    records: allRecords, 
                    total,
                    currentLocation: data.currentLocation 
                });
            } else {
                setRealtimeData({ records: [], total: 0 });
            }
        });

        return () => unsub();
    }, [user.uid]);

    // 位置情報の経過時間を計算（「今」「N分前」のように表示）
    const getLocationTimeDiff = () => {
        if (!realtimeData.currentLocation?.timestamp) return '';
        const diff = Math.floor((Date.now() - realtimeData.currentLocation.timestamp) / 60000);
        if (diff < 1) return '今';
        return `${diff}分前`;
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-6 text-white h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300 border-t border-gray-700">
                
                {/* ヘッダー：同僚名、日付、現在地ステータス */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2">
                            {user.name} <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{date}</span>
                        </h2>
                        {realtimeData.currentLocation && (
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                                <span className="text-xs text-green-400 font-bold">現在地発信中 ({getLocationTimeDiff()})</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95 transition-transform">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Googleマップへのリンク（位置情報がある場合） */}
                {realtimeData.currentLocation && (
                    <a 
                        href={`http://maps.google.com/maps?q=${realtimeData.currentLocation.lat},${realtimeData.currentLocation.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-6 flex items-center justify-center gap-2 w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-4 rounded-2xl border border-blue-500/50 font-black text-lg active:scale-95 transition-all shadow-lg"
                    >
                        <MapPinned className="w-6 h-6" />
                        Googleマップで現在地を見る
                    </a>
                )}
                
                {/* 日計・回数の概算表示 */}
                <div className="grid grid-cols-2 gap-4 mb-6 flex-shrink-0">
                    <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700 text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">日計</p>
                        <p className="text-2xl font-black text-amber-500">{formatCurrency(realtimeData.total)}</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700 text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">回数</p>
                        <p className="text-2xl font-black text-white">{realtimeData.records.length} <span className="text-sm text-gray-500">件</span></p>
                    </div>
                </div>

                {/* 売上記録詳細リスト（スクロール可能） */}
                <div className="flex-1 overflow-y-auto space-y-3 pb-safe pr-1 custom-scrollbar">
                    {realtimeData.records.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 font-bold">記録がありません</div>
                    ) : (
                        realtimeData.records.map((r, idx) => (
                            <div key={r.id} className="opacity-100">
                                <SalesRecordCard 
                                    record={r}
                                    index={realtimeData.records.length - idx}
                                    isDetailed={true}
                                    customLabels={{}} 
                                    businessStartHour={user.businessStartHour || 9}
                                    onClick={() => {}} 
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ========== ステータスリストコンポーネント ==========
// Firestore public_status コレクションをリアルタイム監視し、
// 全同僚のシフト状況をテーブル形式で表示します。
// 権限設定やフォローリストに基づいてデータを自動フィルタリングします。

export const ColleagueStatusList: React.FC<{ followingUsers: string[] }> = ({ followingUsers }) => {
  const { user } = useAuth();
  const [colleagues, setColleagues] = useState<ColleagueData[]>([]);
  const [selectedColleague, setSelectedColleague] = useState<ColleagueData | null>(null);

  // 営業日の切り替え時刻（12時）- この時刻で営業日が変わると見なす
  const SHARED_SWITCH_HOUR = 12;
  const currentUserId = user?.uid;
  const currentUserEmail = user?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  // Firestore リアルタイムリスナー：全同僚のデータを監視
  useEffect(() => {
    const q = query(collection(db, "public_status"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: ColleagueData[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as ColleagueData);
      });

      const now = Date.now();
      const currentDisplayDate = getBusinessDate(now, SHARED_SWITCH_HOUR);

      // ソート：データあり（降順）→ データなし、その中で売上高順
      users.sort((a, b) => {
        const aDate = a.startTime ? getBusinessDate(a.startTime, SHARED_SWITCH_HOUR) : '';
        const aHasData = aDate === currentDisplayDate || (a.sales > 0 && a.lastUpdated > now - 12 * 3600000);

        const bDate = b.startTime ? getBusinessDate(b.startTime, SHARED_SWITCH_HOUR) : '';
        const bHasData = bDate === currentDisplayDate || (b.sales > 0 && b.lastUpdated > now - 12 * 3600000);

        // データありが上
        if (aHasData && !bHasData) return -1;
        if (!aHasData && bHasData) return 1;
        
        // 売上降順
        return b.sales - a.sales;
      });

      setColleagues(users);
    });
    return () => unsubscribe();
  }, []);

  // タイムスタンプを HH:MM 形式にフォーマット
  const formatBusinessTimeStr = (timestamp: number) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const currentDisplayDate = getBusinessDate(Date.now(), SHARED_SWITCH_HOUR);

  // ステータスバッジをレンダリング（実車・空車・休憩・完了）
  const renderStatusBadge = (user: ColleagueData, hasDataToday: boolean) => {
      if (!hasDataToday) {
          return <span className="text-gray-500 font-bold text-sm whitespace-nowrap">－</span>;
      }

      switch (user.status) {
          case 'riding':
              return <span className="text-red-400 font-black text-sm whitespace-nowrap">実車</span>;
          case 'active':
              return <span className="text-blue-400 font-black text-sm whitespace-nowrap">空車</span>;
          case 'break':
              return <span className="text-amber-500 font-black text-sm whitespace-nowrap">休憩</span>;
          case 'completed':
          case 'offline':
              return (
                <span className="text-white font-black tracking-tighter whitespace-nowrap text-sm">
                  {formatBusinessTimeStr(user.plannedEndTime)}
                </span>
              );
          default:
              return <span className="text-blue-400 font-black text-sm whitespace-nowrap">空車</span>;
      }
  };

  // フィルタリングロジック：権限チェック、フォローリスト、公開設定
  const filteredColleagues = colleagues.filter(u => {
    // 自分は常に表示
    if (u.uid === currentUserId) return true;

    // フォローリストに含まれていない場合は非表示
    if (!followingUsers.includes(u.uid)) return false;

    // 管理者は全員表示
    if (isAdmin) return true;

    // 相手の公開設定チェック
    const mode = u.visibilityMode || 'PUBLIC'; 
    if (mode === 'PRIVATE') return false;
    
    // カスタム公開の場合は許可リストをチェック
    if (mode === 'CUSTOM') {
        return u.allowedViewers && u.allowedViewers.includes(currentUserId || '');
    }
    
    return true; 
  });

  // フィルタ後の同僚がいない場合は何も表示しない
  if (filteredColleagues.length === 0) return null;

  return (
    <>
        {/* ステータステーブル */}
        <div className="rounded-2xl overflow-hidden mb-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 font-sans border border-gray-700/50">
          {/* テーブルヘッダー */}
          <div className="bg-gradient-to-r from-[#1c2533] to-[#161e29] px-3 py-2.5 text-center border-b border-gray-700 relative">
             <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
             <div className="text-gray-200 font-black text-sm tracking-wide flex items-center justify-center gap-2">
                他担当の稼働状況 <span className="text-xs font-normal text-gray-400">({currentDisplayDate})</span>
             </div>
             <div className="text-gray-500 text-[10px] font-bold mt-0.5">
                行タップで詳細を表示
             </div>
          </div>

          <div className="overflow-x-auto bg-[#131C2B]">
            <table className="w-full text-center border-collapse">
              {/* テーブルヘッダー行 */}
              <thead>
                <tr className="bg-slate-900/80 text-xs uppercase tracking-wider border-b border-gray-700/50">
                  <th className="py-2 px-1 font-bold border-r border-gray-700/50 w-[20%] text-pink-300">担当</th>
                  <th className="py-2 px-1 font-bold border-r border-gray-700/50 text-blue-300">出庫</th>
                  <th className="py-2 px-1 font-bold border-r border-gray-700/50 text-green-300">状態</th>
                  <th className="py-2 px-1 font-bold border-r border-gray-700/50 text-yellow-300">回数</th>
                  <th className="py-2 px-1 font-bold border-r border-gray-700/50 text-orange-300">配車</th>
                  <th className="py-2 px-2 font-bold text-cyan-300">営収</th>
                </tr>
              </thead>

              {/* テーブルボディ：同僚一覧 */}
              <tbody className="text-sm text-gray-200">
                {filteredColleagues.map((user, idx) => {
                  const isMe = user.uid === currentUserId;
                  const userBusinessDate = user.startTime ? getBusinessDate(user.startTime, SHARED_SWITCH_HOUR) : '';
                  // 本日のデータがあるかチェック（シフト開始日が今日 or 12時間以内に更新）
                  const hasDataToday = userBusinessDate === currentDisplayDate || (user.sales > 0 && user.lastUpdated > Date.now() - 12 * 3600000);

                  // 行の背景色：自分は緑、奇数行は青、偶数行は紫のティント
                  const rowClass = isMe
                    ? 'bg-emerald-500/10 shadow-[inset_3px_0_0_#10b981] border-t border-b border-emerald-500/20' 
                    : idx % 2 === 0 
                        ? 'bg-blue-500/05' 
                        : 'bg-purple-500/05';

                  const nameClass = 'text-base font-bold text-white';
                  const dataClass = 'text-sm font-black text-white';
                  const salesClass = 'text-sm font-black text-white';

                  return (
                    <tr 
                        key={user.uid} 
                        className={`${rowClass} border-b border-gray-700/30 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors`}
                        onClick={() => setSelectedColleague(user)}
                    >
                      {/* 担当（名前） */}
                      <td className={`py-2 px-1 text-left truncate max-w-[80px] border-r border-gray-700/30 ${nameClass}`}>
                        {user.name}
                        {/* 管理者表示時：非公開フラグ */}
                        {isAdmin && user.visibilityMode === 'PRIVATE' && !isMe && <span className="text-[9px] text-red-400 block leading-none font-black scale-75 origin-left">[非公開]</span>}
                      </td>

                      {/* 出庫時刻 */}
                      <td className={`py-2 px-1 tracking-tighter border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? formatBusinessTimeStr(user.startTime) : '－'}
                      </td>

                      {/* ステータス（実車・空車・休憩・完了など） */}
                      <td className="py-2 px-1 font-medium tracking-tighter border-r border-gray-700/30">
                        {renderStatusBadge(user, hasDataToday)}
                      </td>

                      {/* 配車回数 */}
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? user.rideCount : 0}
                      </td>

                      {/* 配車件数 */}
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? (user.dispatchCount ?? '-') : 0}
                      </td>

                      {/* 本日営収 */}
                      <td className={`py-2 px-2 text-right tracking-tight ${salesClass}`}>
                        {(hasDataToday ? user.sales : 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* 詳細モーダル（クリックされた同僚の情報） */}
        {selectedColleague && (
            <ColleagueDetailModal 
                user={selectedColleague} 
                date={currentDisplayDate}
                onClose={() => setSelectedColleague(null)} 
            />
        )}
    </>
  );
};