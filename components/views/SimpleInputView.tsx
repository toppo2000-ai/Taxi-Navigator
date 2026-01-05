import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, DollarSign, Users, Clock, FileText, Save, Car, CheckSquare, Trash2, ChevronLeft, ChevronDown, AlertTriangle } from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod, RideType } from '../../types';
import { getBusinessDate, formatDate, getBillingPeriod, calculatePeriodStats, formatCurrency } from '../../utils';
import { doc, getDoc, setDoc, writeBatch, deleteDoc, collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { SKIP_ARRAY_HISTORY_SAVE } from '../../core/migrationConfig';

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
  const [startTime, setStartTime] = useState(''); // 出庫時間
  const [endTime, setEndTime] = useState(''); // 入庫時間
  const [remarks, setRemarks] = useState('');
  const [attributedMonth, setAttributedMonth] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isEditMode = !!initialDate && !!initialRecordId;

  const businessStartHour = stats.businessStartHour ?? 9;
  const dateStr = getBusinessDate(selectedDate.getTime(), businessStartHour);

  // ★Phase 1: サブコレクションへの保存関数
  const saveHistoryToSubcollection = async (uid: string, records: SalesRecord[], collectionName: 'public_status' | 'users') => {
    if (!records || records.length === 0) {
      console.log(`[SimpleInputView] No records to save for ${collectionName}/${uid}/history`);
      return;
    }
    
    console.log(`[SimpleInputView] Starting to save ${records.length} records to ${collectionName}/${uid}/history`);
    console.log(`[SimpleInputView] Sample record IDs:`, records.slice(0, 5).map(r => r.id));
    
    try {
      // ★重要: 親ドキュメントが存在することを確認（存在しない場合は作成）
      // サブコレクションに書き込むには、親ドキュメントが存在する必要がある
      const parentDocRef = doc(db, collectionName, uid);
      const parentDocSnap = await getDoc(parentDocRef);
      
      if (!parentDocSnap.exists()) {
        console.log(`[SimpleInputView] Parent document ${collectionName}/${uid} does not exist, creating...`);
        // 親ドキュメントを作成（少なくとも1つのフィールドを含める必要がある）
        // merge: trueで既存データを保持しつつ、存在しない場合は作成
        await setDoc(parentDocRef, { 
          _created: new Date().toISOString() 
        }, { merge: true });
        console.log(`[SimpleInputView] ✓ Parent document created`);
      }
      
      // ★重要: doc()は必ずドキュメントIDまで指定する必要がある
      // ✅ 正しい: doc(db, 'users', uid, 'history', record.id) - ドキュメントIDまで指定
      // ❌ 間違い: doc(db, 'users', uid, 'history') - コレクションを指すためsetDocできない
      
      // ★修正: App.tsxと同じ実装に統一（writeBatchを使用）
      // レコード数が少ない場合でも、writeBatchの方が確実
      let totalSaved = 0;
      let totalErrors = 0;
      
      console.log(`[SimpleInputView] Saving ${records.length} records to ${collectionName}/${uid}/history using writeBatch`);
      
      // バッチ処理で一度に保存（Firestoreの制限: 最大500件/バッチ）
      const batchSize = 500;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const batchWrite = writeBatch(db);
        let batchCount = 0;
        
        console.log(`[SimpleInputView] Processing batch ${Math.floor(i / batchSize) + 1}, records: ${batch.length}`);
        
        for (const record of batch) {
          if (!record.id) {
            console.warn(`[SimpleInputView] Record missing ID, skipping:`, record);
            continue;
          }
          
          // ドキュメント参照を作成（ドキュメントIDまで指定）
          const recordRef = doc(db, collectionName, uid, 'history', record.id);
          const fullPath = `${collectionName}/${uid}/history/${record.id}`;
          
          // バッチに追加（merge: falseで上書き、存在しない場合は作成）
          batchWrite.set(recordRef, record, { merge: false });
          batchCount++;
        }
        
        if (batchCount > 0) {
          console.log(`[SimpleInputView] Committing batch with ${batchCount} records...`);
          console.log(`[SimpleInputView] Batch will write to: ${collectionName}/${uid}/history`);
          try {
            await batchWrite.commit();
            totalSaved += batchCount;
            console.log(`[SimpleInputView] ✓ Committed batch: ${batchCount} records (total: ${totalSaved}/${records.length})`);
            
            // ★検証: 実際に書き込まれたか確認（最初のレコードを読み取る）
            if (batch.length > 0 && batch[0].id) {
              const testRecordRef = doc(db, collectionName, uid, 'history', batch[0].id);
              const testRecordSnap = await getDoc(testRecordRef);
              if (testRecordSnap.exists()) {
                console.log(`[SimpleInputView] ✓ Verified: Record ${batch[0].id} exists in subcollection`);
              } else {
                console.error(`[SimpleInputView] ✗ WARNING: Record ${batch[0].id} NOT found in subcollection after commit!`);
              }
            }
          } catch (batchError: any) {
            totalErrors += batchCount;
            console.error(`[SimpleInputView] ✗ Batch commit failed:`, batchError);
            console.error(`[SimpleInputView] Batch error details:`, {
              message: batchError?.message,
              code: batchError?.code,
              stack: batchError?.stack
            });
            // バッチが失敗した場合、個別にsetDoc()で再試行
            console.log(`[SimpleInputView] Retrying with individual setDoc() calls...`);
            for (const record of batch) {
              if (!record.id) continue;
              try {
                const recordRef = doc(db, collectionName, uid, 'history', record.id);
                await setDoc(recordRef, record, { merge: false });
                totalSaved++;
                totalErrors--;
                console.log(`[SimpleInputView] ✓ Saved individual record: ${record.id}`);
              } catch (individualError: any) {
                console.error(`[SimpleInputView] ✗ Failed to save individual record ${record.id}:`, individualError);
              }
            }
          }
        } else {
          console.warn(`[SimpleInputView] Batch ${Math.floor(i / batchSize) + 1} has no valid records to save`);
        }
      }
      
      if (totalErrors > 0) {
        console.warn(`[SimpleInputView] ⚠️ Completed with errors: ${totalSaved} saved, ${totalErrors} failed`);
      } else {
        console.log(`[SimpleInputView] ✓ Successfully saved ${totalSaved} records to ${collectionName}/${uid}/history`);
      }
    } catch (error: any) {
      console.error(`[SimpleInputView] ✗ Error saving to ${collectionName}/${uid}/history:`, error);
      console.error(`[SimpleInputView] Error details:`, {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      // エラーが発生しても処理を続行（配列形式は維持される）
    }
  };

  // ★Phase 1: サブコレクションからの削除関数
  const deleteFromSubcollection = async (uid: string, recordId: string, collectionName: 'public_status' | 'users') => {
    try {
      const recordRef = doc(db, collectionName, uid, 'history', recordId);
      await deleteDoc(recordRef);
      console.log(`[SimpleInputView] Deleted record ${recordId} from ${collectionName}/${uid}/history`);
    } catch (error) {
      // レコードが存在しない場合はエラーを無視（既に削除されている可能性）
      console.log(`[SimpleInputView] Record ${recordId} may not exist in subcollection, ignoring delete error`);
    }
  };

  // 既存データの読み込み
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const currentUid = auth.currentUser?.uid;
        if (!currentUid) return;
        
        // ★修正: サブコレクションから読み込む
        const subcollectionRef = collection(db, 'users', currentUid, 'history');
        const subcollectionQuery = query(subcollectionRef, orderBy('timestamp', 'desc'));
        const subcollectionSnap = await getDocs(subcollectionQuery);
        
        const history: SalesRecord[] = [];
        subcollectionSnap.forEach((doc) => {
          history.push(doc.data() as SalesRecord);
        });
        
        // 選択日付のデータを検索（編集モードの場合はIDで検索、そうでない場合は日付で検索）
        const dayRecord = initialRecordId
          ? history.find(r => r.id === initialRecordId && r.remarks?.includes('簡易モード'))
          : history.find(r => {
              const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
              return recordDateStr === dateStr && r.remarks?.includes('簡易モード');
            });

        if (dayRecord) {
          // 簡易モードのデータはremarksに情報が入っている想定
          setSales(dayRecord.amount.toString());
          
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
          
          // remarksから出庫時間・入庫時間を抽出
          let startTime = '';
          let endTime = '';
          const startTimeMatch = dayRecord.remarks?.match(/出庫時間=(\d{2}:\d{2})/);
          const endTimeMatch = dayRecord.remarks?.match(/入庫時間=(\d{2}:\d{2})/);
          if (startTimeMatch) {
            startTime = startTimeMatch[1];
          }
          if (endTimeMatch) {
            endTime = endTimeMatch[1];
          }
          setStartTime(startTime);
          setEndTime(endTime);
          
          // 備考を抽出（簡易モード: 乗車回数=..., 時間=..., 出庫時間=..., 入庫時間=..., 備考=... の形式から）
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
          setStartTime('');
          setEndTime('');
          setRemarks('');
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
    // 既に保存処理中の場合は何もしない（重複実行を防ぐ）
    if (isSaving) {
      return;
    }

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
      // ★重要: ドキュメントIDにスラッシュ（/）を含めない（Firestoreの階層区切り文字のため）
      const safeDateStr = dateStr.replace(/\//g, '-'); // スラッシュをハイフンに置換
      
      // remarksに出庫時間・入庫時間を含める
      let remarksStr = `簡易モード: 乗車回数=${rideCountNum}, 時間=${hoursNum}時間${minutesNum}分`;
      if (startTime) {
        remarksStr += `, 出庫時間=${startTime}`;
      }
      if (endTime) {
        remarksStr += `, 入庫時間=${endTime}`;
      }
      if (remarks) {
        remarksStr += `, 備考=${remarks}`;
      }
      
      const record: SalesRecord = {
        id: initialRecordId || `simple_${safeDateStr}_${Date.now()}`,
        amount: salesNum,
        toll: 0,
        paymentMethod: 'CASH' as PaymentMethod,
        nonCashAmount: 0,
        rideType: 'FLOW' as RideType,
        timestamp,
        remarks: remarksStr,
      };

      // ★修正: 既存の同じ日のレコードをサブコレクションから削除してから追加
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      
      // 選択日の開始時刻と終了時刻を計算
      const selectedDateStart = new Date(selectedDate);
      selectedDateStart.setHours(businessStartHour, 0, 0, 0);
      const selectedDateEnd = new Date(selectedDateStart);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
      const startTimestamp = selectedDateStart.getTime();
      const endTimestamp = selectedDateEnd.getTime() - 1;
      
      // サブコレクションから同日のデータを取得
      const subcollectionRef = collection(db, 'users', currentUid, 'history');
      const subcollectionQuery = query(
        subcollectionRef,
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp)
      );
      const subcollectionSnap = await getDocs(subcollectionQuery);
      
      const existingHistory: SalesRecord[] = [];
      subcollectionSnap.forEach((doc) => {
        existingHistory.push(doc.data() as SalesRecord);
      });
      
      // ★追加: 新規作成時、同日に詳細モードのデータがあるかチェック
      if (!initialRecordId) {
        const sameDayDetailedRecords = existingHistory.filter(r => {
          const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
          return recordDateStr === dateStr && !r.remarks?.includes('簡易モード');
        });
        
        if (sameDayDetailedRecords.length > 0) {
          const detailedTotal = sameDayDetailedRecords.reduce((sum, r) => sum + r.amount, 0);
          
          // ★修正: 詳細モードが存在する場合、常に警告を表示（金額の大小に関わらず）
          const confirmed = window.confirm(
            `詳細モードで既に${formatCurrency(detailedTotal)}の売上が登録されています。\n` +
            `今回登録する金額は${formatCurrency(salesNum)}です。\n\n` +
            `このまま続行すると、詳細モードのデータが削除され、簡易モードのデータに置き換えられます。\n\n` +
            `「OK」を選択すると、詳細モードのデータが削除され、簡易モードのデータが保存されます。\n` +
            `「キャンセル」を選択すると、保存を中断します。`
          );
          
          if (!confirmed) {
            setIsSaving(false);
            return; // 保存を中断
          }
        }
      }
      
      // ★修正: 同じ日の簡易モードレコードのみを削除（詳細モードデータは保持）
      // 簡易モードと詳細モードは排他的だが、詳細モードデータは保持して日別ランキングで簡易モード優先で表示
      const recordsToDelete = existingHistory.filter(r => {
        const recordDateStr = getBusinessDate(r.timestamp, businessStartHour);
        const isSameDay = recordDateStr === dateStr;
        const isSimpleMode = r.remarks?.includes('簡易モード');
        if (initialRecordId) {
          // 編集モード: 同じID、または同じ日の簡易モードレコードを削除
          return r.id === initialRecordId || (isSameDay && isSimpleMode);
        }
        // 新規作成モード: 同じ日の簡易モードレコードのみを削除（詳細モードは保持）
        return isSameDay && isSimpleMode;
      });
      
      // ★重要: usersとpublic_statusの両方のサブコレクションから該当レコードを削除
      const deleteBatch = writeBatch(db);
      for (const recordToDelete of recordsToDelete) {
        // usersコレクションから削除
        const usersRecordRef = doc(db, 'users', currentUid, 'history', recordToDelete.id);
        deleteBatch.delete(usersRecordRef);
        // public_statusコレクションからも削除
        const publicStatusRecordRef = doc(db, 'public_status', currentUid, 'history', recordToDelete.id);
        deleteBatch.delete(publicStatusRecordRef);
      }
      if (recordsToDelete.length > 0) {
        await deleteBatch.commit();
        console.log(`[SimpleInputView] Deleted ${recordsToDelete.length} records from both users and public_status subcollections`);
      }
      
      // ★修正: saveHistoryToSubcollection関数を使用してサブコレクションに保存
      // この関数は親ドキュメントの存在確認と作成も行う
      // App.tsxと同じく、エラーが発生しても処理を続行
      saveHistoryToSubcollection(currentUid, [record], 'users').catch(e => {
        console.error("[SimpleInputView] Failed to save to users subcollection:", e);
      });
      saveHistoryToSubcollection(currentUid, [record], 'public_status').catch(e => {
        console.error("[SimpleInputView] Failed to save to public_status subcollection:", e);
      });

      // public_statusドキュメントの統計情報を更新（ランキング表示用）
      // サブコレクションから全データを読み込んで計算
      const allHistoryRef = collection(db, 'public_status', currentUid, 'history');
      const allHistoryQuery = query(allHistoryRef, orderBy('timestamp', 'desc'));
      const allHistorySnap = await getDocs(allHistoryQuery);
      
      const allHistoryRecords: SalesRecord[] = [];
      allHistorySnap.forEach((doc) => {
        allHistoryRecords.push(doc.data() as SalesRecord);
      });
      
      // 月間合計を再計算（簡易モード優先）
      const periodStats = calculatePeriodStats(stats, allHistoryRecords, null);
      const monthlyTotal = periodStats.totalSales;

      // 歴代最高記録（トップ20）を計算（簡易モードのレコードは除外）
      const topRecordsData = allHistoryRecords
        .filter(r => !r.remarks?.includes('簡易モード'))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);

      const pubRef = doc(db, 'public_status', currentUid);
      const pubSnap = await getDoc(pubRef);
      const existingPubData = pubSnap.data() || {};
      
      const pubData: any = {
        monthlyTotal,
        monthlyGoal: stats.monthlyGoal || existingPubData.monthlyGoal || 1000000,
        topRecords: topRecordsData,
        name: stats.userName || existingPubData.name || '',
        lastUpdated: Date.now(),
      };
      await setDoc(pubRef, pubData, { merge: true });

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
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      
      // ★修正: サブコレクションから該当レコードを削除
      await deleteFromSubcollection(currentUid, initialRecordId, 'users');
      await deleteFromSubcollection(currentUid, initialRecordId, 'public_status');

      // public_statusドキュメントの統計情報を更新（ランキング表示用）
      // サブコレクションから全データを読み込んで計算
      const allHistoryRef = collection(db, 'public_status', currentUid, 'history');
      const allHistoryQuery = query(allHistoryRef, orderBy('timestamp', 'desc'));
      const allHistorySnap = await getDocs(allHistoryQuery);
      
      const allHistoryRecords: SalesRecord[] = [];
      allHistorySnap.forEach((doc) => {
        allHistoryRecords.push(doc.data() as SalesRecord);
      });
      
      // 月間合計を再計算（簡易モード優先）
      const periodStats = calculatePeriodStats(stats, allHistoryRecords, null);
      const monthlyTotal = periodStats.totalSales;

      // 歴代最高記録（トップ20）を計算（簡易モードのレコードは除外）
      const topRecordsData = allHistoryRecords
        .filter(r => !r.remarks?.includes('簡易モード'))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);

      const pubRef = doc(db, 'public_status', currentUid);
      const pubSnap = await getDoc(pubRef);
      const existingPubData = pubSnap.data() || {};
      
      const pubData: any = {
        monthlyTotal,
        monthlyGoal: stats.monthlyGoal || existingPubData.monthlyGoal || 1000000,
        topRecords: topRecordsData,
        name: stats.userName || existingPubData.name || '',
        lastUpdated: Date.now(),
      };
      await setDoc(pubRef, pubData, { merge: true });

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
                className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                id="work-date-input"
              />
              <label
                htmlFor="work-date-input"
                onClick={(e) => {
                  // PCブラウザでのクリックを確実に動作させるため、input要素を直接クリック
                  e.preventDefault();
                  const input = document.getElementById('work-date-input') as HTMLInputElement;
                  if (input) {
                    input.click();
                  }
                }}
                className="block text-white font-black text-base cursor-pointer text-right relative z-0"
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

        {/* 出庫時間・入庫時間（横並び） */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
            <div className="flex flex-col gap-2 relative">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-orange-500 flex-shrink-0" />
                <label className="text-base font-bold text-white flex-shrink-0">出庫時間</label>
              </div>
              <div className="flex-1 flex items-center justify-end gap-1 min-w-0 relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                  id="start-time-input"
                />
                <label
                  htmlFor="start-time-input"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = document.getElementById('start-time-input') as HTMLInputElement;
                    if (input) {
                      input.click();
                    }
                  }}
                  className="block text-white font-black text-base cursor-pointer text-right relative z-0 pr-8 w-full"
                >
                  {startTime || '選択して下さい'}
                </label>
                <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none z-0">
                  <ChevronDown className="w-5 h-5 text-orange-400" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500/50">
            <div className="flex flex-col gap-2 relative">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-orange-500 flex-shrink-0" />
                <label className="text-base font-bold text-white flex-shrink-0">入庫時間</label>
              </div>
              <div className="flex-1 flex items-center justify-end gap-1 min-w-0 relative">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                  id="end-time-input"
                />
                <label
                  htmlFor="end-time-input"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = document.getElementById('end-time-input') as HTMLInputElement;
                    if (input) {
                      input.click();
                    }
                  }}
                  className="block text-white font-black text-base cursor-pointer text-right relative z-0 pr-8 w-full"
                >
                  {endTime || '選択して下さい'}
                </label>
                <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none z-0">
                  <ChevronDown className="w-5 h-5 text-orange-400" />
                </div>
              </div>
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
                  }
                }}
                onChange={(e) => {
                  // 営業回数と同じ方式：数値のみを許可
                  const originalValue = e.target.value;
                  const numericValue = originalValue.replace(/[^0-9]/g, '');
                  setSales(numericValue);
                }}
                onFocus={(e) => {
                  const target = e.target;
                  const value = target.value;
                  if (value) {
                    setTimeout(() => {
                      // 値の末尾にカーソルを配置
                      const len = value.length;
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
                  }
                }}
                onChange={(e) => {
                  const originalValue = e.target.value;
                  const numericValue = originalValue.replace(/[^0-9]/g, '');
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
      
    </div>
  );
};
