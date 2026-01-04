import React from 'react';
import { Loader2 } from 'lucide-react';
import naviLoadingImage from '../../assets/navi-loading.png';

export const SplashScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center text-amber-500 space-y-8 animate-in fade-in duration-500">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div className="absolute inset-0 bg-amber-500/20 blur-[60px] rounded-full animate-pulse"></div>
        <img 
          src={naviLoadingImage} 
          alt="System Navi" 
          className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-amber-500" size={40} />
        <div className="flex flex-col items-center">
          <span className="text-amber-500 font-black tracking-[0.3em] uppercase text-xs animate-pulse">Initializing Navi System</span>
          <div className="h-[2px] w-48 bg-gray-800 mt-2 overflow-hidden rounded-full">
            <div className="h-full bg-amber-500 w-1/3 animate-[loading_1.5s_infinite_linear]"></div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
