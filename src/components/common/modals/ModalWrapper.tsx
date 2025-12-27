// モーダルラッパーコンポーネント - モーダル背景処理とアニメーション
// 全モーダルコンポーネントに統一されたスタイルと背景処理を提供
import React from 'react';

// プロパティ: children: モーダル内のコンテンツ、onClose: 背景クリックで実行
export const ModalWrapper: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    {/* 背景をクリックするとモーダルを閉じる */}
    <div className="absolute inset-0" onClick={onClose} />
    
    {/* モーダルコンテナ - 下部シートスタイル */}
    <div className="relative w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-5 shadow-2xl border-t border-gray-700 flex flex-col max-h-[90vh]">
      {/* ドラッグハンドル */}
      <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6 opacity-50 flex-shrink-0" />
      
      {/* スクロール可能なコンテンツ領域 */}
      <div className="overflow-y-auto custom-scrollbar flex-1 pb-safe">
        {children}
      </div>
    </div>
  </div>
);
