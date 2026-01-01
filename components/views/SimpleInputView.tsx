import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, DollarSign, Users, Clock, FileText, Save, Car, CheckSquare, Trash2, ChevronLeft, ChevronDown, AlertTriangle } from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod, RideType } from '../../types';
import { getBusinessDate, formatDate, getBillingPeriod, calculatePeriodStats } from '../../utils';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

interface SimpleInputViewProps {
  stats: MonthlyStats;
  onUpdateStats: (newStats: Partial<MonthlyStats>) => void;
  initialDate?: Date | string | null;
  initialRecordId?: string | null;
  onClearInitialDate?: () => void;
  onBack?: () => void;
}

export const SimpleInputView: React.FC<SimpleInputViewProps> = ({ stats, onUpdateStats, initialDate, initialRecordId, onClearInitialDate, onBack }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) {
      if (typeof initialDate === 'string') {
        return new Date(initialDate);
      }
      return initialDate;
    }
    return new Date();
  });
  const [sales, setSales] = useState('');
  const [rideCount, setRideCount] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attributedMonth, setAttributedMonth] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNumberOnlyAlert, setShowNumberOnlyAlert] = useState(false);
  
  const isEditMode = !!initialDate && !!initialRecordId;

  const businessStartHour = stats.businessStartHour ?? 9;
  const dateStr = getBusinessDate(selectedDate.getTime(), businessStartHour);

  // 既存データの読み込み
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser?.uid || '');
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const history: SalesRecord[] = userSnap.data().history || [];
          // 選択日付のデータを検索（編集モードの場合はIDで検索、そうでない場合は日付で検索）
          const dayRecord = initialRecordId
            ? history.find(r => r.id === initialRecordId && r.remarks?.includes('簡易モード'))
            : history.find(r => {
                const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
                return recordDateStr === dateStr && r.remarks?.includes('簡易モード');
              });

          if (dayRecord) {
            // 簡易モードのデータはremarksに情報が入っている想定
            setSales(dayRecord.amount.toLocaleString());
            
            // remarksから乗車回数を抽出
            let rideCount = '';
            const rideCountMatch = dayRecord.remarks?.match(/乗車回数=(\d+)/);
            if (rideCountMatch) {
              rideCount = rideCountMatch[1];
            }
            setRideCount(rideCount);
            
            // remarksから時間を抽出
            let hours = '';
            let minutes = '';
            const timeMatch = dayRecord.remarks?.match(/(\d+)時間(\d+)分/);
            if (timeMatch) {
              hours = timeMatch[1];
              minutes = timeMatch[2];
            }
            setHours(hours);
            setMinutes(minutes);
            
            // 備考を抽出（簡易モード: 乗車回数=..., 時間=..., 備考=... の形式から）
            let extractedRemarks = '';
            const remarksMatch = dayRecord.remarks?.match(/備考=(.+)$/);
            if (remarksMatch) {
              extractedRemarks = remarksMatch[1];
            }
            setRemarks(extractedRemarks);
          } else {
            // データがない場合は空にする
            setSales('');
            setRideCount('');
            setHours('');
            setMinutes('');
            setRemarks('');
          }
        }
      } catch (error) {
        console.error('データ読み込みエラー:', error);
      }
    };

    loadExistingData();
  }, [dateStr, businessStartHour, initialRecordId]);

  // initialDateが変更されたらselectedDateを更新
  useEffect(() => {
    if (initialDate) {
      if (typeof initialDate === 'string') {
        setSelectedDate(new Date(initialDate));
      } else {
        setSelectedDate(initialDate);
      }
    }
  }, [initialDate]);

  const handleSave = async () => {
    if (!sales || !rideCount) {
      alert('売上と乗車回数を入力してください');
      return;
    }

    setIsSaving(true);
    setSavedMessage('');

    try {
      const salesNum = parseInt(sales.replace(/,/g, ''), 10);
      const rideCountNum = parseInt(rideCount, 10);
      const hoursNum = parseInt(hours || '0', 10);
      const minutesNum = parseInt(minutes || '0', 10);
      const totalMinutes = hoursNum * 60 + minutesNum;

      // 選択日付の営業開始時刻を計算
      const date = new Date(selectedDate);
      date.setHours(businessStartHour, 0, 0, 0);
      const timestamp = date.getTime();

      // SalesRecordとして保存（簡易モード用）
      const record: SalesRecord = {
        id: initialRecordId || `simple_${dateStr}_${Date.now()}`,
        amount: salesNum,
        toll: 0,
        paymentMethod: 'CASH' as PaymentMethod,
        nonCashAmount: 0,
        rideType: 'FLOW' as RideType,
        timestamp,
        remarks: `簡易モード: 乗車回数=${rideCountNum}, 時間=${hoursNum}時間${minutesNum}分${remarks ? `, 備考=${remarks}` : ''}`,
      };

      // 既存の同じ日のレコードを削除してから追加
      const userRef = doc(db, 'users', auth.currentUser?.uid || '');
      const userSnap = await getDoc(userRef);
      const existingHistory: SalesRecord[] = userSnap.data()?.history || [];
      
      // 同じ日の簡易モードレコードを削除（編集モードの場合は同じIDも削除）
      const filteredHistory = existingHistory.filter(r => {
        const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
        const isSameDay = recordDateStr === dateStr;
        const isSimpleMode = r.remarks?.includes('簡易モード');
        if (initialRecordId) {
          // 編集モード: 同じIDまたは同じ日の簡易モードレコードを削除
          return r.id !== initialRecordId && (!isSameDay || !isSimpleMode);
        }
        // 新規作成モード: 同じ日の簡易モードレコードを削除
        return !isSameDay || !isSimpleMode;
      });

      // 新しいレコードを追加
      const updatedHistory = [...filteredHistory, record];

      // Firestoreに保存
      await setDoc(userRef, { history: updatedHistory, records: updatedHistory }, { merge: true });

      // public_statusも更新（ランキング表示用）
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      const pubSnap = await getDoc(pubRef);
      const existingPubData = pubSnap.data() || {};

      // 月間合計を再計算（簡易モード優先）
      const periodStats = calculatePeriodStats(stats, updatedHistory, null);
      const monthlyTotal = periodStats.totalSales;

      // 歴代最高記録（トップ5）を計算（簡易モードのレコードは除外）
      const allHistoryRecords = updatedHistory
        .filter(r => !r.remarks?.includes('簡易モード')); // 簡易モードのレコードを除外
      allHistoryRecords.sort((a, b) => b.amount - a.amount);
      const topRecords = allHistoryRecords.slice(0, 5);

      // 重複排除（IDでユニークにする）
      const uniqueHistory = Array.from(
        new Map(updatedHistory.map(r => [r.id, r])).values()
      ).sort((a, b) => a.timestamp - b.timestamp);

      // public_statusドキュメントが存在しない場合でも作成できるようにsetDocを使用
      await setDoc(pubRef, {
        monthlyTotal,
        monthlyGoal: stats.monthlyGoal || existingPubData.monthlyGoal || 1000000, // 月間目標を保存
        history: uniqueHistory,
        topRecords: topRecords, // 簡易モードを除外した歴代最高記録
        name: stats.userName || existingPubData.name || '',
        lastUpdated: Date.now(),
      }, { merge: true });

      setSavedMessage('保存しました');
      setTimeout(() => setSavedMessage(''), 3000);
      
      // 編集モードの場合はクリア
      if (onClearInitialDate) {
        onClearInitialDate();
      }
      
      // 編集モードの場合、戻る
      if (isEditMode && onBack) {
        setTimeout(() => onBack(), 1500);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialRecordId) return;
    
    setIsDeleting(true);
    
    try {
      const userRef = doc(db, 'users', auth.currentUser?.uid || '');
      const userSnap = await getDoc(userRef);
      const existingHistory: SalesRecord[] = userSnap.data()?.history || [];
      
      // 該当レコードを削除
      const filteredHistory = existingHistory.filter(r => r.id !== initialRecordId);

      // Firestoreに保存
      await setDoc(userRef, { history: filteredHistory, records: filteredHistory }, { merge: true });

      // public_statusも更新
      const pubRef = doc(db, 'public_status', auth.currentUser?.uid || '');
      const pubSnap = await getDoc(pubRef);
      const existingPubData = pubSnap.data() || {};
      
      // 月間合計を再計算（簡易モード優先）
      const periodStats = calculatePeriodStats(stats, filteredHistory, null);
      const monthlyTotal = periodStats.totalSales;

      // 歴代最高記録（トップ5）を計算（簡易モードのレコードは除外）
      const allHistoryRecords = filteredHistory
        .filter(r => !r.remarks?.includes('簡易モード')); // 簡易モードのレコードを除外
      allHistoryRecords.sort((a, b) => b.amount - a.amount);
      const topRecords = allHistoryRecords.slice(0, 5);

      // 重複排除（IDでユニークにする）
      const uniqueHistory = Array.from(
        new Map(filteredHistory.map(r => [r.id, r])).values()
      ).sort((a, b) => a.timestamp - b.timestamp);

      await setDoc(pubRef, {
        history: uniqueHistory,
        monthlyTotal,
        topRecords: topRecords, // 簡易モードを除外した歴代最高記録
        name: stats.userName || existingPubData.name || '',
        lastUpdated: Date.now(),
      }, { merge: true });

      setShowDeleteConfirm(false);
      
      // 削除後は戻る
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
      setIsDeleting(false);
    }
  };

  // 売上振分け用の月選択リストを生成
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      months.push(`${year}年${month}月`);
    }
    return months;
  }, []);

  // デフォルトの売上振分け月を設定
  useEffect(() => {
    if (!attributedMonth) {
      const { end } = getBillingPeriod(selectedDate, stats.shimebiDay, businessStartHour);
      const year = end.getFullYear();
      const month = end.getMonth() + 1;
      setAttributedMonth(`${year}年${month}月`);
    }
  }, [selectedDate, stats.shimebiDay, businessStartHour, attributedMonth]);

  return (
    <div className="pb-32 w-full overflow-hidden animate-in fade-in duration-500 bg-[#0A0E14] min-h-screen">
      {/* ヘッダー */}
      <div className="bg-[#0A0E14] border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black text-white">
          {isEditMode ? '営業履歴の変更' : '売上入力'}
        </h2>
        {isEditMode && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        {!isEditMode && <div className="w-8"></div>}
      </div>

      <div className="p-4 space-y-3">
        {/* 勤務日 */}
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-orange-500 flex-shrink-0" />
            <label className="text-base font-bold text-white flex-shrink-0">勤務日</label>
            <div className="flex-1 relative">
              <input
                type="date"
                value={formatDate(selectedDate).replace(/\//g, '-')}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  setSelectedDate(newDate);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                id="work-date-input"
              />
              <label
                htmlFor="work-date-input"
                className="block text-white font-black text-base cursor-pointer text-right"
              >
                {(() => {
                  const date = selectedDate;
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
                  const weekday = weekdays[date.getDay()];
                  return `${year}年${month}月${day}日(${weekday})`;
                })()}
              </label>
            </div>
          </div>
        </div>

        {/* 売上 */}
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <label className="text-base font-bold text-white flex-shrink-0">売上</label>
            <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
              <input
                type="text"
                value={sales}
                onKeyDown={(e) => {
                  // 数字、削除、Backspace、Tab、Enter、矢印キー以外をブロック
                  const key = e.key;
                  if (!/[\d0-9]/.test(key) && 
                      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key) &&
                      !(e.ctrlKey || e.metaKey) && 
                      !(e.ctrlKey && ['a', 'c', 'v', 'x'].includes(key.toLowerCase()))) {
                    e.preventDefault();
                    setShowNumberOnlyAlert(true);
                  }
                }}
                onChange={(e) => {
                  const originalValue = e.target.value.replace(/,/g, '');
                  const numericValue = originalValue.replace(/[^0-9]/g, '');
                  if (originalValue !== numericValue && originalValue.length > 0) {
                    setShowNumberOnlyAlert(true);
                  }
                  setSales(numericValue ? parseInt(numericValue, 10).toLocaleString() : '');
                }}
                onFocus={(e) => {
                  const target = e.target;
                  const numericValue = target.value.replace(/,/g, '');
                  if (numericValue) {
                    setTimeout(() => {
                      // カンマを考慮してカーソル位置を設定
                      const len = numericValue.length;
                      target.setSelectionRange(len, len);
                    }, 0);
                  }
                }}
                placeholder="0"
                className="bg-transparent text-white font-black text-base focus:outline-none text-right flex-1 min-w-0"
                style={{ maxWidth: '100%' }}
              />
              <span className="text-base text-white font-black whitespace-nowrap flex-shrink-0">円</span>
            </div>
          </div>
        </div>

        {/* 営業回数 */}
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
          <div className="flex items-center gap-3">
            <Car className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <label className="text-base font-bold text-white flex-shrink-0">営業回数</label>
            <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
              <input
                type="text"
                value={rideCount}
                onKeyDown={(e) => {
                  // 数字、削除、Backspace、Tab、Enter、矢印キー以外をブロック
                  const key = e.key;
                  if (!/[\d0-9]/.test(key) && 
                      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key) &&
                      !(e.ctrlKey || e.metaKey) && 
                      !(e.ctrlKey && ['a', 'c', 'v', 'x'].includes(key.toLowerCase()))) {
                    e.preventDefault();
                    setShowNumberOnlyAlert(true);
                  }
                }}
                onChange={(e) => {
                  const originalValue = e.target.value;
                  const numericValue = originalValue.replace(/[^0-9]/g, '');
                  if (originalValue !== numericValue && originalValue.length > 0) {
                    setShowNumberOnlyAlert(true);
                  }
                  setRideCount(numericValue);
                }}
                onFocus={(e) => {
                  const target = e.target;
                  const value = target.value;
                  if (value) {
                    setTimeout(() => {
                      // 「回」の左（値の末尾）にカーソルを配置
                      const len = value.length;
                      target.setSelectionRange(len, len);
                    }, 0);
                  }
                }}
                placeholder="0"
                className="bg-transparent text-white font-black text-base focus:outline-none text-right flex-1 min-w-0"
                style={{ maxWidth: '100%' }}
              />
              <span className="text-base text-white font-black whitespace-nowrap flex-shrink-0">回</span>
            </div>
          </div>
        </div>

        {/* 売上振分け */}
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <label className="text-base font-bold text-white flex-shrink-0">売上振分け</label>
            <div className="flex-1 flex items-center justify-end">
              <select
                value={attributedMonth}
                onChange={(e) => setAttributedMonth(e.target.value)}
                className="flex-1 bg-transparent text-white font-black text-base focus:outline-none appearance-none text-right pr-6"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month} className="bg-gray-800">
                    {month} 分
                  </option>
                ))}
              </select>
              <span className="text-gray-400 flex-shrink-0 -ml-6 pointer-events-none">
                <ChevronDown className="w-5 h-5" />
              </span>
            </div>
          </div>
        </div>

        {/* メモ */}
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
          <div className="mb-2">
            <label className="text-base font-bold text-white">メモ</label>
            <span className="text-sm text-gray-400 ml-2">500文字以内(任意)</span>
          </div>
          <textarea
            value={remarks}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setRemarks(e.target.value);
              }
            }}
            placeholder=""
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white font-bold text-sm focus:outline-none focus:border-orange-500 resize-none"
          />
          <div className="text-sm text-gray-400 mt-1 text-right">
            {remarks.length}/500文字
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={isSaving || !sales || !rideCount}
          className={`w-full py-5 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-lg mt-4 ${
            isSaving || !sales || !rideCount
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-yellow-500 text-gray-900 hover:bg-yellow-600 active:scale-95'
          }`}
        >
          <Save className="w-6 h-6" />
          {isSaving ? '保存中...' : '保存'}
        </button>

        {savedMessage && (
          <div className="text-center text-green-500 font-bold text-xs">
            {savedMessage}
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <h3 className="text-lg font-black text-white">削除の確認</h3>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              この営業履歴を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl font-black text-base bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl font-black text-base bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    削除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    削除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 数字以外入力アラート */}
      {showNumberOnlyAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full mx-4">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-black text-white mb-2">数字以外は入力出来ません</h3>
            </div>
            
            <button
              onClick={() => setShowNumberOnlyAlert(false)}
              className="w-full py-4 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 active:scale-95 transition-all text-lg"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
