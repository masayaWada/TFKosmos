# CLAUDE.md

このファイルは、本リポジトリ内のコードを扱う際にClaude Code（claude.ai/code）に提供するガイダンスです。

## プロジェクト概要

TFKosmosは、既存のクラウドインフラストラクチャ（AWS/Azure IAMリソース）を分析し、Terraformコードとインポート定義を生成するツールです。名称は「TF」（Terraform）と「Kosmos」（ギリシャ語で秩序/調和を意味する）に由来し、混沌とした手動インフラから秩序あるInfrastructure as Codeへの変革を表しています。

## ビルドおよび実行コマンド

すべての起動・ビルドコマンドはMakefileで管理しています。

### 開発環境

```bash
make dev    # バックエンド + フロントエンドを起動
```

これにより以下が起動します：

- バックエンド：http://0.0.0.0:8000
- フロントエンド：http://localhost:5173

### Tauri デスクトップアプリ

```bash
make tauri  # Tauriデスクトップアプリを開発モードで起動
```

注：Tauriはバックエンドが必要なため、先に別ターミナルで `make dev` を実行してください。

### ビルド・クリーンアップ

```bash
make build    # 開発用ビルド
make release  # リリース用最適化ビルド
make clean    # ビルド成果物をクリーンアップ
```

### コマンド一覧

```bash
make help   # 利用可能なコマンドを表示
```

## アーキテクチャ

TFKosmosはレイヤードアーキテクチャを採用しています：

```
フロントエンド (React/TypeScript)
    ↓ HTTP/REST API
バックエンド (Rust/Axum)
    ├── API ルート (/api/connection, /api/scan, /api/resources, /api/generate, /api/templates)
    ├── サービス層 (ビジネスロジック調整)
    ├── ドメインモデル (IAMリソース)
    └── インフラストラクチャ層
        ├── AWS/Azureスキャナー (クラウドAPI統合)
        ├── テンプレートマネージャー (Jinja2テンプレート)
        └── Terraformジェネレーター (コード/インポート生成)
```

### バックエンド層構造

- **`src/api/routes/`**: Axumを使用したAPIエンドポイント定義
  - `connection.rs`: クラウド認証情報テスト
  - `scan.rs`: リソーススキャントリガー
  - `resources.rs`: リソースデータ取得
  - `generate.rs`: Terraformコード生成
  - `templates.rs`: テンプレート管理

- **`src/services/`**: ビジネスロジック層
  - `connection_service.rs`: 認証情報の検証
  - `scan_service.rs`: リソーススキャンのオーケストレーション
  - `resource_service.rs`: リソースデータ管理
  - `generation_service.rs`: Terraformコード生成
  - `template_service.rs`: テンプレートのCRUD操作

- **`src/infra/`**: インフラストラクチャ実装
  - `aws/scanner.rs`: AWS SDK経由のAWS IAMリソーススキャン
  - `azure/scanner.rs`: Azure SDK経由のAzure IAMリソーススキャン
  - `generators/`: Terraformコード生成ロジック
  - `templates/`: minijinjaによるテンプレートレンダリング

- **`src/models/`**: API用リクエスト/レスポンスDTO

- **`src/domain/`**: IAMリソース用ドメインモデル（ユーザー、グループ、ロール、ポリシーなど）

### テンプレートシステム

- **デフォルトテンプレート**: `backend/templates_default/terraform/{aws,azure}/*.tf.j2`
- **ユーザーテンプレート**: `backend/templates_user/` (実行時に生成、.gitignored対象)
- テンプレートは`minijinja`クレート経由でJinja2構文を使用
- `.tf`ファイルとインポートスクリプトの両方を生成

### フロントエンド構造

- **`src/pages/`**: ページコンポーネント (接続、スキャン、リソース、生成)
- **`src/components/`**: 再利用可能なUIコンポーネント
- **`src/api/`**: バックエンド通信用APIクライアント
- ナビゲーションにReact Routerを使用
- コード表示/編集にMonaco Editorを使用

## 主要技術

### バックエンド

- **Axum**: 非同期Webフレームワーク
- **Tokio**: 非同期ランタイム
- **AWS SDK for Rust**: AWS API統合
- **Azure SDK for Rust**: Azure API統合
- **minijinja**: テンプレートエンジン（Jinja2互換）
- **serde/serde_json**: シリアライゼーション

