import { PaymentMethod, RideType, SalesRecord } from './types';

// --- Labels & Dictionaries ---

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: '現金',
  CARD: 'クレジット',
  NET: 'ネット決済',
  E_MONEY: '電子マネー',
  TRANSPORT: '交通系',
  DIDI: 'Didi支払い',
  QR: 'アプリ/QR',
  TICKET: 'タクチケ'
};

export const RIDE_LABELS: Record<RideType, string> = {
  FLOW: '流し',
  WAIT: '待機',
  APP: 'アプリ',
  HIRE: 'ハイヤー',
  RESERVE: '予約',
  WIRELESS: '無線'
};

// --- Formatting Functions ---

export const formatCurrency = (amt: number) => `¥${Math.round(amt).toLocaleString()}`;

export const toCommaSeparated = (val: string | number) => {
  const num = val.toString().replace(/[^0-9]/g, '');
  if (num === '') return '';
  return parseInt(num).toLocaleString();
};

export const fromCommaSeparated = (val: string) => {
  if (typeof val !== 'string') return val;
  return parseInt(val.replace(/,/g, '')) || 0;
};

// --- Business Logic ---

export const calculateNetTotal = (total: number) => {
  const net = total / 1.1;
  return Math.round(net / 10) * 10;
};

export const calculateTaxAmount = (total: number) => {
  return total - calculateNetTotal(total);
};

export const getBusinessDate = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  if (hours < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};

