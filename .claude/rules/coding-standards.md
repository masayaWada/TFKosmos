---
description: Coding standards and naming conventions for Rust and TypeScript
---

# コーディング規約

## Rust 命名規則

適用対象: `backend/**/*.rs`

- **モジュール/ファイル**: `snake_case` (例: `connection_service.rs`)
- **構造体/列挙型/トレイト**: `PascalCase` (例: `IAMUser`, `ScanService`)
- **関数/メソッド**: `snake_case` (例: `scan_resources`, `get_user`)
- **定数**: `SCREAMING_SNAKE_CASE` (例: `MAX_RETRY_COUNT`)
- **変数**: `snake_case` (例: `user_name`, `resource_list`)

## TypeScript/JavaScript 命名規則

適用対象: `frontend/src/**/*.{ts,tsx}`

- **ファイル/ディレクトリ**: `PascalCase` (コンポーネント) または `camelCase` (ユーティリティ)
  - 例: `ConnectionPage.tsx`, `apiClient.ts`
- **React コンポーネント**: `PascalCase` (例: `ScanPage`, `ResourceList`)
- **関数**: `camelCase` (例: `fetchResources`, `handleClick`)
- **変数/定数**: `camelCase` (例: `userName`, `apiEndpoint`)
- **グローバル定数**: `SCREAMING_SNAKE_CASE` (例: `API_BASE_URL`)
- **インターフェース/型**: `PascalCase` (例: `User`, `ScanResponse`)

## コードフォーマット

一貫したコードスタイルを維持するため、フォーマッターを使用すること。

### Rust

```bash
cd backend
cargo fmt
```

### TypeScript/JavaScript

Prettierなどのフォーマッターが設定されている場合は使用すること。
