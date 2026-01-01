#!/bin/bash

# Claude Code PostToolsUse Hook: 自動フォーマット
# 編集されたファイルのパスに応じて適切なフォーマッタを実行

FILE_PATH="$1"

# ファイルパスが指定されていない場合は終了
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# プロジェクトルートを取得（このスクリプトがある .claude ディレクトリの親）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# backend/ 配下の Rust ファイルの場合
if [[ "$FILE_PATH" == */backend/* ]] && [[ "$FILE_PATH" == *.rs ]]; then
    echo "🦀 Formatting Rust file: $FILE_PATH"
    (cd "$PROJECT_ROOT/backend" && cargo fmt --quiet -- "$FILE_PATH" 2>/dev/null)
    exit 0
fi

# frontend/ 配下の TypeScript/JavaScript ファイルの場合
if [[ "$FILE_PATH" == */frontend/src/* ]] && [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
    echo "⚛️  Formatting TypeScript/React file: $FILE_PATH"
    (cd "$PROJECT_ROOT/frontend" && npx eslint --fix --quiet "$FILE_PATH" 2>/dev/null || true)
    exit 0
fi

# その他のファイルはスキップ
exit 0
