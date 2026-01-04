import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// @ts-ignore - @sendgrid/mail uses CommonJS exports
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// SendGrid APIキーを環境変数から取得
const sendgridApiKey = functions.config().sendgrid?.key;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('SendGrid API key not configured. Email notifications will not work.');
}

// 管理者メールアドレスリスト（core/constants.tsと同期させる）
const ADMIN_EMAILS = [
  'toppo2000@gmail.com',
  'admin-user@gmail.com'
];

// SendGridで検証済みの送信者メールアドレス（実際のメールアドレスに置き換えてください）
const FROM_EMAIL = 'toppo2000@gmail.com';

/**
 * 新規ユーザーが承認待ち状態になったときに管理者へメール通知を送信
 */
export const notifyAdminOnPendingUser = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    // statusが'pending'になった場合のみ通知（新規作成時または他のステータスからpendingに変更された場合）
    const isNewPendingUser = newData?.status === 'pending' && oldData?.status !== 'pending';
    
    if (!isNewPendingUser) {
      console.log(`User ${context.params.userId} status is not pending or was already pending. Skipping notification.`);
      return null;
    }

    const userId = context.params.userId;
    const userName = newData?.stats?.userName || newData?.displayName || newData?.email || '（未設定）';
    const userEmail = newData?.email || '（未設定）';

    // SendGrid APIキーが設定されていない場合はスキップ
    if (!sendgridApiKey) {
      console.warn('SendGrid API key not configured. Skipping email notification.');
      return null;
    }

    const message = {
      to: ADMIN_EMAILS,
      from: FROM_EMAIL,
      subject: `【新規ユーザー承認待ち】${userName}さん`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">新規ユーザーが登録されました</h2>
          <p>以下のユーザーが承認待ち状態になっています。</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px;">ユーザー名:</td>
                <td style="padding: 8px 0;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">メールアドレス:</td>
                <td style="padding: 8px 0;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">ユーザーID:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${userId}</td>
              </tr>
            </table>
          </div>
          <p style="margin-top: 20px;">
            <a href="https://pro-taxi-d3945.web.app" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              管理画面を開く
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            このメールは自動送信されています。返信はできません。
          </p>
        </div>
      `,
      text: `
新規ユーザー承認待ち

以下のユーザーが承認待ち状態になっています。

ユーザー名: ${userName}
メールアドレス: ${userEmail}
ユーザーID: ${userId}

管理画面から承認してください。
https://pro-taxi-d3945.web.app
      `.trim(),
    };

    try {
      await sgMail.send(message);
      console.log(`✅ Notification sent to admins for user: ${userId} (${userName})`);
      return null;
    } catch (error: any) {
      console.error('❌ Error sending email notification:', error);
      if (error.response) {
        console.error('Error response body:', error.response.body);
      }
      // エラーが発生しても処理は続行（通知失敗は致命的ではない）
      return null;
    }
  });
