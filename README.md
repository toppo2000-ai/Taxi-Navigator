# Taxi Navigator

> タクシードライバー向け売上管理・分析アプリケーション

[![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-19.x-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-teal)](https://tailwindcss.com/)

---

## 📋 目次

1. [プロジェクト概要](#-プロジェクト概要)
2. [主な機能](#-主な機能)
3. [技術スタック](#-技術スタック)
4. [ディレクトリ構造](#-ディレクトリ構造)
5. [ファイル詳細説明](#-ファイル詳細説明)
6. [データモデル](#-データモデル)
7. [開発環境と本番環境の違い](#-開発環境と本番環境の違い)
8. [セットアップ手順](#-セットアップ手順)
9. [デプロイ](#-デプロイ)
10. [ライセンス](#-ライセンス)

---

## 🎯 プロジェクト概要

### 目的

Taxi Navigatorは、タクシードライバーが日々の売上を効率的に記録・管理・分析するためのPWA（Progressive Web App）です。紙の日報や手計算を不要にし、リアルタイムで売上状況を把握できるようにすることで、ドライバーの業務効率化と収益最大化をサポートします。

### 目標

1. **業務効率化**: 乗車記録の入力を最小限のタップで完了できるUIを提供
2. **リアルタイム分析**: 日次・月次の売上推移、目標達成率をリアルタイムで可視化
3. **チーム連携**: 同僚ドライバーの稼働状況を共有し、チームワークを促進
4. **データ活用**: CSV出力機能により、外部ツールでの詳細分析を可能に
5. **オフライン対応**: PWAとしてインストール可能で、ネットワーク接続が不安定な環境でも動作

### ターゲットユーザー

| ユーザー | 役割 |
|---------|------|
| **ドライバー** | 売上記録の入力、日報作成、分析レポートの確認 |
| **管理者** | 全ドライバーの稼働状況モニタリング、データ管理 |

---

## ✨ 主な機能

### ドライバー向け機能

| 機能 | 説明 |
|------|------|
| **シフト管理** | 営業開始・終了の記録、予定営業時間と日次目標の設定 |
| **売上記録** | 金額、支払い方法、乗車タイプ、乗降地、乗客数などを記録 |
| **休憩管理** | 休憩開始/終了のトグル、休憩時間の自動計算 |
| **日報作成** | シフト終了時に自動生成される日報、CSV出力対応 |
| **履歴閲覧** | 過去の売上記録をカレンダー形式で閲覧・編集 |
| **分析ビュー** | 期間別売上推移、支払い方法別内訳、乗車タイプ別統計 |
| **目標管理** | 月間目標・日次目標の設定と達成率の可視化 |

### 管理者向け機能

| 機能 | 説明 |
|------|------|
| **ユーザー管理** | ドライバーの登録・承認・権限管理 |
| **代理操作** | 他ドライバーの売上記録を代理で入力・編集 |
| **全体モニタリング** | 全ドライバーの稼働状況・売上状況の一覧表示 |
| **CSVインポート** | 外部データの一括取り込み |

### システム機能

| 機能 | 説明 |
|------|------|
| **Google認証** | Googleアカウントによるセキュアなログイン |
| **ゲストモード** | 開発環境でのみ利用可能な認証不要モード |
| **リアルタイム同期** | Firestoreによるリアルタイムデータ同期 |
| **PWA対応** | ホーム画面への追加、オフライン対応 |
| **30時間制対応** | 深夜営業に対応した時刻表示（例: 25:00 = 翌1:00） |

---

## 🛠 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **React** | 19.x | UIライブラリ |
| **TypeScript** | 5.x | 型安全な開発 |
| **Vite** | 6.x | ビルドツール・開発サーバー |
| **TailwindCSS** | 3.x | ユーティリティファーストCSS |
| **Lucide React** | 0.561.x | アイコンライブラリ |

### バックエンド・インフラ

| 技術 | 用途 |
|------|------|
| **Firebase Authentication** | ユーザー認証（Google OAuth） |
| **Cloud Firestore** | NoSQLデータベース |
| **Firebase Hosting** | 静的ファイルホスティング |

---

## 📁 ディレクトリ構造

```
Taxi-Navigator/
├── .env.example              # 環境変数のテンプレート
├── .firebase/                # Firebase CLIのキャッシュ
├── .firebaserc               # Firebaseプロジェクト設定
├── .gitignore                # Git除外設定
├── 404.html                  # 404エラーページ（SPAフォールバック）
├── README.md                 # このファイル
├── firebase.json             # Firebaseホスティング設定
├── index.html                # HTMLエントリーポイント
├── package.json              # npm依存関係・スクリプト
├── package-lock.json         # npm依存関係のロックファイル
├── postcss.config.js         # PostCSS設定（TailwindCSS用）
├── tailwind.config.js        # TailwindCSS設定
├── tsconfig.json             # TypeScript設定
├── vite.config.ts            # Viteビルド設定
│
├── data/                     # サンプルデータ・インポート用ファイル
│   └── 乗降明細_maki_20251212.xlsx
│
├── dist/                     # ビルド成果物（本番デプロイ用）
│
├── public/                   # 静的アセット（ビルド時にそのままコピー）
│   ├── apple-touch-icon.png  # iOS用アイコン
│   ├── favicon.ico           # ファビコン
│   ├── favicon.svg           # SVGファビコン
│   ├── favicon-96x96.png     # 96x96ファビコン
│   ├── icon-192.png          # PWAアイコン（192x192）
│   ├── icon-512.png          # PWAアイコン（512x512）
│   ├── manifest.json         # PWAマニフェスト
│   ├── metadata.json         # アプリメタデータ
│   ├── site.webmanifest      # Webマニフェスト
│   ├── web-app-manifest-192x192.png
│   └── web-app-manifest-512x512.png
│
└── src/                      # ソースコード
    ├── App.tsx               # メインアプリケーションコンポーネント
    ├── index.css             # グローバルCSS（Tailwind directives）
    ├── index.tsx             # Reactエントリーポイント
    ├── vite-env.d.ts         # Vite型定義
    │
    ├── assets/               # 画像アセット
    │   ├── navi-chibi.png    # ログイン画面のマスコット画像
    │   └── navi-loading.png  # ローディング画面のマスコット画像
    │
    ├── components/           # UIコンポーネント
    │   ├── common/           # 共通コンポーネント
    │   │   ├── index.ts      # 共通コンポーネントのバレルエクスポート
    │   │   ├── AuthScreens.tsx        # 認証画面（スプラッシュ、ログイン、オンボーディング）
    │   │   ├── FullScreenClock.tsx    # 全画面時計（待機中表示用）
    │   │   ├── Header.tsx             # アプリヘッダー
    │   │   ├── Modals.tsx             # モーダル群のバレルエクスポート
    │   │   ├── Navigation.tsx         # ボトムナビゲーションバー
    │   │   ├── NeonProgressBar.tsx    # ネオン風プログレスバー
    │   │   ├── PaymentBreakdownList.tsx # 支払い方法別内訳リスト
    │   │   ├── ReportSummaryView.tsx  # 日報サマリー表示
    │   │   ├── SalesRecordCard.tsx    # 売上記録カード
    │   │   │
    │   │   └── modals/       # モーダルコンポーネント
    │   │       ├── DailyReportModal.tsx  # 日報モーダル
    │   │       ├── KeypadView.tsx        # 金額入力キーパッド
    │   │       ├── ModalWrapper.tsx      # モーダル共通ラッパー
    │   │       ├── RecordModal.tsx       # 売上記録入力モーダル
    │   │       ├── SettingsModal.tsx     # 設定モーダル
    │   │       └── ShiftEditModal.tsx    # シフト編集モーダル
    │   │
    │   ├── dashboard/        # ダッシュボード関連
    │   │   ├── ColleagueStatusList.tsx  # 同僚の稼働状況リスト
    │   │   ├── CsvImportSection.tsx     # CSVインポートセクション
    │   │   └── Dashboard.tsx            # メインダッシュボード
    │   │
    │   └── views/            # ページビュー
    │       ├── AnalysisView.tsx  # 分析ビュー
    │       ├── DebugView.tsx     # デバッグビュー（開発用）
    │       ├── HistoryView.tsx   # 履歴ビュー
    │       └── MangaView.tsx     # マンガガイドビュー
    │
    ├── constants/            # 定数定義
    │   ├── hotels.ts         # ホテル一覧データ
    │   └── taxiStands.ts     # タクシー乗り場一覧データ
    │
    ├── hooks/                # カスタムフック
    │   ├── useAuth.ts        # 認証状態管理
    │   ├── useExport.ts      # データエクスポート
    │   ├── useGeolocation.ts # 位置情報取得
    │   ├── useHistory.ts     # 売上履歴管理
    │   ├── useShift.ts       # シフト状態管理
    │   └── useStats.ts       # 統計情報管理
    │
    ├── pages/                # ページコンポーネント
    │   ├── AdminDashboard.tsx    # 管理者ダッシュボード
    │   └── UnauthorizedView.tsx  # 未認証ユーザー画面
    │
    ├── services/             # 外部サービス連携
    │   └── firebase.ts       # Firebase初期化・設定
    │
    ├── types/                # 型定義
    │   └── index.ts          # 全型定義のエクスポート
    │
    └── utils/                # ユーティリティ関数
        ├── index.ts          # ユーティリティのバレルエクスポート
        ├── calculator.ts     # 統計計算ロジック
        └── date.ts           # 日付・時刻操作
```

---

## 📄 ファイル詳細説明

### ルートディレクトリ

| ファイル | 説明 |
|----------|------|
| `.env.example` | 環境変数のテンプレート。`.env.local`にコピーして実際の値を設定 |
| `.firebaserc` | FirebaseプロジェクトID（`taxi-board-c3dd3`）の設定 |
| `firebase.json` | Firebase Hostingの設定。`dist/`をデプロイ、SPA用リライトルール |
| `index.html` | SPAのHTMLエントリーポイント。Reactアプリをマウント |
| `package.json` | npm依存関係とスクリプト（`dev`, `build`, `preview`） |
| `postcss.config.js` | PostCSS設定。TailwindCSSとAutoprefixerを有効化 |
| `tailwind.config.js` | TailwindCSSのカスタマイズ設定 |
| `tsconfig.json` | TypeScript設定。パスエイリアス（`@/`→`src/`）を定義 |
| `vite.config.ts` | Viteビルド設定。React plugin、パスエイリアス |
| `404.html` | Firebase Hosting用404ページ（SPAでは`index.html`にリダイレクト） |

### `src/` - ソースコード

#### エントリーポイント

| ファイル | 説明 |
|----------|------|
| `index.tsx` | Reactアプリのエントリーポイント。`App`コンポーネントをDOMにレンダリング |
| `index.css` | グローバルCSS。TailwindCSSディレクティブとカスタムスタイル |
| `App.tsx` | **メインコンポーネント**。認証状態に応じた画面分岐、全体のstate管理 |
| `vite-env.d.ts` | Vite環境の型定義（`import.meta.env`など） |

#### `components/common/` - 共通UIコンポーネント

| ファイル | 説明 |
|----------|------|
| `AuthScreens.tsx` | 認証関連画面群: `SplashScreen`（起動画面）、`LoginScreen`（ログイン）、`OnboardingScreen`（初回設定） |
| `Header.tsx` | アプリ上部のヘッダー。設定ボタン、管理者メニューへのアクセス |
| `Navigation.tsx` | ボトムナビゲーション。ホーム/履歴/分析/ガイドの4タブ切り替え |
| `FullScreenClock.tsx` | 待機中に表示する全画面時計。30時間制対応 |
| `NeonProgressBar.tsx` | 目標達成率を示すネオン風のプログレスバー |
| `PaymentBreakdownList.tsx` | 支払い方法別の売上内訳リスト表示 |
| `ReportSummaryView.tsx` | 日報のサマリー情報表示（合計売上、乗車数、税抜金額など） |
| `SalesRecordCard.tsx` | 個別の売上記録を表示するカードコンポーネント |
| `Modals.tsx` | モーダルコンポーネント群のバレルエクスポート |
| `index.ts` | 共通コンポーネントのバレルエクスポート |

#### `components/common/modals/` - モーダルコンポーネント

| ファイル | 説明 |
|----------|------|
| `ModalWrapper.tsx` | 全モーダル共通のラッパー。背景オーバーレイ、閉じる処理 |
| `RecordModal.tsx` | **売上記録入力モーダル**。金額、支払い方法、乗車タイプ、乗降地、乗客数、備考を入力 |
| `KeypadView.tsx` | RecordModal内で使用する金額入力用テンキー |
| `DailyReportModal.tsx` | シフト終了時の日報確認モーダル。CSV出力機能付き |
| `SettingsModal.tsx` | 設定モーダル。目標設定、支払い方法の有効/無効、公開設定、ログアウト |
| `ShiftEditModal.tsx` | シフト情報の編集モーダル。開始時刻、予定時間の変更 |

#### `components/dashboard/` - ダッシュボード関連

| ファイル | 説明 |
|----------|------|
| `Dashboard.tsx` | **メインダッシュボード**。シフト開始/終了、売上記録追加、休憩管理、進捗表示 |
| `ColleagueStatusList.tsx` | 同僚ドライバーの稼働状況リスト。リアルタイム更新 |
| `CsvImportSection.tsx` | CSVファイルからの売上データインポート機能 |

#### `components/views/` - ページビュー

| ファイル | 説明 |
|----------|------|
| `HistoryView.tsx` | 過去の売上履歴をカレンダー形式で閲覧。日付ごとの詳細表示、編集機能 |
| `AnalysisView.tsx` | 売上分析ビュー。期間別推移、支払い方法別・乗車タイプ別の統計グラフ |
| `MangaView.tsx` | マンガ形式の使い方ガイド（ヘルプ） |
| `DebugView.tsx` | 開発用デバッグビュー。内部state確認など |

#### `hooks/` - カスタムフック

| ファイル | 説明 |
|----------|------|
| `useAuth.ts` | **認証管理フック**。Firebase Auth連携、ゲストモード、ログイン/ログアウト処理 |
| `useShift.ts` | **シフト状態管理**。Firestoreからのリアルタイム同期、シフト開始/終了 |
| `useHistory.ts` | **売上履歴管理**。過去の売上記録のCRUD、Firestore同期 |
| `useStats.ts` | **統計情報管理**。月間目標、設定値のCRUD、Firestore同期 |
| `useGeolocation.ts` | 現在位置取得。乗降地の自動入力に使用 |
| `useExport.ts` | データエクスポート機能。CSV生成 |

#### `pages/` - ページコンポーネント

| ファイル | 説明 |
|----------|------|
| `AdminDashboard.tsx` | 管理者専用ダッシュボード。全ユーザー管理、権限設定 |
| `UnauthorizedView.tsx` | 未承認ユーザー向け画面。管理者承認待ちの案内表示 |

#### `services/` - 外部サービス連携

| ファイル | 説明 |
|----------|------|
| `firebase.ts` | Firebase初期化。`auth`, `db`, `googleProvider`をエクスポート |

#### `types/` - 型定義

| ファイル | 説明 |
|----------|------|
| `index.ts` | 全型定義: `SalesRecord`, `Shift`, `MonthlyStats`, `PaymentMethod`, `RideType`など |

#### `utils/` - ユーティリティ関数

| ファイル | 説明 |
|----------|------|
| `index.ts` | ユーティリティのバレルエクスポート。フォーマット関数、集計関数 |
| `date.ts` | 日付操作: `getBusinessDate`（営業日算出）、`formatBusinessTime`（30時間制）、`getBillingPeriod`（締め期間） |
| `calculator.ts` | 統計計算: `calculatePeriodStats`（期間内売上・乗車数集計） |

#### `constants/` - 定数定義

| ファイル | 説明 |
|----------|------|
| `hotels.ts` | よく使うホテル名のリスト（乗降地入力の候補） |
| `taxiStands.ts` | タクシー乗り場のリスト（乗降地入力の候補） |

---

## 💾 データモデル

### Firestore構造

```
users/
└── {userId}/
    ├── role: "admin" | "user"        # ユーザー役割
    ├── status: "active" | "pending" | "banned"  # ステータス
    ├── shift: Shift | null           # 現在のシフト情報
    ├── history: SalesRecord[]        # 過去の売上履歴
    ├── stats: MonthlyStats           # 月間統計・設定
    ├── dayMetadata: Record<string, DayMetadata>  # 日ごとのメタ情報
    └── breakState: BreakState        # 休憩状態
```

### 主要な型定義

#### `SalesRecord` - 売上記録

```typescript
interface SalesRecord {
  id: string;                    // 一意識別子
  amount: number;                // 売上金額
  toll: number;                  // 高速道路料金
  paymentMethod: PaymentMethod;  // 支払い方法
  nonCashAmount: number;         // 非現金決済額（分割払い用）
  rideType: RideType;            // 乗車タイプ
  timestamp: number;             // 記録時刻（Unix時間）
  pickupLocation?: string;       // 乗車地
  dropoffLocation?: string;      // 降車地
  pickupCoords?: string;         // 乗車地座標
  dropoffCoords?: string;        // 降車地座標
  passengersMale?: number;       // 男性乗客数
  passengersFemale?: number;     // 女性乗客数
  remarks?: string;              // 備考
  isBadCustomer?: boolean;       // 難しい顧客フラグ
}
```

#### `PaymentMethod` - 支払い方法

| 値 | 説明 |
|----|------|
| `CASH` | 現金 |
| `CARD` | クレジットカード |
| `NET` | ネット決済 |
| `E_MONEY` | 電子マネー |
| `TRANSPORT` | 交通系IC |
| `DIDI` | DiDi支払い |
| `QR` | アプリ/QR決済 |
| `TICKET` | タクシーチケット |

#### `RideType` - 乗車タイプ

| 値 | 説明 |
|----|------|
| `FLOW` | 流し |
| `WAIT` | 待機 |
| `APP` | アプリ配車 |
| `HIRE` | ハイヤー |
| `RESERVE` | 予約 |
| `WIRELESS` | 無線配車 |

---

## 🔧 開発環境と本番環境の違い

| 項目 | 開発環境 (`npm run dev`) | 本番環境 (`npm run build`) |
|------|-------------------------|---------------------------|
| **ビルド** | HMR（Hot Module Replacement）で即時反映 | 最適化・圧縮された静的ファイル生成 |
| **URL** | `http://localhost:5173` | Firebase Hosting URL |
| **認証** | ゲストモード利用可能 | Google認証必須 |
| **デバッグ** | `DebugView`タブ表示、コンソールログ出力 | デバッグ機能非表示 |
| **環境変数** | `.env.local`または`.env.development` | `.env.production` |
| **ソースマップ** | あり（デバッグ用） | なし（本番最適化） |
| **Firebase** | 同一プロジェクト（`taxi-board-c3dd3`）| 同一プロジェクト |

### ゲストモードについて

開発環境（`import.meta.env.DEV === true`）でのみ、ログイン画面に「ゲストモードで試す」ボタンが表示されます。これはFirebase認証をバイパスし、`localStorage`にゲストユーザーデータを保存して動作確認を行うための機能です。

```typescript
// useAuth.ts より抜粋
const loginAsGuest = () => {
  if (!import.meta.env.DEV) {
    console.warn('Guest login is only available in development mode.');
    return;
  }
  // ... ゲストデータをlocalStorageに保存
};
```

---

## 🚀 セットアップ手順

### 前提条件

- **Node.js**: v18以上推奨
- **npm**: v9以上推奨
- **Firebase CLI**: デプロイ時に必要

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/toppo2000-ai/Taxi-Navigator.git
cd Taxi-Navigator

# 依存関係をインストール
npm install
```

### 環境変数の設定

```bash
# テンプレートをコピー
cp .env.example .env.local

# .env.local を編集して実際の値を設定
```

`.env.local`の内容:

```dotenv
# Firebase Configuration（現在はハードコードされているため省略可）
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini API Key（将来の機能拡張用）
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

### ビルド

```bash
npm run build
```

`dist/`ディレクトリに本番用ファイルが生成されます。

### プレビュー

```bash
npm run preview
```

ビルド成果物をローカルで確認できます。

---

## 🌐 デプロイ

### Firebase Hostingへのデプロイ

```bash
# Firebase CLIをインストール（未インストールの場合）
npm install -g firebase-tools

# Firebaseにログイン
firebase login

# ビルド
npm run build

# デプロイ
firebase deploy
```

デプロイ後、以下のURLでアクセス可能:
- https://taxi-board-c3dd3.web.app

---

## 📜 ライセンス

このプロジェクトはMITライセンスの下で提供されています。

---

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

---

## 📞 サポート

問題や質問がある場合は、GitHubのIssueを作成してください。
