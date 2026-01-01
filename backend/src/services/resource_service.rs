use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::ResourceListResponse;
use crate::services::scan_service::ScanService;
use crate::infra::query::{Lexer, QueryParser, QueryEvaluator};

// In-memory storage for resource selections (in production, use Redis or database)
type ResourceSelections = Arc<RwLock<HashMap<String, HashMap<String, Vec<Value>>>>>;

lazy_static::lazy_static! {
    static ref RESOURCE_SELECTIONS: ResourceSelections = Arc::new(RwLock::new(HashMap::new()));
}

pub struct ResourceService;

impl ResourceService {
    pub async fn get_resources(
        scan_id: &str,
        resource_type: Option<&str>,
        page: u32,
        page_size: u32,
        filter_conditions: Option<Value>,
    ) -> Result<ResourceListResponse> {
        // Get scan data
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        // Extract resources based on type
        let mut all_resources: Vec<Value> = Vec::new();

        if let Some(rt) = resource_type {
            if let Some(resources) = scan_data.get(rt) {
                if let Some(arr) = resources.as_array() {
                    all_resources = arr.clone();
                }
            }
        } else {
            // Get all resource types
            if let Some(obj) = scan_data.as_object() {
                for (_, resources) in obj {
                    if let Some(arr) = resources.as_array() {
                        all_resources.extend(arr.clone());
                    }
                }
            }
        }

        // Apply filters if provided
        if let Some(filters) = filter_conditions {
            all_resources = Self::apply_filters(all_resources, filters)?;
        }

        let total = all_resources.len();
        let total_pages = (total as f64 / page_size as f64).ceil() as u32;

        // Paginate
        let start = ((page - 1) * page_size) as usize;
        let end = (start + page_size as usize).min(total);
        let resources = if start < total {
            all_resources[start..end].to_vec()
        } else {
            Vec::new()
        };

        // Get provider from scan result
        let provider = scan_data
            .get("provider")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string());

