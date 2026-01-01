import { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SalesRecord, DayMetadata } from '../types';

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
    const unsubHistory = onSnapshot(doc(db, 'public_status', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHistory(data.history || []);
        setMonthsData(data.months || {});
      } else {
        setHistory([]);
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
      unsubHistory();
      unsubMetadata();
    };
  }, [targetUid]);

  return { history, setHistory, dayMetadata, setDayMetadata, monthsData };
};