### フロントエンド

- **React 18**: UI フレームワーク
- **TypeScript**: 型安全
- **Vite**: ビルドツールおよび開発サーバー
- **Axios**: HTTP クライアント
- **Monaco Editor**: コードエディタコンポーネント
- **React Router**: ルーティング

### デスクトップアプリ

- **Tauri 2.x**: デスクトップアプリフレームワーク
- フロントエンドをネイティブシステム統合と共にバンドル
- バックエンドはローカルホスト:8000で別プロセスとして実行

## 開発ワークフロー

1. **API変更の実施**: `src/api/routes/`内のルートを更新、`src/services/`でロジックを実装、外部呼び出しにはインフラストラクチャ層を使用

2. **クラウドプロバイダーサポートの追加**: `src/infra/{provider}/scanner.rs` にスキャナーを作成、ドメインモデルを追加、`templates_default/terraform/{provider}/` にテンプレートを作成

3. **テンプレートの修正**: `templates_default/` 内の `.tf.j2` ファイルを編集、または UI 経由でカスタムテンプレートを作成

4. **フロントエンドの変更**: コンポーネントは`src/components/`、ページは`src/pages/`、API呼び出しは`src/api/`に配置

## コンパイルチェック

コード変更後は必ずコンパイルチェックを実行し、型エラー、参照エラー、文法エラーがないことを確認すること。

### Rust（バックエンド）

```bash
cd backend

# 型チェックと基本的なコンパイルエラー確認（高速）
cargo check

# フルビルド（依存関係も含む）
cargo build

# Clippy（Rust推奨のLinter）による詳細チェック
cargo clippy -- -D warnings
```

### TypeScript/JavaScript（フロントエンド）

```bash
cd frontend

# TypeScript型チェック（コンパイルなし）
npx tsc --noEmit

# ビルドチェック（型チェック + バンドル）
npm run build
```

### チェックの必須タイミング

- コード変更を行った後
- コミット前
- プルリクエスト作成前
- 各ファイル編集完了時

## Lintチェック

コードの品質と一貫性を保つため、必ずLintチェックを実行すること。

### Rust（バックエンド）

```bash
cd backend

# Clippy実行（警告をエラーとして扱う）
cargo clippy -- -D warnings

# 自動修正可能な問題を修正
cargo clippy --fix
```

#### Rust命名規則

- **モジュール/ファイル**: `snake_case` (例: `connection_service.rs`)
- **構造体/列挙型/トレイト**: `PascalCase` (例: `IAMUser`, `ScanService`)
- **関数/メソッド**: `snake_case` (例: `scan_resources`, `get_user`)
- **定数**: `SCREAMING_SNAKE_CASE` (例: `MAX_RETRY_COUNT`)
- **変数**: `snake_case` (例: `user_name`, `resource_list`)

### TypeScript/JavaScript（フロントエンド）

ESLintを使用してコード品質を維持します。

```bash
cd frontend

# ESLint実行
npx eslint src/

# 自動修正可能な問題を修正
npx eslint src/ --fix
```

#### TypeScript/JavaScript命名規則

- **ファイル/ディレクトリ**: `PascalCase` (コンポーネント) または `camelCase` (ユーティリティ)
  - 例: `ConnectionPage.tsx`, `apiClient.ts`
- **React コンポーネント**: `PascalCase` (例: `ScanPage`, `ResourceList`)
- **関数**: `camelCase` (例: `fetchResources`, `handleClick`)
- **変数/定数**: `camelCase` (例: `userName`, `apiEndpoint`)
- **グローバル定数**: `SCREAMING_SNAKE_CASE` (例: `API_BASE_URL`)
- **インターフェース/型**: `PascalCase` (例: `User`, `ScanResponse`)

### Lint実行の必須タイミング

- 新規コード追加時
- 既存コード修正時
- コミット前
- プルリクエスト作成前

### コードフォーマット

一貫したコードスタイルを維持するため、フォーマッターを使用すること。

#### Rust

```bash
cd backend
cargo fmt
```

#### TypeScript/JavaScript

Prettierなどのフォーマッターが設定されている場合は使用すること。

## タスク管理

