import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

// ユーザープロファイルのインターフェース
export interface UserProfile {
  role: 'admin' | 'user'; // ユーザーの役割
  status: 'active' | 'pending' | 'banned'; // ユーザーのステータス
}

// 認証とユーザープロファイル情報を管理するカスタムフック
export const useAuth = () => {
  const [user, setUser] = useState<User | any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // ゲストモードでログイン (開発環境のみ)
  const loginAsGuest = () => {
    if (!import.meta.env.DEV) {
      console.warn('Guest login is only available in development mode.');
      return;
    }
    const existingData = localStorage.getItem('taxi_navigator_guest_data');
    const guestData = existingData ? JSON.parse(existingData) : { 
      uid: 'guest-user', 
      email: 'guest@example.com', 
      displayName: 'Guest User',
      isGuest: true,
      stats: { userName: 'ゲストユーザー' }
    };
    localStorage.setItem('taxi_navigator_guest_data', JSON.stringify(guestData));
    setUser(guestData);
    setUserProfile({ role: 'user', status: 'active' });
  };

  // ログアウト処理
  const logout = async () => {
    await auth.signOut();
    localStorage.removeItem('taxi_navigator_guest_data');
    setUser(null);
    setUserProfile(null);
  };

  // 認証状態とユーザープロファイルの監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // ユーザープロファイルのリアルタイム監視を開始
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
          setIsAuthChecking(false);
        });
        return () => unsubProfile();
      } else {
        // ゲストデータがあれば復元
        const guestData = localStorage.getItem('taxi_navigator_guest_data');
        if (guestData) {
          setUser(JSON.parse(guestData));
          setUserProfile({ role: 'user', status: 'active' });
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, isAuthChecking, userProfile, loginAsGuest, logout };
};
