use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub provider: String, // "aws" or "azure"

    // AWS specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assume_role_arn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assume_role_session_name: Option<String>,

    // Azure specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_method: Option<String>, // "az_login", "service_principal"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_principal_config: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope_type: Option<String>, // "management_group", "subscription", "resource_group"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope_value: Option<String>,

    // Common
    #[serde(default)]
    pub scan_targets: HashMap<String, bool>,
    #[serde(default)]
    pub filters: HashMap<String, String>,

    // Performance options
    /// タグ情報を取得するかどうか（デフォルト: true）
    /// 大規模環境ではfalseにすることでスキャン速度が向上
    #[serde(default = "default_true")]
    pub include_tags: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationConfig {
    pub output_path: String,
    #[serde(default = "default_file_split_rule")]
    pub file_split_rule: String, // "single", "by_resource_type", "by_resource_name", "by_resource_group", "by_subscription"
    #[serde(default = "default_naming_convention")]
    pub naming_convention: String, // "snake_case", "kebab-case", "original"
    #[serde(default = "default_import_script_format")]
    pub import_script_format: String, // "sh", "ps1"
    #[serde(default = "default_true")]
    pub generate_readme: bool,
    #[serde(default)]
    pub selected_resources: HashMap<String, Vec<serde_json::Value>>,
}

fn default_file_split_rule() -> String {
    "single".to_string()
}

fn default_naming_convention() -> String {
    "snake_case".to_string()
}

fn default_import_script_format() -> String {
    "sh".to_string()
}

fn default_true() -> bool {
    true
}
