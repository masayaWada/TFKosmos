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

## 今後の改善候補

### 高優先度

- [ ] テストの追加
  - フロントエンド: Jest/Vitestでのコンポーネントテスト
  - バックエンド: 統合テストの追加

### 中優先度

- [ ] フロントエンド状態管理の改善
  - Context APIまたはReduxの導入検討
  - グローバル状態（接続設定、スキャン結果）の一元管理

- [ ] エラーハンドリングの統一
  - HTTPステータスコードの標準化
  - エラーレスポンス形式の統一

### 低優先度

- [ ] CORS設定の本番環境対応
  - 許可オリジンの制限
  - 環境別設定の導入

- [ ] パフォーマンス最適化
  - React.memo/useMemoの活用
  - バンドルサイズの最適化
