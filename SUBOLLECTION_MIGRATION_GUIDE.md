# サブコレクション移行ガイド

このドキュメントでは、Firestoreの配列形式からサブコレクション形式への段階的な移行手順を説明します。

## 概要

Firebaseの1MBドキュメントサイズ制限を回避するため、`history`配列をサブコレクション形式に移行します。

### データ構造の変更

**移行前:**
```
public_status/{uid}
  - history: [record1, record2, ...]  // 配列形式
users/{uid}
  - history: [record1, record2, ...]  // 配列形式
```

**移行後:**
```
public_status/{uid}
  - (その他のフィールド)
public_status/{uid}/history/{recordId}
  - record1
  - record2
  - ...
users/{uid}
  - (その他のフィールド)
users/{uid}/history/{recordId}
  - record1
  - record2
  - ...
```

## 移行フェーズ

### Phase 1-2: 実装完了 ✅

- サブコレクションへの保存機能を追加
- 配列形式も維持（後方互換性）
- 読み込み処理をサブコレクション優先に変更

**現在の状態:**
- 新規データはサブコレクションと配列形式の両方に保存される
- 読み込み時はサブコレクションを優先、なければ配列形式を使用

### Phase 3: 既存データの移行

既存の配列形式データをサブコレクションに移行します。

**手順:**

1. Firebase Admin SDKの認証情報を取得
   - Firebase Console → プロジェクト設定 → サービスアカウント
   - 「新しい秘密鍵の生成」をクリック
   - ダウンロードしたJSONファイルを `serviceAccountKey.json` としてプロジェクトルートに配置

2. 移行スクリプトを実行
   ```bash
   node scripts/migrateToSubcollection.cjs
   ```

3. 移行結果を確認
   - コンソールに表示される移行件数を確認
   - Firebase Consoleでサブコレクションにデータが正しく保存されているか確認

**注意:**
- 移行中はアプリケーションの使用を避けてください
- 大量のデータがある場合、移行に時間がかかる可能性があります

### Phase 4: 配列形式への保存を停止

移行が完了し、すべてのユーザーでサブコレクションからデータが読み込めることを確認したら、配列形式への保存を停止します。

**手順:**

1. `core/migrationConfig.ts` を開く

2. `SKIP_ARRAY_HISTORY_SAVE` を `true` に変更
   ```typescript
   export const SKIP_ARRAY_HISTORY_SAVE = true;
   ```

3. 動作確認
   - 新規レコードを保存
   - サブコレクションにのみ保存されることを確認
   - 配列形式には保存されないことを確認

### Phase 5: 配列形式の削除

すべてのユーザーで移行が完了し、しばらく動作確認を行った後、配列形式のフィールドを削除します。

**手順:**

1. バックアップを取得
   - Firebase Consoleからデータをエクスポート
   - または、`scripts/backupData.js` を実行（必要に応じて作成）

2. 削除スクリプトを実行
   ```bash
   node scripts/removeArrayHistory.cjs
   ```

3. 確認プロンプトで `yes` を入力

4. 削除結果を確認
   - コンソールに表示される削除件数を確認
   - Firebase Consoleで配列形式のフィールドが削除されているか確認

**注意:**
- この操作は元に戻せません
- 必ずバックアップを取得してから実行してください
- サブコレクションにデータが存在することを確認してから実行してください

### Phase 5.5: recordsフィールドのクリーンアップ（オプション）

`public_status`コレクションの`records`フィールドに古いデータが残っている場合、クリーンアップすることができます。

**手順:**

1. クリーンアップスクリプトを実行
   ```bash
   node scripts/cleanupRecordsField.cjs
   ```

2. 確認プロンプトで `yes` を入力

3. クリーンアップ結果を確認
   - コンソールに表示される削除件数を確認
   - Firebase Consoleで`records`フィールドが削除されているか確認

**注意:**
- `records`フィールドは次回の`broadcastStatus`実行時に自動的に再作成されます
- 現在のシフトのレコードのみが保存されます
- この操作は安全です（自動的に再作成されるため）

### Phase 5.6: monthsフィールド内のrecordsフィールドのクリーンアップ（オプション）

`public_status`コレクションの`months`フィールド内の各月から`records`フィールドを削除し、`sales`フィールドのみを保持します。詳細データはサブコレクションに移行されているため不要です。

**手順:**

1. クリーンアップスクリプトを実行
   ```bash
   node scripts/cleanupMonthsRecords.cjs
   ```

2. 確認プロンプトで `yes` を入力

3. クリーンアップ結果を確認
   - コンソールに表示される削除件数を確認
   - Firebase Consoleで`months`フィールド内の`records`が削除されているか確認

**注意:**
- `months`内の`records`フィールドを削除し、`sales`フィールドのみを保持します
- 詳細データはサブコレクションから取得されます
- `MonthlyDashboard`は`history`からフォールバックできるため、問題なく動作します

### Phase 6: 配列形式からの読み込みを停止（オプション）

配列形式のフィールドを削除した後、コードから配列形式へのフォールバック処理を削除できます。

**手順:**

1. `core/migrationConfig.ts` を開く

2. `SKIP_ARRAY_HISTORY_READ` を `true` に変更
   ```typescript
   export const SKIP_ARRAY_HISTORY_READ = true;
   ```

3. 動作確認
   - すべての画面でデータが正しく表示されることを確認

## トラブルシューティング

### 移行スクリプトがエラーになる

- Firebase Admin SDKが正しくインストールされているか確認
- `serviceAccountKey.json` が正しい場所にあるか確認
- Firebase Consoleでプロジェクトの権限を確認

### サブコレクションからデータが読み込めない

- 移行が完了しているか確認
- Firebase Consoleでサブコレクションにデータが存在するか確認
- ブラウザのコンソールでエラーメッセージを確認

### 配列形式への保存が停止されない

- `core/migrationConfig.ts` の設定を確認
- アプリケーションを再ビルド・再デプロイしているか確認

## ロールバック

問題が発生した場合のロールバック手順:

1. `core/migrationConfig.ts` の設定を元に戻す
   ```typescript
   export const SKIP_ARRAY_HISTORY_SAVE = false;
   export const SKIP_ARRAY_HISTORY_READ = false;
   ```

2. アプリケーションを再ビルド・再デプロイ

3. 配列形式からデータが読み込めることを確認

## 参考

- [Firestore サブコレクション](https://firebase.google.com/docs/firestore/manage-data/structure-data#subcollections)
- [Firestore ドキュメントサイズ制限](https://firebase.google.com/docs/firestore/quotas)
