# git-smart-commit エージェント

Conventional Commits形式のコミットメッセージを自動生成し、ユーザー確認なしでコミット・プッシュまで実行するサブエージェント。

## 概要

このエージェントは、ステージング済みの変更内容を分析し、以下を自動的に実行します:

1. 変更内容の分析（`git status`, `git diff --cached`, `git log`）
2. Conventional Commits形式のメッセージ自動生成
3. 機密情報ファイルのチェック
4. コミットの実行
5. リモートへのプッシュ

**重要**: このエージェントはユーザー確認を求めずに自動実行します。

## 使い方

### 前提条件

変更をステージングエリアに追加しておく:

```bash
git add <file>
```

### 基本的な使い方

Claude Codeで以下のように指示:

```
「コードをコミットしてプッシュして」
「変更をコミット」
「git commit and push」
```

→ このエージェントが自動的に起動し、コミット・プッシュを実行

### 実行されること

1. **変更内容の確認**
   ```bash
   git status
   git diff --cached
   git log --oneline -5
   ```

2. **コミットメッセージの自動生成**
   - type と scope を自動判定
   - 変更内容から適切なメッセージを作成
   - Conventional Commits形式に準拠

3. **機密情報チェック**
   - `.env`, `credentials` などの検出
   - 検出時はコミットを中断

4. **コミット実行**
   ```bash
   git commit -m "<自動生成メッセージ>"
   ```

5. **プッシュ実行**
   ```bash
   git push origin <current-branch>
   ```

## コミットメッセージの例

### 新機能追加

```
feat(backend): IAMユーザースキャン機能の追加

- AWS SDK経由でIAMユーザーを取得
- 非同期処理によるパフォーマンス改善
- フィルタリング機能を追加

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### バグ修正

```
fix(frontend): UTF-8文字列のスライスエラーを修正

文字境界を考慮したスライス処理に変更

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 設定変更

```
chore(config): PostToolUseフックの追加

自動フォーマット機能を追加

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## セキュリティ機能

### 機密情報の検出

以下のファイルがステージングされている場合、コミットを中断:

- `.env`, `.env.*`
- `credentials`, `credentials.*`
- `secrets`, `secrets.*`
- `*.key`, `*.pem`
- AWS/Azure認証情報ファイル

### 禁止コマンド

以下のコマンドは絶対に実行されません:

- `git push --force`
- `git commit --amend`
- `git reset --hard`
- `git rebase -i`
- `git commit --no-verify`

## トラブルシューティング

### Q1: コミットメッセージを確認してからコミットしたい

**A**: このエージェントは自動実行用です。確認したい場合は通常のClaude Code機能を使用してください:

```
「変更内容を確認してからコミットして」
```

→ このエージェントは起動せず、通常のgit操作が実行されます

### Q2: 機密情報ファイルを誤ってステージングした

**A**: エージェントが自動的に検出し、コミットを中断します。以下のコマンドでアンステージしてください:

```bash
git reset HEAD <file>
```

### Q3: コミットメッセージの形式を変更したい

**A**: `agent.md` の「コミットメッセージ生成」セクションを編集してください。変更後は以下を実行:

1. エージェント定義の更新をコミット
2. ローカルのエージェント設定をリセット
3. 新しい定義でエージェントを再生成

### Q4: プッシュに失敗した

**A**: 以下のケースが考えられます:

- **リモートとの競合**: `git pull --rebase` でリモートの変更を取り込んでください
- **ネットワークエラー**: 再度プッシュを試してください
- **権限エラー**: リポジトリへのプッシュ権限を確認してください

## 権限設定

このエージェントが使用できるツール:

- ✅ **Bash (Git専用)**
  - `git status`, `git diff`, `git log` (読み取り)
  - `git commit`, `git push` (書き込み)

- ❌ **使用不可**
  - Read, Write, Edit (ファイル操作)
  - Grep, Glob (ファイル検索)
  - Task (サブエージェント起動)
  - WebFetch, WebSearch (Web操作)

詳細は `tools.json` を参照してください。

## 関連ドキュメント

- [agent.md](./agent.md) - エージェント詳細仕様
- [tools.json](./tools.json) - ツール権限設定
- [.claude/rules/commit-strategy.md](../../../.claude/rules/commit-strategy.md) - コミット規約
- [.claude/rules/agent-management.md](../../../.claude/rules/agent-management.md) - エージェント管理ガイド

## 更新履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-01-01 | 初版作成 | @wadamasaya |

## ライセンス

このエージェントはTFKosmosプロジェクトの一部として、プロジェクトと同じライセンスで提供されます。
