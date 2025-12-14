use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};

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

async fn scan_aws(
    Json(request): Json<ScanRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut config = request.config;
    config.provider = "aws".to_string();

    match ScanService::start_scan(config).await {
        Ok(scan_id) => Ok(Json(json!({
            "scan_id": scan_id,
            "status": "in_progress"
        }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn scan_azure(
    Json(request): Json<ScanRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut config = request.config;
    config.provider = "azure".to_string();

    match ScanService::start_scan(config).await {
        Ok(scan_id) => Ok(Json(json!({
            "scan_id": scan_id,
            "status": "in_progress"
        }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn get_scan_status(
    Path(scan_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
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
        },
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "detail": "Scan not found" })),
        )),
    }
}
