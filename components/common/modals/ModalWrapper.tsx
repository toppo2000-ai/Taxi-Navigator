import React, { useEffect, useRef } from 'react';

export const ModalWrapper: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => {
  const onCloseRef = useRef(onClose);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    // モーダルが開いたときのみ履歴を追加（既に追加されている場合はスキップ）
    const currentState = window.history.state;
    if (!currentState?.modal) {
      window.history.pushState({ modal: true }, '', window.location.href);
    }
    
    const handlePopState = (e: PopStateEvent) => {
      // 戻るボタンが押された場合のみ閉じる
      if (!e.state?.modal) {
        onCloseRef.current();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // ★追加: モーダルが開いている間、htmlとbodyのスクロールとタッチ移動を無効化
    const html = document.documentElement;
    const originalHtmlOverflow = html.style.overflow;
    const originalHtmlOverflowX = html.style.overflowX;
    const originalHtmlPosition = html.style.position;
    const originalHtmlWidth = html.style.width;
    const originalHtmlLeft = html.style.left;
    const originalHtmlRight = html.style.right;
    
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverflowX = document.body.style.overflowX;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyLeft = document.body.style.left;
    const originalBodyRight = document.body.style.right;
    
    // html要素のスタイルを設定
    html.style.overflowX = 'hidden';
    html.style.width = '100%';
    html.style.left = '0';
    html.style.right = '0';
    
    // body要素のスタイルを設定
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.left = '0';
    document.body.style.right = '0';
    
    // ★追加: モーダルコンテナの横スクロールを防ぐタッチイベントハンドラー
    let initialX = 0;
    let initialY = 0;
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      
      const deltaX = Math.abs(touch.clientX - initialX);
      const deltaY = Math.abs(touch.clientY - initialY);
      
      // スクロール可能な領域内の場合
      if (modalContentRef.current && modalContentRef.current.contains(e.target as Node)) {
        // 縦スクロールは許可、横スクロールのみ防止
        if (deltaX > deltaY) {
          // 横方向の移動が縦方向より大きい場合は防止
          e.preventDefault();
        }
        // 縦方向の移動の場合は何もしない（スクロールを許可）
      } else {
        // スクロール可能な領域外の場合はすべてのタッチ移動を防止
        e.preventDefault();
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      // 初期位置を記録
      if (e.touches[0]) {
        initialX = e.touches[0].clientX;
        initialY = e.touches[0].clientY;
      }
    };
    
    // モーダルコンテナにタッチイベントリスナーを追加
    if (modalContainerRef.current) {
      modalContainerRef.current.addEventListener('touchstart', handleTouchStart, { passive: true });
      modalContainerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // クリーンアップ時は履歴操作を行わない（モーダルを閉じる処理と競合するため）
      
      // ★追加: htmlとbodyのスタイルを確実にリセット
      // 空文字列の場合はremovePropertyを使用して完全に削除
      if (originalHtmlOverflow) {
        html.style.overflow = originalHtmlOverflow;
      } else {
        html.style.removeProperty('overflow');
      }
      if (originalHtmlOverflowX) {
        html.style.overflowX = originalHtmlOverflowX;
      } else {
        html.style.removeProperty('overflow-x');
      }
      if (originalHtmlPosition) {
        html.style.position = originalHtmlPosition;
      } else {
        html.style.removeProperty('position');
      }
      if (originalHtmlWidth) {
        html.style.width = originalHtmlWidth;
      } else {
        html.style.removeProperty('width');
      }
      if (originalHtmlLeft) {
        html.style.left = originalHtmlLeft;
      } else {
        html.style.removeProperty('left');
      }
      if (originalHtmlRight) {
        html.style.right = originalHtmlRight;
      } else {
        html.style.removeProperty('right');
      }
      
      if (originalBodyOverflow) {
        document.body.style.overflow = originalBodyOverflow;
      } else {
        document.body.style.removeProperty('overflow');
      }
      if (originalBodyOverflowX) {
        document.body.style.overflowX = originalBodyOverflowX;
      } else {
        document.body.style.removeProperty('overflow-x');
      }
      if (originalBodyTouchAction) {
        document.body.style.touchAction = originalBodyTouchAction;
      } else {
        document.body.style.removeProperty('touch-action');
      }
      if (originalBodyPosition) {
        document.body.style.position = originalBodyPosition;
      } else {
        document.body.style.removeProperty('position');
      }
      if (originalBodyWidth) {
        document.body.style.width = originalBodyWidth;
      } else {
        document.body.style.removeProperty('width');
      }
      if (originalBodyLeft) {
        document.body.style.left = originalBodyLeft;
      } else {
        document.body.style.removeProperty('left');
      }
      if (originalBodyRight) {
        document.body.style.right = originalBodyRight;
      } else {
        document.body.style.removeProperty('right');
      }
      
      // タッチイベントリスナーを削除
      if (modalContainerRef.current) {
        modalContainerRef.current.removeEventListener('touchstart', handleTouchStart);
        modalContainerRef.current.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    // バックドロップをクリックした場合のみ閉じる
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // ★追加: タッチイベントで横スクロールを防止（外側コンテナのみ）
  const handleTouchMoveReact = (e: React.TouchEvent) => {
    // 外側コンテナ（バックドロップ）でのタッチ移動を防止
    if (e.currentTarget === e.target) {
      e.preventDefault();
    }
  };

  return (
    <div 
      ref={modalContainerRef}
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      onTouchMove={handleTouchMoveReact}
      style={{ 
        touchAction: 'none',
        overflowX: 'hidden',
        overflowY: 'hidden',
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        position: 'fixed',
        transform: 'translateX(0)',
        willChange: 'transform',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div 
        className="relative w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-5 shadow-2xl border-t border-gray-700 flex flex-col max-h-[90vh]" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          touchAction: 'none',
          overflowX: 'hidden',
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '28rem',
          position: 'relative',
          transform: 'translateX(0)',
          boxSizing: 'border-box',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6 opacity-50 flex-shrink-0" />
        <div 
          ref={modalContentRef}
          className="overflow-y-auto custom-scrollbar flex-1 pb-safe" 
          style={{ 
            touchAction: 'pan-y',
            overflowX: 'hidden',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
