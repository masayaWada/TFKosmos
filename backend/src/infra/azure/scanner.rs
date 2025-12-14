use anyhow::{Context, Result};
use azure_core::credentials::TokenCredential;
use azure_identity::AzureCliCredential;
use futures::future::join_all;
use reqwest::Client as HttpClient;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Semaphore;

use crate::models::ScanConfig;

pub struct AzureIamScanner {
    config: ScanConfig,
}

impl AzureIamScanner {
    pub async fn new(config: ScanConfig) -> Result<Self> {
        Ok(Self { config })
    }

    /// Azure CLIコマンドを実行してJSONを取得
    async fn execute_az_command(args: &[&str]) -> Result<Value> {
        let output = Command::new("az")
            .args(args)
            .output()
            .await
            .context("Azure CLIがインストールされていないか、PATHに含まれていません")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Azure CLIコマンドが失敗しました: {}", stderr);
        }

        let stdout = String::from_utf8(output.stdout)
            .context("Azure CLIの出力をUTF-8として解析できませんでした")?;

        let json: Value = serde_json::from_str(&stdout)
            .context("Azure CLIの出力をJSONとして解析できませんでした")?;

        Ok(json)
    }

    /// スコープに基づいてAzure CLIコマンドの引数を構築
    fn get_scope_args(&self) -> Vec<String> {
        let mut args = Vec::new();

        if let Some(scope_type) = &self.config.scope_type {
            match scope_type.as_str() {
                "subscription" => {
                    if let Some(subscription_id) = &self.config.subscription_id {
                        args.push("--subscription".to_string());
                        args.push(subscription_id.clone());
                    }
                }
                "resource_group" => {
                    if let Some(scope_value) = &self.config.scope_value {
                        // For role commands, use --scope instead of --resource-group
                        args.push("--scope".to_string());
                        if let Some(subscription_id) = &self.config.subscription_id {
                            args.push(format!(
                                "/subscriptions/{}/resourceGroups/{}",
                                subscription_id, scope_value
                            ));
                        } else {
                            args.push(format!("/resourceGroups/{}", scope_value));
                        }
                    }
                }
                "management_group" => {
                    if let Some(scope_value) = &self.config.scope_value {
                        args.push("--scope".to_string());
                        args.push(format!(
                            "/providers/Microsoft.Management/managementGroups/{}",
                            scope_value
                        ));
                    }
                }
                _ => {
                    // Default: use subscription if available
                    if let Some(subscription_id) = &self.config.subscription_id {
                        args.push("--subscription".to_string());
                        args.push(subscription_id.clone());
                    }
                }
            }
        } else {
            // No scope type specified, use subscription if available
            if let Some(subscription_id) = &self.config.subscription_id {
                args.push("--subscription".to_string());
                args.push(subscription_id.clone());
            }
        }

        args
    }

    /// Role Definitionsを取得
    async fn scan_role_definitions(&self) -> Result<Vec<Value>> {
        let scan_targets = &self.config.scan_targets;

        if !scan_targets
            .get("role_definitions")
            .copied()
            .unwrap_or(false)
        {
            return Ok(Vec::new());
        }

        let start_time = std::time::Instant::now();
        println!("[SCAN] Role Definitionsスキャンを開始");

        let mut args: Vec<String> = vec![
            "role".to_string(),
            "definition".to_string(),
            "list".to_string(),
            "--output".to_string(),
            "json".to_string(),
        ];
        let scope_args = self.get_scope_args();

        // スコープ引数を追加
        args.extend(scope_args);

        // &strのスライスに変換
        let full_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let az_start = std::time::Instant::now();
        println!("[SCAN] Azure CLIコマンド実行開始: az role definition list");
        let json = Self::execute_az_command(&full_args).await?;
        println!(
            "[SCAN] Azure CLIコマンド完了: {}ms",
            az_start.elapsed().as_millis()
        );

        // まず、すべてのrole definitionを収集
        let filter_start = std::time::Instant::now();
        let role_definitions_vec: Vec<Value> = json
            .as_array()
            .context("Role Definitions一覧が配列形式ではありません")?
            .iter()
            .filter_map(|rd| {
                // 名前プレフィックスフィルタを適用
                if let Some(name_prefix) = self.config.filters.get("name_prefix") {
                    if let Some(name) = rd
                        .get("name")
                        .or_else(|| rd.get("roleName"))
                        .and_then(|v| v.as_str())
                    {
                        if !name.starts_with(name_prefix) {
                            return None;
                        }
                    }
                }
                Some(rd.clone())
            })
            .collect();
        println!(
            "[SCAN] フィルタリング完了: {}件, {}ms",
            role_definitions_vec.len(),
            filter_start.elapsed().as_millis()
        );

        // ユニークなrole definition IDを収集して並列で表示名を取得
        let unique_start = std::time::Instant::now();
        let mut role_def_id_to_name: HashMap<String, Option<String>> = HashMap::new();
        let mut unique_role_def_ids: Vec<String> = Vec::new();

        for rd in &role_definitions_vec {
            if let Some(role_def_id) = rd.get("id").and_then(|v| v.as_str()) {
                if !role_def_id_to_name.contains_key(role_def_id) {
                    unique_role_def_ids.push(role_def_id.to_string());
                    role_def_id_to_name.insert(role_def_id.to_string(), None);
                }
            }
        }
        println!(
            "[SCAN] ユニークなRole Definition ID収集完了: {}件, {}ms",
            unique_role_def_ids.len(),
            unique_start.elapsed().as_millis()
        );

        // 並列で表示名を取得（同時実行数を制限）
        let api_start = std::time::Instant::now();
        println!(
            "[SCAN] Role Definition表示名の並列取得開始: {}件",
            unique_role_def_ids.len()
        );

        // トークンを事前に取得してキャッシュ
        let token_start = std::time::Instant::now();
        let scope = "https://management.azure.com/.default";
        let token = match Self::get_auth_token(scope).await {
            Some(token) => {
                println!(
                    "[SCAN] トークン取得完了: {}ms",
                    token_start.elapsed().as_millis()
                );
                token
            }
            None => {
                println!("[SCAN] トークン取得失敗、フォールバック処理に移行");
                // トークン取得失敗時はフォールバック
                let mut role_definitions = Vec::new();
                for rd in role_definitions_vec {
                    let mut transformed = serde_json::Map::new();
                    if let Some(id) = rd.get("id") {
                        transformed.insert("role_definition_id".to_string(), id.clone());
                    }
                    if let Some(name) = rd.get("name").or_else(|| rd.get("roleName")) {
                        transformed.insert("role_name".to_string(), name.clone());
                    }
                    if let Some(desc) = rd.get("description") {
                        transformed.insert("description".to_string(), desc.clone());
                    }
                    if let Some(role_type) = rd.get("type") {
                        transformed.insert("role_type".to_string(), role_type.clone());
                    }
                    if let Some(id) = rd.get("id") {
                        if let Some(id_str) = id.as_str() {
                            if let Some(scope_end) =
                                id_str.rfind("/providers/Microsoft.Authorization/roleDefinitions")
                            {
                                let scope = &id_str[..scope_end];
                                transformed
                                    .insert("scope".to_string(), Value::String(scope.to_string()));
                            }
                        }
                    }
                    for (key, value) in rd.as_object().unwrap_or(&serde_json::Map::new()) {
                        if !transformed.contains_key(key) {
                            transformed.insert(key.clone(), value.clone());
                        }
                    }
                    role_definitions.push(Value::Object(transformed));
                }
                println!(
                    "[SCAN] Role Definitionsスキャン完了: {}件, 合計{}ms",
                    role_definitions.len(),
                    start_time.elapsed().as_millis()
                );
                return Ok(role_definitions);
            }
        };

        // HTTPクライアントを再利用
        let http_client = match HttpClient::builder().build() {
            Ok(client) => client,
            Err(_) => {
                println!("[SCAN] HTTPクライアント作成失敗、フォールバック処理に移行");
                // HTTPクライアント作成失敗時はフォールバック
                let mut role_definitions = Vec::new();
                for rd in role_definitions_vec {
                    let mut transformed = serde_json::Map::new();
                    if let Some(id) = rd.get("id") {
                        transformed.insert("role_definition_id".to_string(), id.clone());
                    }
                    if let Some(name) = rd.get("name").or_else(|| rd.get("roleName")) {
                        transformed.insert("role_name".to_string(), name.clone());
                    }
                    if let Some(desc) = rd.get("description") {
                        transformed.insert("description".to_string(), desc.clone());
                    }
                    if let Some(role_type) = rd.get("type") {
                        transformed.insert("role_type".to_string(), role_type.clone());
                    }
                    if let Some(id) = rd.get("id") {
                        if let Some(id_str) = id.as_str() {
                            if let Some(scope_end) =
                                id_str.rfind("/providers/Microsoft.Authorization/roleDefinitions")
                            {
                                let scope = &id_str[..scope_end];
                                transformed
                                    .insert("scope".to_string(), Value::String(scope.to_string()));
                            }
                        }
                    }
                    for (key, value) in rd.as_object().unwrap_or(&serde_json::Map::new()) {
                        if !transformed.contains_key(key) {
                            transformed.insert(key.clone(), value.clone());
                        }
                    }
                    role_definitions.push(Value::Object(transformed));
                }
                println!(
                    "[SCAN] Role Definitionsスキャン完了: {}件, 合計{}ms",
                    role_definitions.len(),
                    start_time.elapsed().as_millis()
                );
                return Ok(role_definitions);
            }
        };

        // 同時実行数を10に制限
        let semaphore = Arc::new(Semaphore::new(10));
        let sub_id = self.config.subscription_id.as_deref();
        let display_name_futures: Vec<_> = unique_role_def_ids
            .iter()
            .map(|rid| {
                let rid_clone = rid.clone();
                let sub_id_clone = sub_id.map(|s| s.to_string());
                let token_clone = token.clone();
                let client_clone = http_client.clone();
                let permit = semaphore.clone();
                async move {
                    let _permit = permit.acquire().await.unwrap();
                    let name = Self::get_role_display_name_with_token(
                        &rid_clone,
                        sub_id_clone.as_deref(),
                        &token_clone,
                        &client_clone,
                    )
                    .await;
                    (rid_clone, name)
                }
            })
            .collect();

        let display_names: Vec<_> = join_all(display_name_futures).await;
        for (rid, name) in display_names {
            role_def_id_to_name.insert(rid, name);
        }
        println!(
            "[SCAN] Role Definition表示名取得完了: {}ms",
            api_start.elapsed().as_millis()
        );

        // 各role definitionに対して表示名を設定
        let mut role_definitions = Vec::new();
        for rd in role_definitions_vec {
            // Azure CLIの出力をフロントエンドが期待する形式に変換
            let mut transformed = serde_json::Map::new();

            // role_definition_id: id
            let role_def_id = rd.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
            if let Some(ref rid) = role_def_id {
                transformed.insert("role_definition_id".to_string(), Value::String(rid.clone()));
            }

            // role_name: キャッシュから表示名を取得
            let role_name_from_api = role_def_id
                .as_ref()
                .and_then(|rid| role_def_id_to_name.get(rid))
                .and_then(|opt| opt.as_ref())
                .cloned();

            if let Some(ref name) = role_name_from_api {
                transformed.insert("role_name".to_string(), Value::String(name.clone()));
            } else if let Some(name) = rd.get("name").or_else(|| rd.get("roleName")) {
                // フォールバック: APIから取得できない場合はnameまたはroleNameを使用
                transformed.insert("role_name".to_string(), name.clone());
            }

            // description: description
            if let Some(desc) = rd.get("description") {
                transformed.insert("description".to_string(), desc.clone());
            }

            // role_type: type
            if let Some(role_type) = rd.get("type") {
                transformed.insert("role_type".to_string(), role_type.clone());
            }

            // scope: assignableScopes の最初の要素、または id から抽出
            let mut scope_set = false;
            if let Some(assignable_scopes) = rd.get("assignableScopes") {
                if let Some(scopes) = assignable_scopes.as_array() {
                    // サブスクリプションレベルのスコープを優先的に選択
                    for scope in scopes {
                        if let Some(scope_str) = scope.as_str() {
                            if scope_str.contains("/subscriptions/")
                                && !scope_str.contains("/resourceGroups/")
                            {
                                transformed.insert("scope".to_string(), scope.clone());
                                scope_set = true;
                                break;
                            }
                        }
                    }
                    // サブスクリプションレベルのスコープが見つからない場合、最初の要素を使用
                    if !scope_set {
                        if let Some(first_scope) = scopes.first() {
                            transformed.insert("scope".to_string(), first_scope.clone());
                            scope_set = true;
                        }
                    }
                }
            }
            // assignableScopesがない場合、id からスコープを抽出
            if !scope_set {
                if let Some(id) = rd.get("id") {
                    if let Some(id_str) = id.as_str() {
                        if let Some(scope_end) =
                            id_str.rfind("/providers/Microsoft.Authorization/roleDefinitions")
                        {
                            let scope = &id_str[..scope_end];
                            transformed
                                .insert("scope".to_string(), Value::String(scope.to_string()));
                        }
                    }
                }
            }

            // 元のデータも保持（必要に応じて）
            for (key, value) in rd.as_object().unwrap_or(&serde_json::Map::new()) {
                if !transformed.contains_key(key) {
                    transformed.insert(key.clone(), value.clone());
                }
            }

            role_definitions.push(Value::Object(transformed));
        }

        println!(
            "[SCAN] Role Definitionsスキャン完了: {}件, 合計{}ms",
            role_definitions.len(),
            start_time.elapsed().as_millis()
        );
        Ok(role_definitions)
    }

    /// 認証トークンを取得（再利用可能にするため）
    async fn get_auth_token(scope: &str) -> Option<String> {
        let credential = match AzureCliCredential::new(None) {
            Ok(cred) => cred,
            Err(_) => return None,
        };

        let scopes = &[scope];
        let token_response = match credential.get_token(scopes, None).await {
            Ok(token) => token,
            Err(_) => return None,
        };
        Some(token_response.token.secret().to_string())
    }

    /// Principal IDから表示名を取得（Microsoft Graph APIを使用、トークンとHTTPクライアントを再利用）
    async fn get_principal_display_name_with_token(
        principal_id: &str,
        principal_type: Option<&str>,
        token: &str,
        client: &HttpClient,
    ) -> Option<String> {
        // Microsoft Graph APIのエンドポイントを決定
        let endpoint = match principal_type {
            Some("User") => format!("https://graph.microsoft.com/v1.0/users/{}", principal_id),
            Some("ServicePrincipal") => format!(
                "https://graph.microsoft.com/v1.0/servicePrincipals/{}",
                principal_id
            ),
            _ => return None,
        };

        // APIリクエストを送信
        let response = match client
            .get(&endpoint)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(_) => return None,
        };

        // レスポンスをJSONとして解析
        let json: Value = match response.json().await {
            Ok(json) => json,
            Err(_) => return None,
        };

        // 表示名を取得
        if let Some(display_name) = json.get("displayName") {
            display_name.as_str().map(|s| s.to_string())
        } else if let Some(app_display_name) = json.get("appDisplayName") {
            app_display_name.as_str().map(|s| s.to_string())
        } else {
            None
        }
    }

    /// Principal IDから表示名を取得（Microsoft Graph APIを使用、後方互換性のため）
    async fn get_principal_display_name(
        principal_id: &str,
        principal_type: Option<&str>,
    ) -> Option<String> {
        let scope = "https://graph.microsoft.com/.default";
        let token = match Self::get_auth_token(scope).await {
            Some(token) => token,
            None => return None,
        };
        let client = match HttpClient::builder().build() {
            Ok(client) => client,
            Err(_) => return None,
        };
        Self::get_principal_display_name_with_token(principal_id, principal_type, &token, &client)
            .await
    }

    /// Role Definition IDから表示名を取得（Azure Management APIを使用）
    async fn get_role_display_name(
        role_definition_id: &str,
        subscription_id: Option<&str>,
    ) -> Option<String> {
        let api_start = std::time::Instant::now();

        // roleDefinitionIdの形式: /subscriptions/{subId}/providers/Microsoft.Authorization/roleDefinitions/{roleId}
        // または単にroleIdのみの場合もある

        let (sub_id, role_id) = if role_definition_id.starts_with("/subscriptions/") {
            // フルパスの場合
            if let Some(role_id_start) = role_definition_id.rfind('/') {
                let role_id = &role_definition_id[role_id_start + 1..];
                let sub_id_start =
                    role_definition_id.find("/subscriptions/").unwrap() + "/subscriptions/".len();
                let sub_id_end = role_definition_id[sub_id_start..]
                    .find('/')
                    .unwrap_or(role_definition_id.len() - sub_id_start);
                let sub_id = &role_definition_id[sub_id_start..sub_id_start + sub_id_end];
                (Some(sub_id), role_id)
            } else {
                return None;
            }
        } else {
            // roleIdのみの場合
            (subscription_id, role_definition_id)
        };

        let sub_id = match sub_id {
            Some(id) => id,
            None => return None,
        };

        // Azure Management APIのスコープ
        let scope = "https://management.azure.com/.default";
        let token_start = std::time::Instant::now();
        let token = match Self::get_auth_token(scope).await {
            Some(token) => token,
            None => {
                println!(
                    "[API] Role表示名取得失敗: トークン取得エラー ({}ms)",
                    token_start.elapsed().as_millis()
                );
                return None;
            }
        };
        if token_start.elapsed().as_millis() > 100 {
            println!(
                "[API] トークン取得に時間がかかりました: {}ms",
                token_start.elapsed().as_millis()
            );
        }

        // HTTPクライアントを作成
        let client = match HttpClient::builder().build() {
            Ok(client) => client,
            Err(_) => return None,
        };

        // Azure Management APIのエンドポイント
        let endpoint = format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.Authorization/roleDefinitions/{}?api-version=2022-04-01",
            sub_id, role_id
        );

        // APIリクエストを送信（日本語ロケールを指定）
        let request_start = std::time::Instant::now();
        let response = match client
            .get(&endpoint)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept-Language", "ja-JP")
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                println!(
                    "[API] Role表示名取得失敗: リクエストエラー {} ({}ms)",
                    e,
                    request_start.elapsed().as_millis()
                );
                return None;
            }
        };
        if request_start.elapsed().as_millis() > 500 {
            println!(
                "[API] Role表示名取得に時間がかかりました: {}ms (role_id: {})",
                request_start.elapsed().as_millis(),
                role_id
            );
        }

        // レスポンスをJSONとして解析
        let json: Value = match response.json().await {
            Ok(json) => json,
            Err(_) => return None,
        };

        // 表示名を取得（properties.displayNameが存在する場合はそれを使用、存在しない場合はproperties.roleNameを使用）
        let properties = json.get("properties");
        let result = if let Some(props) = properties {
            // displayNameが存在する場合はそれを使用（ローカライズされた名前、日本語）
            if let Some(display_name_localized) = props.get("displayName") {
                if let Some(name) = display_name_localized.as_str() {
                    if !name.is_empty() {
                        Some(name.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                // displayNameが存在しない、または空の場合はroleNameを使用（英語名）
                if let Some(role_name) = props.get("roleName") {
                    role_name.as_str().map(|s| s.to_string())
                } else {
                    None
                }
            }
        } else {
            None
        };

        if api_start.elapsed().as_millis() > 1000 {
            println!(
                "[API] Role表示名取得完了（遅延）: {}ms (role_id: {})",
                api_start.elapsed().as_millis(),
                role_id
            );
        }

        result
    }

    /// Role Definition IDから表示名を取得（Azure Management APIを使用、トークンとHTTPクライアントを再利用）
    async fn get_role_display_name_with_token(
        role_definition_id: &str,
        subscription_id: Option<&str>,
        token: &str,
        client: &HttpClient,
    ) -> Option<String> {
        // roleDefinitionIdの形式: /subscriptions/{subId}/providers/Microsoft.Authorization/roleDefinitions/{roleId}
        // または単にroleIdのみの場合もある

        let (sub_id, role_id) = if role_definition_id.starts_with("/subscriptions/") {
            // フルパスの場合
            if let Some(role_id_start) = role_definition_id.rfind('/') {
                let role_id = &role_definition_id[role_id_start + 1..];
                let sub_id_start =
                    role_definition_id.find("/subscriptions/").unwrap() + "/subscriptions/".len();
                let sub_id_end = role_definition_id[sub_id_start..]
                    .find('/')
                    .unwrap_or(role_definition_id.len() - sub_id_start);
                let sub_id = &role_definition_id[sub_id_start..sub_id_start + sub_id_end];
                (Some(sub_id), role_id)
            } else {
                return None;
            }
        } else {
            // roleIdのみの場合
            (subscription_id, role_definition_id)
        };

        let sub_id = match sub_id {
            Some(id) => id,
            None => return None,
        };

        // Azure Management APIのエンドポイント
        let endpoint = format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.Authorization/roleDefinitions/{}?api-version=2022-04-01",
            sub_id, role_id
        );

        // APIリクエストを送信（日本語ロケールを指定）
        let response = match client
            .get(&endpoint)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept-Language", "ja-JP")
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(_) => return None,
        };

        // レスポンスをJSONとして解析
        let json: Value = match response.json().await {
            Ok(json) => json,
            Err(_) => return None,
        };

        // 表示名を取得（properties.displayNameが存在する場合はそれを使用、存在しない場合はproperties.roleNameを使用）
        let properties = json.get("properties");
        if let Some(props) = properties {
            // displayNameが存在する場合はそれを使用（ローカライズされた名前、日本語）
            if let Some(display_name_localized) = props.get("displayName") {
                if let Some(name) = display_name_localized.as_str() {
                    if !name.is_empty() {
                        return Some(name.to_string());
                    }
                }
            }
            // displayNameが存在しない、または空の場合はroleNameを使用（英語名）
            if let Some(role_name) = props.get("roleName") {
                if let Some(name) = role_name.as_str() {
                    return Some(name.to_string());
                }
            }
        }
        None
    }

    /// Role Assignmentsを取得
    async fn scan_role_assignments(&self) -> Result<Vec<Value>> {
        let scan_targets = &self.config.scan_targets;

        if !scan_targets
            .get("role_assignments")
            .copied()
            .unwrap_or(false)
        {
            return Ok(Vec::new());
        }

        let start_time = std::time::Instant::now();
        println!("[SCAN] Role Assignmentsスキャンを開始");

        let mut args: Vec<String> = vec![
            "role".to_string(),
            "assignment".to_string(),
            "list".to_string(),
            "--output".to_string(),
            "json".to_string(),
        ];
        let scope_args = self.get_scope_args();

        // スコープ引数を追加
        args.extend(scope_args);

        // &strのスライスに変換
        let full_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let az_start = std::time::Instant::now();
        println!("[SCAN] Azure CLIコマンド実行開始: az role assignment list");
        let json = Self::execute_az_command(&full_args).await?;
        println!(
            "[SCAN] Azure CLIコマンド完了: {}ms",
            az_start.elapsed().as_millis()
        );

        // まず、すべてのrole assignmentを収集
        let filter_start = std::time::Instant::now();
        let role_assignments_vec: Vec<Value> = json
            .as_array()
            .context("Role Assignments一覧が配列形式ではありません")?
            .iter()
            .filter_map(|ra| {
                // 名前プレフィックスフィルタを適用
                if let Some(name_prefix) = self.config.filters.get("name_prefix") {
                    if let Some(name) = ra
                        .get("name")
                        .or_else(|| ra.get("roleDefinitionName"))
                        .and_then(|v| v.as_str())
                    {
                        if !name.starts_with(name_prefix) {
                            return None;
                        }
                    }
                }

                Some(ra.clone())
            })
            .collect();
        println!(
            "[SCAN] フィルタリング完了: {}件, {}ms",
            role_assignments_vec.len(),
            filter_start.elapsed().as_millis()
        );

        // ユニークなrole definition IDとprincipal IDを収集
        let unique_start = std::time::Instant::now();
        let mut role_def_id_to_name: HashMap<String, Option<String>> = HashMap::new();
        let mut principal_id_to_name: HashMap<String, Option<String>> = HashMap::new();
        let mut unique_role_def_ids: Vec<String> = Vec::new();
        let mut unique_principal_ids: Vec<(String, String)> = Vec::new(); // (id, type)

        for ra in &role_assignments_vec {
            // Role definition IDを収集
            if let Some(role_def_id) = ra.get("roleDefinitionId").and_then(|v| v.as_str()) {
                if !role_def_id_to_name.contains_key(role_def_id) {
                    unique_role_def_ids.push(role_def_id.to_string());
                    role_def_id_to_name.insert(role_def_id.to_string(), None);
                }
            }

            // Principal IDを収集
            if let (Some(principal_id), Some(principal_type)) = (
                ra.get("principalId").and_then(|v| v.as_str()),
                ra.get("principalType").and_then(|v| v.as_str()),
            ) {
                let key = format!("{}:{}", principal_id, principal_type);
                if !principal_id_to_name.contains_key(&key) {
                    unique_principal_ids
                        .push((principal_id.to_string(), principal_type.to_string()));
                    principal_id_to_name.insert(key, None);
                }
            }
        }
        println!(
            "[SCAN] ユニークなID収集完了: Role Definition {}件, Principal {}件, {}ms",
            unique_role_def_ids.len(),
            unique_principal_ids.len(),
            unique_start.elapsed().as_millis()
        );

        // 並列で表示名を取得（同時実行数を制限）
        let api_start = std::time::Instant::now();
        println!(
            "[SCAN] 表示名の並列取得開始: Role Definition {}件, Principal {}件",
            unique_role_def_ids.len(),
            unique_principal_ids.len()
        );

        // トークンを事前に取得してキャッシュ（Management API用）
        let mgmt_token_start = std::time::Instant::now();
        let mgmt_scope = "https://management.azure.com/.default";
        let mgmt_token = match Self::get_auth_token(mgmt_scope).await {
            Some(token) => {
                println!(
                    "[SCAN] Management APIトークン取得完了: {}ms",
                    mgmt_token_start.elapsed().as_millis()
                );
                token
            }
            None => {
                println!("[SCAN] Management APIトークン取得失敗");
                String::new()
            }
        };

        // トークンを事前に取得してキャッシュ（Graph API用）
        let graph_token_start = std::time::Instant::now();
        let graph_scope = "https://graph.microsoft.com/.default";
        let graph_token = match Self::get_auth_token(graph_scope).await {
            Some(token) => {
                println!(
                    "[SCAN] Graph APIトークン取得完了: {}ms",
                    graph_token_start.elapsed().as_millis()
                );
                token
            }
            None => {
                println!("[SCAN] Graph APIトークン取得失敗");
                String::new()
            }
        };

        // HTTPクライアントを再利用
        let http_client = match HttpClient::builder().build() {
            Ok(client) => client,
            Err(_) => {
                println!("[SCAN] HTTPクライアント作成失敗");
                return Ok(Vec::new());
            }
        };

        // 同時実行数を10に制限
        let semaphore = Arc::new(Semaphore::new(10));
        let sub_id = self.config.subscription_id.as_deref();

        // Role definition名を並列取得
        let role_def_futures: Vec<_> = unique_role_def_ids
            .iter()
            .map(|rid| {
                let rid_clone = rid.clone();
                let sub_id_clone = sub_id.map(|s| s.to_string());
                let token_clone = mgmt_token.clone();
                let client_clone = http_client.clone();
                let permit = semaphore.clone();
                async move {
                    let _permit = permit.acquire().await.unwrap();
                    let name = Self::get_role_display_name_with_token(
                        &rid_clone,
                        sub_id_clone.as_deref(),
                        &token_clone,
                        &client_clone,
                    )
                    .await;
                    (rid_clone, name)
                }
            })
            .collect();

        // Principal名を並列取得
        let principal_futures: Vec<_> = unique_principal_ids
            .iter()
            .map(|(pid, ptype)| {
                let pid_clone = pid.clone();
                let ptype_clone = ptype.clone();
                let token_clone = graph_token.clone();
                let client_clone = http_client.clone();
                let permit = semaphore.clone();
                async move {
                    let _permit = permit.acquire().await.unwrap();
                    let name = Self::get_principal_display_name_with_token(
                        &pid_clone,
                        Some(&ptype_clone),
                        &token_clone,
                        &client_clone,
                    )
                    .await;
                    (format!("{}:{}", pid_clone, ptype_clone), name)
                }
            })
            .collect();

        // 両方を並列実行
        let (role_def_results, principal_results) =
            tokio::join!(join_all(role_def_futures), join_all(principal_futures));

        for (rid, name) in role_def_results {
            role_def_id_to_name.insert(rid, name);
        }

        for (key, name) in principal_results {
            principal_id_to_name.insert(key, name);
        }
        println!(
            "[SCAN] 表示名取得完了: {}ms",
            api_start.elapsed().as_millis()
        );

        // 各role assignmentに対して表示名を設定
        let mut transformed_assignments = Vec::new();
        for ra in role_assignments_vec {
            // Azure CLIの出力をフロントエンドが期待する形式に変換
            let mut transformed = serde_json::Map::new();

            // assignment_id: name または id
            if let Some(id) = ra.get("name").or_else(|| ra.get("id")) {
                transformed.insert("assignment_id".to_string(), id.clone());
            }

            // role_definition_name: キャッシュから表示名を取得
            let role_def_id = ra
                .get("roleDefinitionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let role_def_name_from_api = role_def_id
                .as_ref()
                .and_then(|rid| role_def_id_to_name.get(rid))
                .and_then(|opt| opt.as_ref())
                .cloned();

            if let Some(ref name) = role_def_name_from_api {
                transformed.insert(
                    "role_definition_name".to_string(),
                    Value::String(name.clone()),
                );
            } else if let Some(role_def_name) = ra.get("roleDefinitionName") {
                // フォールバック: APIから取得できない場合はroleDefinitionNameを使用
                transformed.insert("role_definition_name".to_string(), role_def_name.clone());
            } else if let Some(ref rid) = role_def_id {
                // さらにフォールバック: roleDefinitionIdから名前を抽出
                if let Some(name_start) = rid.rfind('/') {
                    let name = &rid[name_start + 1..];
                    transformed.insert(
                        "role_definition_name".to_string(),
                        Value::String(name.to_string()),
                    );
                }
            }

            // principal_id: principalId (IDも保持)
            let principal_id = ra
                .get("principalId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let Some(ref pid) = principal_id {
                transformed.insert("principal_id".to_string(), Value::String(pid.clone()));
            }

            // principal_type: principalType
            let principal_type = ra
                .get("principalType")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let Some(ref ptype) = principal_type {
                transformed.insert("principal_type".to_string(), Value::String(ptype.clone()));
            }

            // principal_name: キャッシュから表示名を取得
            let display_name =
                if let (Some(ref pid), Some(ref ptype)) = (&principal_id, &principal_type) {
                    let key = format!("{}:{}", pid, ptype);
                    principal_id_to_name
                        .get(&key)
                        .and_then(|opt| opt.as_ref())
                        .cloned()
                } else {
                    None
                };

            if let Some(ref name) = display_name {
                transformed.insert("principal_name".to_string(), Value::String(name.clone()));
            } else if let Some(principal_name) = ra.get("principalName") {
                // フォールバック: 表示名が取得できない場合は元のprincipalNameを使用
                transformed.insert("principal_name".to_string(), principal_name.clone());
            } else if let Some(ref pid) = principal_id {
                // さらにフォールバック: principal_idを使用
                transformed.insert("principal_name".to_string(), Value::String(pid.clone()));
            }

            // scope: scope
            if let Some(scope) = ra.get("scope") {
                transformed.insert("scope".to_string(), scope.clone());
            }

            // 元のデータも保持（必要に応じて）
            for (key, value) in ra.as_object().unwrap_or(&serde_json::Map::new()) {
                if !transformed.contains_key(key) {
                    transformed.insert(key.clone(), value.clone());
                }
            }

            transformed_assignments.push(Value::Object(transformed));
        }

        println!(
            "[SCAN] Role Assignmentsスキャン完了: {}件, 合計{}ms",
            transformed_assignments.len(),
            start_time.elapsed().as_millis()
        );
        Ok(transformed_assignments)
    }

    pub async fn scan(
        &self,
        progress_callback: Box<dyn Fn(u32, String) + Send + Sync>,
    ) -> Result<Value> {
        let scan_start = std::time::Instant::now();
        println!("[SCAN] ========== スキャン開始 ==========");
        progress_callback(0, "Azure IAMスキャンを開始しています...".to_string());

        let mut results = serde_json::Map::new();

        // Provider情報を追加
        results.insert("provider".to_string(), Value::String("azure".to_string()));

        // Role Definitionsをスキャン
        progress_callback(20, "Role Definitionsのスキャン中...".to_string());
        let role_definitions = self
            .scan_role_definitions()
            .await
            .context("Role Definitionsのスキャンに失敗しました")?;
        let role_def_count = role_definitions.len();
        results.insert(
            "role_definitions".to_string(),
            Value::Array(role_definitions),
        );
        progress_callback(
            50,
            format!("Role Definitionsのスキャン完了: {}件", role_def_count),
        );

        // Role Assignmentsをスキャン
        progress_callback(60, "Role Assignmentsのスキャン中...".to_string());
        let role_assignments = self
            .scan_role_assignments()
            .await
            .context("Role Assignmentsのスキャンに失敗しました")?;
        let role_assign_count = role_assignments.len();
        results.insert(
            "role_assignments".to_string(),
            Value::Array(role_assignments),
        );
        progress_callback(
            90,
            format!("Role Assignmentsのスキャン完了: {}件", role_assign_count),
        );

        println!(
            "[SCAN] ========== スキャン完了: 合計{}ms ==========",
            scan_start.elapsed().as_millis()
        );
        progress_callback(
            100,
            format!(
                "Azure IAMスキャン完了: 合計{}ms",
                scan_start.elapsed().as_millis()
            ),
        );
        Ok(Value::Object(results))
    }
}
