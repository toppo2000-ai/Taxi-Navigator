import React from 'react';
import { Car, Settings } from 'lucide-react';

interface HeaderProps {
  onViewSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onViewSettings }) => (
  <header className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 sticky top-0 bg-[#0A121E] z-30 border-b border-gray-800/50 backdrop-blur-md">
    <div className="flex items-center gap-2">
      <Car className="text-yellow-400 w-7 h-7 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
      <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">TaxiApp</h1>
    </div>
    <div className="flex items-center gap-4">
      <button onClick={onViewSettings} className="p-2 text-gray-400 active:scale-90 transition-transform"><Settings className="w-7 h-7" /></button>
    </div>
  </header>
);