        Ok(ResourceListResponse {
            resources,
            total,
            page,
            page_size,
            total_pages,
            provider,
        })
    }

    pub async fn query_resources(
        scan_id: &str,
        query: &str,
        resource_type: Option<&str>,
        page: u32,
        page_size: u32,
    ) -> Result<ResourceListResponse> {
        // Parse query
        let mut lexer = Lexer::new(query);
        let tokens = lexer.tokenize()
            .map_err(|e| anyhow::anyhow!("クエリ構文エラー: {}", e))?;

        let mut parser = QueryParser::new(tokens);
        let expr = parser.parse()
            .map_err(|e| anyhow::anyhow!("クエリパースエラー: {}", e))?;

        // Get scan data
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        // Extract resources based on type
        let mut all_resources: Vec<Value> = Vec::new();

        if let Some(rt) = resource_type {
            if let Some(resources) = scan_data.get(rt) {
                if let Some(arr) = resources.as_array() {
                    all_resources = arr.clone();
                }
            }
        } else {
            // Get all resource types (excluding metadata fields)
            if let Some(obj) = scan_data.as_object() {
                for (key, resources) in obj {
                    // Skip metadata fields
                    if key == "provider" || key == "scan_id" || key == "timestamp" {
                        continue;
                    }
                    if let Some(arr) = resources.as_array() {
                        all_resources.extend(arr.clone());
                    }
                }
            }
        }

        // Filter using query expression
        let filtered: Vec<Value> = all_resources
            .into_iter()
            .filter(|resource| QueryEvaluator::evaluate(&expr, resource))
            .collect();

        let total = filtered.len();
        let total_pages = (total as f64 / page_size as f64).ceil() as u32;

        // Paginate
        let start = ((page - 1) * page_size) as usize;
        let end = (start + page_size as usize).min(total);
        let resources = if start < total {
            filtered[start..end].to_vec()
        } else {
            Vec::new()
        };

        // Get provider from scan result
        let provider = scan_data
            .get("provider")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string());

        Ok(ResourceListResponse {
            resources,
            total,
            page,
            page_size,
            total_pages,
            provider,
        })
    }

    pub async fn update_selection(
        scan_id: &str,
        selections: HashMap<String, Vec<Value>>,
    ) -> Result<Value> {
        let mut storage = RESOURCE_SELECTIONS.write().await;
        let scan_selections = storage.entry(scan_id.to_string()).or_insert_with(HashMap::new);
        
        // Merge new selections with existing ones
        for (resource_type, ids) in selections {
            scan_selections.insert(resource_type, ids);
        }
        
        let total_count: usize = scan_selections.values().map(|v| v.len()).sum();
        
        Ok(json!({
            "success": true,
            "selected_count": total_count
        }))
    }

    pub async fn get_selection(scan_id: &str) -> Result<HashMap<String, Vec<Value>>> {
        let storage = RESOURCE_SELECTIONS.read().await;
        Ok(storage.get(scan_id).cloned().unwrap_or_default())
    }

    fn apply_filters(resources: Vec<Value>, filters: Value) -> Result<Vec<Value>> {
        // Extract search term from filters
        let search_term = filters
            .get("search")
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase());

        if let Some(term) = search_term {
            if term.is_empty() {
                return Ok(resources);
            }

            // Filter resources that match the search term in any field
            let filtered: Vec<Value> = resources
                .into_iter()
                .filter(|resource| {
                    Self::resource_matches_search(resource, &term)
                })
                .collect();

            Ok(filtered)
        } else {
            Ok(resources)
        }
    }

    fn resource_matches_search(resource: &Value, search_term: &str) -> bool {
        // Check if any field in the resource contains the search term
        match resource {
            Value::Object(map) => {
                for (_, value) in map {
                    if Self::value_contains_search(value, search_term) {
                        return true;
                    }
                }
                false
            }
            Value::String(s) => s.to_lowercase().contains(search_term),
            Value::Array(arr) => {
                for item in arr {
                    if Self::resource_matches_search(item, search_term) {
                        return true;
                    }
                }
                false
            }
            _ => false,
        }
    }

    fn value_contains_search(value: &Value, search_term: &str) -> bool {
        match value {
            Value::String(s) => s.to_lowercase().contains(search_term),
            Value::Number(n) => {
                if let Some(n_str) = n.as_f64().map(|f| f.to_string()) {
                    n_str.contains(search_term)
                } else if let Some(n_str) = n.as_i64().map(|i| i.to_string()) {
                    n_str.contains(search_term)
                } else if let Some(n_str) = n.as_u64().map(|u| u.to_string()) {
                    n_str.contains(search_term)
                } else {
                    false
                }
            }
            Value::Bool(b) => b.to_string().contains(search_term),
            Value::Array(arr) => {
                for item in arr {
                    if Self::value_contains_search(item, search_term) {
                        return true;
                    }
                }
                false
            }
            Value::Object(map) => {
                for (_, v) in map {
                    if Self::value_contains_search(v, search_term) {
                        return true;
                    }
                }
                false
            }
            Value::Null => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// テストデータ生成用ヘルパー関数
    mod test_helpers {
        use serde_json::{json, Value};

        pub fn create_user_resource(name: &str, arn: &str) -> Value {
            json!({
                "name": name,
                "arn": arn
            })
        }

        pub fn create_role_resource(name: &str, permissions: Value) -> Value {
            json!({
                "name": name,
                "permissions": permissions
            })
        }

        pub fn create_group_resource(name: &str, members: Vec<&str>) -> Value {
            json!({
                "name": name,
                "members": members
            })
        }
    }

    #[test]
    fn test_resource_matches_search_string_field() {
        // Arrange
        let resource = test_helpers::create_user_resource(
            "TestUser",
            "arn:aws:iam::123456789012:user/TestUser",
        );

        // Act & Assert
        assert!(
            ResourceService::resource_matches_search(&resource, "testuser"),
            "名前フィールドで検索がマッチするべき"
        );
        assert!(
            ResourceService::resource_matches_search(&resource, "123456789012"),
            "ARNフィールドで検索がマッチするべき"
        );
        assert!(
            !ResourceService::resource_matches_search(&resource, "nonexistent"),
            "存在しない文字列では検索がマッチしないべき"
        );
    }

    #[test]
    fn test_resource_matches_search_case_insensitive() {
        // Arrange
        // 注意: resource_matches_search は検索語を小文字化しない
        // apply_filters で小文字化されるため、直接呼び出す場合は小文字で渡す
        let resource = json!({"name": "AdminUser"});

        // Act & Assert
        assert!(
            ResourceService::resource_matches_search(&resource, "adminuser"),
            "大文字小文字を区別しない検索がマッチするべき"
        );
        assert!(
            ResourceService::resource_matches_search(&resource, "admin"),
            "部分一致検索がマッチするべき"
        );
    }

    #[test]
    fn test_resource_matches_search_nested_object() {
        // Arrange
        let resource = test_helpers::create_role_resource(
            "TestRole",
            json!({
                "action": "s3:GetObject",
                "resource": "*"
            }),
        );

        // Act & Assert
        assert!(
            ResourceService::resource_matches_search(&resource, "s3:getobject"),
            "ネストしたオブジェクトの検索がマッチするべき"
        );
        assert!(
            ResourceService::resource_matches_search(&resource, "testrole"),
            "トップレベルフィールドの検索がマッチするべき"
        );
    }

    #[test]
    fn test_resource_matches_search_array_field() {
        // Arrange
        let resource = test_helpers::create_group_resource("TestGroup", vec!["user1", "user2", "admin"]);

        // Act & Assert
        assert!(
            ResourceService::resource_matches_search(&resource, "user1"),
            "配列フィールドの検索がマッチするべき"
        );
        assert!(
            ResourceService::resource_matches_search(&resource, "admin"),
            "配列フィールドの別の要素でも検索がマッチするべき"
        );
        assert!(
            !ResourceService::resource_matches_search(&resource, "user3"),
            "配列に存在しない要素では検索がマッチしないべき"
        );
    }

    #[test]
    fn test_value_contains_search_number() {
        // Arrange
        let value = json!(12345);

        // Act & Assert
        assert!(
            ResourceService::value_contains_search(&value, "123"),
            "数値の部分一致検索がマッチするべき"
        );
        assert!(
            ResourceService::value_contains_search(&value, "12345"),
            "数値の完全一致検索がマッチするべき"
        );
        assert!(
            !ResourceService::value_contains_search(&value, "999"),
            "数値に含まれない文字列では検索がマッチしないべき"
        );
    }

    #[test]
    fn test_value_contains_search_boolean() {
        // Arrange
        let value_true = json!(true);
        let value_false = json!(false);

        // Act & Assert
        assert!(
            ResourceService::value_contains_search(&value_true, "true"),
            "ブール値trueの検索がマッチするべき"
        );
        assert!(
            ResourceService::value_contains_search(&value_false, "false"),
            "ブール値falseの検索がマッチするべき"
        );
    }

    #[test]
    fn test_value_contains_search_null() {
        // Arrange
        let value = json!(null);

        // Act & Assert
        assert!(
            !ResourceService::value_contains_search(&value, "null"),
            "null値は検索にマッチしないべき"
        );
    }

    #[test]
    fn test_apply_filters_with_search_term() {
        // Arrange
        let resources = vec![
            json!({"name": "AdminUser", "type": "user"}),
            json!({"name": "TestRole", "type": "role"}),
            json!({"name": "AdminGroup", "type": "group"}),
        ];
        let filters = json!({"search": "Admin"});

        // Act
        let result = ResourceService::apply_filters(resources, filters).unwrap();

        // Assert
        assert_eq!(result.len(), 2, "フィルタ後のリソース数は2であるべき");
        assert!(
            result.iter().any(|r| r["name"] == "AdminUser"),
            "AdminUserがフィルタ結果に含まれるべき"
        );
        assert!(
            result.iter().any(|r| r["name"] == "AdminGroup"),
            "AdminGroupがフィルタ結果に含まれるべき"
        );
    }

    #[test]
    fn test_apply_filters_empty_search() {
        // Arrange
        let resources = vec![json!({"name": "User1"}), json!({"name": "User2"})];
        let filters = json!({"search": ""});

        // Act
        let result = ResourceService::apply_filters(resources.clone(), filters).unwrap();

        // Assert
        assert_eq!(
            result.len(),
            2,
            "空の検索語では全てのリソースが返されるべき"
        );
    }

    #[test]
    fn test_apply_filters_no_match() {
        // Arrange
        let resources = vec![json!({"name": "User1"}), json!({"name": "User2"})];
        let filters = json!({"search": "nonexistent"});

        // Act
        let result = ResourceService::apply_filters(resources, filters).unwrap();

        // Assert
        assert_eq!(
            result.len(),
            0,
            "マッチしない検索語では空のリストが返されるべき"
        );
    }

    #[test]
    fn test_apply_filters_without_search_key() {
        // Arrange
        let resources = vec![json!({"name": "User1"}), json!({"name": "User2"})];
        let filters = json!({"other_filter": "value"});

        // Act
        let result = ResourceService::apply_filters(resources.clone(), filters).unwrap();

        // Assert
        assert_eq!(
            result.len(),
            2,
            "searchキーがない場合は全てのリソースが返されるべき"
        );
    }
}
