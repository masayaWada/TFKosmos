#!/bin/bash
# エージェントのバージョンを更新し、CHANGELOG を生成するスクリプト

set -e

# 使用方法を表示
usage() {
    cat <<EOF
使用方法: $0 <agent-name> <version-type> [description]

引数:
  agent-name     エージェント名（例: git-smart-commit）
  version-type   バージョンタイプ（major, minor, patch）
  description    変更内容の説明（オプション）

例:
  $0 git-smart-commit minor "マージコミット機能の追加"
  $0 git-smart-commit patch "バグ修正"

セマンティックバージョニング:
  major: 破壊的変更（互換性のない変更）
  minor: 後方互換性のある機能追加
  patch: 後方互換性のあるバグ修正
EOF
    exit 1
}

# 引数チェック
if [ $# -lt 2 ]; then
    usage
fi

AGENT_NAME="$1"
VERSION_TYPE="$2"
DESCRIPTION="${3:-バージョン更新}"

# エージェントディレクトリのパス
AGENT_DIR=".claude/agents/subagents/$AGENT_NAME"
VERSION_FILE="$AGENT_DIR/version.json"
CHANGELOG_FILE="$AGENT_DIR/CHANGELOG.md"

# エージェントの存在確認
if [ ! -d "$AGENT_DIR" ]; then
    echo "エラー: エージェント '$AGENT_NAME' が見つかりません"
    echo "パス: $AGENT_DIR"
    exit 1
fi

# version.json の存在確認
if [ ! -f "$VERSION_FILE" ]; then
    echo "エラー: version.json が見つかりません"
    echo "パス: $VERSION_FILE"
    exit 1
fi

# 現在のバージョンを取得
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$VERSION_FILE")
echo "現在のバージョン: $CURRENT_VERSION"

# バージョン番号を分解
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# 新しいバージョンを計算
case "$VERSION_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "エラー: 無効なバージョンタイプ: $VERSION_TYPE"
        echo "有効な値: major, minor, patch"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TODAY=$(date +%Y-%m-%d)

echo "新しいバージョン: $NEW_VERSION"
echo "リリース日: $TODAY"

# version.json を更新
cat > "$VERSION_FILE" <<EOF
{
  "version": "$NEW_VERSION",
  "released": "$TODAY",
  "status": "stable",
  "description": "$(grep -oP '"description":\s*"\K[^"]+' "$VERSION_FILE")"
}
EOF

echo "✅ version.json を更新しました"

# CHANGELOG.md の更新
if [ -f "$CHANGELOG_FILE" ]; then
    # 一時ファイルに新しいエントリを作成
    TEMP_FILE=$(mktemp)

    # CHANGELOGのヘッダーをコピー
    sed -n '1,/## \[Unreleased\]/p' "$CHANGELOG_FILE" > "$TEMP_FILE"

    # 新しいバージョンエントリを追加
    cat >> "$TEMP_FILE" <<EOF

## [$NEW_VERSION] - $TODAY

### Changed
- $DESCRIPTION

EOF

    # 既存のバージョン履歴を追加
    sed -n '/## \[.*\] - [0-9]/,$p' "$CHANGELOG_FILE" >> "$TEMP_FILE"

    # CHANGELOGを更新
    mv "$TEMP_FILE" "$CHANGELOG_FILE"

    echo "✅ CHANGELOG.md を更新しました"
else
    echo "⚠️  CHANGELOG.md が見つかりません。テンプレートから作成してください。"
fi

# README.md の更新履歴テーブルも更新（存在する場合）
README_FILE="$AGENT_DIR/README.md"
if [ -f "$README_FILE" ] && grep -q "## 更新履歴" "$README_FILE"; then
    # 更新履歴テーブルに新しい行を追加
    sed -i '' "/^| 日付 | 変更内容 | 変更者 |/a\\
| $TODAY | v$NEW_VERSION: $DESCRIPTION | Claude Sonnet 4.5 |
" "$README_FILE"
    echo "✅ README.md の更新履歴を更新しました"
fi

echo ""
echo "🎉 バージョン更新が完了しました！"
echo ""
echo "次のステップ:"
echo "1. CHANGELOG.md を確認し、詳細な変更内容を追記"
echo "2. git add $AGENT_DIR"
echo "3. git commit -m 'chore(agents): $AGENT_NAME を v$NEW_VERSION にアップデート'"
echo "4. git tag -a agents/$AGENT_NAME/v$NEW_VERSION -m 'Release $AGENT_NAME v$NEW_VERSION'"
