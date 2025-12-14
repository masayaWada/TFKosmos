#!/bin/bash

# フロントエンドとバックエンドを同時に起動するスクリプト

set -e

# カラー出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}フロントエンドとバックエンドを起動しています...${NC}"
echo -e "${BLUE}バックエンド: http://0.0.0.0:8000${NC}"
echo -e "${BLUE}フロントエンド: http://localhost:5173${NC}"
echo -e "${BLUE}停止するには Ctrl+C を押してください${NC}"
echo ""

# プロセス終了時に子プロセスも終了させる
trap 'kill 0' EXIT

# バックエンドを起動
echo -e "${GREEN}[Backend]${NC} 起動中..."
(
    cd backend
    source ~/.cargo/env
    cargo run
) &

# 少し待ってからフロントエンドを起動
sleep 2

# フロントエンドを起動
echo -e "${GREEN}[Frontend]${NC} 起動中..."
(
    cd frontend
    npm run dev
) &

# 両方のプロセスが終了するまで待機
wait
