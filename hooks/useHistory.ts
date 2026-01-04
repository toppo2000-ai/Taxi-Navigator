import { useState, useEffect } from 'react';
import { onSnapshot, doc, collection, query, orderBy, getDocs, limit, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SalesRecord, DayMetadata } from '../types';
import { SKIP_ARRAY_HISTORY_READ } from '../core/migrationConfig';

export const useHistory = (targetUid: string | undefined) => {
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [dayMetadata, setDayMetadata] = useState<Record<string, DayMetadata>>({});
  const [monthsData, setMonthsData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!targetUid) {
      setHistory([]);
      setDayMetadata({});
      return;
    }

    if (targetUid === 'guest-user') {
      const guestData = localStorage.getItem('taxi_navigator_guest_data');
      if (guestData) {
        const data = JSON.parse(guestData);
        setHistory(data.history || []);
        setDayMetadata(data.dayMetadata || {});
      }
      return;
    }

    // historyとmonthsDataはpublic_statusから、dayMetadataはusersから読み取る
    // ★Phase 2: サブコレクションと配列形式の両方に対応
    const loadHistory = async () => {
      try {
        // まずサブコレクションから読み込みを試みる
        const subcollectionRef = collection(db, 'public_status', targetUid, 'history');
        const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
        const subcollectionSnap = await getDocs(subcollectionQuery);
        
        if (!subcollectionSnap.empty) {
          // サブコレクションにデータがある場合
          const records: SalesRecord[] = [];
          subcollectionSnap.forEach((doc) => {
            records.push(doc.data() as SalesRecord);
          });
          setHistory(records.sort((a, b) => a.timestamp - b.timestamp));
          console.log(`[useHistory] Loaded ${records.length} records from subcollection`);
        } else if (!SKIP_ARRAY_HISTORY_READ) {
          // サブコレクションにデータがない場合、配列形式から読み込む（後方互換性）
          // ★Phase 4: 移行設定で配列形式の読み込みをスキップ可能
          const docSnap = await getDoc(doc(db, 'public_status', targetUid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHistory(data.history || []);
            console.log(`[useHistory] Loaded ${(data.history || []).length} records from array field`);
          } else {
            setHistory([]);
          }
        } else {
          // サブコレクションが空で、配列形式の読み込みが無効な場合
          setHistory([]);
          console.log(`[useHistory] Subcollection empty and array read disabled, setting empty history`);
        }
        
        // monthsDataは配列形式から読み込む（サブコレクション化は後で検討）
        const docSnap = await getDoc(doc(db, 'public_status', targetUid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMonthsData(data.months || {});
        } else {
          setMonthsData({});
        }
      } catch (error) {
        console.error('[useHistory] Error loading history:', error);
        // エラー時は配列形式から読み込む（フォールバック）
        const docSnap = await getDoc(doc(db, 'public_status', targetUid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHistory(data.history || []);
          setMonthsData(data.months || {});
        } else {
          setHistory([]);
          setMonthsData({});
        }
      }
    };

    // 初回読み込み
    loadHistory();

    // リアルタイム更新（サブコレクションを優先、なければ配列形式を監視）
    let unsubHistory: (() => void) | null = null;
    try {
      const subcollectionRef = collection(db, 'public_status', targetUid, 'history');
      const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
      unsubHistory = onSnapshot(subcollectionQuery, 
        (snap) => {
          if (!snap.empty) {
            const records: SalesRecord[] = [];
            snap.forEach((doc) => {
              records.push(doc.data() as SalesRecord);
            });
            setHistory(records.sort((a, b) => a.timestamp - b.timestamp));
          }
        },
        (error) => {
          // サブコレクションが存在しない場合は配列形式を監視
          // ★Phase 4: 移行設定で配列形式の読み込みをスキップ可能
          if (SKIP_ARRAY_HISTORY_READ) {
            console.log('[useHistory] Subcollection not available and array read disabled');
            setHistory([]);
            return;
          }
          console.log('[useHistory] Subcollection not available, using array field');
          if (unsubHistory) unsubHistory();
          unsubHistory = onSnapshot(doc(db, 'public_status', targetUid), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setHistory(data.history || []);
            } else {
              setHistory([]);
            }
          });
        }
      );
    } catch (error) {
      // サブコレクションが存在しない場合は配列形式を監視
      // ★Phase 4: 移行設定で配列形式の読み込みをスキップ可能
      if (SKIP_ARRAY_HISTORY_READ) {
        console.log('[useHistory] Subcollection not available and array read disabled');
        setHistory([]);
        unsubHistory = () => {}; // 空の関数
      } else {
        console.log('[useHistory] Subcollection not available, using array field');
        unsubHistory = onSnapshot(doc(db, 'public_status', targetUid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHistory(data.history || []);
          } else {
            setHistory([]);
          }
        });
      }
    }

    // monthsDataは配列形式から読み込む（サブコレクション化は後で検討）
    const unsubMonths = onSnapshot(doc(db, 'public_status', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMonthsData(data.months || {});
      } else {
        setMonthsData({});
      }
    });

    const unsubMetadata = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDayMetadata(data.dayMetadata || {});
      } else {
        setDayMetadata({});
      }
    });

    return () => {
      if (unsubHistory) unsubHistory();
      unsubMonths();
      unsubMetadata();
    };
  }, [targetUid]);

  return { history, setHistory, dayMetadata, setDayMetadata, monthsData };
};
