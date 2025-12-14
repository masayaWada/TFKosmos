# 3. API設計

### 3.1 接続管理 API

#### POST /api/connection/aws/test

接続テスト（AWS）

**Request:**

```json
{
  "profile": "default",
  "assume_role_arn": "arn:aws:iam::123456789012:role/AdminRole",
  "assume_role_session_name": "tfkosmos"
}
```

**Response:**

```json
{
  "success": true,
  "account_id": "123456789012",
  "user_arn": "arn:aws:iam::123456789012:user/testuser"
}
```

#### POST /api/connection/azure/test

接続テスト（Azure）

**Request:**

```json
{
  "auth_method": "az_login",
  "subscription_id": "sub-123",
  "tenant_id": "tenant-123"
}
```

**Response:**

```json
{
  "success": true,
  "subscription_name": "My Subscription",
  "tenant_id": "tenant-123"
}
```

### 3.2 スキャン API

#### POST /api/scan/aws

AWS IAMスキャン実行

**Request:**

```json
{
  "config": {
    "profile": "default",
    "scan_targets": {
      "users": true,
      "groups": true,
      "roles": false,
      "policies": true,
      "attachments": true,
      "cleanup": false
    },
    "filters": {
      "name_prefix": "prod-",
      "tags": "Environment=Production"
    }
  }
}
```

**Response:**

```json
{
  "scan_id": "scan-abc123",
  "status": "completed",
  "summary": {
    "users": 10,
    "groups": 5,
    "policies": 3,
    "attachments": 15
  },
  "resources": {
    "users": [...],
    "groups": [...],
    "policies": [...],
    "attachments": [...]
  }
}
```

#### POST /api/scan/azure

Azure IAMスキャン実行

**Request:**

```json
{
  "config": {
    "subscription_id": "sub-123",
    "scope_type": "subscription",
    "scope_value": "sub-123",
    "scan_targets": {
      "role_definitions": true,
      "role_assignments": true
    }
  }
}
```

**Response:**

```json
{
  "scan_id": "scan-xyz789",
  "status": "completed",
  "summary": {
    "role_definitions": 5,
    "role_assignments": 20
  },
  "resources": {
    "role_definitions": [...],
    "role_assignments": [...]
  }
}
```

#### GET /api/scan/{scan_id}/status

スキャン状態取得

**Response:**

```json
{
  "scan_id": "scan-abc123",
  "status": "in_progress",
  "progress": 65,
  "message": "Scanning IAM users..."
}
```

### 3.3 リソース管理 API

#### GET /api/resources/{scan_id}

スキャン結果のリソース一覧取得

**Query Parameters:**

- `type`: リソースタイプ（users, groups, roles, policies, attachments, cleanup）
- `page`: ページ番号
- `page_size`: ページサイズ
- `filter`: フィルタ条件（JSON文字列）

**Response:**

```json
{
  "resources": [...],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 100,
    "total_pages": 2
  }
}
```

#### POST /api/resources/{scan_id}/select

リソース選択状態の更新

**Request:**

```json
{
  "selections": {
    "users": ["user1", "user2"],
    "groups": ["group1"],
    "policies": ["policy-arn-1"]
  }
}
```

**Response:**

```json
{
  "success": true,
  "selected_count": 3
}
```

### 3.4 生成 API

#### POST /api/generate/terraform

Terraformコード生成

**Request:**

```json
{
  "scan_id": "scan-abc123",
  "config": {
    "output_path": "/tmp/terraform-output",
    "file_split_rule": "by_resource_type",
    "naming_convention": "snake_case",
    "import_script_format": "sh",
    "generate_readme": true
  },
  "selected_resources": {
    "users": ["user1", "user2"],
    "groups": ["group1"]
  }
}
```

**Response:**

```json
{
  "generation_id": "gen-xyz789",
  "output_path": "/tmp/terraform-output",
  "files": [
    "terraform/aws/iam_user.tf",
    "terraform/aws/iam_group.tf",
    "import.sh",
    "README.md"
  ],
  "preview": {
    "iam_user.tf": "resource \"aws_iam_user\" \"user1\" {...}",
    "iam_group.tf": "resource \"aws_iam_group\" \"group1\" {...}"
  }
}
```

#### GET /api/generate/{generation_id}/download

生成ファイルのZIPダウンロード

**Response:**

- Content-Type: application/zip
- Content-Disposition: attachment; filename="terraform-output.zip"

### 3.5 テンプレート管理 API

#### GET /api/templates

テンプレート一覧取得

**Response:**

```json
{
  "templates": [
    {
      "resource_type": "aws_iam_user",
      "template_path": "terraform/aws/iam_user.tf.j2",
      "has_user_override": false,
      "default_source": "...",
      "user_source": null
    },
    ...
  ]
}
```

#### GET /api/templates/{resource_type}

テンプレート内容取得

**Query Parameters:**

- `source`: "default" or "user" (default: "user" if exists, else "default")

**Response:**

```json
{
  "resource_type": "aws_iam_user",
  "source": "default",
  "content": "resource \"aws_iam_user\" \"{{ resource_name }}\" {...}"
}
```

#### PUT /api/templates/{resource_type}

ユーザーテンプレート保存

**Request:**

```json
{
  "content": "resource \"aws_iam_user\" \"{{ resource_name }}\" {...}"
}
```

**Response:**

```json
{
  "success": true,
  "resource_type": "aws_iam_user",
  "saved_path": "templates_user/terraform/aws/iam_user.tf.j2"
}
```

#### DELETE /api/templates/{resource_type}

ユーザーテンプレート削除（デフォルトに復元）

**Response:**

```json
{
  "success": true,
  "resource_type": "aws_iam_user"
}
```

---

