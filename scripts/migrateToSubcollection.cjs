/**
 * Phase 3: 既存データをサブコレクションに移行するスクリプト
 * 
 * 使用方法:
 * node scripts/migrateToSubcollection.cjs
 * 
 * 注意: Firebase Admin SDKが必要です
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Firebase Admin SDKの認証情報

// Firebase Admin SDKを初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * 配列形式のhistoryをサブコレクションに移行
 */
async function migrateHistoryToSubcollection() {
  console.log('=== サブコレクションへの移行を開始 ===\n');

  try {
    // public_statusコレクションの全ドキュメントを取得
    const publicStatusSnapshot = await db.collection('public_status').get();
    console.log(`public_status: ${publicStatusSnapshot.size}件のドキュメントを処理します\n`);

    let totalMigrated = 0;
    let totalErrors = 0;

    for (const docSnap of publicStatusSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        console.log(`[${uid}] historyが空のためスキップ`);
        continue;
      }

      try {
        console.log(`[${uid}] ${history.length}件のレコードを移行中...`);

        // 既存のサブコレクションデータを確認（移行済みのレコードをスキップ）
        const existingSubcollectionSnapshot = await db.collection('public_status').doc(uid).collection('history').get();
        const existingRecordIds = new Set(existingSubcollectionSnapshot.docs.map(doc => doc.id));
        console.log(`[${uid}] 既存のサブコレクションデータ: ${existingRecordIds.size}件`);

        // 移行が必要なレコードのみをフィルタリング
        const recordsToMigrate = history.filter(record => {
          if (!record.id) {
            console.warn(`[${uid}] レコードにIDがありません:`, record);
            return false;
          }
          return !existingRecordIds.has(record.id);
        });

        if (recordsToMigrate.length === 0) {
          console.log(`[${uid}] すべてのレコードは既に移行済みのためスキップ\n`);
          continue;
        }

        console.log(`[${uid}] ${recordsToMigrate.length}件のレコードを新規移行します（既存: ${existingRecordIds.size}件）`);

        // バッチ処理で移行（500件ずつ）
        const batchSize = 500;
        for (let i = 0; i < recordsToMigrate.length; i += batchSize) {
          const batch = db.batch();
          const batchRecords = recordsToMigrate.slice(i, i + batchSize);

          for (const record of batchRecords) {
            const recordRef = db.collection('public_status').doc(uid).collection('history').doc(record.id);
            batch.set(recordRef, record);
          }

          await batch.commit();
        }

        totalMigrated += recordsToMigrate.length;
        console.log(`[${uid}] ✓ ${recordsToMigrate.length}件の移行完了（スキップ: ${history.length - recordsToMigrate.length}件）\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 移行エラー:`, error.message);
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
        continue;
      }

      try {
        console.log(`[${uid}] ${history.length}件のレコードを移行中...`);

        // 既存のサブコレクションデータを確認（移行済みのレコードをスキップ）
        const existingSubcollectionSnapshot = await db.collection('users').doc(uid).collection('history').get();
        const existingRecordIds = new Set(existingSubcollectionSnapshot.docs.map(doc => doc.id));
        console.log(`[${uid}] 既存のサブコレクションデータ: ${existingRecordIds.size}件`);

        // 移行が必要なレコードのみをフィルタリング
        const recordsToMigrate = history.filter(record => {
          if (!record.id) {
            console.warn(`[${uid}] レコードにIDがありません:`, record);
            return false;
          }
          return !existingRecordIds.has(record.id);
        });

        if (recordsToMigrate.length === 0) {
          console.log(`[${uid}] すべてのレコードは既に移行済みのためスキップ\n`);
          continue;
        }

        console.log(`[${uid}] ${recordsToMigrate.length}件のレコードを新規移行します（既存: ${existingRecordIds.size}件）`);

        // バッチ処理で移行（500件ずつ）
        const batchSize = 500;
        for (let i = 0; i < recordsToMigrate.length; i += batchSize) {
          const batch = db.batch();
          const batchRecords = recordsToMigrate.slice(i, i + batchSize);

          for (const record of batchRecords) {
            const recordRef = db.collection('users').doc(uid).collection('history').doc(record.id);
            batch.set(recordRef, record);
          }

          await batch.commit();
        }

        totalMigrated += recordsToMigrate.length;
        console.log(`[${uid}] ✓ ${recordsToMigrate.length}件の移行完了（スキップ: ${history.length - recordsToMigrate.length}件）\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 移行エラー:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== 移行完了 ===');
    console.log(`総移行件数: ${totalMigrated}件`);
    console.log(`エラー件数: ${totalErrors}件`);
  } catch (error) {
    console.error('移行中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

// 実行
migrateHistoryToSubcollection();
