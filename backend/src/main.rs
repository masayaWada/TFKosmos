use axum::http::HeaderValue;
use axum::{http::Method, response::Json, routing::get, Router};
use serde_json::{json, Value};
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

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
    // Note: allow_credentials(true)とallow_headers(Any)は同時に使用できないため、
    // 具体的なヘッダーを指定する必要があります
    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:5173"
                .parse::<HeaderValue>()
                .expect("Failed to parse CORS origin header: http://localhost:5173"),
        )
        .allow_origin(
            "http://localhost:3000"
                .parse::<HeaderValue>()
                .expect("Failed to parse CORS origin header: http://localhost:3000"),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

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
