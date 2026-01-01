# TFKosmos 機能拡張 実行計画

## 概要

以下の4つの機能拡張を実装する：

1. **テンプレートバリデーション** - テンプレート編集時のリアルタイム構文チェック
2. **依存関係可視化** - リソース間の関係をグラフで表示
3. **インポートプレビュー** - Terraform validate/plan によるドライラン
4. **カスタムフィルター** - クエリ言語によるリソースフィルタリング

## 1. テンプレートバリデーション

### 1.1 目的

テンプレート編集中にJinja2構文エラーとTerraform構文エラーをリアルタイムで検出・表示する。

### 1.2 機能要件

- [ ] **Jinja2構文チェック**: minijinjaでパースし、構文エラーを検出
- [ ] **Terraform構文チェック**: レンダリング後のコードを `terraform fmt -check` で検証
- [ ] **リアルタイム表示**: Monaco Editorのマーカー機能でエラー位置を表示
- [ ] **デバウンス**: 入力完了後500msでバリデーション実行（API負荷軽減）

### 1.3 バックエンド実装

#### 1.3.1 型定義の追加

**ファイル**: `backend/src/models/mod.rs`

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationError {
    pub error_type: String,  // "jinja2" | "terraform"
    pub message: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateValidationResponse {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}
```

#### 1.3.2 サービス層の変更

**ファイル**: `backend/src/services/template_service.rs`

**追加メソッド**:

```rust
impl TemplateService {
    /// テンプレートの構文を検証する（レンダリングは行わない）
    pub async fn validate_template(
        template_name: &str,
        template_content: &str,
    ) -> Result<TemplateValidationResponse> {
        let mut errors = Vec::new();

        // 1. Jinja2構文チェック（minijinjaでパース）
        let mut env = minijinja::Environment::new();
        if let Err(e) = env.add_template(template_name, template_content) {
            errors.push(ValidationError {
                error_type: "jinja2".to_string(),
                message: e.to_string(),
                line: e.line().map(|l| l as u32),
                column: None,
            });
        }

        // 2. レンダリングテスト（サンプルコンテキストで）
        if errors.is_empty() {
            let sample_context = Self::generate_sample_context(template_name);
            if let Err(e) = env.get_template(template_name)
                .and_then(|t| t.render(&sample_context))
            {
                errors.push(ValidationError {
                    error_type: "jinja2".to_string(),
                    message: format!("レンダリングエラー: {}", e),
                    line: None,
                    column: None,
                });
            }
        }

        Ok(TemplateValidationResponse {
            valid: errors.is_empty(),
            errors,
        })
    }
}
```

#### 1.3.3 APIエンドポイントの追加

**ファイル**: `backend/src/api/routes/templates.rs`

**変更箇所**: `router()` 関数に新規ルート追加

```rust
pub fn router() -> Router {
    Router::new()
        .route("/", get(list_templates))
        .route("/validate/*template_name", post(validate_template))  // 追加
        .route("/preview/*template_name", post(preview_template))
        // ... 既存ルート
}

#[derive(serde::Deserialize)]
struct ValidateTemplateRequest {
    content: String,
}

async fn validate_template(
    Path(template_name): Path<String>,
    Json(request): Json<ValidateTemplateRequest>,
) -> Result<Json<TemplateValidationResponse>, ApiError> {
    TemplateService::validate_template(&template_name, &request.content)
        .await
        .map(Json)
        .map_err(|e| ApiError::Internal(e.to_string()))
}
```

### 1.4 フロントエンド実装

#### 1.4.1 APIクライアントの拡張

**ファイル**: `frontend/src/api/templates.ts`

**追加**:

```typescript
export interface ValidationError {
  error_type: 'jinja2' | 'terraform'
  message: string
  line?: number
  column?: number
}

export interface ValidationResponse {
  valid: boolean
  errors: ValidationError[]
}

export const templatesApi = {
  // ... 既存メソッド

  validate: async (resourceType: string, content: string): Promise<ValidationResponse> => {
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.post(`/templates/validate/${encodedResourceType}`, {
      content
    })
    return response.data
  }
}
```

#### 1.4.2 バリデーションエラー表示コンポーネント

**ファイル**: `frontend/src/components/templates/ValidationErrors.tsx` (新規)

```typescript
import { ValidationError } from '../../api/templates'

interface Props {
  errors: ValidationError[]
  onErrorClick?: (error: ValidationError) => void
}

export default function ValidationErrors({ errors, onErrorClick }: Props) {
  if (errors.length === 0) return null

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '4px',
      padding: '0.75rem',
      marginBottom: '1rem'
    }}>
      <strong>バリデーションエラー ({errors.length})</strong>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
        {errors.map((error, index) => (
          <li
            key={index}
            onClick={() => onErrorClick?.(error)}
            style={{ cursor: error.line ? 'pointer' : 'default', color: '#856404' }}
          >
            [{error.error_type}]
            {error.line && ` 行${error.line}`}
            {error.column && `:${error.column}`}
            : {error.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

#### 1.4.3 TemplatesPage の変更

**ファイル**: `frontend/src/pages/TemplatesPage.tsx`

**変更箇所**:

```typescript
// 追加インポート
import { useCallback, useRef } from 'react'
import ValidationErrors from '../components/templates/ValidationErrors'
import { ValidationError, ValidationResponse } from '../api/templates'
import * as monaco from 'monaco-editor'

// 追加ステート
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
const [isValidating, setIsValidating] = useState(false)
const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

// デバウンス付きバリデーション関数
const validateContent = useCallback(async (content: string) => {
  if (!selectedTemplate || !content) return

  setIsValidating(true)
  try {
    const result = await templatesApi.validate(selectedTemplate.resource_type, content)
    setValidationErrors(result.errors)

    // Monaco Editorにマーカーを設定
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        const markers = result.errors
          .filter(e => e.line)
          .map(e => ({
            severity: monaco.MarkerSeverity.Error,
            message: e.message,
            startLineNumber: e.line!,
            startColumn: e.column || 1,
            endLineNumber: e.line!,
            endColumn: e.column ? e.column + 1 : 1000,
          }))
        monaco.editor.setModelMarkers(model, 'template-validation', markers)
      }
    }
  } catch (err) {
    console.error('Validation failed:', err)
  } finally {
    setIsValidating(false)
  }
}, [selectedTemplate])

// エディタ変更時のハンドラ修正
const handleEditorChange = (value: string | undefined) => {
  setEditorContent(value || '')

  // デバウンス: 500ms後にバリデーション実行
  if (validationTimeoutRef.current) {
    clearTimeout(validationTimeoutRef.current)
  }
  validationTimeoutRef.current = setTimeout(() => {
    validateContent(value || '')
  }, 500)
}

// エディタマウント時のハンドラ
const handleEditorMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
  editorRef.current = editor
}

// JSX内に追加
<ValidationErrors
  errors={validationErrors}
  onErrorClick={(error) => {
    if (error.line && editorRef.current) {
      editorRef.current.revealLineInCenter(error.line)
      editorRef.current.setPosition({ lineNumber: error.line, column: error.column || 1 })
    }
  }}
/>

// Editorコンポーネントの変更
<Editor
  height="400px"
  defaultLanguage="hcl"
  value={editorContent}
  onChange={handleEditorChange}
  onMount={handleEditorMount}
  theme="vs-dark"
/>
```

### 1.5 実装タスク

- [ ] 1.5.1 `backend/src/models/mod.rs` に `ValidationError`, `TemplateValidationResponse` 型追加
- [ ] 1.5.2 `backend/src/services/template_service.rs` に `validate_template()` メソッド追加
- [ ] 1.5.3 `backend/src/api/routes/templates.rs` に `/validate/*` エンドポイント追加
- [ ] 1.5.4 `frontend/src/api/templates.ts` に `validate()` メソッドと型定義追加
- [ ] 1.5.5 `frontend/src/components/templates/ValidationErrors.tsx` 新規作成
- [ ] 1.5.6 `frontend/src/pages/TemplatesPage.tsx` にバリデーション機能統合
- [ ] 1.5.7 単体テスト: `validate_template()` のテスト追加
- [ ] 1.5.8 動作確認: 構文エラーのあるテンプレートでエラー表示確認

---

## 2. カスタムリソースフィルター

### 2.1 目的

タグ、名前パターン、リソース属性などの条件でリソースを柔軟にフィルタリングする。

### 2.2 クエリ言語仕様

```text
# 基本構文
field operator value

# 演算子
==    等価
!=    不等価
LIKE  パターンマッチ（* をワイルドカードとして使用）
IN    配列に含まれる

# 論理演算子
AND   論理積
OR    論理和
NOT   否定
()    グループ化

# 例
user_name == "admin"
tags.env == "production"
path LIKE "/admin/*"
arn IN ["arn:aws:iam::123:policy/Admin", "arn:aws:iam::123:policy/ReadOnly"]
tags.env == "production" AND user_name LIKE "app-*"
(path == "/" OR path LIKE "/admin/*") AND NOT tags.temporary == "true"
```

### 2.3 バックエンド実装

#### 2.3.1 クエリモジュールの作成

**ファイル**: `backend/src/infra/query/mod.rs` (新規)

```rust
pub mod lexer;
pub mod parser;
pub mod evaluator;

pub use evaluator::QueryEvaluator;
pub use parser::QueryParser;
```

**ファイル**: `backend/src/infra/query/lexer.rs` (新規)

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Identifier(String),    // フィールド名
    String(String),        // "value"
    Number(f64),           // 123, 45.6
    Boolean(bool),         // true, false
    Operator(Operator),    // ==, !=, LIKE, IN
    LogicalOp(LogicalOp),  // AND, OR, NOT
    LParen,                // (
    RParen,                // )
    LBracket,              // [
    RBracket,              // ]
    Comma,                 // ,
    Dot,                   // .
    Eof,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Operator {
    Eq,      // ==
    Ne,      // !=
    Like,    // LIKE
    In,      // IN
}

#[derive(Debug, Clone, PartialEq)]
pub enum LogicalOp {
    And,
    Or,
    Not,
}

pub struct Lexer<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }

    pub fn tokenize(&mut self) -> Result<Vec<Token>, String> {
        let mut tokens = Vec::new();
        while let Some(token) = self.next_token()? {
            tokens.push(token);
        }
        tokens.push(Token::Eof);
        Ok(tokens)
    }

    fn next_token(&mut self) -> Result<Option<Token>, String> {
        self.skip_whitespace();
        if self.pos >= self.input.len() {
            return Ok(None);
        }
        // ... トークン解析ロジック
    }

    // ... その他のヘルパーメソッド
}
```

**ファイル**: `backend/src/infra/query/parser.rs` (新規)

```rust
use super::lexer::{Token, Operator, LogicalOp};

#[derive(Debug, Clone)]
pub enum Expr {
    Comparison {
        field: Vec<String>,  // ["tags", "env"] for tags.env
        operator: Operator,
        value: Value,
    },
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Not(Box<Expr>),
}

#[derive(Debug, Clone)]
pub enum Value {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<Value>),
}

pub struct QueryParser {
    tokens: Vec<Token>,
    pos: usize,
}

impl QueryParser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    pub fn parse(&mut self) -> Result<Expr, String> {
        self.parse_or_expr()
    }

    fn parse_or_expr(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_and_expr()?;
        while self.match_token(&Token::LogicalOp(LogicalOp::Or)) {
            let right = self.parse_and_expr()?;
            left = Expr::Or(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    // ... その他のパース関数
}
```

**ファイル**: `backend/src/infra/query/evaluator.rs` (新規)

```rust
use super::parser::{Expr, Value};
use super::lexer::Operator;
use serde_json::Value as JsonValue;

pub struct QueryEvaluator;

impl QueryEvaluator {
    pub fn evaluate(expr: &Expr, resource: &JsonValue) -> bool {
        match expr {
            Expr::Comparison { field, operator, value } => {
                let field_value = Self::get_nested_field(resource, field);
                Self::compare(field_value, operator, value)
            }
            Expr::And(left, right) => {
                Self::evaluate(left, resource) && Self::evaluate(right, resource)
            }
            Expr::Or(left, right) => {
                Self::evaluate(left, resource) || Self::evaluate(right, resource)
            }
            Expr::Not(inner) => !Self::evaluate(inner, resource),
        }
    }

    fn get_nested_field(resource: &JsonValue, field: &[String]) -> Option<&JsonValue> {
        let mut current = resource;
        for key in field {
            current = current.get(key)?;
        }
        Some(current)
    }

    fn compare(field_value: Option<&JsonValue>, op: &Operator, expected: &Value) -> bool {
        // ... 比較ロジック
    }
}
```

#### 2.3.2 サービス層の変更

**ファイル**: `backend/src/services/resource_service.rs`

**追加メソッド**:

```rust
use crate::infra::query::{QueryParser, QueryEvaluator};
use crate::infra::query::lexer::Lexer;

impl ResourceService {
    pub async fn query_resources(
        scan_id: &str,
        query: &str,
        resource_type: Option<&str>,
        page: u32,
        page_size: u32,
    ) -> Result<ResourceListResponse> {
        // 1. クエリをパース
        let mut lexer = Lexer::new(query);
        let tokens = lexer.tokenize()
            .map_err(|e| anyhow::anyhow!("クエリ構文エラー: {}", e))?;
        let mut parser = QueryParser::new(tokens);
        let expr = parser.parse()
            .map_err(|e| anyhow::anyhow!("クエリパースエラー: {}", e))?;

        // 2. リソース取得
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        // 3. フィルタリング
        let mut all_resources: Vec<Value> = Vec::new();
        // ... リソース収集ロジック

        let filtered: Vec<Value> = all_resources
            .into_iter()
            .filter(|resource| QueryEvaluator::evaluate(&expr, resource))
            .collect();

        // 4. ページネーション
        // ... 既存のページネーションロジック

        Ok(ResourceListResponse { /* ... */ })
    }
}
```

#### 2.3.3 APIエンドポイントの追加

**ファイル**: `backend/src/api/routes/resources.rs`

**追加**:

```rust
pub fn router() -> Router {
    Router::new()
        .route("/:scan_id", get(get_resources))
        .route("/:scan_id/query", post(query_resources))  // 追加
        .route("/:scan_id/select", post(select_resources))
        .route("/:scan_id/select", get(get_selected_resources))
}

#[derive(Deserialize)]
struct QueryResourcesRequest {
    query: String,
    #[serde(rename = "type")]
    resource_type: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
}

async fn query_resources(
    Path(scan_id): Path<String>,
    Json(request): Json<QueryResourcesRequest>,
) -> Result<Json<ResourceListResponse>, ApiError> {
    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(50);

    ResourceService::query_resources(
        &scan_id,
        &request.query,
        request.resource_type.as_deref(),
        page,
        page_size,
    )
    .await
    .map(Json)
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("構文エラー") || msg.contains("パースエラー") {
            ApiError::Validation(msg)
        } else if msg.contains("not found") {
            ApiError::NotFound(msg)
        } else {
            ApiError::Internal(msg)
        }
    })
}
```

### 2.4 フロントエンド実装

#### 2.4.1 APIクライアントの拡張

**ファイル**: `frontend/src/api/resources.ts`

**追加**:

```typescript
export const resourcesApi = {
  // ... 既存メソッド

  query: async (
    scanId: string,
    query: string,
    options?: { type?: string; page?: number; pageSize?: number }
  ): Promise<ResourceListResponse> => {
    const response = await apiClient.post(`/resources/${scanId}/query`, {
      query,
      type: options?.type,
      page: options?.page,
      page_size: options?.pageSize,
    })
    return response.data
  }
}
```

#### 2.4.2 クエリ入力コンポーネント

**ファイル**: `frontend/src/components/resources/QueryInput.tsx` (新規)

```typescript
import { useState } from 'react'

interface Props {
  onQuery: (query: string) => void
  onClear: () => void
  isLoading?: boolean
  error?: string
}

export default function QueryInput({ onQuery, onClear, isLoading, error }: Props) {
  const [query, setQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onQuery(query.trim())
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='例: tags.env == "production" AND user_name LIKE "app-*"'
          style={{
            flex: 1,
            padding: '0.5rem',
            border: error ? '1px solid #dc3545' : '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '検索中...' : '検索'}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('')
            onClear()
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          クリア
        </button>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          style={{
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ?
        </button>
      </form>

      {error && (
        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {error}
        </div>
      )}

      {showHelp && (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '1rem',
          marginTop: '0.5rem',
          fontSize: '0.875rem',
        }}>
          <strong>クエリ構文</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li><code>field == "value"</code> - 等価</li>
            <li><code>field != "value"</code> - 不等価</li>
            <li><code>field LIKE "pattern*"</code> - パターンマッチ</li>
            <li><code>field IN ["a", "b"]</code> - 配列に含まれる</li>
            <li><code>expr AND expr</code> - 論理積</li>
            <li><code>expr OR expr</code> - 論理和</li>
            <li><code>NOT expr</code> - 否定</li>
            <li><code>tags.env</code> - ネストフィールドアクセス</li>
          </ul>
        </div>
      )}
    </div>
  )
}
```

#### 2.4.3 ResourcesPage の変更

**ファイル**: `frontend/src/pages/ResourcesPage.tsx`

**変更箇所**: 検索UIにクエリモードを追加

```typescript
// 追加ステート
const [queryMode, setQueryMode] = useState<'simple' | 'advanced'>('simple')
const [queryError, setQueryError] = useState<string | null>(null)

// クエリ実行ハンドラ
const handleQuery = async (query: string) => {
  setQueryError(null)
  try {
    const result = await resourcesApi.query(scanId, query, {
      type: selectedTab,
      page: 1,
      pageSize: 50,
    })
    setResources(result.resources)
    setTotalPages(result.total_pages)
    setCurrentPage(1)
  } catch (err: any) {
    setQueryError(err.response?.data?.detail || err.message || 'クエリ実行エラー')
  }
}

// JSX内に追加（検索フォームの上）
<div style={{ marginBottom: '1rem' }}>
  <label>
    <input
      type="radio"
      checked={queryMode === 'simple'}
      onChange={() => setQueryMode('simple')}
    />
    シンプル検索
  </label>
  <label style={{ marginLeft: '1rem' }}>
    <input
      type="radio"
      checked={queryMode === 'advanced'}
      onChange={() => setQueryMode('advanced')}
    />
    高度なクエリ
  </label>
</div>

{queryMode === 'advanced' && (
  <QueryInput
    onQuery={handleQuery}
    onClear={() => loadResources()}
    isLoading={loading}
    error={queryError || undefined}
  />
)}
```

### 2.5 実装タスク

- [ ] 2.5.1 `backend/src/infra/query/lexer.rs` - レクサー実装
- [ ] 2.5.2 `backend/src/infra/query/parser.rs` - パーサー実装
- [ ] 2.5.3 `backend/src/infra/query/evaluator.rs` - エバリュエーター実装
- [ ] 2.5.4 `backend/src/infra/query/mod.rs` - モジュール定義
- [ ] 2.5.5 `backend/src/infra/mod.rs` に `query` モジュール追加
- [ ] 2.5.6 `backend/src/services/resource_service.rs` に `query_resources()` 追加
- [ ] 2.5.7 `backend/src/api/routes/resources.rs` に `/query` エンドポイント追加
- [ ] 2.5.8 `frontend/src/api/resources.ts` に `query()` 追加
- [ ] 2.5.9 `frontend/src/components/resources/QueryInput.tsx` 新規作成
- [ ] 2.5.10 `frontend/src/pages/ResourcesPage.tsx` にクエリUI統合
- [ ] 2.5.11 単体テスト: レクサーのテスト
- [ ] 2.5.12 単体テスト: パーサーのテスト
- [ ] 2.5.13 単体テスト: エバリュエーターのテスト

---

## 3. 依存関係可視化

### 3.1 目的

スキャンしたリソース間の依存関係をグラフで可視化し、影響範囲の把握とインポート順序の理解を支援する。

### 3.2 依存関係の種類

| 関係タイプ       | From            | To             | データソース             |
| ---------------- | --------------- | -------------- | ------------------------ |
| PolicyAttachment | User/Group/Role | Policy         | attachments テーブル     |
| GroupMembership  | User            | Group          | groups.members           |
| RoleAssignment   | Principal       | RoleDefinition | role_assignments (Azure) |

### 3.3 バックエンド実装

#### 3.3.1 型定義

**ファイル**: `backend/src/models/mod.rs`

**追加**:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyNode {
    pub id: String,
    pub node_type: String,  // "user", "group", "role", "policy"
    pub name: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyEdge {
    pub source: String,
    pub target: String,
    pub edge_type: String,  // "policy_attachment", "group_membership"
    pub label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub nodes: Vec<DependencyNode>,
    pub edges: Vec<DependencyEdge>,
}
```

#### 3.3.2 サービス実装

**ファイル**: `backend/src/services/dependency_service.rs` (新規)

```rust
use anyhow::Result;
use serde_json::Value;
use crate::models::{DependencyGraph, DependencyNode, DependencyEdge};
use crate::services::scan_service::ScanService;

pub struct DependencyService;

impl DependencyService {
    pub async fn get_dependencies(
        scan_id: &str,
        root_id: Option<&str>,
    ) -> Result<DependencyGraph> {
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        let provider = scan_data.get("provider")
            .and_then(|p| p.as_str())
            .unwrap_or("aws");

        match provider {
            "aws" => Self::extract_aws_dependencies(&scan_data, root_id),
            "azure" => Self::extract_azure_dependencies(&scan_data, root_id),
            _ => Ok(DependencyGraph { nodes: vec![], edges: vec![] }),
        }
    }

    fn extract_aws_dependencies(
        scan_data: &Value,
        root_id: Option<&str>,
    ) -> Result<DependencyGraph> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // ユーザーノードを追加
        if let Some(users) = scan_data.get("users").and_then(|u| u.as_array()) {
            for user in users {
                if let Some(name) = user.get("user_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("user:{}", name),
                        node_type: "user".to_string(),
                        name: name.to_string(),
                        data: user.clone(),
                    });
                }
            }
        }

        // グループノードを追加
        if let Some(groups) = scan_data.get("groups").and_then(|g| g.as_array()) {
            for group in groups {
                if let Some(name) = group.get("group_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("group:{}", name),
                        node_type: "group".to_string(),
                        name: name.to_string(),
                        data: group.clone(),
                    });
                }
            }
        }

        // ロールノードを追加
        if let Some(roles) = scan_data.get("roles").and_then(|r| r.as_array()) {
            for role in roles {
                if let Some(name) = role.get("role_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("role:{}", name),
                        node_type: "role".to_string(),
                        name: name.to_string(),
                        data: role.clone(),
                    });
                }
            }
        }

        // ポリシーノードを追加
        if let Some(policies) = scan_data.get("policies").and_then(|p| p.as_array()) {
            for policy in policies {
                if let Some(arn) = policy.get("arn").and_then(|a| a.as_str()) {
                    let name = policy.get("policy_name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(arn);
                    nodes.push(DependencyNode {
                        id: format!("policy:{}", arn),
                        node_type: "policy".to_string(),
                        name: name.to_string(),
                        data: policy.clone(),
                    });
                }
            }
        }

        // アタッチメントからエッジを作成
        if let Some(attachments) = scan_data.get("attachments").and_then(|a| a.as_array()) {
            for attachment in attachments {
                let entity_type = attachment.get("entity_type")
                    .and_then(|e| e.as_str())
                    .unwrap_or("");
                let entity_name = attachment.get("entity_name")
                    .and_then(|e| e.as_str())
                    .unwrap_or("");
                let policy_arn = attachment.get("policy_arn")
                    .and_then(|p| p.as_str())
                    .unwrap_or("");

                let source_id = match entity_type {
                    "User" => format!("user:{}", entity_name),
                    "Group" => format!("group:{}", entity_name),
                    "Role" => format!("role:{}", entity_name),
                    _ => continue,
                };

                edges.push(DependencyEdge {
                    source: source_id,
                    target: format!("policy:{}", policy_arn),
                    edge_type: "policy_attachment".to_string(),
                    label: Some("has policy".to_string()),
                });
            }
        }

        // ルートIDでフィルタリング
        if let Some(root) = root_id {
            Self::filter_by_root(&mut nodes, &mut edges, root);
        }

        Ok(DependencyGraph { nodes, edges })
    }

    fn extract_azure_dependencies(
        scan_data: &Value,
        root_id: Option<&str>,
    ) -> Result<DependencyGraph> {
        // Azure用の実装
        // role_assignments と role_definitions の関係を抽出
        todo!()
    }

    fn filter_by_root(
        nodes: &mut Vec<DependencyNode>,
        edges: &mut Vec<DependencyEdge>,
        root_id: &str,
    ) {
        // root_idから到達可能なノードのみを残す
        // BFS/DFSで到達可能ノードを計算
        use std::collections::HashSet;

        let mut reachable: HashSet<String> = HashSet::new();
        let mut queue = vec![root_id.to_string()];

        while let Some(current) = queue.pop() {
            if reachable.contains(&current) {
                continue;
            }
            reachable.insert(current.clone());

            for edge in edges.iter() {
                if edge.source == current && !reachable.contains(&edge.target) {
                    queue.push(edge.target.clone());
                }
                if edge.target == current && !reachable.contains(&edge.source) {
                    queue.push(edge.source.clone());
                }
            }
        }

        nodes.retain(|n| reachable.contains(&n.id));
        edges.retain(|e| reachable.contains(&e.source) && reachable.contains(&e.target));
    }
}
```

#### 3.3.3 APIエンドポイントの追加

**ファイル**: `backend/src/api/routes/resources.rs`

**追加**:

```rust
use crate::services::dependency_service::DependencyService;

pub fn router() -> Router {
    Router::new()
        .route("/:scan_id", get(get_resources))
        .route("/:scan_id/query", post(query_resources))
        .route("/:scan_id/dependencies", get(get_dependencies))  // 追加
        .route("/:scan_id/select", post(select_resources))
        .route("/:scan_id/select", get(get_selected_resources))
}

#[derive(Deserialize)]
struct GetDependenciesQuery {
    root_id: Option<String>,
}

async fn get_dependencies(
    Path(scan_id): Path<String>,
    Query(params): Query<GetDependenciesQuery>,
) -> Result<Json<DependencyGraph>, ApiError> {
    DependencyService::get_dependencies(&scan_id, params.root_id.as_deref())
        .await
        .map(Json)
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") {
                ApiError::NotFound(msg)
            } else {
                ApiError::Internal(msg)
            }
        })
}
```

### 3.4 フロントエンド実装

#### 3.4.1 依存ライブラリの追加

```bash
cd frontend
npm install @xyflow/react
```

#### 3.4.2 APIクライアントの拡張

**ファイル**: `frontend/src/api/resources.ts`

**追加**:

```typescript
export interface DependencyNode {
  id: string
  node_type: string
  name: string
  data: any
}

export interface DependencyEdge {
  source: string
  target: string
  edge_type: string
  label?: string
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
}

export const resourcesApi = {
  // ... 既存メソッド

  getDependencies: async (
    scanId: string,
    rootId?: string
  ): Promise<DependencyGraph> => {
    const params = rootId ? { root_id: rootId } : {}
    const response = await apiClient.get(`/resources/${scanId}/dependencies`, { params })
    return response.data
  }
}
```

#### 3.4.3 グラフコンポーネント

**ファイル**: `frontend/src/components/resources/DependencyGraph.tsx` (新規)

```typescript
import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DependencyGraph as DependencyGraphData } from '../../api/resources'

interface Props {
  data: DependencyGraphData
  onNodeClick?: (nodeId: string) => void
}

const nodeColors: Record<string, string> = {
  user: '#4CAF50',
  group: '#2196F3',
  role: '#FF9800',
  policy: '#9C27B0',
}

export default function DependencyGraph({ data, onNodeClick }: Props) {
  const initialNodes: Node[] = useMemo(() => {
    return data.nodes.map((node, index) => ({
      id: node.id,
      data: { label: node.name, nodeType: node.node_type },
      position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 100 },
      style: {
        backgroundColor: nodeColors[node.node_type] || '#666',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        border: '2px solid #333',
      },
    }))
  }, [data.nodes])

  const initialEdges: Edge[] = useMemo(() => {
    return data.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#666' },
    }))
  }, [data.edges])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* 凡例 */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        {Object.entries(nodeColors).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: color,
              borderRadius: '4px',
            }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 3.5 実装タスク

- [ ] 3.5.1 `backend/src/models/mod.rs` に `DependencyNode`, `DependencyEdge`, `DependencyGraph` 追加
- [ ] 3.5.2 `backend/src/services/dependency_service.rs` 新規作成
- [ ] 3.5.3 `backend/src/services/mod.rs` に `dependency_service` モジュール追加
- [ ] 3.5.4 `backend/src/api/routes/resources.rs` に `/dependencies` エンドポイント追加
- [ ] 3.5.5 `frontend/` に `@xyflow/react` インストール
- [ ] 3.5.6 `frontend/src/api/resources.ts` に `getDependencies()` 追加
- [ ] 3.5.7 `frontend/src/components/resources/DependencyGraph.tsx` 新規作成
- [ ] 3.5.8 `frontend/src/pages/ResourcesPage.tsx` に依存関係タブ追加
- [ ] 3.5.9 単体テスト: 依存関係抽出ロジックのテスト
- [ ] 3.5.10 Azure依存関係抽出の実装

---

## 4. インポートプレビュー

### 4.1 目的

生成されたTerraformコードの構文検証とインポート実行前のドライラン（plan）を提供する。

### 4.2 前提条件

- Terraform CLIがローカルにインストールされていること
- 環境変数 `PATH` にTerraformが含まれていること

### 4.3 バックエンド実装

#### 4.3.1 Terraform CLI ラッパー

**ファイル**: `backend/src/infra/terraform/mod.rs` (新規)

```rust
pub mod cli;
pub use cli::TerraformCli;
```

**ファイル**: `backend/src/infra/terraform/cli.rs` (新規)

```rust
use anyhow::Result;
use std::process::Command;
use std::path::Path;

pub struct TerraformCli;

#[derive(Debug, Clone)]
pub struct TerraformVersion {
    pub version: String,
    pub available: bool,
}

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct FormatResult {
    pub formatted: bool,
    pub diff: Option<String>,
    pub files_changed: Vec<String>,
}

impl TerraformCli {
    /// Terraformのバージョンを取得
    pub fn version() -> Result<TerraformVersion> {
        let output = Command::new("terraform")
            .arg("version")
            .arg("-json")
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                // JSONパースしてバージョン抽出
                let version = serde_json::from_str::<serde_json::Value>(&stdout)
                    .ok()
                    .and_then(|v| v.get("terraform_version")?.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "unknown".to_string());

                Ok(TerraformVersion {
                    version,
                    available: true,
                })
            }
            _ => Ok(TerraformVersion {
                version: String::new(),
                available: false,
            }),
        }
    }

    /// terraform init を実行
    pub fn init(working_dir: &Path) -> Result<()> {
        let output = Command::new("terraform")
            .current_dir(working_dir)
            .arg("init")
            .arg("-backend=false")
            .arg("-input=false")
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("terraform init failed: {}", stderr));
        }

        Ok(())
    }

    /// terraform validate を実行
    pub fn validate(working_dir: &Path) -> Result<ValidationResult> {
        let output = Command::new("terraform")
            .current_dir(working_dir)
            .arg("validate")
            .arg("-json")
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let result: serde_json::Value = serde_json::from_str(&stdout)
            .unwrap_or_else(|_| serde_json::json!({"valid": false}));

        let valid = result.get("valid").and_then(|v| v.as_bool()).unwrap_or(false);

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        if let Some(diagnostics) = result.get("diagnostics").and_then(|d| d.as_array()) {
            for diag in diagnostics {
                let severity = diag.get("severity").and_then(|s| s.as_str()).unwrap_or("");
                let summary = diag.get("summary").and_then(|s| s.as_str()).unwrap_or("");
                let detail = diag.get("detail").and_then(|s| s.as_str()).unwrap_or("");

                let message = if detail.is_empty() {
                    summary.to_string()
                } else {
                    format!("{}: {}", summary, detail)
                };

                match severity {
                    "error" => errors.push(message),
                    "warning" => warnings.push(message),
                    _ => {}
                }
            }
        }

        Ok(ValidationResult { valid, errors, warnings })
    }

    /// terraform fmt -check を実行
    pub fn fmt_check(working_dir: &Path) -> Result<FormatResult> {
        let output = Command::new("terraform")
            .current_dir(working_dir)
            .arg("fmt")
            .arg("-check")
            .arg("-diff")
            .arg("-recursive")
            .output()?;

        let formatted = output.status.success();
        let diff = if !formatted {
            Some(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            None
        };

        // 変更が必要なファイルをリストアップ
        let files_changed: Vec<String> = if !formatted {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter(|line| line.starts_with("---") || line.starts_with("+++"))
                .filter_map(|line| line.split_whitespace().nth(1).map(|s| s.to_string()))
                .collect()
        } else {
            vec![]
        };

        Ok(FormatResult { formatted, diff, files_changed })
    }

    /// terraform fmt を実行（自動修正）
    pub fn fmt(working_dir: &Path) -> Result<Vec<String>> {
        let output = Command::new("terraform")
            .current_dir(working_dir)
            .arg("fmt")
            .arg("-recursive")
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("terraform fmt failed: {}", stderr));
        }

        let files_formatted: Vec<String> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|s| s.to_string())
            .collect();

        Ok(files_formatted)
    }
}
```

#### 4.3.2 バリデーションサービス

**ファイル**: `backend/src/services/validation_service.rs` (新規)

```rust
use anyhow::Result;
use std::path::PathBuf;
use crate::infra::terraform::{TerraformCli, ValidationResult, FormatResult, TerraformVersion};

