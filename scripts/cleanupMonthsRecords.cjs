/**
 * monthsフィールド内のrecordsフィールドを削除するスクリプト
 * 
 * public_statusコレクションのmonthsフィールド内の各月からrecordsフィールドを削除し、
 * salesフィールドのみを保持します。詳細データはサブコレクションに移行されているため不要です。
 * 
 * 使用方法:
 * node scripts/cleanupMonthsRecords.cjs
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
 * monthsフィールド内のrecordsフィールドを削除
 */
async function cleanupMonthsRecords() {
  console.log('=== monthsフィールド内のrecordsフィールド削除を開始 ===\n');
  console.log('⚠️  注意: recordsフィールドを削除し、salesフィールドのみを保持します。\n');

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
      const months = data.months || {};

      if (Object.keys(months).length === 0) {
        console.log(`[${uid}] monthsフィールドが空のためスキップ`);
        totalSkipped++;
        continue;
      }

      try {
        // months内の各月からrecordsフィールドを削除
        const updatedMonths = {};
        let hasRecords = false;
        let recordsCount = 0;

        for (const [sortKey, monthData] of Object.entries(months)) {
          const month = monthData || {};
          if (month.records && Array.isArray(month.records)) {
            hasRecords = true;
            recordsCount += month.records.length;
            // recordsフィールドを除いてコピー
            const { records, ...monthWithoutRecords } = month;
            updatedMonths[sortKey] = monthWithoutRecords;
          } else {
            // recordsが存在しない場合はそのまま
            updatedMonths[sortKey] = month;
          }
        }

        if (!hasRecords) {
          console.log(`[${uid}] months内にrecordsフィールドが存在しないためスキップ`);
          totalSkipped++;
          continue;
        }

        console.log(`[${uid}] months内のrecordsフィールドを削除中... (${Object.keys(updatedMonths).length}ヶ月, ${recordsCount}件のレコード)`);

        // monthsフィールドを更新
        await db.collection('public_status').doc(uid).update({
          months: updatedMonths
        });

        totalCleaned++;
        console.log(`[${uid}] ✓ months内のrecordsフィールドを削除しました\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 削除エラー:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== クリーンアップ完了 ===');
    console.log(`削除件数: ${totalCleaned}件`);
    console.log(`スキップ件数: ${totalSkipped}件`);
    console.log(`エラー件数: ${totalErrors}件`);
    console.log('\n✓ months内のrecordsフィールドを削除し、salesフィールドのみを保持しました。');
    console.log('✓ 詳細データはサブコレクションから取得されます。');
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

rl.question('monthsフィールド内のrecordsフィールドをクリーンアップしますか？ (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    cleanupMonthsRecords();
  } else {
    console.log('操作をキャンセルしました。');
    rl.close();
    process.exit(0);
  }
});
