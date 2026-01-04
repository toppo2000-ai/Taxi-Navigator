/**
 * 簡易モードデータの確認スクリプト
 * 
 * 使用方法:
 * node scripts/checkSimpleModeHistory.cjs
 * 
 * このスクリプトは、public_statusとusersコレクションのhistory配列内に
 * 簡易モードのデータが含まれているかを確認します
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSimpleModeHistory() {
  console.log('=== 簡易モードデータの確認を開始 ===\n');

  try {
    // public_statusコレクションを確認
    const publicStatusSnapshot = await db.collection('public_status').get();
    console.log(`public_status: ${publicStatusSnapshot.size}件のドキュメントを確認します\n`);

    let totalSimpleModeRecords = 0;
    let usersWithSimpleMode = 0;

    for (const docSnap of publicStatusSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        continue;
      }

      // 簡易モードのレコードをフィルタリング
      const simpleModeRecords = history.filter(record => {
        // remarksフィールドに「簡易モード」が含まれているか
        const hasSimpleModeRemark = record.remarks && typeof record.remarks === 'string' && record.remarks.includes('簡易モード');
        // IDがsimple_で始まるか
        const hasSimpleId = record.id && typeof record.id === 'string' && record.id.startsWith('simple_');
        
        return hasSimpleModeRemark || hasSimpleId;
      });

      if (simpleModeRecords.length > 0) {
        usersWithSimpleMode++;
        totalSimpleModeRecords += simpleModeRecords.length;
        console.log(`[${uid}] 簡易モードレコード: ${simpleModeRecords.length}件`);
        console.log(`  サンプルID:`, simpleModeRecords.slice(0, 5).map(r => r.id));
        console.log(`  サンプルremarks:`, simpleModeRecords.slice(0, 3).map(r => r.remarks?.substring(0, 50)));
        console.log('');
      }
    }

    // usersコレクションを確認
    const usersSnapshot = await db.collection('users').get();
    console.log(`\nusers: ${usersSnapshot.size}件のドキュメントを確認します\n`);

    let totalSimpleModeRecordsUsers = 0;
    let usersWithSimpleModeUsers = 0;

    for (const docSnap of usersSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const history = data.history || [];

      if (history.length === 0) {
        continue;
      }

      // 簡易モードのレコードをフィルタリング
      const simpleModeRecords = history.filter(record => {
        const hasSimpleModeRemark = record.remarks && typeof record.remarks === 'string' && record.remarks.includes('簡易モード');
        const hasSimpleId = record.id && typeof record.id === 'string' && record.id.startsWith('simple_');
        
        return hasSimpleModeRemark || hasSimpleId;
      });

      if (simpleModeRecords.length > 0) {
        usersWithSimpleModeUsers++;
        totalSimpleModeRecordsUsers += simpleModeRecords.length;
        console.log(`[${uid}] 簡易モードレコード: ${simpleModeRecords.length}件`);
        console.log(`  サンプルID:`, simpleModeRecords.slice(0, 5).map(r => r.id));
        console.log(`  サンプルremarks:`, simpleModeRecords.slice(0, 3).map(r => r.remarks?.substring(0, 50)));
        console.log('');
      }
    }

    console.log('\n=== 確認完了 ===');
    console.log(`public_status - 簡易モードレコードを含むユーザー: ${usersWithSimpleMode}人`);
    console.log(`public_status - 簡易モードレコード総数: ${totalSimpleModeRecords}件`);
    console.log(`users - 簡易モードレコードを含むユーザー: ${usersWithSimpleModeUsers}人`);
    console.log(`users - 簡易モードレコード総数: ${totalSimpleModeRecordsUsers}件`);

  } catch (error) {
    console.error('確認中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

checkSimpleModeHistory();
