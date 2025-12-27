import { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
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

    // 履歴データと日付メタデータをリアルタイム監視
    const unsubData = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHistory(data.history || []);
        setDayMetadata(data.dayMetadata || {});
      } else {
        setHistory([]);
        setDayMetadata({});
      }
    });

    // クリーンアップ
    return () => {
      unsubData();
    };
  }, [targetUid]);

  return { history, setHistory, dayMetadata, setDayMetadata };
};
