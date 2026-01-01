# Firestoreデータ削除ガイド

## ⚠️ 警告
この操作は**すべてのデータを削除**します。実行前に必ずバックアップを取ってください。

## 方法1: Firebaseコンソールから削除（推奨）

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト `pro-taxi-d3945` を選択
3. 左メニューから「Firestore Database」を選択
4. 削除したいコレクション（`users`、`public_status`など）を選択
5. 各ドキュメントを選択して削除、またはコレクション全体を削除

## 方法2: Firebase CLIから削除

### 必要な準備
1. Firebase CLIがインストールされていること
2. Firebaseにログインしていること

### 手順

```bash
# 1. Firebase CLIでログイン
firebase login

# 2. Firestoreエミュレータを使用して削除（本番環境のデータは削除されません）
# 注意: 本番環境のデータを削除するには、Firebase Admin SDKが必要です
```

## 方法3: Firebase Admin SDKを使用（上級者向け）

1. Firebase Console → プロジェクト設定 → サービスアカウント
2. 「新しい秘密鍵の生成」をクリックしてJSONファイルをダウンロード
3. ダウンロードしたJSONファイルを `serviceAccountKey.json` としてプロジェクトルートに配置
4. 以下のコマンドを実行:

```bash
npm install firebase-admin
node delete_firestore_data.js
```

## 方法4: 手動でコレクションを削除（Firebase Console）

### usersコレクションの削除
1. Firestore Database → `users`コレクションを開く
2. 各ドキュメントを選択して削除
3. または、コレクション全体を削除（可能な場合）

### public_statusコレクションの削除
1. Firestore Database → `public_status`コレクションを開く
2. 各ドキュメントを選択して削除

## 注意事項

- **データの復元はできません**。削除前に必ずバックアップを取ってください。
- 削除後、アプリケーションを再起動する必要がある場合があります。
- ユーザー認証情報（Firebase Authentication）は削除されません。認証情報も削除する場合は、Firebase Console → Authentication から削除してください。

## バックアップ方法

Firebase Consoleから手動でエクスポートするか、以下のコマンドでエクスポートできます:

```bash
gcloud firestore export gs://[BUCKET_NAME]
```
