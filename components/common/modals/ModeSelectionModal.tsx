import React, { useState, useEffect } from 'react';
import { Info, X, Sparkles } from 'lucide-react';
import { InputMode } from '../../../types';

interface ModeSelectionModalProps {
  onSelect: (mode: InputMode) => void;
  onClose?: () => void;
  isInitialLogin?: boolean; // 初回ログイン時かどうか
}

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ onSelect, onClose, isInitialLogin = false }) => {
  const [selectedMode, setSelectedMode] = useState<InputMode | null>(null);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // 初回ログイン時は、まず確認ダイアログを表示
  useEffect(() => {
    if (isInitialLogin) {
      setShowWelcomeDialog(true);
    }
  }, [isInitialLogin]);

  const handleWelcomeConfirm = () => {
    // 「はい」を選択した場合、簡易モードを選択してコールバックを実行
    setShowWelcomeDialog(false);
    onSelect('SIMPLE');
  };

  const handleWelcomeCancel = () => {
    // 「いいえ」を選択した場合、通常のモード選択画面を表示
    setShowWelcomeDialog(false);
  };

  const handleConfirm = () => {
    if (selectedMode) {
      onSelect(selectedMode);
    }
  };

  // 初回ログイン時の確認ダイアログ
  if (showWelcomeDialog) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#131C2B] rounded-2xl p-6 max-w-md w-full space-y-6 border border-amber-500/30 shadow-2xl animate-in fade-in duration-300">
          {/* ヘッダー */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="bg-amber-500/20 rounded-full p-3">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-black text-white">
              ようこそ！
            </h2>
          </div>

          {/* メッセージ */}
          <div className="space-y-4">
            <p className="text-base text-gray-200 leading-relaxed text-center">
              初めてご利用の場合、<br />
              まずは<strong className="text-amber-400">簡易入力モード</strong>から始めるのを<br />オススメします。<br /><br />
              いつでも設定画面からモードは<br />切り替えられるので、<br />慣れてきたら詳細モードもご利用ください。<br /><br />
              <strong className="text-amber-400">らくらく入力モード</strong>で利用開始しますか？
            </p>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleWelcomeCancel}
              className="flex-1 py-3 rounded-xl font-bold text-base bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all active:scale-95"
            >
              いいえ
            </button>
            <button
              onClick={handleWelcomeConfirm}
              className="flex-1 py-3 rounded-xl font-black text-base bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-95 shadow-lg shadow-amber-500/30"
            >
              はい
            </button>
          </div>
        </div>
      </div>
    );
  }

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
