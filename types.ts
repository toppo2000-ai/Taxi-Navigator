// src/types.ts

export type PaymentMethod = 'CASH' | 'CARD' | 'NET' | 'E_MONEY' | 'TRANSPORT' | 'DIDI' | 'QR' | 'TICKET';
export type RideType = 'FLOW' | 'WAIT' | 'APP' | 'HIRE' | 'RESERVE' | 'WIRELESS';

// ★追加: 公開範囲のモード定義
// PUBLIC: 全員に公開 (デフォルト)
// PRIVATE: 自分以外には非公開 (ランキングのみ参加)
// CUSTOM: 指定したユーザーにのみ公開
export type VisibilityMode = 'PUBLIC' | 'PRIVATE' | 'CUSTOM';

export interface SalesRecord {
  id: string;
  amount: number;
  toll: number;
  paymentMethod: PaymentMethod;
  nonCashAmount: number;
  rideType: RideType;
  timestamp: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCoords?: string;
  dropoffCoords?: string;
  passengersMale?: number;
  passengersFemale?: number;
  remarks?: string;
  isBadCustomer?: boolean;
}

export interface Shift {
  id: string;
  startTime: number;
  dailyGoal: number;
  plannedHours: number;
  records: SalesRecord[];
  totalRestMinutes?: number;
}

export interface DayMetadata {
  memo?: string;
  attributedMonth?: string;
  totalRestMinutes?: number;
}

export interface BreakState {
  isActive: boolean;
  startTime: number | null;
}

export interface MonthlyStats {
  monthLabel: string;
  totalSales: number;
  totalRides: number;
  monthlyGoal: number;
  defaultDailyGoal: number;
  shimebiDay: number;
  businessStartHour: number;
  dutyDays: string[];
  enabledPaymentMethods: PaymentMethod[];
  customPaymentLabels: Record<string, string>;
  userName: string;
  enabledRideTypes: RideType[];
  
  // ★変更: 詳細な公開設定
  visibilityMode: VisibilityMode; 
  allowedViewers: string[];       // 許可されたユーザーのUIDリスト
  followingUsers: string[];       // ★追加: 表示する（フォローする）ユーザーのUIDリスト
  
  uid?: string;
}

export const DEFAULT_PAYMENT_ORDER: PaymentMethod[] = [
  'CASH', 'CARD', 'TICKET', 'QR', 'didi', 'NET', 'E_MONEY', 'TRANSPORT'
] as PaymentMethod[];

export const ALL_RIDE_TYPES: RideType[] = [
  'FLOW', 'WAIT', 'APP', 'HIRE', 'RESERVE', 'WIRELESS'
];