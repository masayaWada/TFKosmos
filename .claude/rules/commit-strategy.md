# コミット戦略

適用対象: すべてのGitコミット操作

## コミットメッセージの形式

本プロジェクトでは、[Conventional Commits](https://www.conventionalcommits.org/) の規約に準拠したコミットメッセージを使用すること。

### 基本形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### コミットタイプ（type）

コミットメッセージの先頭に、以下のいずれかのタイプを必ず指定すること。

- **feat**: 新機能の追加
- **fix**: バグ修正
- **docs**: ドキュメントのみの変更
- **style**: コードの動作に影響しない変更（フォーマット、セミコロンの欠落など）
- **refactor**: バグ修正や機能追加を伴わないコードのリファクタリング
- **perf**: パフォーマンス改善
- **test**: テストの追加・修正
- **chore**: ビルドプロセスやツールの変更（依存関係の更新など）
- **ci**: CI設定の変更
- **build**: ビルドシステムや外部依存関係の変更
- **security**: セキュリティ関連の変更

### スコープ（scope）

オプション。変更が影響する範囲を指定します。

- `backend`: バックエンド（Rust）の変更
- `frontend`: フロントエンド（React）の変更
- `api`: API設計の変更
- `ui`: UI/UXの変更
- `docs`: ドキュメントの変更
- `config`: 設定ファイルの変更
- `deployment`: デプロイメント（Tauri）の変更
- `infra`: インフラストラクチャ層の変更
- `services`: サービス層の変更
- `models`: ドメインモデルの変更

### 件名（subject）

- 50文字以内で簡潔に記述
- 命令形で記述（例: "追加する" ではなく "追加"）
- 文末にピリオドを付けない
- 日本語で記述

### 本文（body）

- オプション。変更の理由や背景を説明
- 箇条書きで記述可能（推奨）
- 具体的な実装内容を列挙

### フッター（footer）

- オプション。関連するイシューや破壊的変更を記載
- `Closes #123` や `BREAKING CHANGE:` など
- Claude Code による生成の場合、以下を自動追加:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

## コミットメッセージの例

### 新機能の追加

```
feat(backend): AWS IAMスキャン機能の追加

- IAMユーザー、グループ、ロール、ポリシーのスキャン機能を実装
- 非同期処理によるパフォーマンス改善
- フィルタリング機能を追加

Closes #10

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### バグ修正

```
fix(frontend): UTF-8文字列のバイト位置スライスによるパニックを修正

文字列のスライス時に文字境界を考慮せずにバイト位置で
スライスしていたため、マルチバイト文字を含む場合に
パニックが発生する問題を修正。

Fixes #25

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### リファクタリング

```
refactor(backend): scan_with_progressをscanにリネーム

未使用のコードを削除し、メソッド名をより簡潔に変更。
機能的な変更はなし。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### ドキュメントの更新

```
docs: コミット戦略ドキュメントの追加

コミットメッセージ、イシュー、PRのテンプレートを追加。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### プロジェクト設定の変更

```
chore: プロジェクト名をTFKosmosに変更

- パッケージ名の更新（backend: tfkosmos, frontend: tfkosmos-ui）
- UIタイトルとナビゲーションラベルの更新
- APIレスポンスメッセージの更新
- ドキュメントの更新

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## コミット実行時のルール

### 必須チェック項目

コミット実行前に以下を必ず確認すること：

1. **変更内容の分析**
   ```bash
   git status              # ステージされたファイルを確認
   git diff --cached       # 変更差分を確認
   git log --oneline -5    # 最近のコミット履歴を参照
   ```

2. **type と scope の判定**
   - 変更されたファイルパスから適切な scope を判断
   - 変更内容（新機能/修正/リファクタリング等）から type を判断

3. **機密情報の検出**
   - `.env`, `.env.*` ファイルが含まれていないか確認
   - `credentials`, `secrets` 等のファイルが含まれていないか確認
   - 検出した場合は警告し、コミットを中断

4. **ユーザー確認**
   - 生成したコミットメッセージをユーザーに提示
   - 承認を得てからコミットを実行
   - 修正要望があれば、メッセージを調整

### 禁止事項

- `git commit --amend` の無許可使用（HEAD コミットが自分のものでない場合）
- `git push --force` の使用（ユーザーが明示的に要求しない限り）
- main/master ブランチへの直接コミット（警告を出す）
- 機密情報ファイルのコミット
- pre-commit フックのスキップ（`--no-verify` の使用）

## コミットのベストプラクティス

1. **1つのコミットに1つの変更**: 関連する変更は1つのコミットにまとめ、無関係な変更は分離する
2. **コミット前にテスト**: コミット前にローカルでビルド・テストを実行し、問題がないことを確認する
3. **意味のあるコミット**: コミットメッセージから変更内容が理解できるようにする
4. **定期的なコミット**: 小さな変更でも定期的にコミットし、作業履歴を残す
5. **レビューしやすいコミット**: PRでレビューしやすいように、論理的な単位でコミットを分割する

## ブランチ戦略

- **main**: 本番環境用のブランチ。常に安定した状態を保つ
- **develop**: 開発用のブランチ。機能追加やバグ修正を統合（現在未使用）
- **feature/**: 新機能開発用ブランチ（例: `feature/add-gcp-support`）
- **fix/**: バグ修正用ブランチ（例: `fix/utf8-slice-panic`）
- **docs/**: ドキュメント更新用ブランチ（例: `docs/add-commit-strategy`）
- **refactor/**: リファクタリング用ブランチ（例: `refactor/scan-service`）
- **agents/**: サブエージェント追加・更新用ブランチ（例: `agents/feature/git-smart-commit`）

## コミットメッセージの雛形

### 新機能追加時

```
feat(<scope>): <機能名>の追加

- <実装内容1>
- <実装内容2>
- <実装内容3>

Closes #<issue番号>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### バグ修正時

```
fix(<scope>): <問題の概要>を修正

<問題の詳細説明>

Fixes #<issue番号>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### リファクタリング時

```
refactor(<scope>): <変更内容>のリファクタリング

<変更理由や背景>

関連: #<issue番号>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### ドキュメント更新時

```
docs: <更新内容>のドキュメント追加/更新

<更新内容の詳細>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 設定変更時

```
chore(<scope>): <変更内容>の設定変更

<変更内容の詳細>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## 関連ファイル

- `.github/pull_request_template.md` - PRテンプレート
- `.github/PULL_REQUEST_TEMPLATE/agent_template.md` - エージェント追加時のPRテンプレート
- `agents/subagents/git-smart-commit/` - コミット専用サブエージェント定義
