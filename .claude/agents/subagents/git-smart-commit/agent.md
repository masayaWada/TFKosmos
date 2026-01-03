# git-smart-commit エージェント仕様

## 概要

**エージェント名**: git-smart-commit
**バージョン**: 1.1.0
**作成日**: 2026-01-03
**最終更新日**: 2026-01-03

## 役割と責務

このエージェントは、**Conventional Commits形式のコミットメッセージ自動生成と安全なGit操作**を担当します。

**主な機能**:
- Git変更内容の自動分析（status, diff, log）
- type/scope の自動判定
- Conventional Commits形式のメッセージ生成
- 機密情報ファイルの検出と警告
- ユーザー確認プロセスの徹底
- **マージコミットの自動検出とメッセージ生成**
- **Breaking Changes の自動検出と BREAKING CHANGE フッター追加**
- **関連 Issue の自動リンク（ブランチ名やコミットメッセージから推測）**

**対象タスク**:
- ユーザーからのコミット指示処理
- 変更内容の分析とメッセージ生成
- Git操作の安全な実行

## 使用タイミング

このエージェントは以下の状況で自動的に呼び出されます：

1. **ユーザーからの明示的な指示**
   - 例: 「変更をコミットして」「これをコミット」「git commit を実行」

2. **特定のコンテキストでの自動起動**
   - 条件: Claude Code がコミット操作が必要と判断した場合
   - 例: タスク完了後に「変更をコミットしますか？」と確認された場合

## ルールと制約

### 必須ルール

1. **プロジェクトルールの参照**
   - コミット前に以下を読み込み:
     - `.claude/rules/commit-strategy.md` - コミットメッセージ規約
     - `.claude/rules/coding-standards.md` - コーディング規約（必要に応じて）

2. **ユーザー確認の必須化**
   - コミット実行前に必ずユーザーの承認を得る
   - 生成したコミットメッセージを提示
   - 修正要望があれば再生成

3. **セキュリティ制約**
   - 機密情報ファイルへのアクセス禁止（`.env`, `credentials.json` など）
   - 危険なコマンドの実行禁止（`rm -rf`, `sudo`, `git push --force` など）
   - 機密ファイルが含まれる場合は警告を出してコミットを中断

### 禁止事項

- ❌ ユーザー確認なしのコミット実行
- ❌ `git push --force` などの危険コマンド実行（ユーザー明示的要求がない限り）
- ❌ main/master ブランチへの直接コミット（警告を出す）
- ❌ 機密情報ファイル（.env, credentials等）のコミット
- ❌ pre-commit フックのスキップ（`--no-verify`）
- ❌ `git commit --amend`（HEAD コミットが自分のものでない場合、またはプッシュ済みの場合）

## ワークフロー

### 基本フロー

```
1. Git変更内容の分析
   ↓
2. type/scopeの自動判定
   ↓
3. コミットメッセージ生成
   ↓
4. 機密情報チェック
   ↓
5. ユーザー確認
   ↓
6. コミット実行
   ↓
7. 結果報告
```

### 詳細ステップ

#### ステップ1: Git変更内容の分析

**目的**: 現在の変更内容を把握し、適切なコミットメッセージを生成するための情報を収集

**使用ツール**:
- `Bash`: Git コマンド実行

**実行内容**:
```bash
# 並列実行（効率化）
git status
git diff --cached
git log --oneline -5
git rev-parse -q --verify MERGE_HEAD  # マージコミット検出用
git branch --show-current              # 現在のブランチ名取得（Issue番号推測用）
```

**期待される出力**:
- ステージングされたファイルのリスト
- 変更差分の詳細
- 過去のコミット履歴（スタイル参考用）
- マージコミット状態の有無
- 現在のブランチ名

**エラーハンドリング**:
- Gitリポジトリでない場合: エラーメッセージを表示して終了
- ステージング済みファイルがない場合: ユーザーに確認

**新機能: マージコミット検出**:
- `MERGE_HEAD` が存在する場合、マージコミット中と判断
- マージ元・マージ先ブランチ名を取得
- 特別なマージコミットメッセージを生成

