use anyhow::{anyhow, Context, Result};
use aws_sdk_iam::Client as IamClient;
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{debug, info, warn};

use crate::domain::iam_policy::IamPolicyDocument;
use crate::infra::aws::client_factory::AwsClientFactory;
use crate::models::ScanConfig;

pub struct AwsIamScanner {
    config: ScanConfig,
    iam_client: IamClient,
}

impl AwsIamScanner {
    pub async fn new(config: ScanConfig) -> Result<Self> {
        let iam_client = AwsClientFactory::create_iam_client(
            config.profile.clone(),
            config.assume_role_arn.clone(),
            config.assume_role_session_name.clone(),
        )
        .await
        .with_context(|| {
            format!(
                "Failed to create IAM client. Profile: {:?}, Assume Role ARN: {:?}. \
                Please ensure AWS credentials are configured correctly.",
                config.profile, config.assume_role_arn
            )
        })?;

        Ok(Self { config, iam_client })
    }

    pub async fn scan(
        &self,
        progress_callback: Box<dyn Fn(u32, String) + Send + Sync>,
    ) -> Result<Value> {
        let start_time = std::time::Instant::now();
        info!("AWS IAMスキャンを開始");
        progress_callback(0, "AWS IAMスキャンを開始しています...".to_string());

        let mut results = serde_json::Map::new();
        results.insert("provider".to_string(), Value::String("aws".to_string()));

        let scan_targets = &self.config.scan_targets;

        // スキャン対象の数をカウント
        let total_targets = scan_targets.values().filter(|&&v| v).count();
        if total_targets == 0 {
            progress_callback(100, "スキャン対象が選択されていません".to_string());
            return Ok(Value::Object(results));
        }

        let mut completed_targets = 0;

        // Users
        if scan_targets.get("users").copied().unwrap_or(false) {
            debug!("IAM Usersのスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Usersのスキャン中...".to_string(),
            );
            let users = self.scan_users().await?;
            let count = users.len();
            results.insert("users".to_string(), Value::Array(users));
            completed_targets += 1;
            debug!(count, "IAM Usersのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Usersのスキャン完了: {}件", count),
            );
        } else {
            results.insert("users".to_string(), Value::Array(Vec::new()));
        }

