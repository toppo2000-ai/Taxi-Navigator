import React, { useState } from 'react';
import { Coins, CreditCard, Banknote, Smartphone, Ticket, QrCode, CarTaxiFront, ChevronDown, ChevronUp } from 'lucide-react';
import { PaymentMethod, DEFAULT_PAYMENT_ORDER, SalesRecord } from '../../types';
import { PAYMENT_LABELS, getPaymentColorClass, formatCurrency, getPaymentAppBreakdown } from '../../utils';

export const getPaymentCounts = (records: SalesRecord[]) => {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    counts[r.paymentMethod] = (counts[r.paymentMethod] || 0) + 1;
  });
  return counts;
};

const PaymentIcon: React.FC<{ method: PaymentMethod, className?: string }> = ({ method, className }) => {
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
  records?: SalesRecord[];
}

export const PaymentBreakdownList: React.FC<PaymentBreakdownListProps> = ({ 
  breakdown, 
  counts, 
  customLabels, 
  enabledMethods,
  records = []
}) => {
  const [showPaymentAppBreakdown, setShowPaymentAppBreakdown] = useState(false);
  
  const methodsToList = enabledMethods || DEFAULT_PAYMENT_ORDER;
  
  let nonCashAmountTotal = 0;
  let nonCashCountTotal = 0;
  Object.keys(breakdown).forEach(key => { 
    if (key !== 'CASH') nonCashAmountTotal += breakdown[key]; 
  });
  Object.keys(counts).forEach(key => { 
    if (key !== 'CASH') nonCashCountTotal += counts[key]; 
  });

  const safeCustomLabels = customLabels || {};
  
  // 決済アプリ別の集計を取得
  const { breakdown: paymentAppBreakdown, counts: paymentAppCounts } = getPaymentAppBreakdown(records);
  const paymentAppTotal = (paymentAppBreakdown.GO || 0) + (paymentAppBreakdown.Didi || 0) + (paymentAppBreakdown.Uber || 0) + (paymentAppBreakdown['s.ride'] || 0);
  const paymentAppTotalCount = (paymentAppCounts.GO || 0) + (paymentAppCounts.Didi || 0) + (paymentAppCounts.Uber || 0) + (paymentAppCounts['s.ride'] || 0);

  // 現金の金額と回数
  const cashAmount = breakdown['CASH'] || 0;
  const cashCount = counts['CASH'] || 0;

  // 現金以外の決済方法を取得（アプリ/QRを除く）
  const nonCashMethods = methodsToList.filter(m => m !== 'CASH' && m !== 'QR');

  // アプリ/QRの金額と回数
  const qrAmount = breakdown['QR'] || 0;
  const qrCount = counts['QR'] || 0;

  return (
    <div className="space-y-4">
      {/* 決済別内訳のタイトル */}
      <h3 className="text-lg font-black text-gray-300 uppercase tracking-widest flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5" /> 決済別内訳
      </h3>

      {/* 現金（横2つ分、パステルカラー） */}
      {cashAmount > 0 && (
        <div className="bg-gradient-to-r from-amber-300/40 to-yellow-300/40 p-4 rounded-2xl border border-amber-200/50 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200/30 rounded-full">
              <Banknote className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <span className="text-sm font-bold text-amber-50 block uppercase tracking-widest">
                {safeCustomLabels['CASH'] || PAYMENT_LABELS['CASH']}
              </span>
              <span className="text-sm font-medium text-amber-100">
                {cashCount}回
              </span>
            </div>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(cashAmount)}
          </span>
        </div>
      )}

      {/* キャッシュレス計（パステルカラー） */}
      {nonCashAmountTotal > 0 && (
        <div className="bg-gradient-to-r from-indigo-300/40 to-violet-300/40 p-4 rounded-2xl border border-indigo-200/50 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-200/30 rounded-full">
              <Coins className="w-6 h-6 text-indigo-100" />
            </div>
            <div>
              <span className="text-sm font-bold text-indigo-50 block uppercase tracking-widest">
                キャッシュレス計
              </span>
              <span className="text-sm font-medium text-indigo-100">
                {nonCashCountTotal}回
              </span>
            </div>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(nonCashAmountTotal)}
          </span>
        </div>
      )}

      {/* アプリ/QR（横2つ分、クリック可能、パステルカラー） */}
      {qrAmount > 0 && (
        <>
          <button
            onClick={() => setShowPaymentAppBreakdown(!showPaymentAppBreakdown)}
            className="w-full bg-gradient-to-r from-purple-300/40 to-fuchsia-300/40 p-4 rounded-2xl border border-purple-200/50 flex justify-between items-center shadow-lg hover:from-purple-300/50 hover:to-fuchsia-300/50 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200/30 rounded-full">
                <QrCode className="w-6 h-6 text-purple-100" />
              </div>
              <div>
                <span className="text-sm font-bold text-purple-50 block uppercase tracking-widest">
                  {safeCustomLabels['QR'] || PAYMENT_LABELS['QR']}
                </span>
                <span className="text-sm font-medium text-purple-100">
                  {qrCount}回
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(qrAmount)}
              </span>
              {paymentAppTotal > 0 && (
                showPaymentAppBreakdown ? (
                  <ChevronUp className="w-5 h-5 text-purple-100" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-purple-100" />
                )
              )}
            </div>
          </button>

          {/* 決済アプリ別内訳（トグル表示、パステルカラー） */}
          {showPaymentAppBreakdown && paymentAppTotal > 0 && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <h5 className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest flex items-center gap-2 mt-2 mb-2">
                <CarTaxiFront className="w-3 h-3" /> 決済アプリ別内訳
              </h5>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'GO', label: 'GO', gradient: 'from-blue-300/40 to-cyan-300/40', border: 'border-blue-200/50', iconBg: 'bg-blue-200/30', iconColor: 'text-blue-100', textColor: 'text-blue-50', textSecondaryColor: 'text-blue-100' },
                  { key: 'Didi', label: 'Didi', gradient: 'from-orange-300/40 to-amber-300/40', border: 'border-orange-200/50', iconBg: 'bg-orange-200/30', iconColor: 'text-orange-100', textColor: 'text-orange-50', textSecondaryColor: 'text-orange-100' },
                  { key: 'Uber', label: 'Uber', gradient: 'from-gray-300/40 to-slate-300/40', border: 'border-gray-200/50', iconBg: 'bg-gray-200/30', iconColor: 'text-gray-100', textColor: 'text-gray-50', textSecondaryColor: 'text-gray-100' },
                  { key: 's.ride', label: 'S.RIDE', gradient: 'from-green-300/40 to-emerald-300/40', border: 'border-green-200/50', iconBg: 'bg-green-200/30', iconColor: 'text-green-100', textColor: 'text-green-50', textSecondaryColor: 'text-green-100' }
                ].map(({ key, label, gradient, border, iconBg, iconColor, textColor, textSecondaryColor }) => {
                  const amt = paymentAppBreakdown[key] || 0;
                  const cnt = paymentAppCounts[key] || 0;
                  if (amt === 0 && cnt === 0) return null;

                  return (
                    <div 
                      key={key} 
                      className={`bg-gradient-to-r ${gradient} p-3 rounded-xl border ${border} flex flex-col justify-between shadow-sm`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 ${iconBg} rounded-full`}>
                            <CarTaxiFront className={`w-3.5 h-3.5 ${iconColor}`} />
                          </div>
                          <span className={`text-sm font-bold ${textColor} truncate max-w-[80px]`}>
                            {label}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${textSecondaryColor}`}>
                          {cnt}回
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-black block tracking-tight ${textColor}`}>
                          {formatCurrency(amt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* その他の決済方法（横2つ分、パステルカラー） */}
      <div className="space-y-3">
        {nonCashMethods.map(method => {
          const amt = breakdown[method] || 0;
          const cnt = counts[method] || 0;
          if (amt === 0 && cnt === 0) return null;
          
          const label = safeCustomLabels[method] || PAYMENT_LABELS[method];
          
          // 決済方法ごとのパステルカラー設定
          let bgGradient = "from-gray-300/40 to-slate-300/40";
          let borderColor = "border-gray-200/50";
          let iconBg = "bg-gray-200/30";
          let iconColor = "text-gray-100";
          let textColor = "text-gray-50";
          let textSecondaryColor = "text-gray-100";
          
          if (method === 'CARD') {
            bgGradient = "from-blue-300/40 to-cyan-300/40";
            borderColor = "border-blue-200/50";
            iconBg = "bg-blue-200/30";
            iconColor = "text-blue-100";
            textColor = "text-blue-50";
            textSecondaryColor = "text-blue-100";
          } else if (method === 'NET') {
            bgGradient = "from-green-300/40 to-emerald-300/40";
            borderColor = "border-green-200/50";
            iconBg = "bg-green-200/30";
            iconColor = "text-green-100";
            textColor = "text-green-50";
            textSecondaryColor = "text-green-100";
          } else if (method === 'E_MONEY') {
            bgGradient = "from-pink-300/40 to-rose-300/40";
            borderColor = "border-pink-200/50";
            iconBg = "bg-pink-200/30";
            iconColor = "text-pink-100";
            textColor = "text-pink-50";
            textSecondaryColor = "text-pink-100";
          } else if (method === 'TRANSPORT') {
            bgGradient = "from-orange-300/40 to-amber-300/40";
            borderColor = "border-orange-200/50";
            iconBg = "bg-orange-200/30";
            iconColor = "text-orange-100";
            textColor = "text-orange-50";
            textSecondaryColor = "text-orange-100";
          } else if (method === 'DIDI') {
            bgGradient = "from-indigo-300/40 to-violet-300/40";
            borderColor = "border-indigo-200/50";
            iconBg = "bg-indigo-200/30";
            iconColor = "text-indigo-100";
            textColor = "text-indigo-50";
            textSecondaryColor = "text-indigo-100";
          } else if (method === 'TICKET') {
            bgGradient = "from-teal-300/40 to-cyan-300/40";
            borderColor = "border-teal-200/50";
            iconBg = "bg-teal-200/30";
            iconColor = "text-teal-100";
            textColor = "text-teal-50";
            textSecondaryColor = "text-teal-100";
          }

          return (
            <div 
              key={method} 
              className={`bg-gradient-to-r ${bgGradient} p-4 rounded-2xl border ${borderColor} flex justify-between items-center shadow-lg`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 ${iconBg} rounded-full`}>
                  <PaymentIcon method={method} className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div>
                  <span className={`text-sm font-bold ${textColor} block uppercase tracking-widest`}>
                    {label}
                  </span>
                  <span className={`text-sm font-medium ${textSecondaryColor}`}>
                    {cnt}回
                  </span>
                </div>
              </div>
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(amt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
