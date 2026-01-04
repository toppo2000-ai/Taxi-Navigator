import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1. メモ帳（.env.local）から情報を読み込む設定
const firebaseConfig = {
  // ここで「メモ帳」に書いた鍵を呼び出します
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: "pro-taxi-d3945.web.app",
  projectId: "pro-taxi-d3945",
  storageBucket: "pro-taxi-d3945.firebasestorage.app",
  messagingSenderId: "157292333890",
  appId: "1:157292333890:web:bee77cf89d2bd8b2c016db"
};

// 2. 鍵がちゃんと読み込めているか確認（ブラウザのF12で見れます）
console.log("読み込んだキーの確認:", import.meta.env.VITE_FIREBASE_API_KEY);

// 3. Firebaseアプリを初期化（ここを1回だけにしました）
const app = initializeApp(firebaseConfig);

// 4. 他のファイルでも使えるように貸し出す設定
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);