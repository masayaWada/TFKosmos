---
description: Project architecture and technical stack
---

# アーキテクチャ

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

## バックエンド層構造

適用対象: `backend/src/**/*.rs`

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

## テンプレートシステム

- **デフォルトテンプレート**: `backend/templates_default/terraform/{aws,azure}/*.tf.j2`
- **ユーザーテンプレート**: `backend/templates_user/` (実行時に生成、.gitignored対象)
- テンプレートは`minijinja`クレート経由でJinja2構文を使用
- `.tf`ファイルとインポートスクリプトの両方を生成

## フロントエンド構造

適用対象: `frontend/src/**/*.{ts,tsx}`

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
