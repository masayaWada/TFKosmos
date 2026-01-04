.PHONY: dev tauri build release clean help

# デフォルトターゲット
help:
	@echo "利用可能なコマンド:"
	@echo "  make dev      - 開発環境を起動（バックエンド + フロントエンド）"
	@echo "  make tauri    - Tauriデスクトップアプリを開発モードで起動"
	@echo "  make build    - 開発用ビルド"
	@echo "  make release  - リリース用最適化ビルド（mac/Windows インストーラ生成含む）"
	@echo "  make clean    - ビルド成果物をクリーンアップ"

# 開発環境を起動（バックエンド + フロントエンド）
dev:
	@echo "開発環境を起動しています..."
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

# Tauriデスクトップアプリを開発モードで起動
tauri:
	@echo "Tauriデスクトップアプリを起動しています..."
	@echo "バックエンドは別途 make dev で起動してください（ポート8000が必要）"
	@cd deployment && npm run tauri:dev

# 開発用ビルド
build:
	@echo "開発用ビルドを実行しています..."
	@cd backend && source ~/.cargo/env && cargo build
	@cd frontend && npm run build
	@echo "開発用ビルドが完了しました"

# リリース用最適化ビルド（インストーラ生成含む）
release:
	@echo "リリース用最適化ビルドを実行しています..."
	@cd backend && source ~/.cargo/env && cargo build --release
	@cd frontend && npm run build
	@echo "Tauriデスクトップアプリのインストーラを生成しています..."
	@if [ ! -d "deployment/node_modules" ]; then \
		echo "deploymentディレクトリの依存関係をインストールしています..."; \
		cd deployment && npm install; \
	fi
	@cd deployment && npm run tauri:build
	@echo ""
	@echo "✅ リリース用ビルドが完了しました"
	@echo ""
	@echo "📦 生成されたファイル:"
	@echo "  - バックエンドバイナリ: backend/target/release/tfkosmos"
	@echo "  - Tauriインストーラ: deployment/src-tauri/target/release/bundle/"
	@echo ""
	@echo "💡 インストーラの種類:"
	@echo "  - macOS: .dmg, .app"
	@echo "  - Windows: .msi"

# クリーンアップ
clean:
	@echo "ビルド成果物をクリーンアップしています..."
	@cd backend && source ~/.cargo/env && cargo clean
	@cd frontend && rm -rf node_modules dist
	@cd deployment/src-tauri && cargo clean 2>/dev/null || true
	@rm -rf backend/terraform-output/* 2>/dev/null || true
	@echo "クリーンアップが完了しました"
