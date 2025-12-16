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
    #[serde(default)]
    selected_resources: std::collections::HashMap<String, serde_json::Value>,
}

async fn generate_terraform(
    Json(request): Json<GenerateTerraformRequest>,
) -> Result<Json<GenerationResponse>, (StatusCode, Json<Value>)> {
    println!("[API] Received generation request for scan_id: {}", request.scan_id);
    println!("[API] Config: {:?}", request.config);
    println!("[API] Selected resources: {:?}", request.selected_resources);
    
    // Convert selected_resources from HashMap<String, Value> to HashMap<String, Vec<Value>>
    // Value can be either an array of strings (IDs) or an array of objects
    let mut selected_resources_converted: std::collections::HashMap<String, Vec<Value>> = std::collections::HashMap::new();
    for (resource_type, value) in request.selected_resources {
        if let Some(array) = value.as_array() {
            selected_resources_converted.insert(resource_type, array.clone());
        } else if let Some(id_str) = value.as_str() {
            // Single string ID
            selected_resources_converted.insert(resource_type, vec![Value::String(id_str.to_string())]);
        }
    }
    
    println!("[API] Converted selected resources: {:?}", selected_resources_converted);
    
    match GenerationService::generate_terraform(
        &request.scan_id,
        request.config,
        selected_resources_converted,
    )
    .await
    {
        Ok(result) => {
            println!("[API] Generation successful. Generation ID: {}, Files: {:?}", 
                     result.generation_id, result.files);
            
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
        Err(e) => {
            let error_msg = e.to_string();
            eprintln!("[API] Generation failed: {}", error_msg);
            
            // Print error chain for debugging
            let mut error_chain = Vec::new();
            let mut current_error: &dyn std::error::Error = e.as_ref();
            error_chain.push(current_error.to_string());
            while let Some(source) = current_error.source() {
                error_chain.push(source.to_string());
                current_error = source;
            }
            eprintln!("[API] Error chain: {:?}", error_chain);
            
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error_msg })),
            ))
        }
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
