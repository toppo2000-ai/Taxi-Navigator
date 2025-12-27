// ネオンスタイルプログレスバーコンポーネント
import React from 'react';

export const NeonProgressBar: React.FC<{ progress: number, color: 'amber' | 'blue' }> = ({ progress, color }) => {
  const isAmber = color === 'amber';
  const barColorClass = isAmber ? 'bg-amber-500 shadow-[0_0_15px_#F59E0B]' : 'bg-blue-500 shadow-[0_0_15px_#3B82F6]';
  const borderColorClass = isAmber ? 'border-amber-400/40' : 'border-blue-400/40';
  
  return (
    <div className={`w-full bg-[#05080C] border-2 ${borderColorClass} rounded-full h-8 p-1 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]`}>
      <div 
        className={`h-full transition-all duration-1000 ease-out rounded-full ${barColorClass}`} 
        style={{ width: `${Math.min(100, progress)}%` }} 
      />
    </div>
  );
};