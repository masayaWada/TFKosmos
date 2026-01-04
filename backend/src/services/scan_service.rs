use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::infra::aws::scanner::AwsIamScanner;
use crate::infra::azure::scanner::AzureIamScanner;
use crate::models::{ScanConfig, ScanResponse};

// In-memory storage for scan results (in production, use Redis or database)
type ScanResults = Arc<RwLock<std::collections::HashMap<String, ScanResult>>>;

struct ScanResult {
    scan_id: String,
    status: String,
    progress: Option<u32>,
    message: Option<String>,
    _config: ScanConfig,
    data: Option<serde_json::Value>,
}

lazy_static::lazy_static! {
    static ref SCAN_RESULTS: ScanResults = Arc::new(RwLock::new(std::collections::HashMap::new()));
}

pub struct ScanService;

impl ScanService {
    /// 進捗状況を更新する
    pub async fn update_progress(scan_id: &str, progress: u32, message: String) {
        let mut results = SCAN_RESULTS.write().await;
        if let Some(scan_result) = results.get_mut(scan_id) {
            scan_result.progress = Some(progress);
            scan_result.message = Some(message);
        }
    }

    pub async fn start_scan(config: ScanConfig) -> Result<String> {
        let scan_id = Uuid::new_v4().to_string();

        // Store initial scan state
        let scan_result = ScanResult {
            scan_id: scan_id.clone(),
            status: "in_progress".to_string(),
            progress: Some(0),
            message: Some("スキャンを開始しています...".to_string()),
            _config: config.clone(),
            data: None,
        };

        SCAN_RESULTS
            .write()
            .await
            .insert(scan_id.clone(), scan_result);

        // Start scan in background task
        let scan_id_clone = scan_id.clone();
        tokio::spawn(async move {
            let result = match config.provider.as_str() {
                "aws" => match AwsIamScanner::new(config.clone()).await {
                    Ok(scanner) => {
                        let scan_id_for_callback = scan_id_clone.clone();
                        let progress_callback = Box::new(move |progress: u32, message: String| {
                            let scan_id = scan_id_for_callback.clone();
                            tokio::spawn(async move {
                                ScanService::update_progress(&scan_id, progress, message).await;
                            });
                        });
                        scanner.scan(progress_callback).await
                    }
                    Err(e) => {
                        eprintln!("[SCAN ERROR] Failed to create AWS scanner: {}", e);
                        Err(e)
                    }
                },
                "azure" => match AzureIamScanner::new(config.clone()).await {
                    Ok(scanner) => {
                        let scan_id_for_callback = scan_id_clone.clone();
                        let progress_callback = Box::new(move |progress: u32, message: String| {
                            let scan_id = scan_id_for_callback.clone();
                            tokio::spawn(async move {
                                ScanService::update_progress(&scan_id, progress, message).await;
                            });
                        });
                        scanner.scan(progress_callback).await
                    }
                    Err(e) => {
                        eprintln!("[SCAN ERROR] Failed to create Azure scanner: {}", e);
                        Err(e)
                    }
                },
                _ => Err(anyhow::anyhow!("Unknown provider")),
            };

            match result {
                Ok(data) => match serde_json::to_value(data) {
                    Ok(json_data) => {
                        let mut results = SCAN_RESULTS.write().await;
                        if let Some(scan_result) = results.get_mut(&scan_id_clone) {
                            scan_result.status = "completed".to_string();
                            scan_result.progress = Some(100);
                            scan_result.message = Some("スキャンが完了しました".to_string());
                            scan_result.data = Some(json_data);
                            println!("[SCAN] Scan {} completed successfully", scan_id_clone);
                        } else {
                            eprintln!(
                                "[SCAN ERROR] Scan result not found for scan_id: {}",
                                scan_id_clone
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("[SCAN ERROR] Failed to serialize scan data: {}", e);
                        let mut results = SCAN_RESULTS.write().await;
                        if let Some(scan_result) = results.get_mut(&scan_id_clone) {
                            scan_result.status = "failed".to_string();
                            scan_result.message =
                                Some(format!("スキャンデータのシリアライズに失敗しました: {}", e));
                        }
                    }
                },
                Err(e) => {
                    eprintln!("[SCAN ERROR] Scan failed: {}", e);
                    let mut results = SCAN_RESULTS.write().await;
                    if let Some(scan_result) = results.get_mut(&scan_id_clone) {
                        scan_result.status = "failed".to_string();
                        scan_result.message = Some(format!("スキャンに失敗しました: {}", e));
                    }
                }
            }

            Ok::<(), anyhow::Error>(())
        });

        Ok(scan_id)
    }

    pub async fn get_scan_result(scan_id: &str) -> Option<ScanResponse> {
        let results = SCAN_RESULTS.read().await;
        results.get(scan_id).map(|result| {
            // Calculate summary from scan data
            let summary = result.data.as_ref().and_then(|data| {
                let mut summary = std::collections::HashMap::new();
                if let Some(provider) = data.get("provider").and_then(|v| v.as_str()) {
                    if provider == "aws" {
                        if let Some(users) = data.get("users").and_then(|v| v.as_array()) {
                            summary.insert("users".to_string(), users.len());
                        }
                        if let Some(groups) = data.get("groups").and_then(|v| v.as_array()) {
                            summary.insert("groups".to_string(), groups.len());
                        }
                        if let Some(roles) = data.get("roles").and_then(|v| v.as_array()) {
                            summary.insert("roles".to_string(), roles.len());
                        }
                        if let Some(policies) = data.get("policies").and_then(|v| v.as_array()) {
                            summary.insert("policies".to_string(), policies.len());
                        }
                        if let Some(attachments) = data.get("attachments").and_then(|v| v.as_array()) {
                            summary.insert("attachments".to_string(), attachments.len());
                        }
                        if let Some(cleanup) = data.get("cleanup").and_then(|v| v.as_array()) {
                            summary.insert("cleanup".to_string(), cleanup.len());
                        }
                    } else if provider == "azure" {
                        if let Some(role_definitions) = data.get("role_definitions").and_then(|v| v.as_array()) {
                            summary.insert("role_definitions".to_string(), role_definitions.len());
                        }
                        if let Some(role_assignments) = data.get("role_assignments").and_then(|v| v.as_array()) {
                            summary.insert("role_assignments".to_string(), role_assignments.len());
                        }
                    }
                }
                Some(summary)
            });

            ScanResponse {
                scan_id: result.scan_id.clone(),
                status: result.status.clone(),
                progress: result.progress,
                message: result.message.clone(),
                summary,
            }
        })
    }

    pub async fn get_scan_data(scan_id: &str) -> Option<serde_json::Value> {
        let results = SCAN_RESULTS.read().await;
        results.get(scan_id).and_then(|result| result.data.clone())
    }

    /// テスト用: スキャン結果を直接挿入する
    #[cfg(test)]
    pub async fn insert_test_scan_data(
        scan_id: String,
        config: ScanConfig,
        data: serde_json::Value,
    ) {
        let scan_result = ScanResult {
            scan_id: scan_id.clone(),
            status: "completed".to_string(),
            progress: Some(100),
            message: Some("Test scan completed".to_string()),
            _config: config,
            data: Some(data),
        };

        SCAN_RESULTS.write().await.insert(scan_id, scan_result);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_service_exists() {
        // Verify that ScanService can be instantiated
        let _service = ScanService;
    }

    #[tokio::test]
    async fn test_scan_result_not_found() {
        // Test getting a non-existent scan result
        let non_existent_id = "non-existent-scan-id";
        let result = ScanService::get_scan_result(non_existent_id).await;

        assert!(result.is_none(), "Expected None for non-existent scan ID");
    }

    #[tokio::test]
    async fn test_scan_data_not_found() {
        // Test getting data for a non-existent scan
        let non_existent_id = "non-existent-scan-id";
        let result = ScanService::get_scan_data(non_existent_id).await;

        assert!(result.is_none(), "Expected None for non-existent scan ID");
    }

    #[tokio::test]
    async fn test_update_progress_for_nonexistent_scan() {
        // Test updating progress for a non-existent scan (should not panic)
        let non_existent_id = "non-existent-scan-id";
        ScanService::update_progress(non_existent_id, 50, "Test message".to_string()).await;

        // Verify the scan was not created
        let result = ScanService::get_scan_result(non_existent_id).await;
        assert!(result.is_none());
    }

    // Note: Full integration tests for start_scan would require:
    // - Mocked AWS/Azure scanners
    // - Test credentials
    // - LocalStack/Azurite
    // These should be added as separate integration tests
}
