import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { SalesRecord, DayMetadata } from '@/types';

// 売上履歴と日付ごとのメタデータを管理するカスタムフック
export const useHistory = (targetUid: string | undefined) => {
  const [history, setHistory] = useState<SalesRecord[]>([]); // 売上記録のリスト
  const [dayMetadata, setDayMetadata] = useState<Record<string, DayMetadata>>({}); // 日付ごとのメタデータ

  useEffect(() => {
    if (!targetUid) {
      setHistory([]);
      setDayMetadata({});
      return;
    }

    // ゲストユーザーの場合はローカルストレージから読み込み
    if (targetUid === 'guest-user') {
      const guestData = localStorage.getItem('taxi_navigator_guest_data');
      if (guestData) {
        const data = JSON.parse(guestData);
        setHistory(data.history || []);
        setDayMetadata(data.dayMetadata || {});
      }
      return;
    }

    // 履歴データをリアルタイム監視 (最新500件)
    const historyQuery = query(
      collection(db, 'users', targetUid, 'history'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesRecord));
      setHistory(records);
    });

    // 日付メタデータをリアルタイム監視
    const unsubMetadata = onSnapshot(collection(db, 'users', targetUid, 'day_metadata'), (snapshot) => {
      const metadata: Record<string, DayMetadata> = {};
      snapshot.docs.forEach(doc => {
        metadata[doc.id] = doc.data() as DayMetadata;
      });
      setDayMetadata(metadata);
    });

    // クリーンアップ
    return () => {
      unsubHistory();
      unsubMetadata();
    };
  }, [targetUid]);

  return { history, setHistory, dayMetadata, setDayMetadata };
};
