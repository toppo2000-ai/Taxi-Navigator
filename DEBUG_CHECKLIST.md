# 本番環境での登録問題 デバッグチェックリスト

## 🔍 確認すべき項目

### 1. ブラウザの開発者ツールで確認

#### コンソールタブ
- [ ] エラーメッセージを確認（特に403エラー）
- [ ] `[handleSaveInitialName]` のログを確認
- [ ] `[saveToDB]` のログを確認
- [ ] エラーの詳細（`code`, `message`）を確認

#### ネットワークタブ
- [ ] `users/{userId}` へのリクエストを確認
- [ ] リクエストのステータスコードを確認（200, 403, 500など）
- [ ] リクエストのペイロードを確認
- [ ] レスポンスの内容を確認

### 2. Firebase Consoleで確認

#### Firestore Database
- [ ] `users`コレクションにドキュメントが作成されているか
- [ ] ドキュメントIDが正しいか（ユーザーのUIDと一致するか）
- [ ] `stats.userName`フィールドが正しく保存されているか

#### Firestore Rules（セキュリティルール）
- [ ] セキュリティルールが正しく設定されているか
- [ ] `users/{userId}` の書き込みルールを確認
- [ ] テストモードになっていないか（本番環境では適切なルールが必要）

### 3. コードレベルの確認

#### エラーハンドリング
- [ ] `handleSaveInitialName`関数が正しく呼ばれているか
- [ ] `saveToDB`関数でエラーが適切に処理されているか
- [ ] エラーメッセージがユーザーに表示されているか

#### 認証状態
- [ ] ユーザーが正しく認証されているか
- [ ] `user.uid`が正しく取得できているか
- [ ] `targetUid`が正しく設定されているか

## 🛠️ トラブルシューティング手順

### ステップ1: コンソールログを確認
1. ブラウザの開発者ツール（F12）を開く
2. コンソールタブを選択
3. 「登録」ボタンをクリック
4. 表示されるログを確認

### ステップ2: ネットワークリクエストを確認
1. 開発者ツールのネットワークタブを開く
2. 「登録」ボタンをクリック
3. `users` へのリクエストを探す
4. リクエストの詳細を確認

### ステップ3: Firebase Consoleで確認
1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト `pro-taxi-d3945` を選択
3. Firestore Databaseを開く
4. `users`コレクションを確認

### ステップ4: セキュリティルールを確認
1. Firebase Console → Firestore Database → ルールタブ
2. 現在のルールを確認
3. 必要に応じて `firestore.rules` の内容をデプロイ

## 🔧 よくある問題と解決方法

### 問題1: 403エラー（権限エラー）
**原因**: Firestoreのセキュリティルールが厳しすぎる

**解決方法**:
1. Firebase Console → Firestore Database → ルール
2. `firestore.rules` の内容をコピーしてデプロイ
3. または、一時的にテストモードに設定（本番環境では非推奨）

### 問題2: ネットワークエラー
**原因**: インターネット接続の問題、またはFirebaseの設定ミス

**解決方法**:
1. インターネット接続を確認
2. Firebase設定（`services/firebase.ts`）を確認
3. ブラウザのキャッシュをクリア

### 問題3: データが保存されない（エラーなし）
**原因**: エラーハンドリングが不十分、または状態更新の問題

**解決方法**:
1. `handleSaveInitialName`関数のログを確認
2. `saveToDB`関数のログを確認
3. Firestore Consoleで実際にデータが保存されているか確認

## 📝 デバッグ用コード追加

以下のコードを `handleSaveInitialName` 関数に追加して、詳細なログを取得できます:

```typescript
console.log('[DEBUG] handleSaveInitialName called');
console.log('[DEBUG] tempUserName:', tempUserName);
console.log('[DEBUG] user:', user?.uid);
console.log('[DEBUG] targetUid:', targetUid);
console.log('[DEBUG] monthlyStats:', monthlyStats);
```

## 🚀 セキュリティルールのデプロイ

```bash
# Firestoreルールをデプロイ
firebase deploy --only firestore:rules
```
