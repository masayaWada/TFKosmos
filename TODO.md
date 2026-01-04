# TFKosmos TODOリスト

---

## テスト実装計画

### 🎯 Phase 1: 短期（1-2週間） - 最優先事項

#### バックエンド

##### AWS/Azureスキャナーのテスト
- [x] `infra/aws/scanner.rs` のテスト（実装完了・16テスト）
  - [x] `parse_assume_role_policy()` のテスト（空入力、サービスプリンシパル、AWSプリンシパル、条件付き、URLエンコード、複数プリンシパル、無効JSON）
  - [x] `apply_name_prefix_filter()` のテスト
  - [x] `scan_users()` のモックテスト（リファクタリング完了）
  - [x] `scan_groups()` のモックテスト（リファクタリング完了）
  - [x] `scan_roles()` のモックテスト（リファクタリング完了）
  - [x] `scan_policies()` のモックテスト（リファクタリング完了）
  - [x] 進捗コールバックのテスト
  - [x] エラーハンドリング（認証失敗、権限不足）のテスト
  - **リファクタリング内容**: `IamClientOps`トレイトを導入し、AWS SDKクライアントを抽象化。`mockall`クレートによるモック生成。

- [x] `infra/azure/scanner.rs` のテスト（実装完了・15テスト）
  - [x] `transform_role_definition_basic()` のテスト（完全、最小限、フォールバック、スコープ抽出、元フィールド保持）
  - [x] `get_scope_args()` のテスト（subscription、resource_group、management_group）
  - [x] `scan_role_definitions()` のモックテスト（リファクタリング完了）
  - [x] `scan_role_assignments()` のモックテスト（リファクタリング完了）
  - [x] 進捗コールバックのテスト
  - [x] エラーハンドリングのテスト
  - **リファクタリング内容**: `AzureClientOps`トレイトを導入し、Azure CLI/API呼び出しを抽象化。`mockall`クレートによるモック生成。

##### Terraform生成サービスのテスト
- [x] `services/generation_service.rs` の基本テスト（実装完了・15テスト）
  - [x] `generate_terraform()` の正常系テスト
  - [x] `generate_terraform()` のエラーハンドリングテスト
  - [x] `generate_import_script()` のテスト（インポートスクリプト生成テストで確認）
  - [x] プレビュー生成のテスト
  - [x] ZIP作成のテスト
  - [x] キャッシュ管理のテスト（現状のコードではキャッシュ書き込みなし）

- [x] `infra/generators/terraform.rs` のテスト（実装完了・20テスト）
  - [x] テンプレートレンダリングのテスト（README、インポートスクリプト生成）
  - [x] ファイル分割ロジックのテスト（統合テストで確認）
  - [x] リソース生成のテスト（get_resource_name、generate_import_command）

##### API統合テスト
- [x] `axum_test` クレートのセットアップ
- [x] `api/routes/connection.rs` の統合テスト
  - [x] AWS接続テストエンドポイント
  - [x] Azure接続テストエンドポイント
  - [x] サブスクリプション一覧取得
  - [x] リソースグループ一覧取得

- [x] `api/routes/scan.rs` の統合テスト
  - [x] スキャン開始エンドポイント
  - [x] スキャン状態取得エンドポイント

- [x] `api/routes/generate.rs` の統合テスト
  - [x] Terraform生成エンドポイント
  - [x] プレビュー取得エンドポイント
  - [x] ダウンロードエンドポイント
  - [x] 検証・フォーマットエンドポイント

#### フロントエンド

##### AppContext（状態管理）のテスト
- [x] `context/AppContext.tsx` のReducerテスト（実装完了・42テスト）
  - [x] `START_SCAN` アクションのテスト（AWS、Azure）
  - [x] `UPDATE_SCAN_PROGRESS` アクションのテスト
  - [x] `COMPLETE_SCAN` アクションのテスト
  - [x] `FAIL_SCAN` アクションのテスト
  - [x] `RESET_SCAN` アクションのテスト
  - [x] `SET_AWS_CONNECTION` アクションのテスト
  - [x] `VALIDATE_AWS_CONNECTION` アクションのテスト
  - [x] `INVALIDATE_AWS_CONNECTION` アクションのテスト
  - [x] `SET_AZURE_CONNECTION` アクションのテスト
  - [x] `VALIDATE_AZURE_CONNECTION` アクションのテスト
  - [x] `INVALIDATE_AZURE_CONNECTION` アクションのテスト
  - [x] `ADD_NOTIFICATION` アクションのテスト
  - [x] `REMOVE_NOTIFICATION` アクションのテスト
  - [x] `CLEAR_NOTIFICATIONS` アクションのテスト
  - [x] カスタムフック（useApp, useScan, useConnection, useNotifications）のテスト

##### APIクライアントのテスト
- [x] `api/connection.ts` のテスト（実装完了・11テスト）
  - [x] `testAws()` のモックテスト
  - [x] `testAzure()` のモックテスト
  - [x] `awsLogin()` のモックテスト
  - [x] エラーハンドリングのテスト

