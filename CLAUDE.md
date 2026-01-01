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

## プロジェクト構造

```bash
tfkosmos/
├── backend/          # バックエンド（Rust）
│   ├── src/          # Rustソースコード
│   │   ├── main.rs   # エントリーポイント
│   │   ├── api/      # APIルーティング
│   │   ├── services/ # ビジネスロジック
│   │   ├── models/   # データモデル
│   │   ├── infra/    # インフラストラクチャ層
│   │   └── domain/   # ドメインモデル
│   ├── Cargo.toml    # Rust依存関係
│   ├── templates_default/ # デフォルトテンプレート
│   └── templates_user/   # ユーザーカスタムテンプレート（.gitignore、実行時に生成される）
├── frontend/         # フロントエンド（React）
│   ├── src/          # Reactソースコード
│   ├── package.json  # Node.js依存関係
│   └── vite.config.ts # Vite設定
├── deployment/       # デスクトップアプリ（Tauri）
│   ├── src-tauri/    # Tauri Rustプロジェクト
│   └── package.json  # Tauriアプリ用設定
├── docs/             # 開発ドキュメント
│   ├── README.md     # ドキュメントインデックス
│   └── 詳細設計書.md # システム詳細設計書
├── .claude/          # Claude Code設定
│   ├── settings.json # プロジェクト共有設定
│   └── rules/        # プロジェクトルール（トピック別）
├── Makefile          # 開発用コマンド
├── dev.sh            # 開発用起動スクリプト
└── README.md         # プロジェクトREADME
```

## 重要事項

- **CORS**: バックエンドは全オリジンを許可（Vite開発サーバーとTauriの両方に対応）
- **認証情報**: 永続保存せず、実行時のみメモリ保持
- **出力**: 生成されたTerraformファイルは`backend/terraform-output/{session_id}/`に書き込まれる
- **テンプレート**: 初回生成時、システムはデフォルトをユーザーディレクトリにコピーする
- スキャン機能は、フロントエンドのみの開発モードでもバックエンドが稼働している必要がある
- Tauriアプリ設定は`deployment/src-tauri/tauri.conf.json`に記述

## プロジェクトルール

詳細なコーディング規約、テストガイドライン、アーキテクチャ情報は `.claude/rules/` ディレクトリにトピック別に配置されています：

- `coding-standards.md` - コーディング規約と命名規則
- `build-and-lint.md` - コンパイルチェックとLint
- `testing-guidelines.md` - テストコード作成ガイドライン
- `architecture.md` - アーキテクチャと技術スタック
- `task-management.md` - タスク管理

## ドキュメント

詳細な設計ドキュメントは `docs/` にあります：

- アーキテクチャ、データモデル、API仕様
- コンポーネント仕様
- エラー処理、セキュリティ上の考慮事項
- テスト戦略、デプロイガイド

完全なインデックスについては `docs/README.md` を参照してください。
