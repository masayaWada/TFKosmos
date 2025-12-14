.PHONY: dev dev-backend dev-frontend build clean help

# デフォルトターゲット
help:
	@echo "利用可能なコマンド:"
	@echo "  make dev          - フロントエンドとバックエンドを同時に起動"
	@echo "  make dev-backend  - バックエンドのみ起動"
	@echo "  make dev-frontend - フロントエンドのみ起動"
	@echo "  make build        - バックエンドをビルド"
	@echo "  make clean        - ビルド成果物をクリーンアップ"

# フロントエンドとバックエンドを同時に起動
dev:
	@echo "フロントエンドとバックエンドを起動しています..."
	@echo "バックエンド: http://0.0.0.0:8000"
	@echo "フロントエンド: http://localhost:5173"
	@echo "停止するには Ctrl+C を押してください"
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "依存関係をインストールしています..."; \
		cd frontend && npm install; \
	fi
	@trap 'kill 0' EXIT; \
	(cd backend && source ~/.cargo/env && cargo run 2>&1 | sed 's/^/[BACKEND] /') & \
	(cd frontend && npm run dev 2>&1 | sed 's/^/[FRONTEND] /') & \
	wait

# バックエンドのみ起動
dev-backend:
	@echo "バックエンドを起動しています..."
	@cd backend && source ~/.cargo/env && cargo run

# フロントエンドのみ起動
dev-frontend:
	@echo "フロントエンドを起動しています..."
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "依存関係をインストールしています..."; \
		cd frontend && npm install; \
	fi
	@cd frontend && npm run dev

# バックエンドをビルド
build:
	@echo "バックエンドをビルドしています..."
	@cd backend && source ~/.cargo/env && cargo build

# クリーンアップ
clean:
	@echo "ビルド成果物をクリーンアップしています..."
	@cd backend && source ~/.cargo/env && cargo clean
	@cd frontend && rm -rf node_modules dist
