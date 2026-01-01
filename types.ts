// types.ts

export type PaymentMethod = 'CASH' | 'CARD' | 'NET' | 'E_MONEY' | 'TRANSPORT' | 'DIDI' | 'QR' | 'TICKET';
export type RideType = 'FLOW' | 'WAIT' | 'APP' | 'HIRE' | 'RESERVE' | 'WIRELESS';

export type VisibilityMode = 'PUBLIC' | 'PRIVATE' | 'CUSTOM';
export type InputMode = 'DETAILED' | 'SIMPLE';

export interface SalesRecord {
  id: string;
  amount: number;
  toll: number;
  returnToll?: number;
  paymentMethod: PaymentMethod;
  nonCashAmount: number;
  rideType: RideType;
  timestamp: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCoords?: string;
  dropoffCoords?: string;
  passengersMale?: number;
  passagersFemale?: number;
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
  startOdo?: number;
}

export interface DayMetadata {
  memo?: string;
  attributedMonth?: string;
  totalRestMinutes?: number;
  startOdo?: number | null;
  endOdo?: number | null;
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
  
  visibilityMode: VisibilityMode; 
  allowedViewers: string[];
  followingUsers: string[];
  
  // 簡易モード用フィールド
  inputMode?: InputMode;
  plannedWorkDays?: number; // 出勤日数
  dailyGoalSimple?: number; // 一日の目標売上（簡易モード用）
  workingHours?: number; // 稼働時間
  
  uid?: string;
}

export const DEFAULT_PAYMENT_ORDER: PaymentMethod[] = [
  'CASH', 'CARD', 'TICKET', 'QR', 'DIDI', 'NET', 'E_MONEY', 'TRANSPORT'
] as PaymentMethod[];

export const ALL_RIDE_TYPES: RideType[] = [
  'FLOW', 'WAIT', 'APP', 'HIRE', 'RESERVE', 'WIRELESS'
];
