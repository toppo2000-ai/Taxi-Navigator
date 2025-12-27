import { PaymentMethod, RideType, SalesRecord } from './types.ts';

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

/**
 * Formats a number as JPY currency string (e.g., ¥1,200).
 */
export const formatCurrency = (amt: number) => `¥${Math.round(amt).toLocaleString()}`;

/**
 * Formats a number or string into a comma-separated string.
 * Used primarily for input fields.
 */
export const toCommaSeparated = (val: string | number) => {
  const num = val.toString().replace(/[^0-9]/g, '');
  if (num === '') return '';
  return parseInt(num).toLocaleString();
};

/**
 * Parses a comma-separated string back into a number.
 */
export const fromCommaSeparated = (val: string) => {
  if (typeof val !== 'string') return val;
  return parseInt(val.replace(/,/g, '')) || 0;
};

// --- Business Logic ---

/**
 * Calculates the net total (excluding tax) from a gross total.
 * Assumes 10% tax. Rounds to the nearest 10 yen.
 * Example: 9900 -> 9000
 */
export const calculateNetTotal = (total: number) => {
  const net = total / 1.1;
  return Math.round(net / 10) * 10;
};

/**
 * Calculates the tax amount from a gross total.
 */
export const calculateTaxAmount = (total: number) => {
  return total - calculateNetTotal(total);
};

/**
 * Determines the "Business Date" based on a timestamp and a start hour.
 * If the current time is before the start hour (e.g., 3 AM with 9 AM start),
 * it counts as the previous calendar day.
 */
export const getBusinessDate = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  // If explicitly before startHour, revert to previous day
  if (hours < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};

/**
 * Formats a timestamp into HH:MM string, supporting 30-hour system (e.g., 25:30).
 * If the timestamp belongs to the next calendar day relative to the business date,
 * hours are displayed as 24 + hour.
 */
export const formatBusinessTime = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  // If the time is early morning (before startHour), it belongs to the previous business day.
  // In the 30-hour system, we add 24 to the hour.
  // Example: startHour=9, current=01:00 -> Display 25:00
  if (hours < startHour) {
    return `${hours + 24}:${minutes}`;
  }
  
  // Standard case
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

/**
 * Standard formatTime (00:00 - 23:59) for contexts where 30h system isn't needed (like estimations).
 */
export const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Calculates the start and end dates of a billing period based on a closing day (shimebi).
 * Adjusts for business start hour to ensure shifts crossing midnight are counted correctly.
 * * shimebi === 0 implies "End of Month" closing.
 */
export const getBillingPeriod = (date: Date, shimebi: number, startHour: number = 0) => {
  // Create a working date adjusted by startHour to align with business days
  const d = new Date(date);
  d.setHours(d.getHours() - startHour);

  let start: Date, end: Date;

  if (shimebi === 0) {
    // End of Month Closing (末日)
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else {
    // Specific Day Closing (e.g., 20th)
    if (d.getDate() > shimebi) {
      start = new Date(d.getFullYear(), d.getMonth(), shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, shimebi);
    } else {
      start = new Date(d.getFullYear(), d.getMonth() - 1, shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth(), shimebi);
    }
  }
  
  // Set accurate start/end times based on business hour
  // Start: 営業開始日の 00:00 + startHour
  start.setHours(startHour, 0, 0, 0);
  
  // ★ 修正箇所：日付の加算 (+1) を削除しました
  // これにより formatDate(end) が正確に締め日の日付（20日など）を返します。
  // 集計ロジック（App.tsxなど）では getBusinessDate（文字列）で比較しているため、これで正しく動作します。
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

export const formatDate = (date: Date) => {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};

/**
 * Aggregates sales records by payment method.
 * Handles split payments where 'nonCashAmount' is specified.
 */
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

/**
 * Formats a raw address object (from OpenStreetMap/Nominatim) into a Japanese address string.
 */
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

/**
 * Returns the CSS color classes for a given payment method.
 */
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

/**
 * Generates a CSV string from sales records.
 */
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
      r.passengersFemale || 0,
      escape(r.remarks),
      r.isBadCustomer ? 'Yes' : ''
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\n');
};

// --- Google Map Functions ---

/**
 * ★修正：GoogleマップのURLを生成する（公式API形式）
 * 標準的な https://www.google.com/maps/search/?api=1&query=緯度,経度 を使用します。
 * これにより、どの端末でも確実にGoogleマップアプリが起動し、指定座標にピンが立ちます。
 */
export const getGoogleMapsUrl = (coords?: string) => {
  if (!coords) return null;
  
  // 座標から不要なスペース等を除去してURLエンコード
  const cleanCoords = coords.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanCoords)}`;
};