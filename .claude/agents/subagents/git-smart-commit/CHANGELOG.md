# Changelog

All notable changes to the git-smart-commit agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-03

### Added
- マージコミットのサポート: `MERGE_HEAD` を自動検出し、マージ専用のメッセージ形式を生成
- Breaking Changes の自動検出: API変更やシグネチャ変更を検出し、`BREAKING CHANGE:` フッターを自動追加
- 関連 Issue の自動リンク: ブランチ名から Issue 番号を抽出し、`Closes #123`, `Fixes #456` などを自動追加

### Changed
- コミットメッセージ生成フローを拡張し、より多くの情報を自動収集

### Fixed
- なし

## [1.0.0] - 2026-01-03

### Added
- Git変更内容の自動分析（status, diff, log）
- type/scope の自動判定
- Conventional Commits形式のメッセージ生成
- 機密情報ファイルの検出と警告
- ユーザー確認プロセスの徹底
- プロジェクトコミット規約の遵守

### Security
- 危険なGitコマンド（`git push --force`, `git reset --hard` など）の禁止
- 機密情報ファイル（`.env`, `credentials` など）のコミット検出

[1.1.0]: https://github.com/wadamasaya/TFKosmos/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wadamasaya/TFKosmos/releases/tag/v1.0.0
