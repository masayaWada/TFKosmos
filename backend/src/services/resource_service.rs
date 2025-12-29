use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::ResourceListResponse;
use crate::services::scan_service::ScanService;

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

    #[test]
    fn test_resource_matches_search_string_field() {
        let resource = json!({
            "name": "TestUser",
            "arn": "arn:aws:iam::123456789012:user/TestUser"
        });

        assert!(ResourceService::resource_matches_search(&resource, "testuser"));
        assert!(ResourceService::resource_matches_search(&resource, "123456789012"));
        assert!(!ResourceService::resource_matches_search(&resource, "nonexistent"));
    }

    #[test]
    fn test_resource_matches_search_case_insensitive() {
        // 注意: resource_matches_search は検索語を小文字化しない
        // apply_filters で小文字化されるため、直接呼び出す場合は小文字で渡す
        let resource = json!({
            "name": "AdminUser"
        });

        assert!(ResourceService::resource_matches_search(&resource, "adminuser"));
        assert!(ResourceService::resource_matches_search(&resource, "admin"));
    }

    #[test]
    fn test_resource_matches_search_nested_object() {
        let resource = json!({
            "name": "TestRole",
            "permissions": {
                "action": "s3:GetObject",
                "resource": "*"
            }
        });

        assert!(ResourceService::resource_matches_search(&resource, "s3:getobject"));
        assert!(ResourceService::resource_matches_search(&resource, "testrole"));
    }

    #[test]
    fn test_resource_matches_search_array_field() {
        let resource = json!({
            "name": "TestGroup",
            "members": ["user1", "user2", "admin"]
        });

        assert!(ResourceService::resource_matches_search(&resource, "user1"));
        assert!(ResourceService::resource_matches_search(&resource, "admin"));
        assert!(!ResourceService::resource_matches_search(&resource, "user3"));
    }

    #[test]
    fn test_value_contains_search_number() {
        let value = json!(12345);
        assert!(ResourceService::value_contains_search(&value, "123"));
        assert!(ResourceService::value_contains_search(&value, "12345"));
        assert!(!ResourceService::value_contains_search(&value, "999"));
    }

    #[test]
    fn test_value_contains_search_boolean() {
        let value_true = json!(true);
        let value_false = json!(false);

        assert!(ResourceService::value_contains_search(&value_true, "true"));
        assert!(ResourceService::value_contains_search(&value_false, "false"));
    }

    #[test]
    fn test_apply_filters_with_search_term() {
        let resources = vec![
            json!({"name": "AdminUser", "type": "user"}),
            json!({"name": "TestRole", "type": "role"}),
            json!({"name": "AdminGroup", "type": "group"}),
        ];

        let filters = json!({"search": "Admin"});
        let result = ResourceService::apply_filters(resources, filters).unwrap();

        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|r| r["name"] == "AdminUser"));
        assert!(result.iter().any(|r| r["name"] == "AdminGroup"));
    }

    #[test]
    fn test_apply_filters_empty_search() {
        let resources = vec![
            json!({"name": "User1"}),
            json!({"name": "User2"}),
        ];

        let filters = json!({"search": ""});
        let result = ResourceService::apply_filters(resources.clone(), filters).unwrap();

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_apply_filters_no_match() {
        let resources = vec![
            json!({"name": "User1"}),
            json!({"name": "User2"}),
        ];

        let filters = json!({"search": "nonexistent"});
        let result = ResourceService::apply_filters(resources, filters).unwrap();

        assert_eq!(result.len(), 0);
    }
}
