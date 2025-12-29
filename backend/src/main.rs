use axum::{http::header, http::Method, response::Json, routing::get, Router};
use serde_json::{json, Value};
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod api;
mod config;
mod domain;
mod infra;
mod models;
mod services;

use api::routes;
use config::Config;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    // Load configuration from environment
    let config = Config::from_env();

    tracing::info!(
        environment = ?config.environment,
        "Starting TFKosmos server"
    );

    // Build CORS layer based on environment
    //
    // - 開発環境: 全オリジンを許可（開発の利便性のため）
    // - 本番環境: TFKOSMOS_CORS_ORIGINS で指定されたオリジンのみ許可
    //
    // 環境変数の例:
    //   TFKOSMOS_ENV=production
    //   TFKOSMOS_CORS_ORIGINS=https://example.com,https://app.example.com
    let cors = build_cors_layer(&config);

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
    let bind_address = config.bind_address();
    let listener = tokio::net::TcpListener::bind(&bind_address)
        .await
        .expect("Failed to bind to address");

    tracing::info!("Server listening on http://{}", bind_address);

    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}

/// 環境に応じたCORSレイヤーを構築
fn build_cors_layer(config: &Config) -> CorsLayer {
    let base_cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT]);

    if config.is_production() && !config.cors_origins.is_empty() {
        // 本番環境: 指定されたオリジンのみ許可
        let origins: Vec<_> = config
            .cors_origins
            .iter()
            .filter_map(|origin| origin.parse().ok())
            .collect();

        tracing::info!(
            origins = ?config.cors_origins,
            "CORS: Allowing specific origins only"
        );

        base_cors.allow_origin(AllowOrigin::list(origins))
    } else {
        // 開発環境 または オリジン未指定: 全オリジンを許可
        if config.is_production() {
            tracing::warn!(
                "CORS: No origins specified in production mode, allowing all origins. \
                 Set TFKOSMOS_CORS_ORIGINS to restrict access."
            );
        } else {
            tracing::info!("CORS: Development mode - allowing all origins");
        }

        base_cors.allow_origin(Any)
    }
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