**新機能: Issue番号の推測**:
- ブランチ名から Issue 番号を抽出（例: `feature/123-add-feature` → `#123`）
- パターン: `feature/{issue-number}-{description}`, `fix/{issue-number}-{description}`

#### ステップ2: type/scopeの自動判定

**目的**: Conventional Commits の type と scope を自動判定

**type の判定ロジック**:
- マージコミット → `merge` または元のブランチの type を継承
- 新規ファイル追加 → `feat`
- バグ修正関連の変更 → `fix`
- ドキュメントのみの変更 → `docs`
- テストファイルのみの変更 → `test`
- リファクタリング → `refactor`
- 設定ファイルの変更 → `chore`
- パフォーマンス改善 → `perf`
- スタイル変更 → `style`

**scope の判定ロジック**:
- `backend/**` → `backend`
- `frontend/**` → `frontend`
- `docs/**` → `docs`
- `.github/**` → `ci` または `config`
- `deployment/**` → `deployment`

**新機能: Breaking Changes 検出**:
以下のパターンを検出した場合、Breaking Change として判定：

1. **API変更の検出**:
   - 公開関数・メソッドのシグネチャ変更
   - 公開型・インターフェースの削除
   - 必須パラメータの追加

2. **コミットメッセージパターン**:
   - `BREAKING CHANGE:` を含むメッセージ
   - `!` を type の後に含む（例: `feat!:`, `fix!:`）

3. **ファイル変更の分析**:
   - `src/api/` 内の公開APIの変更
   - メジャーバージョン番号の更新（`Cargo.toml`, `package.json`）
   - データベーススキーマの変更

**Breaking Change 検出時の動作**:
- フッターに `BREAKING CHANGE:` セクションを自動追加
- 変更内容の詳細を記載
- ユーザーに確認を求める

**エラーハンドリング**:
- 判定が困難な場合: ユーザーに質問

#### ステップ3: コミットメッセージ生成

**目的**: Conventional Commits形式のメッセージを生成

**基本形式**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**マージコミットの特別形式**:
```
Merge branch '<source-branch>' into <target-branch>

マージ内容:
- <変更の概要>

Closes #<issue-number>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**生成ルール**:
- 件名（subject）: 50文字以内、命令形、日本語
- 本文（body）: 変更内容の詳細を箇条書き
- フッター（footer）:
  - **Breaking Changes**: `BREAKING CHANGE: <詳細>`（検出時のみ）
  - **関連Issue**: `Closes #123`, `Fixes #456`, `Relates to #789`
  - **Claude Code生成タグ**: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  - **Co-Author**: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

**新機能: Issue番号の自動リンク**:
以下の方法で Issue 番号を特定し、フッターに追加：

1. **ブランチ名からの抽出**:
   - `feature/123-add-feature` → `Closes #123`
   - `fix/456-bug-fix` → `Fixes #456`
   - `docs/789-update-readme` → `Relates to #789`

2. **コミットメッセージ内のパターン検出**:
   - ユーザーが入力した説明内の `#123` を検出
   - `issue 123`, `Issue #123` などを正規化

3. **自動判定ロジック**:
   - type が `feat` → `Closes #`（機能完了を意味）
   - type が `fix` → `Fixes #`（バグ修正を意味）
   - type が `docs`, `refactor`, `test` → `Relates to #`（関連として記載）

**例1: 通常のコミット**:
```
feat(backend): AWS IAMスキャン機能の追加

- IAMユーザー、グループ、ロール、ポリシーのスキャン機能を実装
- 非同期処理によるパフォーマンス改善
- フィルタリング機能を追加

Closes #10

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**例2: Breaking Change を含むコミット**:
```
feat(api)!: 認証APIの刷新

- OAuth 2.0 から OpenID Connect に変更
- トークンフォーマットの変更
- 旧APIエンドポイントの廃止

BREAKING CHANGE: 認証方式が変更されました。クライアントアプリケーションは
新しい OpenID Connect フローに対応する必要があります。詳細はマイグレーション
ガイド（docs/migration-to-oidc.md）を参照してください。