pub struct ValidationService;

impl ValidationService {
    /// Terraform CLIの利用可能性をチェック
    pub fn check_terraform() -> TerraformVersion {
        TerraformCli::version().unwrap_or(TerraformVersion {
            version: String::new(),
            available: false,
        })
    }

    /// 生成されたTerraformコードを検証
    pub async fn validate_generation(generation_id: &str) -> Result<ValidationResult> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!("Generation output not found: {}", generation_id));
        }

        // terraform init
        TerraformCli::init(&output_dir)?;

        // terraform validate
        TerraformCli::validate(&output_dir)
    }

    /// フォーマットチェック
    pub async fn check_format(generation_id: &str) -> Result<FormatResult> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!("Generation output not found: {}", generation_id));
        }

        TerraformCli::fmt_check(&output_dir)
    }

    /// 自動フォーマット
    pub async fn format_code(generation_id: &str) -> Result<Vec<String>> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!("Generation output not found: {}", generation_id));
        }

        TerraformCli::fmt(&output_dir)
    }
}
```

#### 4.3.3 APIエンドポイントの追加

**ファイル**: `backend/src/api/routes/generate.rs`

**追加**:

```rust
use crate::services::validation_service::ValidationService;

pub fn router() -> Router {
    Router::new()
        .route("/terraform", post(generate_terraform))
        .route("/terraform/check", get(check_terraform))  // 追加
        .route("/:generation_id/download", get(download))
        .route("/:generation_id/validate", post(validate_generation))  // 追加
        .route("/:generation_id/format/check", get(check_format))  // 追加
        .route("/:generation_id/format", post(format_code))  // 追加
}

