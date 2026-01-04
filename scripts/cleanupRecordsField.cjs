/**
 * recordsフィールドのクリーンアップスクリプト
 * 
 * public_statusコレクションのrecordsフィールドを削除します。
 * このフィールドは次回のbroadcastStatus実行時に現在のシフトレコードで自動的に再作成されます。
 * 
 * 使用方法:
 * node scripts/cleanupRecordsField.cjs
 * 
 * 注意: Firebase Admin SDKが必要です
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const readline = require('readline');

// Firebase Admin SDKを初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * recordsフィールドをクリーンアップ
 */
async function cleanupRecordsField() {
  console.log('=== recordsフィールドのクリーンアップを開始 ===\n');
  console.log('⚠️  注意: recordsフィールドは次回のbroadcastStatus実行時に自動的に再作成されます。\n');

  try {
    // public_statusコレクションの全ドキュメントを取得
    const publicStatusSnapshot = await db.collection('public_status').get();
    console.log(`public_status: ${publicStatusSnapshot.size}件のドキュメントを処理します\n`);

    let totalCleaned = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    for (const docSnap of publicStatusSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const records = data.records || [];

      if (records.length === 0) {
        console.log(`[${uid}] recordsフィールドが空のためスキップ`);
        totalSkipped++;
        continue;
      }

      try {
        console.log(`[${uid}] recordsフィールドを削除中... (${records.length}件のレコード)`);

        // recordsフィールドを削除
        await db.collection('public_status').doc(uid).update({
          records: admin.firestore.FieldValue.delete()
        });

        totalCleaned++;
        console.log(`[${uid}] ✓ recordsフィールドを削除しました\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 削除エラー:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== クリーンアップ完了 ===');
    console.log(`削除件数: ${totalCleaned}件`);
    console.log(`スキップ件数: ${totalSkipped}件`);
    console.log(`エラー件数: ${totalErrors}件`);
    console.log('\n✓ recordsフィールドは次回のbroadcastStatus実行時に自動的に再作成されます。');
  } catch (error) {
    console.error('クリーンアップ中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

// 確認プロンプト
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('recordsフィールドをクリーンアップしますか？ (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    cleanupRecordsField();
  } else {
    console.log('操作をキャンセルしました。');
    rl.close();
    process.exit(0);
  }
});
