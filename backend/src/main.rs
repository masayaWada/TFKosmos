use axum::{http::header, http::Method, response::Json, routing::get, Router};
use serde_json::{json, Value};
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod api;
mod domain;
mod infra;
mod models;
mod services;

use api::routes;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    // Build CORS layer
    //
    // - 開発時（Vite）:  フロントエンドは http://localhost:5173 からアクセス
    // - Tauri(dev/本番): フロントエンドは tauri://localhost などの独自スキームからアクセス
    //
    // どちらのケースでもバックエンドは http://localhost:8000 を使用するため、
    // CORS では Origin を絞り込まず Any を許可しています。
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT]);

    // Build application with routes
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .nest("/api/connection", routes::connection::router())
        .nest("/api/scan", routes::scan::router())
        .nest("/api/resources", routes::resources::router())
        .nest("/api/generate", routes::generate::router())
        .nest("/api/templates", routes::templates::router())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors),
        );

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to address");

    tracing::info!("Server listening on http://0.0.0.0:8000");

    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}

async fn root() -> Json<Value> {
    Json(json!({
        "message": "TFKosmos API",
        "version": "0.1.0"
    }))
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "healthy"
    }))
}
