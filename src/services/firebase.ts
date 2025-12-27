import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDPRfRZu_fzNKR2NCGYV-l5_g4KDT1iXzM",
  authDomain: "taxi-board-c3dd3.web.app",
  projectId: "taxi-board-c3dd3",
  storageBucket: "taxi-board-c3dd3.firebasestorage.app",
  messagingSenderId: "167779061604",
  appId: "1:167779061604:web:56ba226cea3b2f2f78f471"
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// 認証、Google認証プロバイダー、Firestoreデータベースをエクスポート
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);