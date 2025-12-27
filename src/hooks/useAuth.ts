import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

export interface UserProfile {
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // ユーザープロファイルのリアルタイム監視
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
        setUserProfile(null);
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, isAuthChecking, userProfile };
};
