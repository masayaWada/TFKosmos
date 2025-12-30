# FAQ（よくある質問）

TFKosmosに関するよくある質問と回答をまとめています。

---

## 機能に関する質問

### Q: TFKosmosは何をするツールですか？

**A:** TFKosmosは、AWS/AzureのIAMリソース（ユーザー、グループ、ロール、ポリシー）をスキャンし、Terraformコードとインポートコマンドを自動生成するツールです。既存のクラウドインフラをInfrastructure as Codeに移行する際に役立ちます。

### Q: どのクラウドプロバイダーに対応していますか？

**A:** 現在はAWSとAzureに対応しています。GCPサポートは今後の拡張で予定しています（[今後の拡張](../06_ロードマップ/今後の拡張.md) 参照）。

### Q: スキャン対象のリソースは何ですか？

**A:**
- **AWS**: IAMユーザー、IAMグループ、IAMロール、IAMポリシー
- **Azure**: ユーザー、グループ、サービスプリンシパル、ロール割り当て

S3、EC2、Lambdaなどの他のリソースは今後の拡張で対応予定です。

### Q: 生成されたTerraformコードはどこに保存されますか？

**A:** `backend/terraform-output/{generation_id}/` ディレクトリに保存されます。各生成には一意のIDが割り当てられます。

### Q: スキャン結果は永続化されますか？

**A:** いいえ。スキャン結果はメモリに一時保存され、セッション終了時（サーバー再起動時）に破棄されます。必要なデータは生成されたTerraformコードとしてダウンロードしてください。

### Q: 複数のAWSアカウントを同時にスキャンできますか？

**A:** 現在は1回のスキャンで1アカウントのみ対応しています。複数アカウントをスキャンする場合は、AWSプロファイルを切り替えて順番にスキャンしてください。

---

## セットアップに関する質問

### Q: 開発環境に必要なものは何ですか？

**A:**
- Rust 1.70以上
- Node.js 18以上
- npm 9以上
- Git 2.0以上

詳細は [コントリビューションガイド](../03_開発ガイド/コントリビューションガイド.md) を参照してください。

### Q: `cargo`コマンドが見つからないと言われます

**A:** Rustのパスが設定されていません。以下を実行してください：

```bash
source ~/.cargo/env
```

Rustがインストールされていない場合は、先にインストールしてください：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Q: フロントエンドとバックエンドを同時に起動するには？

**A:** プロジェクトルートで以下を実行してください：

```bash
make dev
```

これにより、バックエンド（http://localhost:8000）とフロントエンド（http://localhost:5173）が同時に起動します。

### Q: ポート8000が既に使われていると言われます

**A:** 別のプロセスがポートを使用しています。以下で確認・解決できます：

```bash
# ポートを使用しているプロセスを確認
lsof -i :8000

# プロセスを終了
kill $(lsof -t -i:8000)

# または別のポートで起動
TFKOSMOS_PORT=3000 cargo run
```

---

## 認証に関する質問

### Q: AWS認証情報はどのように設定しますか？

**A:** 以下のいずれかの方法で設定します：

1. **AWS CLI（推奨）**:
   ```bash
   aws configure
   ```

2. **プロファイル指定**:
   ```bash
   aws configure --profile myprofile
   ```

3. **環境変数**（非推奨）:
   ```bash
   export AWS_ACCESS_KEY_ID=xxx
   export AWS_SECRET_ACCESS_KEY=xxx
   ```

### Q: Azure認証情報はどのように設定しますか？

**A:** 以下のいずれかの方法で設定します：

1. **Azure CLI（推奨）**:
   ```bash
   az login
   ```

2. **サービスプリンシパル**:
   ```bash
   export AZURE_TENANT_ID=xxx
   export AZURE_CLIENT_ID=xxx
   export AZURE_CLIENT_SECRET=xxx
   ```

### Q: 認証情報はアプリに保存されますか？

**A:** いいえ。認証情報は一切保存されません。スキャン時にシステムの認証情報（`~/.aws/credentials` や Azure CLI のセッション）を使用し、メモリ上でのみ処理されます。

