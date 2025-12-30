# 4. UI設計

### 4.1 画面構成

#### 4.1.1 接続設定画面

**パス:** `/connection`

**コンポーネント:**

- `ConnectionTabs`: AWS/Azureタブ切り替え
- `AwsConnectionForm`: AWS接続設定フォーム
  - プロファイル選択
  - AssumeRole設定（オプション）
  - 接続テストボタン
- `AzureConnectionForm`: Azure接続設定フォーム
  - 認証方式選択（az_login / service_principal）
  - サブスクリプション選択
  - テナントID入力
  - 接続テストボタン

#### 4.1.2 スキャン設定画面

**パス:** `/scan`

**コンポーネント:**

- `ScanConfigForm`: スキャン条件設定
  - スキャン対象チェックボックス
  - フィルタ設定
  - スキャン実行ボタン
- `ScanResultSummary`: スキャン結果サマリー
- `AzureScopeSelector`: Azureスコープ選択UI
  - スコープタイプ選択（subscription / resource_group / management_group）
  - スコープ値入力
- `ScanTargetSelector`: スキャン対象選択UI
  - AWS/Azure別のチェックボックスグループ
  - 全選択/全解除機能
- `ScanProgressBar`: プログレスバーUI
  - 進捗率表示
  - ステータスメッセージ
  - スピナー表示

#### 4.1.3 リソース一覧画面

**パス:** `/resources/:scanId`

**コンポーネント:**

- `ResourceTabs`: リソースタイプ別タブ
  - Users / Groups / Roles / Policies / Attachments / Cleanup
- `ResourceTable`: リソース一覧テーブル
  - チェックボックス選択
  - ソート機能
  - フィルタ機能
  - ページネーション
- `ResourceDetail`: リソース詳細表示（モーダル/サイドパネル）
- `SelectionSummary`: 選択リソース数表示

#### 4.1.4 生成設定画面

**パス:** `/generate/:scanId`

**コンポーネント:**

- `GenerationConfigForm`: 生成設定フォーム
  - 出力先パス
  - ファイル分割ルール
  - 命名規則
  - importスクリプト形式
  - README生成チェック
- `CodePreview`: 生成コードプレビュー
  - タブでファイル切り替え
  - シンタックスハイライト
- 生成実行ボタンとZIPダウンロードボタン（ページ内に直接実装）

#### 4.1.5 テンプレート管理画面

**パス:** `/templates`

**コンポーネント:**

- テンプレート一覧とエディタ（ページ内に直接実装）
  - テンプレート一覧表示（リソースタイプ、デフォルト/ユーザー表示）
  - コードエディタ（Monaco Editor）
  - 保存ボタン
  - デフォルト復元ボタン
  - プレビュー機能

### 4.2 共通コンポーネント

- `Layout`: メインレイアウト（ヘッダー、サイドバー、フッター）
- `Navigation`: ナビゲーションメニュー
- `LoadingSpinner`: ローディング表示
- `ErrorMessage`: エラーメッセージ表示
- `SuccessMessage`: 成功メッセージ表示
- `NotificationContainer`: グローバル通知表示
  - 複数通知の同時表示
  - 自動消去機能（duration指定時）
  - 通知タイプ別スタイリング（error/success/warning/info）

### 4.3 状態管理

React Context API + useReducer パターンを使用したグローバル状態管理を実装。

#### AppContext (`src/context/AppContext.tsx`)

**管理する状態:**

| 状態カテゴリ | 内容 |
|-------------|------|
| `scan` | スキャンID、プロバイダー、ステータス、進捗、メッセージ |
| `connection` | AWS/Azure接続設定、検証状態 |
| `notifications` | グローバル通知リスト |

**提供するカスタムフック:**

```typescript
// 全状態とアクションへのアクセス
useApp(): AppContextType

// スキャン状態専用
useScan(): {
  scanId, provider, status, progress, message,
  startScan, updateScanProgress, completeScan, failScan, resetScan
}

// 接続状態専用
useConnection(): {
  aws, azure,
  setAwsConnection, validateAwsConnection, invalidateAwsConnection,
  setAzureConnection, validateAzureConnection, invalidateAzureConnection
}

// 通知専用
useNotifications(): {
  notifications,
  addNotification, removeNotification, clearNotifications
}
```

**使用例:**

```tsx
import { useScan, useNotifications } from '../context/AppContext';

function MyComponent() {
  const { scanId, status, startScan } = useScan();
  const { addNotification } = useNotifications();

  const handleScan = async () => {
    try {
      startScan('scan-123', 'aws');
      // ...
    } catch (error) {
      addNotification('error', 'スキャンに失敗しました', 5000);
    }
  };
}
```

### 4.4 パフォーマンス最適化

#### メモ化

- `React.memo`: 純粋なコンポーネントのメモ化
- `useMemo`: 計算コストの高い値のメモ化
- `useCallback`: コールバック関数のメモ化

**適用済みコンポーネント:**

- `LoadingSpinner`, `ErrorMessage`, `SuccessMessage`
- `Navigation`, `SelectionSummary`, `ResourceDetail`
- `CodePreview`, `ResourceTable`

#### コード分割

- `React.lazy`: ページコンポーネントの遅延読み込み
- Vite `manualChunks`: ベンダーライブラリの分割
  - `react-vendor`: React/ReactDOM
  - `router`: React Router
  - `http-client`: Axios
  - `monaco`: Monaco Editor

---
