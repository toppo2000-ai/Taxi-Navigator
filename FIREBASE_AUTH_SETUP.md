# Firebase認証設定チェックリスト

## 問題
スマホで `https://pro-taxi-d3945.web.app/` からログインできない
（別プロジェクトでは正常に動作している）

## 確認すべきFirebase Console設定

### 1. 承認済みドメインの確認
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `pro-taxi-d3945` を選択
3. **Authentication** → **設定** → **承認済みドメイン** を開く
4. 以下が追加されているか確認：
   - `pro-taxi-d3945.web.app` ✅
   - `pro-taxi-d3945.firebaseapp.com` ✅
   - `localhost` (開発用) ✅

**もし `pro-taxi-d3945.web.app` が追加されていない場合：**
- 「ドメインを追加」をクリック
- `pro-taxi-d3945.web.app` を入力して追加

### 2. Google OAuth設定の確認
1. **Authentication** → **Sign-in method** → **Google** を開く
2. **Web SDK設定** セクションを確認
3. **承認済みリダイレクトURI** に以下が含まれているか確認：
   - `https://pro-taxi-d3945.firebaseapp.com/__/auth/handler`
   - `https://pro-taxi-d3945.web.app/__/auth/handler` ✅ (重要)

**もし `pro-taxi-d3945.web.app` のリダイレクトURIが追加されていない場合：**
- Google Cloud Consoleで設定する必要があります（下記参照）

### 3. Google Cloud ConsoleでのOAuth設定
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクト `pro-taxi-d3945` を選択
3. **APIとサービス** → **認証情報** を開く
4. OAuth 2.0 クライアントID（Webアプリケーション）を開く
5. **承認済みのリダイレクトURI** に以下を追加：
   ```
   https://pro-taxi-d3945.web.app/__/auth/handler
   ```
6. **保存** をクリック

### 4. authDomainの確認
現在の設定：
```typescript
authDomain: "pro-taxi-d3945.firebaseapp.com"
```

これは正しい設定です。`firebaseapp.com` ドメインを使用する必要があります。
`web.app` ドメインに変更する必要はありません。

## トラブルシューティング

### モバイルブラウザでの問題
- **プライベートブラウジングモード**: localStorage/sessionStorageが制限される可能性があります
- **サードパーティCookie**: ブラウザの設定でサードパーティCookieがブロックされている可能性があります

### 確認方法
1. スマホのブラウザで https://pro-taxi-d3945.web.app/ にアクセス
2. ブラウザの開発者ツール（可能であれば）でコンソールログを確認
3. エラーメッセージを確認：
   - `auth/unauthorized-domain`: 承認済みドメインが設定されていない
   - `auth/redirect-uri-mismatch`: OAuthリダイレクトURIが設定されていない

## 別プロジェクトとの比較
別プロジェクトで正常に動作している場合、以下を比較してください：
1. 承認済みドメインの設定
2. OAuthリダイレクトURIの設定
3. Google Cloud ConsoleのOAuth設定

これらの設定を別プロジェクトと同じように設定することで、問題が解決する可能性が高いです。
