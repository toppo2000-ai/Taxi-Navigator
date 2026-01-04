import React from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../../services/firebase';
import naviChibiImage from '../../assets/navi-chibi.png';

interface LoginScreenProps {
  onLoginStart?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginStart }) => {
  const handleLogin = async () => {
    try {
      if (onLoginStart) onLoginStart();
      console.log('Login button clicked');
      
      // ★モバイル環境を検出
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      
      // モバイル環境またはスタンドアロンモードの場合は、最初からリダイレクト方式を使用
      if (isMobile || isStandalone) {
        console.log('Mobile/Standalone detected, using redirect method');
        // ★重要: 現在のURL（パラメータ含む）を保存（リダイレクト後に戻るため）
        if (typeof window !== 'undefined') {
          const currentUrl = window.location.href;
          const hostname = window.location.hostname;
          const port = window.location.port || '';
          const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
          
          console.log('[Login] Saving redirect info (mobile):', { 
            currentUrl, 
            hostname, 
            port, 
            origin 
          });
          
          // localStorageとsessionStorageの両方に保存（モバイルでsessionStorageが制限される場合があるため）
          try {
            // 現在のURL全体を保存（パラメータ含む）
            localStorage.setItem('login_redirect_url', currentUrl);
            localStorage.setItem('auth_redirect_origin', origin);
            localStorage.setItem('auth_redirect_hostname', hostname);
            if (port) {
              localStorage.setItem('auth_redirect_port', port);
            }
            // ログイン試行の記録
            localStorage.setItem('auth_login_attempt', new Date().toISOString());
            console.log('[Login] Successfully saved redirect info to localStorage');
          } catch (e) {
            console.error('[Login] Failed to save redirect info to localStorage:', e);
            alert('ローカルストレージへの保存に失敗しました。プライベートブラウジングモードを無効にしてください。');
          }
          // sessionStorageも試行（利用可能な場合のみ）
          try {
            sessionStorage.setItem('login_redirect_url', currentUrl);
            sessionStorage.setItem('auth_redirect_origin', origin);
            sessionStorage.setItem('auth_redirect_hostname', hostname);
            if (port) {
              sessionStorage.setItem('auth_redirect_port', port);
            }
            console.log('[Login] Successfully saved redirect info to sessionStorage');
          } catch (e) {
            console.warn('[Login] sessionStorage not available (this is normal on some mobile browsers):', e);
          }
        }
        console.log('[Login] Calling signInWithRedirect...');
        console.log('[Login] Current URL before redirect:', window.location.href);
        console.log('[Login] Auth domain:', auth.config.authDomain);
        console.log('[Login] Google provider:', googleProvider);
        
        // リダイレクト前に最終確認
        const savedOrigin = localStorage.getItem('auth_redirect_origin');
        console.log('[Login] Saved redirect origin:', savedOrigin);
        
        try {
          // signInWithRedirectは非同期だが、リダイレクトが発生するとこのコードは実行されない
          const redirectPromise = signInWithRedirect(auth, googleProvider);
          console.log('[Login] signInWithRedirect called, waiting for redirect...');
          
          // リダイレクトが発生しない場合のタイムアウト（5秒）
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Redirect timeout: signInWithRedirect did not redirect within 5 seconds'));
            }, 5000);
          });
          
          await Promise.race([redirectPromise, timeoutPromise]);
          
          // ここに到達した場合はリダイレクトが発生しなかった
          console.warn('[Login] ⚠️ signInWithRedirect completed without redirect');
          alert('リダイレクトが発生しませんでした。ページをリロードして再度お試しください。');
        } catch (redirectError: any) {
          console.error('[Login] ❌ signInWithRedirect error:', redirectError);
          console.error('[Login] Error code:', redirectError?.code);
          console.error('[Login] Error message:', redirectError?.message);
          console.error('[Login] Error stack:', redirectError?.stack);
          
          // エラーの種類に応じて適切なメッセージを表示
          let errorMessage = 'ログインリダイレクトエラーが発生しました。\n\n';
          if (redirectError?.code === 'auth/unauthorized-domain') {
            errorMessage += 'エラー: 承認済みドメインが設定されていません。\nFirebase Consoleで承認済みドメインを確認してください。';
          } else if (redirectError?.code === 'auth/operation-not-allowed') {
            errorMessage += 'エラー: Google認証が有効になっていません。\nFirebase ConsoleでGoogle認証を有効にしてください。';
          } else if (redirectError?.message?.includes('timeout')) {
            errorMessage += 'エラー: リダイレクトがタイムアウトしました。\nページをリロードして再度お試しください。';
          } else {
            errorMessage += `エラーコード: ${redirectError?.code || 'unknown'}\nエラーメッセージ: ${redirectError?.message || 'Unknown error'}`;
          }
          
          alert(errorMessage + '\n\n詳細はブラウザのコンソールを確認してください。');
        }
        return;
      }
      
      // デスクトップ環境ではポップアップ方式を試行
      console.log('Desktop detected, trying popup method');
      // 現在のホスト名、ポート番号を保存（リダイレクト後に戻るため、フォールバック用）
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const port = window.location.port || '5173';
        const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
        
        localStorage.setItem('local_dev_hostname', hostname);
        localStorage.setItem('local_dev_port', port);
        localStorage.setItem('local_dev_origin', origin);
        try {
          sessionStorage.setItem('local_dev_hostname', hostname);
          sessionStorage.setItem('local_dev_port', port);
          sessionStorage.setItem('local_dev_origin', origin);
        } catch (e) {
          console.warn('sessionStorage not available:', e);
        }
      }
      
      await signInWithPopup(auth, googleProvider);
      console.log('Login successful');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // エラーコードに基づいて適切なメッセージを表示
      if (error?.code === 'auth/popup-blocked') {
        const useRedirect = confirm(
          'ポップアップがブロックされています。\n\n' +
          'リダイレクト方式でログインしますか？\n\n' +
          '（リダイレクト方式では、Firebaseの認証ページに移動してから戻ってきます）'
        );
        
        if (useRedirect) {
          try {
            // リダイレクト方式にフォールバック
            if (typeof window !== 'undefined') {
              const hostname = window.location.hostname;
              const port = window.location.port || '';
              const origin = `${window.location.protocol}//${hostname}${port ? ':' + port : ''}`;
              
              console.log('[Login] Saving redirect info (fallback):', { hostname, port, origin });
              
              localStorage.setItem('auth_redirect_origin', origin);
              localStorage.setItem('auth_redirect_hostname', hostname);
              if (port) {
                localStorage.setItem('auth_redirect_port', port);
              }
              try {
                sessionStorage.setItem('auth_redirect_origin', origin);
                sessionStorage.setItem('auth_redirect_hostname', hostname);
                if (port) {
                  sessionStorage.setItem('auth_redirect_port', port);
                }
              } catch (e) {
                console.warn('sessionStorage not available:', e);
              }
            }
            await signInWithRedirect(auth, googleProvider);
            // リダイレクト後はこのコードは実行されない
            return;
          } catch (redirectError) {
            console.error('Redirect login error:', redirectError);
            alert('リダイレクトログインにも失敗しました。ページをリロードして再度お試しください。');
          }
        }
      } else if (error?.code === 'auth/popup-closed-by-user') {
        console.log('User closed popup');
        // ユーザーが閉じた場合は何もしない
      } else if (error?.code === 'auth/cancelled-popup-request') {
        console.log('Popup request cancelled');
        // 複数のポップアップリクエストが同時に発生した場合
      } else {
        const errorMessage = error?.message || '不明なエラー';
        alert(`ログインエラー: ${errorMessage}\n\nエラーコード: ${error?.code || 'unknown'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      
      {/* 背景装飾 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        
        {/* キャラクター画像 */}
        <div className="relative w-64 h-64 animate-bounce-slow">
          <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full"></div>
          <img 
            src={naviChibiImage} 
            alt="Navi Chibi" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          />
        </div>

        {/* タイトルロゴ */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-200 to-amber-500 tracking-tighter filter drop-shadow-lg">
            TAXI-NAVIGATOR
          </h1>
          <p className="text-gray-500 text-xs font-bold tracking-[0.5em] uppercase">System Login</p>
        </div>

        {/* 豪華なログインボタン */}
        <button 
          type="button"
          onClick={handleLogin}
          className="group relative w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 transition-all duration-300 overflow-hidden cursor-pointer z-10"
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
};
