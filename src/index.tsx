import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// アプリケーションをマウントするためのルート要素を取得
const rootElement = document.getElementById('root');
if (!rootElement) {
  // ルート要素が見つからない場合はエラーをスロー
  throw new Error("Could not find root element to mount to");
}

// Reactアプリケーションのルートを作成
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* アプリケーションのメインコンポーネントをレンダリング */}
    <App />
  </React.StrictMode>
);
