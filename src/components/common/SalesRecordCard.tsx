// 売上記録カードコンポーネント
// 1件の売上記録（配車、ピックアップ、ドロップオフ、金額など）を見やすくカード形式で表示します。
// 詳細モード時は備考欄も表示し、クリックで展開・編集可能にします。
import React from 'react';
import { 
  Skull, 
  MessageSquare, 
  MapPin, 
  MapPinned 
} from 'lucide-react';
import { SalesRecord } from '@/types';
import { 
  formatBusinessTime, 
  formatCurrency, 
  PAYMENT_LABELS, 
  RIDE_LABELS, 
  getPaymentColorClass, 
  getGoogleMapsUrl 
} from '@/utils';

interface SalesRecordCardProps {
  // 売上記録データ本体
  record: SalesRecord;
  // リスト内での表示番号（1から開始）
  index: number;
  // 詳細表示フラグ（true時は備考も表示）
  isDetailed: boolean;
  // カスタム支払方法ラベル（指定されない場合は PAYMENT_LABELS をフォールバック）
  customLabels: Record<string, string>;
  // 営業開始時刻（時）- 業務時間フォーマット計算に使用
  businessStartHour: number;
  // カードクリック時のコールバック（編集画面への遷移など）
  onClick: () => void;
}

export const SalesRecordCard: React.FC<SalesRecordCardProps> = ({ 
  record, 
  index, 
  isDetailed, 
  customLabels, 
  businessStartHour, 
  onClick 
}) => {
  // カスタムラベル取得（undefined チェック）
  const safeCustomLabels = customLabels || {};
  // 支払方法名（カスタムラベルが優先、なければ定義済みラベルを使用）
  const paymentName = safeCustomLabels[record.paymentMethod] || PAYMENT_LABELS[record.paymentMethod];
  // 合計金額 = 売上 + 高速代
  const totalAmount = record.amount + record.toll;
  // 乗客表示フォーマット：[男性数女性数] 例 [2,1]
  const passengerStr = `[${record.passengersMale || 0}${record.passengersFemale || 0}]`;

  return (
    <div onClick={onClick} className="bg-[#1A222C] p-5 rounded-[24px] border border-gray-800 active:scale-[0.98] transition-all shadow-md flex flex-col gap-3 w-full relative overflow-hidden group cursor-pointer">
      {/* 悪質顧客フラグ表示（スカル背景） */}
      {record.isBadCustomer && (
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none text-red-500/20">
          <Skull className="w-16 h-16" />
        </div>
      )}

      {/* 上部：時刻・乗客数、右側に合計金額 */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                {/* 記録番号（1から開始） */}
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-base font-black text-amber-500 border border-gray-700 shadow-inner">
                    {index}
                </div>
                {/* 営業開始時刻からの経過時間フォーマット */}
                <span className="text-xl font-black text-gray-300 font-mono tracking-wide">
                    {formatBusinessTime(record.timestamp, businessStartHour)}
                </span>
            </div>
            {/* 乗客数（男/女） */}
            <div className="ml-11">
                <span className="text-slate-400 text-lg font-black tracking-widest font-mono">
                    {passengerStr}
                </span>
            </div>
        </div>

        {/* 金額表示エリア */}
        <div className="text-right">
          <span className="text-[clamp(2.2rem,10vw,2.8rem)] font-black text-amber-500 leading-none block drop-shadow-md tracking-tighter">
            {formatCurrency(totalAmount)}
          </span>
          {/* 高速代がある場合は小ラベルで表示 */}
          {record.toll > 0 && (
            <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/30 inline-block mt-1">
              (高速 {record.toll})
            </span>
          )}
        </div>
      </div>

      {/* 中央：ピックアップ・ドロップオフ位置情報 */}
      <div className="flex flex-col gap-2 my-1 pl-1 border-l-2 border-gray-700 ml-2 py-1">
        {/* ピックアップ地点（緑ドット） */}
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">{record.pickupLocation || '---'}</span>
            {/* ピックアップ位置座標がある場合は Google Maps リンク */}
            {record.pickupCoords && (
              <a 
                href={getGoogleMapsUrl(record.pickupCoords) || "#"} 
                target="_blank" 
                rel="noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 active:scale-90 ml-2"
              >
                <MapPin size={14} />
              </a>
            )}
          </div>
        </div>

        {/* ドロップオフ地点（赤ドット） */}
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">{record.dropoffLocation || '---'}</span>
            {/* ドロップオフ位置座標がある場合は Google Maps リンク */}
            {record.dropoffCoords && (
              <a 
                href={getGoogleMapsUrl(record.dropoffCoords) || "#"} 
                target="_blank" 
                rel="noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 active:scale-90 ml-2"
              >
                <MapPinned size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 下部：支払方法・配車種別ラベル */}
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {/* 支払方法（色分けあり） */}
        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border flex-1 text-center whitespace-nowrap ${getPaymentColorClass(record.paymentMethod)}`}>
          {paymentName}
        </span>
        {/* 配車タイプ（FLOW 以外の場合のみ表示）*/}
        {record.rideType !== 'FLOW' && (
           <span className="text-xs font-black text-gray-300 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 whitespace-nowrap">
             {RIDE_LABELS[record.rideType]}
           </span>
        )}
      </div>

      {/* 詳細モード：備考欄を表示 */}
      {isDetailed && record.remarks && (
        <div className="mt-2 pt-3 border-t border-gray-800/50 animate-in slide-in-from-top-2 duration-200">
           <div className="bg-yellow-900/20 p-4 rounded-xl border border-yellow-700/30 flex items-start gap-3">
             <MessageSquare className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
             <p className="text-base font-bold text-yellow-100 whitespace-pre-wrap leading-relaxed">{record.remarks}</p>
           </div>
        </div>
      )}
    </div>
  );
};
