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
  const methodsToList = enabledMethods || DEFAULT_PAYMENT_ORDER;
  
  let nonCashAmountTotal = 0;
  let nonCashCountTotal = 0;
  Object.keys(breakdown).forEach(key => { if (key !== 'CASH') nonCashAmountTotal += breakdown[key]; });
  Object.keys(counts).forEach(key => { if (key !== 'CASH') nonCashCountTotal += counts[key]; });

  const safeCustomLabels = customLabels || {};

  return (
    <div className="space-y-4">
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

       <h4 className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest flex items-center gap-2 mt-6">
         <CreditCard className="w-3 h-3" /> 決済別内訳
       </h4>
       
       <div className="grid grid-cols-2 gap-3">
         {methodsToList.map(method => {
            const amt = breakdown[method] || 0;
            const cnt = counts[method] || 0;
            if (amt === 0 && cnt === 0) return null;
            
            const label = safeCustomLabels[method] || PAYMENT_LABELS[method];
            const colorClass = getPaymentColorClass(method);
            let bgClass = "bg-gray-900/50 border-gray-800";
            if (colorClass.includes("amber") || colorClass.includes("yellow")) bgClass = "bg-amber-900/20 border-amber-500/30";
            else if (colorClass.includes("blue") || colorClass.includes("sky")) bgClass = "bg-blue-900/20 border-blue-500/30";
            else if (colorClass.includes("green") || colorClass.includes("emerald")) bgClass = "bg-green-900/20 border-green-500/30";
            else if (colorClass.includes("purple") || colorClass.includes("indigo")) bgClass = "bg-purple-900/20 border-purple-500/30";
            else if (colorClass.includes("pink") || colorClass.includes("red")) bgClass = "bg-pink-900/20 border-pink-500/30";

            return (
               <div key={method} className={`${bgClass} p-3 rounded-xl border flex flex-col justify-between shadow-sm`}>
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
