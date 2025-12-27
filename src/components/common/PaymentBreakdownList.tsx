// 支払い方法別内訳表示コンポーネント
// 支払い方法ごとの売上金額・回数を見やすく表示、キャッシュレス合計も計算
import React from 'react';
import { 
  Banknote, 
  CreditCard, 
  Smartphone, 
  Ticket, 
  QrCode, 
  Coins 
} from 'lucide-react';
import { PaymentMethod, DEFAULT_PAYMENT_ORDER } from '@/types';
import { formatCurrency, PAYMENT_LABELS, getPaymentColorClass } from '@/utils';

// 支払い方法に対応するアイコンコンポーネント
// method: 支払い方法タイプ（CASH/CARD/DIDI/TICKET/QR）
// className: カスタムスタイルクラス
export const PaymentIcon: React.FC<{ method: PaymentMethod, className?: string }> = ({ method, className }) => {
  switch (method) {
    case 'CASH': return <Banknote className={className} />;
    case 'CARD': return <CreditCard className={className} />;
    case 'DIDI': return <Smartphone className={className} />;
    case 'TICKET': return <Ticket className={className} />;
    case 'QR': return <QrCode className={className} />;
    default: return <CreditCard className={className} />;
  }
};

// PaymentBreakdownList コンポーネントのプロパティ
// breakdown: 支払い方法別の売上金額
// counts: 支払い方法別の乗車回数
// customLabels: カスタム支払い方法ラベル
// enabledMethods: 表示対象の支払い方法リスト
interface PaymentBreakdownListProps {
  breakdown: Record<string, number>;
  counts: Record<string, number>;
  customLabels: Record<string, string>;
  enabledMethods?: PaymentMethod[];
}

export const PaymentBreakdownList: React.FC<PaymentBreakdownListProps> = ({ 
  breakdown, 
  counts, 
  customLabels, 
  enabledMethods 
}) => {
  // 表示対象の支払い方法を決定（カスタムまたはデフォルト順）
  const methodsToList = enabledMethods || DEFAULT_PAYMENT_ORDER;
  
  // キャッシュレス決済の合計金額・回数を計算（現金以外）
  let nonCashAmountTotal = 0;
  let nonCashCountTotal = 0;
  Object.keys(breakdown).forEach(key => { if (key !== 'CASH') nonCashAmountTotal += breakdown[key]; });
  Object.keys(counts).forEach(key => { if (key !== 'CASH') nonCashCountTotal += counts[key]; });

  const safeCustomLabels = customLabels || {};

  return (
    <div className="space-y-4">
       {/* キャッシュレス決済合計（0より大きい場合のみ表示） */}
       {nonCashAmountTotal > 0 && (
         <div className="bg-gradient-to-r from-indigo-900/60 to-blue-900/60 p-4 rounded-2xl border border-indigo-500/30 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/20 rounded-full">
                 <Coins className="w-6 h-6 text-indigo-300" />
               </div>
               <div>
                 <span className="text-xs font-bold text-indigo-200 block uppercase tracking-widest">キャッシュレス計</span>
                 <span className="text-sm font-medium text-indigo-400">{nonCashCountTotal}回</span>
               </div>
            </div>
            <span className="text-3xl font-black text-white tracking-tight">
               {formatCurrency(nonCashAmountTotal)}
            </span>
         </div>
       )}

       {/* セクションタイトル */}
       <h4 className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest flex items-center gap-2 mt-6">
         <CreditCard className="w-3 h-3" /> 決済別内訳
       </h4>
       
       {/* 支払い方法別の売上カード表示（2列グリッド） */}
       <div className="grid grid-cols-2 gap-3">
         {methodsToList.map(method => {
            const amt = breakdown[method] || 0;
            const cnt = counts[method] || 0;
            // 金額が0かつ回数が0の場合はスキップ
            if (amt === 0 && cnt === 0) return null;
            
            // カスタムラベルまたはデフォルトラベルを使用
            const label = safeCustomLabels[method] || PAYMENT_LABELS[method];
            // 支払い方法に応じた色クラスを取得
            const colorClass = getPaymentColorClass(method);
            // 背景色を決定
            let bgClass = "bg-gray-900/50 border-gray-800";
            if (colorClass.includes("amber") || colorClass.includes("yellow")) bgClass = "bg-amber-900/20 border-amber-500/30";
            else if (colorClass.includes("blue") || colorClass.includes("sky")) bgClass = "bg-blue-900/20 border-blue-500/30";
            else if (colorClass.includes("green") || colorClass.includes("emerald")) bgClass = "bg-green-900/20 border-green-500/30";
            else if (colorClass.includes("purple") || colorClass.includes("indigo")) bgClass = "bg-purple-900/20 border-purple-500/30";
            else if (colorClass.includes("pink") || colorClass.includes("red")) bgClass = "bg-pink-900/20 border-pink-500/30";

            return (
               <div key={method} className={`${bgClass} p-3 rounded-xl border flex flex-col justify-between shadow-sm`}>
                  {/* 支払い方法名と乗車回数 */}
                  <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2">
                        <PaymentIcon method={method} className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-bold opacity-80 truncate max-w-[80px]">
                            {label}
                        </span>
                     </div>
                     <span className="text-xs font-medium opacity-60">
                        {cnt}回
                     </span>
                  </div>
                  {/* 売上金額 */}
                  <div className="text-right">
                     <span className="text-xl font-black block tracking-tight">
                        {formatCurrency(amt)}
                     </span>
                  </div>
               </div>
            )
         })}
       </div>
    </div>
  );
};
