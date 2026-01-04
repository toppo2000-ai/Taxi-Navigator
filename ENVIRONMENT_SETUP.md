# 開発環境と本番環境の分離ガイド

## 現在の状況

現在、開発サーバー（`localhost:5173`）と本番環境（`pro-taxi-d3945.web.app`）の両方が同じFirebaseプロジェクト（`pro-taxi-d3945`）を使用しています。

**これは正常な動作です**が、開発中に本番データを誤って変更するリスクがあります。

## オプション1: 同じプロジェクトを使い続ける（現在の設定）

### メリット
- 設定が簡単
- 認証状態が共有される
- 開発と本番で同じデータ構造を確認できる

### デメリット
- 開発中に本番データを誤って変更する可能性
- テストデータが本番環境に混入する可能性

### 推奨事項
- 開発中は注意深く操作する
- 重要な操作の前にFirestore Consoleでデータを確認する

## オプション2: 環境変数で開発環境を分離する（推奨）

### 手順

1. **開発用Firebaseプロジェクトを作成**（オプション）
   - Firebase Consoleで新しいプロジェクトを作成
   - または、同じプロジェクト内でコレクション名を分ける

2. **環境変数ファイルを作成**

   `.env.development`（開発環境用）:
   ```
   VITE_FIREBASE_PROJECT_ID=pro-taxi-d3945-dev
   VITE_FIREBASE_API_KEY=your-dev-api-key
   VITE_FIREBASE_AUTH_DOMAIN=pro-taxi-d3945-dev.firebaseapp.com
   ```

   `.env.production`（本番環境用）:
   ```
   VITE_FIREBASE_PROJECT_ID=pro-taxi-d3945
   VITE_FIREBASE_API_KEY=AIzaSyA56mq9rGWxmLjvXZbXdJZpnYjXem4QHcY
   VITE_FIREBASE_AUTH_DOMAIN=pro-taxi-d3945.firebaseapp.com
   ```

3. **`services/firebase.ts`を修正**

   ```typescript
   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA56mq9rGWxmLjvXZbXdJZpnYjXem4QHcY",
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pro-taxi-d3945.firebaseapp.com",
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pro-taxi-d3945",
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pro-taxi-d3945.firebasestorage.app",
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "157292333890",
     appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:157292333890:web:bee77cf89d2bd8b2c016db"
   };
   ```

## オプション3: コレクション名で分離する

同じFirebaseプロジェクトを使い続けながら、コレクション名で開発環境と本番環境を分ける方法です。

### 手順

1. **`services/firebase.ts`に環境判定を追加**

   ```typescript
   const isDevelopment = import.meta.env.DEV;
   const collectionPrefix = isDevelopment ? 'dev_' : '';
   
   export const getCollectionName = (name: string) => {
     return collectionPrefix + name;
   };
   ```

2. **`App.tsx`でコレクション名を使用**

   ```typescript
   // 変更前
   doc(db, "users", targetUid)
   
   // 変更後
   doc(db, getCollectionName("users"), targetUid)
   ```

## 現在の動作について

**現在の設定（同じプロジェクトを使用）は正常です。** 以下の点に注意してください：

1. **開発中の注意事項**
   - テストデータの登録は慎重に行う
   - 本番環境のデータを誤って削除しないよう注意する
   - 重要な操作の前にFirestore Consoleで確認する

2. **データの確認方法**
   - Firebase Console → Firestore Database
   - `users`コレクションを確認
   - 必要に応じてデータを手動で削除

3. **開発と本番の切り替え**
   - 開発サーバー: `npm run dev` → `http://localhost:5173`
   - 本番環境: `npm run build` → `firebase deploy` → `https://pro-taxi-d3945.web.app/`

## 推奨事項

**小規模な開発や個人プロジェクトの場合**:
- 現在の設定（同じプロジェクト）で問題ありません
- 開発中は注意深く操作する

**チーム開発や本番データが重要な場合**:
- オプション2（環境変数で分離）を推奨
- 開発用のFirebaseプロジェクトを作成する
