import React from 'react';
import { Settings, Shield } from 'lucide-react';
import naviChibiImage from '@/assets/navi-chibi.png'
interface HeaderProps {
  isAdmin: boolean;
  onViewSettings: () => void;
  onViewAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onViewSettings, onViewAdmin }) => (
  <header className="bg-[#1A222C] border-b border-gray-800 p-4 safe-top sticky top-0 z-30 overflow-hidden relative">
    <div className="flex justify-between items-center relative z-10">
      <div className="flex items-center transform active:scale-95 transition-transform cursor-default">
        <div className="relative z-10 flex items-center -space-x-2 mr-1">
            <div className="relative w-12 h-12 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-bounce-slow">
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
                <img 
                    src={naviChibiImage} 
                    alt="Navi" 
                    className="w-full h-full object-contain"
                />
            </div>
        </div>
        
        <div className="flex flex-col -space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-yellow-600 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">TAXI</span>
            <span className="text-sm font-bold italic tracking-widest text-amber-500/80 uppercase">navigator</span>
          </div>
          <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 to-transparent rounded-full opacity-50"></div>
        </div>
        {import.meta.env.DEV && (
          <div className="ml-2 px-1.5 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-[8px] font-black text-red-500 uppercase tracking-tighter animate-pulse">
            Dev Mode
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <button 
            onClick={onViewAdmin} 
            className="p-2 bg-purple-900/50 border border-purple-500/50 rounded-full text-purple-400 hover:text-white transition-all active:scale-90"
            title="管理者メニュー"
          >
            <Shield size={22} />
          </button>
        )}

        <button onClick={onViewSettings} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all active:scale-90 border border-gray-700">
          <Settings size={22} />
        </button>
      </div>
    </div>
    <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>
    <style>{`
      @keyframes bounce-slow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      .animate-bounce-slow {
        animation: bounce-slow 3s infinite ease-in-out;
      }
    `}</style>
  </header>
);