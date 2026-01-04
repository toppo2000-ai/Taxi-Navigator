import React, { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { Shift } from '../../../types';
import { ModalWrapper } from './ModalWrapper';

export const ShiftEditModal: React.FC<{
  shift: Shift;
  onClose: () => void;
  onSave: (startTime: number, plannedHours: number) => void;
}> = ({ shift, onClose, onSave }) => {
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(shift.startTime);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState(() => {
    return new Date(shift.startTime).toTimeString().slice(0, 5);
  });
  const [hours, setHours] = useState(shift.plannedHours);

  const handleSave = () => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    const newStart = new Date(year, month - 1, day, h, m).getTime();
    onSave(newStart, hours);
    onClose();
  };

  const hoursOptions = Array.from({ length: 21 }, (_, i) => i + 4); 

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <h3 className="text-2xl font-black text-white text-center">営業情報の修正</h3>
        
        <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-5">
          <div>
            <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" /> 開始日時
            </label>
            <div className="flex gap-3">
              <input 
                type="date" 
                value={dateStr} 
                onChange={(e) => setDateStr(e.target.value)} 
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-black outline-none focus:border-amber-500" 
              />
              <input 
                type="time" 
                value={timeStr} 
                onChange={(e) => setTimeStr(e.target.value)} 
                className="w-28 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-black outline-none focus:border-amber-500" 
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-400 mb-2 block uppercase tracking-widest">予定営業時間</label>
            <div className="relative">
              <select 
                value={hours} 
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-lg font-black appearance-none focus:border-amber-500 outline-none"
              >
                {hoursOptions.map(h => (
                  <option key={h} value={h}>{h} 時間</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleSave} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform">
          変更を保存
        </button>
      </div>
    </ModalWrapper>
  );
};
