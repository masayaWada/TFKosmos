# git-smart-commit エージェント

## 概要

Conventional Commits形式のコミットメッセージを自動生成し、安全なGit操作を支援するサブエージェントです。

**バージョン**: 1.0.0
**最終更新**: 2026-01-03

## 主な機能

- Git変更内容の自動分析（status, diff, log）
- type/scope の自動判定
- Conventional Commits形式のメッセージ生成
- 機密情報ファイルの検出と警告
- ユーザー確認プロセスの徹底
- プロジェクトコミット規約の遵守

## 使用タイミング

このエージェントは以下の場合に自動的に起動されます：

1. **ユーザーからのコミット指示**
   - 「変更をコミットして」
   - 「これをコミット」
   - 「git commit を実行」

2. **自動判定による起動**
   - Claude Code がコミット操作が必要と判断した場合

## クイックスタート

### 1. ローカルでエージェントを使用

Claude Code がこのエージェント定義を自動的に読み込み、適切なタイミングで起動します。

**使用例**:
```
ユーザー: 変更をコミットしてください

エージェント:
1. git status で変更ファイルを確認
2. git diff で変更内容を分析
3. git log で過去のコミットスタイルを確認
4. Conventional Commits形式のメッセージを生成
5. ユーザーに確認を求める
6. 承認後、git commit を実行
```

### 2. カスタマイズ

個人用にカスタマイズしたい場合：

1. `agents/subagents/git-smart-commit/` の内容をコピー
2. ローカルの `.claude/agents/git-smart-commit/` に配置
3. `agent.md` や `tools.json` を自分の環境に合わせて編集

## 動作フロー

```
1. Git変更内容の分析
   ├─ git status（ステージング状況）
   ├─ git diff --cached（変更差分）
   └─ git log --oneline -5（過去のコミット）
   ↓
2. type/scopeの自動判定
   ├─ 変更ファイルパスから scope を推測
   ├─ 変更内容から type を判定
   └─ Conventional Commits 規約に準拠
   ↓
3. コミットメッセージ生成
   ├─ 件名（50文字以内）
   ├─ 本文（変更内容の詳細）
   └─ フッター（関連Issue、Co-Authored-By）
   ↓
4. 機密情報チェック
   ├─ .env ファイルの検出
   ├─ credentials ファイルの検出
   └─ 検出時は警告を表示
   ↓
5. ユーザー確認
   ├─ 生成されたメッセージを表示
   ├─ ユーザーの承認を待つ
   └─ 修正要望があれば再生成
   ↓
6. コミット実行
   ├─ git commit -m "..."
   ├─ 成功/失敗を報告
   └─ git status で確認
```

## 制約事項

### 必須制約

- ✅ **ユーザー確認の必須化**: コミット実行前に必ずユーザーの承認を得る
- ✅ **機密情報の保護**: `.env`, `credentials` 等のファイルを検出した場合は警告
- ✅ **危険操作の禁止**: `git push --force`, `git commit --amend`（条件付き）は禁止

### 禁止コマンド

- ❌ `git push --force` - 強制プッシュ禁止
- ❌ `git push --force-with-lease` - 強制プッシュ禁止
- ❌ `git commit --amend`（ユーザー明示的要求なし）- 履歴改変禁止
- ❌ `git reset --hard` - 破壊的リセット禁止
- ❌ `sudo` - 管理者権限での実行禁止

### 警告条件

- ⚠️ main/master ブランチへの直接コミット時
- ⚠️ 機密情報ファイル（.env, credentials等）のコミット時
- ⚠️ 大量ファイル（50ファイル以上）のコミット時

## トラブルシューティング

### Q1: コミットメッセージが期待通りに生成されない

**対処法**:
1. `.claude/rules/commit-strategy.md` を確認
2. `git log --oneline -5` で過去のコミットスタイルを確認
3. 手動でメッセージを修正してコミット

### Q2: 機密情報ファイルの警告が出る

**対処法**:
1. `.gitignore` に該当ファイルを追加
2. `git rm --cached <file>` でステージングから除外
3. 再度コミットを試行

### Q3: エージェントが起動しない

**対処法**:
1. `agents/subagents/git-smart-commit/agent.md` が存在するか確認
2. Claude Code を再起動
3. Task ツールで明示的に `subagent_type='git-smart-commit'` を指定

## 関連ドキュメント

- [agent.md](./agent.md) - エージェント仕様の詳細
- [tools.json](./tools.json) - 使用可能なツールと権限
- [model.json](./model.json) - 推奨AIモデル設定
- [tests.md](./tests.md) - テストケース一覧
- [.claude/rules/commit-strategy.md](../../../.claude/rules/commit-strategy.md) - プロジェクトコミット規約

## フィードバック

問題や改善提案がある場合は、以下の方法でフィードバックをお願いします：

1. GitHub Issue を作成
2. PR でエージェント定義を改善
3. チーム内で議論

## 更新履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-01-03 | 初版作成 | Claude Sonnet 4.5 |
