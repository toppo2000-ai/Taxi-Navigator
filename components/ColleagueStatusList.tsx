import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPinned, Lock } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SalesRecord } from '../types';
import { 
  formatCurrency, 
  getBusinessDate 
} from '../utils';
import { SalesRecordCard } from './HistoryView';

// --- Types & Interfaces ---

interface MonthData {
    label: string;
    sortKey: string;
    sales: number;
    records: SalesRecord[];
    startStr: string;
    endStr: string;
}

export interface ColleagueData {
  uid: string;
  name: string;
  startTime: number;
  plannedEndTime: number;
  sales: number;
  rideCount: number;
  dispatchCount?: number;
  status: 'active' | 'break' | 'offline' | 'completed' | 'riding'; 
  records?: SalesRecord[]; 
  months?: Record<string, MonthData>; 
  currentMonthKey?: string; 
  lastUpdated: number;
  businessStartHour?: number;
  visibilityMode?: 'PUBLIC' | 'PRIVATE' | 'CUSTOM';
  allowedViewers?: string[];
  // 追加: 位置情報用
  currentLocation?: {
      lat: number;
      lng: number;
      timestamp: number;
  };
}

const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

// --- Colleague Detail Modal ---

const ColleagueDetailModal: React.FC<{ 
    user: ColleagueData, 
    date: string, 
    onClose: () => void 
}> = ({ user, date, onClose }) => {
    
    // ★修正: usersコレクションをリッスンするのではなく、
    // 親から渡された user オブジェクト (public_status由来) を使用する
    const realtimeData = useMemo(() => {
        // public_statusにあるデータを使用
        const activeRecords = user.records || [];
        
        // 過去データ（months）がある場合、それらも考慮して直近24時間を算出
        let pastRecords: SalesRecord[] = [];
        if (user.months) {
             pastRecords = Object.values(user.months).flatMap(m => m.records);
        }

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        // activeRecords と pastRecords を結合し、重複排除して24時間以内をフィルタ
        const allRecords = [...pastRecords, ...activeRecords]
            .filter((r: SalesRecord) => r.timestamp > oneDayAgo)
            // 重複排除（IDがある場合）
            .filter((r, index, self) => index === self.findIndex((t) => t.id === r.id))
            .sort((a: SalesRecord, b: SalesRecord) => b.timestamp - a.timestamp);

        const total = allRecords.reduce((sum: number, r: SalesRecord) => sum + r.amount, 0);
        
        return { 
            records: allRecords, 
            total: user.sales || total, // user.salesがあればそれを優先（同期ズレ防止）
            currentLocation: user.currentLocation
        };
    }, [user]);

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
                
                {/* ヘッダー部分 */}
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
                
                {/* マップリンク */}
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
                
                {/* 概算データグリッド */}
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

                {/* 詳細リスト表示エリア */}
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

// --- Colleague Status List Component ---

export const ColleagueStatusList: React.FC<{ followingUsers: string[] }> = ({ followingUsers }) => {
  const [colleagues, setColleagues] = useState<ColleagueData[]>([]);
  const [selectedColleague, setSelectedColleague] = useState<ColleagueData | null>(null);

  const SHARED_SWITCH_HOUR = 12;
  const currentUserId = auth.currentUser?.uid;
  const currentUserEmail = auth.currentUser?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  useEffect(() => {
    const q = query(collection(db, "public_status"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: ColleagueData[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as ColleagueData);
      });

      const now = Date.now();
      const currentDisplayDate = getBusinessDate(now, SHARED_SWITCH_HOUR);

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

  const formatBusinessTimeStr = (timestamp: number) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const currentDisplayDate = getBusinessDate(Date.now(), SHARED_SWITCH_HOUR);

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

  // ★フィルタリングロジック
  const filteredColleagues = colleagues.filter(u => {
    if (u.uid === currentUserId) return true; // 自分は表示

    // 1. フォローリストに含まれていない場合は非表示
    if (!followingUsers.includes(u.uid)) return false;

    // 2. 権限チェック
    if (isAdmin) return true; // 管理者は全員表示

    // 3. 相手の公開設定チェック
    const mode = u.visibilityMode || 'PUBLIC'; 
    if (mode === 'PRIVATE') return false;
    
    if (mode === 'CUSTOM') {
        return u.allowedViewers && u.allowedViewers.includes(currentUserId || '');
    }
    
    return true; 
  });

  if (filteredColleagues.length === 0) return null;

  return (
    <>
        <div className="rounded-2xl overflow-hidden mb-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 font-sans border border-gray-700/50">
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
              <tbody className="text-sm text-gray-200">
                {filteredColleagues.map((user, idx) => {
                  const isMe = user.uid === currentUserId;
                  const userBusinessDate = user.startTime ? getBusinessDate(user.startTime, SHARED_SWITCH_HOUR) : '';
                  const hasDataToday = userBusinessDate === currentDisplayDate || (user.sales > 0 && user.lastUpdated > Date.now() - 12 * 3600000);

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
                      <td className={`py-2 px-1 text-left truncate max-w-[80px] border-r border-gray-700/30 ${nameClass}`}>
                        {user.name}
                        {isAdmin && user.visibilityMode === 'PRIVATE' && !isMe && <span className="text-[9px] text-red-400 block leading-none font-black scale-75 origin-left">[非公開]</span>}
                      </td>
                      <td className={`py-2 px-1 tracking-tighter border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? formatBusinessTimeStr(user.startTime) : '－'}
                      </td>
                      <td className="py-2 px-1 font-medium tracking-tighter border-r border-gray-700/30">
                        {renderStatusBadge(user, hasDataToday)}
                      </td>
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? user.rideCount : 0}
                      </td>
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasDataToday ? (user.dispatchCount ?? '-') : 0}
                      </td>
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