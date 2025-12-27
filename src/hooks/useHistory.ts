import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { SalesRecord, DayMetadata } from '@/types';

export const useHistory = (targetUid: string | undefined) => {
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const [dayMetadata, setDayMetadata] = useState<Record<string, DayMetadata>>({});

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

    const historyQuery = query(
      collection(db, 'users', targetUid, 'history'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesRecord));
      setHistory(records);
    });

    const unsubMetadata = onSnapshot(collection(db, 'users', targetUid, 'day_metadata'), (snapshot) => {
      const metadata: Record<string, DayMetadata> = {};
      snapshot.docs.forEach(doc => {
        metadata[doc.id] = doc.data() as DayMetadata;
      });
      setDayMetadata(metadata);
    });

    return () => {
      unsubHistory();
      unsubMetadata();
    };
  }, [targetUid]);

  return { history, setHistory, dayMetadata, setDayMetadata };
};