- [x] `api/scan.ts` のテスト（実装完了・18テスト）
  - [x] `scanAws()` のモックテスト
  - [x] `scanAzure()` のモックテスト
  - [x] `getStatus()` のモックテスト
  - [x] `azureApi.listSubscriptions()` のモックテスト
  - [x] `azureApi.listResourceGroups()` のモックテスト
  - [x] エラーハンドリングのテスト

- [x] `api/resources.ts` のテスト（実装完了・18テスト）
  - [x] `getResources()` のモックテスト
  - [x] `getSelectedResources()` のモックテスト
  - [x] `selectResources()` のモックテスト
  - [x] `query()` のモックテスト
  - [x] `getDependencies()` のモックテスト
  - [x] エラーハンドリングのテスト

##### 重要なページコンポーネントのテスト
- [ ] `pages/ResourcesPage.tsx` のテスト（最複雑・最重要）
  - [ ] 初期レンダリングのテスト
  - [ ] タブ切り替えのテスト
  - [ ] リソース選択のテスト
  - [ ] ページネーションのテスト
  - [ ] クエリ機能のテスト
  - [ ] 依存グラフ表示のテスト

- [ ] `pages/GeneratePage.tsx` のテスト（コア機能）
  - [ ] 設定フォームのテスト
  - [ ] Terraform生成のテスト
  - [ ] プレビュー表示のテスト
  - [ ] ダウンロード機能のテスト
  - [ ] 検証・フォーマット機能のテスト

---

### 🔄 Phase 2: 中期（1ヶ月）

#### バックエンド

##### テンプレート関連のテスト
- [ ] `infra/templates/manager.rs` のテスト
  - [ ] テンプレート読み込みのテスト
  - [ ] パス解決ロジックのテスト
  - [ ] テンプレート優先順位のテスト

##### 残りのサービス層のテスト
- [ ] `services/template_service.rs` のテスト拡張
  - [ ] テンプレート保存のテスト
  - [ ] テンプレート削除のテスト
  - [ ] テンプレートリスト取得のテスト

#### フロントエンド

##### 接続フォームのテスト
- [ ] `components/connection/AwsConnectionForm.tsx` のテスト
  - [ ] フォームバリデーションのテスト
  - [ ] 接続テスト実行のテスト
  - [ ] エラー表示のテスト
  - [ ] プロファイル/リージョン選択のテスト

- [ ] `components/connection/AzureConnectionForm.tsx` のテスト
  - [ ] 認証方法選択のテスト
  - [ ] サービスプリンシパル設定のテスト
  - [ ] 接続テスト実行のテスト
  - [ ] エラー表示のテスト

##### スキャン関連コンポーネントのテスト
- [ ] `components/scan/ScanConfigForm.tsx` のテスト
  - [ ] プロバイダー固有設定のテスト
  - [ ] Azureスコープ選択のテスト
  - [ ] スキャン実行のテスト
  - [ ] 進捗表示のテスト
  - [ ] localStorage統合のテスト

##### リソース関連コンポーネントのテスト
- [ ] `components/resources/ResourceTable.tsx` のテスト
  - [ ] テーブルレンダリングのテスト
  - [ ] 選択機能のテスト
  - [ ] ソート機能のテスト
  - [ ] 詳細展開のテスト

- [ ] `components/resources/QueryInput.tsx` のテスト
  - [ ] クエリ検証のテスト
  - [ ] エラー表示のテスト
  - [ ] クエリ実行のテスト

##### テンプレート関連のテスト
- [ ] `pages/TemplatesPage.tsx` のテスト
  - [ ] テンプレート一覧表示のテスト
  - [ ] テンプレート編集のテスト
  - [ ] Monaco Editor統合のテスト
  - [ ] 検証機能のテスト
  - [ ] 保存・削除のテスト

#### E2E

