import React, { useState } from 'react';
import { Loader2, Car, User as UserIcon, ArrowRight } from 'lucide-react';
import { signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/services/firebase';
import naviLoadingImage from '@/assets/navi-loading.png';
import naviChibiImage from '@/assets/navi-chibi.png';

export const SplashScreen: React.FC = () => (
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

export const LoginScreen: React.FC<{ onGuestLogin: () => void }> = ({ onGuestLogin }) => (
  <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="relative w-64 h-64 animate-bounce-slow">
          <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full"></div>
          <img 
            src={naviChibiImage} 
            alt="Navi Chibi" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-200 to-amber-500 tracking-tighter filter drop-shadow-lg">
            TAXI-NAVIGATOR
          </h1>
          <p className="text-gray-500 text-xs font-bold tracking-[0.5em] uppercase">System Login</p>
        </div>

        <div className="w-full space-y-4">
          <button 
            onClick={() => signInWithPopup(auth, googleProvider).catch(() => signInWithRedirect(auth, googleProvider))} 
            className="group relative w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shine" />
            <div className="flex items-center justify-center gap-3 relative z-10">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
              <span>Googleでログイン</span>
            </div>
          </button>

          {import.meta.env.DEV && (
            <button 
              onClick={onGuestLogin}
              className="w-full bg-gray-800/50 border border-gray-700 text-gray-300 px-8 py-3 rounded-2xl font-bold text-sm hover:bg-gray-800 transition-all active:scale-95"
            >
              ゲストモードで試す (開発用)
            </button>
          )}
        </div>
        
        <p className="text-[10px] text-gray-600 font-bold">
          © 2025 Taxi Navigator System
        </p>
      </div>
      <style>{`
        @keyframes shine {
          100% { transform: translateX(200%); }
        }
        .animate-shine {
          animation: shine 1s;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
      `}</style>
  </div>
);

export const OnboardingScreen: React.FC<{ onSave: (name: string) => Promise<void> }> = ({ onSave }) => {
  const [tempUserName, setTempUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const handleSave = async () => {
    setIsSavingName(true);
    await onSave(tempUserName);
    setIsSavingName(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-700">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="bg-amber-500/10 w-20 h-20 rounded-3xl border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Car size={40} className="text-amber-500" />
          </div>
          <h2 className="text-3xl font-black italic text-white tracking-tighter">WELCOME</h2>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">登録を完了しましょう</p>
        </div>

        <div className="bg-[#1A222C] p-6 rounded-[32px] border border-gray-800 shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">担当者名を入力してください</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-600">
                <UserIcon size={18} />
              </div>
              <input 
                type="text"
                placeholder="例: 山田 太郎"
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          <button 
            disabled={!tempUserName.trim() || isSavingName}
            onClick={handleSave}
            className="w-full bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600 text-black py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSavingName ? <Loader2 className="animate-spin" size={20} /> : <>利用を開始する <ArrowRight size={20} /></>}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-600 font-bold px-8">※名前は後から「設定」より変更可能です。</p>
      </div>
    </div>
  );
};