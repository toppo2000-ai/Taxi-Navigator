/**
 * Firebase初期化（後方互換性のため、services/firebase.tsから再エクスポート）
 * 新しいコードでは services/firebase.ts を直接インポートしてください
 */
export { auth, googleProvider, db } from './services/firebase';
