# TFKosmos 開発TODO

## 完了済み (2024-12-29)

### コード最適化

- [x] バックエンド: デバッグコード(`println!`)を`tracing`マクロに置換
  - Azure Scanner: すべてのログ出力を`info!`, `debug!`, `warn!`に統一
  - AWS Scanner: 同様に`tracing`マクロに統一

- [x] バックエンド: Azure Scanner重複コードの削減
  - `transform_role_definition_basic`ヘルパー関数を追加
  - フォールバック処理の重複を削除（約70行削減）
  - 未使用の`get_principal_display_name`と`get_role_display_name`関数を削除（約120行削減）

- [x] フロントエンド: ScanConfigFormのサブコンポーネント化
  - `AzureScopeSelector`: Azureスコープ選択UI（約140行）
  - `ScanTargetSelector`: スキャン対象選択UI（約45行）
  - `ScanProgressBar`: プログレスバーUI（約35行）
  - `formStyles.ts`: 共通スタイル定義
  - ScanConfigForm: 748行 → 約350行に削減

- [x] ESLint設定の追加
  - `eslint.config.js`: TypeScript + React用設定
  - `npm run lint`: ESLintチェック
  - `npm run lint:fix`: 自動修正
  - `npm run typecheck`: TypeScript型チェック

- [x] Rustコンパイル警告の修正
  - 未使用インポートの削除
  - 未使用フィールドに`#[allow(dead_code)]`を追加

### テストの追加 (2024-12-29)

- [x] フロントエンド: Vitestセットアップ
  - `vitest.config.ts`: テスト設定
  - `src/test/setup.ts`: jest-dom、localStorageモック
  - `src/test/utils.tsx`: カスタムレンダラー（BrowserRouter付き）
  - `npm run test` / `npm run test:run` / `npm run test:coverage`

- [x] フロントエンド: コンポーネントテスト（計23テスト）
  - `ErrorMessage.test.tsx`: メッセージ表示、複数行対応、閉じるボタン
  - `SuccessMessage.test.tsx`: メッセージ表示、閉じるボタン
  - `LoadingSpinner.test.tsx`: レンダリング、アニメーション
  - `ScanTargetSelector.test.tsx`: AWS/Azure切り替え、チェックボックス操作
  - `ScanProgressBar.test.tsx`: 進捗表示、スピナー表示制御

- [x] バックエンド: ユニットテスト（計21テスト）
  - `naming.rs`: snake_case/kebab-case変換、命名規則適用
  - `resource_service.rs`: 検索フィルタ、ネスト検索、配列検索

### 状態管理とエラーハンドリングの改善 (2024-12-29)

- [x] フロントエンド状態管理の改善（Context API）
  - `src/context/AppContext.tsx`: グローバル状態管理
    - スキャン状態（scanId, provider, status, progress）
    - 接続状態（AWS/Azure設定、検証状態）
    - 通知システム（成功/エラー/警告/情報）
  - `useScan`, `useConnection`, `useNotifications`カスタムフック
  - `NotificationContainer.tsx`: グローバル通知表示コンポーネント

- [x] エラーハンドリングの統一
  - バックエンド: `src/api/error.rs`
    - `ApiError`列挙型（Validation, NotFound, ExternalService, Internal）
    - 統一されたエラーレスポンス形式（code, message, details）
    - 適切なHTTPステータスコード（400/404/500/502）
  - フロントエンド: `src/api/client.ts`
    - `ApiError`クラス（型付きエラー処理）
    - ネットワークエラー/タイムアウトの処理
    - レガシー形式との後方互換性
  - 全APIルートを新しいエラー形式に更新（計26テスト通過）

## 完了済み (2024-12-29) - 低優先度タスク

### CORS設定の本番環境対応

- [x] 環境別設定の導入
  - `backend/src/config.rs`: 環境変数ベースの設定管理
  - `TFKOSMOS_ENV`: 開発/本番環境の切り替え（development/production）
  - `TFKOSMOS_HOST`, `TFKOSMOS_PORT`: サーバーバインド設定
  - `TFKOSMOS_CORS_ORIGINS`: CORS許可オリジン（カンマ区切り）

- [x] 許可オリジンの制限
  - 開発環境: 全オリジン許可（開発の利便性のため）
  - 本番環境: `TFKOSMOS_CORS_ORIGINS`で指定されたオリジンのみ許可
  - オリジン未指定時の警告ログ出力

### パフォーマンス最適化

- [x] React.memo/useMemoの活用
  - `LoadingSpinner.tsx`: React.memoでメモ化
  - `ErrorMessage.tsx`: React.memo + useMemoでlines配列をメモ化
  - `SuccessMessage.tsx`: React.memoでメモ化
  - `Navigation.tsx`: React.memo + NAV_ITEMSを定数として外部化
  - `SelectionSummary.tsx`: React.memo + useCallbackでクリックハンドラをメモ化
  - `ResourceDetail.tsx`: React.memo + useMemo/useCallbackで最適化
  - `CodePreview.tsx`: React.memo + useMemoでfiles/activeLanguageをメモ化
  - `ResourceTable.tsx`: React.memo + useMemo/useCallbackで最適化

- [x] バンドルサイズの最適化
  - ページコンポーネントの遅延読み込み（React.lazy）: 実装済み
  - manualChunksによるベンダー分割:
    - `react-vendor`: React/ReactDOM
    - `router`: React Router
    - `http-client`: Axios（36.28KB → 別チャンク化）
    - `monaco`: Monaco Editor
  - ErrorMessageチャンク: 38.32KB → 2.07KBに削減

## 今後の改善候補

（現在予定されているタスクはありません）