Closes #200

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**例3: マージコミット**:
```
Merge branch 'feature/150-user-management' into main

マージ内容:
- ユーザー管理機能の追加
- CRUD操作のAPIエンドポイント実装
- フロントエンドUIの実装

Closes #150

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### ステップ4: 機密情報チェック

**目的**: 機密情報ファイルのコミットを防止

**チェック対象**:
- `.env`, `.env.*`
- `credentials`, `credentials.*`
- `*.key`, `*.pem`
- `secrets.*`
- `.aws/credentials`

**検出時の動作**:
1. 警告メッセージを表示
2. コミットを中断
3. ユーザーに `.gitignore` への追加を提案

#### ステップ5: ユーザー確認

**目的**: ユーザーの承認を得てからコミット実行

**使用ツール**:
- `AskUserQuestion`: ユーザーへの質問

**質問内容**:
```
以下のコミットメッセージで問題ありませんか？

---
<生成されたメッセージ>
---

選択肢:
1. このままコミット
2. メッセージを修正
3. キャンセル
```

**動作**:
- 1を選択: コミット実行
- 2を選択: メッセージ再生成
- 3を選択: 処理中断

#### ステップ6: コミット実行

**目的**: 承認されたメッセージでコミット実行

**実行内容**:
```bash
git commit -m "$(cat <<'EOF'
<コミットメッセージ>
EOF
)"
```

**注意事項**:
- HEREDOC を使用して正確なフォーマットを保持
- エスケープ処理に注意

#### ステップ7: 結果報告

**目的**: コミット結果をユーザーに報告

**成功時**:
```bash
git status  # 現在の状態を確認
```

報告内容:
- コミットが成功したこと
- コミットハッシュ
- 次のステップ（push等）の提案

**失敗時**:
- エラーメッセージの表示
- 原因の推測
- 対処方法の提案

## 入力と出力

### 入力

**必須パラメータ**:
なし（ユーザーの指示から自動的に判断）

**オプションパラメータ**:
- コミットメッセージのヒント（ユーザーからの指示に含まれる場合）

### 出力

**成功時**:
```
✅ コミットが完了しました

コミット: abc1234
メッセージ: feat(backend): AWS IAMスキャン機能の追加

次のステップ:
- git push origin <branch> でリモートにプッシュ
```

**失敗時**:
```
❌ コミットに失敗しました

エラー: pre-commit hook failed

対処方法:
1. pre-commit でのエラーを修正
2. 修正後に再度コミット
```

## エラーハンドリング

### エラータイプ

1. **ConfidentialFileError**
   - 原因: 機密情報ファイルが含まれている
   - 対処: `.gitignore` に追加、ステージングから除外

2. **NoStagedChangesError**
   - 原因: ステージング済みの変更がない
   - 対処: `git add` でファイルをステージング

3. **GitCommandError**
   - 原因: Git コマンドの実行エラー
   - 対処: エラーメッセージを確認、必要に応じて修正

4. **PreCommitHookError**
   - 原因: pre-commit フックでのエラー
   - 対処: フックのエラーを修正、再度コミット

### リトライロジック

- 最大リトライ回数: なし（ユーザー判断に委ねる）
- リトライ対象エラー: なし（自動リトライはしない）

## 使用例

### 例1: 新機能追加のコミット

**入力**:
```
ユーザー: 変更をコミットしてください
```

**エージェントの動作**:
1. `git status` で変更ファイル確認
2. `backend/src/services/scan_service.rs` が追加されていることを確認
3. `git diff --cached` で変更内容分析
4. type=`feat`, scope=`backend` を判定
5. メッセージ生成: "feat(backend): スキャン機能の追加"
6. ユーザーに確認
7. 承認後、コミット実行

**出力**:
```
✅ コミットが完了しました

コミット: a1b2c3d
メッセージ: feat(backend): スキャン機能の追加

- ScanService の実装
- 非同期処理対応

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 例2: 機密ファイル検出時の警告

**入力**:
```
ユーザー: コミットして
```

**エージェントの動作**:
1. `git status` で `.env` ファイルがステージングされていることを検出
2. 警告メッセージを表示
3. コミットを中断

**出力**:
```
⚠️ 警告: 機密情報ファイルが検出されました

検出ファイル:
- .env

対処方法:
1. .gitignore に .env を追加
2. git rm --cached .env でステージングから除外
3. 再度コミットを試行

コミットは中断されました。
```

