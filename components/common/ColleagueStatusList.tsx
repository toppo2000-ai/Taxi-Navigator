import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { SalesRecord } from '../../types';
import { 
  formatCurrency, 
  getBusinessDate 
} from '../../utils';
import { SalesRecordCard } from '../history/SalesRecordCard';

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
  startTime?: number;
  todayStartTime?: number; // 当日の最初の出庫時刻
  plannedEndTime?: number;
  sales?: number;
  rideCount?: number;
  dispatchCount?: number;
  status?: 'active' | 'break' | 'offline' | 'completed' | 'riding'; 
  records?: SalesRecord[]; 
  months?: Record<string, MonthData>; 
  currentMonthKey?: string; 
  lastUpdated?: number;
  businessStartHour?: number;
  visibilityMode?: 'PUBLIC' | 'PRIVATE' | 'CUSTOM';
  allowedViewers?: string[];
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
    
  const [realtimeData, setRealtimeData] = useState<{
      records: SalesRecord[], 
      total: number
  }>({ records: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSlim, setIsSlim] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
      let unsubDoc: (() => void) | null = null;
      let unsubSubcollection: (() => void) | null = null;
      let isCancelled = false;

      const now = Date.now();
      const businessStartHour = user.businessStartHour || 9;
      const todayBusinessDate = getBusinessDate(now, businessStartHour);
      
      const [year, month, day] = todayBusinessDate.split('/').map(Number);
      const todayStart = new Date(year, month - 1, day, businessStartHour, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      todayEnd.setMilliseconds(todayEnd.getMilliseconds() - 1);

      let activeRecords: SalesRecord[] = [];
      
      const updateRecords = () => {
          const filteredRecords = activeRecords
              .filter((r: SalesRecord) => {
                  if (!r || typeof r.timestamp !== 'number') return false;
                  const recordBusinessDate = getBusinessDate(r.timestamp, businessStartHour);
                  return recordBusinessDate === todayBusinessDate;
              })
              .sort((a, b) => b.timestamp - a.timestamp);
          const total = filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
          if (!isCancelled) {
              setRealtimeData({ records: filteredRecords, total });
              setIsLoading(false);
          }
      };

      const updateRecordsWithSubcollection = (subcollectionRecords: SalesRecord[]) => {
          const allRecordsMap = new Map<string, SalesRecord>();
          [...activeRecords, ...subcollectionRecords].forEach((r) => {
              if (r && typeof r.timestamp === 'number') {
                  const recordBusinessDate = getBusinessDate(r.timestamp, businessStartHour);
                  if (recordBusinessDate === todayBusinessDate) {
                      allRecordsMap.set(r.id || '', r);
                  }
              }
          });

          const allRecords = Array.from(allRecordsMap.values())
              .sort((a, b) => b.timestamp - a.timestamp);

          const total = allRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

          if (!isCancelled) {
              setRealtimeData({ records: allRecords, total });
              setIsLoading(false);
          }
      };

      unsubDoc = onSnapshot(doc(db, "public_status", user.uid), (docSnap) => {
          if (isCancelled) return;
          if (docSnap.exists()) {
              const data = docSnap.data();
              activeRecords = data.records || [];
              updateRecords();
          } else {
              activeRecords = [];
              updateRecords();
          }
      }, (error) => {
          console.error('[ColleagueDetailModal] Snapshot error:', error);
          if (!isCancelled) {
              setIsLoading(false);
              setRealtimeData({ records: [], total: 0 });
          }
      });

      const subcollectionRef = collection(db, "public_status", user.uid, "history");
      const subcollectionQuery = query(
          subcollectionRef,
          where("timestamp", ">=", todayStart.getTime()),
          where("timestamp", "<=", todayEnd.getTime()),
          orderBy("timestamp", "desc")
      );
      unsubSubcollection = onSnapshot(subcollectionQuery, (snap) => {
          if (isCancelled) return;
          const subcollectionRecords: SalesRecord[] = [];
          snap.forEach((doc) => {
              subcollectionRecords.push(doc.data() as SalesRecord);
          });
          updateRecordsWithSubcollection(subcollectionRecords);
      }, (error) => {
          console.error('[ColleagueDetailModal] Subcollection error:', error);
          if (!isCancelled) {
              updateRecordsWithSubcollection([]);
          }
      });

      return () => {
          isCancelled = true;
          if (unsubDoc) unsubDoc();
          if (unsubSubcollection) unsubSubcollection();
      };
  }, [user.uid, user.businessStartHour]);

  return createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={onClose} />
          <div className="relative w-full max-w-md mx-auto bg-gray-800 rounded-t-[32px] p-6 text-white h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300 border-t-2 border-orange-500">
              
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <div>
                      <h2 className="text-xl font-black flex items-center gap-2">
                          {user.name} <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{date}</span>
                      </h2>
                  </div>
                  <button onClick={onClose} className="p-3 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95 transition-transform">
                      <X className="w-6 h-6" />
                  </button>
              </div>
              
              <div className="flex justify-end gap-2 mb-4 flex-shrink-0">
                  <button
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600`}
                  >
                      {sortOrder === 'desc' ? (
                          <>
                              <ArrowDown className="w-4 h-4" />
                              降順
                          </>
                      ) : (
                          <>
                              <ArrowUp className="w-4 h-4" />
                              昇順
                          </>
                      )}
                  </button>
                  <button
                      onClick={() => setIsSlim(!isSlim)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          isSlim 
                              ? 'bg-orange-500 text-gray-900' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                      {isSlim ? '通常表示' : 'スリム表示'}
                  </button>
              </div>

              {(() => {
                  const sortedRecords = [...realtimeData.records].sort((a, b) => {
                      return sortOrder === 'desc' 
                          ? b.timestamp - a.timestamp
                          : a.timestamp - b.timestamp;
                  });

                  if (isSlim) {
                      return (
                          <div className="flex-1 overflow-y-auto pb-safe pr-1 custom-scrollbar">
                              {isLoading ? (
                                  <div className="text-center text-gray-500 py-10 font-bold">読み込み中...</div>
                              ) : sortedRecords.length === 0 ? (
                                  <div className="text-center text-gray-500 py-10 font-bold">記録がありません</div>
                              ) : (
                                  <table className="w-full border-collapse">
                                      <tbody>
                                          {sortedRecords.map((r, idx) => (
                                              <SalesRecordCard 
                                                  key={r.id || idx}
                                                  record={r}
                                                  index={sortOrder === 'desc' ? sortedRecords.length - idx : idx + 1}
                                                  isDetailed={false}
                                                  customLabels={{}} 
                                                  businessStartHour={user.businessStartHour || 9}
                                                  onClick={() => {}}
                                                  isSlim={true}
                                              />
                                          ))}
                                      </tbody>
                                  </table>
                              )}
                          </div>
                      );
                  } else {
                      return (
                          <div className="flex-1 overflow-y-auto space-y-3 pb-safe pr-1 custom-scrollbar">
                              {isLoading ? (
                                  <div className="text-center text-gray-500 py-10 font-bold">読み込み中...</div>
                              ) : sortedRecords.length === 0 ? (
                                  <div className="text-center text-gray-500 py-10 font-bold">記録がありません</div>
                              ) : (
                                  sortedRecords.map((r, idx) => (
                                      <div key={r.id || idx} className="opacity-100">
                                          <SalesRecordCard 
                                              record={r}
                                              index={sortOrder === 'desc' ? sortedRecords.length - idx : idx + 1}
                                              isDetailed={true}
                                              customLabels={{}} 
                                              businessStartHour={user.businessStartHour || 9}
                                              onClick={() => {}} 
                                              isSlim={false}
                                          />
                                      </div>
                                  ))
                              )}
                          </div>
                      );
                  }
              })()}
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

  // ★最適化: 必要なユーザーのみを監視（設定画面で選択したユーザーのみ）
  useEffect(() => {
    const usersToWatch = new Set([...(followingUsers || []), currentUserId].filter(Boolean));
    
    if (usersToWatch.size === 0) {
      setColleagues([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const userDataMap = new Map<string, ColleagueData>();

    const updateColleaguesList = () => {
      const users = Array.from(userDataMap.values());
      const now = Date.now();
      const currentDisplayDate = getBusinessDate(now, SHARED_SWITCH_HOUR);

      users.sort((a, b) => {
        const aDate = a.todayStartTime || a.startTime;
        const aHasData = aDate ? getBusinessDate(aDate, a.businessStartHour || SHARED_SWITCH_HOUR) === currentDisplayDate : false;

        const bDate = b.todayStartTime || b.startTime;
        const bHasData = bDate ? getBusinessDate(bDate, b.businessStartHour || SHARED_SWITCH_HOUR) === currentDisplayDate : false;

        if (aHasData && !bHasData) return -1;
        if (!bHasData && aHasData) return 1;
        
        return (b.sales || 0) - (a.sales || 0);
      });

      setColleagues(users);
    };

    usersToWatch.forEach((uid) => {
      const unsub = onSnapshot(doc(db, "public_status", uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ColleagueData;
          
          // 一般ユーザーの場合は公開設定をチェック
          if (!isAdmin && uid !== currentUserId) {
            const mode = data.visibilityMode || 'PUBLIC';
            if (mode === 'PRIVATE') {
              userDataMap.delete(uid);
              updateColleaguesList();
              return;
            }
            if (mode === 'CUSTOM') {
              const isAllowed = data.allowedViewers && data.allowedViewers.includes(currentUserId || '');
              if (!isAllowed) {
                userDataMap.delete(uid);
                updateColleaguesList();
                return;
              }
            }
          }
          
          userDataMap.set(uid, { ...data, uid });
        } else {
          userDataMap.delete(uid);
        }

        updateColleaguesList();
      }, (error) => {
        console.error(`[ColleagueStatusList] Error watching user ${uid}:`, error);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [followingUsers, currentUserId, isAdmin]);

  const formatBusinessTimeStr = (timestamp?: number) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const currentDisplayDate = getBusinessDate(Date.now(), SHARED_SWITCH_HOUR);

  const renderStatusBadge = (user: ColleagueData) => {
      if (user.status) {
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
      }
      return <span className="text-gray-500 font-bold text-sm whitespace-nowrap">－</span>;
  };

  // 簡易モードのみのユーザーを判定
  const hasDetailedModeRecords = (user: ColleagueData): boolean => {
    const currentRecords = (user as any).records || [];
    const hasDetailedInCurrent = currentRecords.some((r: SalesRecord) => 
      r && !r.remarks?.includes('簡易モード')
    );
    const topRecords = (user as any).topRecords || [];
    const hasDetailedInTop = topRecords.length > 0;
    return hasDetailedInCurrent || hasDetailedInTop;
  };

  // フィルタリング
  const filteredColleagues = colleagues.filter(u => {
    if (u.uid === currentUserId) return true;

    if (!followingUsers.includes(u.uid)) return false;

    if (isAdmin) {
      if (!hasDetailedModeRecords(u)) return false;
      return true;
    }

    const mode = u.visibilityMode || 'PUBLIC';
    if (mode === 'PRIVATE') return false;
    if (mode === 'CUSTOM') {
      const isAllowed = u.allowedViewers && u.allowedViewers.includes(currentUserId || '');
      if (!isAllowed) return false;
    }
    if (!hasDetailedModeRecords(u)) return false;
    
    return true; 
  });

  if (filteredColleagues.length === 0) return null;

  return (
    <>
        <div className="rounded-2xl overflow-hidden mb-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 font-sans border-2 border-orange-500">
          <div className="bg-gray-800 px-3 py-2.5 text-center border-b border-orange-500/30 relative">
             <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
             <div className="text-gray-200 font-black text-sm tracking-wide flex items-center justify-center gap-2">
                他担当の稼働状況 <span className="text-xs font-normal text-gray-400">({currentDisplayDate})</span>
             </div>
             <div className="text-gray-500 text-[10px] font-bold mt-0.5">
                行タップで詳細を表示
             </div>
          </div>

          <div className="overflow-x-auto bg-gray-800">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-700 text-xs uppercase tracking-wider border-b border-orange-500/30">
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
                  const userBusinessStartHour = user.businessStartHour || SHARED_SWITCH_HOUR;
                  
                  // ★修正: todayStartTimeを優先して使用（営業開始時に設定される）
                  const displayStartTime = user.todayStartTime || user.startTime;
                  
                  // 当日の営業日かどうかを判定
                  const isToday = displayStartTime ? 
                    getBusinessDate(displayStartTime, userBusinessStartHour) === currentDisplayDate : false;
                  
                  // データがあるかどうか（当日の営業日で、かつstatusまたはデータが存在する）
                  const hasData = isToday && (
                    user.status !== undefined || 
                    user.sales !== undefined || 
                    user.rideCount !== undefined || 
                    user.dispatchCount !== undefined
                  );

                  const rowClass = isMe
                    ? 'bg-emerald-500/10 shadow-[inset_3px_0_0_#10b981] border-t border-b border-emerald-500/20' 
                    : idx % 2 === 0 
                        ? 'bg-blue-500/05' 
                        : 'bg-purple-500/05';

                  const nameClass = 'text-base font-bold text-white';
                  const dataClass = 'text-sm font-black text-white';
                  const salesClass = 'text-sm font-black text-white';

                  const handleNameClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    try {
                      window.location.href = 'life360://';
                    } catch (error) {
                      console.error('Life360アプリを開けませんでした:', error);
                    }
                  };

                  return (
                    <tr 
                        key={user.uid} 
                        className={`${rowClass} border-b border-gray-700/30 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors`}
                        onClick={() => setSelectedColleague(user)}
                    >
                      <td 
                        className={`py-2 px-1 text-left truncate max-w-[80px] border-r border-gray-700/30 ${nameClass}`}
                        onClick={handleNameClick}
                      >
                        {user.name}
                        {isAdmin && user.visibilityMode === 'PRIVATE' && !isMe && <span className="text-[9px] text-red-400 block leading-none font-black scale-75 origin-left">[非公開]</span>}
                      </td>
                      <td className={`py-2 px-1 tracking-tighter border-r border-gray-700/30 ${dataClass}`}>
                        {hasData && displayStartTime ? formatBusinessTimeStr(displayStartTime) : '－'}
                      </td>
                      <td className="py-2 px-1 font-medium tracking-tighter border-r border-gray-700/30">
                        {renderStatusBadge(user)}
                      </td>
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasData && user.rideCount !== undefined && user.rideCount !== null ? user.rideCount : '-'}
                      </td>
                      <td className={`py-2 px-1 border-r border-gray-700/30 ${dataClass}`}>
                        {hasData && user.dispatchCount !== undefined && user.dispatchCount !== null ? user.dispatchCount : '-'}
                      </td>
                      <td className={`py-2 px-2 text-right tracking-tight ${salesClass}`}>
                        {hasData && user.sales !== undefined && user.sales !== null ? user.sales.toLocaleString() : '0'}
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
