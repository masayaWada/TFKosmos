# TFKosmos TODOリスト

---

## 優先度: 中

### エージェント検討
- [ ] 追加のエージェント検討
  - [ ] terraform-validator エージェント（Terraform検証専用）
  - [ ] test-runner エージェント（テスト実行・レポート生成）
  - [ ] doc-generator エージェント（ドキュメント自動生成）

- [ ] git-smart-commit の機能拡張
  - [ ] マージコミットのサポート
  - [ ] Breaking Changes の自動検出
  - [ ] 関連 Issue の自動リンク（Closes #123等）

---

## 優先度: 低

### 開発基盤強化
- [ ] サブエージェントの自動テストスクリプト作成
  - [ ] .claude/agents/git-smart-commit/test.sh
  - [ ] CI/CD パイプラインに統合

- [ ] エージェント定義のバージョン管理強化
  - [ ] セマンティックバージョニング導入
  - [ ] CHANGELOG.md の自動生成

---