##### Playwrightセットアップ
- [ ] Playwrightのインストール
  \`\`\`bash
  cd frontend
  npm install -D @playwright/test
  npx playwright install
  \`\`\`

- [ ] \`playwright.config.ts\` の作成
  - [ ] ベースURL設定（http://localhost:5173）
  - [ ] ブラウザ設定（chromium, firefox, webkit）
  - [ ] タイムアウト設定
  - [ ] スクリーンショット設定

- [ ] \`frontend/e2e/\` ディレクトリ構造の作成
  \`\`\`
  frontend/e2e/
  ├── fixtures/          # テストデータ
  ├── pages/             # Page Objectパターン
  └── tests/             # テストケース
  \`\`\`

##### 基本E2Eテストの実装
- [ ] 接続テストフロー
  - [ ] AWS接続画面の表示
  - [ ] 認証情報入力
  - [ ] 接続テスト実行
  - [ ] 成功/失敗メッセージの確認

- [ ] スキャンフロー
  - [ ] スキャン設定画面の表示
  - [ ] プロバイダー選択
  - [ ] スキャン実行
  - [ ] 進捗表示の確認
  - [ ] 結果画面への遷移

---

### 🚀 Phase 3: 長期（2-3ヶ月）

#### テストインフラの改善

##### カバレッジ測定
- [ ] バックエンド: \`tarpaulin\` または \`cargo-llvm-cov\` の導入
  \`\`\`bash
  cargo install cargo-tarpaulin
  cargo tarpaulin --out Html
  \`\`\`

- [ ] フロントエンド: Vitestカバレッジ設定の最適化
  \`\`\`bash
  npm run test:coverage
  \`\`\`

- [ ] カバレッジレポートの生成
  - [ ] HTML形式のレポート
  - [ ] CI/CD統合
  - [ ] カバレッジバッジの追加

##### CI/CDパイプライン
- [ ] GitHub Actionsワークフローの作成
  - [ ] バックエンドテストの自動実行
  - [ ] フロントエンドテストの自動実行
  - [ ] E2Eテストの自動実行
  - [ ] カバレッジレポートの生成とアップロード

- [ ] テスト実行の最適化
  - [ ] 並列実行の設定
  - [ ] キャッシュの活用
  - [ ] テスト分割

##### テストデータ管理
- [ ] フィクスチャの整備
  - [ ] バックエンド: テストデータJSON
  - [ ] フロントエンド: モックデータ
  - [ ] E2E: シードデータ

- [ ] テストヘルパーの作成
  - [ ] バックエンド: モックビルダー
  - [ ] フロントエンド: カスタムレンダラー
  - [ ] E2E: Page Objectパターン

#### 完全なE2Eテストスイート

##### エンドツーエンドシナリオ
- [ ] AWS完全フロー
  - [ ] AWS接続 → スキャン → リソース選択 → Terraform生成 → ダウンロード

- [ ] Azure完全フロー
  - [ ] Azure接続 → スキャン → リソース選択 → Terraform生成 → ダウンロード

- [ ] テンプレートカスタマイズフロー
  - [ ] テンプレート編集 → 検証 → 保存 → Terraform生成

##### エッジケースとエラーシナリオ
- [ ] 認証エラー
- [ ] ネットワークエラー
- [ ] タイムアウト
- [ ] 不正な入力
- [ ] 大量データの処理

#### パフォーマンステスト
- [ ] ロードテストの実装
  - [ ] 大量リソースのスキャン
  - [ ] 並行スキャンの処理
  - [ ] 大量リソースのTerraform生成

- [ ] ベンチマークの作成
  - [ ] バックエンド: \`criterion\` の使用
  - [ ] フロントエンド: Lighthouse CI

---

### 📈 カバレッジ目標

#### 短期目標（Phase 1完了時）
- バックエンド: 50% → 70%
- フロントエンド: 24% → 50%
- E2E: 0% → 基本フロー実装

#### 中期目標（Phase 2完了時）
- バックエンド: 70% → 80%
- フロントエンド: 50% → 70%
- E2E: 基本フロー → 全主要フロー

#### 長期目標（Phase 3完了時）
- バックエンド: 80%+
- フロントエンド: 70%+
- E2E: 全フロー + エッジケース
- CI/CD完全自動化
- カバレッジレポート自動生成

---

### 🔧 開発環境セットアップ

#### テスト実行コマンド

##### バックエンド
\`\`\`bash
# 全テスト実行
cargo test

# 特定のテスト実行
cargo test connection_service

# カバレッジ測定
cargo tarpaulin --out Html

# ウォッチモード
cargo watch -x test
\`\`\`

##### フロントエンド
\`\`\`bash
# 全テスト実行
npm run test:run

# ウォッチモード
npm run test

# カバレッジ測定
npm run test:coverage

# 特定のテスト実行
npm run test:run -- src/api/client.test.ts
\`\`\`

##### E2E
\`\`\`bash
# E2Eテスト実行
npx playwright test

# UIモード（デバッグ用）
npx playwright test --ui

# 特定のブラウザ
npx playwright test --project=chromium
\`\`\`

---

### 📝 テスト作成のガイドライン

#### バックエンド（Rust）
- \`#[cfg(test)]\` モジュールを使用
- \`#[tokio::test]\` で非同期テスト
- Arrange-Act-Assert パターン
- モックには \`mockall\` クレートを検討
- テスト名は \`test_<function>_<scenario>\` 形式

#### フロントエンド（TypeScript/React）
- \`vitest\` と \`@testing-library/react\` を使用
- コンポーネントは \`render()\` でマウント
- \`userEvent\` でユーザー操作をシミュレート
- \`waitFor()\` で非同期処理を待機
- \`vi.mock()\` でモジュールをモック

#### E2E（Playwright）
- Page Objectパターンを使用
- テストは独立して実行可能に
- \`test.describe()\` でグループ化
- \`test.beforeEach()\` でセットアップ
- スクリーンショットでデバッグ
