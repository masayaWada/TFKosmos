use axum::{
    extract::Path,
    http::StatusCode,
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::GenerationResponse;
use crate::services::generation_service::GenerationService;

// In-memory cache for generation results (in production, use Redis or database)
type GenerationCache = Arc<RwLock<std::collections::HashMap<String, GenerationCacheEntry>>>;

#[derive(Clone)]
struct GenerationCacheEntry {
    output_path: String,
    files: Vec<String>,
}

lazy_static::lazy_static! {
    static ref GENERATION_CACHE: GenerationCache = Arc::new(RwLock::new(std::collections::HashMap::new()));
}

pub fn router() -> Router {
    Router::new()
        .route("/terraform", post(generate_terraform))
        .route("/:generation_id/download", get(download_generated_files))
}

#[derive(serde::Deserialize)]
struct GenerateTerraformRequest {
    scan_id: String,
    config: crate::models::GenerationConfig,
    selected_resources: std::collections::HashMap<String, Vec<serde_json::Value>>,
}

async fn generate_terraform(
    Json(request): Json<GenerateTerraformRequest>,
) -> Result<Json<GenerationResponse>, (StatusCode, Json<Value>)> {
    match GenerationService::generate_terraform(
        &request.scan_id,
        request.config,
        request.selected_resources,
    )
    .await
    {
        Ok(result) => {
            // Store result in cache
            let cache_entry = GenerationCacheEntry {
                output_path: result.output_path.clone(),
                files: result.files.clone(),
            };
            GENERATION_CACHE
                .write()
                .await
                .insert(result.generation_id.clone(), cache_entry);

            Ok(Json(result))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn download_generated_files(
    Path(generation_id): Path<String>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let cache_entry = GENERATION_CACHE.read().await.get(&generation_id).cloned();

    let entry = cache_entry.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "detail": "Generation result not found" })),
        )
    })?;

    match GenerationService::create_zip(&entry.output_path, &generation_id).await {
        Ok(zip_data) => {
            use axum::body::Body;

            let response = Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/zip")
                .header(
                    "Content-Disposition",
                    format!(
                        "attachment; filename=\"terraform-output-{}.zip\"",
                        generation_id
                    ),
                )
                .body(Body::from(zip_data))
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "detail": format!("Failed to build response: {}", e) })),
                    )
                })?;

            Ok(response)
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": format!("Failed to create ZIP: {}", e) })),
        )),
    }
}
