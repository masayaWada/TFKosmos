use axum::{
    extract::Path,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};

use crate::api::error::ApiError;
use crate::services::scan_service::ScanService;

pub fn router() -> Router {
    Router::new()
        .route("/aws", post(scan_aws))
        .route("/azure", post(scan_azure))
        .route("/:scan_id/status", get(get_scan_status))
}

#[derive(serde::Deserialize)]
struct ScanRequest {
    config: crate::models::ScanConfig,
}

async fn scan_aws(Json(request): Json<ScanRequest>) -> Result<Json<Value>, ApiError> {
    let mut config = request.config;
    config.provider = "aws".to_string();

    match ScanService::start_scan(config).await {
        Ok(scan_id) => Ok(Json(json!({
            "scan_id": scan_id,
            "status": "in_progress"
        }))),
        Err(e) => Err(ApiError::ExternalService {
            service: "AWS".to_string(),
            message: e.to_string(),
        }),
    }
}

async fn scan_azure(Json(request): Json<ScanRequest>) -> Result<Json<Value>, ApiError> {
    let mut config = request.config;
    config.provider = "azure".to_string();

    match ScanService::start_scan(config).await {
        Ok(scan_id) => Ok(Json(json!({
            "scan_id": scan_id,
            "status": "in_progress"
        }))),
        Err(e) => Err(ApiError::ExternalService {
            service: "Azure".to_string(),
            message: e.to_string(),
        }),
    }
}

async fn get_scan_status(Path(scan_id): Path<String>) -> Result<Json<Value>, ApiError> {
    match ScanService::get_scan_result(&scan_id).await {
        Some(result) => {
            let mut response = json!({
                "scan_id": scan_id,
                "status": result.status,
                "progress": result.progress.unwrap_or(0),
                "message": result.message.clone().unwrap_or_else(|| "Scan in progress".to_string()),
            });
            if let Some(summary) = result.summary {
                response["summary"] = json!(summary);
            }
            Ok(Json(response))
        }
        None => Err(ApiError::NotFound(format!(
            "Scan with ID '{}' not found",
            scan_id
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum_test::TestServer;
    use serde_json::json;
    use std::collections::HashMap;
    use tower::ServiceBuilder;
    use tower_http::cors::CorsLayer;

    fn create_test_app() -> Router {
        Router::new()
            .nest("/api/scan", router())
            .layer(ServiceBuilder::new().layer(CorsLayer::permissive()))
    }

    #[tokio::test]
    async fn test_scan_aws_endpoint() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let mut scan_targets = HashMap::new();
        scan_targets.insert("users".to_string(), true);
        scan_targets.insert("groups".to_string(), true);

        let response = server
            .post("/api/scan/aws")
            .json(&json!({
                "config": {
                    "provider": "aws",
                    "profile": None::<String>,
                    "scan_targets": scan_targets,
                    "filters": {}
                }
            }))
            .await;

        let status = response.status_code();
        // スキャン開始成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status == StatusCode::OK || status == StatusCode::BAD_GATEWAY,
            "Expected OK or BAD_GATEWAY, got {:?}",
            status
        );

        if status == StatusCode::OK {
            let body: serde_json::Value = response.json();
            assert!(
                body.get("scan_id").is_some(),
                "Response should have scan_id field"
            );
            assert_eq!(
                body.get("status").and_then(|s| s.as_str()),
                Some("in_progress"),
                "Status should be 'in_progress'"
            );
        }
    }

    #[tokio::test]
    async fn test_scan_aws_endpoint_with_profile() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let mut scan_targets = HashMap::new();
        scan_targets.insert("users".to_string(), true);

        let response = server
            .post("/api/scan/aws")
            .json(&json!({
                "config": {
                    "provider": "aws",
                    "profile": "test-profile",
                    "scan_targets": scan_targets,
                    "filters": {}
                }
            }))
            .await;

        let status_u16 = response.status_code().as_u16();
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }

    #[tokio::test]
    async fn test_scan_azure_endpoint() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let mut scan_targets = HashMap::new();
        scan_targets.insert("role_definitions".to_string(), true);
        scan_targets.insert("role_assignments".to_string(), true);

        let response = server
            .post("/api/scan/azure")
            .json(&json!({
                "config": {
                    "provider": "azure",
                    "subscription_id": "test-subscription-id",
                    "auth_method": "az_login",
                    "scan_targets": scan_targets,
                    "filters": {}
                }
            }))
            .await;

        let status_u16 = response.status_code().as_u16();
        // スキャン開始成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );

        if status_u16 == 200 {
            let body: serde_json::Value = response.json();
            assert!(
                body.get("scan_id").is_some(),
                "Response should have scan_id field"
            );
            assert_eq!(
                body.get("status").and_then(|s| s.as_str()),
                Some("in_progress"),
                "Status should be 'in_progress'"
            );
        }
    }

    #[tokio::test]
    async fn test_get_scan_status_not_found() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let non_existent_scan_id = "00000000-0000-0000-0000-000000000000";

        let response = server
            .get(&format!("/api/scan/{}/status", non_existent_scan_id))
            .await;

        let status_u16 = response.status_code().as_u16();
        assert_eq!(
            status_u16, 404,
            "Expected NOT_FOUND (404) for non-existent scan_id, got {}",
            status_u16
        );

        let body: serde_json::Value = response.json();
        assert!(
            body.get("error").is_some(),
            "Error response should have error field"
        );
    }

    #[tokio::test]
    async fn test_get_scan_status_after_start() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let mut scan_targets = HashMap::new();
        scan_targets.insert("users".to_string(), true);

        // スキャンを開始
        let start_response = server
            .post("/api/scan/aws")
            .json(&json!({
                "config": {
                    "provider": "aws",
                    "scan_targets": scan_targets,
                    "filters": {}
                }
            }))
            .await;

        // スキャンが開始された場合のみ、ステータスを確認
        if start_response.status_code().as_u16() == 200 {
            let start_body: serde_json::Value = start_response.json();
            if let Some(scan_id) = start_body.get("scan_id").and_then(|id| id.as_str()) {
                // 少し待ってからステータスを取得
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                let status_response = server.get(&format!("/api/scan/{}/status", scan_id)).await;

                let status_u16 = status_response.status_code().as_u16();
                // スキャンが見つかった場合（200）またはまだ見つからない場合（404）
                assert!(
                    status_u16 == 200 || status_u16 == 404,
                    "Expected OK (200) or NOT_FOUND (404), got {}",
                    status_u16
                );

                if status_u16 == 200 {
                    let status_body: serde_json::Value = status_response.json();
                    assert!(
                        status_body.get("scan_id").is_some(),
                        "Status response should have scan_id field"
                    );
                    assert!(
                        status_body.get("status").is_some(),
                        "Status response should have status field"
                    );
                }
            }
        }
    }
}
