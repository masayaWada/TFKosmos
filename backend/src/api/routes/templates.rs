use axum::{
    extract::{Path, Query},
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::error::ApiError;
use crate::services::template_service::TemplateService;

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_templates))
        // Use wildcard pattern to handle template names with slashes (e.g., aws/cleanup_access_key.tf.j2)
        // Note: preview route uses a different path structure since catch-all must be at the end
        .route("/preview/*template_name", post(preview_template))
        .route("/*template_name", get(get_template))
        .route("/*template_name", put(update_template))
        .route("/*template_name", post(create_template))
        .route("/*template_name", delete(delete_template))
}

async fn list_templates() -> Result<Json<Value>, ApiError> {
    TemplateService::list_templates()
        .await
        .map(|templates| Json(json!({ "templates": templates })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

#[derive(Deserialize)]
struct GetTemplateQuery {
    source: Option<String>,
}

async fn get_template(
    Path(template_name): Path<String>,
    Query(params): Query<GetTemplateQuery>,
) -> Result<Json<Value>, ApiError> {
    TemplateService::get_template(&template_name, params.source.as_deref())
        .await
        .map(Json)
        .map_err(|e| {
            ApiError::NotFound(format!("Template '{}' not found: {}", template_name, e))
        })
}

#[derive(serde::Deserialize)]
struct CreateTemplateRequest {
    content: String,
}

async fn create_template(
    Path(template_name): Path<String>,
    Json(request): Json<CreateTemplateRequest>,
) -> Result<Json<Value>, ApiError> {
    TemplateService::create_template(&template_name, &request.content)
        .await
        .map(|_| Json(json!({ "message": "Template created successfully" })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn update_template(
    Path(template_name): Path<String>,
    Json(request): Json<CreateTemplateRequest>,
) -> Result<Json<Value>, ApiError> {
    TemplateService::create_template(&template_name, &request.content)
        .await
        .map(|_| Json(json!({ "message": "Template updated successfully" })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn delete_template(Path(template_name): Path<String>) -> Result<Json<Value>, ApiError> {
    TemplateService::delete_template(&template_name)
        .await
        .map(|_| Json(json!({ "message": "Template deleted successfully" })))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

#[derive(serde::Deserialize)]
struct PreviewTemplateRequest {
    content: String,
    #[serde(default)]
    context: Option<serde_json::Value>,
}

async fn preview_template(
    Path(template_name): Path<String>,
    Json(request): Json<PreviewTemplateRequest>,
) -> Result<Json<Value>, ApiError> {
    TemplateService::preview_template(&template_name, &request.content, request.context)
        .await
        .map(|preview| Json(json!({ "preview": preview })))
        .map_err(|e| ApiError::Validation(format!("Template preview failed: {}", e)))
}
