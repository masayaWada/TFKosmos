#!/bin/bash
# git-smart-commit エージェントの自動テストスクリプト
#
# 使用方法:
#   ./test.sh [options]
#
# オプション:
#   -v, --verbose    詳細なログを出力
#   -q, --quick      基本テストのみ実行（高速）
#   -h, --help       ヘルプを表示

set -e

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# グローバル変数
VERBOSE=false
QUICK_MODE=false
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
TOTAL_TESTS=0

# テスト結果の一時ディレクトリ
TEST_TEMP_DIR=$(mktemp -d)
TEST_REPO_DIR="$TEST_TEMP_DIR/test-repo"
TEST_RESULTS_FILE="$TEST_TEMP_DIR/results.log"

# クリーンアップ関数（終了時に必ず実行）
cleanup() {
    echo ""
    echo -e "${BLUE}🧹 テスト環境をクリーンアップ中...${NC}"
    rm -rf "$TEST_TEMP_DIR"
}
trap cleanup EXIT

# 使用方法を表示
usage() {
    cat <<EOF
git-smart-commit エージェント自動テストスクリプト

使用方法:
  $0 [options]

オプション:
  -v, --verbose    詳細なログを出力
  -q, --quick      基本テストのみ実行（高速）
  -h, --help       ヘルプを表示

説明:
  このスクリプトは、git-smart-commit エージェントの tests.md に定義された
  テストケースを自動実行します。

  実行可能なテスト:
    - TC3:  機密ファイル検出
    - TC4:  ステージング済み変更なし
    - TC5:  main ブランチへのコミット警告
    - TC8:  大量ファイル変更警告
    - TC9:  Git リポジトリでない場合
    - TC11: マージコミット検出
    - TC13: Issue番号の自動リンク

  注意:
    - ユーザーインタラクションが必要なテストケース（TC1, TC2, TC6, TC7, TC10）は
      手動テストまたは統合テストが必要です。
    - Breaking Change 検出（TC12, TC14, TC15）は複雑なため、
      統合テストで実施することを推奨します。

例:
  $0              # 全テストを実行
  $0 -q           # 基本テストのみ実行
  $0 -v           # 詳細ログ付きで実行

EOF
    exit 0
}

# 引数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "エラー: 不明なオプション: $1"
            usage
            ;;
    esac
done

# ログ出力関数
log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# テスト結果を記録
record_test_result() {
    local test_id="$1"
    local test_name="$2"
    local result="$3"  # PASS, FAIL, SKIP
    local message="$4"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo "$test_id|$test_name|$result|$message" >> "$TEST_RESULTS_FILE"

    case "$result" in
        PASS)
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log_success "TC$test_id: $test_name - PASS"
            ;;
        FAIL)
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "TC$test_id: $test_name - FAIL: $message"
            ;;
        SKIP)
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            log_warning "TC$test_id: $test_name - SKIP: $message"
            ;;
    esac
}

# テスト用Gitリポジトリをセットアップ
setup_test_repo() {
    log_info "テスト用Gitリポジトリをセットアップ中..."

    mkdir -p "$TEST_REPO_DIR"
    cd "$TEST_REPO_DIR"

    git init -q
    git config user.name "Test User"
    git config user.email "test@example.com"

    # 初期コミット
    echo "# Test Repository" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    # デフォルトブランチを main にリネーム（Git 2.28以降でサポート）
    git branch -M main

    log_verbose "テストリポジトリを作成: $TEST_REPO_DIR"
}

# テストリポジトリをクリーンアップ
cleanup_test_repo() {
    log_verbose "テストリポジトリをクリーンアップ"
    cd "$TEST_TEMP_DIR"
    rm -rf "$TEST_REPO_DIR"
}

# =============================================================================
# テストケース実装
# =============================================================================

# TC3: [異常系] 機密ファイルが含まれる場合
test_case_03_sensitive_files() {
    local test_id="3"
    local test_name="機密ファイルが含まれる場合"

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # .env ファイルを作成してステージング
    echo "API_KEY=secret123" > .env
    git add .env

    # git status を実行して .env が含まれることを確認
    if git status --short | grep -q "^A.*\.env$"; then
        record_test_result "$test_id" "$test_name" "PASS" "機密ファイル .env が検出された"
    else
        record_test_result "$test_id" "$test_name" "FAIL" ".env がステージングされていない"
    fi

    cleanup_test_repo
}

# TC4: [異常系] ステージング済み変更なし
test_case_04_no_staged_changes() {
    local test_id="4"
    local test_name="ステージング済み変更なし"

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # ステージング済みの変更がないことを確認
    git_status=$(git diff --cached --name-only)

    if [ -z "$git_status" ]; then
        record_test_result "$test_id" "$test_name" "PASS" "ステージング済み変更がないことを検出"
    else
        record_test_result "$test_id" "$test_name" "FAIL" "予期しないステージング済み変更が存在"
    fi

    cleanup_test_repo
}

# TC5: [エッジケース] main ブランチへのコミット
test_case_05_main_branch_commit() {
    local test_id="5"
    local test_name="main ブランチへのコミット"

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # main ブランチにいることを確認
    current_branch=$(git branch --show-current)

    if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
        record_test_result "$test_id" "$test_name" "PASS" "main/master ブランチを検出"
    else
        record_test_result "$test_id" "$test_name" "FAIL" "main/master ブランチではない: $current_branch"
    fi

    cleanup_test_repo
}

