// 未認可ページコンポーネント - ユーザー認可待ちの表示
import React from 'react';
import { LogOut, ShieldAlert, MessageCircle, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function UnauthorizedView() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#0A0E14] text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-[#1A222C] max-w-md w-full p-8 rounded-2xl shadow-2xl text-center border border-gray-800 relative overflow-hidden">
        
        {/* 背景の装飾 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600"></div>

        <div className="flex justify-center mb-6">
          <div className="p-4 bg-yellow-500/10 rounded-full animate-pulse">
            <ShieldAlert className="w-12 h-12 text-yellow-500" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-4 text-white tracking-wide">Taxi Navigatorへ<br />参加希望ありがとう<br />ございます。</h1>
        
        <div className="text-gray-400 mb-6 leading-relaxed text-sm">
          <p className="mb-4">
            現在、管理者の承認待ち状態です。<br />連絡が来るまで暫くお待ち下さい。
          </p>

          {/* 参加者限定の注意書き */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-2 border border-gray-700">
            <p className="text-white font-bold text-sm">
              ※このアプリは<br />
              <span className="text-yellow-400">下記オープンチャット参加者のみ</span><br />
              ご利用可能です。
            </p>
          </div>
        </div>

        {/* --- セクション1：オープンチャット誘導 --- */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2">まだグループに参加されていない方</p>
          <a
            href="https://line.me/ti/g2/ZWvOSsjSGjcax8BIDbFpZyqxTJyeV5PbSrv8XA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-3 w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] rounded-xl transition-all duration-200 text-white shadow-lg shadow-green-900/20 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <MessageCircle className="w-5 h-5 flex-shrink-0 fill-white/20" />
            <div className="flex flex-col items-start text-left leading-tight z-10">
              <span className="text-[10px] font-bold opacity-90">承認依頼はこちらから</span>
              <span className="text-sm font-bold">大阪タクドラ情報交換グループ</span>
            </div>
          </a>
        </div>

        {/* --- 区切り線 --- */}
        <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-gray-500">または</span>
            <div className="flex-grow border-t border-gray-700"></div>
        </div>

        {/* --- セクション2：管理者直通 --- */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 mb-2">既に参加済みの方はこちら</p>
          <a
            href="https://line.me/ti/p/R6x26rZ-xn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-xl transition-all duration-200 active:scale-95"
          >
            <User className="w-4 h-4" />
            <span className="text-sm font-bold">管理者に直接連絡する</span>
          </a>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors font-medium text-gray-400 border border-gray-700 hover:text-white text-sm"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </div>
  );
}