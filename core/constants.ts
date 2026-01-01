/**
 * アプリケーション定数
 */

// 管理者メールアドレスリスト
export const ADMIN_EMAILS = [
  "toppo2000@gmail.com",
  "admin-user@gmail.com"
] as const;

// デフォルト値
export const DEFAULT_VALUES = {
  MONTHLY_GOAL: 1000000,
  DAILY_GOAL: 50000,
  SHIMEBI_DAY: 20,
  BUSINESS_START_HOUR: 9,
  PLANNED_HOURS: 12,
} as const;
