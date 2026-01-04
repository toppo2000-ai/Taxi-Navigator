import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Target, 
  ArrowUpDown, 
  MessageSquare, 
  Settings,
  FileDown,
  Gauge,
  Clock,
  X
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SalesRecord, DayMetadata, PaymentMethod } from '../../types';
import { 
  formatBusinessTime,
  formatCurrency, 
  calculateTaxAmount,
  PAYMENT_LABELS, 
  RIDE_LABELS,
  getPaymentBreakdown,
  getRideBreakdown,
  getRideCounts,
  formatTime
} from '../../utils';
import { SalesRecordCard } from './SalesRecordCard';
import { PaymentBreakdownList, getPaymentCounts } from './PaymentBreakdownList';
import { RideBreakdownList } from './RideBreakdownList';
import { ModalWrapper } from '../common/modals/ModalWrapper';

interface ReportSummaryViewProps {
  records: SalesRecord[];
  customLabels: Record<string, string>;
  startTime?: number;
  endTime?: number;
  totalRestMinutes?: number;
  enabledMethods?: PaymentMethod[];
  startOdo?: number;
  endOdo?: number;
}

export const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({ 
  records, 
  customLabels, 
  startTime, 
  endTime, 
  totalRestMinutes, 
  enabledMethods,
  startOdo,
  endOdo
}) => {
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);
  const taxAmount = calculateTaxAmount(totalAmount);
  const breakdown = getPaymentBreakdown(records);
  const counts = getPaymentCounts(records);
  const cashAmount = breakdown['CASH'] || 0;
  const rideBreakdown = getRideBreakdown(records);
  const rideCounts = getRideCounts(records);
  
  const displayStart = startTime || (records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : 0);
  const displayEnd = endTime || (records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : 0);
  const workDurationMs = (displayEnd - displayStart);
  const durationHrs = Math.floor(workDurationMs / 3600000);
  const durationMins = Math.floor((workDurationMs % 3600000) / 60000);
  const durationStr = displayStart && displayEnd 
    ? `${durationHrs}時間${String(durationMins).padStart(2, '0')}分` 
    : '--時間--分';
  
  const breakH = Math.floor((totalRestMinutes || 0) / 60);
  const breakM = (totalRestMinutes || 0) % 60;
  const breakStr = `${breakH}時間${String(breakM).padStart(2, '0')}分`;
  
  const maleTotal = records.reduce((s, r) => s + (r.passengersMale || 0), 0);
  const femaleTotal = records.reduce((s, r) => s + (r.passengersFemale || 0), 0);
  const totalPassengers = maleTotal + femaleTotal;
  
  const totalToll = records.reduce((s, r) => s + r.toll, 0);
  const totalReturnToll = records.reduce((s, r) => s + (r.returnToll || 0), 0);

  const distance = (startOdo && endOdo && endOdo > startOdo) ? endOdo - startOdo : 0;

  const safeCustomLabels = customLabels || {};
  
  const [showWorkTimeModal, setShowWorkTimeModal] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);
  
  const formatTimeStr = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };
  
  const actualStartTime = startTime || (records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : 0);
  const actualEndTime = endTime || (records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : 0);

  return (
    <div className="w-full space-y-6">
      {/* 稼働時間モーダル */}
      {showWorkTimeModal && (
        <ModalWrapper onClose={() => setShowWorkTimeModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-400" />
                稼働時間
              </h3>
              <button
                onClick={() => setShowWorkTimeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-sm text-gray-400 font-bold mb-2">出庫時間</div>
                <div className="text-2xl font-black text-white">
                  {actualStartTime ? formatTimeStr(actualStartTime) : '---'}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-sm text-gray-400 font-bold mb-2">入庫時間</div>
                <div className="text-2xl font-black text-white">
                  {actualEndTime ? formatTimeStr(actualEndTime) : '---'}
                </div>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}
      
      {/* 休憩モーダル */}
      {showRestModal && (
        <ModalWrapper onClose={() => setShowRestModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-green-400" />
                休憩履歴
              </h3>
              <button
                onClick={() => setShowRestModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {totalRestMinutes && totalRestMinutes > 0 ? (
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 font-bold mb-2">合計休憩時間</div>
                  <div className="text-2xl font-black text-white">{breakStr}</div>
                </div>
                <div className="text-sm text-gray-400 text-center py-4">
                  休憩の詳細履歴は現在保存されていません
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                休憩履歴がありません
              </div>
            )}
          </div>
        </ModalWrapper>
      )}
      <div className="text-center py-8 bg-gray-800 rounded-[32px] border-2 border-blue-500 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
        <p className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] mb-2 opacity-80">本日の営収 (税込)</p>
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-6xl font-black text-amber-600/80">¥</span>
          <span className="text-7xl font-black text-amber-500 leading-none tracking-tighter drop-shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
            {totalAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 mb-8">
          <p className="text-xl font-bold text-gray-400">(内消費税 {formatCurrency(taxAmount)})</p>
          <p className="text-xl font-bold text-gray-400">本日の営収(税抜) {formatCurrency(totalAmount - taxAmount)}</p>
        </div>
        <div className="bg-gray-800 mx-6 p-5 rounded-3xl border-2 border-blue-500 flex flex-col items-center gap-2 shadow-inner">
          <span className="text-sm text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
            納金額 (現金)
          </span>
          <span className="text-5xl font-black text-white tracking-tight">{formatCurrency(cashAmount)}</span>
        </div>
      </div>

      {totalToll > 0 && (
        <div className="bg-gradient-to-r from-orange-900/60 to-red-900/60 p-4 rounded-2xl border border-orange-500/30 flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xl font-bold text-orange-200 block uppercase tracking-widest">高速代 計</span>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(totalToll)}
          </span>
        </div>
      )}

      {totalReturnToll > 0 && (
        <div className="bg-gradient-to-r from-indigo-900/60 to-blue-900/60 p-4 rounded-2xl border border-indigo-500/30 flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xl font-bold text-indigo-200 block uppercase tracking-widest">帰路高速代</span>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(totalReturnToll)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800 p-2 rounded-3xl border-2 border-blue-500 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
          <span className="text-[12px] text-gray-500 font-black tracking-widest uppercase mb-1">総回数</span>
          <span className="text-2xl font-black text-white leading-none">{records.length}<span className="text-xs text-gray-600 ml-1">回</span></span>
        </div>
        <button
          onClick={() => setShowWorkTimeModal(true)}
          className="bg-gray-800 p-2 rounded-3xl border-2 border-blue-500 flex flex-col items-center justify-center min-h-[100px] shadow-lg active:scale-95 transition-transform cursor-pointer"
        >
          <span className="text-[12px] text-gray-500 font-black tracking-widest uppercase mb-1">稼働時間</span>
          <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{durationStr}</span>
        </button>
        <button
          onClick={() => setShowRestModal(true)}
          className="bg-gray-800 p-2 rounded-3xl border-2 border-blue-500 flex flex-col items-center justify-center min-h-[100px] shadow-lg active:scale-95 transition-transform cursor-pointer"
        >
          <span className="text-[12px] text-gray-500 font-black tracking-widest uppercase mb-1">休憩</span>
          <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{breakStr}</span>
        </button>
      </div>
      
      {(startOdo || endOdo) && (
        <div className="grid grid-cols-3 gap-2 px-1">
            <div className="bg-gray-800 p-3 rounded-2xl text-center border-2 border-blue-500 flex flex-col items-center justify-center shadow-lg">
                <span className="text-[12px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1"><Gauge className="w-3 h-3"/>開始ODO</span>
                <span className="text-lg font-black text-white">{startOdo ? startOdo.toLocaleString() : '---'}</span>
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl text-center border-2 border-blue-500 flex flex-col items-center justify-center shadow-lg">
                <span className="text-[12px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1"><Gauge className="w-3 h-3"/>終了ODO</span>
                <span className={`text-lg font-black ${endOdo ? 'text-amber-500' : 'text-gray-600'}`}>
                    {endOdo ? endOdo.toLocaleString() : '---'}
                </span>
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl text-center border-2 border-blue-500 flex flex-col items-center justify-center shadow-lg">
                <span className="text-[12px] text-gray-500 font-bold uppercase mb-1">走行距離</span>
                <span className="text-lg font-black text-blue-400">{distance.toLocaleString()} <span className="text-xs text-gray-500">km</span></span>
            </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-[32px] border-2 border-blue-500 flex justify-around items-center">
        <div className="text-center">
          <span className="text-sm font-bold text-blue-400 block mb-2 uppercase tracking-widest">男性総数</span>
          <span className="text-4xl font-black text-white">{maleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
        </div>
        <div className="text-center">
          <span className="text-sm font-bold text-pink-400 block mb-2 uppercase tracking-widest">女性総数</span>
          <span className="text-4xl font-black text-white">{femaleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
        </div>
        <div className="w-px h-12 bg-gray-800"></div>
        <div className="text-center">
          <span className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest">総合計人数</span>
          <span className="text-5xl font-black text-white">{totalPassengers}<span className="text-lg text-gray-600 ml-1">名</span></span>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-[32px] border-2 border-blue-500 shadow-2xl">
        <PaymentBreakdownList 
          breakdown={breakdown} 
          counts={counts} 
          customLabels={safeCustomLabels} 
          enabledMethods={enabledMethods} 
        />
      </div>

      <div className="bg-gray-800 p-6 rounded-[32px] border-2 border-blue-500 shadow-2xl">
        <RideBreakdownList 
          breakdown={rideBreakdown} 
          counts={rideCounts} 
          enabledRideTypes={Object.keys(RIDE_LABELS) as any[]} 
        />
      </div>
    </div>
  );
};

interface DailyDetailViewProps {
  date: string;
  records: SalesRecord[];
  meta: DayMetadata;
  customLabels: Record<string, string>;
  businessStartHour: number;
  onBack: () => void;
  isMe: boolean;
  onUpdateMetadata?: (date: string, meta: Partial<DayMetadata>) => void;
  onEditRecord?: (rec: SalesRecord) => void;
}

export const DailyDetailView: React.FC<DailyDetailViewProps> = ({ 
  date, 
  records, 
  meta, 
  customLabels, 
  businessStartHour, 
  onBack, 
  isMe, 
  onUpdateMetadata, 
  onEditRecord 
}) => {
  const [isDetailed, setIsDetailed] = useState(false);
  const [isDetailReversed, setIsDetailReversed] = useState(true);
  const [isSlim, setIsSlim] = useState(false);

  const sortedRecords = useMemo(() => {
    const base = [...records];
    return isDetailReversed 
      ? base.sort((a, b) => b.timestamp - a.timestamp) 
      : base.sort((a, b) => a.timestamp - b.timestamp);
  }, [records, isDetailReversed]);

  const safeCustomLabels = customLabels || {};

const handleDownloadExcel = async () => {
    const restMinutes = meta.totalRestMinutes || 0;
    const startOdo = (meta as any).startOdo || 0;
    const endOdo = (meta as any).endOdo || 0;
    const driveDistance = (endOdo > startOdo) ? endOdo - startOdo : 0;
    
    const totalAmount = records.reduce((s, r) => s + r.amount, 0);

    const fmtTime = (ts: number) => {
      if (!ts) return "";
      const d = new Date(ts);
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (ms: number) => {
        if (ms <= 0) return "";
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    
    const dateObj = new Date(date);
    const yearStr = `${dateObj.getFullYear()}年`;
    const monthStr = `${dateObj.getMonth() + 1}月`;
    const dayStr = `${dateObj.getDate()}日`;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('日報', {
      views: [
        { state: 'frozen', ySplit: 5, activeCell: 'A6' }
      ]
    });

    // 実際の出庫・入庫時間を取得（recordsの最初と最後のtimestamp）
    const actualStartTime = records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : 0;
    const actualEndTime = records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : 0;
    
    // 営業時間を算出（出庫から入庫までの時間から休憩時間を差し引く）
    const actualWorkDurationMs = (actualStartTime && actualEndTime) ? ((actualEndTime - actualStartTime) - (restMinutes * 60 * 1000)) : 0;
    
    // 時間売上を算出（営業時間から算出）
    const actualWorkHoursDecimal = Math.max(actualWorkDurationMs / (1000 * 60 * 60), 0.1);
    const actualHourlySales = totalAmount > 0 ? Math.round(totalAmount / actualWorkHoursDecimal) : 0;
    
    sheet.addRow(["", "", "", "運　転　日　報", "", "", "", "", yearStr, monthStr, dayStr, fmtTime(Date.now())]);
    sheet.addRow([]);
    sheet.addRow(["", "", "", "出 庫", "入庫", "営業時間", "時間売上", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    sheet.addRow(["", "乗車時間", "", fmtTime(actualStartTime), fmtTime(actualEndTime), formatDuration(actualWorkDurationMs), actualHourlySales.toLocaleString()]);
    sheet.addRow(["回数", "時", "分", "乗車地", "経由", "降車地", "男", "女", "料金", "往路", "復路", "予約・備考", "カード", "チケット", "アプリ", "乗車区分", "回数", "売上B", "売上A", "人員"]);

    for (let i = 0; i < 30; i++) {
        const r = records[i];
        let rowValues: any[] = [];
        
        if (r) {
            const d = new Date(r.timestamp);
            const totalRow = r.amount + r.toll + (r.returnToll || 0);
            const pm = r.paymentMethod;
            
            let cardVal: any = "", ticketVal: any = "", appVal: any = "";
            if (pm === 'CARD') cardVal = totalRow;
            else if (pm === 'NET' || pm === 'TICKET') ticketVal = totalRow;
            else if (pm === 'TRANSPORT' || pm !== 'CASH') appVal = totalRow;

            // 備考欄から「(経由)」以降を抽出し、備考欄から削除
            let viaLocation = "";
            let remarksForOutput = r.remarks || '';
            if (r.remarks) {
                // 「(経由)」の後の文字列を抽出（スペース、改行、または末尾まで）
                // 例: "(経由)巽中２ ネット決済" → "巽中２"を抽出、"ネット決済"を残す
                // 例: "(経由)巽中２\nネット決済" → "巽中２"を抽出、"ネット決済"を残す
                const viaMatch = r.remarks.match(/\(経由\)([^\s\n\r]+)/);
                if (viaMatch) {
                    viaLocation = viaMatch[1].trim();
                    // 備考欄から「(経由)」部分を削除（「(経由)」からスペースまたは改行まで）
                    // 正規表現で確実に削除するため、グローバルフラグは不要（最初のマッチのみ削除）
                    remarksForOutput = r.remarks.replace(/\(経由\)[^\s\n\r]+[\s\n\r]*/, '').trim();
                }
            }

            rowValues = [
                i + 1, 
                d.getHours(), 
                d.getMinutes(), 
                r.pickupLocation || '', 
                viaLocation, 
                r.dropoffLocation || '',
                r.passengersMale || '', 
                (r.passengersFemale || r.passagersFemale || 0), 
                r.amount,
                r.toll > 0 ? r.toll : "", 
                (r.returnToll || 0) > 0 ? (r.returnToll || 0) : "",
                remarksForOutput || '', // 備考欄（予約・備考）
                cardVal, 
                ticketVal, 
                appVal, 
                RIDE_LABELS[r.rideType] || "",
                i + 1, "", "", ""
            ];
        } else {
            rowValues = [i + 1, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", i + 1, "", "", ""];
        }
        sheet.addRow(rowValues);
    }

    sheet.addRow(["合 計", "", "", "", "", "", 0, 0, 0, 0, 0, "", 0, 0, 0, "", "合計", "", "", ""]);
    sheet.addRow(["", "", "", "メーター指数", "出 庫", startOdo || "", "入 庫", "", endOdo || "", "差 引", driveDistance || "", "", "売上", 0, "乗車券", 0, "", "現金", 0, ""]);
    sheet.addRow(["", "", "", "日別売上計", "走行距離", "実車㎞", "回数", "人員", "売上高", "", "", "", "B 走行km", "", "実車km", "", "", "", "", ""]);
    sheet.addRow(["", "", "", "", driveDistance || "0", "0", records.length, 0, 0, "", "", "", "A 走行km", "", "実車km", "", "", "", "", ""]);

    for (let r = 6; r <= 35; r++) {
        sheet.getCell(`T${r}`).value = { formula: `SUM(G${r}:H${r})` };
    }

    sheet.getCell('G36').value = { formula: 'SUM(G6:G35)' };
    sheet.getCell('H36').value = { formula: 'SUM(H6:H35)' };
    sheet.getCell('I36').value = { formula: 'SUM(I6:I35)' };
    sheet.getCell('J36').value = { formula: 'SUM(J6:J35)' };
    sheet.getCell('K36').value = { formula: 'SUM(K6:K35)' };
    sheet.getCell('M36').value = { formula: 'SUM(M6:M35)' };
    sheet.getCell('N36').value = { formula: 'SUM(N6:N35)' };
    sheet.getCell('O36').value = { formula: 'SUM(O6:O35)' };
    sheet.getCell('T36').value = { formula: 'SUM(T6:T35)' };

    sheet.getCell('N37').value = { formula: 'SUM(I6:I35)' };
    sheet.getCell('P37').value = { formula: 'M36+N36+O36' };
    sheet.getCell('S37').value = { formula: '(I36+J36+K36)-(M36+N36+O36)' };

    sheet.getCell('Q38').value = { formula: 'P38/N38' };
    sheet.getCell('Q38').numFmt = '0%';

    sheet.getCell('H39').value = { formula: 'G36+H36' };
    sheet.getCell('I39').value = { formula: 'SUM(I6:I35)' };

    sheet.getCell('Q39').value = { formula: 'P39/N39' };
    sheet.getCell('Q39').numFmt = '0%';

    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const doubleBorderStyle: Partial<ExcelJS.Borders> = {
        bottom: { style: 'double' }
    };
    
    const fontMeiryo = { name: 'Meiryo', size: 10 };
    const fontMeiryoBold = { name: 'Meiryo', size: 10, bold: true };
    const fontDate = { name: 'Meiryo', size: 11, bold: true };
    const fontTitle = { name: 'Meiryo', size: 16, bold: true }; 

    const fillHeader: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
    const fillFooter: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } };
    const fillTotal: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC99' } };
    const fillGrayLight: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
    const fillHighlight: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC' } };

    sheet.mergeCells('D1:F1');
    sheet.mergeCells('G3:H3'); 
    sheet.mergeCells('B4:C4'); 
    sheet.mergeCells('G4:H4'); 
    sheet.mergeCells('A36:C36'); 
    sheet.mergeCells('G37:H37'); 

    sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            cell.font = fontMeiryo;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (rowNumber === 1) {
                if (colNumber >= 9 && colNumber <= 12) {
                    cell.font = fontDate;
                }
                if (colNumber >= 4 && colNumber <= 12) {
                     cell.border = doubleBorderStyle;
                }
            }
            else if (rowNumber === 2) {
            }
            else if (rowNumber === 3) {
                if (colNumber >= 10 && colNumber <= 20) { }
                else if (colNumber === 9 || colNumber <= 3) { }
                else if ([4, 5, 6, 7].includes(colNumber)) {
                    cell.fill = fillHeader;
                    cell.border = borderStyle;
                } else {
                    cell.border = borderStyle;
                }
            }
            else if (rowNumber === 4) {
                 if (colNumber >= 10) { }
                 else if (colNumber === 9 || colNumber <= 1) { }
                 else if (colNumber === 2) {
                     cell.fill = fillHeader;
                     cell.border = borderStyle;
                 } else {
                     cell.border = borderStyle;
                 }
            }
            else if (rowNumber === 5) {
                cell.fill = fillHeader;
                cell.font = fontMeiryoBold;
                cell.border = borderStyle;
            }
            else if (rowNumber >= 6 && rowNumber <= 35) {
                cell.border = borderStyle;
                
                if (colNumber === 1 || colNumber === 17) {
                    cell.fill = fillGrayLight;
                }
                
                if (colNumber === 16) {
                    const val = cell.value?.toString() || '';
                    if (val !== '流し' && val !== '') {
                        cell.fill = fillHighlight;
                    }
                }

                if ([4, 5, 6, 12].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
                else if ([9, 10, 11, 13, 14, 15].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '#,##0';
                }
            }
            else if (rowNumber === 36) {
                cell.fill = fillTotal;
                cell.font = fontMeiryoBold;
                cell.border = borderStyle;
                if ([7,8,9,10,11, 13,14,15].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '#,##0';
                }
            }
            else if (rowNumber >= 37) {
                 if (colNumber <= 3) { }
                 else {
                     cell.border = borderStyle;
                     const isValue = ((rowNumber === 37 && [14,16,19].includes(colNumber)) || (rowNumber === 39 && [8,9].includes(colNumber)));
                     const isOdoValue = (rowNumber === 37 && [6,9,11].includes(colNumber)) || (rowNumber === 39 && colNumber === 5);

                     if (isValue || isOdoValue) {
                         cell.alignment = { vertical: 'middle', horizontal: 'right' };
                         cell.numFmt = '#,##0';
                     } else {
                         const isLabel = ((rowNumber === 37 && [4,5,7,10,13,15,18].includes(colNumber)) || (rowNumber === 38 && [4,5,6,7,8,9,13,15].includes(colNumber)) || (rowNumber === 39 && [13,15].includes(colNumber)));
                         if (isLabel) cell.fill = fillFooter;
                     }
                 }
            }
        });
    });

    const titleCell = sheet.getCell('D1');
    titleCell.font = fontTitle; 
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.border = { bottom: { style: 'double' } }; 

    sheet.getRow(1).height = 45;
    sheet.getRow(36).height = 30;
    
    const colWidths = [
        { c: 1, w: 4.38 },
        { c: 2, w: 3 },
        { c: 3, w: 3 },
        { c: 4, w: 10.75 },
        { c: 5, w: 10.75 },
        { c: 6, w: 10.75 },
        { c: 7, w: 4.13 },
        { c: 8, w: 4.13 },
        { c: 9, w: 7.5 },
        { c: 10, w: 6.25 },
        { c: 11, w: 6.25 },
        { c: 12, w: 10.75 },
        { c: 13, w: 8.13 },
        { c: 14, w: 8.13 },
        { c: 15, w: 8.13 },
        { c: 16, w: 8.13 },
        { c: 17, w: 4.38 },
        { c: 18, w: 7.5 },
        { c: 19, w: 7.5 },
        { c: 20, w: 6 }
    ];

    colWidths.forEach(cw => {
        sheet.getColumn(cw.c).width = cw.w;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `日報_${date.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="p-4 pb-28 space-y-5 animate-in slide-in-from-right duration-300 w-full overflow-hidden bg-[#0A0E14] min-h-screen">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack} 
          className="p-2.5 bg-gray-800 rounded-full active:scale-90 shadow-lg border border-gray-700 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[clamp(1.6rem,7vw,2.2rem)] font-black text-white truncate">{date}</h2>
        
        <button 
          onClick={handleDownloadExcel}
          className="ml-auto flex items-center gap-2 bg-blue-900/30 text-blue-400 px-3 py-2 rounded-xl font-bold border border-blue-500/30 active:scale-95 transition-all"
        >
          <FileDown className="w-4 h-4" />
          <span className="text-xs">EXCEL</span>
        </button>
      </div>
      
      <ReportSummaryView 
        records={sortedRecords} 
        customLabels={safeCustomLabels} 
        totalRestMinutes={meta.totalRestMinutes} 
        enabledMethods={Object.keys(PAYMENT_LABELS) as PaymentMethod[]} 
        startOdo={(meta as any).startOdo}
        endOdo={(meta as any).endOdo}
      />

      {isMe && onUpdateMetadata && (
        <div className="bg-gray-800 p-6 rounded-[32px] border-2 border-blue-500 shadow-2xl space-y-4 animate-in fade-in duration-500">
          <div className="flex items-center gap-2 px-1">
            <Gauge className="w-5 h-5 text-amber-500" />
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">メーター訂正</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1 block">出庫時 ODO (km)</label>
              <input 
                type="number" 
                inputMode="numeric"
                value={(meta as any).startOdo || ''} 
                onChange={(e) => onUpdateMetadata(date, { startOdo: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="---"
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl p-3 text-white text-xl font-black outline-none focus:border-amber-500 transition-all shadow-inner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1 block">入庫時 ODO (km)</label>
              <input 
                type="number" 
                inputMode="numeric"
                value={(meta as any).endOdo || ''} 
                onChange={(e) => onUpdateMetadata(date, { endOdo: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="---"
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl p-3 text-white text-xl font-black outline-none focus:border-amber-500 transition-all shadow-inner"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-600 font-bold px-1 italic">※数値を変更すると、上の走行距離とエクセル出力に即座に反映されます。</p>
        </div>
      )}
      
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1 flex-wrap gap-4">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-4 h-4" /> 履歴
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsSlim(!isSlim)} 
              className={`text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border transition-all whitespace-nowrap ${isSlim ? 'bg-amber-500 text-black border-amber-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
            >
              スリム
            </button>
            <button 
              onClick={() => setIsDetailed(!isDetailed)} 
              className={`text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border transition-all whitespace-nowrap ${isDetailed ? 'bg-amber-500 text-black border-amber-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
            >
              詳細
            </button>
            <button 
              onClick={() => setIsDetailReversed(!isDetailReversed)} 
              className="text-[12px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black active:scale-95 shadow-sm border border-gray-700 whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {isSlim ? (
          <div className="bg-gray-800 rounded-lg border-2 border-blue-500 overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-orange-500 text-white">
                  <th className="py-2 px-2 border-r border-orange-600 text-center text-base font-black w-[60px]">回数</th>
                  <th className="py-2 px-2 border-r border-orange-600 text-center text-base font-black w-[95px]">時刻</th>
                  <th className="py-2 px-2 border-r border-orange-600 text-center text-base font-black flex-1">乗車地/降車地</th>
                  <th className="py-2 px-2 text-center text-base font-black w-[75px]">売上</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 font-black uppercase tracking-widest text-sm">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  sortedRecords.slice(0, 200).map((r, i) => (
                    <SalesRecordCard 
                      key={r.id}
                      record={r} 
                      index={isDetailReversed ? sortedRecords.length - i : i + 1} 
                      isDetailed={isDetailed} 
                      isSlim={isSlim}
                      customLabels={safeCustomLabels} 
                      businessStartHour={businessStartHour} 
                      onClick={() => {
                        if (isMe && onEditRecord) {
                          onEditRecord(r);
                        }
                      }} 
                    />
                  ))
                )}
              </tbody>
            </table>
            {sortedRecords.length > 200 && (
              <p className="text-center text-gray-400 text-[10px] py-2 italic bg-gray-900">
                ※表示負荷軽減のため最新200件のみ表示しています
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRecords.length === 0 ? (
              <div className="text-center py-10 text-gray-600 font-bold">データがありません</div>
            ) : (
              sortedRecords.slice(0, 200).map((r, i) => (
                <div key={r.id} className="relative">
                  {r.amount === 0 && (
                    <div className="absolute -top-2 -right-1 z-10">
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg border border-red-400 animate-pulse">
                        一時保存中
                      </span>
                    </div>
                  )}
                  <div className={r.amount === 0 ? "ring-2 ring-red-500 ring-offset-2 ring-offset-[#0A0E14] rounded-[24px]" : ""}>
                    <SalesRecordCard 
                      record={r} 
                      index={isDetailReversed ? sortedRecords.length - i : i + 1} 
                      isDetailed={isDetailed} 
                      isSlim={isSlim}
                      customLabels={safeCustomLabels} 
                      businessStartHour={businessStartHour} 
                      onClick={() => {
                        if (isMe && onEditRecord) {
                          onEditRecord(r);
                        }
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
            {sortedRecords.length > 200 && (
              <p className="text-center text-gray-600 text-[10px] py-2 italic">
                ※表示負荷軽減のため最新200件のみ表示しています
              </p>
            )}
          </div>
        )}
      </section>

      {isMe && onUpdateMetadata && (
        <section className="space-y-5 pt-5 border-t border-gray-800">
          <div className="bg-gray-800 p-4 rounded-[28px] border-2 border-blue-500 space-y-4 shadow-2xl">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4" /> 属性
            </h3>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-widest">帰属月</label>
              <select 
                value={meta.attributedMonth || date.split('/').slice(0, 2).join('-')} 
                onChange={(e) => onUpdateMetadata(date, { attributedMonth: e.target.value })} 
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-3 text-white text-base font-black outline-none focus:border-amber-500 appearance-none"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 6 + i);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  // ★修正: インデックスを含めてユニークなキーを生成（年月だけでは重複する可能性があるため）
                  return <option key={`${val}-${i}`} value={val}>{d.getFullYear()}年 {d.getMonth()+1}月分</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 flex items-center gap-2 uppercase tracking-widest">
                <MessageSquare className="w-4 h-4" /> メモ
              </label>
              <textarea 
                value={meta.memo} 
                onChange={(e) => onUpdateMetadata(date, { memo: e.target.value })} 
                placeholder="記録..." 
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-3 text-white text-base min-h-[100px] outline-none focus:border-amber-500 shadow-inner" 
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