async fn check_terraform() -> Result<Json<Value>, ApiError> {
    let version = ValidationService::check_terraform();
    Ok(Json(json!({
        "available": version.available,
        "version": version.version
    })))
}

async fn validate_generation(
    Path(generation_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    ValidationService::validate_generation(&generation_id)
        .await
        .map(|result| Json(json!({
            "valid": result.valid,
            "errors": result.errors,
            "warnings": result.warnings
        })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn check_format(
    Path(generation_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    ValidationService::check_format(&generation_id)
        .await
        .map(|result| Json(json!({
            "formatted": result.formatted,
            "diff": result.diff,
            "files_changed": result.files_changed
        })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn format_code(
    Path(generation_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    ValidationService::format_code(&generation_id)
        .await
        .map(|files| Json(json!({
            "success": true,
            "files_formatted": files
        })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}
```

### 4.4 フロントエンド実装

#### 4.4.1 APIクライアントの拡張

**ファイル**: `frontend/src/api/generate.ts`

**追加**:

```typescript
export interface TerraformStatus {
  available: boolean
  version: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface FormatResult {
  formatted: boolean
  diff?: string
  files_changed: string[]
}

export const generateApi = {
  // ... 既存メソッド

  checkTerraform: async (): Promise<TerraformStatus> => {
    const response = await apiClient.get('/generate/terraform/check')
    return response.data
  },

  validate: async (generationId: string): Promise<ValidationResult> => {
    const response = await apiClient.post(`/generate/${generationId}/validate`)
    return response.data
  },

  checkFormat: async (generationId: string): Promise<FormatResult> => {
    const response = await apiClient.get(`/generate/${generationId}/format/check`)
    return response.data
  },

  format: async (generationId: string): Promise<{ success: boolean; files_formatted: string[] }> => {
    const response = await apiClient.post(`/generate/${generationId}/format`)
    return response.data
  },
}
```

#### 4.4.2 バリデーションパネルコンポーネント

**ファイル**: `frontend/src/components/generate/ValidationPanel.tsx` (新規)

```typescript
import { useState, useEffect } from 'react'
import { generateApi, ValidationResult, FormatResult, TerraformStatus } from '../../api/generate'

interface Props {
  generationId: string
}

export default function ValidationPanel({ generationId }: Props) {
  const [terraformStatus, setTerraformStatus] = useState<TerraformStatus | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [formatResult, setFormatResult] = useState<FormatResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkTerraform()
  }, [])

  const checkTerraform = async () => {
    try {
      const status = await generateApi.checkTerraform()
      setTerraformStatus(status)
    } catch (err) {
      setTerraformStatus({ available: false, version: '' })
    }
  }

  const handleValidate = async () => {
    setIsValidating(true)
    setError(null)
    try {
      const result = await generateApi.validate(generationId)
      setValidationResult(result)

      const format = await generateApi.checkFormat(generationId)
      setFormatResult(format)
    } catch (err: any) {
      setError(err.message || '検証に失敗しました')
    } finally {
      setIsValidating(false)
    }
  }

  const handleFormat = async () => {
    setIsFormatting(true)
    setError(null)
    try {
      await generateApi.format(generationId)
      // 再検証
      await handleValidate()
    } catch (err: any) {
      setError(err.message || 'フォーマットに失敗しました')
    } finally {
      setIsFormatting(false)
    }
  }

  if (!terraformStatus?.available) {
    return (
      <div style={{
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        padding: '1rem',
        marginTop: '1rem',
      }}>
        <strong>Terraform CLIが見つかりません</strong>
        <p>検証機能を使用するには、Terraform CLIをインストールしてください。</p>
      </div>
    )
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '1rem',
      marginTop: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Terraform検証</h3>
        <span style={{ fontSize: '0.875rem', color: '#666' }}>
          Terraform {terraformStatus.version}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={handleValidate}
          disabled={isValidating}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isValidating ? 'not-allowed' : 'pointer',
          }}
        >
          {isValidating ? '検証中...' : '検証実行'}
        </button>

        {formatResult && !formatResult.formatted && (
          <button
            onClick={handleFormat}
            disabled={isFormatting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: isFormatting ? 'not-allowed' : 'pointer',
            }}
          >
            {isFormatting ? 'フォーマット中...' : '自動フォーマット'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginBottom: '1rem' }}>{error}</div>
      )}

      {validationResult && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: validationResult.valid ? '#28a745' : '#dc3545',
            }} />
            <strong>{validationResult.valid ? '検証成功' : '検証エラー'}</strong>
          </div>

          {validationResult.errors.length > 0 && (
            <div style={{ backgroundColor: '#f8d7da', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
              <strong>エラー ({validationResult.errors.length})</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.5rem' }}>
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div style={{ backgroundColor: '#fff3cd', padding: '0.5rem', borderRadius: '4px' }}>
              <strong>警告 ({validationResult.warnings.length})</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.5rem' }}>
                {validationResult.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {formatResult && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: formatResult.formatted ? '#28a745' : '#ffc107',
            }} />
            <strong>{formatResult.formatted ? 'フォーマット済み' : 'フォーマットが必要'}</strong>
          </div>

          {formatResult.files_changed.length > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              変更が必要なファイル: {formatResult.files_changed.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 4.5 実装タスク

- [ ] 4.5.1 `backend/src/infra/terraform/mod.rs` 新規作成
- [ ] 4.5.2 `backend/src/infra/terraform/cli.rs` - TerraformCli実装
- [ ] 4.5.3 `backend/src/infra/mod.rs` に `terraform` モジュール追加
- [ ] 4.5.4 `backend/src/services/validation_service.rs` 新規作成
- [ ] 4.5.5 `backend/src/services/mod.rs` に `validation_service` モジュール追加
- [ ] 4.5.6 `backend/src/api/routes/generate.rs` にエンドポイント追加
- [ ] 4.5.7 `frontend/src/api/generate.ts` に型定義とメソッド追加
- [ ] 4.5.8 `frontend/src/components/generate/ValidationPanel.tsx` 新規作成
- [ ] 4.5.9 `frontend/src/pages/GeneratePage.tsx` にValidationPanel統合
- [ ] 4.5.10 単体テスト: TerraformCli のテスト
- [ ] 4.5.11 ドキュメント: Terraform CLI セットアップ手順を README に追加

---

## 全体スケジュール

```text
Phase 1: テンプレートバリデーション (8タスク)
  └── タスク 1.5.1 〜 1.5.8

Phase 2: カスタムフィルター (13タスク)
  └── タスク 2.5.1 〜 2.5.13

Phase 3: 依存関係可視化 (10タスク)
  └── タスク 3.5.1 〜 3.5.10

Phase 4: インポートプレビュー (11タスク)
  └── タスク 4.5.1 〜 4.5.11
```

## ファイル構成（新規追加予定）

```text
backend/
├── src/
│   ├── infra/
│   │   ├── query/                    # Phase 2
│   │   │   ├── mod.rs
│   │   │   ├── lexer.rs
│   │   │   ├── parser.rs
│   │   │   └── evaluator.rs
│   │   └── terraform/                # Phase 4
│   │       ├── mod.rs
│   │       └── cli.rs
│   └── services/
│       ├── dependency_service.rs     # Phase 3
│       └── validation_service.rs     # Phase 4

frontend/
├── src/
│   ├── components/
│   │   ├── resources/
│   │   │   ├── QueryInput.tsx        # Phase 2
│   │   │   └── DependencyGraph.tsx   # Phase 3
│   │   ├── templates/
│   │   │   └── ValidationErrors.tsx  # Phase 1
│   │   └── generate/
│   │       └── ValidationPanel.tsx   # Phase 4
```

## 備考

- 各Phaseは独立して実装可能
- Phase 4はTerraform CLI依存のため、CLI未インストール環境では機能を無効化する
- クエリ言語（Phase 2）は将来的にCLI版でも活用可能

---

# サブエージェント管理体制の構築（2026-01-01）

## 完了したタスク

### 1. agents/ ディレクトリ構造の作成

- [x] agents/README.md - サブエージェント管理方針の詳細ドキュメント
- [x] agents/templates/ - 新規エージェント作成用テンプレート一式
  - [x] agent-template.md
  - [x] tools-template.json
  - [x] model-template.json
  - [x] tests-template.md
- [x] docs/用語集.md - プロジェクト用語集（サブエージェント関連用語を追加）

### 2. git-smart-commit エージェント定義一式の作成

- [x] agents/subagents/git-smart-commit/README.md - 使い方・ローカル生成手順
- [x] agents/subagents/git-smart-commit/agent.md - エージェント仕様（役割・ルール・ワークフロー）
- [x] agents/subagents/git-smart-commit/tools.json - ツール権限設定
- [x] agents/subagents/git-smart-commit/model.json - AIモデル設定
- [x] agents/subagents/git-smart-commit/tests.md - テストケース（10ケース）

### 3. Claude Code ルールファイルの作成

- [x] .claude/rules/agent-management.md - サブエージェント管理のルール・ベストプラクティス

### 4. Git運用体制の整備

- [x] .github/CODEOWNERS - agents/ 配下の変更レビュアー設定
- [x] .github/PULL_REQUEST_TEMPLATE/agent_template.md - エージェント追加用PRテンプレート
- [x] .github/pull_request_template.md - 既存テンプレートにagents関連チェック項目を追加

## 今後のタスク

### 優先度: 高

- [ ] git-smart-commit エージェントの実地テスト
  - [ ] テストケース1-10を実際に試す
  - [ ] 問題があればagent.mdを修正
  - [ ] tests.mdに実施結果を記録

- [ ] チームメンバーへの周知
  - [ ] agents/README.md を共有
  - [ ] ローカル生成手順のウォークスルー実施
  - [ ] 質問・フィードバックの収集

### 優先度: 中

- [ ] 追加のサブエージェント検討
  - [ ] terraform-validator エージェント（Terraform検証専用）
  - [ ] test-runner エージェント（テスト実行・レポート生成）
  - [ ] doc-generator エージェント（ドキュメント自動生成）

- [ ] git-smart-commit の機能拡張
  - [ ] マージコミットのサポート
  - [ ] Breaking Changes の自動検出
  - [ ] 関連 Issue の自動リンク（Closes #123等）

### 優先度: 低

- [ ] サブエージェントの自動テストスクリプト作成
  - [ ] agents/subagents/git-smart-commit/test.sh
  - [ ] CI/CD パイプラインに統合

- [ ] エージェント定義のバージョン管理強化
  - [ ] セマンティックバージョニング導入
  - [ ] CHANGELOG.md の自動生成

## 管理方針の要約

### 基本原則

- **「定義」をGit管理、「実体」はローカル保存**
  - サブエージェントの実体（バイナリ・生成物）は各PC環境に保存
  - Gitで管理するのはエージェントの「仕様・定義」のみ
  - 各メンバーは定義をもとにローカルで再生成

### ディレクトリ構造

```
agents/
├── README.md                    # 管理方針・使い方
├── subagents/                   # サブエージェント定義一覧
│   └── git-smart-commit/        # 例：git コミット専用エージェント
│       ├── README.md
│       ├── agent.md
│       ├── tools.json
│       ├── model.json
│       └── tests.md
└── templates/                   # 新規エージェント作成用テンプレート
```

共通情報は以下に配置：
- `.claude/rules/` - プロジェクト全体のルール
- `docs/` - ドキュメント（コミット戦略、用語集など）

### 参考リソース

- ChatGPT との会話で決定した方針（個人ローカル運用とチーム共有運用の分離）
- [agents/README.md](agents/README.md) - サブエージェント管理の詳細
- [.claude/rules/agent-management.md](.claude/rules/agent-management.md) - Claude Code への指示

---

# E2Eテスト実装計画書（Playwright MCP）

## 概要

TFKosmosのすべての画面と機能に対するE2Eテストを、Playwright MCPを使用して実装する。

### テスト対象

- **5つの主要画面**
  1. 接続設定画面 (ConnectionPage)
  2. スキャン設定画面 (ScanPage)
  3. リソース一覧画面 (ResourcesPage)
  4. 生成画面 (GeneratePage)
  5. テンプレート管理画面 (TemplatesPage)

- **APIエンドポイント**
  - `/connection/*` - 接続テスト関連
  - `/scan/*` - スキャン実行・ステータス
  - `/resources/*` - リソース取得・選択・クエリ
  - `/generate/*` - Terraform生成・ダウンロード・検証
  - `/templates/*` - テンプレート管理

### テスト環境

- **フロントエンド**: http://localhost:5173
- **バックエンド**: http://localhost:8000
- **ブラウザ**: Chromium (Playwright MCP経由)

---

## 1. 共通テスト

### 1.1 アプリケーション起動・基本ナビゲーション

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 1.1.1 | アプリケーションにアクセス | トップページ（接続設定画面）が表示される | 高 |
| 1.1.2 | ナビゲーションメニューの表示 | 接続設定、スキャン、リソース、生成、テンプレートのリンクが表示される | 高 |
| 1.1.3 | 各ナビゲーションリンクのクリック | 対応するページに遷移する | 高 |
| 1.1.4 | バックエンド未起動時のエラー表示 | エラーメッセージが表示される | 中 |
| 1.1.5 | ブラウザリサイズ（レスポンシブ） | レイアウトが適切に調整される | 低 |

### 1.2 共通コンポーネント

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 1.2.1 | LoadingSpinnerの表示 | ローディング中にスピナーが表示される | 中 |
| 1.2.2 | ErrorMessageの表示と閉じるボタン | エラーメッセージが表示され、閉じるボタンで非表示になる | 中 |
| 1.2.3 | SuccessMessageの表示と閉じるボタン | 成功メッセージが表示され、閉じるボタンで非表示になる | 中 |

---

## 2. 接続設定画面 (ConnectionPage)

### 2.1 タブ切り替え

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 2.1.1 | 初期表示時にAWSタブがアクティブ | AWSタブがハイライトされ、AWS接続フォームが表示される | 高 |
| 2.1.2 | Azureタブをクリック | Azureタブがアクティブになり、Azure接続フォームが表示される | 高 |
| 2.1.3 | AWSタブに戻る | AWSタブがアクティブになり、AWS接続フォームが表示される | 高 |

### 2.2 AWS接続フォーム

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 2.2.1 | プロファイル入力フィールドの表示 | プロファイル入力欄が表示される | 高 |
| 2.2.2 | リージョン入力フィールドの表示 | リージョン入力欄が表示される | 高 |
| 2.2.3 | Assume Role ARN入力フィールドの表示 | ARN入力欄が表示される | 高 |
| 2.2.4 | Session Name入力フィールドの表示 | Session Name入力欄が表示される | 高 |
| 2.2.5 | aws login実行ボタンのクリック | ローディング状態になり、API呼び出しが行われる | 高 |
| 2.2.6 | 接続テストボタンのクリック（成功） | 成功メッセージ「接続成功: Account ID XXXX」が表示される | 高 |
| 2.2.7 | 接続テストボタンのクリック（失敗） | エラーメッセージが表示される | 高 |
| 2.2.8 | ローディング中のボタン無効化 | テスト実行中はボタンが無効化される | 中 |

### 2.3 Azure接続フォーム

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 2.3.1 | 認証方式ドロップダウンの表示 | Azure CLI / Service Principalの選択肢が表示される | 高 |
| 2.3.2 | Azure CLI選択時のフォーム | 追加入力フィールドが非表示 | 高 |
| 2.3.3 | Service Principal選択時のフォーム | テナントID、Client ID、Client Secret入力欄が表示される | 高 |
| 2.3.4 | テナントID入力 | 入力値が反映される | 高 |
| 2.3.5 | Client ID入力 | 入力値が反映される | 高 |
| 2.3.6 | Client Secret入力（パスワード型） | 入力値がマスクされる | 高 |
| 2.3.7 | 接続テストボタンのクリック（成功） | 成功メッセージが表示される | 高 |
| 2.3.8 | 接続テストボタンのクリック（失敗） | エラーメッセージが表示される | 高 |

---

## 3. スキャン設定画面 (ScanPage)

### 3.1 プロバイダー選択

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 3.1.1 | 初期表示時にAWSが選択 | AWSラジオボタンが選択状態 | 高 |
| 3.1.2 | Azureラジオボタンをクリック | Azureが選択され、設定フォームが切り替わる | 高 |
| 3.1.3 | AWSラジオボタンに戻る | AWSが選択され、設定フォームが切り替わる | 高 |

### 3.2 AWSスキャン設定

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 3.2.1 | プロファイル入力フィールドの表示 | プロファイル入力欄が表示される | 高 |
| 3.2.2 | Assume Role ARN入力フィールドの表示 | ARN入力欄が表示される | 高 |
| 3.2.3 | スキャン対象チェックボックスの表示 | Users, Groups, Roles, Policies, Attachmentsが表示される | 高 |
| 3.2.4 | デフォルトのスキャン対象 | Users, Groups, Attachmentsがチェック済み | 高 |
| 3.2.5 | スキャン対象の全選択 | すべてのチェックボックスがチェックされる | 中 |
| 3.2.6 | スキャン対象の全解除 | すべてのチェックボックスが解除される | 中 |
| 3.2.7 | 名前プレフィックスフィルタの入力 | 入力値が反映される | 中 |

### 3.3 Azureスキャン設定

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 3.3.1 | スコープタイプドロップダウンの表示 | subscription / resource_groupの選択肢が表示される | 高 |
| 3.3.2 | サブスクリプション一覧の読み込み | 接続設定に基づいてサブスクリプション一覧が表示される | 高 |
| 3.3.3 | サブスクリプションの選択 | 選択したサブスクリプションIDが設定される | 高 |
| 3.3.4 | resource_group選択時のリソースグループ一覧 | リソースグループドロップダウンが表示される | 高 |
| 3.3.5 | スキャン対象チェックボックス | Role Definitions, Role Assignmentsが表示される | 高 |

### 3.4 スキャン実行

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 3.4.1 | スキャン実行ボタンのクリック | ローディング状態になる | 高 |
| 3.4.2 | プログレスバーの表示 | スキャン進捗がプログレスバーで表示される | 高 |
| 3.4.3 | 進捗メッセージの表示 | 現在のスキャン状況メッセージが表示される | 中 |
| 3.4.4 | スキャン完了時の自動遷移 | リソース一覧画面に自動遷移する | 高 |
| 3.4.5 | スキャン失敗時のエラー表示 | エラーメッセージが表示される | 高 |
| 3.4.6 | スキャン中のボタン無効化 | スキャン実行中はボタンが無効化される | 中 |

---

## 4. リソース一覧画面 (ResourcesPage)

### 4.1 画面表示

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.1.1 | スキャンID表示 | URLパラメータのスキャンIDが表示される | 高 |
| 4.1.2 | スキャン結果サマリーの表示 | 各リソースタイプの件数が表示される | 高 |
| 4.1.3 | フィルタボタンの表示 | フィルタ表示/非表示ボタンが表示される | 高 |

### 4.2 リソースタブ（AWS）

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.2.1 | Usersタブの表示（初期アクティブ） | Usersタブがアクティブでユーザー一覧が表示される | 高 |
| 4.2.2 | Groupsタブへの切り替え | グループ一覧が表示される | 高 |
| 4.2.3 | Rolesタブへの切り替え | ロール一覧が表示される | 高 |
| 4.2.4 | Policiesタブへの切り替え | ポリシー一覧が表示される | 高 |
| 4.2.5 | Attachmentsタブへの切り替え | アタッチメント一覧が表示される | 高 |
| 4.2.6 | Cleanupタブへの切り替え | クリーンアップ対象一覧が表示される | 中 |
| 4.2.7 | Dependenciesタブへの切り替え | 依存関係グラフが表示される | 中 |

### 4.3 リソースタブ（Azure）

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.3.1 | Role Assignmentsタブの表示 | ロール割り当て一覧が表示される | 高 |
| 4.3.2 | Role Definitionsタブへの切り替え | ロール定義一覧が表示される | 高 |
| 4.3.3 | Dependenciesタブへの切り替え | 依存関係グラフが表示される | 中 |

### 4.4 リソーステーブル

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.4.1 | カラムヘッダーの表示 | 適切なカラム（名前、ARN、Path等）が表示される | 高 |
| 4.4.2 | リソースデータの表示 | 各リソースの情報が行として表示される | 高 |
| 4.4.3 | チェックボックスによる選択 | リソースを選択できる | 高 |
| 4.4.4 | チェックボックスの複数選択 | 複数リソースを選択できる | 高 |
| 4.4.5 | 全選択チェックボックス | 表示中の全リソースが選択される | 高 |
| 4.4.6 | 全選択の解除 | 全リソースの選択が解除される | 高 |
| 4.4.7 | 行クリックで詳細表示 | リソース詳細がモーダル等で表示される | 中 |

### 4.5 フィルタ機能

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.5.1 | フィルタボタンでパネル表示 | フィルタパネルが表示される | 高 |
| 4.5.2 | シンプル検索モードの選択 | シンプル検索フォームが表示される | 高 |
| 4.5.3 | シンプル検索の実行 | 検索テキストに一致するリソースが表示される | 高 |
| 4.5.4 | 高度なクエリモードの選択 | クエリ入力フォームが表示される | 高 |
| 4.5.5 | クエリヘルプの表示 | ?ボタンでクエリ構文ヘルプが表示される | 中 |
| 4.5.6 | 高度なクエリの実行（成功） | クエリ結果が表示される | 高 |
| 4.5.7 | 高度なクエリの実行（構文エラー） | エラーメッセージが表示される | 高 |
| 4.5.8 | クリアボタンでフィルタ解除 | フィルタが解除され、全リソースが表示される | 高 |
| 4.5.9 | フィルタボタンでパネル非表示 | フィルタパネルが非表示になる | 中 |

### 4.6 ページネーション

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.6.1 | ページ情報の表示 | 「X / Y ページ (全 Z 件)」が表示される | 高 |
| 4.6.2 | 次へボタンのクリック | 次のページに遷移する | 高 |
| 4.6.3 | 前へボタンのクリック | 前のページに遷移する | 高 |
| 4.6.4 | 最初のページで前へボタン無効 | 前へボタンが無効化される | 中 |
| 4.6.5 | 最後のページで次へボタン無効 | 次へボタンが無効化される | 中 |

### 4.7 選択サマリー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.7.1 | 選択件数の表示 | 選択したリソース件数が表示される | 高 |
| 4.7.2 | 生成ページへボタンの表示 | 生成ページへ遷移するボタンが表示される | 高 |
| 4.7.3 | 生成ページへの遷移 | 生成画面に遷移する | 高 |

### 4.8 依存関係グラフ

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 4.8.1 | グラフの表示 | ノードとエッジが表示される | 中 |
| 4.8.2 | ノードの色分け | リソースタイプごとに色が異なる | 低 |
| 4.8.3 | 凡例の表示 | 色とリソースタイプの対応が表示される | 低 |
| 4.8.4 | ズーム・パン操作 | グラフをズーム・パンできる | 低 |
| 4.8.5 | ミニマップの表示 | グラフ全体を俯瞰できるミニマップが表示される | 低 |

---

## 5. 生成画面 (GeneratePage)

### 5.1 画面表示

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.1.1 | スキャンID表示 | URLパラメータのスキャンIDが表示される | 高 |
| 5.1.2 | 選択リソースの読み込み | リソース一覧画面で選択したリソースが読み込まれる | 高 |

### 5.2 生成設定フォーム

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.2.1 | 出力パス入力フィールド | デフォルト値「./terraform-output」が表示される | 高 |
| 5.2.2 | ファイル分割ルール選択 | by_resource_type等の選択肢が表示される | 高 |
| 5.2.3 | 命名規則選択 | snake_case等の選択肢が表示される | 高 |
| 5.2.4 | インポートスクリプト形式選択 | sh等の選択肢が表示される | 高 |
| 5.2.5 | README生成チェックボックス | チェックボックスが表示される | 中 |

### 5.3 生成実行

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.3.1 | 生成実行ボタンのクリック | ローディング状態になる | 高 |
| 5.3.2 | 生成成功時の成功メッセージ | 「Terraformコードの生成が完了しました」が表示される | 高 |
| 5.3.3 | 生成失敗時のエラーメッセージ | エラーメッセージが表示される | 高 |
| 5.3.4 | 生成中のボタン無効化 | 生成実行中はボタンが無効化される | 中 |

### 5.4 バリデーションパネル

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.4.1 | Terraform CLIステータス表示 | Terraform CLIの有無とバージョンが表示される | 高 |
| 5.4.2 | Terraform CLI未インストール時の警告 | 警告メッセージが表示される | 高 |
| 5.4.3 | 検証実行ボタンのクリック | 検証が実行される | 高 |
| 5.4.4 | 検証成功時の表示 | 緑色のインジケータと「検証成功」が表示される | 高 |
| 5.4.5 | 検証エラー時の表示 | エラー一覧が表示される | 高 |
| 5.4.6 | 検証警告時の表示 | 警告一覧が表示される | 中 |
| 5.4.7 | フォーマットチェック結果の表示 | フォーマット状態が表示される | 中 |
| 5.4.8 | 自動フォーマットボタンのクリック | フォーマットが実行される | 中 |

### 5.5 ダウンロード

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.5.1 | 生成後にZIPダウンロードボタン表示 | ダウンロードボタンが表示される | 高 |
| 5.5.2 | ZIPダウンロードの実行 | terraform-output.zipがダウンロードされる | 高 |
| 5.5.3 | ダウンロード成功メッセージ | 「ZIPファイルのダウンロードが完了しました」が表示される | 中 |
| 5.5.4 | ダウンロード失敗時のエラー | エラーメッセージが表示される | 中 |

### 5.6 コードプレビュー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 5.6.1 | プレビューセクションの表示 | 生成後にプレビューが表示される | 高 |
| 5.6.2 | ファイルタブの切り替え | 複数ファイルの内容を切り替えて表示できる | 中 |
| 5.6.3 | コードのシンタックスハイライト | HCLコードがハイライトされる | 低 |

---

## 6. テンプレート管理画面 (TemplatesPage)

### 6.1 画面表示

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.1.1 | テンプレート一覧の表示 | 左カラムにテンプレート一覧が表示される | 高 |
| 6.1.2 | テンプレート未選択時のメッセージ | 「テンプレートを選択してください」が表示される | 中 |

### 6.2 テンプレート選択

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.2.1 | テンプレートのクリック | 選択したテンプレートがハイライトされる | 高 |
| 6.2.2 | エディタへの内容読み込み | テンプレート内容がエディタに表示される | 高 |
| 6.2.3 | カスタム/デフォルト表示 | 各テンプレートの状態（カスタム/デフォルト）が表示される | 中 |

### 6.3 テンプレートエディタ

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.3.1 | Monaco Editorの表示 | エディタが表示される | 高 |
| 6.3.2 | シンタックスハイライト | HCL/Jinja2構文がハイライトされる | 中 |
| 6.3.3 | 編集内容の入力 | テンプレート内容を編集できる | 高 |

### 6.4 リアルタイムバリデーション

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.4.1 | 正しい構文入力時 | エラーが表示されない | 高 |
| 6.4.2 | Jinja2構文エラー時 | エラーメッセージが表示される | 高 |
| 6.4.3 | エラー行のマーカー表示 | エディタ内でエラー行がハイライトされる | 中 |
| 6.4.4 | エラークリックでジャンプ | エラーをクリックすると該当行に移動する | 中 |
| 6.4.5 | デバウンス動作 | 入力完了後500msでバリデーションが実行される | 低 |

### 6.5 プレビュー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.5.1 | プレビューボタンのクリック | プレビューが生成される | 高 |
| 6.5.2 | プレビュー結果の表示 | レンダリング結果が表示される | 高 |
| 6.5.3 | プレビュー中のローディング | ローディング状態が表示される | 中 |
| 6.5.4 | プレビュー失敗時のエラー | エラーメッセージが表示される | 中 |

### 6.6 保存・復元

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 6.6.1 | 保存ボタンのクリック | テンプレートが保存される | 高 |
| 6.6.2 | 保存成功メッセージ | 「テンプレートを保存しました」が表示される | 高 |
| 6.6.3 | 保存後のカスタム表示 | テンプレートが「カスタム」表示に変わる | 中 |
| 6.6.4 | デフォルトに復元ボタンの表示 | カスタムテンプレートにのみ復元ボタンが表示される | 高 |
| 6.6.5 | デフォルトに復元の確認ダイアログ | 確認ダイアログが表示される | 高 |
| 6.6.6 | デフォルトに復元の実行 | テンプレートがデフォルトに戻る | 高 |
| 6.6.7 | 復元成功メッセージ | 「デフォルトに復元しました」が表示される | 中 |

---

## 7. E2Eフローテスト

### 7.1 AWSスキャン〜生成フロー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 7.1.1 | AWS接続テスト成功 | 接続設定画面で成功メッセージ | 高 |
| 7.1.2 | AWSスキャン実行・完了 | スキャンが完了し、リソース一覧に遷移 | 高 |
| 7.1.3 | リソース選択 | 複数リソースを選択 | 高 |
| 7.1.4 | 生成画面へ遷移 | 選択したリソースが保持されている | 高 |
| 7.1.5 | Terraform生成実行 | 生成が成功 | 高 |
| 7.1.6 | ZIPダウンロード | ファイルがダウンロードできる | 高 |

### 7.2 Azureスキャン〜生成フロー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 7.2.1 | Azure接続テスト成功 | 接続設定画面で成功メッセージ | 高 |
| 7.2.2 | サブスクリプション選択 | サブスクリプション一覧から選択 | 高 |
| 7.2.3 | Azureスキャン実行・完了 | スキャンが完了し、リソース一覧に遷移 | 高 |
| 7.2.4 | リソース選択 | 複数リソースを選択 | 高 |
| 7.2.5 | 生成画面へ遷移 | 選択したリソースが保持されている | 高 |
| 7.2.6 | Terraform生成実行 | 生成が成功 | 高 |

### 7.3 テンプレートカスタマイズフロー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 7.3.1 | テンプレート選択 | エディタに内容が表示される | 高 |
| 7.3.2 | テンプレート編集 | 内容を変更できる | 高 |
| 7.3.3 | プレビュー確認 | 変更がプレビューに反映される | 高 |
| 7.3.4 | 保存 | テンプレートが保存される | 高 |
| 7.3.5 | デフォルトに復元 | 元の内容に戻る | 高 |

---

## 8. エラーハンドリング・エッジケース

### 8.1 ネットワークエラー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 8.1.1 | バックエンド停止時のAPI呼び出し | 接続エラーメッセージが表示される | 高 |
| 8.1.2 | タイムアウト | タイムアウトエラーが表示される | 中 |

### 8.2 バリデーションエラー

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 8.2.1 | 不正なクエリ構文 | 構文エラーメッセージが表示される | 高 |
| 8.2.2 | 不正なテンプレート構文 | バリデーションエラーが表示される | 高 |

### 8.3 データなしの場合

| # | テストケース | 期待結果 | 優先度 |
|---|-------------|---------|--------|
| 8.3.1 | スキャン結果が空 | 適切なメッセージが表示される | 中 |
| 8.3.2 | 依存関係グラフのデータなし | 「依存関係データがありません」が表示される | 中 |

---

## 実装タスク

### Phase 1: テスト環境セットアップ

- [ ] Playwright MCPの動作確認
- [ ] テスト用の開発環境起動スクリプト作成
- [ ] モックデータの準備（AWS/Azureスキャン結果）

### Phase 2: 共通・接続設定画面テスト

- [ ] 1.x 共通テストの実装
- [ ] 2.x 接続設定画面テストの実装

### Phase 3: スキャン・リソース画面テスト

- [ ] 3.x スキャン設定画面テストの実装
- [ ] 4.x リソース一覧画面テストの実装

### Phase 4: 生成・テンプレート画面テスト

- [ ] 5.x 生成画面テストの実装
- [ ] 6.x テンプレート管理画面テストの実装

### Phase 5: フロー・エッジケーステスト

- [ ] 7.x E2Eフローテストの実装
- [ ] 8.x エラーハンドリングテストの実装

---

## テストケース総数

| カテゴリ | テストケース数 |
|---------|--------------|
| 1. 共通テスト | 8 |
| 2. 接続設定画面 | 19 |
| 3. スキャン設定画面 | 20 |
| 4. リソース一覧画面 | 36 |
| 5. 生成画面 | 20 |
| 6. テンプレート管理画面 | 19 |
| 7. E2Eフローテスト | 14 |
| 8. エラーハンドリング | 6 |
| **合計** | **142** |

---

最終更新: 2026-01-01
