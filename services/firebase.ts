/**
 * Firebase初期化（統一版）
 * すべてのFirebase関連のインポートはここから行う
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyA56mq9rGWxmLjvXZbXdJZpnYjXem4QHcY",
  authDomain: "pro-taxi-d3945.web.app", // web.appドメインに変更（成功プロジェクトと同じ設定）
  projectId: "pro-taxi-d3945",
  storageBucket: "pro-taxi-d3945.firebasestorage.app",
  messagingSenderId: "157292333890",
  appId: "1:157292333890:web:bee77cf89d2bd8b2c016db"
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// 認証、Google認証プロバイダー、Firestoreデータベースをエクスポート
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const db = getFirestore(app);
