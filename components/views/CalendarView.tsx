import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SalesRecord, DayMetadata } from '../../types';
import { getBusinessDate, formatDate, RIDE_LABELS } from '../../utils';
import { auth } from '../../services/firebase';

interface CalendarViewProps {
  history: SalesRecord[];
  dayMetadata: Record<string, DayMetadata>;
  businessStartHour: number;
  shimebiDay?: number;
  monthlyStats?: { shimebiDay: number; businessStartHour: number };
}

// 日本の祝日判定（簡易版）
const isHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  // 日曜日
  if (dayOfWeek === 0) return true;

  // 固定祝日
  if (month === 1 && day === 1) return true; // 元日
  if (month === 2 && day === 11) return true; // 建国記念の日
  if (month === 4 && day === 29) return true; // 昭和の日
  if (month === 5 && day === 3) return true; // 憲法記念日
  if (month === 5 && day === 4) return true; // みどりの日
  if (month === 5 && day === 5) return true; // こどもの日
  if (month === 8 && day === 11) return true; // 山の日
  if (month === 11 && day === 3) return true; // 文化の日
  if (month === 11 && day === 23) return true; // 勤労感謝の日
  if (month === 12 && day === 23) return true; // 天皇誕生日

  // 成人の日（1月第2月曜日）
  if (month === 1 && dayOfWeek === 1) {
    const firstMonday = day <= 7 ? day : 0;
    if (firstMonday > 0 && day >= firstMonday && day < firstMonday + 7) return true;
  }

  // 海の日（7月第3月曜日）
  if (month === 7 && dayOfWeek === 1) {
    const firstMonday = day <= 7 ? day : 0;
    if (firstMonday > 0 && day >= firstMonday + 14 && day < firstMonday + 21) return true;
  }

  // 敬老の日（9月第3月曜日）
  if (month === 9 && dayOfWeek === 1) {
    const firstMonday = day <= 7 ? day : 0;
    if (firstMonday > 0 && day >= firstMonday + 14 && day < firstMonday + 21) return true;
  }

  // スポーツの日（10月第2月曜日）
  if (month === 10 && dayOfWeek === 1) {
    const firstMonday = day <= 7 ? day : 0;
    if (firstMonday > 0 && day >= firstMonday + 7 && day < firstMonday + 14) return true;
  }

  return false;
};

