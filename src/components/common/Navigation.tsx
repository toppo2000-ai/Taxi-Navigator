import React from 'react';
import { Car, Calendar, BarChart3, BookOpen, Bug } from 'lucide-react';

// ナビゲーションのプロップスのインターフェース
interface NavigationProps {
  activeTab: string; // 現在のアクティブなタブ
  onTabChange: (tab: 'home' | 'history' | 'analysis' | 'guide' | 'debug') => void; // タブ切り替えのコールバック
}

// ボトムナビゲーションコンポーネント
export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0A0E14]/95 backdrop-blur-2xl border-t border-gray-800 flex justify-around pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-15px_45px_rgba(0,0,0,0.8)]">
      {/* ホームタブ */}
      <button 
        onClick={() => onTabChange('home')} 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'home' ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <Car className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-widest">ホーム</span>
      </button>
      
      {/* 履歴タブ */}
      <button 
        onClick={() => onTabChange('history')} 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <Calendar className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
      </button>
      
      {/* 分析タブ */}
      <button 
        onClick={() => onTabChange('analysis')} 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <BarChart3 className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-widest">分析</span>
      </button>
      
      {/* ガイドタブ */}
      <button 
        onClick={() => onTabChange('guide')} 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'guide' ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <BookOpen className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-widest">ガイド</span>
      </button>

      {/* デバッグタブ */}
      <button 
        onClick={() => onTabChange('debug')} 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'debug' ? 'text-red-500' : 'text-gray-600'}`}
      >
        <Bug className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-widest">Debug</span>
      </button>
    </nav>
  );
};
