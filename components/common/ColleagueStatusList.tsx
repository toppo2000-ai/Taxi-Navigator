import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock } from 'lucide-react';
import { collection, onSnapshot, query, doc, getDocs, orderBy, where } from 'firebase/firestore';
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
    
  // ★修正: リアルタイムリスナーで public_status からデータを取得
    const [realtimeData, setRealtimeData] = useState<{
        records: SalesRecord[], 
        total: number
    }>({ records: [], total: 0 }); // nullではなく空配列で初期化
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let unsubDoc: (() => void) | null = null;
        let isCancelled = false;

        const loadData = async () => {
            try {
                // 24時間以内のデータを抽出するための基準時刻
                const now = Date.now();
                const oneDayAgo = now - 24 * 60 * 60 * 1000;

                // 1. 現在進行中のシフトのレコードを取得（public_statusドキュメントから）
                unsubDoc = onSnapshot(doc(db, "public_status", user.uid), async (docSnap) => {
                    if (isCancelled) return;

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const activeRecords: SalesRecord[] = data.records || [];

                        // 2. サブコレクションから過去24時間のレコードを取得
                        try {
                            const subcollectionRef = collection(db, "public_status", user.uid, "history");
                            const subcollectionQuery = query(
                                subcollectionRef,
                                where("timestamp", ">=", oneDayAgo),
                                orderBy("timestamp", "desc")
                            );
                            const subcollectionSnap = await getDocs(subcollectionQuery);

                            const subcollectionRecords: SalesRecord[] = [];
                            subcollectionSnap.forEach((doc) => {
                                subcollectionRecords.push(doc.data() as SalesRecord);
                            });

                            // 3. 全レコードを結合（重複排除）
                            const allRecordsMap = new Map<string, SalesRecord>();
                            [...activeRecords, ...subcollectionRecords].forEach((r) => {
                                if (r && typeof r.timestamp === 'number' && r.timestamp > oneDayAgo) {
                                    allRecordsMap.set(r.id, r);
                                }
                            });

                            const allRecords = Array.from(allRecordsMap.values())
                                .sort((a, b) => b.timestamp - a.timestamp);

                            const total = allRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

                            if (!isCancelled) {
                                setRealtimeData({ records: allRecords, total });
                                setIsLoading(false);
                            }
                        } catch (subError) {
                            console.error('[ColleagueDetailModal] Subcollection error:', subError);
                            // サブコレクションの読み込みに失敗した場合は、activeRecordsのみを使用
                            const filteredRecords = activeRecords
                                .filter((r: SalesRecord) => r && typeof r.timestamp === 'number' && r.timestamp > oneDayAgo)
                                .sort((a, b) => b.timestamp - a.timestamp);
                            const total = filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
                            if (!isCancelled) {
                                setRealtimeData({ records: filteredRecords, total });
                                setIsLoading(false);
                            }
                        }
                    } else {
                        if (!isCancelled) {
                            setRealtimeData({ records: [], total: 0 });
                            setIsLoading(false);
                        }
                    }
                }, (error) => {
                    console.error('[ColleagueDetailModal] Snapshot error:', error);
                    if (!isCancelled) {
                        setIsLoading(false);
                        setRealtimeData({ records: [], total: 0 });
                    }
                });
            } catch (error) {
                console.error('[ColleagueDetailModal] Load error:', error);
                if (!isCancelled) {
                    setIsLoading(false);
                    setRealtimeData({ records: [], total: 0 });
                }
            }
        };

        loadData();

        return () => {
            isCancelled = true;
            if (unsubDoc) {
                unsubDoc();
            }
        };
    }, [user.uid]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-md mx-auto bg-gray-800 rounded-t-[32px] p-6 text-white h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300 border-t-2 border-orange-500">
                
                {/* ヘッダー部分 */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2">
                            {user.name} <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{date}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95 transition-transform">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* 概算データグリッド */}
                <div className="grid grid-cols-2 gap-4 mb-6 flex-shrink-0">
                    <div className="bg-gray-700 p-4 rounded-2xl border-2 border-orange-500 text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">日計</p>
                        <p className="text-2xl font-black text-amber-500">{formatCurrency(realtimeData.total)}</p>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-2xl border-2 border-orange-500 text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">回数</p>
                        <p className="text-2xl font-black text-white">{realtimeData.records.length} <span className="text-sm text-gray-500">件</span></p>
                    </div>
                </div>

                {/* 詳細リスト表示エリア */}
                <div className="flex-1 overflow-y-auto space-y-3 pb-safe pr-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center text-gray-500 py-10 font-bold">読み込み中...</div>
                    ) : realtimeData.records.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 font-bold">記録がありません</div>
                    ) : (
                        realtimeData.records.map((r, idx) => (
                            <div key={r.id || idx} className="opacity-100">
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
    let unsubscribe: (() => void) | null = null;
    
    if (isAdmin) {
      // 管理者: 全コレクションを監視（全ユーザーを表示する必要があるため）
      const q = query(collection(db, "public_status"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allUsers: ColleagueData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as ColleagueData;
          // デバッグ: statusフィールドの確認
          if (!data.status) {
            console.warn('[ColleagueStatusList] Missing status field for user:', data.uid, data.name, 'data:', data);
          }
          allUsers.push(data);
        });

        const now = Date.now();
        const currentDisplayDate = getBusinessDate(now, SHARED_SWITCH_HOUR);

        allUsers.sort((a, b) => {
          const aDate = a.startTime ? getBusinessDate(a.startTime, SHARED_SWITCH_HOUR) : '';
          const aHasData = aDate === currentDisplayDate || (a.sales > 0 && a.lastUpdated > now - 12 * 3600000);

          const bDate = b.startTime ? getBusinessDate(b.startTime, SHARED_SWITCH_HOUR) : '';
          const bHasData = bDate === currentDisplayDate || (b.sales > 0 && b.lastUpdated > now - 12 * 3600000);

          if (aHasData && !bHasData) return -1;
          if (!aHasData && bHasData) return 1;
          
          return b.sales - a.sales;
        });

        setColleagues(allUsers);
      }, (error) => {
        console.error('[ColleagueStatusList] Snapshot error:', error);
      });
    } else {
      // 一般ユーザー: フォロー中のユーザーと自分のみを個別に監視（通信量削減）
      // FirestoreのonSnapshotは変化がない限り通信しないため効率的
      const usersToWatch = new Set([...(followingUsers || []), currentUserId].filter(Boolean));
      
      if (usersToWatch.size === 0) {
        setColleagues([]);
        return;
      }

      const unsubscribes: (() => void)[] = [];
      const userDataMap = new Map<string, ColleagueData>();

      usersToWatch.forEach((uid) => {
        const unsub = onSnapshot(doc(db, "public_status", uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as ColleagueData;
            
            // デバッグ: statusフィールドの確認
            if (!data.status) {
              console.warn('[ColleagueStatusList] Missing status field for user:', uid, data.name, 'data:', data);
            }
            
            // 公開設定チェック（自分以外の場合）
            if (uid !== currentUserId) {
              const mode = data.visibilityMode || 'PUBLIC';
              if (mode === 'PRIVATE') {
                userDataMap.delete(uid);
                updateColleaguesList(userDataMap);
                return;
              }
              if (mode === 'CUSTOM') {
                const isAllowed = data.allowedViewers && data.allowedViewers.includes(currentUserId || '');
                if (!isAllowed) {
                  userDataMap.delete(uid);
                  updateColleaguesList(userDataMap);
                  return;
                }
              }
            }
            
            userDataMap.set(uid, data);
          } else {
            userDataMap.delete(uid);
          }

          updateColleaguesList(userDataMap);
        }, (error) => {
          console.error(`[ColleagueStatusList] Error watching user ${uid}:`, error);
        });
        unsubscribes.push(unsub);
      });

      // ユーザーリストを更新する共通関数
      const updateColleaguesList = (userMap: Map<string, ColleagueData>) => {
        const users = Array.from(userMap.values());
        const now = Date.now();
        const currentDisplayDate = getBusinessDate(now, SHARED_SWITCH_HOUR);

        users.sort((a, b) => {
          const aDate = a.startTime ? getBusinessDate(a.startTime, SHARED_SWITCH_HOUR) : '';
          const aHasData = aDate === currentDisplayDate || (a.sales > 0 && a.lastUpdated > now - 12 * 3600000);

          const bDate = b.startTime ? getBusinessDate(b.startTime, SHARED_SWITCH_HOUR) : '';
          const bHasData = bDate === currentDisplayDate || (b.sales > 0 && b.lastUpdated > now - 12 * 3600000);

          if (aHasData && !bHasData) return -1;
          if (!aHasData && bHasData) return 1;
          
          return b.sales - a.sales;
        });

        setColleagues(users);
      };

      unsubscribe = () => {
        unsubscribes.forEach(unsub => unsub());
      };
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [followingUsers, currentUserId, isAdmin]);

  const formatBusinessTimeStr = (timestamp: number) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const currentDisplayDate = getBusinessDate(Date.now(), SHARED_SWITCH_HOUR);

  const renderStatusBadge = (user: ColleagueData, hasDataToday: boolean) => {
      // statusが存在する場合は状態を表示（hasDataTodayがfalseでも表示）
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
      
      // statusが存在しない場合のみ「－」を表示
      if (!hasDataToday) {
          return <span className="text-gray-500 font-bold text-sm whitespace-nowrap">－</span>;
      }

      // フォールバック: hasDataTodayがtrueだがstatusがない場合
      return <span className="text-blue-400 font-black text-sm whitespace-nowrap">空車</span>;
  };

  // ★簡易モードのみのユーザーを判定する関数
  const hasDetailedModeRecords = (user: ColleagueData): boolean => {
    // recordsフィールド（現在進行中のシフトのレコード）を確認
    const currentRecords = (user as any).records || [];
    const hasDetailedInCurrent = currentRecords.some((r: SalesRecord) => 
      r && !r.remarks?.includes('簡易モード')
    );
    
    // topRecordsフィールド（過去最高記録トップ20、簡易モード除外済み）を確認
    const topRecords = (user as any).topRecords || [];
    const hasDetailedInTop = topRecords.length > 0; // topRecordsは既に簡易モード除外済み
    
    // どちらか一方でも詳細モードのレコードがあればtrue
    return hasDetailedInCurrent || hasDetailedInTop;
  };

  // ★フィルタリングロジック
  const filteredColleagues = colleagues.filter(u => {
    if (u.uid === currentUserId) {
      return true; // 自分は表示
    }

    // 1. フォローリストに含まれていない場合は非表示
    if (!followingUsers.includes(u.uid)) {
      return false;
    }

    // 2. 権限チェック
    if (isAdmin) {
      // 管理者の場合も簡易モードのみのユーザーは除外
      if (!hasDetailedModeRecords(u)) {
        return false;
      }
      return true; // 管理者は詳細モードユーザーを全員表示
    }

    // 3. 相手の公開設定チェック
    const mode = u.visibilityMode || 'PUBLIC';
    
    if (mode === 'PRIVATE') {
      return false;
    }
    
    if (mode === 'CUSTOM') {
        const isAllowed = u.allowedViewers && u.allowedViewers.includes(currentUserId || '');
        if (!isAllowed) {
          return false;
        }
    }
    
    // 4. 簡易モードのみのユーザーは除外（詳細モードのレコードが1つもない場合）
    if (!hasDetailedModeRecords(u)) {
      return false;
    }
    
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
