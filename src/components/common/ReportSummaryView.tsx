// 日報サマリービューコンポーネント
// シフト終了時に表示する売上・集計情報のサマリーをレンダリングします。
import React from 'react';
import { 
  Wallet, 
  Car, 
  Timer, 
  Coffee 
} from 'lucide-react';
import { SalesRecord, PaymentMethod } from '@/types';
import { 
  formatCurrency, 
  calculateTaxAmount, 
  getPaymentBreakdown,
  getPaymentCounts
} from '@/utils';

interface ReportSummaryViewProps {
  // 売上レコード一覧
  records: SalesRecord[];
  // カスタムラベル（未使用の可能性ありだが将来用に保持）
  customLabels: Record<string, string>;
  // 任意の表示開始時刻（タイムスタンプ）
  startTime?: number;
  // 任意の表示終了時刻（タイムスタンプ）
  endTime?: number;
  // 合計休憩分（分単位）
  totalRestMinutes?: number;
  // 有効な支払方法フィルタ（将来の拡張用）
  enabledMethods?: PaymentMethod[];
}

export const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({ 
  records, 
  customLabels, 
  startTime, 
  endTime, 
  totalRestMinutes, 
  enabledMethods 
}) => {
  // 全取引合計（税抜き/税込み混在→ユースケースにより扱いが変わるがここではamountをそのまま合算）
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);

  // 消費税計算（ユーティリティ関数を利用）
  const taxAmount = calculateTaxAmount(totalAmount);

  // 支払方法別の内訳（例: CASH, CARD など）
  const breakdown = getPaymentBreakdown(records);
  // 支払方法ごとの件数（未使用だが集計情報として取得）
  const counts = getPaymentCounts(records);
  // 現金納金額（存在しない場合は 0）
  const cashAmount = breakdown['CASH'] || 0;
  
  // 表示用の開始/終了時刻を決定（props が無ければレコードの最小/最大を利用）
  const displayStart = startTime || (records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : 0);
  const displayEnd = endTime || (records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : 0);

  // 稼働時間（ミリ秒差 → 時・分に変換）
  const workDurationMs = (displayEnd - displayStart);
  const durationHrs = Math.floor(workDurationMs / 3600000);
  const durationMins = Math.floor((workDurationMs % 3600000) / 60000);
  // start/end が無効な場合はプレースホルダを表示
  const durationStr = displayStart && displayEnd ? `${durationHrs}時間${String(durationMins).padStart(2, '0')}分` : '--時間--分';

  // 休憩時間（分 → 時間と分）
  const breakH = Math.floor((totalRestMinutes || 0) / 60);
  const breakM = (totalRestMinutes || 0) % 60;
  const breakStr = `${breakH}時間${String(breakM).padStart(2, '0')}分`;

  // 性別集計（レコードに passengersMale / passengersFemale がある前提）
  const maleTotal = records.reduce((s, r) => s + (r.passengersMale || 0), 0);
  const femaleTotal = records.reduce((s, r) => s + (r.passengersFemale || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* 大見出しブロック：本日の総営収（税込）と税額、税抜金額 */}
      <div className="text-center py-8 bg-[#1A222C] rounded-[32px] border border-gray-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
          <p className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] mb-2 opacity-80">本日の営収 (税込)</p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-6xl font-black text-amber-600/80">¥</span>
            <span className="text-[clamp(4rem,16vw,6.4rem)] font-black text-amber-500 leading-none tracking-tighter drop-shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
              {totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 mb-8">
             {/* 内訳：消費税と税抜き金額 */}
             <p className="text-xl font-bold text-gray-400">(内消費税 {formatCurrency(taxAmount)})</p>
             <p className="text-xl font-bold text-gray-400">本日の営収(税抜き) {formatCurrency(totalAmount - taxAmount)}</p>
          </div>

          {/* 納金情報（現金） */}
          <div className="bg-gray-950/50 mx-6 p-5 rounded-3xl border border-gray-700/50 flex flex-col items-center gap-2 shadow-inner">
              <span className="text-sm text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <Wallet className="w-5 h-5" /> 納金額 (現金)
              </span>
              <span className="text-5xl font-black text-white tracking-tight">{formatCurrency(cashAmount)}</span>
          </div>
      </div>

      {/* 小ブロック群：総回数、稼働時間、休憩 */}
      <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Car className="w-6 h-6 text-blue-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">総回数</span>
             <span className="text-2xl font-black text-white leading-none">{records.length}<span className="text-xs text-gray-600 ml-1">回</span></span>
          </div>
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Timer className="w-6 h-6 text-green-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">稼働時間</span>
             <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{durationStr}</span>
          </div>
          <div className="bg-gray-900/50 p-2 rounded-3xl border border-gray-800 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
             <Coffee className="w-6 h-6 text-amber-400 mb-1" />
             <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1">休憩</span>
             <span className="text-[clamp(0.8rem,3.2vw,1.2rem)] font-black text-white leading-none whitespace-nowrap">{breakStr}</span>
          </div>
      </div>

      {/* 性別集計ブロック */}
      <div className="bg-gray-900/30 p-6 rounded-[32px] border border-gray-800/50 flex justify-around items-center">
          <div className="text-center">
             <span className="text-sm font-bold text-blue-400 block mb-2 uppercase tracking-widest">男性総数</span>
             <span className="text-4xl font-black text-white">{maleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
          </div>
          <div className="text-center">
             <span className="text-sm font-bold text-pink-400 block mb-2 uppercase tracking-widest">女性総数</span>
             <span className="text-4xl font-black text-white">{femaleTotal}<span className="text-lg text-gray-600 ml-1">名</span></span>
          </div>
      </div>
    </div>
  );
};
