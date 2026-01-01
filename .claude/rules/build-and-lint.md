---
description: Compilation checks and linting requirements
---

# コンパイルチェックとLint

## コンパイルチェック

コード変更後は必ずコンパイルチェックを実行し、型エラー、参照エラー、文法エラーがないことを確認すること。

### Rust（バックエンド）

適用対象: `backend/**/*.rs`

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

適用対象: `frontend/src/**/*.{ts,tsx}`

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

適用対象: `backend/**/*.rs`

```bash
cd backend

# Clippy実行（警告をエラーとして扱う）
cargo clippy -- -D warnings

# 自動修正可能な問題を修正
cargo clippy --fix
```

### TypeScript/JavaScript（フロントエンド）

適用対象: `frontend/src/**/*.{ts,tsx}`

ESLintを使用してコード品質を維持します。

```bash
cd frontend

# ESLint実行
npx eslint src/

# 自動修正可能な問題を修正
npx eslint src/ --fix
```

### Lint実行の必須タイミング

- 新規コード追加時
- 既存コード修正時
- コミット前
- プルリクエスト作成前