        // Groups
        if scan_targets.get("groups").copied().unwrap_or(false) {
            debug!("IAM Groupsのスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Groupsのスキャン中...".to_string(),
            );
            let groups = self.scan_groups().await?;
            let count = groups.len();
            results.insert("groups".to_string(), Value::Array(groups));
            completed_targets += 1;
            debug!(count, "IAM Groupsのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Groupsのスキャン完了: {}件", count),
            );
        } else {
            results.insert("groups".to_string(), Value::Array(Vec::new()));
        }

        // Roles
        if scan_targets.get("roles").copied().unwrap_or(false) {
            debug!("IAM Rolesのスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Rolesのスキャン中...".to_string(),
            );
            let roles = self.scan_roles().await?;
            let count = roles.len();
            results.insert("roles".to_string(), Value::Array(roles));
            completed_targets += 1;
            debug!(count, "IAM Rolesのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Rolesのスキャン完了: {}件", count),
            );
        } else {
            results.insert("roles".to_string(), Value::Array(Vec::new()));
        }

        // Policies
        if scan_targets.get("policies").copied().unwrap_or(false) {
            debug!("IAM Policiesのスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Policiesのスキャン中...".to_string(),
            );
            let policies = self.scan_policies().await?;
            let count = policies.len();
            results.insert("policies".to_string(), Value::Array(policies));
            completed_targets += 1;
            debug!(count, "IAM Policiesのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Policiesのスキャン完了: {}件", count),
            );
        } else {
            results.insert("policies".to_string(), Value::Array(Vec::new()));
        }

        // Attachments
        if scan_targets.get("attachments").copied().unwrap_or(false) {
            debug!("IAM Attachmentsのスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Attachmentsのスキャン中...".to_string(),
            );
            let attachments = self.scan_attachments().await?;
            let count = attachments.len();
            results.insert("attachments".to_string(), Value::Array(attachments));
            completed_targets += 1;
            debug!(count, "IAM Attachmentsのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Attachmentsのスキャン完了: {}件", count),
            );
        } else {
            results.insert("attachments".to_string(), Value::Array(Vec::new()));
        }

        // Cleanup (Access Keys, Login Profiles, MFA) - usersがtrueの場合に自動的にスキャン
        // 注: cleanup単独の指定は後方互換性のために残すが、usersがtrueでもスキャンされる
        if scan_targets.get("users").copied().unwrap_or(false)
            || scan_targets.get("cleanup").copied().unwrap_or(false)
        {
            debug!("IAM Cleanup（アクセスキー、ログインプロファイル、MFA）のスキャンを開始");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                "IAM Users関連情報（アクセスキー、ログインプロファイル、MFA）のスキャン中...".to_string(),
            );
            let cleanup = self.scan_cleanup().await?;
            let count = cleanup.len();
            results.insert("cleanup".to_string(), Value::Array(cleanup));
            debug!(count, "IAM Cleanupのスキャン完了");
            progress_callback(
                (completed_targets * 100 / total_targets) as u32,
                format!("IAM Users関連情報のスキャン完了: {}件", count),
            );
        } else {
            results.insert("cleanup".to_string(), Value::Array(Vec::new()));
        }

        info!(elapsed_ms = start_time.elapsed().as_millis(), "AWS IAMスキャン完了");
        progress_callback(
            100,
            format!(
                "AWS IAMスキャン完了: 合計{}ms",
                start_time.elapsed().as_millis()
            ),
        );
        Ok(Value::Object(results))
    }

    fn apply_name_prefix_filter(&self, name: &str) -> bool {
        if let Some(prefix) = self.config.filters.get("name_prefix") {
            name.starts_with(prefix)
        } else {
            true
        }
    }

    async fn scan_users(&self) -> Result<Vec<Value>> {
        let mut users = Vec::new();
        let mut paginator = self
            .iam_client
            .list_users()
            .into_paginator()
            .page_size(100)
            .send();

        while let Some(page_result) = paginator.next().await {
            let page = page_result.map_err(|e| {
                anyhow!(
                    "Failed to list users. Error: {}. \
                    This may be due to authentication issues or insufficient IAM permissions. \
                    Profile: {:?}. \
                    Please ensure you have run 'aws login' or configured AWS credentials properly, \
                    and that your credentials have the 'iam:ListUsers' permission. \
                    You can test your credentials by running: aws sts get-caller-identity",
                    e,
                    self.config.profile
                )
            })?;

            for user in page.users().iter() {
                let user_name = user.user_name().to_string();

                if !self.apply_name_prefix_filter(&user_name) {
                    continue;
                }

                let create_date = user.create_date().secs();
                let mut user_json = json!({
                    "user_name": user_name,
                    "user_id": user.user_id().to_string(),
                    "arn": user.arn().to_string(),
                    "create_date": create_date,
                    "path": user.path().to_string(),
                });

                // タグを取得
                if let Ok(tags_result) = self
                    .iam_client
                    .list_user_tags()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    let tags = tags_result.tags();
                    if !tags.is_empty() {
                        let tags_map: HashMap<String, String> = tags
                            .iter()
                            .filter_map(|tag| {
                                Some((tag.key().to_string(), tag.value().to_string()))
                            })
                            .collect();
                        if !tags_map.is_empty() {
                            user_json["tags"] = json!(tags_map);
                        }
                    }
                }

                users.push(user_json);
            }
        }

        Ok(users)
    }

    async fn scan_groups(&self) -> Result<Vec<Value>> {
        let mut groups = Vec::new();
        let mut paginator = self
            .iam_client
            .list_groups()
            .into_paginator()
            .page_size(100)
            .send();

        while let Some(page_result) = paginator.next().await {
            let page = page_result.map_err(|e| {
                anyhow!(
                    "Failed to list groups. Error: {}. Profile: {:?}. \
                    Please ensure your credentials have the 'iam:ListGroups' permission.",
                    e,
                    self.config.profile
                )
            })?;

            for group in page.groups().iter() {
                let group_name = group.group_name().to_string();

                if !self.apply_name_prefix_filter(&group_name) {
                    continue;
                }

                let create_date = group.create_date().secs();
                let group_json = json!({
                    "group_name": group_name,
                    "group_id": group.group_id().to_string(),
                    "arn": group.arn().to_string(),
                    "create_date": create_date,
                    "path": group.path().to_string(),
                });

                // タグを取得（list_group_tagsは存在しない可能性があるため、スキップ）
                // AWS SDK for Rustのバージョンによっては利用できない場合がある

                groups.push(group_json);
            }
        }

        Ok(groups)
    }

    async fn scan_roles(&self) -> Result<Vec<Value>> {
        let mut roles = Vec::new();
        let mut paginator = self
            .iam_client
            .list_roles()
            .into_paginator()
            .page_size(100)
            .send();

        while let Some(page_result) = paginator.next().await {
            let page = page_result.map_err(|e| {
                anyhow!(
                    "Failed to list roles. Error: {}. Profile: {:?}. \
                    Please ensure your credentials have the 'iam:ListRoles' permission.",
                    e,
                    self.config.profile
                )
            })?;

            for role in page.roles().iter() {
                let role_name = role.role_name().to_string();

                if !self.apply_name_prefix_filter(&role_name) {
                    continue;
                }

                let create_date = role.create_date().secs();

                // Assume Role Policy Documentを取得してパース
                let assume_role_policy_doc = role.assume_role_policy_document().unwrap_or("").to_string();
                let assume_role_statements = Self::parse_assume_role_policy(&assume_role_policy_doc);

                let mut role_json = json!({
                    "role_name": role_name,
                    "role_id": role.role_id().to_string(),
                    "arn": role.arn().to_string(),
                    "create_date": create_date,
                    "path": role.path().to_string(),
                    "assume_role_policy_document": assume_role_policy_doc,
                });

                // パースに成功した場合は構造化データも追加
                if !assume_role_statements.is_empty() {
                    role_json["assume_role_statements"] = json!(assume_role_statements);
                }

                // タグを取得
                if let Ok(tags_result) = self
                    .iam_client
                    .list_role_tags()
                    .role_name(&role_name)
                    .send()
                    .await
                {
                    let tags = tags_result.tags();
                    if !tags.is_empty() {
                        let tags_map: HashMap<String, String> = tags
                            .iter()
                            .filter_map(|tag| {
                                Some((tag.key().to_string(), tag.value().to_string()))
                            })
                            .collect();
                        if !tags_map.is_empty() {
                            role_json["tags"] = json!(tags_map);
                        }
                    }
                }

                roles.push(role_json);
            }
        }

        Ok(roles)
    }

    async fn scan_policies(&self) -> Result<Vec<Value>> {
        let mut policies = Vec::new();

        // カスタマー管理ポリシー
        let mut paginator = self
            .iam_client
            .list_policies()
            .scope(aws_sdk_iam::types::PolicyScopeType::Local)
            .into_paginator()
            .page_size(100)
            .send();

        while let Some(page_result) = paginator.next().await {
            let page = page_result.map_err(|e| {
                anyhow!(
                    "Failed to list policies. Error: {}. Profile: {:?}. \
                    Please ensure your credentials have the 'iam:ListPolicies' permission.",
                    e,
                    self.config.profile
                )
            })?;

            for policy in page.policies().iter() {
                let policy_name = policy.policy_name().unwrap_or("").to_string();

                if !self.apply_name_prefix_filter(&policy_name) {
                    continue;
                }

                let policy_arn = policy.arn().unwrap_or("").to_string();
                let create_date = policy.create_date().map(|d| d.secs()).unwrap_or(0);
                let update_date = policy.update_date().map(|d| d.secs()).unwrap_or(0);
                let mut policy_json = json!({
                    "policy_name": policy_name,
                    "policy_id": policy.policy_id().unwrap_or("").to_string(),
                    "arn": policy_arn,
                    "create_date": create_date,
                    "update_date": update_date,
                    "path": policy.path().unwrap_or("").to_string(),
                    "default_version_id": policy.default_version_id().unwrap_or("").to_string(),
                    "attachment_count": policy.attachment_count().unwrap_or(0),
                    "is_attachable": policy.is_attachable(),
                });

                // ポリシードキュメントを取得
                if let Some(version_id) = policy.default_version_id() {
                    if let Ok(version_result) = self
                        .iam_client
                        .get_policy_version()
                        .policy_arn(&policy_arn)
                        .version_id(version_id)
                        .send()
                        .await
                    {
                        if let Some(document) =
                            version_result.policy_version().and_then(|v| v.document())
                        {
                            // ポリシードキュメントをパースして構造化
                            // AWS IAM APIから返されるdocumentはURLエンコードされた文字列
                            let decoded_document = urlencoding::decode(document)
                                .unwrap_or_else(|_| std::borrow::Cow::Borrowed(document));

                            match IamPolicyDocument::from_json_str(&decoded_document) {
                                Ok(parsed_doc) => {
                                    // パース成功: 構造化されたステートメントを保存
                                    let statements_json: Vec<Value> = parsed_doc.statements.iter().map(|stmt| {
                                        let mut stmt_json = json!({
                                            "effect": stmt.effect,
                                        });

                                        if let Some(sid) = &stmt.sid {
                                            stmt_json["sid"] = json!(sid);
                                        }

                                        if let Some(action) = &stmt.action {
                                            stmt_json["actions"] = json!(action.as_vec());
                                        }

                                        if let Some(resource) = &stmt.resource {
                                            stmt_json["resources"] = json!(resource.as_vec());
                                        }

                                        if let Some(principal) = &stmt.principal {
                                            stmt_json["principal"] = principal.clone();
                                        }

                                        if let Some(condition) = &stmt.condition {
                                            stmt_json["condition"] = condition.clone();
                                        }

                                        if let Some(not_action) = &stmt.not_action {
                                            stmt_json["not_actions"] = json!(not_action.as_vec());
                                        }

                                        if let Some(not_resource) = &stmt.not_resource {
                                            stmt_json["not_resources"] = json!(not_resource.as_vec());
                                        }

                                        stmt_json
                                    }).collect();

                                    policy_json["statements"] = json!(statements_json);

                                    // バージョンも保存
                                    if let Some(version) = parsed_doc.version {
                                        policy_json["policy_version"] = json!(version);
                                    }
                                }
                                Err(e) => {
                                    // パース失敗: 元のドキュメントをそのまま保存（後方互換性）
                                    warn!("Failed to parse policy document for {}: {}. Falling back to raw document.", policy_name, e);
                                    policy_json["policy_document"] = json!(decoded_document);
                                }
                            }
                        }
                    }
                }

                // タグを取得
                if let Ok(tags_result) = self
                    .iam_client
                    .list_policy_tags()
                    .policy_arn(&policy_arn)
                    .send()
                    .await
                {
                    let tags = tags_result.tags();
                    if !tags.is_empty() {
                        let tags_map: HashMap<String, String> = tags
                            .iter()
                            .filter_map(|tag| {
                                Some((tag.key().to_string(), tag.value().to_string()))
                            })
                            .collect();
                        if !tags_map.is_empty() {
                            policy_json["tags"] = json!(tags_map);
                        }
                    }
                }

                policies.push(policy_json);
            }
        }

        Ok(policies)
    }

    async fn scan_attachments(&self) -> Result<Vec<Value>> {
        let mut attachments = Vec::new();

        // ユーザーへのポリシーアタッチメント
        let mut users_paginator = self
            .iam_client
            .list_users()
            .into_paginator()
            .page_size(100)
            .send();
        while let Some(users_page_result) = users_paginator.next().await {
            let users_page = users_page_result.map_err(|e| {
                anyhow!(
                    "Failed to list users for attachments. Error: {}. Profile: {:?}.",
                    e,
                    self.config.profile
                )
            })?;
            for user in users_page.users().iter() {
                let user_name = user.user_name().to_string();

                // アタッチされたポリシー
                if let Ok(attached_policies) = self
                    .iam_client
                    .list_attached_user_policies()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    for policy in attached_policies.attached_policies().iter() {
                        attachments.push(json!({
                            "entity_type": "user",
                            "entity_name": user_name.clone(),
                            "policy_arn": policy.policy_arn().unwrap_or("").to_string(),
                            "policy_name": policy.policy_name().unwrap_or("").to_string(),
                            "policy_type": "managed",
                        }));
                    }
                }

                // インラインポリシー
                if let Ok(inline_policies) = self
                    .iam_client
                    .list_user_policies()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    for policy_name in inline_policies.policy_names().iter() {
                        attachments.push(json!({
                            "entity_type": "user",
                            "entity_name": user_name.clone(),
                            "policy_name": policy_name,
                            "policy_type": "inline",
                        }));
                    }
                }
            }
        }

        // グループへのポリシーアタッチメント
        let mut groups_paginator = self
            .iam_client
            .list_groups()
            .into_paginator()
            .page_size(100)
            .send();
        while let Some(groups_page_result) = groups_paginator.next().await {
            let groups_page = groups_page_result.map_err(|e| {
                anyhow!(
                    "Failed to list groups for attachments. Error: {}. Profile: {:?}.",
                    e,
                    self.config.profile
                )
            })?;
            for group in groups_page.groups().iter() {
                let group_name = group.group_name().to_string();

                // アタッチされたポリシー
                if let Ok(attached_policies) = self
                    .iam_client
                    .list_attached_group_policies()
                    .group_name(&group_name)
                    .send()
                    .await
                {
                    for policy in attached_policies.attached_policies().iter() {
                        attachments.push(json!({
                            "entity_type": "group",
                            "entity_name": group_name.clone(),
                            "policy_arn": policy.policy_arn().unwrap_or("").to_string(),
                            "policy_name": policy.policy_name().unwrap_or("").to_string(),
                            "policy_type": "managed",
                        }));
                    }
                }

                // インラインポリシー
                if let Ok(inline_policies) = self
                    .iam_client
                    .list_group_policies()
                    .group_name(&group_name)
                    .send()
                    .await
                {
                    for policy_name in inline_policies.policy_names().iter() {
                        attachments.push(json!({
                            "entity_type": "group",
                            "entity_name": group_name.clone(),
                            "policy_name": policy_name,
                            "policy_type": "inline",
                        }));
                    }
                }
            }
        }

        // ロールへのポリシーアタッチメント
        let mut roles_paginator = self
            .iam_client
            .list_roles()
            .into_paginator()
            .page_size(100)
            .send();
        while let Some(roles_page_result) = roles_paginator.next().await {
            let roles_page = roles_page_result.map_err(|e| {
                anyhow!(
                    "Failed to list roles for attachments. Error: {}. Profile: {:?}.",
                    e,
                    self.config.profile
                )
            })?;
            for role in roles_page.roles().iter() {
                let role_name = role.role_name().to_string();

                // アタッチされたポリシー
                if let Ok(attached_policies) = self
                    .iam_client
                    .list_attached_role_policies()
                    .role_name(&role_name)
                    .send()
                    .await
                {
                    for policy in attached_policies.attached_policies().iter() {
                        attachments.push(json!({
                            "entity_type": "role",
                            "entity_name": role_name.clone(),
                            "policy_arn": policy.policy_arn().unwrap_or("").to_string(),
                            "policy_name": policy.policy_name().unwrap_or("").to_string(),
                            "policy_type": "managed",
                        }));
                    }
                }

                // インラインポリシー
                if let Ok(inline_policies) = self
                    .iam_client
                    .list_role_policies()
                    .role_name(&role_name)
                    .send()
                    .await
                {
                    for policy_name in inline_policies.policy_names().iter() {
                        attachments.push(json!({
                            "entity_type": "role",
                            "entity_name": role_name.clone(),
                            "policy_name": policy_name,
                            "policy_type": "inline",
                        }));
                    }
                }
            }
        }

        Ok(attachments)
    }

    async fn scan_cleanup(&self) -> Result<Vec<Value>> {
        let mut cleanup_items = Vec::new();

        // ユーザーのアクセスキー、ログインプロファイル、MFAデバイスを取得
        let mut users_paginator = self
            .iam_client
            .list_users()
            .into_paginator()
            .page_size(100)
            .send();
        while let Some(users_page_result) = users_paginator.next().await {
            let users_page = users_page_result.map_err(|e| {
                anyhow!(
                    "Failed to list users for cleanup. Error: {}. Profile: {:?}.",
                    e,
                    self.config.profile
                )
            })?;
            for user in users_page.users().iter() {
                let user_name = user.user_name().to_string();

                // アクセスキー
                if let Ok(access_keys) = self
                    .iam_client
                    .list_access_keys()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    for key in access_keys.access_key_metadata().iter() {
                        let create_date = key.create_date().map(|d| d.secs()).unwrap_or(0);
                        cleanup_items.push(json!({
                            "resource_type": "access_key",
                            "user_name": user_name.clone(),
                            "access_key_id": key.access_key_id().unwrap_or("").to_string(),
                            "status": key.status().map(|s| format!("{:?}", s)).unwrap_or_default(),
                            "create_date": create_date,
                        }));
                    }
                }

                // ログインプロファイル
                if let Ok(login_profile) = self
                    .iam_client
                    .get_login_profile()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    if let Some(profile) = login_profile.login_profile() {
                        let create_date = profile.create_date().secs();
                        cleanup_items.push(json!({
                            "resource_type": "login_profile",
                            "user_name": user_name.clone(),
                            "create_date": create_date,
                        }));
                    }
                }

                // MFAデバイス
                if let Ok(mfa_devices) = self
                    .iam_client
                    .list_mfa_devices()
                    .user_name(&user_name)
                    .send()
                    .await
                {
                    for device in mfa_devices.mfa_devices().iter() {
                        let enable_date = device.enable_date().secs();
                        cleanup_items.push(json!({
                            "resource_type": "mfa_device",
                            "user_name": user_name.clone(),
                            "serial_number": device.serial_number().to_string(),
                            "enable_date": enable_date,
                        }));
                    }
                }
            }
        }

        Ok(cleanup_items)
    }

    /// Assume Role Policy DocumentをパースしてTerraform用の構造化データに変換
    fn parse_assume_role_policy(policy_doc: &str) -> Vec<Value> {
        if policy_doc.is_empty() {
            return Vec::new();
        }

        // URLデコード
        let decoded = match urlencoding::decode(policy_doc) {
            Ok(s) => s.to_string(),
            Err(_) => {
                // URLエンコードされていない場合はそのまま使用
                policy_doc.to_string()
            }
        };

        // JSONパース
        let policy_value: Value = match serde_json::from_str(&decoded) {
            Ok(v) => v,
            Err(e) => {
                warn!("Failed to parse assume_role_policy_document: {}", e);
                return Vec::new();
            }
        };

        // Statementを抽出
        let statements = match policy_value.get("Statement") {
            Some(Value::Array(arr)) => arr,
            _ => {
                warn!("No Statement array found in assume_role_policy_document");
                return Vec::new();
            }
        };

        // 各Statementを変換
        statements
            .iter()
            .filter_map(|stmt| {
                let effect = stmt.get("Effect")?.as_str()?.to_string();

                // Principalの処理
                let (principal_type, principal_identifiers) = match stmt.get("Principal") {
                    Some(Value::Object(principal_obj)) => {
                        // Principalが{"Service": "..."}の形式
                        if let Some(service) = principal_obj.get("Service") {
                            let identifiers = match service {
                                Value::String(s) => vec![s.clone()],
                                Value::Array(arr) => arr
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect(),
                                _ => vec![],
                            };
                            ("Service".to_string(), identifiers)
                        } else if let Some(aws) = principal_obj.get("AWS") {
                            // Principalが{"AWS": "..."}の形式
                            let identifiers = match aws {
                                Value::String(s) => vec![s.clone()],
                                Value::Array(arr) => arr
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect(),
                                _ => vec![],
                            };
                            ("AWS".to_string(), identifiers)
                        } else if let Some(federated) = principal_obj.get("Federated") {
                            // Principalが{"Federated": "..."}の形式
                            let identifiers = match federated {
                                Value::String(s) => vec![s.clone()],
                                Value::Array(arr) => arr
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect(),
                                _ => vec![],
                            };
                            ("Federated".to_string(), identifiers)
                        } else {
                            // その他のPrincipal
                            ("AWS".to_string(), vec!["*".to_string()])
                        }
                    }
                    Some(Value::String(s)) if s == "*" => {
                        // Principalが"*"の形式
                        ("AWS".to_string(), vec!["*".to_string()])
                    }
                    _ => return None,
                };

                // Actionの処理
                let actions = match stmt.get("Action") {
                    Some(Value::String(s)) => vec![s.clone()],
                    Some(Value::Array(arr)) => arr
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect(),
                    _ => vec!["sts:AssumeRole".to_string()], // デフォルト
                };

                // Conditionの処理
                let conditions = if let Some(Value::Object(condition_obj)) = stmt.get("Condition") {
                    let mut conds = Vec::new();
                    for (test, value_obj) in condition_obj.iter() {
                        if let Value::Object(var_obj) = value_obj {
                            for (variable, values) in var_obj.iter() {
                                let value_list = match values {
                                    Value::String(s) => vec![s.clone()],
                                    Value::Array(arr) => arr
                                        .iter()
                                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                        .collect(),
                                    _ => vec![],
                                };
                                conds.push(json!({
                                    "test": test,
                                    "variable": variable,
                                    "values": value_list,
                                }));
                            }
                        }
                    }
                    conds
                } else {
                    vec![]
                };

                Some(json!({
                    "effect": effect,
                    "principal_type": principal_type,
                    "principal_identifiers": principal_identifiers,
                    "actions": actions,
                    "conditions": conditions,
                }))
            })
            .collect()
    }
}
