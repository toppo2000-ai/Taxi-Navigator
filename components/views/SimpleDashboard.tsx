import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DollarSign, Target, Calendar, Edit2, ChevronDown, Save, TrendingUp, X, User, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { MonthlyStats, SalesRecord } from '../../types';
import { getBillingPeriod, formatDate, fromCommaSeparated, toCommaSeparated, getBusinessDate } from '../../utils';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { NeonProgressBar } from '../common/NeonProgressBar';
import { ModalWrapper } from '../common/modals/ModalWrapper';

interface SimpleDashboardProps {
  stats: MonthlyStats;
  onUpdateStats: (newStats: Partial<MonthlyStats>) => void;
  onNavigateToInput: () => void;
  history?: SalesRecord[];
}

export const SimpleDashboard: React.FC<SimpleDashboardProps> = ({ stats, onUpdateStats, onNavigateToInput, history = [] }) => {
  const [monthlyGoal, setMonthlyGoal] = useState(stats.monthlyGoal.toLocaleString());
  const [shimebiDay, setShimebiDay] = useState<string>(stats.shimebiDay.toString());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingDays, setIsEditingDays] = useState(false);
  const [showShimebiModal, setShowShimebiModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showDaysCalendarModal, setShowDaysCalendarModal] = useState(false);
  const [selectedWorkDays, setSelectedWorkDays] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [goalInputValue, setGoalInputValue] = useState('');
  const [nameInputValue, setNameInputValue] = useState(stats.userName || '');
  const scrollPositionRef = useRef<number>(0);

  const businessStartHour = stats.businessStartHour ?? 9;
  const currentShimebiDay = parseInt(shimebiDay) || (stats.shimebiDay || 20);
  
  // 残り出勤日数は当月の営業期間内の未来日のみをカウント（過去の出勤日は除外）
  // 営業期間ベースで考える（例：締め日20日、本日1/8の場合、当月は12/21～1/20、翌月は1/21～2/20）
  // 翌月の営業期間（1/21～2/20）の日付はカウントに含まない
  const initialRemainingDays = useMemo(() => {
    if (stats.dutyDays && stats.dutyDays.length > 0) {
      const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
      // 当月の営業期間を取得
      const { start, end } = getBillingPeriod(new Date(), currentShimebiDay, businessStartHour);
      const startStr = formatDate(start);
      const endStr = formatDate(end);
      
      // 日付文字列を数値に変換して比較（より確実な比較のため）
      const parseDateStr = (dateStr: string): number => {
        const [year, month, day] = dateStr.split('/').map(Number);
        return year * 10000 + month * 100 + day;
      };
      
      const todayNum = parseDateStr(todayBusinessDate);
      const startNum = parseDateStr(startStr);
      const endNum = parseDateStr(endStr);
      
      // 当月の営業期間内の未来日のみをカウント
      // 翌月の営業期間（次の営業期間）の日付は除外
      const futureDays = stats.dutyDays.filter(dateStr => {
        const dateNum = parseDateStr(dateStr);
        
        // 今日以降の日付のみ
        if (dateNum < todayNum) {
          return false;
        }
        
        // 当月の営業期間内の日付のみ（startNum以上、endNum以下）
        if (dateNum >= startNum && dateNum <= endNum) {
          return true;
        }
        
        return false;
      });
      return futureDays.length.toString();
    }
    return (stats.plannedWorkDays || 0).toString();
  }, [stats.dutyDays, stats.plannedWorkDays, businessStartHour, currentShimebiDay]);
  const [remainingDays, setRemainingDays] = useState<string>(initialRemainingDays);
  
  // initialRemainingDaysが変更されたときにremainingDaysを更新
  useEffect(() => {
    setRemainingDays(initialRemainingDays);
  }, [initialRemainingDays]);
  
  // stats.shimebiDayの変更を監視
  useEffect(() => {
    setShimebiDay(stats.shimebiDay.toString());
  }, [stats.shimebiDay]);
  
  // stats.userNameの変更を監視
  useEffect(() => {
    setNameInputValue(stats.userName || '');
  }, [stats.userName]);

  // 現在の営業期間を計算
  const { start, end } = useMemo(() => {
    return getBillingPeriod(new Date(), currentShimebiDay, businessStartHour);
  }, [currentShimebiDay, businessStartHour]);
  
  // 期間表示文字列
  const periodLabel = useMemo(() => {
    const startStr = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}/${String(start.getDate()).padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}/${String(end.getMonth() + 1).padStart(2, '0')}/${String(end.getDate()).padStart(2, '0')}`;
    return `${startStr} ~ ${endStr}`;
  }, [start, end]);

  // 月間売上を計算（public_statusから取得）
  const [currentMonthlySales, setCurrentMonthlySales] = useState(0);

  useEffect(() => {
    const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
    const unsubscribe = onSnapshot(pubRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentMonthlySales(data.monthlyTotal || 0);
      } else {
        setCurrentMonthlySales(0);
      }
    }, (error) => {
      console.error('月間売上取得エラー:', error);
      setCurrentMonthlySales(0);
    });

    return () => unsubscribe();
  }, []);

  // 目標まで残り
  const remainingToGoal = Math.max(0, stats.monthlyGoal - currentMonthlySales);
  
  // 月間必要 / 日（1日あたりの目標）
  const dailyRequired = useMemo(() => {
    const days = parseInt(remainingDays) || 0;
    return days > 0 ? Math.ceil(remainingToGoal / days) : 0;
  }, [remainingToGoal, remainingDays]);

  // 1日平均（履歴のサマリーと同じ計算方法：営業期間内の簡易モードレコードの合計を、データがある日数で割る）
  const dailyAverage = useMemo(() => {
    // 履歴と同じ方法でadjustedEndを計算
    const adjustedEnd = new Date(end);
    if (currentShimebiDay !== 0) {
      adjustedEnd.setDate(currentShimebiDay);
      adjustedEnd.setHours(23, 59, 59, 999);
    }
    const startStr = formatDate(start);
    const endStr = formatDate(adjustedEnd);
    
    // 営業期間内の簡易モードレコードをフィルタリング（履歴と同じロジック）
    const recordsMap: Record<string, SalesRecord[]> = {};
    
    history.forEach(record => {
      if (record.remarks?.includes('簡易モード')) {
        const dateStr = getBusinessDate(record.timestamp, businessStartHour);
        // 営業期間内のレコードのみをカウント
        if (dateStr >= startStr && dateStr <= endStr) {
          if (!recordsMap[dateStr]) {
            recordsMap[dateStr] = [];
          }
          recordsMap[dateStr].push(record);
        }
      }
    });
    
    // 履歴と同じ方法で計算：日付ごとにグループ化されたレコードから合計を計算
    const dailyRecords = Object.values(recordsMap).flat();
    const totalSales = dailyRecords.reduce((sum, r) => sum + r.amount, 0);
    const dayCount = Object.keys(recordsMap).length;
    
    return dayCount > 0 ? Math.round(totalSales / dayCount) : 0;
  }, [history, businessStartHour, start, end, currentShimebiDay]);
  
  // 達成率
  const achievementRate = useMemo(() => {
    return stats.monthlyGoal > 0 ? Math.min(100, Math.round((currentMonthlySales / stats.monthlyGoal) * 100)) : 0;
  }, [currentMonthlySales, stats.monthlyGoal]);
  
  // 今日の営業日付（useMemoの外で定義）
  const todayBusinessDate = useMemo(() => {
    return getBusinessDate(Date.now(), businessStartHour);
  }, [businessStartHour]);

  // 選択可能な日付リスト（今日から締め日まで）
  const availableDateStrings = useMemo(() => {
    const dateStrings: string[] = [];
    const endBusinessDate = getBusinessDate(end.getTime(), businessStartHour);
    
    // 今日を最初に追加（確実に含めるため）
    if (!dateStrings.includes(todayBusinessDate)) {
      dateStrings.push(todayBusinessDate);
    }
    
    // 今日の次の日から締め日まで
    const startDate = new Date();
    startDate.setHours(businessStartHour, 0, 0, 0);
    startDate.setDate(startDate.getDate() + 1); // 次の日から開始
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    // 次の日から締め日まで1日ずつ追加
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = getBusinessDate(current.getTime(), businessStartHour);
      // 今日より後で、締め日の営業日付までの日付を含める
      if (dateStr > todayBusinessDate && dateStr <= endBusinessDate) {
        if (!dateStrings.includes(dateStr)) {
          dateStrings.push(dateStr);
        }
      }
      current.setDate(current.getDate() + 1);
    }
    
    // 日付順にソート（念のため）
    return dateStrings.sort();
  }, [end, businessStartHour, todayBusinessDate]);

  // データがある日付を追跡（簡易モードと詳細モードの両方のレコードがある日）
  // 詳細モードの出勤データがある過去日を黄色で表示するため
  const datesWithData = useMemo(() => {
    const dateSet = new Set<string>();
    history.forEach(record => {
      const dateStr = getBusinessDate(record.timestamp, businessStartHour);
      dateSet.add(dateStr);
    });
    return dateSet;
  }, [history, businessStartHour]);

  // カレンダーの日付配列を生成（締め日に基づく営業期間ベース）
  const calendarDays = useMemo(() => {
    // calendarMonthを基準に営業期間を取得（締め日に基づく）
    // calendarMonthは営業期間の終了日（締め日がある月）を表す
    const { start: billingStart, end: billingEnd } = getBillingPeriod(calendarMonth, currentShimebiDay, businessStartHour);
    
    // 表示する月は営業期間の終了月（締め日がある月）
    const displayYear = billingEnd.getFullYear();
    const displayMonth = billingEnd.getMonth();
    
    // 営業期間の開始日を含む週の最初の日（日曜日）を計算
    const startWeekStart = new Date(billingStart);
    const startDayOfWeek = startWeekStart.getDay();
    startWeekStart.setDate(startWeekStart.getDate() - startDayOfWeek);
    startWeekStart.setHours(0, 0, 0, 0);
    
    // 営業期間の終了日を含む週の最後の日（土曜日）を計算
    const endWeekEnd = new Date(billingEnd);
    const endDayOfWeek = endWeekEnd.getDay();
    endWeekEnd.setDate(endWeekEnd.getDate() + (6 - endDayOfWeek));
    endWeekEnd.setHours(23, 59, 59, 999);
    
    // カレンダーに表示する日付を生成
    const days: Array<{ date: Date; dateStr: string; isInBillingPeriod: boolean }> = [];
    const current = new Date(startWeekStart);
    const billingStartStr = formatDate(billingStart);
    const billingEndStr = formatDate(billingEnd);
    
    // 5週分（35日）を生成（6段目は不要なので表示しない）
    for (let i = 0; i < 35; i++) {
      const dateStr = formatDate(current);
      const dateWithHour = new Date(current);
      dateWithHour.setHours(businessStartHour, 0, 0, 0);
      const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
      const isInBillingPeriod = businessDateStr >= billingStartStr && businessDateStr <= billingEndStr;
      
      days.push({
        date: new Date(current),
        dateStr,
        isInBillingPeriod
      });
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [calendarMonth, currentShimebiDay, businessStartHour]);

  // 選択した日数をカウント（詳細モードと同じロジック）
  const dutyCountInView = useMemo(() => {
    const { start: billingStart, end: billingEnd } = getBillingPeriod(calendarMonth, currentShimebiDay, businessStartHour);
    const billingStartStr = formatDate(billingStart);
    const billingEndStr = formatDate(billingEnd);
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    
    // カレンダーに表示されている日付の中で、カウントする日数を計算
    // カウントする日：
    // 1. 出勤した日（黄色状態）：過去日で売上データがある日
    // 2. 選択した日（オレンジ状態）：未来日でselectedWorkDaysに含まれている日
    // カウントしない日：
    // - 出勤していない日
    // - 選択不可の日（過去日でselectedWorkDaysに含まれているが売上データがない日）
    const selectedDaysSet = new Set<string>();
    
    calendarDays.forEach(({ date, isInBillingPeriod }) => {
      if (!isInBillingPeriod) return;
      
      const dateWithHour = new Date(date);
      dateWithHour.setHours(businessStartHour, 0, 0, 0);
      const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
      
      const isPast = businessDateStr < todayBusinessDate;
      const hasSales = datesWithData.has(businessDateStr);
      const isDuty = selectedWorkDays.includes(businessDateStr);
      
      // 出勤した日（黄色状態）：過去日で売上データがある日
      if (isPast && hasSales) {
        selectedDaysSet.add(businessDateStr);
      }
      // 選択した日（オレンジ状態）：未来日でselectedWorkDaysに含まれている日
      else if (!isPast && isDuty) {
        selectedDaysSet.add(businessDateStr);
      }
    });
    
    return selectedDaysSet.size;
  }, [calendarDays, selectedWorkDays, calendarMonth, currentShimebiDay, businessStartHour, datesWithData]);

  // モーダルを開く時に選択済み日付を読み込む
  useEffect(() => {
    if (showDaysCalendarModal) {
      // stats.dutyDaysから選択済み日付を読み込む（保存した日付を復元）
      if (stats.dutyDays && stats.dutyDays.length > 0) {
        setSelectedWorkDays([...stats.dutyDays]);
        // 残り出勤日数は当月の営業期間内の未来日のみをカウント
        const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
        const { start, end } = getBillingPeriod(new Date(), currentShimebiDay, businessStartHour);
        const startStr = formatDate(start);
        const endStr = formatDate(end);
        
        // 日付文字列を数値に変換して比較
        const parseDateStr = (dateStr: string): number => {
          const [year, month, day] = dateStr.split('/').map(Number);
          return year * 10000 + month * 100 + day;
        };
        
        const todayNum = parseDateStr(todayBusinessDate);
        const startNum = parseDateStr(startStr);
        const endNum = parseDateStr(endStr);
        
        const futureDays = stats.dutyDays.filter(dateStr => {
          const dateNum = parseDateStr(dateStr);
          return dateNum >= todayNum && dateNum >= startNum && dateNum <= endNum;
        });
        setRemainingDays(futureDays.length.toString());
      } else {
        setSelectedWorkDays([]);
        setRemainingDays('0');
      }
      
      // カレンダーの月を営業期間の終了日の月に設定（締め日がある月を表示）
      // 締め日が20日の場合、営業期間は前月21日から今月20日まで
      // カレンダーには今月（終了日の月）を表示する
      const { end } = getBillingPeriod(new Date(), currentShimebiDay, businessStartHour);
      setCalendarMonth(end);
    }
  }, [showDaysCalendarModal, stats.dutyDays, businessStartHour, currentShimebiDay]);

  const handleSaveGoal = async () => {
    scrollPositionRef.current = window.scrollY;
    const goalValue = fromCommaSeparated(goalInputValue || monthlyGoal);
    setMonthlyGoal(goalValue.toLocaleString());
    onUpdateStats({ monthlyGoal: goalValue });
    setShowGoalModal(false);
    setGoalInputValue('');
    
    // public_statusも更新
    try {
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      await setDoc(pubRef, {
        monthlyGoal: goalValue,
        lastUpdated: Date.now(),
      }, { merge: true });
    } catch (error) {
      console.error('目標保存エラー:', error);
    }
    
    // スクロール位置を復元
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
    }, 100);
  };


  const handleSaveShimebi = async (value?: string) => {
    scrollPositionRef.current = window.scrollY;
    const valueStr = value || shimebiDay;
    const shimebiValue = valueStr === '0' || valueStr === '' ? 0 : parseInt(valueStr) || 20;
    setShimebiDay(shimebiValue.toString());
    onUpdateStats({ shimebiDay: shimebiValue });
    setShowShimebiModal(false);
    
    // public_statusも更新
    try {
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      await setDoc(pubRef, {
        shimebiDay: shimebiValue,
        lastUpdated: Date.now(),
      }, { merge: true });
    } catch (error) {
      console.error('締め日保存エラー:', error);
    }
    
    // スクロール位置を復元
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
    }, 100);
  };

  const handleOpenModal = (modalSetter: () => void) => {
    scrollPositionRef.current = window.scrollY;
    modalSetter();
  };
  
  const handleSaveDaysCalendar = async () => {
    scrollPositionRef.current = window.scrollY;
    // 残り出勤日数は当月の営業期間内の未来日のみをカウント（過去の出勤日は除外）
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    // 当月の営業期間を取得
    const { start, end } = getBillingPeriod(new Date(), currentShimebiDay, businessStartHour);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    
    // 日付文字列を数値に変換して比較
    const parseDateStr = (dateStr: string): number => {
      const [year, month, day] = dateStr.split('/').map(Number);
      return year * 10000 + month * 100 + day;
    };
    
    const todayNum = parseDateStr(todayBusinessDate);
    const startNum = parseDateStr(startStr);
    const endNum = parseDateStr(endStr);
    
    // 当月の営業期間内の未来日のみをカウント
    const futureDays = selectedWorkDays.filter(dateStr => {
      const dateNum = parseDateStr(dateStr);
      return dateNum >= todayNum && dateNum >= startNum && dateNum <= endNum;
    });
    const daysCount = futureDays.length;
    setRemainingDays(daysCount.toString());
    // 選択した日付の配列をdutyDaysとして保存（詳細モードと同じ）
    onUpdateStats({ 
      plannedWorkDays: daysCount,
      dutyDays: selectedWorkDays 
    });
    setShowDaysCalendarModal(false);
    
    // public_statusも更新
    try {
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      await setDoc(pubRef, {
        plannedWorkDays: daysCount,
        lastUpdated: Date.now(),
      }, { merge: true });
    } catch (error) {
      console.error('営業日数保存エラー:', error);
    }
    
    // スクロール位置を復元
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
    }, 100);
  };

  const toggleWorkDay = (dateStr: string) => {
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    const isPast = dateStr < todayBusinessDate;
    // 過去日は選択/解除できない
    if (isPast) {
      return;
    }
    
    // 現在表示している月の営業期間を取得
    const sDay = parseInt(shimebiDay);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start, end } = getBillingPeriod(calendarMonth, effectiveShimebi, businessStartHour);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    
    // 現在表示している月の営業期間内の日付かどうかを確認
    const isInCurrentViewPeriod = dateStr >= startStr && dateStr <= endStr;
    
    if (!isInCurrentViewPeriod) {
      // 現在表示している月の営業期間外の日付は操作しない
      return;
    }
    
    const hasData = datesWithData.has(dateStr);
    // データがある日（選択不可）は選択できない
    if (hasData) return;
    
    // 現在表示している月の営業期間内の日付のみを操作
    // 他の月の日付は保持
    setSelectedWorkDays(prev => {
      // 現在表示している月の営業期間外の日付を保持
      const otherMonthDays = prev.filter(d => {
        return d < startStr || d > endStr;
      });
      
      // 現在表示している月の営業期間内の日付を操作
      const currentMonthDays = prev.filter(d => {
        return d >= startStr && d <= endStr;
      });
      
      if (currentMonthDays.includes(dateStr)) {
        // 選択解除
        return [...otherMonthDays, ...currentMonthDays.filter(d => d !== dateStr)];
      } else {
        // 選択追加
        return [...otherMonthDays, ...currentMonthDays, dateStr];
      }
    });
  };

  // 平日のみ自動選択
  const handleAutoSetDutyDays = () => {
    const sDay = parseInt(shimebiDay);
    const effectiveShimebi = isNaN(sDay) ? 20 : sDay;
    const { start, end } = getBillingPeriod(calendarMonth, effectiveShimebi, businessStartHour);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const todayBusinessDate = getBusinessDate(Date.now(), businessStartHour);
    
    // 現在表示している月の営業期間内の平日を取得
    const newDutyDays: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateWithHour = new Date(curr);
        dateWithHour.setHours(businessStartHour, 0, 0, 0);
        const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
        const isPast = businessDateStr < todayBusinessDate;
        // 過去日は除外、データがある日（選択不可）も除外
        if (!isPast && !datesWithData.has(businessDateStr)) {
          newDutyDays.push(businessDateStr);
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
    
    // 現在表示している月の営業期間外の日付を保持
    setSelectedWorkDays(prev => {
      const otherMonthDays = prev.filter(d => {
        return d < startStr || d > endStr;
      });
      return [...otherMonthDays, ...newDutyDays];
    });
  };

  const changeCalendarMonth = (direction: 'prev' | 'next') => {
    setCalendarMonth(prev => {
      // prevは既に営業期間の終了日（締め日がある月）を表している
      // 前後の営業期間の終了日を計算
      const targetDate = new Date(prev);
      if (direction === 'prev') {
        // 前の営業期間：終了日を1ヶ月前に移動
        targetDate.setMonth(targetDate.getMonth() - 1);
      } else {
        // 次の営業期間：終了日を1ヶ月後に移動
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      // その日付を基準に営業期間の終了日を取得（締め日に基づいて）
      const { end: newEnd } = getBillingPeriod(targetDate, currentShimebiDay, businessStartHour);
      return newEnd;
    });
  };
  
  const handleSaveName = async () => {
    scrollPositionRef.current = window.scrollY;
    const trimmedName = nameInputValue.trim();
    onUpdateStats({ userName: trimmedName });
    setShowNameModal(false);
    
    // public_statusも更新
    try {
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      await setDoc(pubRef, {
        name: trimmedName,
        lastUpdated: Date.now(),
      }, { merge: true });
    } catch (error) {
      console.error('名前保存エラー:', error);
    }
    
    // スクロール位置を復元
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
    }, 100);
  };

  return (
    <div className="w-full bg-[#0A0E14] min-h-screen pb-32">
      {/* ヘッダー */}
      <div className="bg-[#0A0E14] border-b border-gray-700 px-4 py-3">
        <h1 className="text-lg font-black text-white text-center">管理</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 売上状況サマリー */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-500" />
              <h2 className="text-base font-black text-white">売上状況</h2>
            </div>
            <div className="px-3 py-1 bg-purple-900/30 border border-purple-500/30 rounded-full">
              <span className="text-xs text-purple-300 font-bold">{periodLabel}</span>
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-4 mb-3">
            <div className="flex items-baseline">
              <span className="text-3xl font-black text-orange-500 relative" style={{ 
                textShadow: '2px 2px 0 #DC2626, -2px 0 0 #DC2626, 0 2px 0 #DC2626'
              }}>
                ¥
              </span>
              <span className="text-4xl font-black text-white ml-1">
                {currentMonthlySales.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">残り出勤</div>
              <div className="text-xl font-black text-orange-500">{remainingDays}日</div>
            </div>
          </div>
          
          {/* 必要売上 (1日当り) */}
          <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">必要売上 (1日当り)</div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-white">¥{dailyRequired.toLocaleString()}</div>
          </div>
          
          {/* 進捗バー */}
          <div className="mb-3">
            <NeonProgressBar progress={achievementRate} color="amber" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{achievementRate}% 達成</span>
              <span className="text-xs text-gray-400 underline">目標 ¥{stats.monthlyGoal.toLocaleString()}</span>
            </div>
          </div>
          
          {/* 目標まで残りと1日平均を横並び */}
          <div className="grid grid-cols-2 gap-3">
            {/* 目標まで残り */}
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <Target className="w-5 h-5 text-orange-500 mb-2" />
              <div className="text-xs text-gray-400 mb-1">目標まで残り</div>
              <div className="text-xl font-black text-white">¥{remainingToGoal.toLocaleString()}</div>
            </div>
            
            {/* 1日平均 */}
            <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
              <TrendingUp className="w-5 h-5 text-orange-500 mb-2" />
              <div className="text-xs text-gray-400 mb-1">1日平均</div>
              <div className="text-xl font-black text-white">¥{dailyAverage.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 売上入力ボタン */}
        <button
          onClick={onNavigateToInput}
          className="w-full bg-yellow-500 rounded-2xl py-5 font-black text-xl text-gray-900 shadow-lg hover:bg-yellow-600 active:scale-95 transition-all"
        >
          売上入力
        </button>

        {/* 設定欄 */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-3">
          <h3 className="text-base font-black text-white mb-3">設定</h3>
          
          {/* 名前 */}
          <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <label className="text-sm font-bold text-gray-400 flex-1">名前</label>
              <span className="text-base font-black text-white flex-1 text-right">{stats.userName || '未設定'}</span>
              <button
                onClick={() => {
                  setNameInputValue(stats.userName || '');
                  handleOpenModal(() => setShowNameModal(true));
                }}
                className="p-2 text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* 売上目標 */}
          <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <label className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">売上目標</label>
              <button
                onClick={() => {
                  setGoalInputValue(monthlyGoal);
                  handleOpenModal(() => setShowGoalModal(true));
                }}
                className="flex-1 bg-white border-2 border-orange-500 rounded-lg px-4 py-3 text-gray-900 font-black text-base flex items-center justify-between"
              >
                <span>{monthlyGoal} 円</span>
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 残り営業日数 */}
          <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <label className="text-sm font-bold text-gray-400 flex-1">残り営業日数</label>
              <button
                onClick={() => handleOpenModal(() => setShowDaysCalendarModal(true))}
                className="flex-1 bg-white border-2 border-orange-500 rounded-lg px-4 py-3 text-gray-900 font-black text-base flex items-center justify-between"
              >
                <span>{remainingDays} 日</span>
                <Calendar className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* 締め日設定 */}
          <div className="bg-gray-800 rounded-xl p-3 border-2 border-orange-500/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <label className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">締め日</label>
              <button
                onClick={() => handleOpenModal(() => setShowShimebiModal(true))}
                className="flex-1 bg-white border-2 border-orange-500 rounded-lg px-4 py-3 text-gray-900 font-black text-base flex items-center justify-between"
              >
                <span>{currentShimebiDay === 0 ? '末日' : `${currentShimebiDay}日`}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* 締め日選択モーダル */}
        {showShimebiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-yellow-500" /> 締め日を選択
                </h3>
                <button 
                  onClick={() => {
                    setShowShimebiModal(false);
                    setTimeout(() => {
                      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                    }, 100);
                  }} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                {Array.from({ length: 28 }).map((_, i) => {
                  const day = i + 1;
                  return (
                    <button
                      key={day}
                      onClick={() => handleSaveShimebi(day.toString())}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        currentShimebiDay === day
                          ? 'bg-yellow-500 text-gray-900 font-black'
                          : 'bg-gray-800 text-white font-bold hover:bg-gray-700'
                      }`}
                    >
                      {day}日
                    </button>
                  );
                })}
                <button
                  onClick={() => handleSaveShimebi('0')}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    currentShimebiDay === 0
                      ? 'bg-yellow-500 text-gray-900 font-black'
                      : 'bg-gray-800 text-white font-bold hover:bg-gray-700'
                  }`}
                >
                  末日
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 売上目標入力モーダル */}
        {showGoalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Target className="w-6 h-6 text-yellow-500" /> 売上目標を入力
                </h3>
                <button 
                  onClick={() => {
                    setShowGoalModal(false);
                    setTimeout(() => {
                      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                    }, 100);
                  }} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-2">売上目標</label>
                  <input
                    type="text"
                    value={goalInputValue}
                    onChange={(e) => setGoalInputValue(toCommaSeparated(e.target.value))}
                    placeholder="例: 1,000,000"
                    className="w-full bg-white border-2 border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-black text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && goalInputValue.trim()) {
                        handleSaveGoal();
                      }
                    }}
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowGoalModal(false);
                      setTimeout(() => {
                        window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                      }, 100);
                    }}
                    className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveGoal}
                    disabled={!goalInputValue.trim()}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${
                      goalInputValue.trim()
                        ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 名前入力モーダル */}
        {showNameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <User className="w-6 h-6 text-yellow-500" /> 名前を入力
                </h3>
                <button 
                  onClick={() => {
                    setShowNameModal(false);
                    setTimeout(() => {
                      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                    }, 100);
                  }} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-2">名前</label>
                  <input
                    type="text"
                    value={nameInputValue}
                    onChange={(e) => setNameInputValue(e.target.value)}
                    placeholder="名前を入力してください"
                    className="w-full bg-white border-2 border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-black text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && nameInputValue.trim()) {
                        handleSaveName();
                      }
                    }}
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowNameModal(false);
                      setTimeout(() => {
                        window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                      }, 100);
                    }}
                    className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveName}
                    disabled={!nameInputValue.trim()}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${
                      nameInputValue.trim()
                        ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 残り営業日数カレンダーモーダル */}
        {showDaysCalendarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-yellow-500" /> 出勤予定日を選択してください
                </h3>
                <button 
                  onClick={() => {
                    setShowDaysCalendarModal(false);
                    setTimeout(() => {
                      window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
                    }, 100);
                  }} 
                  className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* 選択日数表示 */}
              <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
                <div className="text-sm text-gray-400 mb-1">選択した日数</div>
                <div className="text-2xl font-black text-white">{dutyCountInView} 日</div>
              </div>

              {/* 月選択（簡易モードと同じスタイル） */}
              <div className="flex items-center justify-between bg-gray-950 rounded-2xl p-2 border-2 border-gray-700">
                <button
                  onClick={() => changeCalendarMonth('prev')}
                  className="p-3 text-gray-400 active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-xl font-black text-white">
                  {(() => {
                    // calendarMonthは営業期間の終了日（締め日がある月）を表す
                    const { end } = getBillingPeriod(calendarMonth, currentShimebiDay, businessStartHour);
                    return `${end.getFullYear()} / ${String(end.getMonth() + 1).padStart(2, '0')}`;
                  })()}
                </div>
                <button
                  onClick={() => changeCalendarMonth('next')}
                  className="p-3 text-gray-400 active:scale-90"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* カレンダー */}
              <div>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                    <div key={day} className="text-center text-sm font-bold text-gray-400">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map(({ date, isCurrentMonth, dateStr, isInBillingPeriod }) => {
                    // その日のbusinessStartHourの時刻でgetBusinessDateを計算
                    const dateWithHour = new Date(date);
                    dateWithHour.setHours(businessStartHour, 0, 0, 0);
                    const businessDateStr = getBusinessDate(dateWithHour.getTime(), businessStartHour);
                    
                    // 営業期間外の日付はグレーアウトして表示（選択不可）
                    if (!isInBillingPeriod) {
                      return (
                        <div
                          key={dateStr}
                          className="aspect-square rounded-xl flex items-center justify-center bg-gray-900/50 opacity-50 cursor-not-allowed"
                        >
                          <span className="text-base text-gray-400">{date.getDate()}</span>
                        </div>
                      );
                    }
                    
                    const isSelected = selectedWorkDays.includes(businessDateStr);
                    const isToday = businessDateStr === todayBusinessDate;
                    const hasData = datesWithData.has(businessDateStr);
                    const isPast = businessDateStr < todayBusinessDate;
                    
                    // 過去の出勤日（黄色で表示、選択不可）
                    const isLocked = isPast && hasData;
                    // 選択可能な日：当日または未来日で、データがない日、かつ営業期間内
                    const isClickable = !isPast && !hasData && isInBillingPeriod;
                    
                    return (
                      <button
                        key={dateStr}
                        onClick={() => isClickable && toggleWorkDay(businessDateStr)}
                        disabled={!isClickable}
                        className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                          isLocked
                            ? 'bg-yellow-500 text-gray-900 font-black cursor-not-allowed' // 過去の出勤日（黄色）
                            : !isClickable
                            ? hasData
                            ? 'bg-orange-500 text-gray-900 font-black cursor-not-allowed' // データがある日はオレンジ色（選択不可）
                            : 'bg-gray-800/50 text-gray-500 cursor-not-allowed' // 選択不可
                            : isSelected
                            ? 'bg-orange-500 text-gray-900 font-black' // 選択した日（オレンジ）
                            : isPast
                            ? 'bg-gray-800/50 text-gray-500' // 過去日（グレーアウト、選択不可）
                            : isCurrentMonth
                            ? 'bg-gray-800 text-white font-bold hover:bg-gray-700' // 選択可能な未来日
                            : 'bg-gray-800/50 text-gray-500'
                        } ${isToday ? 'ring-2 ring-orange-500' : ''} ${isClickable ? 'active:scale-95' : ''}`}
                      >
                        <span className="text-base">{date.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 平日のみ自動選択ボタン */}
              <button 
                onClick={handleAutoSetDutyDays}
                className="w-full mt-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                平日のみ自動選択 (約20日)
              </button>

              {/* 保存ボタン */}
              <button
                onClick={handleSaveDaysCalendar}
                className="w-full mt-4 py-4 bg-orange-500 text-white font-black text-lg rounded-xl hover:bg-orange-600 active:scale-95 transition-all"
              >
                保存 ({dutyCountInView} 日)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
