use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

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

async fn list_templates() -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::list_templates().await {
        Ok(templates) => Ok(Json(json!({ "templates": templates }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

#[derive(Deserialize)]
struct GetTemplateQuery {
    source: Option<String>,
}

async fn get_template(
    Path(template_name): Path<String>,
    Query(params): Query<GetTemplateQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::get_template(&template_name, params.source.as_deref()).await {
        Ok(template) => Ok(Json(template)),
        Err(e) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

#[derive(serde::Deserialize)]
struct CreateTemplateRequest {
    content: String,
}

async fn create_template(
    Path(template_name): Path<String>,
    Json(request): Json<CreateTemplateRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::create_template(&template_name, &request.content).await {
        Ok(_) => Ok(Json(json!({ "message": "Template created successfully" }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn update_template(
    Path(template_name): Path<String>,
    Json(request): Json<CreateTemplateRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::create_template(&template_name, &request.content).await {
        Ok(_) => Ok(Json(json!({ "message": "Template updated successfully" }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn delete_template(
    Path(template_name): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::delete_template(&template_name).await {
        Ok(_) => Ok(Json(json!({ "message": "Template deleted successfully" }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
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
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match TemplateService::preview_template(&template_name, &request.content, request.context).await {
        Ok(preview) => Ok(Json(json!({ "preview": preview }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}
