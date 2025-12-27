import { PaymentMethod, RideType, SalesRecord } from '@/types';

// 支払い方法のラベル
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

// 乗車タイプのラベル
export const RIDE_LABELS: Record<RideType, string> = {
  FLOW: '流し',
  WAIT: '待機',
  APP: 'アプリ',
  HIRE: 'ハイヤー',
  RESERVE: '予約',
  WIRELESS: '無線'
};

// 金額を日本円表記でフォーマット (例: ¥1,200)
export const formatCurrency = (amt: number) => `¥${Math.round(amt).toLocaleString()}`;

// 数字をカンマ区切り文字列にフォーマット (主に入力フィールド用)
export const toCommaSeparated = (val: string | number) => {
  const num = val.toString().replace(/[^0-9]/g, '');
  if (num === '') return '';
  return parseInt(num).toLocaleString();
};

// カンマ区切り文字列を数字に変換
export const fromCommaSeparated = (val: string) => {
  if (typeof val !== 'string') return val;
  return parseInt(val.replace(/,/g, '')) || 0;
};

// 税抜き合計金額を計算 (消費税10%と仮定、10円単位に四捨五入)
export const calculateNetTotal = (total: number) => {
  const net = total / 1.1;
  return Math.round(net / 10) * 10;
};

// 税額を計算
export const calculateTaxAmount = (total: number) => {
  return total - calculateNetTotal(total);
};

export * from './date';

// 支払い方法別の件数をカウント
export const getPaymentCounts = (records: SalesRecord[]) => {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    counts[r.paymentMethod] = (counts[r.paymentMethod] || 0) + 1;
  });
  return counts;
};

// 売上記録を支払い方法別に集計 (分割払いの非現金決済額を考慮)
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

// 漢数字をアラビア数字に変換
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

// 数字を全角に変換
export const toFullWidth = (str: string) => {
  return str.replace(/[0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
};

// OpenStreetMap/Nominatim から取得したアドレスオブジェクトを日本語アドレス文字列にフォーマット
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

// 支払い方法に対応するCSSカラークラスを返す
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

// 売上記録をCSV文字列として生成
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

// GoogleマップのURLを生成 (公式API形式)
export const getGoogleMapsUrl = (coords?: string) => {
  if (!coords) return null;
  
  // 座標から不要なスペース等を除去してURLエンコード
  const cleanCoords = coords.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanCoords)}`;
};

// 締め日に基づいて初期の出番日を生成
export const generateDefaultDutyDays = (
  shimebiDay: number = 20, 
  startHour: number = 9
) => {
  const now = new Date();
  const { start, end } = getBillingPeriod(now, shimebiDay, startHour);
  const candidates: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 3) {
      candidates.push(formatDate(new Date(current)));
    }
    current.setDate(current.getDate() + 1);
  }
  
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  return candidates.slice(0, 20).sort();
};

export * from './calculator';
