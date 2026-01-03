# サブエージェント管理

このディレクトリは、TFKosmos プロジェクトで使用するサブエージェント（Claude Code の Task ツール経由で起動する専用エージェント）の定義を管理します。

## 基本方針

### 「定義」をGit管理、「実体」はローカル保存

- **サブエージェントの実体（バイナリ・生成物）**: 各開発者のローカル環境（`~/.claude/agents/` など）に保存
- **Git管理対象**: エージェントの「仕様・定義」のみ
  - `agents/subagents/<agent-name>/agent.md` - エージェント仕様
  - `agents/subagents/<agent-name>/tools.json` - 許可ツールと権限
  - `agents/subagents/<agent-name>/model.json` - 推奨AIモデル
  - `agents/subagents/<agent-name>/tests.md` - テストケース
  - `agents/subagents/<agent-name>/README.md` - 使い方・生成手順

## ディレクトリ構造

```
agents/
├── README.md                    # このファイル
├── templates/                   # 新規エージェント作成用テンプレート
│   ├── agent-template.md
│   ├── tools-template.json
│   ├── model-template.json
│   └── tests-template.md
└── subagents/                   # サブエージェント定義一覧
    └── git-smart-commit/        # 例：git コミット専用エージェント
        ├── README.md
        ├── agent.md
        ├── tools.json
        ├── model.json
        └── tests.md
```

## サブエージェント一覧

### git-smart-commit

**役割**: Conventional Commits形式のコミットメッセージ自動生成とGit操作

**使用タイミング**:
- ユーザーが「変更をコミットして」などのコミット指示を出した時
- Claude Codeが自動的にこのエージェントを呼び出す

**主な機能**:
- Git変更内容の分析（status, diff, log）
- type/scope の自動判定
- Conventional Commits形式のメッセージ生成
- 機密情報ファイルの検出と警告
- ユーザー確認プロセス

**制約**:
- ユーザー確認なしのコミット実行禁止
- `git push --force` などの危険コマンド禁止
- main/master ブランチへの直接コミット時は警告

**詳細**: [`subagents/git-smart-commit/README.md`](./subagents/git-smart-commit/README.md)

## 新規エージェントの作成手順

1. **テンプレートのコピー**
   ```bash
   cp -r agents/templates/ agents/subagents/<new-agent-name>/
   ```

2. **定義ファイルの編集**
   - `agent.md`: エージェントの役割・ルール・ワークフローを明確に記述
   - `tools.json`: 必要最小限のツールのみ許可（権限の最小化原則）
   - `model.json`: タスクの複雑度に応じたモデル選択（デフォルトはsonnet）
   - `tests.md`: 想定ケースと期待結果を記述
   - `README.md`: ローカル生成手順とトラブルシューティング

3. **プロジェクトルールの参照**
   - エージェント定義内で `.claude/rules/` 配下のルールを参照
   - `docs/` 配下のドキュメント（コミット戦略、用語集など）を活用

4. **PR経由での追加**
   - ブランチ名: `agents/feature/<agent-name>`
   - PRテンプレート: `.github/PULL_REQUEST_TEMPLATE/agent_template.md` を使用
   - レビュアー承認後、マージ

## エージェント作成のベストプラクティス

### 1. 明確な責任範囲

- **1エージェント = 1つの明確な役割**
  - ✅ 良い例: `git-smart-commit` - コミットメッセージ生成専用
  - ❌ 悪い例: `code-helper` - コーディング全般（範囲が広すぎる）

### 2. 権限の最小化

- **必要最小限のツールのみ許可**
  - Read-only で済むなら Execution 権限を与えない
  - Bash の `denied` リストで危険コマンドを明示的に禁止

**例（tools.json）:**
```json
{
  "Bash": {
    "permissions": [
      {"pattern": "git status", "level": "read-only"}
    ],
    "denied": [
      {"pattern": "git push --force*", "reason": "強制プッシュは禁止"}
    ]
  }
}
```

### 3. 再現可能性の確保

- **定義文だけで誰でも同じエージェントを再生成できる**
  - 環境依存の設定は README に明記
  - サンプル入力と期待出力を tests.md に記述

### 4. テストケースの充実

- **正常系・異常系・エッジケースを網羅**
  - 想定する入力パターンを明確化
  - 期待される出力・振る舞いを記述
  - 回帰テストチェックリストを作成

### 5. プロジェクトルールの参照

- **エージェント定義で明示的にルールファイルを参照**
  ```markdown
  ## ルールと制約

  1. プロジェクトルールの参照
     - コミット前に以下を読み込み:
       - `.claude/rules/coding-standards.md`
       - `.claude/rules/commit-strategy.md`
  ```

## ローカルでのエージェント使用方法

1. **Claude Code でエージェントを呼び出す**
   - Claude Code が自動的に適切なエージェントを選択
   - または、明示的に Task ツールで `subagent_type` を指定

2. **エージェントのカスタマイズ（個人用）**
   - ローカルの `.claude/agents/` にカスタム定義を配置
   - チーム共有エージェントを上書き可能（個人環境のみ）

## トラブルシューティング

### Q1: エージェントが期待通りに動作しない

**対処法**:
1. `agents/subagents/<agent-name>/agent.md` を再読み込み
2. `tools.json` の権限設定を確認
3. `.claude/rules/` のルールと矛盾していないか確認

### Q2: チームメンバーとエージェントの挙動が異なる

**対処法**:
1. `git pull` で最新の定義を取得
2. ローカルのエージェント設定をリセット
3. 定義ファイルをもとに再生成

### Q3: 新規エージェントの追加方法がわからない

**対処法**:
1. `agents/templates/` をコピー
2. 本 README の手順に従う
3. PR作成時は `.github/PULL_REQUEST_TEMPLATE/agent_template.md` を使用

## 関連ドキュメント

- [.claude/rules/agent-management.md](../.claude/rules/agent-management.md) - サブエージェント管理ルール
- [.claude/rules/commit-strategy.md](../.claude/rules/commit-strategy.md) - コミット規約
- [docs/用語集.md](../docs/用語集.md) - プロジェクト用語集
- [.github/CODEOWNERS](../.github/CODEOWNERS) - レビュアー設定
- [.github/PULL_REQUEST_TEMPLATE/agent_template.md](../.github/PULL_REQUEST_TEMPLATE/agent_template.md) - PRテンプレート

## 更新履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-01-03 | 初版作成 | Claude Sonnet 4.5 |