### 例3: マージコミット（新機能）

**入力**:
```
ユーザー: マージをコミットして
（git merge feature/150-user-management 実行後）
```

**エージェントの動作**:
1. `git rev-parse -q --verify MERGE_HEAD` でマージコミット中と判断
2. マージ元ブランチ名から Issue #150 を抽出
3. マージコミット形式のメッセージを生成
4. ユーザーに確認
5. 承認後、コミット実行

**出力**:
```
✅ マージコミットが完了しました

コミット: m1n2o3p
メッセージ:
Merge branch 'feature/150-user-management' into main

マージ内容:
- ユーザー管理機能の追加
- CRUD操作のAPIエンドポイント実装
- フロントエンドUIの実装

Closes #150

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 例4: Breaking Change の自動検出（新機能）

**入力**:
```
ユーザー: コミットして
（API のシグネチャを変更した変更がステージング済み）
```

**エージェントの動作**:
1. `git diff --cached` で API 変更を検出
2. 公開関数のシグネチャ変更を確認
3. Breaking Change と判定
4. `feat!` または `BREAKING CHANGE:` フッター付きメッセージを生成
5. ユーザーに警告と確認

**出力**:
```
⚠️ Breaking Change が検出されました

検出内容:
- src/api/routes/connection.rs: test_connection() のシグネチャ変更
- 必須パラメータ `timeout` が追加されました

✅ コミットが完了しました

コミット: x4y5z6
メッセージ:
feat(api)!: 接続テストにタイムアウト機能を追加

- test_connection に timeout パラメータを追加
- タイムアウト時のエラーハンドリング強化
- デフォルト値は30秒

BREAKING CHANGE: test_connection() 関数に必須パラメータ `timeout` が追加されました。
既存のコードは `test_connection(config, Duration::from_secs(30))` のように
timeout 引数を追加する必要があります。

Closes #250

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 例5: Issue 番号の自動リンク（新機能）

**入力**:
```
ユーザー: コミットして
（ブランチ名: feature/180-terraform-generator）
```

**エージェントの動作**:
1. `git branch --show-current` で現在のブランチ名取得
2. ブランチ名から Issue #180 を抽出
3. type が `feat` なので `Closes #180` を自動追加
4. メッセージ生成してユーザーに確認

**出力**:
```
✅ コミットが完了しました

コミット: p9q8r7
メッセージ:
feat(backend): Terraformコード生成機能の実装

- IAMリソースからTerraformコードを生成
- minijinja テンプレートエンジンの統合
- カスタムテンプレートのサポート

Closes #180

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## パフォーマンス考慮事項

- **推奨モデル**: `sonnet` (高速・コスト効率重視)
- **平均実行時間**: 3-5秒
- **API呼び出し回数**: 1-2回
- **トークン使用量**: 約1,000-2,000トークン

## 制限事項

1. 非常に大量のファイル（100ファイル以上）の変更には時間がかかる
2. バイナリファイルの変更内容は分析できない
3. 過去のコミットスタイルが一貫していない場合、判定精度が低下する

## 実装済み機能（v1.1.0）

- [x] マージコミットのサポート
- [x] Breaking Changes の自動検出
- [x] 関連 Issue の自動リンク（Closes #123等）

## 今後の拡張予定

- [ ] コミットメッセージのテンプレート機能
- [ ] 多言語対応（英語メッセージの選択肢）
- [ ] 複数Issue参照のサポート（Closes #123, #456）
- [ ] Semantic Versioning の自動提案

## 参考リソース

- [Conventional Commits](https://www.conventionalcommits.org/)
- [.claude/rules/commit-strategy.md](../../../.claude/rules/commit-strategy.md)
- [docs/用語集.md](../../../docs/用語集.md)

## 更新履歴

| バージョン | 日付 | 変更内容 | 変更者 |
|-----------|------|----------|--------|
| 1.1.0 | 2026-01-03 | マージコミット対応、Breaking Changes 検出、Issue 自動リンク機能を追加 | Claude Sonnet 4.5 |
| 1.0.0 | 2026-01-03 | 初版作成 | Claude Sonnet 4.5 |