const getHolidayName = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  if (month === 1 && day === 1) return '元日';
  if (month === 1 && date.getDay() === 1 && day >= 8 && day <= 14) return '成人の日';
  if (month === 2 && day === 11) return '建国記念の日';
  if (month === 4 && day === 29) return '昭和の日';
  if (month === 5 && day === 3) return '憲法記念日';
  if (month === 5 && day === 4) return 'みどりの日';
  if (month === 5 && day === 5) return 'こどもの日';
  if (month === 7 && date.getDay() === 1 && day >= 15 && day <= 21) return '海の日';
  if (month === 8 && day === 11) return '山の日';
  if (month === 9 && date.getDay() === 1 && day >= 15 && day <= 21) return '敬老の日';
  if (month === 10 && date.getDay() === 1 && day >= 8 && day <= 14) return 'スポーツの日';
  if (month === 11 && day === 3) return '文化の日';
  if (month === 11 && day === 23) return '勤労感謝の日';
  if (month === 12 && day === 23) return '天皇誕生日';
  
  return '';
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  history,
  dayMetadata,
  businessStartHour,
  shimebiDay,
  monthlyStats
}) => {
  // 通常の月ベースのカレンダー（営業期間ベースではない）
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // 日付ごとの売上データを集計
  const dailySales = useMemo(() => {
    const salesMap: Record<string, { records: SalesRecord[]; total: number }> = {};
    
    (history || []).forEach(record => {
      const businessDate = getBusinessDate(record.timestamp, businessStartHour);
      if (!salesMap[businessDate]) {
        salesMap[businessDate] = { records: [], total: 0 };
      }
      salesMap[businessDate].records.push(record);
      salesMap[businessDate].total += record.amount;
    });

    return salesMap;
  }, [history, businessStartHour]);

  // カレンダーの日付配列を生成（通常の月ベース）
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 週の最初の日（日曜日）に合わせる
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];
    const current = new Date(startDate);
    
    // 6週分（42日）を生成
    for (let i = 0; i < 42; i++) {
      const dateStr = formatDate(current);
      
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        dateStr
      });
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentMonth]);

  // 月を変更（通常の月ベース）
  const changeMonth = useCallback((delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  }, []);

  // プルダウンで年月日を変更
  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
  }, [currentMonth]);

  const handleMonthChange = useCallback((month: number) => {
    setSelectedMonth(month);
    const newDate = new Date(currentMonth);
    newDate.setMonth(month - 1);
    setCurrentMonth(newDate);
  }, [currentMonth]);


  // Excelエクスポート（DailyDetailViewと同じロジック）
  const handleDownloadExcel = useCallback(async (dateStr: string, records: SalesRecord[], meta: DayMetadata) => {
    const timestamps = records.map(r => r.timestamp);
    const minTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    
    const restMinutes = meta.totalRestMinutes || 0;
    const startOdo = (meta as any).startOdo || 0;
    const endOdo = (meta as any).endOdo || 0;
    const driveDistance = (endOdo > startOdo) ? endOdo - startOdo : 0;

    const workDurationMs = (maxTime && minTime) ? ((maxTime - minTime) - (restMinutes * 60 * 1000)) : 0;
    
    const totalAmount = records.reduce((s, r) => s + r.amount, 0); 
    const workHoursDecimal = Math.max(workDurationMs / (1000 * 60 * 60), 0.1); 
    const hourlySales = totalAmount > 0 ? Math.round(totalAmount / workHoursDecimal) : 0;

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
    
    const dateObj = new Date(dateStr);
    const yearStr = `${dateObj.getFullYear()}年`;
    const monthStr = `${dateObj.getMonth() + 1}月`;
    const dayStr = `${dateObj.getDate()}日`;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('日報', {
      views: [
        { state: 'frozen', ySplit: 5, activeCell: 'A6' }
      ]
    });

    sheet.addRow(["", "", "", "運　転　日　報", "", "", "", "", yearStr, monthStr, dayStr, fmtTime(Date.now())]);
    sheet.addRow([]);
    sheet.addRow(["", "", "", "出 庫", "入庫", "営業時間", "時間売上", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    sheet.addRow(["", "乗車時間", "", fmtTime(minTime), fmtTime(maxTime), formatDuration(workDurationMs), hourlySales.toLocaleString()]);
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

        rowValues = [
          i + 1, d.getHours(), d.getMinutes(), r.pickupLocation || '', "", r.dropoffLocation || '',
          r.passengersMale || '', (r.passengersFemale || r.passagersFemale || 0), r.amount,
          r.toll > 0 ? r.toll : "", (r.returnToll || 0) > 0 ? (r.returnToll || 0) : "",
          r.remarks || '', cardVal, ticketVal, appVal, RIDE_LABELS[r.rideType] || "",
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
    saveAs(blob, `日報_${dateStr.replace(/\//g, '-')}.xlsx`);
  }, []);

  // 年・月・日の選択肢を生成
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);


  // 月間合計金額を計算
  const monthlyTotal = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return Object.entries(dailySales).reduce((sum, [dateStr, sales]) => {
      // dateStrは "YYYY/MM/DD" 形式
      const [y, m] = dateStr.split('/').map(Number);
      if (y === year && m === month + 1) {
        return sum + sales.total;
      }
      return sum;
    }, 0);
  }, [dailySales, currentMonth]);

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  
  // 月表示（通常の月ベース）
  const displayMonth = useMemo(() => {
    return `${currentMonth.getFullYear()} / ${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  }, [currentMonth]);
  
  // 月間合計を計算（通常の月ベース）
  const monthlyTotalForPeriod = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    return Object.entries(dailySales).reduce((total, [dateStr, data]) => {
      const dateObj = new Date(dateStr.replace(/\//g, '-'));
      if (dateObj.getFullYear() === year && dateObj.getMonth() === month) {
        return total + data.total;
      }
      return total;
    }, 0);
  }, [dailySales, currentMonth]);

  // 月名を取得（英語）
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[currentMonth.getMonth()];
  
  // 年号計算（令和）
  const reiwaYear = currentMonth.getFullYear() - 2018;
  const reiwaText = `令和${reiwaYear}年`;
  
  // 日付の表示（現在の日付）
  const currentDate = new Date().getDate();
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

  return (
    <div className="w-full min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー: 月間売上合計、月表示、年/月選択 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {/* 左側: 月間売上合計 */}
            <div className="text-4xl font-black text-gray-900">
              ¥{monthlyTotalForPeriod.toLocaleString()}
            </div>
            
            {/* 中央: 月表示とナビゲーション */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => changeMonth(-1)}
                className="p-2 text-gray-600 hover:text-gray-900 active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                {/* 左側: 大きな日付 */}
                <div className="text-7xl font-black text-gray-900 leading-none">
                  {isCurrentMonth ? currentDate : 1}
                </div>
                {/* 右側: 月名、年号、年を縦に配置 */}
                <div className="flex flex-col">
                  <div className="text-xl font-semibold text-gray-900">{monthName}</div>
                  <div className="text-xs text-gray-700 mt-1">
                    {reiwaText} {currentMonth.getFullYear()}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => changeMonth(1)}
                className="p-2 text-gray-600 hover:text-gray-900 active:scale-90"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            
            {/* 右側: 年と月のドロップダウン */}
            <div className="flex items-center gap-2">
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 font-semibold cursor-pointer"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <select
                value={currentMonth.getMonth() + 1}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 font-semibold cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* カレンダーグリッド */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, index) => {
              let bgColor = 'bg-gray-900';
              let textColor = 'text-white';
              if (index === 0) {
                // 日曜日: 赤背景
                bgColor = 'bg-red-700';
                textColor = 'text-white';
              } else if (index === 6) {
                // 土曜日: 青背景
                bgColor = 'bg-blue-700';
                textColor = 'text-white';
              }
              return (
                <div
                  key={day}
                  className={`p-3 text-center text-2xl font-bold ${textColor} ${bgColor}`}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 border-t border-gray-200">
            {calendarDays.map(({ date, isCurrentMonth, dateStr }, index) => {
              const dayOfWeek = date.getDay();
              const isHolidayDay = isHoliday(date);
              const holidayName = isHolidayDay ? getHolidayName(date) : '';
              const sales = dailySales[dateStr];
              const hasSales = sales && sales.total > 0;
              
              // 色の決定
              let textColor = 'text-gray-900';
              let bgColor = 'bg-white';
              if (!isCurrentMonth) {
                textColor = 'text-gray-400';
              } else if (dayOfWeek === 0 || isHolidayDay) {
                textColor = 'text-red-600';
              } else if (dayOfWeek === 6) {
                textColor = 'text-blue-600';
              }
              
              if (hasSales) {
                bgColor = 'bg-yellow-50';
              }
              
              return (
                <div
                  key={index}
                  className={`min-h-[100px] border-r border-b border-gray-200 p-2 ${bgColor} ${!isCurrentMonth ? 'opacity-50' : ''} ${
                    hasSales ? 'cursor-pointer hover:bg-amber-300 transition-colors' : ''
                  }`}
                  onClick={() => {
                    if (hasSales && sales.records.length > 0) {
                      const meta = dayMetadata[dateStr] || { memo: '', attributedMonth: '', totalRestMinutes: 0 };
                      handleDownloadExcel(dateStr, sales.records, meta);
                    }
                  }}
                >
                  <div className={`text-base font-black ${textColor}`}>
                    {date.getDate()}
                  </div>
                  {holidayName && (
                    <div className="text-xs text-red-600 font-semibold mt-1">
                      {holidayName}
                    </div>
                  )}
                  {hasSales && (
                    <div className="mt-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-lg font-black text-amber-700 leading-tight">
                          ¥{sales.total.toLocaleString()}
                        </div>
                        <div className="text-lg font-black text-gray-700 mt-1">
                          {sales.records.length}件
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <Download className="w-4 h-4 text-amber-600" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
