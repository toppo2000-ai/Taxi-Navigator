// 支払い方法の型定義
export type PaymentMethod = 'CASH' | 'CARD' | 'NET' | 'E_MONEY' | 'TRANSPORT' | 'DIDI' | 'QR' | 'TICKET';

// 乗車タイプの型定義
export type RideType = 'FLOW' | 'WAIT' | 'APP' | 'HIRE' | 'RESERVE' | 'WIRELESS' | 'DISPATCH';

// データの公開範囲を定義するモード (PUBLIC: 全員公開 / PRIVATE: 非公開 / CUSTOM: 指定ユーザーのみ公開)
export type VisibilityMode = 'PUBLIC' | 'PRIVATE' | 'CUSTOM';

// 売上記録のインターフェース
export interface SalesRecord {
  id: string; // 記録の一意識別子
  amount: number; // 売上金額
  toll: number; // 高速道路料金
  paymentMethod: PaymentMethod; // 支払い方法
  nonCashAmount: number; // 非現金決済額
  rideType: RideType; // 乗車タイプ
  timestamp: number; // 記録のタイムスタンプ
  pickupLocation?: string; // 乗車地
  dropoffLocation?: string; // 降車地
  pickupCoords?: string; // 乗車地の座標
  dropoffCoords?: string; // 降車地の座標
  passengersMale?: number; // 男性乗客数
  passengersFemale?: number; // 女性乗客数
  remarks?: string; // 備考
  isBadCustomer?: boolean; // 難しい顧客フラグ
}

// シフト情報のインターフェース
export interface Shift {
  id: string; // シフトの一意識別子
  startTime: number; // シフト開始時刻
  dailyGoal: number; // 本日の売上目標
  plannedHours: number; // 予定勤務時間
  records: SalesRecord[]; // 当シフトの売上記録
  totalRestMinutes?: number; // 休憩時間の合計（分）
}

// 日付ごとのメタデータ
export interface DayMetadata {
  memo?: string; // メモ
  attributedMonth?: string; // 計上月
  totalRestMinutes?: number; // 休憩時間の合計
}

// 休憩状態
export interface BreakState {
  isActive: boolean; // 休憩中かどうか
  startTime: number | null; // 休憩開始時刻
}

// 月間統計情報
export interface MonthlyStats {
  monthLabel: string; // 月のラベル
  totalSales: number; // 合計売上
  totalRides: number; // 乗車数
  monthlyGoal: number; // 月間売上目標
  defaultDailyGoal: number; // デフォルトの日間目標
  shimebiDay: number; // 締め日
  businessStartHour: number; // 営業開始時刻
  dutyDays: string[]; // 出勤日リスト
  enabledPaymentMethods: PaymentMethod[]; // 有効な支払い方法
  customPaymentLabels: Record<string, string>; // 支払い方法のカスタムラベル
  userName: string; // ユーザー名
  enabledRideTypes: RideType[]; // 有効な乗車タイプ
  visibilityMode: VisibilityMode; // データ公開モード
  allowedViewers: string[]; // 許可されたユーザーのUIDリスト
  followingUsers: string[]; // フォロー中のユーザーUIDリスト
  uid?: string; // ユーザーUID
}

// デフォルトの支払い方法の順序
export const DEFAULT_PAYMENT_ORDER: PaymentMethod[] = [
  'CASH', 'CARD', 'TICKET', 'QR', 'DIDI', 'NET', 'E_MONEY', 'TRANSPORT'
] as PaymentMethod[];

// 全乗車タイプのリスト
export const ALL_RIDE_TYPES: RideType[] = [
  'FLOW', 'WAIT', 'APP', 'HIRE', 'RESERVE', 'WIRELESS'
];