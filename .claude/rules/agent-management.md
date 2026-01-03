# サブエージェント管理

適用対象: Claude Code による TFKosmos プロジェクトでのサブエージェント運用

## 基本方針

### 「定義」をGit管理、「実体」はローカル保存

- **サブエージェントの実体（バイナリ・生成物）**: 各開発者のローカル環境に保存
- **Git管理対象**: エージェントの「仕様・定義」のみ
  - `.claude/agents/subagents/<agent-name>/agent.md` - エージェント仕様
  - `.claude/agents/subagents/<agent-name>/tools.json` - 許可ツールと権限
  - `.claude/agents/subagents/<agent-name>/model.json` - 推奨AIモデル
  - `.claude/agents/subagents/<agent-name>/tests.md` - テストケース
  - `.claude/agents/subagents/<agent-name>/README.md` - 使い方・生成手順

### 個人運用とチーム共有の分離

- **チーム共有エージェント**: `.claude/agents/subagents/` 配下で管理
- **個人専用エージェント**: ローカルのみ保存（`.gitignore` で除外）
- **プロジェクト共通情報**: `.claude/rules/` および `docs/` で管理

## サブエージェント使用時のルール

### 1. エージェント生成時

新規サブエージェントの作成を指示された場合：

1. **テンプレートのコピー**
   ```bash
   cp -r .claude/agents/templates/ .claude/agents/subagents/<agent-name>/
   ```

2. **定義ファイルの編集**
   - `agent.md`: エージェントの役割・ルール・ワークフローを明確に記述
   - `tools.json`: 必要最小限のツールのみ許可（権限の最小化原則）
   - `model.json`: タスクの複雑度に応じたモデル選択（デフォルトはsonnet）
   - `tests.md`: 想定ケースと期待結果を記述
   - `README.md`: ローカル生成手順とトラブルシューティング

3. **プロジェクトルールの参照**
   - `.claude/rules/` 配下のルールを自動的に参照
   - `docs/` 配下のドキュメント（コミット戦略、用語集など）を活用

4. **PR経由での追加**
   - ブランチ名: `agents/feature/<agent-name>`
   - PRテンプレート: `.github/PULL_REQUEST_TEMPLATE/agent_template.md` を使用
   - レビュアー承認後、マージ

### 2. エージェント更新時

既存エージェントの更新を指示された場合：

1. **定義ファイルの変更**
   - `agent.md` のルールやワークフローを更新
   - `tools.json` の権限設定を見直し
   - `tests.md` に新規テストケースを追加

