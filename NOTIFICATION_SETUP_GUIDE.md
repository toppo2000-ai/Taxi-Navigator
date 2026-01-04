# 承認待ち通知機能 セットアップガイド

## 概要

新規ユーザーが承認待ち状態（`status: 'pending'`）になったときに、管理者へメール通知を自動送信する機能です。

## 前提条件

1. Firebase CLIがインストールされていること
2. Firebaseプロジェクトにログインしていること
3. SendGridアカウントがあること（無料プランで可）

## セットアップ手順

### 1. SendGridアカウントの作成とAPIキーの取得

1. [SendGrid](https://sendgrid.com/)にアクセスしてアカウントを作成（無料プランで可）
2. SendGridダッシュボード → Settings → API Keys
3. 「Create API Key」をクリック
4. API Key Nameを入力（例: "Firebase Functions"）
5. 「Full Access」または「Restricted Access」→「Mail Send」の権限を選択
6. 「Create & View」をクリック
7. **APIキーをコピー**（この後、再度表示できません）

### 2. SendGridで送信者メールアドレスの検証

1. SendGridダッシュボード → Settings → Sender Authentication
2. 「Single Sender Verification」を選択
3. 「Create Sender」をクリック
4. 送信者情報を入力：
   - From Email Address: 使用するメールアドレス（例: `noreply@yourdomain.com`）
   - From Name: 送信者名（例: "Taxi Navigator"）
   - Reply To: 返信先（任意）
5. メールアドレスを確認するためのメールが送信されます
6. メール内のリンクをクリックして確認

### 3. Firebase Functionsの環境変数にAPIキーを設定

以下のコマンドを実行して、SendGrid APIキーを設定します：

```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
```

**注意**: `YOUR_SENDGRID_API_KEY`を実際のAPIキーに置き換えてください。

### 4. 送信者メールアドレスの設定

`functions/src/index.ts`の`FROM_EMAIL`を、SendGridで検証済みのメールアドレスに変更してください：

```typescript
const FROM_EMAIL = 'noreply@yourdomain.com'; // SendGridで検証済みのメールアドレス
```

### 5. 管理者メールアドレスの確認

`functions/src/index.ts`の`ADMIN_EMAILS`配列に、通知を受け取る管理者のメールアドレスが含まれていることを確認してください：

```typescript
const ADMIN_EMAILS = [
  'toppo2000@gmail.com',
  'admin-user@gmail.com'
];
```

### 6. 依存関係のインストール

```bash
cd functions
npm install
```

### 7. ビルドとデプロイ

```bash
# ビルド
npm run build

# Firebase Functionsをデプロイ
firebase deploy --only functions
```

または、プロジェクトルートから：

```bash
firebase deploy --only functions
```

## 動作確認

1. テスト用の新規ユーザーでログイン
2. 管理者のメールアドレスに通知メールが届くことを確認
3. Firebase Console → Functions → Logs でログを確認

## トラブルシューティング

### メールが届かない場合

1. **SendGrid APIキーが正しく設定されているか確認**
   ```bash
   firebase functions:config:get
   ```

2. **送信者メールアドレスが検証済みか確認**
   - SendGridダッシュボード → Settings → Sender Authentication
   - Single Sender Verification のステータスを確認

3. **Firebase Functionsのログを確認**
   ```bash
   firebase functions:log
   ```

4. **スパムフォルダを確認**
   - 最初のメールはスパムフォルダに振り分けられることがあります

### エラーが発生する場合

- **"API key is invalid"**
  - SendGrid APIキーが正しく設定されているか確認
  - APIキーに「Mail Send」の権限があるか確認

- **"The from address does not match a verified Sender Identity"**
  - SendGridで送信者メールアドレスが検証済みか確認
  - `FROM_EMAIL`が検証済みのメールアドレスと一致しているか確認

## カスタマイズ

### メール本文の変更

`functions/src/index.ts`の`message`オブジェクト内の`html`と`text`を編集してください。

### 管理者メールアドレスの変更

`functions/src/index.ts`の`ADMIN_EMAILS`配列を編集してください。

## コスト

- **SendGrid**: 無料プランで1日100通まで送信可能
- **Firebase Cloud Functions**: 
  - 無料枠: 200万回/月の呼び出し
  - その後: $0.40/100万回の呼び出し

## 参考リンク

- [SendGrid公式サイト](https://sendgrid.com/)
- [SendGrid API ドキュメント](https://docs.sendgrid.com/)
- [Firebase Cloud Functions ドキュメント](https://firebase.google.com/docs/functions)
