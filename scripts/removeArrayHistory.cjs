/**
 * Phase 5: 配列形式のhistoryフィールドを削除するスクリプト
 * 
 * 注意: このスクリプトは移行完了後に実行してください
 * 実行前に以下を確認してください:
 * 1. すべてのユーザーのデータがサブコレクションに正しく移行されているか
 * 2. サブコレクションからデータが正しく読み込めるか
 * 3. バックアップを取得しているか
 * 
 * 使用方法:
 * node scripts/removeArrayHistory.cjs
 * 
 * 注意: Firebase Admin SDKが必要です
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Firebase Admin SDKの認証情報
const readline = require('readline');

// Firebase Admin SDKを初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * 配列形式のhistoryフィールドを削除
 */
async function removeArrayHistory() {
  console.log('=== 配列形式のhistoryフィールド削除を開始 ===\n');
  console.log('⚠️  警告: この操作は元に戻せません。バックアップを取得していることを確認してください。\n');

  try {
    // public_statusコレクションの全ドキュメントを取得
    const publicStatusSnapshot = await db.collection('public_status').get();
    console.log(`public_status: ${publicStatusSnapshot.size}件のドキュメントを処理します\n`);

    let totalRemoved = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    for (const docSnap of publicStatusSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        console.log(`[${uid}] historyが空のためスキップ`);
        totalSkipped++;
        continue;
      }

      try {
        // サブコレクションにデータが存在するか確認
        const subcollectionRef = db.collection('public_status').doc(uid).collection('history');
        const subcollectionSnapshot = await subcollectionRef.get();

        if (subcollectionSnapshot.empty) {
          console.warn(`[${uid}] ⚠️  サブコレクションにデータがありません。スキップします。`);
          totalSkipped++;
          continue;
        }

        const subcollectionCount = subcollectionSnapshot.size;
        const arrayCount = history.length;

        if (subcollectionCount < arrayCount * 0.9) {
          // サブコレクションのデータ数が配列の90%未満の場合は警告
          console.warn(`[${uid}] ⚠️  サブコレクションのデータ数(${subcollectionCount})が配列のデータ数(${arrayCount})より少ないです。スキップします。`);
          totalSkipped++;
          continue;
        }

        console.log(`[${uid}] 配列形式のhistoryを削除中... (配列: ${arrayCount}件, サブコレクション: ${subcollectionCount}件)`);

        // historyフィールドを削除（updateDocでFieldValue.delete()を使用）
        await db.collection('public_status').doc(uid).update({
          history: admin.firestore.FieldValue.delete()
        });

        totalRemoved++;
        console.log(`[${uid}] ✓ 配列形式のhistoryを削除しました\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 削除エラー:`, error.message);
        totalErrors++;
      }
    }

    // usersコレクションの全ドキュメントを取得
    const usersSnapshot = await db.collection('users').get();
    console.log(`\nusers: ${usersSnapshot.size}件のドキュメントを処理します\n`);

    for (const docSnap of usersSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        console.log(`[${uid}] historyが空のためスキップ`);
        totalSkipped++;
        continue;
      }

      try {
        // サブコレクションにデータが存在するか確認
        const subcollectionRef = db.collection('users').doc(uid).collection('history');
        const subcollectionSnapshot = await subcollectionRef.get();

        if (subcollectionSnapshot.empty) {
          console.warn(`[${uid}] ⚠️  サブコレクションにデータがありません。スキップします。`);
          totalSkipped++;
          continue;
        }

        const subcollectionCount = subcollectionSnapshot.size;
        const arrayCount = history.length;

        if (subcollectionCount < arrayCount * 0.9) {
          // サブコレクションのデータ数が配列の90%未満の場合は警告
          console.warn(`[${uid}] ⚠️  サブコレクションのデータ数(${subcollectionCount})が配列のデータ数(${arrayCount})より少ないです。スキップします。`);
          totalSkipped++;
          continue;
        }

        console.log(`[${uid}] 配列形式のhistoryを削除中... (配列: ${arrayCount}件, サブコレクション: ${subcollectionCount}件)`);

        // historyフィールドを削除
        await db.collection('users').doc(uid).update({
          history: admin.firestore.FieldValue.delete(),
          records: admin.firestore.FieldValue.delete() // recordsフィールドも削除（historyと同じ内容）
        });

        totalRemoved++;
        console.log(`[${uid}] ✓ 配列形式のhistoryを削除しました\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 削除エラー:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== 削除完了 ===');
    console.log(`削除件数: ${totalRemoved}件`);
    console.log(`スキップ件数: ${totalSkipped}件`);
    console.log(`エラー件数: ${totalErrors}件`);
    console.log('\n⚠️  注意: アプリケーションのコードで配列形式へのフォールバック処理を削除することを推奨します。');
  } catch (error) {
    console.error('削除中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

// 確認プロンプト
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('この操作は元に戻せません。続行しますか？ (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    removeArrayHistory();
  } else {
    console.log('操作をキャンセルしました。');
    rl.close();
    process.exit(0);
  }
});
