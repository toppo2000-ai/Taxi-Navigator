import React from 'react';
import { Check } from 'lucide-react';
import { toCommaSeparated } from '@/utils';

interface KeypadViewProps {
  label: string;
  value: string;
  colorClass: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
}

export const KeypadView: React.FC<KeypadViewProps> = ({ label, value, colorClass, onChange, onConfirm }) => {
  const appendDigit = (digit: string) => {
    const current = value.replace(/,/g, '');
    const updated = current === "0" ? digit : current + digit;
    onChange(toCommaSeparated(updated));
  };

  const handleDelete = () => {
    const current = value.replace(/,/g, '');
    const updated = current.length <= 1 ? "0" : current.slice(0, -1);
    onChange(toCommaSeparated(updated));
  };

  const handleClear = () => {
    onChange("0");
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col space-y-2">
        <span className="text-lg font-bold ml-2 uppercase tracking-widest text-gray-400">{label}入力</span>
        <div className={`rounded-3xl p-5 flex items-center justify-end border min-h-[80px] shadow-inner overflow-hidden ${colorClass.replace('text-', 'border-').split(' ')[0]} bg-[#1A2536]`}>
           <span className={`text-[clamp(3rem,12vw,4.5rem)] font-black tracking-tighter truncate w-full text-right ${colorClass}`}>¥{value}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[7, 8, 9, 'DEL', 4, 5, 6, 'C', 1, 2, 3, '00'].map((key) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'DEL') handleDelete();
              else if (key === 'C') handleClear();
              else appendDigit(key.toString());
            }}
            className={`h-16 rounded-2xl text-3xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-md ${
              key === 'DEL' || key === 'C' ? 'bg-red-600/90 text-white' : 'bg-[#2D3848] text-white'
            }`}
          >
            {key === 'DEL' ? '←' : key}
          </button>
        ))}
        <button onClick={() => appendDigit('0')} className="h-16 rounded-2xl text-3xl font-bold bg-[#2D3848] text-white flex items-center justify-center active:scale-95 shadow-md">0</button>
        <button onClick={onConfirm} className="col-span-3 h-16 bg-green-600 text-white rounded-2xl text-2xl font-black shadow-xl active:scale-95 flex items-center justify-center gap-2">
          <Check className="w-8 h-8" /> 確定
        </button>
      </div>
    </div>
  );
};
