import React from 'react';
import { Car, BarChart3, Calendar, Trophy, ClipboardList, TrainFront } from 'lucide-react';
import { MonthlyStats } from '../../types';

type TabType = 'home' | 'history' | 'analysis' | 'analytics' | 'guide';

interface BottomNavigationProps {
  activeTab: TabType;
  monthlyStats: MonthlyStats;
  showCalendar: boolean;
  targetHistoryDate: string | Date | null;
  onTabChange: (tab: TabType) => void;
  onTargetHistoryDateChange: (date: string | Date | null) => void;
  onTargetHistoryRecordIdChange: (id: string | null) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  monthlyStats,
  showCalendar,
  targetHistoryDate,
  onTabChange,
  onTargetHistoryDateChange,
  onTargetHistoryRecordIdChange,
}) => {
  if (showCalendar) return null;

  const isSimpleMode = (monthlyStats.inputMode || 'DETAILED') === 'SIMPLE';

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0A0E14]/95 backdrop-blur-2xl border-t border-gray-800 flex justify-around pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-15px_45px_rgba(0,0,0,0.8)] pointer-events-auto">
      {isSimpleMode ? (
        // 簡易モード用のタブ（管理、履歴、ランキング）
        <>
          <button 
            onClick={() => {
              console.log('Simple Dashboard clicked');
              onTabChange('home');
              onTargetHistoryDateChange(null);
              onTargetHistoryRecordIdChange(null);
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'home' && !targetHistoryDate ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <ClipboardList className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">管理</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('Simple History clicked');
              onTabChange('history');
              onTargetHistoryDateChange(null);
              onTargetHistoryRecordIdChange(null);
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('Simple Ranking clicked');
              onTabChange('analysis');
              onTargetHistoryDateChange(null);
              onTargetHistoryRecordIdChange(null);
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">ランキング</span>
          </button>
        </>
      ) : (
        // 詳細モード用のタブ（通常のタブ）
        <>
          <button 
            onClick={() => {
              console.log('Home clicked');
              onTabChange('home');
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'home' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <Car className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">ホーム</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('History clicked');
              onTabChange('history');
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'history' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">履歴</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('Analysis clicked');
              onTabChange('analysis');
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analysis' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">ランキング</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('Analytics clicked');
              onTabChange('analytics');
            }} 
            type="button"
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${activeTab === 'analytics' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">解析</span>
          </button>
          
          <button 
            onClick={() => {
              console.log('Guide clicked');
              window.open('https://cf750778.cloudfree.jp/core/', '_blank');
            }} 
            type="button"
            className="flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer text-gray-500"
          >
            <TrainFront className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">カメラ</span>
          </button>
        </>
      )}
    </nav>
  );
};
