import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
}

export const useAuth = () => {
  const [user, setUser] = useState<User | any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  const logout = async () => {
    await auth.signOut();
    localStorage.removeItem('taxi_navigator_guest_data');
    setUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
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
