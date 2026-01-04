# 承認待ち通知機能の実装ガイド

新規参加者が承認待ち状態になったときに、管理者へメールまたはLINEで通知を送る機能を実装する方法を説明します。

## 実装方法の選択肢

### 方法1: Firebase Cloud Functions + SendGrid（メール通知）【推奨】

Firebase Cloud Functionsを使用して、`users`コレクションのドキュメントが作成され、`status`が`pending`になったときにトリガーを実行します。

#### 必要な準備

1. **Firebase CLIのインストール**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebaseプロジェクトにログイン**
   ```bash
   firebase login
   ```

3. **Cloud Functionsの初期化**
   ```bash
   firebase init functions
   ```
   - TypeScriptを選択
   - ESLintを使用するか選択
   - 依存関係のインストールを実行

4. **SendGridアカウントの作成とAPIキーの取得**
   - [SendGrid](https://sendgrid.com/)でアカウントを作成
   - APIキーを生成
   - Firebase Functionsの環境変数に設定:
     ```bash
     firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
     ```

#### 実装コード例

`functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

admin.initializeApp();
sgMail.setApiKey(functions.config().sendgrid.key);

// 管理者メールアドレス（実際の値に置き換えてください）
const ADMIN_EMAILS = [
  'toppo2000@gmail.com',
  'admin-user@gmail.com'
];

// usersコレクションのドキュメント作成/更新を監視
export const notifyAdminOnPendingUser = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    // statusが'pending'になった場合のみ通知
    if (newData?.status === 'pending' && oldData?.status !== 'pending') {
      const userId = context.params.userId;
      const userName = newData?.stats?.userName || newData?.displayName || newData?.email || '（未設定）';
      const userEmail = newData?.email || '（未設定）';

      const message = {
        to: ADMIN_EMAILS,
        from: 'noreply@yourdomain.com', // SendGridで検証済みの送信者メールアドレス
        subject: `【新規ユーザー承認待ち】${userName}さん`,
        html: `
          <h2>新規ユーザーが登録されました</h2>
          <p>以下のユーザーが承認待ち状態になっています。</p>
          <ul>
            <li><strong>ユーザー名:</strong> ${userName}</li>
            <li><strong>メールアドレス:</strong> ${userEmail}</li>
            <li><strong>ユーザーID:</strong> ${userId}</li>
          </ul>
          <p>管理画面から承認してください。</p>
        `,
      };

      try {
        await sgMail.send(message);
        console.log(`Notification sent to admins for user: ${userId}`);
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }
  });
```

#### デプロイ

```bash
firebase deploy --only functions
```

---

### 方法2: Firebase Cloud Functions + LINE Notify（LINE通知）

LINE Notifyを使用して、LINEで通知を送る方法です。

#### 必要な準備

1. **LINE Notifyのトークン取得**
   - [LINE Notify](https://notify-bot.line.me/)にログイン
   - トークンを発行
   - Firebase Functionsの環境変数に設定:
     ```bash
     firebase functions:config:set line.notify_token="YOUR_LINE_NOTIFY_TOKEN"
     ```

#### 実装コード例

`functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as axios from 'axios';

admin.initializeApp();

const LINE_NOTIFY_TOKEN = functions.config().line.notify_token;
const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

export const notifyAdminOnPendingUser = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    if (newData?.status === 'pending' && oldData?.status !== 'pending') {
      const userId = context.params.userId;
      const userName = newData?.stats?.userName || newData?.displayName || newData?.email || '（未設定）';
      const userEmail = newData?.email || '（未設定）';

      const message = `
【新規ユーザー承認待ち】

ユーザー名: ${userName}
メールアドレス: ${userEmail}
ユーザーID: ${userId}

管理画面から承認してください。
      `;

      try {
        await axios.post(
          LINE_NOTIFY_API,
          { message },
          {
            headers: {
              'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        console.log(`LINE notification sent for user: ${userId}`);
      } catch (error) {
        console.error('Error sending LINE notification:', error);
      }
    }
  });
```

---

### 方法3: Firebase Cloud Functions + Slack（Slack通知）

SlackのIncoming Webhookを使用して通知を送る方法です。

#### 必要な準備

1. **SlackのIncoming Webhook URL取得**
   - Slackのワークスペース設定からIncoming Webhooksを有効化
   - Webhook URLを生成
   - Firebase Functionsの環境変数に設定:
     ```bash
     firebase functions:config:set slack.webhook_url="YOUR_SLACK_WEBHOOK_URL"
     ```

#### 実装コード例

`functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as axios from 'axios';

admin.initializeApp();

const SLACK_WEBHOOK_URL = functions.config().slack.webhook_url;

export const notifyAdminOnPendingUser = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    if (newData?.status === 'pending' && oldData?.status !== 'pending') {
      const userId = context.params.userId;
      const userName = newData?.stats?.userName || newData?.displayName || newData?.email || '（未設定）';
      const userEmail = newData?.email || '（未設定）';

      const payload = {
        text: '新規ユーザー承認待ち',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '新規ユーザー承認待ち',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*ユーザー名:*\n${userName}`,
              },
              {
                type: 'mrkdwn',
                text: `*メールアドレス:*\n${userEmail}`,
              },
              {
                type: 'mrkdwn',
                text: `*ユーザーID:*\n${userId}`,
              },
            ],
          },
        ],
      };

      try {
        await axios.post(SLACK_WEBHOOK_URL, payload);
        console.log(`Slack notification sent for user: ${userId}`);
      } catch (error) {
        console.error('Error sending Slack notification:', error);
      }
    }
  });
```

---

## 必要な依存関係

### SendGrid使用時

```bash
cd functions
npm install @sendgrid/mail
```

### LINE Notify使用時

```bash
cd functions
npm install axios
```

### Slack使用時

```bash
cd functions
npm install axios
```

---

## 注意事項

1. **コスト**: Firebase Cloud Functionsには実行回数と実行時間に応じた課金があります。無料枠もありますが、使用量に注意してください。

2. **セキュリティ**: APIキーやトークンは環境変数に保存し、コードに直接記述しないでください。

3. **エラーハンドリング**: ネットワークエラーやAPIエラーが発生した場合の処理を適切に実装してください。

4. **Firestoreセキュリティルール**: Cloud Functionsは管理者権限で実行されるため、セキュリティルールをバイパスします。

---

## 次のステップ

1. 上記の方法から1つ選択して実装
2. Firebase Functionsをデプロイ
3. テストユーザーを作成して通知が送信されることを確認
4. 必要に応じて通知内容をカスタマイズ
