import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { SalesRecord, DayMetadata, MonthlyStats } from '../../types';
import { 
  getBusinessDate,
  getBillingPeriod,
  formatDate,
} from '../../utils';

// 分割したコンポーネントをインポート
import { DailyDetailView, ReportSummaryView } from '../history/DailyDetailView';
import { MonthlyDashboard } from '../history/MonthlyDashboard';
import { SalesRecordCard } from '../history/SalesRecordCard';
import { PaymentBreakdownList, getPaymentCounts } from '../history/PaymentBreakdownList';

// 他のファイル（Dashboard.tsx や Modals.tsx）が今まで通り使えるようにエクスポート
export { ReportSummaryView, SalesRecordCard, PaymentBreakdownList, getPaymentCounts };

// 管理者メールアドレス
const ADMIN_EMAILS = [
  "toppo2000@gmail.com", 
  "admin-user@gmail.com"
];

interface HistoryViewProps { 
  history: SalesRecord[]; 
  dayMetadata: Record<string, DayMetadata>;
  customPaymentLabels: Record<string, string>;
  businessStartHour: number;
  shimebiDay: number; 
  onEditRecord: (rec: SalesRecord) => void;
  onUpdateMetadata: (date: string, meta: Partial<DayMetadata>) => void;
  stats: MonthlyStats; 
  initialTargetDate?: string | Date | null;
  onClearTargetDate?: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ 
  history: myHistory, 
  dayMetadata: myDayMetadata, 
  customPaymentLabels: myCustomLabels, 
  businessStartHour, 
  shimebiDay, 
  onEditRecord, 
  onUpdateMetadata, 
  stats,
  initialTargetDate,
  onClearTargetDate
}) => {
  // --- State Management ---
  const [viewingUid, setViewingUid] = useState(auth.currentUser?.uid);
  const [isViewingMe, setIsViewingMe] = useState(true);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [selectedUserObj, setSelectedUserObj] = useState<any | null>(null);
  const [otherHistory, setOtherHistory] = useState<SalesRecord[]>([]);
  // ★追加: 代理表示時のメタデータ保持用
  const [otherDayMetadata, setOtherDayMetadata] = useState<Record<string, DayMetadata>>({});
  // ★追加: months集計データの保持（パフォーマンス最適化用）
  const [otherMonthsData, setOtherMonthsData] = useState<Record<string, any>>({});

  const [currentMonth, setCurrentMonth] = useState(() => {
    const { end } = getBillingPeriod(new Date(), shimebiDay, businessStartHour);
    return end;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const processedTargetDateRef = useRef<string | null>(null);

  // --- 計算用変数 (useEffectの外で定義し、依存関係を整理) ---
  const currentUid = auth.currentUser?.uid;
  const isViewingMeComputed = viewingUid === currentUid;
  const targetUserObj = colleagues.find(u => u.uid === viewingUid) || null;
  const targetStartHourComputed = isViewingMeComputed ? businessStartHour : (targetUserObj?.businessStartHour || 9);

  // --- Data Fetching: Public Status ---
  useEffect(() => {
    const q = query(collection(db, "public_status"), orderBy("lastUpdated", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const users: any[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        users.push({ uid: doc.id, ...data });
        // ★自分のmonthsDataも取得
        if (doc.id === currentUid) {
          setMyMonthsData(data.months || {});
        }
      });
      setColleagues(users);
    });
    return () => unsub();
  }, [currentUid]);

  // --- User Selection & History Fetch Logic (クラッシュ防止・月別取得) ---
  useEffect(() => {
    const fetchHistory = async () => {
      if (!viewingUid) return;

      // 状態を更新
      setIsViewingMe(isViewingMeComputed);
      setSelectedUserObj(targetUserObj);

      // 表示している月の開始日と終了日を取得 (計算済みの targetStartHourComputed を使用)
      const { start, end } = getBillingPeriod(currentMonth, shimebiDay, targetStartHourComputed);

      try {
        // historyはpublic_statusから、dayMetadataはusersから取得
        // ★Phase 2: サブコレクションと配列形式の両方に対応
        let historyRecords: SalesRecord[] = [];
        
        // 表示している月の期間でフィルタリング（パフォーマンス向上と権限エラー回避）
        const startTimestamp = start.getTime();
        const endTimestamp = end.getTime();
        
        try {
          // まずサブコレクションから読み込みを試みる
          const subcollectionRef = collection(db, "public_status", viewingUid, "history");
          const subcollectionQuery = query(
            subcollectionRef, 
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp),
            orderBy('timestamp', 'asc')
          );
          const subcollectionSnap = await getDocs(subcollectionQuery);
          
          if (!subcollectionSnap.empty) {
            // サブコレクションにデータがある場合
            subcollectionSnap.forEach((doc) => {
              historyRecords.push(doc.data() as SalesRecord);
            });
            console.log(`[HistoryView] Loaded ${historyRecords.length} records from subcollection for period ${formatDate(start)} - ${formatDate(end)}`);
          }
        } catch (subError: any) {
          // where句を使ったクエリがインデックスエラーの場合は、全データを取得してフィルタリング
          if (subError?.code === 'failed-precondition') {
            console.log('[HistoryView] Index not available, loading all records and filtering...');
            try {
              const subcollectionRef = collection(db, "public_status", viewingUid, "history");
              const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'asc'));
              const subcollectionSnap = await getDocs(subcollectionQuery);
              subcollectionSnap.forEach((doc) => {
                const record = doc.data() as SalesRecord;
                if (record.timestamp >= startTimestamp && record.timestamp <= endTimestamp) {
                  historyRecords.push(record);
                }
              });
              console.log(`[HistoryView] Loaded ${historyRecords.length} records from subcollection (with client-side filtering)`);
            } catch (fallbackError) {
              console.log('[HistoryView] Subcollection not available, falling back to array field');
            }
          } else {
            console.log('[HistoryView] Subcollection not available, falling back to array field');
          }
        }
        
        // ★修正: 配列形式の読み込みを削除し、サブコレクションのみを使用
        setOtherHistory(historyRecords);
        
        // monthsデータは配列形式から読み込む（monthsは統計データとして保持）
        const pubSnap = await getDoc(doc(db, "public_status", viewingUid));
        if (pubSnap.exists()) {
          const pubData = pubSnap.data();
          setOtherMonthsData(pubData.months || {});
        } else {
          setOtherMonthsData({});
        }
        
        // dayMetadataはusersから取得（基本データとして保持）
        const userSnap = await getDoc(doc(db, "users", viewingUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setOtherDayMetadata(userData.dayMetadata || {});
        } else {
          setOtherDayMetadata({});
        }
      } catch (e) {
        console.error("履歴取得エラー:", e);
      }
    };

    fetchHistory();
  }, [viewingUid, currentMonth, shimebiDay, targetStartHourComputed, colleagues]);

  // --- Deep Link Support ---
  useEffect(() => {
    if (initialTargetDate) {
      const targetStr = initialTargetDate.toString();
      if (processedTargetDateRef.current === targetStr) return;

      if (typeof initialTargetDate === 'string') {
        const d = new Date(initialTargetDate);
        const { end } = getBillingPeriod(d, shimebiDay, businessStartHour);
        setCurrentMonth(new Date(end)); 
        setSelectedDay(initialTargetDate);
      } else if (initialTargetDate instanceof Date) {
        const { end } = getBillingPeriod(initialTargetDate, shimebiDay, businessStartHour);
        setCurrentMonth(new Date(end));
        setSelectedDay(null);
      }
      
      processedTargetDateRef.current = targetStr;
      if (onClearTargetDate) onClearTargetDate();
    }
  }, [initialTargetDate, shimebiDay, businessStartHour, onClearTargetDate]);

  // --- Filtered User List (Authorization) ---
  const selectableUsers = useMemo(() => {
    const currentUserEmail = auth.currentUser?.email;
    const isAdmin = currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail);

    return colleagues.filter(u => {
      if (u.uid === currentUid) return true;
      if (isAdmin) return true;
      
      const mode = u.visibilityMode || 'PUBLIC';
      if (mode === 'PRIVATE') return false;
      if (mode === 'CUSTOM') {
        return u.allowedViewers && u.allowedViewers.includes(currentUid);
      }
      return true;
    }).sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      return 0;
    });
  }, [colleagues, currentUid]);

  // ★追加: monthsDataも取得（パフォーマンス最適化用）
  const [myMonthsData, setMyMonthsData] = useState<Record<string, any>>({});

  // --- Target Data & Settings ---
  // ★修正: isViewingMeComputedを直接使用（state更新のタイミング問題を回避）
  const targetHistory = isViewingMeComputed ? myHistory : otherHistory;
  const targetLabels = isViewingMeComputed ? myCustomLabels : {}; 
  // ★修正: 自分のデータか他人のデータかを判定してメタデータを切り替え
  const targetDayMetadata = isViewingMeComputed ? myDayMetadata : otherDayMetadata;
  // ★追加: monthsDataも選択
  const targetMonthsData = isViewingMeComputed ? myMonthsData : otherMonthsData;

  // 表示年でフィルタリング（★変更: 年またぎの締め日や年間推移表のために、全データを渡すように変更）
  // 重複排除（念のため）
  const filteredHistory = useMemo(() => {
    const history = targetHistory || [];
    // IDで重複排除
    const uniqueRecordsMap = new Map<string, SalesRecord>();
    history.forEach(r => uniqueRecordsMap.set(r.id, r));
    return Array.from(uniqueRecordsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [targetHistory]);

  // --- Render Logic ---
  const renderContent = () => {
    if (selectedDay) {
      try {
        // 修正: 175行目付近で既に定義されている targetDayMetadata をそのまま使用する (二重定義しない)
        const meta = targetDayMetadata[selectedDay] || { memo: '', attributedMonth: '', totalRestMinutes: 0 };
        
        // ★修正: targetHistoryがundefinedやnullの場合に対応
        const safeTargetHistory = targetHistory || [];
        const records = safeTargetHistory.filter(r => {
          try {
            return getBusinessDate(r.timestamp, targetStartHourComputed) === selectedDay;
          } catch (e) {
            console.error('[HistoryView] Error filtering record:', e, r);
            return false;
          }
        });
        
        console.log('[HistoryView] Rendering DailyDetailView:', {
          selectedDay,
          recordsCount: records.length,
          meta,
          isViewingMe: isViewingMeComputed,
          targetHistoryLength: safeTargetHistory.length
        });
        
        return (
          <div className="w-full bg-[#0A0E14] min-h-screen">
            <DailyDetailView 
              date={selectedDay} 
              records={records} 
              meta={meta} 
              customLabels={targetLabels} 
              businessStartHour={targetStartHourComputed} 
              onBack={() => setSelectedDay(null)}
              isMe={isViewingMeComputed}
              onUpdateMetadata={isViewingMeComputed ? onUpdateMetadata : undefined}
              onEditRecord={isViewingMeComputed ? onEditRecord : undefined}
            />
          </div>
        );
      } catch (error) {
        console.error('[HistoryView] Error rendering DailyDetailView:', error);
        return (
          <div className="p-4 text-center text-red-400">
            <p>エラーが発生しました: {String(error)}</p>
            <button 
              onClick={() => setSelectedDay(null)}
              className="mt-4 px-4 py-2 bg-gray-800 rounded-lg"
            >
              戻る
            </button>
          </div>
        );
      }
    }

    // 月間データの抽出
    const { monthData, dailyGroups } = (() => {
      const targetReferenceDate = new Date(
        currentMonth.getFullYear(), 
        currentMonth.getMonth(), 
        shimebiDay === 0 ? 28 : shimebiDay
      );
      const { start, end } = getBillingPeriod(targetReferenceDate, shimebiDay, targetStartHourComputed);
      const adjustedEnd = new Date(end);
      if (shimebiDay !== 0) adjustedEnd.setDate(shimebiDay);
      
      const startStr = formatDate(start);
      const endDateStr = formatDate(adjustedEnd);
      const safeTargetHistory = targetHistory || [];
      
      const monthData = safeTargetHistory.filter(r => {
        const bDate = getBusinessDate(r.timestamp, targetStartHourComputed);
        return bDate >= startStr && bDate <= endDateStr;
      });
      
      const groups: Record<string, SalesRecord[]> = {};
      monthData.forEach(r => {
        const bDate = getBusinessDate(r.timestamp, targetStartHourComputed);
        if (!groups[bDate]) groups[bDate] = [];
        groups[bDate].push(r);
      });
      
      return { monthData, dailyGroups: Object.entries(groups) };
    })();

    return (
      <div className="p-4 pb-32 w-full overflow-hidden">
        <MonthlyDashboard 
          displayMonth={currentMonth} 
          setCurrentMonth={setCurrentMonth} 
          monthData={monthData} 
          dailyGroups={dailyGroups} 
          customLabels={targetLabels} 
          onSelectDay={setSelectedDay}
          isMe={isViewingMeComputed}
          userName={selectedUserObj?.name}
          history={filteredHistory}
          shimebiDay={shimebiDay} 
          businessStartHour={targetStartHourComputed}
          monthsData={targetMonthsData} // ★最適化: monthsDataを使用
        />
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0E14]">
      {!selectedDay && (
        <div className="p-4 pb-0">
          <div className="relative">
            <select 
              value={viewingUid || ''} 
              onChange={(e) => setViewingUid(e.target.value)}
              className="w-full appearance-none bg-gray-900 border border-gray-800 text-white font-bold py-3 px-4 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {selectableUsers.map(u => (
                <option key={u.uid} value={u.uid}>
                  {u.uid === auth.currentUser?.uid ? `自分 (${stats.userName})` : u.name || '名称未設定'}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
              <ChevronDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  );
};

export default HistoryView;
