/**
 * 簡易モードデータ専用の移行スクリプト
 * 
 * 使用方法:
 * node scripts/migrateSimpleModeToSubcollection.cjs
 * 
 * このスクリプトは、history配列内の簡易モードデータをサブコレクションに移行します
 * IDにスラッシュ（/）が含まれている場合は、ハイフン（-）に置換します
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * 簡易モードのレコードかどうかを判定
 */
function isSimpleModeRecord(record) {
  if (!record) return false;
  
  // remarksフィールドに「簡易モード」が含まれているか
  const hasSimpleModeRemark = record.remarks && typeof record.remarks === 'string' && record.remarks.includes('簡易モード');
  // IDがsimple_で始まるか
  const hasSimpleId = record.id && typeof record.id === 'string' && record.id.startsWith('simple_');
  
  return hasSimpleModeRemark || hasSimpleId;
}

/**
 * IDをサニタイズ（スラッシュをハイフンに置換）
 */
function sanitizeRecordId(recordId) {
  if (!recordId || typeof recordId !== 'string') {
    return recordId;
  }
  // スラッシュをハイフンに置換（Firestoreの階層構造として解釈されるのを防ぐ）
  return recordId.replace(/\//g, '-');
}

/**
 * 簡易モードデータをサブコレクションに移行
 */
async function migrateSimpleModeToSubcollection() {
  console.log('=== 簡易モードデータの移行を開始 ===\n');

  try {
    let totalMigrated = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    // public_statusコレクションを処理
    const publicStatusSnapshot = await db.collection('public_status').get();
    console.log(`public_status: ${publicStatusSnapshot.size}件のドキュメントを処理します\n`);

    for (const docSnap of publicStatusSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        continue;
      }

      // 簡易モードのレコードのみをフィルタリング
      const simpleModeRecords = history.filter(isSimpleModeRecord);

      if (simpleModeRecords.length === 0) {
        continue;
      }

      try {
        console.log(`[${uid}] ${simpleModeRecords.length}件の簡易モードレコードを移行中...`);

        // 既存のサブコレクションデータを確認
        const existingSubcollectionSnapshot = await db.collection('public_status').doc(uid).collection('history').get();
        const existingRecordIds = new Set(existingSubcollectionSnapshot.docs.map(doc => doc.id));
        console.log(`[${uid}] 既存のサブコレクションデータ: ${existingRecordIds.size}件`);

        // 移行が必要なレコードのみをフィルタリング（IDもサニタイズ）
        const recordsToMigrate = [];
        for (const record of simpleModeRecords) {
          if (!record.id) {
            console.warn(`[${uid}] レコードにIDがありません:`, record);
            continue;
          }

          const sanitizedId = sanitizeRecordId(record.id);
          
          // サニタイズ後のIDが既に存在する場合はスキップ
          if (existingRecordIds.has(sanitizedId)) {
            totalSkipped++;
            continue;
          }

          // レコードのIDもサニタイズ
          const sanitizedRecord = {
            ...record,
            id: sanitizedId
          };
          
          recordsToMigrate.push(sanitizedRecord);
        }

        if (recordsToMigrate.length === 0) {
          console.log(`[${uid}] すべての簡易モードレコードは既に移行済みのためスキップ\n`);
          continue;
        }

        console.log(`[${uid}] ${recordsToMigrate.length}件の簡易モードレコードを新規移行します（既存: ${existingRecordIds.size}件、スキップ: ${simpleModeRecords.length - recordsToMigrate.length}件）`);

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
        console.log(`[${uid}] ✓ ${recordsToMigrate.length}件の簡易モードレコード移行完了\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 移行エラー:`, error.message);
        totalErrors++;
      }
    }

    // usersコレクションを処理
    const usersSnapshot = await db.collection('users').get();
    console.log(`\nusers: ${usersSnapshot.size}件のドキュメントを処理します\n`);

    for (const docSnap of usersSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        continue;
      }

      // 簡易モードのレコードのみをフィルタリング
      const simpleModeRecords = history.filter(isSimpleModeRecord);

      if (simpleModeRecords.length === 0) {
        continue;
      }

      try {
        console.log(`[${uid}] ${simpleModeRecords.length}件の簡易モードレコードを移行中...`);

        // 既存のサブコレクションデータを確認
        const existingSubcollectionSnapshot = await db.collection('users').doc(uid).collection('history').get();
        const existingRecordIds = new Set(existingSubcollectionSnapshot.docs.map(doc => doc.id));
        console.log(`[${uid}] 既存のサブコレクションデータ: ${existingRecordIds.size}件`);

        // 移行が必要なレコードのみをフィルタリング（IDもサニタイズ）
        const recordsToMigrate = [];
        for (const record of simpleModeRecords) {
          if (!record.id) {
            console.warn(`[${uid}] レコードにIDがありません:`, record);
            continue;
          }

          const sanitizedId = sanitizeRecordId(record.id);
          
          // サニタイズ後のIDが既に存在する場合はスキップ
          if (existingRecordIds.has(sanitizedId)) {
            totalSkipped++;
            continue;
          }

          // レコードのIDもサニタイズ
          const sanitizedRecord = {
            ...record,
            id: sanitizedId
          };
          
          recordsToMigrate.push(sanitizedRecord);
        }

        if (recordsToMigrate.length === 0) {
          console.log(`[${uid}] すべての簡易モードレコードは既に移行済みのためスキップ\n`);
          continue;
        }

        console.log(`[${uid}] ${recordsToMigrate.length}件の簡易モードレコードを新規移行します（既存: ${existingRecordIds.size}件、スキップ: ${simpleModeRecords.length - recordsToMigrate.length}件）`);

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
        console.log(`[${uid}] ✓ ${recordsToMigrate.length}件の簡易モードレコード移行完了\n`);
      } catch (error) {
        console.error(`[${uid}] ✗ 移行エラー:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n=== 移行完了 ===');
    console.log(`簡易モードレコード総移行件数: ${totalMigrated}件`);
    console.log(`スキップ件数: ${totalSkipped}件`);
    console.log(`エラー件数: ${totalErrors}件`);
  } catch (error) {
    console.error('移行中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

migrateSimpleModeToSubcollection();