2. **バージョン管理（セマンティックバージョニング）**

   エージェントのバージョンは [Semantic Versioning 2.0.0](https://semver.org/) に準拠します。

   **バージョン番号の形式**: `MAJOR.MINOR.PATCH`

   - **MAJOR**: 破壊的変更（互換性のない変更）
     - 例: ツールの削除、必須パラメータの追加、動作の根本的な変更
   - **MINOR**: 後方互換性のある機能追加
     - 例: 新機能の追加、オプションパラメータの追加
   - **PATCH**: 後方互換性のあるバグ修正
     - 例: バグ修正、ドキュメント修正、内部リファクタリング

   **バージョン更新の手順**:

   a. **自動更新スクリプトの使用（推奨）**
   ```bash
   # マイナーバージョンアップ（機能追加）
   ./scripts/bump-agent-version.sh git-smart-commit minor "マージコミット機能の追加"

   # パッチバージョンアップ（バグ修正）
   ./scripts/bump-agent-version.sh git-smart-commit patch "バグ修正"

   # メジャーバージョンアップ（破壊的変更）
   ./scripts/bump-agent-version.sh git-smart-commit major "API変更"
   ```

   b. **手動更新（ディレクトリ構造のエージェント）**
   - `version.json` のバージョン番号とリリース日を更新
   - `CHANGELOG.md` に変更内容を記録
   - `README.md` の更新履歴テーブルに新しいエントリを追加

   c. **手動更新（単一ファイル形式のエージェント）**
   - YAMLフロントマターの `version` と `released` フィールドを更新
   - ファイル末尾の更新履歴セクションに新しいエントリを追加

   **CHANGELOG.md の記載方法**:

   [Keep a Changelog](https://keepachangelog.com/) 形式に従います。

   ```markdown
   ## [1.2.0] - 2026-01-03

   ### Added
   - 新機能の説明

   ### Changed
   - 変更内容の説明

   ### Deprecated
   - 非推奨になった機能

   ### Removed
   - 削除された機能

   ### Fixed
   - 修正されたバグ

   ### Security
   - セキュリティ関連の変更
   ```

   **破壊的変更の場合**:
   - チームに周知し、移行ガイドを提供
   - CHANGELOG に `BREAKING CHANGE:` セクションを追加
   - 関連するドキュメントを更新

3. **回帰テスト**
   - `tests.md` の全ケースを再テスト
   - 既存の動作が維持されることを確認

### 3. エージェント使用時

サブエージェントを呼び出す場合：

1. **定義の確認**
   - `.claude/agents/subagents/<agent-name>/agent.md` を読み込み
   - エージェントの役割・ルール・制約を理解

2. **ツール権限の遵守**
   - `tools.json` で許可されたツールのみ使用
   - `denied` リストのコマンドは絶対に実行しない

3. **ユーザー確認の徹底**
   - コミット、デプロイ、データ削除など重要な操作前に必ず確認
   - AskUserQuestion ツールを活用

4. **プロジェクトルールの優先**
   - `.claude/rules/` 配下のルールが最優先
   - エージェント定義と矛盾する場合、`.claude/rules/` を優先

## サブエージェント一覧

### git-smart-commit

**役割**: Conventional Commits形式のコミットメッセージ自動生成

**使用タイミング**:
- ユーザーが「変更をコミットして」などのコミット指示を出した時
- 自動的にこのエージェントを呼び出す

**主な機能**:
- Git変更内容の分析
- type/scope の自動判定
- Conventional Commits形式のメッセージ生成
- 機密情報ファイルの検出と警告
- ユーザー確認プロセス

**制約**:
- ユーザー確認なしのコミット実行禁止
- `git push --force` などの危険コマンド禁止
- main/master ブランチへの直接コミット時は警告

**詳細**: `.claude/agents/subagents/git-smart-commit/README.md`

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
       - `.claude/agents/prompts/shared-snippets.md`
  ```

## エージェント定義の優先順位

1. **`.claude/rules/**`** - プロジェクト全体のルール（最優先）
2. **`.claude/agents/subagents/<agent-name>/agent.md`** - エージェント固有のルール
3. **`docs/**`** - プロジェクトドキュメント（コミット戦略、用語集など）

矛盾がある場合、上位の優先順位に従う。

## セキュリティとコンプライアンス

### 必須事項

1. **機密情報の保護**
   - `.env`, `credentials` などへのアクセスを `tools.json` で明示的に拒否
   - 機密ファイルのコミットを検出し、警告

2. **危険なコマンドの禁止**
   - `rm -rf`, `sudo`, `git push --force` などを拒否
   - `tools.json` の `denied` リストで管理

3. **ユーザー確認の徹底**
   - 破壊的操作（削除、上書き、プッシュ等）の前に必ず確認
   - AskUserQuestion ツールを使用

## トラブルシューティング

### Q1: エージェントが期待通りに動作しない

**対処法**:
1. `.claude/agents/subagents/<agent-name>/agent.md` を再読み込み
2. `tools.json` の権限設定を確認
3. `.claude/rules/` のルールと矛盾していないか確認

### Q2: チームメンバーとエージェントの挙動が異なる

**対処法**:
1. `git pull` で最新の定義を取得
2. ローカルのエージェント設定をリセット
3. 定義ファイルをもとに再生成

### Q3: 新規エージェントの追加方法がわからない

**対処法**:
1. `.claude/agents/templates/` をコピー
2. `.claude/agents/README.md` の手順に従う
3. PR作成時は `.github/PULL_REQUEST_TEMPLATE/agent_template.md` を使用

## 関連ドキュメント

- [.claude/agents/README.md](../ agents/README.md) - サブエージェント管理の詳細
- [commit-strategy.md](./commit-strategy.md) - コミット規約
- [docs/用語集.md](../../docs/用語集.md) - プロジェクト用語集
- [.github/CODEOWNERS](../../.github/CODEOWNERS) - レビュアー設定
- [.github/PULL_REQUEST_TEMPLATE/agent_template.md](../../.github/PULL_REQUEST_TEMPLATE/agent_template.md) - PRテンプレート

## 更新履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-01-03 | エージェント管理を`agents/`から`.claude/agents/`に移行 | @wadamasaya |
| 2026-01-01 | 初版作成 | @wadamasaya |
