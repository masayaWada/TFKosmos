.PHONY: dev tauri build release clean test test-backend test-frontend test-e2e coverage coverage-backend coverage-frontend coverage-report help

# デフォルトターゲット
help:
	@echo "利用可能なコマンド:"
	@echo "  make dev              - 開発環境を起動（バックエンド + フロントエンド）"
	@echo "  make tauri            - Tauriデスクトップアプリを開発モードで起動"
	@echo "  make build            - 開発用ビルド"
	@echo "  make release          - リリース用最適化ビルド（mac/Windows インストーラ生成含む）"
	@echo "  make test             - 全テストを実行（バックエンド + フロントエンド）"
	@echo "  make test-backend     - バックエンドテストのみ実行"
	@echo "  make test-frontend    - フロントエンドテストのみ実行"
	@echo "  make test-e2e         - E2Eテストを実行"
	@echo "  make coverage         - カバレッジレポートを生成（全体）"
	@echo "  make coverage-backend - バックエンドカバレッジレポートを生成"
	@echo "  make coverage-frontend- フロントエンドカバレッジレポートを生成"
	@echo "  make coverage-report  - カバレッジレポートを開く"
	@echo "  make clean            - ビルド成果物をクリーンアップ"

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

# テスト実行
test: test-backend test-frontend
	@echo "✅ 全テストが完了しました"

test-backend:
	@echo "バックエンドテストを実行しています..."
	@cd backend && source ~/.cargo/env && cargo test
	@echo "✅ バックエンドテスト完了"

test-frontend:
	@echo "フロントエンドテストを実行しています..."
	@cd frontend && npm run test:run
	@echo "✅ フロントエンドテスト完了"

test-e2e:
	@echo "E2Eテストを実行しています..."
	@cd frontend && npm run test:e2e
	@echo "✅ E2Eテスト完了"

# カバレッジレポート生成
coverage: coverage-backend coverage-frontend
	@echo ""
	@echo "✅ 全カバレッジレポートが生成されました"
	@echo ""
	@echo "📊 レポートの場所:"
	@echo "  - バックエンド: backend/target/llvm-cov/html/index.html"
	@echo "  - フロントエンド: frontend/coverage/index.html"
	@echo ""
	@echo "💡 レポートを開くには: make coverage-report"

coverage-backend:
	@echo "バックエンドカバレッジレポートを生成しています..."
	@cd backend && source ~/.cargo/env && cargo llvm-cov --html --open
	@echo "✅ バックエンドカバレッジレポート生成完了"

coverage-frontend:
	@echo "フロントエンドカバレッジレポートを生成しています..."
	@cd frontend && npm run test:coverage
	@echo "✅ フロントエンドカバレッジレポート生成完了"

coverage-report:
	@echo "カバレッジレポートを開いています..."
	@open backend/target/llvm-cov/html/index.html 2>/dev/null || echo "バックエンドレポートが見つかりません"
	@open frontend/coverage/index.html 2>/dev/null || echo "フロントエンドレポートが見つかりません"

# クリーンアップ
clean:
	@echo "ビルド成果物をクリーンアップしています..."
	@cd backend && source ~/.cargo/env && cargo clean
	@cd frontend && rm -rf node_modules dist coverage playwright-report test-results
	@cd deployment/src-tauri && cargo clean 2>/dev/null || true
	@rm -rf backend/terraform-output/* 2>/dev/null || true
	@echo "クリーンアップが完了しました"
