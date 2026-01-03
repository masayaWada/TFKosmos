---
description: Coding standards and naming conventions for Rust and TypeScript, including Serena MCP usage guidelines
---

# コーディング規約

このドキュメントは、TFKosmosプロジェクトにおけるコーディング規約とベストプラクティスを定義します。

## 目次

1. [命名規則](#命名規則)
2. [コードフォーマット](#コードフォーマット)
3. [コード解析ツール（Serena MCP）の利用](#コード解析ツールserena-mcpの利用)
4. [ドキュメントコメント](#ドキュメントコメント)
5. [コンポーネント構造（フロントエンド）](#コンポーネント構造フロントエンド)
6. [エラーハンドリング](#エラーハンドリング)
7. [非同期処理](#非同期処理)
8. [セキュリティ](#セキュリティ)
9. [Terraformコード記述規約](#terraformコード記述規約)

---

## 命名規則

### Rust（バックエンド）

適用対象: `backend/**/*.rs`

| 対象 | 規則 | 例 |
|------|------|-----|
| モジュール/ファイル | `snake_case` | `connection_service.rs`, `scan_service.rs` |
| 構造体/列挙型/トレイト | `PascalCase` | `IAMUser`, `ScanService`, `ApiError` |
| 関数/メソッド | `snake_case` | `scan_resources()`, `get_user()`, `validate_config()` |
| 定数 | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| 変数 | `snake_case` | `user_name`, `resource_list`, `scan_result` |
| ライフタイム | `'a`, `'b` など | `&'a str`, `&'static str` |
| ジェネリック型パラメータ | `T`, `U` など（1文字）または `PascalCase` | `<T>`, `<ResponseType>` |

**ベストプラクティス:**

- ファイル名はモジュール名と一致させる
- 公開APIには明確で説明的な名前を使用
- プライベート関数は `_` プレフィックスを避ける（Rustの慣例）
- `impl` ブロック内のメソッドは、構造体の責務に関連する名前にする

### TypeScript/JavaScript（フロントエンド）

適用対象: `frontend/src/**/*.{ts,tsx}`

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネントファイル | `PascalCase` | `ScanPage.tsx`, `ResourceList.tsx` |
| ユーティリティファイル | `camelCase` | `apiClient.ts`, `formatUtils.ts` |
| React コンポーネント | `PascalCase` | `function ScanPage()`, `const ResourceList = () => {}` |
| 関数 | `camelCase` | `fetchResources()`, `handleClick()`, `validateForm()` |
| 変数/定数 | `camelCase` | `scanResult`, `apiEndpoint`, `userName` |
| グローバル定数 | `SCREAMING_SNAKE_CASE` | `API_BASE_URL`, `MAX_RETRIES` |
| インターフェース/型 | `PascalCase` | `User`, `ScanConfig`, `ApiResponse` |
| 型エイリアス | `PascalCase` | `type UserId = string` |
| Enumの値 | `PascalCase` | `enum Status { Active, Inactive }` |

**ベストプラクティス:**

- Reactコンポーネントのファイル名はコンポーネント名と一致させる
- イベントハンドラは `handle` プレフィックス（例: `handleClick`, `handleSubmit`）
- ブール値は `is`, `has`, `should` プレフィックス（例: `isLoading`, `hasError`, `shouldRender`）
- カスタムフックは `use` プレフィックス（例: `useAuth`, `useFetch`）

---

## コードフォーマット

一貫したコードスタイルを維持するため、必ずフォーマッターを使用すること。

### Rust

```bash
cd backend

# フォーマット実行
cargo fmt

# フォーマットチェック（CI用）
cargo fmt -- --check
```

**設定ファイル:** `backend/rustfmt.toml`（プロジェクトに存在する場合）

### TypeScript/JavaScript

```bash
cd frontend

# ESLintによるフォーマットと自動修正
npx eslint src/ --fix

# Prettierが設定されている場合
npx prettier --write "src/**/*.{ts,tsx}"
```

**設定ファイル:** `frontend/.eslintrc.js`, `frontend/.prettierrc`

### フォーマットの必須タイミング

- コミット前（必須）
- プルリクエスト作成前（必須）
- コードレビュー指摘後の修正時

---

## コード解析ツール（Serena MCP）の利用

TFKosmosプロジェクトでは、Serena MCPサーバーを利用した効率的なコード解析を推奨しています。

### Serena MCPとは

Serena MCPは、セマンティックなコード解析機能を提供するModel Context Protocol（MCP）サーバーです。シンボルレベルでのコード理解、依存関係分析、リファクタリング支援などを行えます。

### 利用推奨場面

**Serena MCPの利用が推奨される場面:**

1. **コードベース全体の構造理解**
   - プロジェクトのアーキテクチャを把握したいとき
   - 新しい機能の実装箇所を検討するとき

2. **シンボル間の参照関係調査**
   - 特定の関数やクラスがどこで使われているか確認したいとき
   - 変更の影響範囲を特定したいとき

3. **クラス・関数・変数の使用箇所特定**
   - リファクタリング前の影響調査
   - 廃止予定APIの利用箇所の洗い出し

4. **ファイル間の依存関係分析**
   - モジュール間の結合度を確認したいとき
   - 循環依存の検出

5. **大規模リファクタリングの影響範囲調査**
   - APIの変更が他のコードに与える影響を確認
   - 安全なリファクタリング計画の立案

6. **設計パターンの実装箇所探索**
   - 既存のパターンの使い方を学習したいとき
   - 一貫性のある実装を行いたいとき

7. **バグの原因となる関連コード特定**
   - バグの根本原因を追跡したいとき
   - 関連する処理フローを理解したいとき

**通常ツール（Read, Grep, Glob等）の利用が推奨される場面:**

1. **単純なファイル読み込み・編集**
   - 既知のファイルパスへの直接アクセス
   - 特定ファイルの内容確認

2. **既知のファイル・関数への直接的な変更**
   - ファイルパスとシンボル名が明確な場合
   - 小規模な修正

3. **シンプルな文字列検索・置換**
   - 設定値の変更
   - ドキュメント内の文字列検索

### Serena MCPの主要ツール

#### 1. シンボル探索

```typescript
// クラスや関数を名前で検索
mcp__serena__find_symbol({
  name_path_pattern: "ScanService",  // クラス名
  relative_path: "backend/src",       // オプション：検索範囲を限定
  include_body: true,                 // コードも取得
  depth: 1                           // 子要素（メソッド等）も取得
})

// メソッド名で検索（部分一致）
mcp__serena__find_symbol({
  name_path_pattern: "scan",
  substring_matching: true,  // "scan_users", "scan_resources" などもマッチ
})
```

#### 2. 参照元の検索

```typescript
// 特定のシンボルを使用している箇所を検索
mcp__serena__find_referencing_symbols({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs"
})
```

#### 3. シンボル概要の取得

```typescript
// ファイル内のシンボル一覧を取得（コード本体なし）
mcp__serena__get_symbols_overview({
  relative_path: "backend/src/services/scan_service.rs",
  depth: 1  // トップレベルとその子要素
})
```

#### 4. パターン検索

```typescript
// 正規表現によるコード検索
mcp__serena__search_for_pattern({
  substring_pattern: "async fn.*scan",  // 正規表現
  relative_path: "backend/src",
  restrict_search_to_code_files: true,  // コードファイルのみ
  context_lines_before: 2,
  context_lines_after: 2
})
```

#### 5. シンボル編集

```typescript
// シンボルの本体を置換
mcp__serena__replace_symbol_body({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs",
  body: "新しいコード"
})

// シンボルの前に挿入
mcp__serena__insert_before_symbol({
  name_path: "ScanService",
  relative_path: "backend/src/services/scan_service.rs",
  body: "// 新しいコメントや関数"
})

// シンボルの後に挿入
mcp__serena__insert_after_symbol({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs",
  body: "// 新しいメソッド"
})
```

#### 6. シンボルのリネーム

```typescript
// コードベース全体でシンボル名を変更
mcp__serena__rename_symbol({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs",
  new_name: "scan_iam_users"
})
```

### Serena利用のベストプラクティス

1. **段階的な情報取得**
   - まず `get_symbols_overview` でファイル構造を把握
   - 必要なシンボルだけ `find_symbol` で詳細取得
   - 全ファイル読み込みは最終手段

2. **検索範囲の限定**
   - `relative_path` パラメータで検索範囲を絞る
   - 不必要な検索を避けることでパフォーマンス向上

3. **シンボルベースの編集**
   - 関数・クラス単位の変更には `replace_symbol_body` を使用
   - 数行だけの変更は通常の `Edit` ツールを使用

4. **影響範囲の事前確認**
   - リファクタリング前に `find_referencing_symbols` で使用箇所を確認
   - 破壊的変更の場合は全ての参照元を更新

5. **効率的なワークフロー**
   ```
   1. get_symbols_overview でファイル構造を把握
   2. find_symbol で必要なシンボルの詳細を取得
   3. find_referencing_symbols で影響範囲を確認
   4. replace_symbol_body または Edit で変更を実施
   5. テストとビルドで検証
   ```

### 具体例：リファクタリング時のワークフロー

**例：`ScanService::scan_users` メソッドのリファクタリング**

```typescript
// ステップ1: メソッドの現在の実装を確認
mcp__serena__find_symbol({
  name_path_pattern: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs",
  include_body: true
})

// ステップ2: このメソッドを使用している箇所を確認
mcp__serena__find_referencing_symbols({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs"
})

// ステップ3: メソッドの実装を更新
mcp__serena__replace_symbol_body({
  name_path: "ScanService/scan_users",
  relative_path: "backend/src/services/scan_service.rs",
  body: `
    pub async fn scan_users(&self, config: &ScanConfig) -> Result<Vec<User>> {
        // 新しい実装
        let users = self.client.list_users().await?;
        Ok(users)
    }
  `
})

// ステップ4: テストとビルド確認
// cargo test && cargo build
```

---

## ドキュメントコメント

### Rust

```rust
/// ユーザーをスキャンして結果を返す
///
/// # Arguments
///
/// * `config` - スキャン設定
///
/// # Returns
///
/// スキャン結果のベクター
///
/// # Errors
///
/// AWS APIへの接続に失敗した場合に `ScanError` を返す
///
/// # Examples
///
/// ```
/// let config = ScanConfig::default();
/// let users = service.scan_users(&config).await?;
/// ```
pub async fn scan_users(&self, config: &ScanConfig) -> Result<Vec<User>, ScanError> {
    // 実装
}
```

**ドキュメント生成:**

```bash
cd backend
cargo doc --open
```

### TypeScript/React

```typescript
/**
 * リソースをスキャンしてリストを取得する
 *
 * @param provider - クラウドプロバイダー（"aws" | "azure"）
 * @param config - スキャン設定
 * @returns スキャン結果のPromise
 * @throws {ApiError} API通信に失敗した場合
 *
 * @example
 * ```typescript
 * const resources = await scanResources("aws", { region: "us-east-1" });
 * ```
 */
export async function scanResources(
  provider: CloudProvider,
  config: ScanConfig
): Promise<Resource[]> {
  // 実装
}
```

**TSDocの推奨タグ:**

- `@param` - パラメータの説明
- `@returns` - 戻り値の説明
- `@throws` - スローされる例外
- `@example` - 使用例
- `@deprecated` - 廃止予定のAPI

---

## コンポーネント構造（フロントエンド）

### 推奨構造

```typescript
import { useState, useEffect } from 'react';

/**
 * Props の型定義
 */
interface ScanPageProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

/**
 * スキャンページコンポーネント
 */
export default function ScanPage({ title, onSubmit }: ScanPageProps) {
  // State declarations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effects
  useEffect(() => {
    // 副作用の処理
  }, []);

  // Event handlers
  const handleSubmit = () => {
    // イベントハンドラの実装
  };

  // Helper functions（必要に応じて）
  const validateForm = () => {
    // バリデーションロジック
  };

  // Early return for loading/error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Main render
  return (
    <div>
      <h1>{title}</h1>
      {/* コンポーネントのJSX */}
    </div>
  );
}
```

### ディレクトリ構造

```
frontend/src/
├── components/       # 再利用可能なコンポーネント
│   ├── common/      # 汎用コンポーネント（Button, Input等）
│   ├── layout/      # レイアウトコンポーネント
│   └── features/    # 機能固有のコンポーネント
├── pages/           # ページコンポーネント
├── hooks/           # カスタムフック
├── utils/           # ユーティリティ関数
├── api/             # API通信層
├── types/           # 型定義
└── constants/       # 定数定義
```

---

## エラーハンドリング

### Rust

```rust
use thiserror::Error;

/// スキャンエラーの種類
#[derive(Error, Debug)]
pub enum ScanError {
    #[error("AWS APIエラー: {0}")]
    AwsError(String),

    #[error("認証エラー: {0}")]
    AuthenticationError(String),

    #[error("設定エラー: {0}")]
    ConfigError(String),

    #[error("内部エラー: {0}")]
    Internal(#[from] anyhow::Error),
}

/// Result型のエイリアス
pub type Result<T> = std::result::Result<T, ScanError>;
```

**エラーハンドリングのベストプラクティス:**

- `?` 演算子を活用
- コンテキスト情報を含めたエラーメッセージ
- 適切なエラー型の使い分け（`thiserror`, `anyhow`）

### TypeScript

```typescript
/**
 * APIエラークラス
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * エラーハンドリング付きのAPI呼び出し
 */
async function fetchWithErrorHandling<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new ApiError(
        `HTTP Error: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('ネットワークエラーが発生しました');
  }
}
```

---

## 非同期処理

### Rust

```rust
use tokio;

/// 非同期関数の例
pub async fn scan_resources(&self) -> Result<Vec<Resource>> {
    // 複数の非同期処理を並行実行
    let (users, groups, roles) = tokio::try_join!(
        self.scan_users(),
        self.scan_groups(),
        self.scan_roles()
    )?;

    // 結果の統合
    let mut resources = Vec::new();
    resources.extend(users);
    resources.extend(groups);
    resources.extend(roles);

    Ok(resources)
}
```

### TypeScript

```typescript
/**
 * 複数のリソースを並行スキャン
 */
async function scanAllResources(): Promise<Resource[]> {
  const [users, groups, roles] = await Promise.all([
    scanUsers(),
    scanGroups(),
    scanRoles()
  ]);

  return [...users, ...groups, ...roles];
}

/**
 * Reactコンポーネントでの非同期処理
 */
export default function ResourceList() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const data = await scanAllResources();
        if (!cancelled) {
          setResources(data);
        }
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // クリーンアップ関数
    return () => {
      cancelled = true;
    };
  }, []);

  // レンダリング処理
}
```

---

## セキュリティ

### 機密情報の取り扱い

**禁止事項:**

- 認証情報をコードに直接記述しない
- 環境変数の値をログ出力しない
- パスワードやトークンを平文で保存しない

**推奨事項:**

- 認証情報は環境変数またはシークレット管理サービスから取得
- ログには機密情報を含めない
- `.gitignore` で機密ファイルを除外

### 入力バリデーション

```rust
/// 入力バリデーションの例
pub fn validate_region(region: &str) -> Result<()> {
    const VALID_REGIONS: &[&str] = &[
        "us-east-1", "us-west-2", "ap-northeast-1"
    ];

    if !VALID_REGIONS.contains(&region) {
        return Err(ScanError::ConfigError(
            format!("無効なリージョン: {}", region)
        ));
    }

    Ok(())
}
```

```typescript
/**
 * 入力サニタイズの例
 */
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // XSS対策
    .slice(0, 100);       // 長さ制限
}
```

---

## Terraformコード記述規約

適用対象: `backend/templates_default/terraform/**/*.tf.j2`, 生成されたTerraformコード

### IAMポリシーの記述方法

IAMポリシーは、`data "aws_iam_policy_document"` ブロックを使用してHCL形式で記述すること。JSONで直接記述しないこと。

#### ✅ 推奨される記述方法

```hcl
data "aws_iam_policy_document" "athena_policy" {
  statement {
    sid    = "AthenaQueryExecution"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "arn:aws:s3:::my-bucket",
      "arn:aws:s3:::my-bucket/*"
    ]
  }

  statement {
    sid    = "GlueAccess"
    effect = "Allow"
    actions = [
      "glue:GetTable",
      "glue:GetDatabase"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "athena_policy" {
  name        = "AthenaQueryPolicy"
  description = "Policy for Athena query execution"
  policy      = data.aws_iam_policy_document.athena_policy.json
}
```

#### ❌ 非推奨の記述方法

```hcl
# JSONを直接記述する方法（使用しないこと）
resource "aws_iam_policy" "athena_policy" {
  name        = "AthenaQueryPolicy"
  description = "Policy for Athena query execution"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AthenaQueryExecution"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::my-bucket",
          "arn:aws:s3:::my-bucket/*"
        ]
      }
    ]
  })
}
```

### 推奨する理由

1. **可読性**: HCL形式で記述することで、コードが読みやすく、メンテナンスしやすくなる
2. **型安全性**: Terraformの型チェックが有効に機能し、設定ミスを早期に発見できる
3. **再利用性**: `data "aws_iam_policy_document"` は他のポリシードキュメントと組み合わせて使用できる
4. **検証**: `terraform validate` や `terraform plan` での検証が容易になる
5. **IDE支援**: エディタの自動補完やシンタックスハイライトが適切に機能する

### ベストプラクティス

1. **Statement IDの明記**
   - 各 `statement` ブロックには必ず `sid` を指定する
   - `sid` は Statement の目的を明確に表す名前にする

2. **Effectの明示**
   - `effect` は明示的に `"Allow"` または `"Deny"` を指定する
   - デフォルト値に依存しない

3. **Actionのグループ化**
   - 関連するアクションは同じ `statement` ブロックにまとめる
   - 異なる目的のアクションは別の `statement` ブロックに分ける

4. **Resourceの具体化**
   - 可能な限り具体的なARNを指定する
   - `"*"` の使用は最小限に抑える

### Jinja2テンプレートでの使用例

```jinja2
{# backend/templates_default/terraform/aws/iam_policy.tf.j2 #}

data "aws_iam_policy_document" "{{ policy.name }}_policy" {
  {% for statement in policy.statements %}
  statement {
    sid    = "{{ statement.sid }}"
    effect = "{{ statement.effect }}"
    actions = [
      {% for action in statement.actions %}
      "{{ action }}",
      {% endfor %}
    ]
    resources = [
      {% for resource in statement.resources %}
      "{{ resource }}",
      {% endfor %}
    ]
  }
  {% endfor %}
}

resource "aws_iam_policy" "{{ policy.name }}" {
  name        = "{{ policy.display_name }}"
  description = "{{ policy.description }}"
  policy      = data.aws_iam_policy_document.{{ policy.name }}_policy.json
}
```

### 関連リンク

- [Terraform AWS Provider - aws_iam_policy_document](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document)
- [AWS IAM Policy Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

---

## 関連ドキュメント

- [ビルドとLint](.build-and-lint.md) - コンパイルチェックとLint実行方法
- [テストガイドライン](./testing-guidelines.md) - テストコード作成ガイドライン
- [アーキテクチャ](./architecture.md) - システムアーキテクチャ
- [コミット戦略](./commit-strategy.md) - コミットメッセージ規約

---

## 更新履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-01-04 | Terraformコード記述規約を追加 | @wadamasaya |
| 2026-01-01 | Serena MCP利用ガイドラインを追加 | @wadamasaya |
| 2025-12-XX | 初版作成 | @wadamasaya |
