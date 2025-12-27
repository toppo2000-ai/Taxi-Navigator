// タイムスタンプから営業日を算出する (営業開始時刻前の場合は前日とカウント)
export const getBusinessDate = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  // 営業開始時刻前の場合は前日として扱う
  if (hours < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};

// タイムスタンプを30時間制対応の時刻文字列にフォーマット (HH:MM)
export const formatBusinessTime = (timestamp: number, startHour: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  // 営業開始時刻前は30時間制で表示 (例: 営業開始9時で01:00 -> 25:00)
  if (hours < startHour) {
    return `${hours + 24}:${minutes}`;
  }
  
  // 通常の時刻表示
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

// 通常の時刻フォーマット (30時間制非対応)
export const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// 締め日に基づいて請求期間を計算 (締め日0は月末締め)
export const getBillingPeriod = (date: Date, shimebi: number, startHour: number = 0) => {
  // 営業時間に基づいて日付を調整
  const d = new Date(date);
  d.setHours(d.getHours() - startHour);

  let start: Date, end: Date;

  if (shimebi === 0) {
    // 月末締め
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else {
    // 指定日締め (例: 20日)
    if (d.getDate() > shimebi) {
      start = new Date(d.getFullYear(), d.getMonth(), shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, shimebi);
    } else {
      start = new Date(d.getFullYear(), d.getMonth() - 1, shimebi + 1);
      end = new Date(d.getFullYear(), d.getMonth(), shimebi);
    }
  }
  
  // 営業開始時刻に基づいて正確な開始時刻と終了時刻を設定
  start.setHours(startHour, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

// 日付をYYYY/MM/DD形式にフォーマット
export const formatDate = (date: Date) => {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
};
