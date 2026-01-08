import React, { useState } from 'react';
import { Car, CarTaxiFront, ChevronDown, ChevronUp } from 'lucide-react';
import { RideType, ALL_RIDE_TYPES } from '../../types';
import { RIDE_LABELS, formatCurrency } from '../../utils';

const RideIcon: React.FC<{ rideType: RideType, className?: string }> = ({ rideType, className }) => {
  switch (rideType) {
    case 'FLOW': return <Car className={className} />;
    case 'WAIT': return <CarTaxiFront className={className} />;
    case 'APP': return <CarTaxiFront className={className} />;
    case 'HIRE': return <CarTaxiFront className={className} />;
    case 'RESERVE': return <CarTaxiFront className={className} />;
    case 'WIRELESS': return <CarTaxiFront className={className} />;
    default: return <Car className={className} />;
  }
};

interface RideBreakdownListProps {
  breakdown: Record<string, number>;
  counts: Record<string, number>;
  enabledRideTypes?: RideType[];
  appBreakdown?: Record<string, number>;
  appCounts?: Record<string, number>;
}

export const RideBreakdownList: React.FC<RideBreakdownListProps> = ({ 
  breakdown, 
  counts, 
  enabledRideTypes,
  appBreakdown = {},
  appCounts = {}
}) => {
  const [showAppBreakdown, setShowAppBreakdown] = useState(false);
  
  const rideTypesToList = enabledRideTypes || ALL_RIDE_TYPES;
  
  // 流し以外の合計を計算
  let nonFlowAmountTotal = 0;
  let nonFlowCountTotal = 0;
  Object.keys(breakdown).forEach(key => { 
    if (key !== 'FLOW') {
      nonFlowAmountTotal += breakdown[key]; 
      nonFlowCountTotal += counts[key] || 0;
    }
  });

  // アプリ計を計算
  const appTotalAmount = (appBreakdown.GO || 0) + (appBreakdown.Didi || 0) + (appBreakdown.Uber || 0) + (appBreakdown['s.ride'] || 0);
  const appTotalCount = (appCounts.GO || 0) + (appCounts.Didi || 0) + (appCounts.Uber || 0) + (appCounts['s.ride'] || 0);

  // アプリ（APP）を除外した乗車区分リスト
  const rideTypesWithoutApp = rideTypesToList.filter(rideType => rideType !== 'APP');

  return (
    <div className="space-y-4">
      {/* タイトル */}
      <h3 className="text-lg font-black text-gray-300 uppercase tracking-widest flex items-center gap-2 mb-2">
        <Car className="w-5 h-5" /> 乗車区分別内訳
      </h3>

      {nonFlowAmountTotal > 0 && (
        <div className="bg-gradient-to-r from-emerald-400/40 to-teal-400/40 p-4 rounded-2xl border border-emerald-300/50 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-300/30 rounded-full">
              <CarTaxiFront className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <span className="text-sm font-bold text-emerald-100 block uppercase tracking-widest">
                配車等計
              </span>
              <span className="text-sm font-medium text-emerald-200">
                {nonFlowCountTotal}回
              </span>
            </div>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(nonFlowAmountTotal)}
          </span>
        </div>
      )}

      {/* 配車アプリ計（クリック可能） */}
      {appTotalAmount > 0 && (
        <>
          <button
            onClick={() => setShowAppBreakdown(!showAppBreakdown)}
            className="w-full bg-gradient-to-r from-purple-400/40 to-pink-400/40 p-4 rounded-2xl border border-purple-300/50 flex justify-between items-center shadow-lg hover:from-purple-400/50 hover:to-pink-400/50 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-300/30 rounded-full">
                <CarTaxiFront className="w-6 h-6 text-purple-200" />
              </div>
              <div>
                <span className="text-sm font-bold text-purple-100 block uppercase tracking-widest">
                  配車アプリ計
                </span>
                <span className="text-sm font-medium text-purple-200">
                  {appTotalCount}回
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(appTotalAmount)}
              </span>
              {showAppBreakdown ? (
                <ChevronUp className="w-5 h-5 text-purple-200" />
              ) : (
                <ChevronDown className="w-5 h-5 text-purple-200" />
              )}
            </div>
          </button>

          {/* 配車アプリ別内訳（トグル表示） */}
          {showAppBreakdown && (
            <div className="animate-in slide-in-from-top-2 duration-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'GO', label: 'GO', gradient: 'from-blue-300/40 to-cyan-300/40', border: 'border-blue-200/50', iconBg: 'bg-blue-200/30', iconColor: 'text-blue-100', textColor: 'text-blue-50', textSecondaryColor: 'text-blue-100' },
                  { key: 'Didi', label: 'Didi', gradient: 'from-orange-300/40 to-amber-300/40', border: 'border-orange-200/50', iconBg: 'bg-orange-200/30', iconColor: 'text-orange-100', textColor: 'text-orange-50', textSecondaryColor: 'text-orange-100' },
                  { key: 'Uber', label: 'Uber', gradient: 'from-gray-400/40 to-slate-400/40', border: 'border-gray-300/50', iconBg: 'bg-gray-300/30', iconColor: 'text-gray-200', textColor: 'text-gray-100', textSecondaryColor: 'text-gray-200' },
                  { key: 's.ride', label: 'S.RIDE', gradient: 'from-green-300/40 to-emerald-300/40', border: 'border-green-200/50', iconBg: 'bg-green-200/30', iconColor: 'text-green-100', textColor: 'text-green-50', textSecondaryColor: 'text-green-100' }
                ].map(({ key, label, gradient, border, iconBg, iconColor, textColor, textSecondaryColor }) => {
                  const amt = appBreakdown[key] || 0;
                  const cnt = appCounts[key] || 0;
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
      
      {/* 乗車区分別内訳（アプリを除外） */}
      <div className="grid grid-cols-2 gap-3">
        {rideTypesWithoutApp.map(rideType => {
          const amt = breakdown[rideType] || 0;
          const cnt = counts[rideType] || 0;
          if (amt === 0 && cnt === 0) return null;
          
          const label = RIDE_LABELS[rideType];
          
          // 乗車区分ごとのパステルカラー設定
          let gradient = "from-gray-300/40 to-slate-300/40";
          let border = "border-gray-200/50";
          let iconBg = "bg-gray-200/30";
          let iconColor = "text-gray-100";
          let textColor = "text-gray-50";
          let textSecondaryColor = "text-gray-100";
          
          if (rideType === 'FLOW') {
            gradient = "from-blue-300/40 to-cyan-300/40";
            border = "border-blue-200/50";
            iconBg = "bg-blue-200/30";
            iconColor = "text-blue-100";
            textColor = "text-blue-50";
            textSecondaryColor = "text-blue-100";
          } else if (rideType === 'WAIT') {
            gradient = "from-amber-300/40 to-yellow-300/40";
            border = "border-amber-200/50";
            iconBg = "bg-amber-200/30";
            iconColor = "text-amber-100";
            textColor = "text-amber-50";
            textSecondaryColor = "text-amber-100";
          } else if (rideType === 'HIRE') {
            gradient = "from-green-300/40 to-emerald-300/40";
            border = "border-green-200/50";
            iconBg = "bg-green-200/30";
            iconColor = "text-green-100";
            textColor = "text-green-50";
            textSecondaryColor = "text-green-100";
          } else if (rideType === 'RESERVE') {
            gradient = "from-pink-300/40 to-rose-300/40";
            border = "border-pink-200/50";
            iconBg = "bg-pink-200/30";
            iconColor = "text-pink-100";
            textColor = "text-pink-50";
            textSecondaryColor = "text-pink-100";
          } else if (rideType === 'WIRELESS') {
            gradient = "from-indigo-300/40 to-violet-300/40";
            border = "border-indigo-200/50";
            iconBg = "bg-indigo-200/30";
            iconColor = "text-indigo-100";
            textColor = "text-indigo-50";
            textSecondaryColor = "text-indigo-100";
          }

          return (
            <div 
              key={rideType} 
              className={`bg-gradient-to-r ${gradient} p-3 rounded-xl border ${border} flex flex-col justify-between shadow-sm`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 ${iconBg} rounded-full`}>
                    <RideIcon rideType={rideType} className={`w-3.5 h-3.5 ${iconColor}`} />
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
  );
};
