/**
 * Firestoreデータ削除スクリプト
 * 注意: このスクリプトはすべてのデータを削除します。実行前にバックアップを取ってください。
 * 
 * 使用方法:
 * 1. Firebase CLIでログイン: firebase login
 * 2. このスクリプトを実行: node delete_firestore_data.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Firebase Admin SDKの秘密鍵が必要

// Firebase Admin SDKを初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  query.get()
    .then((snapshot) => {
      // バッチが空の場合、完了
      if (snapshot.size === 0) {
        return 0;
      }

      // バッチ削除
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    })
    .then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }
      // 再帰的に次のバッチを削除
      process.nextTick(() => {
        deleteQueryBatch(query, resolve, reject);
      });
    })
    .catch(reject);
}

async function deleteAllData() {
  console.log('Firestoreデータの削除を開始します...');
  
  const collections = ['users', 'public_status'];
  
  for (const collection of collections) {
    console.log(`\n${collection}コレクションを削除中...`);
    try {
      await deleteCollection(collection);
      console.log(`✓ ${collection}コレクションを削除しました`);
    } catch (error) {
      console.error(`✗ ${collection}コレクションの削除に失敗:`, error);
    }
  }
  
  console.log('\nデータ削除が完了しました。');
  process.exit(0);
}

// 実行
deleteAllData().catch((error) => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});