export const formatBusinessTime = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (hours < startHour) {
    return `${hours + 24}:${minutes}`;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

export const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getBillingPeriod = (date: Date, shimebi: number, startHour: number = 0) => {
  const d = new Date(date);
  d.setHours(d.getHours() - startHour);

  let start: Date, end: Date;

  if (shimebi === 0) {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else {
    if (d.getDate() > shimebi) {
      start = new Date(d.getFullYear(), d.getMonth(), shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, shimebi);
    } else {
      start = new Date(d.getFullYear(), d.getMonth() - 1, shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth(), shimebi);
    }
  }

  start.setHours(startHour, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const formatDate = (date: Date) => {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};

export const getPaymentBreakdown = (records: SalesRecord[]) => {
  const breakdown: Record<string, number> = {};

  records.forEach(r => {
    const total = r.amount + r.toll;
    const nonCash = r.nonCashAmount;

    let amountForMethod = 0;
    let amountForCash = 0;

    if (r.paymentMethod === 'CASH') {
      amountForCash = total;
    } else {
      amountForMethod = nonCash;
      amountForCash = total - nonCash;
    }

    if (amountForMethod > 0) {
      breakdown[r.paymentMethod] = (breakdown[r.paymentMethod] || 0) + amountForMethod;
    }

    if (amountForCash > 0) {
      breakdown['CASH'] = (breakdown['CASH'] || 0) + amountForCash;
    }
  });

  return breakdown;
};

export const getRideBreakdown = (records: SalesRecord[]) => {
  const breakdown: Record<string, number> = {};
  records.forEach(r => {
    const total = r.amount + r.toll;
    breakdown[r.rideType] = (breakdown[r.rideType] || 0) + total;
  });
  return breakdown;
};

export const getRideCounts = (records: SalesRecord[]) => {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    counts[r.rideType] = (counts[r.rideType] || 0) + 1;
  });
  return counts;
};

// 備考欄からアプリ名を抽出（GO配車、Didi配車、Uber配車、S.RIDE配車）
// 乗車区分のアプリのみを検出（配車が付いているもの）
export const extractAppTypeFromRemarks = (remarks?: string): 'GO' | 'Didi' | 'Uber' | 's.ride' | null => {
  if (!remarks) return null;
  if (remarks.includes('GO配車')) return 'GO';
  if (remarks.includes('Didi配車')) return 'Didi';
  if (remarks.includes('Uber配車')) return 'Uber';
  if (remarks.includes('S.RIDE配車') || remarks.includes('s.ride配車')) return 's.ride';
  return null;
};

// アプリ配車の集計を取得
export const getAppBreakdown = (records: SalesRecord[]) => {
  const appBreakdown: Record<string, number> = { GO: 0, Didi: 0, Uber: 0, 's.ride': 0 };
  const appCounts: Record<string, number> = { GO: 0, Didi: 0, Uber: 0, 's.ride': 0 };
  
  records.forEach(r => {
    // 乗車区分がAPPで、備考欄にアプリ名が含まれている場合のみ集計
    if (r.rideType === 'APP') {
      const appType = extractAppTypeFromRemarks(r.remarks);
      if (appType) {
        const total = r.amount + r.toll;
        appBreakdown[appType] = (appBreakdown[appType] || 0) + total;
        appCounts[appType] = (appCounts[appType] || 0) + 1;
      }
    }
  });
  
  return { breakdown: appBreakdown, counts: appCounts };
};

// 備考欄から決済アプリ名を抽出（GO決済、Didi決済、Uber決済、s.ride決済）
export const extractPaymentAppTypeFromRemarks = (remarks?: string): 'GO' | 'Didi' | 'Uber' | 's.ride' | null => {
  if (!remarks) return null;
  if (remarks.includes('GO決済')) return 'GO';
  if (remarks.includes('Didi決済')) return 'Didi';
  if (remarks.includes('Uber決済')) return 'Uber';
  if (remarks.includes('s.ride決済')) return 's.ride';
  return null;
};

// 決済アプリ別の集計を取得
export const getPaymentAppBreakdown = (records: SalesRecord[]) => {
  const appBreakdown: Record<string, number> = { GO: 0, Didi: 0, Uber: 0, 's.ride': 0 };
  const appCounts: Record<string, number> = { GO: 0, Didi: 0, Uber: 0, 's.ride': 0 };
  
  records.forEach(r => {
    // 備考欄に決済アプリ名が含まれている場合のみ集計
    const appType = extractPaymentAppTypeFromRemarks(r.remarks);
    if (appType) {
      const total = r.amount + r.toll;
      appBreakdown[appType] = (appBreakdown[appType] || 0) + total;
      appCounts[appType] = (appCounts[appType] || 0) + 1;
    }
  });
  
  return { breakdown: appBreakdown, counts: appCounts };
};

// --- String Helpers for Address Formatting ---

export const kanjiToArabic = (str: string) => {
  const kanjiMap: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '〇': '0', '十': '10'
  };
  return str.replace(/([一二三四五六七八九〇十]+)(?=丁目|$)/g, (match) => {
     let res = match;
     for (const [k, v] of Object.entries(kanjiMap)) {
       res = res.replace(new RegExp(k, 'g'), v);
     }
     return res;
  });
};

export const toFullWidth = (str: string) => {
  return str.replace(/[0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
};

export const formatJapaneseAddress = (data: any) => {
  if (!data) return '';
  const a = data.address || {};
  const city = a.city || a.town || a.village || '';
  const ward = a.city_district || '';
  const isOsakaCity = city === "大阪市";

  let town = "";
  const candidates = [a.neighbourhood, a.quarter, a.suburb, a.road];
  for (const c of candidates) {
    if (c && c !== city && c !== ward && !/区$/.test(c)) {
      town = c;
      break;
    }
  }
  if (!town) town = a.suburb || a.road || '';

  let processed = town.replace(/丁目$/, '');
  processed = kanjiToArabic(processed);
  processed = processed.replace(/[0-9]+/g, (s) => toFullWidth(s));

  if (isOsakaCity) {
    return processed.trim();
  } else {
    const prefix = city + (ward && ward !== city ? ward : "");
    return (prefix + processed).trim();
  }
};

export const getPaymentColorClass = (method: PaymentMethod) => {
  switch (method) {
    case 'CASH': return 'bg-amber-400/10 text-amber-200 border-amber-400/30';
    case 'CARD': return 'bg-blue-400/10 text-blue-200 border-blue-400/30';
    case 'NET': return 'bg-purple-400/10 text-purple-200 border-purple-400/30';
    case 'E_MONEY': return 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30';
    case 'TRANSPORT': return 'bg-cyan-400/10 text-cyan-200 border-cyan-400/30';
    case 'DIDI': return 'bg-orange-400/10 text-orange-200 border-orange-400/30';
    case 'QR': return 'bg-teal-400/10 text-teal-200 border-teal-400/30';
    case 'TICKET': return 'bg-rose-400/10 text-rose-200 border-rose-400/30';
    default: return 'bg-gray-400/10 text-gray-200 border-gray-400/30';
  }
};

export const generateCSV = (records: SalesRecord[], customLabels: Record<string, string> = {}) => {
  const header = ['日時', '乗車タイプ', '乗車地', '降車地', '運賃', '高速代', '決済方法', '非現金決済額', '男性人数', '女性人数', '備考', '要注意客'];

  const rows = records.map(r => {
    const dateStr = new Date(r.timestamp).toLocaleString('ja-JP');
    const method = customLabels[r.paymentMethod] || PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod;
    const rideType = RIDE_LABELS[r.rideType] || r.rideType;

    const escape = (str: string | undefined) => {
      if (!str) return '';
      return `"${str.replace(/"/g, '""')}"`;
    };

    return [
      escape(dateStr),
      escape(rideType),
      escape(r.pickupLocation),
      escape(r.dropoffLocation),
      r.amount,
      r.toll,
      escape(method),
      r.nonCashAmount,
      r.passengersMale || 0,
      (r.passengersFemale || r.passagersFemale || 0),
      escape(r.remarks),
      r.isBadCustomer ? 'Yes' : ''
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\n');
};

export const getGoogleMapsUrl = (coords?: string) => {
  if (!coords) return null;

  const cleanCoords = coords.trim();
  
  // ユーザーエージェントを判定（ブラウザ環境の場合）
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    // アプリスキームを使用（選択画面を出さない）
    if (isIOS) {
      // iOS: comgooglemaps://スキーム
      return `comgooglemaps://?q=${encodeURIComponent(cleanCoords)}`;
    } else if (isAndroid) {
      // Android: geo:スキーム
      return `geo:0,0?q=${encodeURIComponent(cleanCoords)}`;
    }
  }
  
  // その他（PCなど）: 通常のURL
  return `https://maps.google.com/?q=${encodeURIComponent(cleanCoords)}`;
};

/**
 * 簡易モードを優先してレコードをフィルタリング
 * 同じ日に簡易モードレコードがある場合は、詳細モードレコードを除外
 */
export const filterRecordsWithSimpleModePriority = (
  records: SalesRecord[],
  startHour: number
): SalesRecord[] => {
  // 営業日ごとにグループ化
  const recordsByDate = new Map<string, SalesRecord[]>();
  
  records.forEach(r => {
    const dateStr = getBusinessDate(r.timestamp, startHour);
    if (!recordsByDate.has(dateStr)) {
      recordsByDate.set(dateStr, []);
    }
    recordsByDate.get(dateStr)!.push(r);
  });

  // 各営業日について、簡易モードがあれば簡易モードのみ、なければ詳細モードのみ
  const filteredRecords: SalesRecord[] = [];
  
  recordsByDate.forEach((dayRecords, dateStr) => {
    const hasSimpleMode = dayRecords.some(r => r.remarks?.includes('簡易モード'));
    
    if (hasSimpleMode) {
      // 簡易モードがあれば簡易モードのみを追加
      const simpleRecords = dayRecords.filter(r => r.remarks?.includes('簡易モード'));
      filteredRecords.push(...simpleRecords);
    } else {
      // 簡易モードがなければ詳細モードのみを追加
      filteredRecords.push(...dayRecords);
    }
  });

  return filteredRecords;
};

/**
 * removeUndefinedFields
 * Firebaseはundefinedをサポートしていないため、undefinedのフィールドを削除
 */
export const removeUndefinedFields = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefinedFields(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

/**
 * 請求期間の統計情報を計算（簡易モード優先）
 */
import { MonthlyStats, Shift } from './types';

export const calculatePeriodStats = (
  monthlyStats: MonthlyStats,
  history: SalesRecord[],
  shift: Shift | null
) => {
  const startHour = monthlyStats.businessStartHour ?? 9;
  const { start, end } = getBillingPeriod(new Date(), monthlyStats.shimebiDay, startHour);
  const adjustedEnd = new Date(end);
  if (monthlyStats.shimebiDay !== 0) adjustedEnd.setDate(monthlyStats.shimebiDay);
  
  const startDateStr = formatDate(start);
  const endDateStr = formatDate(adjustedEnd);
  
  const allRecords = [...history, ...(shift?.records || [])];
  
  // 請求期間内のレコードをフィルタリング
  const periodRecords = allRecords.filter(r => {
    const rDate = getBusinessDate(r.timestamp, startHour);
    return rDate >= startDateStr && rDate <= endDateStr;
  });

  // 簡易モード優先でフィルタリング
  const validRecords = filterRecordsWithSimpleModePriority(periodRecords, startHour);

  const totalSales = validRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalRides = validRecords.length;

  return {
    totalSales,
    totalRides,
    validRecords,
    startDateStr,
    endDateStr
  };
};
