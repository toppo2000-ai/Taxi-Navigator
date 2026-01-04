import React, { useState } from 'react';
import { FileUp, Download, Loader2, User, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SalesRecord, PaymentMethod, RideType } from '../../types';
import { PAYMENT_LABELS, RIDE_LABELS, getBillingPeriod, formatDate } from '../../utils';

interface CsvImportSectionProps {
  onImport: (
    records: SalesRecord[], 
    targetUid?: string, 
    options?: { mergeMode: 'overwrite' | 'skip' },
    onProgress?: (current: number, total: number, message: string) => void
  ) => Promise<{ addedCount: number, replaceCount: number }>;
  isAdmin: boolean;
  users: { uid: string, name: string }[];
  customPaymentLabels?: Record<string, string>; // ★追加: カスタム決済方法ラベル
  enabledPaymentMethods?: PaymentMethod[]; // ★追加: 有効な決済方法
}

export const CsvImportSection: React.FC<CsvImportSectionProps> = ({ 
  onImport, 
  isAdmin, 
  users, 
  customPaymentLabels = {}, 
  enabledPaymentMethods = [] 
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, message: '' });
  const [importResult, setImportResult] = useState<{ addedCount: number, replaceCount: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");

  // サンプルCSVダウンロード
  const handleDownloadSampleCSV = () => {
    const headers = [
      "営業日付", "乗車(時)", "乗車(分)", "乗車地(地名)", "乗車地(緯度)", "乗車地(経度)", 
      "降車(時)", "降車(分)", "降車地(地名)", "降車地(緯度)", "降車地(経度)", 
      "(男)", "(女)", "(子)", "人数", "売上金額", "消費税率", "未収金額", "別収金額", 
      "迎車料金", "往路通行料", "復路通行料", "障割金額", "遠割金額", "空車", "領収書", "備考", "目印", "区分"
    ];
    
    const sampleRow = [
      "2025-12-20", "22", "2", "巽南3", "34.6401", "135.5532",
      "22", "15", "足代新町", "34.6654", "135.5606",
      "2", "0", "0", "2", "2800", "10", "2800", "0",
      "0", "0", "0", "0", "0", "0", "0", "DiDiアプリ決済", "0", "ア"
    ];

    const csvString = [
      headers.join(","),
      sampleRow.join(",")
    ].join("\r\n");

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_taxi_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excelの日付パース（Excelシリアル番号または文字列日付を処理）
  const robustParseDate = (input: any, h: any, m: any): number => {
    let base: Date;
    const inputStr = String(input || '').trim();
    
    // Excelシリアル番号の場合（数値のみ、または大きな数値）
    if (typeof input === 'number' || (!isNaN(Number(input)) && !inputStr.includes('/') && !inputStr.includes('-'))) {
      const serial = parseFloat(inputStr);
      // Excelシリアル番号からJavaScriptのタイムスタンプに変換
      // 25569は1900年1月1日からの日数（Excelの基準日）
      base = new Date((serial - 25569) * 86400 * 1000);
    } else {
      // 文字列日付の場合
      // まず、YYYY-MM-DD または YYYY/MM/DD 形式を試す
      const dateMatch = inputStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1; // 月は0ベース
        const day = parseInt(dateMatch[3], 10);
        base = new Date(year, month, day);
      } else {
        // フォールバック: 標準のDateパース
        base = new Date(inputStr.replace(/-/g, '/'));
      }
    }
    
    if (isNaN(base.getTime())) return NaN;
    
    let hour = parseInt(String(h || 0), 10);
    let min = parseInt(String(m || 0), 10);
    
    // 時と分を設定（24時間を超える場合は日を進める）
    // 例：30時12分 = 翌日の6時12分
    if (hour >= 24) {
      const daysToAdd = Math.floor(hour / 24);
      base.setDate(base.getDate() + daysToAdd);
      hour = hour % 24;
    }
    base.setHours(hour, min, 0, 0);
    
    // デバッグ: パース結果を確認
    const finalDate = new Date(base.getTime());
    if (finalDate.getFullYear() === 2025 && finalDate.getMonth() === 11 && finalDate.getDate() >= 20) {
      console.log('日付パース成功:', {
        元の営業日付: input,
        元の時: h,
        元の分: m,
        パース結果: finalDate.toLocaleString('ja-JP'),
        timestamp: base.getTime()
      });
    }
    
    return base.getTime();
  };

  // ★追加: カスタムラベルに基づいて決済方法を判定する関数
  const detectPaymentMethod = (payLabel: string, targetCustomLabels: Record<string, string>, targetEnabledMethods: PaymentMethod[]): PaymentMethod => {
    // まず、カスタムラベルの値（表示名）から判定
    for (const [method, customLabel] of Object.entries(targetCustomLabels)) {
      if (customLabel && payLabel.includes(customLabel)) {
        // 有効な決済方法か確認
        if (targetEnabledMethods.includes(method as PaymentMethod)) {
          return method as PaymentMethod;
        }
      }
    }

    // カスタムラベルで見つからない場合、デフォルトラベルで判定
    for (const [method, defaultLabel] of Object.entries(PAYMENT_LABELS)) {
      if (payLabel.includes(defaultLabel)) {
        // 有効な決済方法か確認
        if (targetEnabledMethods.includes(method as PaymentMethod)) {
          return method as PaymentMethod;
        }
      }
    }

    // それでも見つからない場合、キーワードベースの判定（フォールバック）
    if (payLabel.includes('DiDi') || payLabel.includes('GO') || payLabel.includes('Uber')) {
      if (targetEnabledMethods.includes('DIDI')) return 'DIDI';
      if (targetEnabledMethods.includes('GO')) return 'GO';
      if (targetEnabledMethods.includes('UBER')) return 'UBER';
    }
    if (payLabel.includes('クレジット') || payLabel.includes('カード')) {
      if (targetEnabledMethods.includes('CARD')) return 'CARD';
    }
    if (payLabel.includes('ネット決済')) {
      if (targetEnabledMethods.includes('NET')) return 'NET';
    }
    if (payLabel.includes('チケット')) {
      if (targetEnabledMethods.includes('TICKET')) return 'TICKET';
    }
    if (payLabel.includes('電子マネー')) {
      if (targetEnabledMethods.includes('E_MONEY')) return 'E_MONEY';
    }
    if (payLabel.includes('Suica') || payLabel.includes('交通') || payLabel.includes('IC')) {
      if (targetEnabledMethods.includes('TRANSPORT')) return 'TRANSPORT';
    }
    if (payLabel.includes('QR') || payLabel.includes('PayPay')) {
      if (targetEnabledMethods.includes('QR')) return 'QR';
    }

    // デフォルトは現金
    return 'CASH';
  };

  // Excelパース処理（onProgressコールバックを受け取る）
  const parseExcelContent = async (
    file: File, 
    targetCustomLabels: Record<string, string>,
    targetEnabledMethods: PaymentMethod[],
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ records: SalesRecord[], addedCount: number, replaceCount: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          onProgress?.(0, 100, 'Excelファイルを読み込み中...');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { range: 0, defval: "" });

          onProgress?.(10, 100, 'データを解析中...');
          const records: SalesRecord[] = [];
          let addedCount = 0;
          let replaceCount = 0;

          const totalRows = rows.length;
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const progress = 10 + Math.floor((i / totalRows) * 80);
            onProgress?.(progress, 100, `${i + 1}/${totalRows} 件処理中...`);

            const ts = robustParseDate(row['営業日付'], row['乗車(時)'], row['乗車(分)']);
            if (isNaN(ts)) {
              console.warn('日付パース失敗:', row['営業日付'], row['乗車(時)'], row['乗車(分)']);
              continue;
            }
            // デバッグ: 12/20以降のデータを確認
            const parsedDate = new Date(ts);
            if (parsedDate.getFullYear() === 2025 && parsedDate.getMonth() === 11 && parsedDate.getDate() >= 20) {
              console.log('12/20以降のデータ検出:', {
                営業日付: row['営業日付'],
                乗車時: row['乗車(時)'],
                乗車分: row['乗車(分)'],
                パース結果: parsedDate.toLocaleString('ja-JP'),
                timestamp: ts
              });
            }

            const amt = parseInt(String(row['売上金額'] || 0).replace(/,/g, ''));
            if (!amt || amt <= 0) continue;

            // ★修正: カスタムラベルに基づいて決済方法を判定
            const payLabel = String(row['備考'] || "");
            const paymentMethod = detectPaymentMethod(payLabel, targetCustomLabels, targetEnabledMethods);

            const nonCash = parseInt(String(row['未収金額'] || 0).replace(/,/g, ''));
            const rideLabel = String(row['区分'] || "");
            let rideType: RideType = 'FLOW';
            if (rideLabel.includes('ア')) rideType = 'APP';
            else if (rideLabel.includes('待')) rideType = 'WAIT';
            else if (rideLabel.includes('迎')) rideType = 'APP';
            else if (rideLabel.includes('配')) rideType = 'APP';

            const pMale = parseInt(String(row['(男)'] || 0));
            const pFemale = parseInt(String(row['(女)'] || 0));
            const tollOut = parseInt(String(row['往路通行料'] || 0).replace(/,/g, ''));
            const tollIn = parseInt(String(row['復路通行料'] || 0).replace(/,/g, ''));
            const toll = tollOut + tollIn;
            const returnToll = tollIn;

            const record: SalesRecord = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: ts,
              amount: amt,
              sales: amt,
              toll,
              returnToll,
              paymentMethod,
              rideType,
              nonCashAmount: nonCash,
              pickupLocation: String(row['乗車地(地名)'] || ""),
              dropoffLocation: String(row['降車地(地名)'] || ""),
              pickupCoords: (row['乗車地(緯度)'] && row['乗車地(経度)']) ? `${row['乗車地(緯度)']},${row['乗車地(経度)']}` : "",
              dropoffCoords: (row['降車地(緯度)'] && row['降車地(経度)']) ? `${row['降車地(緯度)']},${row['降車地(経度)']}` : "",
              isBadCustomer: false,
              remarks: payLabel,
              passengersMale: pMale,
              passengersFemale: pFemale
            };

            records.push(record);
          }

          onProgress?.(100, 100, '解析完了');
          resolve({ records, addedCount: 0, replaceCount: 0 }); // 重複チェックはonImport側で行う
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // CSVパース処理（onProgressコールバックを受け取る）
  const parseCSVContent = (
    text: string, 
    isShiftJIS: boolean,
    targetCustomLabels: Record<string, string>,
    targetEnabledMethods: PaymentMethod[],
    onProgress?: (current: number, total: number, message: string) => void
  ): { records: SalesRecord[], success: boolean } => {
    onProgress?.(0, 100, 'CSVファイルを解析中...');
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { records: [], success: false };

    const firstLine = lines[0];
    let separator = ',';
    if (firstLine.indexOf('\t') !== -1) {
      separator = '\t';
    }

    const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    if (!headers.includes('営業日付') || (!headers.includes('売上金額') && !headers.includes('運賃'))) {
      return { records: [], success: false };
    }

    const records: SalesRecord[] = [];
    const now = Date.now();

    const parseSafeInt = (val: string | undefined) => {
      if (!val) return 0;
      const cleanVal = val.replace(/[",\s]/g, '');
      const num = parseInt(cleanVal, 10);
      return isNaN(num) ? 0 : num;
    };

    const totalLines = lines.length - 1;
    for (let i = 1; i < lines.length; i++) {
      const progress = Math.floor((i / totalLines) * 90);
      onProgress?.(progress, 100, `${i}/${totalLines} 件処理中...`);

      const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < headers.length - 10) continue;

      const dateStr = cols[headers.indexOf('営業日付')]?.replace(/\//g, '-') || '';
      const hourStr = cols[headers.indexOf('乗車(時)')] || '0';
      const minStr = cols[headers.indexOf('乗車(分)')] || '0';
      
      const amountIndex = headers.indexOf('売上金額') !== -1 ? headers.indexOf('売上金額') : headers.indexOf('運賃');
      const amount = parseSafeInt(cols[amountIndex]);
      
      const tollOut = parseSafeInt(cols[headers.indexOf('往路通行料')]);
      const tollIn = parseSafeInt(cols[headers.indexOf('復路通行料')]);
      const toll = tollOut + tollIn;
      
      const nonCash = parseSafeInt(cols[headers.indexOf('未収金額')]);
      
      const rideLabel = headers.indexOf('区分') !== -1 ? cols[headers.indexOf('区分')] : '';
      const payLabel = headers.indexOf('備考') !== -1 ? cols[headers.indexOf('備考')] : '';
      
      const pickup = headers.indexOf('乗車地(地名)') !== -1 ? cols[headers.indexOf('乗車地(地名)')] : '';
      const dropoff = headers.indexOf('降車地(地名)') !== -1 ? cols[headers.indexOf('降車地(地名)')] : '';
      
      const pickupLat = headers.indexOf('乗車地(緯度)') !== -1 ? cols[headers.indexOf('乗車地(緯度)')] : '';
      const pickupLng = headers.indexOf('乗車地(経度)') !== -1 ? cols[headers.indexOf('乗車地(経度)')] : '';
      const dropoffLat = headers.indexOf('降車地(緯度)') !== -1 ? cols[headers.indexOf('降車地(緯度)')] : '';
      const dropoffLng = headers.indexOf('降車地(経度)') !== -1 ? cols[headers.indexOf('降車地(経度)')] : '';
      
      const pickupCoords = (pickupLat && pickupLng) ? `${pickupLat},${pickupLng}` : "";
      const dropoffCoords = (dropoffLat && dropoffLng) ? `${dropoffLat},${dropoffLng}` : "";

      const pMale = parseSafeInt(cols[headers.indexOf('(男)')]);
      const pFemale = parseSafeInt(cols[headers.indexOf('(女)')]);
      
      const remarks = payLabel || '';
      const isBadCustomer = (cols[headers.indexOf('目印')] || '').includes('注意') || (cols[headers.indexOf('目印')] || '').includes('★');
      
      // 区分から乗車種別を判定
      let rideType: RideType = 'FLOW';
      if (rideLabel) {
        if (rideLabel.includes('ア')) rideType = 'DISPATCH';
        else if (rideLabel.includes('配')) rideType = 'DISPATCH';
        else if (rideLabel.includes('迎')) rideType = 'PICKUP';
        else if (rideLabel.includes('待')) rideType = 'WAIT';
        else rideType = 'FLOW';
      }
      
      // ★修正: カスタムラベルに基づいて決済方法を判定
      const paymentMethod = detectPaymentMethod(payLabel, targetCustomLabels, targetEnabledMethods);

      const returnToll = parseSafeInt(cols[headers.indexOf('復路通行料')]);

      if (dateStr && amount > 0) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const hour = parseInt(hourStr) || 0;
        const min = parseInt(minStr) || 0;
        const timestamp = new Date(year, month - 1, day, hour, min).getTime();

        records.push({
          id: Math.random().toString(36).substr(2, 9),
          amount,
          toll,
          returnToll,
          paymentMethod,
          nonCashAmount: nonCash,
          rideType,
          timestamp,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          pickupCoords,
          dropoffCoords,
          passengersMale: pMale,
          passengersFemale: pFemale,
          remarks,
          isBadCustomer
        });
      }
    }

    onProgress?.(100, 100, '解析完了');
    return { records, success: records.length > 0 };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportProgress({ current: 0, total: 100, message: '準備中...' });
    setImportResult(null);
    
    try {
      // ★修正: 選択されたユーザー（または自分）の設定を読み込む
      // ここでは、onImportコールバック内で読み込むため、現在のcustomPaymentLabelsとenabledPaymentMethodsを渡す
      // （実際の読み込みはonImport内で行われる）
      const targetCustomLabels = customPaymentLabels;
      const targetEnabledMethods = enabledPaymentMethods.length > 0 ? enabledPaymentMethods : ['CASH', 'CARD', 'NET', 'TICKET', 'E_MONEY', 'TRANSPORT', 'QR', 'DIDI', 'GO', 'UBER', 'PAYPAY', 'LINEPAY', 'IC', 'CREDIT'] as PaymentMethod[];

      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      
      if (isExcel) {
        // Excelファイルの処理
        const result = await parseExcelContent(file, targetCustomLabels, targetEnabledMethods, (current, total, message) => {
          setImportProgress({ current, total, message });
        });
        if (result.records.length > 0) {
          const targetUid = (isAdmin && selectedUser) ? selectedUser : undefined;
          setImportProgress({ current: 90, total: 100, message: 'データを保存中...' });
          const importResult = await onImport(result.records, targetUid, { mergeMode: 'overwrite' }, (current, total, message) => {
            setImportProgress({ current: 90 + Math.floor((current / total) * 10), total: 100, message });
          });
          setImportResult(importResult);
          setImportProgress({ current: 100, total: 100, message: '完了！' });
        } else {
          alert('取り込むデータがありませんでした。');
          setIsImporting(false);
        }
      } else {
        // CSVファイルの処理
        let text = await file.text();
        
        // Shift-JIS判定と変換
        const isShiftJIS = !fileName.endsWith('.csv') || text.includes('€');
        
        if (isShiftJIS) {
          setImportProgress({ current: 5, total: 100, message: 'Shift-JIS形式を変換中...' });
          // ArrayBufferとして読み込んでデコード
          const buffer = await file.arrayBuffer();
          const decoder = new TextDecoder('shift-jis');
          text = decoder.decode(buffer);
        }
        
        const { records, success } = parseCSVContent(text, isShiftJIS, targetCustomLabels, targetEnabledMethods, (current, total, message) => {
          setImportProgress({ current, total, message });
        });
        
        if (success && records.length > 0) {
          const targetUid = (isAdmin && selectedUser) ? selectedUser : undefined;
          setImportProgress({ current: 90, total: 100, message: 'データを保存中...' });
          const importResult = await onImport(records, targetUid, { mergeMode: 'overwrite' }, (current, total, message) => {
            setImportProgress({ current: 90 + Math.floor((current / total) * 10), total: 100, message });
          });
          setImportResult(importResult);
          setImportProgress({ current: 100, total: 100, message: '完了！' });
        } else {
          alert('CSVの形式が正しくありません。サンプルCSVをダウンロードして確認してください。');
          setIsImporting(false);
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('ファイルの読み込みに失敗しました。');
      setIsImporting(false);
    } finally {
      // 完了後3秒後にリセット
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress({ current: 0, total: 0, message: '' });
        setImportResult(null);
        e.target.value = '';
      }, 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* ★追加: 完了ポップアップ */}
      {importResult && !isImporting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#131C2B] rounded-3xl p-6 max-w-md w-full mx-4 border-2 border-green-500/30 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <h3 className="text-2xl font-black text-white">インポート完了</h3>
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 font-bold">新規追加</span>
                  <span className="text-white font-black text-xl">{importResult.addedCount}件</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 font-bold">上書き更新</span>
                  <span className="text-white font-black text-xl">{importResult.replaceCount}件</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setImportResult(null);
                  setIsImporting(false);
                  setImportProgress({ current: 0, total: 0, message: '' });
                }}
                className="w-full bg-green-500 text-black py-3 rounded-2xl font-black text-lg active:scale-95 transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">CSV / Excelインポート</h4>
          <button
            onClick={handleDownloadSampleCSV}
            className="text-xs bg-blue-600/20 text-blue-400 font-black px-3 py-1.5 rounded-full border border-blue-500/20 active:scale-95 flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            サンプルダウンロード
          </button>
        </div>
        
        {isAdmin && users.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
              インポート先ユーザー
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2 text-white text-sm font-black outline-none focus:border-blue-500"
            >
              <option value="">自分</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ★追加: プログレスバー */}
        {isImporting && (
          <div className="mb-4 space-y-2">
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ease-out"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-bold">{importProgress.message}</span>
              <span className="text-gray-500 font-black">{importProgress.current}%</span>
            </div>
          </div>
        )}

        <label className="relative block">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isImporting}
            className="hidden"
          />
          <div className={`w-full py-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
            isImporting 
              ? 'bg-gray-800 border-gray-700 cursor-not-allowed' 
              : 'bg-gray-800/50 border-blue-500/30 hover:border-blue-500/50 active:scale-95'
          }`}>
            {isImporting ? (
              <>
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <span className="text-sm font-bold text-gray-400">{importProgress.message}</span>
              </>
            ) : (
              <>
                <FileUp className="w-6 h-6 text-blue-400" />
                <span className="text-sm font-black text-white">CSV / Excelファイルを選択</span>
                <span className="text-xs text-gray-500">CSV: Shift-JIS / UTF-8対応 | Excel: .xlsx / .xls対応</span>
              </>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};
