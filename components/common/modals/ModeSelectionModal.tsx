import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { InputMode } from '../../../types';

interface ModeSelectionModalProps {
  onSelect: (mode: InputMode) => void;
  onClose?: () => void;
  isInitialLogin?: boolean; // 初回ログイン時かどうか
}

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ onSelect, onClose, isInitialLogin = false }) => {
  const [selectedMode, setSelectedMode] = useState<InputMode | null>(null);

  const handleConfirm = () => {
    if (selectedMode) {
      onSelect(selectedMode);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#131C2B] rounded-2xl p-6 max-w-md w-full space-y-6 border border-gray-700 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-black text-white">
              {isInitialLogin ? 'どちらのモードで利用開始しますか？' : '入力モードについて'}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* モード選択 */}
        <div className="space-y-4">
          {/* 詳細入力モード */}
          <button
            onClick={() => setSelectedMode('DETAILED')}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              selectedMode === 'DETAILED'
                ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10'
            }`}
          >
            <h3 className="text-base font-black text-white mb-2">詳細入力モード</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              1乗車ごとに詳細を記録するモードです。売上分析や乗降地の傾向など、本アプリの全ての機能をご利用いただけます。
            </p>
          </button>

          {/* 簡易入力モード */}
          <button
            onClick={() => setSelectedMode('SIMPLE')}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              selectedMode === 'SIMPLE'
                ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                : 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 hover:bg-orange-500/10'
            }`}
          >
            <h3 className="text-base font-black text-white mb-2">簡易入力モード</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              1日の終わりに結果だけをまとめて入力するモードです。入力は手軽ですが、乗降地データの分析など一部の機能が制限されます。
            </p>
          </button>
        </div>

        {/* 変更可能の注記 */}
        <p className="text-xs text-gray-400 text-center">
          いつでも変更は可能です
        </p>

        {/* OKボタン */}
        <button
          onClick={handleConfirm}
          disabled={!selectedMode}
          className={`w-full py-4 rounded-xl font-black text-lg transition-all ${
            selectedMode
              ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
};
