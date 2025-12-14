# TFKosmos

<div align="center">
  <img src="assets/icon/readme.png" alt="TFKosmos Logo" width="400">
</div>

## TFKosmos について

TFKosmos は、既存のクラウド環境（実機構成）を解析し、
Terraform のコードおよび import 定義を再構築するためのツールです。

多くの現場では、長年の運用や障害対応、緊急変更の積み重ねによって、
インフラの実態がコードとして表現されないまま複雑化していきます。
このような状態は、再現性・可視性・保守性の面で大きな課題となります。

TFKosmos は、その **混沌（Chaos）** とした実機構成を一度正しく理解し、
Terraform という **秩序（Cosmos）** あるコードへと再構成することを目的としています。

## ツールの特徴

- 既存のクラウドリソース構成を解析し、Terraform コードを生成
- Terraform import に必要な定義を自動的に構築
- 手動運用・属人化した構成から IaC への移行を支援
- 既存環境を壊すことなく、段階的な Terraform 管理への移行が可能

TFKosmos は「新しく作る」ためのツールではなく、
すでに存在している現実のインフラを、最短距離で Terraform 管理へ導くことに重きを置いています。

## 名前の由来

TFKosmos は、以下の 2 つの言葉から構成されています。

- **TF**：Terraform
- **Kosmos**：秩序・調和（ギリシャ語）

ギリシャ神話において Kosmos は、
混沌（Chaos）から生まれた、秩序だった世界を意味します。

TFKosmos という名前には、

**混沌とした実機構成（Chaos）を、**
**Terraform によって秩序あるコード（Kosmos）へ変換する**

という思想が込められています。

## 理念

**From Chaos to Cosmos.**

TFKosmos は、
インフラを「破壊する」ためのツールではありません。

現実に存在する構成を正しく読み解き、
Terraform という共通言語に翻訳し、
再現性と秩序を取り戻すためのツールです。

## 機能

- AWS IAMリソース（Users, Groups, Roles, Policies）のスキャン
- Azure IAMリソース（Role Definitions, Role Assignments）のスキャン
- Terraformコードの自動生成
- カスタムテンプレート対応
- importスクリプトの自動生成

## セットアップ

### 前提条件

- Rust 1.70以上（[rustup](https://rustup.rs/)でインストール）
- Node.js 18以上
- npm または yarn

### バックエンド（Rust）

```bash
# Rustがインストールされていることを確認
rustc --version
cargo --version

# 注意: cargoコマンドが見つからない場合、以下を実行してください
# source ~/.cargo/env

# バックエンドディレクトリに移動
cd backend

# 依存関係のインストール（初回ビルド時に自動的に実行されます）
cargo build

# 開発モードで実行
cargo run
```

#### トラブルシューティング

依存関係のインストールに失敗する場合：

1. **Rustのバージョン確認**

   ```bash
   rustc --version  # 1.70以上が必要
   ```

2. **ビルドツールのインストール**
   - **macOS**: `xcode-select --install`
   - **Linux (Debian/Ubuntu)**: `sudo apt install build-essential libssl-dev pkg-config`
   - **Linux (Fedora)**: `sudo dnf groupinstall "Development Tools" && sudo dnf install openssl-devel`

3. **依存関係の更新**

   ```bash
   cargo update
   ```

4. **キャッシュのクリア**（問題が続く場合）

   ```bash
   cargo clean
   rm -rf ~/.cargo/registry/cache
   cargo build
   ```

### フロントエンド

```bash
cd frontend
npm install
```

## 実行方法

### 方法1: 同時起動（推奨）

フロントエンドとバックエンドを同時に起動する方法：

#### Makefileを使用（推奨）

```bash
# フロントエンドとバックエンドを同時に起動（推奨）
make dev

# バックエンドのみ起動
make dev-backend

# フロントエンドのみ起動
# 注意: スキャン機能を使用するには、バックエンドも起動している必要があります
make dev-frontend

# 利用可能なコマンドを確認
make help
```

**重要**: スキャン機能を使用するには、フロントエンドとバックエンドの両方が起動している必要があります。
`make dev-frontend`のみを実行した場合、バックエンドに接続できず`ECONNREFUSED`エラーが発生します。

#### シェルスクリプトを使用

```bash
./dev.sh
```

#### Cursor/VS Codeのタスクを使用

1. `Cmd+Shift+P` (macOS) または `Ctrl+Shift+P` (Windows/Linux) でコマンドパレットを開く
2. `Tasks: Run Task` を選択
3. `dev: フロントエンド + バックエンド` を選択

または、`Cmd+Shift+B` (macOS) でタスクを実行できます。

**注意**: タスクを停止するには、ターミナルパネルで `Ctrl+C` を押してください。

### 方法2: 個別に起動

#### バックエンド起動

```bash
# 注意: cargoコマンドが見つからない場合、先に以下を実行してください
# source ~/.cargo/env

# バックエンドディレクトリに移動
cd backend

# 開発モード（ホットリロードなし）
cargo run

# リリースモード（最適化済み）
cargo run --release
```

サーバーは `http://0.0.0.0:8000` で起動します。

**注意**: 新しいターミナルセッションでは、`source ~/.cargo/env`を実行するか、シェルの設定ファイル（`.zshrc`や`.bashrc`）に以下を追加してください：

```bash
source "$HOME/.cargo/env"
```

#### フロントエンド起動

```bash
cd frontend
npm run dev
```

フロントエンドは `http://localhost:5173` で起動します。

## プロジェクト構造

``` bash
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
├── docs/             # 開発ドキュメント
│   ├── README.md     # ドキュメントインデックス
│   └── 詳細設計書.md # システム詳細設計書
├── Makefile          # 開発用コマンド
├── dev.sh            # 開発用起動スクリプト
└── README.md         # このファイル
```

## 技術スタック

### 技術スタック-バックエンド

- **Rust**: システムプログラミング言語
- **Axum**: 非同期Webフレームワーク
- **Tokio**: 非同期ランタイム
- **AWS SDK for Rust**: AWS API連携
- **Azure SDK for Rust**: Azure API連携
- **Minijinja**: テンプレートエンジン

### 技術スタック-フロントエンド

- **React**: UIフレームワーク
- **TypeScript**: 型安全なJavaScript
- **Vite**: ビルドツール

## ドキュメント

開発用ドキュメントは [`docs/`](./docs/) ディレクトリにあります。

- **[開発ドキュメント一覧](./docs/README.md)** - ドキュメントのインデックス

詳細な設計や実装の詳細については、上記のドキュメントを参照してください。