### Q: IAMリソースのスキャンに必要な権限は何ですか？

**A:** AWS の場合、以下の権限が必要です：

- `iam:ListUsers`, `iam:ListGroups`, `iam:ListRoles`, `iam:ListPolicies`
- `iam:GetUser`, `iam:GetGroup`, `iam:GetRole`, `iam:GetPolicy`
- `iam:ListAttachedUserPolicies`, `iam:ListAttachedGroupPolicies`, `iam:ListAttachedRolePolicies`
- その他（詳細は [トラブルシューティング](./トラブルシューティング.md) 参照）

---

## テンプレートに関する質問

### Q: テンプレートをカスタマイズできますか？

**A:** はい。UIからテンプレートを編集・保存できます。カスタムテンプレートは `backend/templates_user/` に保存されます。

### Q: テンプレートをリセットするには？

**A:** `backend/templates_user/` ディレクトリを削除すると、次回生成時にデフォルトテンプレートが使用されます：

```bash
rm -rf backend/templates_user/
```

### Q: テンプレートの構文は何ですか？

**A:** Jinja2構文を使用しています。変数は `{{ variable }}` で参照し、制御構文は `{% if %}` / `{% for %}` などを使用します。

---

## Terraformコード生成に関する質問

### Q: 生成されたコードをそのまま使えますか？

**A:** 基本的にはそのまま使用可能ですが、本番環境での使用前に以下を確認してください：

1. リソース名の競合がないか
2. ポリシー内容が期待通りか
3. 依存関係が正しく解決されているか

### Q: インポートスクリプトの使い方は？

**A:** 生成された `import.sh`（または `import.ps1`）を実行して、既存リソースをTerraformのstateにインポートします：

```bash
cd terraform-output/{generation_id}/
chmod +x import.sh
./import.sh
```

### Q: 生成されたコードでエラーが出ます

**A:** まず `terraform validate` でコードを検証してください：

```bash
terraform init
terraform validate
```

テンプレートに問題がある場合は、カスタムテンプレートをリセットしてデフォルトに戻してみてください。

---

## Tauriアプリに関する質問

### Q: デスクトップアプリとして使えますか？

**A:** はい。Tauri を使用したデスクトップアプリとしてビルドできます：

```bash
cd deployment
npm run tauri:build
```

### Q: Tauriアプリでバックエンドが必要ですか？

**A:** はい。現在のアーキテクチャでは、Tauriアプリはフロントエンドのみを同梱しており、バックエンドは `localhost:8000` で別途起動する必要があります。

### Q: Tauriアプリが起動しません

**A:** 以下を確認してください：

1. バックエンドが起動しているか
2. ログを確認: `~/Library/Logs/TFKosmos/main.log`（macOS）
3. 開発モードで実行してエラーを確認:
   ```bash
   cd deployment
   npm run tauri:dev
   ```

---

## その他の質問

### Q: ログはどこで確認できますか？

**A:**
- **バックエンド**: ターミナルに出力されます
- **フロントエンド**: ブラウザの開発者ツール（Console）
- **Tauriアプリ**: `~/Library/Logs/TFKosmos/`（macOS）

### Q: バグを見つけたらどうすれば？

**A:** [GitHub Issues](https://github.com/masayaWada/TFKosmos/issues) で報告してください。以下の情報を含めると解決が早くなります：

- 再現手順
- 期待される動作と実際の動作
- エラーメッセージ（あれば）
- 環境情報（OS、ブラウザなど）

### Q: 機能リクエストはどこに送れば？

**A:** [GitHub Discussions](https://github.com/masayaWada/TFKosmos/discussions) または Issues で提案してください。

### Q: コントリビュートしたいのですが

**A:** [コントリビューションガイド](../03_開発ガイド/コントリビューションガイド.md) を参照してください。特に以下の領域でコントリビューションを歓迎しています：

- GCPサポートの追加
- 追加AWSリソース（S3、EC2等）のサポート
- テストカバレッジの向上
- ドキュメントの翻訳

---
