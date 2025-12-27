import React, { useState } from 'react';
import { FileUp, Download, Loader2, User } from 'lucide-react';
import { SalesRecord, PaymentMethod, RideType } from '../types';
import { PAYMENT_LABELS, RIDE_LABELS } from '../utils';

interface CsvImportSectionProps {
  onImport: (records: SalesRecord[], targetUid?: string) => void;
  isAdmin: boolean;
  users: { uid: string, name: string }[];
}

export const CsvImportSection: React.FC<CsvImportSectionProps> = ({ onImport, isAdmin, users }) => {
  const [isImporting, setIsImporting] = useState(false);
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

  // CSVパース処理
  const parseCSVContent = (text: string, isShiftJIS: boolean): boolean => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return false;

    const firstLine = lines[0];
    let separator = ',';
    if (firstLine.indexOf('\t') !== -1) {
      separator = '\t';
    }

    const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    if (!headers.includes('営業日付') || (!headers.includes('売上金額') && !headers.includes('運賃'))) {
      return false;
    }

    const records: SalesRecord[] = [];
    const now = Date.now();

    const parseSafeInt = (val: string | undefined) => {
      if (!val) return 0;
      const cleanVal = val.replace(/[",\s]/g, '');
      const num = parseInt(cleanVal, 10);
      return isNaN(num) ? 0 : num;
    };

    for (let i = 1; i < lines.length; i++) {
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

      const pMale = parseSafeInt(cols[headers.indexOf('(男)')]);
      const pFemale = parseSafeInt(cols[headers.indexOf('(女)')]);

      const [year, month, day] = dateStr.split('-').map(Number);
      const hour = parseInt(hourStr.replace(/[",\s]/g, ''), 10) || 0;
      const minute = parseInt(minStr.replace(/[",\s]/g, ''), 10) || 0;
      
      let finalYear = year;
      let finalMonth = month - 1;
      let finalDay = day;
      let finalHour = hour;

      if (finalHour >= 24) {
        finalHour -= 24;
        const tempDate = new Date(finalYear, finalMonth, finalDay);
        tempDate.setDate(tempDate.getDate() + 1);
        finalYear = tempDate.getFullYear();
        finalMonth = tempDate.getMonth();
        finalDay = tempDate.getDate();
      }

      const recordDate = new Date(finalYear, finalMonth, finalDay, finalHour, minute);
      const timestamp = isNaN(recordDate.getTime()) ? now : recordDate.getTime();

      let paymentMethod: PaymentMethod = 'CASH';
      if (payLabel.includes('DiDi') || payLabel.includes('GO')) paymentMethod = 'DIDI';
      else if (payLabel.includes('クレジット')) paymentMethod = 'CARD';
      else if (payLabel.includes('ネット')) paymentMethod = 'NET';
      else if (payLabel.includes('交通系') || payLabel.includes('Suica') || payLabel.includes('IC')) paymentMethod = 'TRANSPORT';
      else if (payLabel.includes('チケット')) paymentMethod = 'TICKET';
      else if (payLabel.includes('QR') || payLabel.includes('PayPay')) paymentMethod = 'QR';
      
      let rideType: RideType = 'FLOW';
      if (rideLabel.includes('ア')) rideType = 'APP';
      else if (rideLabel.includes('待')) rideType = 'WAIT';
      else if (rideLabel.includes('迎')) rideType = 'DISPATCH';
      
      records.push({
        id: Math.random().toString(36).substr(2, 9),
        amount,
        toll,
        paymentMethod,
        rideType,
        nonCashAmount: nonCash,
        timestamp,
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        pickupCoords: (pickupLat && pickupLng) ? `${pickupLat},${pickupLng}` : '',
        dropoffCoords: (dropoffLat && dropoffLng) ? `${dropoffLat},${dropoffLng}` : '',
        passengersMale: pMale,
        passengersFemale: pFemale,
        remarks: payLabel,
        isBadCustomer: false
      });
    }

    if (records.length > 0) {
      const targetName = isAdmin && selectedUser 
        ? users.find(u => u.uid === selectedUser)?.name 
        : "あなた";
      
      if (window.confirm(`${targetName} のデータとして ${records.length}件 取り込みますか？\n（既存の日時のデータは上書き更新されます）`)) {
        // 管理者モードでユーザー未選択の場合は処理しない、等のガードも可能だが
        // ここでは未選択なら「自分」または「空文字（呼び出し元で処理）」とする
        onImport(records, selectedUser);
      }
      return true;
    }
    
    return false;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isAdmin && !selectedUser) {
        if (!window.confirm("ユーザーが選択されていません。\nあなた自身のデータとして取り込みますか？")) {
            e.target.value = ""; // リセット
            return;
        }
    }

    setIsImporting(true);

    const readerUTF8 = new FileReader();
    readerUTF8.onload = (event) => {
      const text = event.target?.result as string;
      const success = parseCSVContent(text, false);
      
      if (!success) {
        const readerSJIS = new FileReader();
        readerSJIS.onload = (ev2) => {
           const textSJIS = ev2.target?.result as string;
           const successSJIS = parseCSVContent(textSJIS, true);
           if (!successSJIS) {
             alert('CSVの形式が認識できませんでした。\n・乗降明細形式であることを確認してください\n・文字コードが UTF-8 または Shift-JIS である必要があります');
           }
           setIsImporting(false);
        };
        // @ts-ignore
        readerSJIS.readAsText(file, 'Shift_JIS');
      } else {
        setIsImporting(false);
      }
    };
    readerUTF8.readAsText(file);
  };

  return (
    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
           <FileUp className="w-5 h-5"/> 過去データの取り込み (管理者)
        </label>
        
        <button 
          onClick={handleDownloadSampleCSV}
          className="text-[10px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-600 transition-colors active:scale-95"
        >
          <Download className="w-3 h-3" /> サンプルCSV
        </button>
      </div>

      {isAdmin && (
        <div className="bg-gray-950 p-3 rounded-2xl border border-gray-700 flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-2">
                <User className="w-4 h-4" /> 取り込み対象ユーザーを選択
            </label>
            <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-gray-900 text-white font-bold p-3 rounded-xl border border-gray-700 outline-none"
            >
                <option value="">自分 (ログインユーザー)</option>
                {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.name}</option>
                ))}
            </select>
        </div>
      )}

      <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-[10px] text-gray-400 mb-2">
        <p className="font-bold text-white mb-1">対応フォーマット:</p>
        <p>乗降明細 (タブ区切り/カンマ区切り・Shift-JIS対応)</p>
        <p className="mt-1 text-gray-500">※既存の日時・金額のデータは自動で更新されます。</p>
      </div>
      
      <label className="flex items-center justify-center w-full py-4 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-2xl cursor-pointer transition-all active:scale-95 group">
        <div className="flex flex-col items-center gap-2">
          {isImporting ? (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          ) : (
            <FileUp className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
          )}
          <span className="text-sm font-bold text-blue-100">CSVファイルを選択してインポート</span>
        </div>
        <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" disabled={isImporting} />
      </label>
    </div>
  );
};