作業の実行計画の策案を命じられた場合には、@TODO.md にTODOリストとしてMarkdownに記載してください。
また各タスクの実施が完了したらチェックボックスにチェックをするようにしてください。

## テストコード作成時の厳守事項

以下を必ず厳守すること

### テストコードの品質

- テストは必ず実際の機能を検証すること
- `expect(true).toBe(true)` のような意味のないアサーションは絶対に書かない
- 各テストケースは具体的な入力と期待される出力を検証すること
- モックは必要最低限に留め、実際の操作に近い形でテストすること

### ハードコーディングの禁止

- テストを通すためだけのハードコードは絶対に禁止
- 本番コードに `if(testMode)` のような条件分岐を入れない
- テスト用の特別な値（マジックナンバー）を本番コードに埋め込まない
- 環境変数や設定ファイルを使用して、テスト環境と本番環境を適切に分離すること

### テスト実装の原則

- テストが失敗する状態から始めること（Red-Green-Refactor）
- 境界値、異常系、エラーケースも必ずテストすること
- カバレッジだけでなく、実際の品質を重視すること
- テストケース名は何をテストしているか明確に記述すること

### 実装前の確認

- 機能の使用を正しく理解してからテストを書くこと
- 不明な点があれば、仮の実装ではなく、ユーザーに確認すること

### テストの独立性と再現性

- 各テストは他のテストに依存しないこと（実行順序に依存しない）
- テストは何度実行しても同じ結果になること（冪等性）
- 外部サービス（API、データベース、ファイルシステム）への依存は適切にモック化すること
- 日時やランダム値に依存するテストは、値を固定して再現性を確保すること

### テストデータの管理

- テストデータはテスト内で明示的に作成し、テスト後にクリーンアップすること
- テスト間で共有状態を持たないこと（グローバル変数の変更を避ける）
- 大量のテストデータが必要な場合は、ファクトリー関数やビルダーパターンを使用すること

### モックとスタブの適切な使用

- モックは外部依存（API呼び出し、DB操作）に対してのみ使用すること
- 内部実装の詳細をモックしすぎないこと（リファクタリング耐性が下がる）
- モックの振る舞いが本番環境と乖離しないよう注意すること
- スパイを使用する場合は、テスト後に必ずリストアすること

### 非同期処理のテスト

- 非同期テストでは必ず適切に `await` すること
- タイムアウトは明示的に設定し、テストが無限に待機しないようにすること
- `setTimeout` や `setInterval` を使用するコードは、タイマーモックを使用すること
- Promise の reject ケースも必ずテストすること

### テストの保守性

- テストコードもプロダクションコードと同様に可読性を重視すること
- 過度なDRYよりも、各テストの意図が明確に分かることを優先すること
- テストが失敗した際に、原因が特定しやすいアサーションメッセージを記述すること
- Arrange-Act-Assert（AAA）パターンでテストを構造化すること

### スナップショットテストの注意点

- スナップショットの差分は必ず目視で確認してから更新すること
- 意図しない変更を安易に `--update` で上書きしないこと
- 大きすぎるスナップショットは避け、必要な部分のみをテストすること

### テストファイルの配置

- テストファイルは対象ファイルと同じディレクトリに配置すること（コロケーション）
- ファイル名は `{対象ファイル名}.test.{ts,tsx}` の形式にすること
- 共通のテストユーティリティは `src/test/` ディレクトリに配置すること

## 重要事項

- **CORS**: バックエンドは全オリジンを許可（Vite開発サーバーとTauriの両方に対応）
- **認証情報**: 永続保存せず、実行時のみメモリ保持
- **出力**: 生成されたTerraformファイルは`backend/terraform-output/{session_id}/`に書き込まれる
- **テンプレート**: 初回生成時、システムはデフォルトをユーザーディレクトリにコピーする
- スキャン機能は、フロントエンドのみの開発モードでもバックエンドが稼働している必要がある
- Tauriアプリ設定は`deployment/src-tauri/tauri.conf.json`に記述

## ドキュメント

詳細な設計ドキュメントは `docs/` にあります：

- アーキテクチャ、データモデル、API仕様
- コンポーネント仕様
- エラー処理、セキュリティ上の考慮事項
- テスト戦略、デプロイガイド

完全なインデックスについては `docs/README.md` を参照してください。
