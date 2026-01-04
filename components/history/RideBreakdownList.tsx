import React from 'react';
import { Car, CarTaxiFront } from 'lucide-react';
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
}

export const RideBreakdownList: React.FC<RideBreakdownListProps> = ({ 
  breakdown, 
  counts, 
  enabledRideTypes 
}) => {
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

  return (
    <div className="space-y-4">
      {nonFlowAmountTotal > 0 && (
        <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 p-4 rounded-2xl border border-green-500/30 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-full">
              <CarTaxiFront className="w-6 h-6 text-green-300" />
            </div>
            <div>
              <span className="text-xs font-bold text-green-200 block uppercase tracking-widest">
                配車等計
              </span>
              <span className="text-sm font-medium text-green-400">
                {nonFlowCountTotal}回
              </span>
            </div>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {formatCurrency(nonFlowAmountTotal)}
          </span>
        </div>
      )}

      <h4 className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest flex items-center gap-2 mt-3">
        <Car className="w-3 h-3" /> 乗車区分別内訳
      </h4>
      
      <div className="grid grid-cols-2 gap-3">
        {rideTypesToList.map(rideType => {
          const amt = breakdown[rideType] || 0;
          const cnt = counts[rideType] || 0;
          if (amt === 0 && cnt === 0) return null;
          
          const label = RIDE_LABELS[rideType];
          
          // 乗車区分ごとの色設定
          let bgClass = "bg-gray-900/50 border-gray-800";
          if (rideType === 'FLOW') {
            bgClass = "bg-blue-900/20 border-blue-500/30";
          } else if (rideType === 'WAIT') {
            bgClass = "bg-amber-900/20 border-amber-500/30";
          } else if (rideType === 'APP') {
            bgClass = "bg-purple-900/20 border-purple-500/30";
          } else if (rideType === 'HIRE') {
            bgClass = "bg-green-900/20 border-green-500/30";
          } else if (rideType === 'RESERVE') {
            bgClass = "bg-pink-900/20 border-pink-500/30";
          } else if (rideType === 'WIRELESS') {
            bgClass = "bg-indigo-900/20 border-indigo-500/30";
          }

          return (
            <div 
              key={rideType} 
              className={`${bgClass} p-3 rounded-xl border flex flex-col justify-between shadow-sm`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <RideIcon rideType={rideType} className="w-4 h-4 opacity-70" />
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
          );
        })}
      </div>
    </div>
  );
};
