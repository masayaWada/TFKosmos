use axum::{
    extract::Path,
    http::StatusCode,
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::Value;
use tracing::{debug, info, warn};

use crate::api::error::ApiError;
use crate::models::GenerationResponse;
use crate::services::generation_service::{GenerationService, GENERATION_CACHE};
use crate::services::validation_service::ValidationService;

pub fn router() -> Router {
    Router::new()
        .route("/terraform", post(generate_terraform))
        .route("/terraform/check", get(check_terraform))
        .route("/:generation_id/download", get(download_generated_files))
        .route("/:generation_id/validate", post(validate_generation))
        .route("/:generation_id/format/check", get(check_format))
        .route("/:generation_id/format", post(format_code))
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
) -> Result<Json<GenerationResponse>, ApiError> {
    info!(scan_id = %request.scan_id, "Received generation request");
    debug!(config = ?request.config, "Generation config");
    debug!(selected_resources = ?request.selected_resources, "Selected resources");

    // Convert selected_resources from HashMap<String, Value> to HashMap<String, Vec<Value>>
    // Value can be either an array of strings (IDs) or an array of objects
    let mut selected_resources_converted: std::collections::HashMap<String, Vec<Value>> =
        std::collections::HashMap::new();
    for (resource_type, value) in request.selected_resources {
        if let Some(array) = value.as_array() {
            selected_resources_converted.insert(resource_type, array.clone());
        } else if let Some(id_str) = value.as_str() {
            // Single string ID
            selected_resources_converted
                .insert(resource_type, vec![Value::String(id_str.to_string())]);
        }
    }

    debug!(converted = ?selected_resources_converted, "Converted selected resources");

    match GenerationService::generate_terraform(
        &request.scan_id,
        request.config,
        selected_resources_converted,
    )
    .await
    {
        Ok(result) => {
            info!(
                generation_id = %result.generation_id,
                files_count = result.files.len(),
                "Generation successful"
            );

            // Store result in cache
            let cache_entry = crate::services::generation_service::GenerationCacheEntry {
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
            warn!(error = %error_msg, "Generation failed");

            // Log error chain for debugging
            let mut error_chain = Vec::new();
            let mut current_error: &dyn std::error::Error = e.as_ref();
            error_chain.push(current_error.to_string());
            while let Some(source) = current_error.source() {
                error_chain.push(source.to_string());
                current_error = source;
            }
            debug!(error_chain = ?error_chain, "Error chain");

            Err(ApiError::Internal(error_msg))
        }
    }
}

async fn download_generated_files(
    Path(generation_id): Path<String>,
) -> Result<Response, ApiError> {
    let cache_entry = GENERATION_CACHE.read().await.get(&generation_id).cloned();

    let entry = cache_entry.ok_or_else(|| {
        ApiError::NotFound(format!(
            "Generation result with ID '{}' not found",
            generation_id
        ))
    })?;

    match GenerationService::create_zip(&entry.output_path, &generation_id).await {
        Ok(zip_data) => {
            use axum::body::Body;

            Response::builder()
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
                .map_err(|e| ApiError::Internal(format!("Failed to build response: {}", e)))
        }
        Err(e) => Err(ApiError::Internal(format!("Failed to create ZIP: {}", e))),
    }
}

async fn check_terraform() -> Result<Json<Value>, ApiError> {
    let version = ValidationService::check_terraform();
    Ok(Json(serde_json::json!({
        "available": version.available,
        "version": version.version
    })))
}

async fn validate_generation(
    Path(generation_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    ValidationService::validate_generation(&generation_id)
        .await
        .map(|result| {
            Json(serde_json::json!({
                "valid": result.valid,
                "errors": result.errors,
                "warnings": result.warnings
            }))
        })
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn check_format(Path(generation_id): Path<String>) -> Result<Json<Value>, ApiError> {
    ValidationService::check_format(&generation_id)
        .await
        .map(|result| {
            Json(serde_json::json!({
                "formatted": result.formatted,
                "diff": result.diff,
                "files_changed": result.files_changed
            }))
        })
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn format_code(Path(generation_id): Path<String>) -> Result<Json<Value>, ApiError> {
    ValidationService::format_code(&generation_id)
        .await
        .map(|files| {
            Json(serde_json::json!({
                "success": true,
                "files_formatted": files
            }))
        })
        .map_err(|e| ApiError::Internal(e.to_string()))
}
