import React from 'react';
import { MessageSquare, MapPin, MapPinned, Skull, Circle } from 'lucide-react';
import { SalesRecord } from '../../types';
import { 
  formatBusinessTime,
  formatCurrency, 
  PAYMENT_LABELS, 
  RIDE_LABELS,
  getPaymentColorClass,
  getGoogleMapsUrl
} from '../../utils';

interface SalesRecordCardProps {
  record: SalesRecord;
  index: number;
  isDetailed: boolean;
  customLabels: Record<string, string>;
  businessStartHour: number;
  onClick: () => void;
}

export const SalesRecordCard: React.FC<SalesRecordCardProps> = ({ 
  record, 
  index, 
  isDetailed, 
  customLabels, 
  businessStartHour, 
  onClick,
  isSlim = false
}) => {
  const safeCustomLabels = customLabels || {};
  const paymentName = safeCustomLabels[record.paymentMethod] || PAYMENT_LABELS[record.paymentMethod];
  const totalAmount = record.amount + record.toll;
  const passengerStr = `[${record.passengersMale || 0}${record.passengersFemale || 0}]`;

  // スリムモードの表示
  if (isSlim) {
    // 交互の行色（1行目と3行目が同じ色、2行目と4行目が同じ色）
    // グレー系で白文字がよく見える色を使用
    const isEven = index % 2 === 0;
    const rowBgClass = isEven ? 'bg-slate-800' : 'bg-slate-700';
    const hoverBgClass = isEven ? 'hover:bg-slate-700' : 'hover:bg-slate-600';
    const borderClass = 'border-gray-700';
    
    return (
      <tr className={`${rowBgClass} border-b ${borderClass}`}>
        {/* 左端: 番号列（中央揃え、アイコン表示、クリック可能） */}
        <td 
          onClick={onClick}
          className={`py-2 px-1 border-r ${borderClass} align-middle text-center cursor-pointer transition-colors ${hoverBgClass}`}
        >
          <div className="flex items-center justify-center w-full">
            <div className="relative flex items-center justify-center" style={{ width: 'clamp(2rem, 6vw, 2.5rem)', height: 'clamp(2rem, 6vw, 2.5rem)' }}>
              <Circle className="w-full h-full text-orange-500 fill-orange-500" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-black" style={{ fontSize: 'clamp(0.875rem, 3vw, 1.125rem)' }}>
                {index}
              </span>
            </div>
          </div>
        </td>

        {/* 時刻列（クリック可能） */}
        <td 
          onClick={onClick}
          className={`py-2 px-1 border-r ${borderClass} align-middle text-center w-[85px] cursor-pointer transition-colors ${hoverBgClass}`}
        >
          {/* 時刻（下線付き、白文字） */}
          <div className="text-white font-black text-lg underline mb-1 whitespace-nowrap">
            {formatBusinessTime(record.timestamp, businessStartHour)}
          </div>
          {/* 男女人数 男1:女1 */}
          <div className="text-base font-black whitespace-nowrap">
            <span className="text-blue-400">男</span>{record.passengersMale || 0}:<span className="text-red-400">女</span>{record.passengersFemale || 0}
          </div>
        </td>

        {/* 乗降地列（クリック不可） */}
        <td className={`py-2 px-2 border-r ${borderClass} align-top`}>
          {/* 乗車地（白文字、Googleマップアプリ版リンク） */}
          <div className="text-white text-base font-bold mb-1 truncate">
            {record.pickupCoords ? (
              <a
                href={getGoogleMapsUrl(record.pickupCoords) || "#"}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-blue-400 transition-colors"
              >
                {record.pickupLocation || '---'}
              </a>
            ) : (
              <span className="underline">{record.pickupLocation || '---'}</span>
            )}
          </div>
          
          {/* 点線 */}
          <div className="border-b border-dotted border-gray-600 my-1 opacity-60"></div>
          
          {/* 降車地（右寄せ、白文字、Googleマップアプリ版リンク） */}
          <div className="text-white text-base font-bold truncate text-right">
            {record.dropoffCoords ? (
              <a
                href={getGoogleMapsUrl(record.dropoffCoords) || "#"}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-blue-400 transition-colors"
              >
                {record.dropoffLocation || '---'}
              </a>
            ) : (
              <span className="underline">{record.dropoffLocation || '---'}</span>
            )}
          </div>
        </td>

        {/* 中央: 売上金額（縦横中央揃え、クリック不可） */}
        <td className="py-2 px-1 text-center align-middle w-[75px]">
          <div className="text-white font-black text-base whitespace-nowrap">
            {totalAmount.toLocaleString()}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className="bg-gray-800 p-5 rounded-[24px] border-2 border-blue-500 active:scale-[0.98] transition-all shadow-md flex flex-col gap-3 w-full relative overflow-hidden group cursor-pointer"
    >
      {record.isBadCustomer && (
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none text-red-500/20">
          <Skull className="w-16 h-16" />
        </div>
      )}
      
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-base font-black text-amber-500 border border-gray-700 shadow-inner">
              {index}
            </div>
            <span className="text-xl font-black text-gray-300 font-mono tracking-wide">
              {formatBusinessTime(record.timestamp, businessStartHour)}
            </span>
          </div>
          <div className="ml-11">
            <span className="text-slate-400 text-lg font-black tracking-widest font-mono">
              {passengerStr}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[clamp(2.2rem,10vw,2.8rem)] font-black text-amber-500 leading-none block drop-shadow-md tracking-tighter">
            {formatCurrency(totalAmount)}
          </span>
          {record.toll > 0 && (
            <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/30 inline-block mt-1">
              (高速 {record.toll})
            </span>
          )}
          {(record.returnToll || 0) > 0 && (
            <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/30 inline-block mt-1 ml-1">
              (帰路 {record.returnToll})
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-2 my-1 pl-1 border-l-2 border-gray-700 ml-2 py-1">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">
              {record.pickupLocation || '---'}
            </span>
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
        
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-lg font-black text-white leading-tight truncate">
              {record.dropoffLocation || '---'}
            </span>
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
      
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border flex-1 text-center whitespace-nowrap ${getPaymentColorClass(record.paymentMethod)}`}>
          {paymentName}
        </span>
        {record.rideType !== 'FLOW' && (
          <span className="text-xs font-black text-gray-300 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 whitespace-nowrap">
            {RIDE_LABELS[record.rideType]}
          </span>
        )}
      </div>
      
      {isDetailed && record.remarks && (
        <div className="mt-2 pt-3 border-t border-gray-800/50 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-yellow-900/20 p-4 rounded-xl border border-yellow-700/30 flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-base font-bold text-yellow-100 whitespace-pre-wrap leading-relaxed">
              {record.remarks}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