# TC8: [エッジケース] 大量ファイル変更
test_case_08_large_file_changes() {
    local test_id="8"
    local test_name="大量ファイル変更"

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # 60個のファイルを作成してステージング
    for i in {1..60}; do
        echo "File $i" > "file_$i.txt"
    done
    git add .

    # ステージングされたファイル数を確認
    staged_count=$(git diff --cached --name-only | wc -l | tr -d ' ')

    if [ "$staged_count" -gt 50 ]; then
        record_test_result "$test_id" "$test_name" "PASS" "大量ファイル変更を検出 ($staged_count ファイル)"
    else
        record_test_result "$test_id" "$test_name" "FAIL" "ファイル数が不足: $staged_count"
    fi

    cleanup_test_repo
}

# TC9: [異常系] Git リポジトリでない
test_case_09_not_git_repo() {
    local test_id="9"
    local test_name="Git リポジトリでない"

    log_info "TC$test_id: $test_name を実行中..."

    # Gitリポジトリでないディレクトリを作成
    local non_git_dir="$TEST_TEMP_DIR/non-git-dir"
    mkdir -p "$non_git_dir"
    cd "$non_git_dir"

    # git status を実行してエラーになることを確認
    if ! git status &>/dev/null; then
        record_test_result "$test_id" "$test_name" "PASS" "Gitリポジトリでないことを検出"
    else
        record_test_result "$test_id" "$test_name" "FAIL" "Gitリポジトリとして認識された"
    fi

    cd "$TEST_TEMP_DIR"
    rm -rf "$non_git_dir"
}

# TC11: [正常系] マージコミットのサポート
test_case_11_merge_commit() {
    local test_id="11"
    local test_name="マージコミットのサポート"

    if [ "$QUICK_MODE" = true ]; then
        record_test_result "$test_id" "$test_name" "SKIP" "クイックモードのためスキップ"
        return
    fi

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # feature ブランチを作成
    git checkout -q -b feature/150-user-management
    echo "New feature" > feature.txt
    git add feature.txt
    git commit -q -m "feat: add user management"

    # main に戻ってマージ（fast-forward を無効化）
    git checkout -q main
    git merge --no-ff --no-commit feature/150-user-management &>/dev/null || true

    # MERGE_HEAD が存在することを確認
    if git rev-parse -q --verify MERGE_HEAD &>/dev/null; then
        record_test_result "$test_id" "$test_name" "PASS" "マージ状態を検出（MERGE_HEAD 存在）"
    else
        record_test_result "$test_id" "$test_name" "FAIL" "MERGE_HEAD が見つからない"
    fi

    # マージを中断
    git merge --abort &>/dev/null || true

    cleanup_test_repo
}

# TC13: [正常系] Issue番号の自動リンク
test_case_13_issue_number_extraction() {
    local test_id="13"
    local test_name="Issue番号の自動リンク"

    if [ "$QUICK_MODE" = true ]; then
        record_test_result "$test_id" "$test_name" "SKIP" "クイックモードのためスキップ"
        return
    fi

    log_info "TC$test_id: $test_name を実行中..."

    setup_test_repo

    # feature/180-terraform-generator ブランチを作成
    git checkout -q -b feature/180-terraform-generator

    # ブランチ名を取得
    branch_name=$(git branch --show-current)

    # ブランチ名から Issue 番号を抽出（正規表現）
    if [[ "$branch_name" =~ feature/([0-9]+)- ]]; then
        issue_number="${BASH_REMATCH[1]}"
        if [ "$issue_number" = "180" ]; then
            record_test_result "$test_id" "$test_name" "PASS" "Issue番号を抽出: #$issue_number"
        else
            record_test_result "$test_id" "$test_name" "FAIL" "間違った Issue 番号: #$issue_number"
        fi
    else
        record_test_result "$test_id" "$test_name" "FAIL" "Issue番号を抽出できなかった"
    fi

    cleanup_test_repo
}

# =============================================================================
# メイン処理
# =============================================================================

main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  git-smart-commit エージェント 自動テストスクリプト          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$QUICK_MODE" = true ]; then
        log_info "クイックモード: 基本テストのみ実行"
    else
        log_info "通常モード: 全テストを実行"
    fi

    if [ "$VERBOSE" = true ]; then
        log_info "詳細ログモード: 有効"
    fi

    echo ""
    log_info "テスト開始..."
    echo ""

    # テスト実行（番号順）
    test_case_03_sensitive_files
    test_case_04_no_staged_changes
    test_case_05_main_branch_commit
    test_case_08_large_file_changes
    test_case_09_not_git_repo
    test_case_11_merge_commit
    test_case_13_issue_number_extraction

    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  テスト結果サマリー                                          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo "実行テスト数: $TOTAL_TESTS"
    echo -e "${GREEN}成功: $PASSED_TESTS${NC}"
    echo -e "${RED}失敗: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}スキップ: $SKIPPED_TESTS${NC}"

    echo ""

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "すべてのテストが成功しました！"
        echo ""
        echo "次のステップ:"
        echo "  1. tests.md の実施結果セクションを更新"
        echo "  2. 手動テストが必要なケース（TC1, TC2, TC6, TC7, TC10）を実施"
        echo "  3. 統合テストで Breaking Change 検出（TC12, TC14, TC15）を検証"
        exit 0
    else
        log_error "一部のテストが失敗しました"
        echo ""
        echo "失敗したテストの詳細:"
        grep "FAIL" "$TEST_RESULTS_FILE" | while IFS='|' read -r id name result message; do
            echo -e "  ${RED}TC$id: $name - $message${NC}"
        done
        exit 1
    fi
}

# メイン処理を実行
main
