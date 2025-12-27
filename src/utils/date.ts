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
