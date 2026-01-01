use axum::{
    extract::{Path, Query},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::error::ApiError;
use crate::models::{DependencyGraph, ResourceListResponse};
use crate::services::dependency_service::DependencyService;
use crate::services::resource_service::ResourceService;

pub fn router() -> Router {
    Router::new()
        .route("/:scan_id", get(get_resources))
        .route("/:scan_id/query", post(query_resources))
        .route("/:scan_id/dependencies", get(get_dependencies))
        .route("/:scan_id/select", post(select_resources))
        .route("/:scan_id/select", get(get_selected_resources))
}

#[derive(Deserialize)]
struct GetResourcesQuery {
    #[serde(rename = "type")]
    resource_type: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
    filter: Option<String>,
}

async fn get_resources(
    Path(scan_id): Path<String>,
    Query(params): Query<GetResourcesQuery>,
) -> Result<Json<ResourceListResponse>, ApiError> {
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(50);

    let filter_conditions = if let Some(filter_str) = params.filter {
        serde_json::from_str(&filter_str).ok()
    } else {
        None
    };

    ResourceService::get_resources(
        &scan_id,
        params.resource_type.as_deref(),
        page,
        page_size,
        filter_conditions,
    )
    .await
    .map(Json)
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("not found") || msg.contains("Scan not found") {
            ApiError::NotFound(format!("Scan with ID '{}' not found", scan_id))
        } else {
            ApiError::Internal(msg)
        }
    })
}

#[derive(Deserialize)]
struct SelectResourcesRequest {
    selections: std::collections::HashMap<String, Vec<serde_json::Value>>,
}

async fn select_resources(
    Path(scan_id): Path<String>,
    Json(request): Json<SelectResourcesRequest>,
) -> Result<Json<Value>, ApiError> {
    ResourceService::update_selection(&scan_id, request.selections)
        .await
        .map(|result| Json(json!(result)))
        .map_err(|e| ApiError::Internal(e.to_string()))
}

async fn get_selected_resources(Path(scan_id): Path<String>) -> Result<Json<Value>, ApiError> {
    ResourceService::get_selection(&scan_id)
        .await
        .map(|selections| {
            Json(json!({
                "selections": selections
            }))
        })
        .map_err(|e| ApiError::Internal(e.to_string()))
}

#[derive(Deserialize)]
struct QueryResourcesRequest {
    query: String,
    #[serde(rename = "type")]
    resource_type: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
}

async fn query_resources(
    Path(scan_id): Path<String>,
    Json(request): Json<QueryResourcesRequest>,
) -> Result<Json<ResourceListResponse>, ApiError> {
    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(50);

    ResourceService::query_resources(
        &scan_id,
        &request.query,
        request.resource_type.as_deref(),
        page,
        page_size,
    )
    .await
    .map(Json)
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("構文エラー") || msg.contains("パースエラー") {
            ApiError::Validation(msg)
        } else if msg.contains("not found") {
            ApiError::NotFound(msg)
        } else {
            ApiError::Internal(msg)
        }
    })
}

#[derive(Deserialize)]
struct GetDependenciesQuery {
    root_id: Option<String>,
}

async fn get_dependencies(
    Path(scan_id): Path<String>,
    Query(params): Query<GetDependenciesQuery>,
) -> Result<Json<DependencyGraph>, ApiError> {
    DependencyService::get_dependencies(&scan_id, params.root_id.as_deref())
        .await
        .map(Json)
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") {
                ApiError::NotFound(msg)
            } else {
                ApiError::Internal(msg)
            }
        })
}
