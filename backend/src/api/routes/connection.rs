use axum::{
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::process::Command;

use crate::api::error::ApiError;
use crate::models::ConnectionTestResponse;
use crate::services::connection_service::ConnectionService;

pub fn router() -> Router {
    Router::new()
        .route("/aws/login", post(aws_login))
        .route("/aws/test", post(test_aws_connection))
        .route("/azure/test", post(test_azure_connection))
        .route("/azure/subscriptions", get(list_azure_subscriptions))
        .route("/azure/resource-groups", get(list_azure_resource_groups))
}

#[derive(Deserialize)]
struct AwsLoginRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    region: Option<String>,
}

#[derive(Deserialize)]
struct AwsConnectionRequest {
    /// プロバイダー識別子（APIリクエストの互換性のために保持）
    #[serde(default)]
    #[allow(dead_code)]
    provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    assume_role_arn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    assume_role_session_name: Option<String>,
}

async fn aws_login(
    Json(request): Json<AwsLoginRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // aws loginは対話的なコマンドのため、バックグラウンドで実行
    // ブラウザが開くまで少し時間がかかる可能性があるため、非同期で実行
    let mut cmd = Command::new("aws");
    cmd.arg("login");

    if let Some(profile) = &request.profile {
        cmd.arg("--profile").arg(profile);
    }

    if let Some(region) = &request.region {
        cmd.env("AWS_DEFAULT_REGION", region);
    }

    // 標準出力と標準エラー出力をキャプチャ
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // コマンドを非同期で実行（タイムアウトを設定）
    let output = tokio::time::timeout(std::time::Duration::from_secs(30), cmd.output()).await;

    match output {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                Ok(Json(json!({
                    "success": true,
                    "message": "aws login completed successfully. Please complete authentication in your browser.",
                    "output": stdout,
                    "stderr": stderr
                })))
            } else {
                // エラーでも、ブラウザが開いた可能性があるため、部分的な成功として扱う
                if stdout.contains("Updated profile") || stderr.contains("Updated profile") {
                    Ok(Json(json!({
                        "success": true,
                        "message": "aws login process started. Please complete authentication in your browser.",
                        "output": stdout,
                        "stderr": stderr
                    })))
                } else {
                    Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "success": false,
                            "detail": format!("aws login failed: {}", stderr)
                        })),
                    ))
                }
            }
        }
        Ok(Err(e)) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "detail": format!("Failed to execute aws login: {}", e)
            })),
        )),
        Err(_) => {
            // タイムアウト - aws loginはブラウザでの認証を待つため、タイムアウトは正常な場合がある
            Ok(Json(json!({
                "success": true,
                "message": "aws login process started. Please complete authentication in your browser. The command may still be running in the background.",
                "note": "If the browser did not open automatically, check the terminal output for the authorization URL."
            })))
        }
    }
}

#[derive(Deserialize)]
struct AzureConnectionRequest {
    /// プロバイダー識別子（APIリクエストの互換性のために保持）
    #[serde(default)]
    #[allow(dead_code)]
    provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    auth_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    service_principal_config: Option<HashMap<String, String>>,
}

async fn test_aws_connection(
    Json(request): Json<AwsConnectionRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    ConnectionService::test_aws_connection(
        request.profile.clone(),
        request.assume_role_arn.clone(),
        request.assume_role_session_name.clone(),
    )
    .await
    .map(Json)
    .map_err(|e| ApiError::ExternalService {
        service: "AWS".to_string(),
        message: e.to_string(),
    })
}

async fn test_azure_connection(
    Json(request): Json<AzureConnectionRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    ConnectionService::test_azure_connection(
        request.auth_method.clone(),
        request.tenant_id.clone(),
        request.service_principal_config.clone(),
    )
    .await
    .map(Json)
    .map_err(|e| ApiError::ExternalService {
        service: "Azure".to_string(),
        message: e.to_string(),
    })
}

#[derive(Deserialize)]
struct AzureSubscriptionsQuery {
    auth_method: Option<String>,
    tenant_id: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
}

async fn list_azure_subscriptions(
    Query(params): Query<AzureSubscriptionsQuery>,
) -> Result<Json<Value>, ApiError> {
    let service_principal_config = if params.auth_method.as_deref() == Some("service_principal")
        && params.client_id.is_some()
        && params.client_secret.is_some()
    {
        let mut config = HashMap::new();
        config.insert("client_id".to_string(), params.client_id.unwrap());
        config.insert("client_secret".to_string(), params.client_secret.unwrap());
        Some(config)
    } else {
        None
    };

    ConnectionService::list_azure_subscriptions(
        params.auth_method,
        params.tenant_id,
        service_principal_config,
    )
    .await
    .map(|subscriptions| Json(json!({ "subscriptions": subscriptions })))
    .map_err(|e| ApiError::ExternalService {
        service: "Azure".to_string(),
        message: e.to_string(),
    })
}

#[derive(Deserialize)]
struct AzureResourceGroupsQuery {
    subscription_id: String,
    auth_method: Option<String>,
    tenant_id: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
}

async fn list_azure_resource_groups(
    Query(params): Query<AzureResourceGroupsQuery>,
) -> Result<Json<Value>, ApiError> {
    let service_principal_config = if params.auth_method.as_deref() == Some("service_principal")
        && params.client_id.is_some()
        && params.client_secret.is_some()
    {
        let mut config = HashMap::new();
        config.insert("client_id".to_string(), params.client_id.unwrap());
        config.insert("client_secret".to_string(), params.client_secret.unwrap());
        Some(config)
    } else {
        None
    };

    ConnectionService::list_azure_resource_groups(
        params.subscription_id,
        params.auth_method,
        params.tenant_id,
        service_principal_config,
    )
    .await
    .map(|resource_groups| Json(json!({ "resource_groups": resource_groups })))
    .map_err(|e| ApiError::ExternalService {
        service: "Azure".to_string(),
        message: e.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum_test::TestServer;
    use serde_json::json;
    use tower::ServiceBuilder;
    use tower_http::cors::CorsLayer;

    fn create_test_app() -> Router {
        Router::new()
            .nest("/api/connection", router())
            .layer(ServiceBuilder::new().layer(CorsLayer::permissive()))
    }

    #[tokio::test]
    async fn test_aws_connection_endpoint_success() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .post("/api/connection/aws/test")
            .json(&json!({
                "profile": None::<String>,
                "assume_role_arn": None::<String>,
                "assume_role_session_name": None::<String>
            }))
            .await;

        // 実際のAWS接続が成功するかどうかは環境に依存するため、
        // レスポンスが返ってくることと、適切な構造であることを確認
        let status = response.status_code();
        let status_u16 = status.as_u16();
        // 接続成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );

        if status_u16 == 200 {
            // レスポンスが正しくConnectionTestResponse型にデシリアライズできることを確認
            // これにより、レスポンス構造が期待通りであることが保証される
            let _body: ConnectionTestResponse = response.json();
        } else {
            // エラーレスポンスの構造を確認
            let body: serde_json::Value = response.json();
            assert!(
                body.get("error").is_some(),
                "Error response should have error field"
            );
        }
    }

    #[tokio::test]
    async fn test_aws_connection_endpoint_with_profile() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .post("/api/connection/aws/test")
            .json(&json!({
                "profile": "test-profile",
                "assume_role_arn": None::<String>,
                "assume_role_session_name": None::<String>
            }))
            .await;

        let status_u16 = response.status_code().as_u16();
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }

    #[tokio::test]
    async fn test_azure_connection_endpoint() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .post("/api/connection/azure/test")
            .json(&json!({
                "auth_method": None::<String>,
                "tenant_id": None::<String>,
                "service_principal_config": None::<HashMap<String, String>>
            }))
            .await;

        let status_u16 = response.status_code().as_u16();
        // 接続成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }

    #[tokio::test]
    async fn test_azure_connection_endpoint_with_service_principal() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let mut service_principal_config = HashMap::new();
        service_principal_config.insert("client_id".to_string(), "test-client-id".to_string());
        service_principal_config.insert("client_secret".to_string(), "test-secret".to_string());

        let response = server
            .post("/api/connection/azure/test")
            .json(&json!({
                "auth_method": "service_principal",
                "tenant_id": "test-tenant-id",
                "service_principal_config": service_principal_config
            }))
            .await;

        let status_u16 = response.status_code().as_u16();
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }

    #[tokio::test]
    async fn test_list_azure_subscriptions() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .get("/api/connection/azure/subscriptions")
            .add_query_param("auth_method", "az_login")
            .await;

        let status_u16 = response.status_code().as_u16();
        // 成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );

        if status_u16 == 200 {
            let body: serde_json::Value = response.json();
            assert!(
                body.get("subscriptions").is_some(),
                "Response should have subscriptions field"
            );
        }
    }

    #[tokio::test]
    async fn test_list_azure_subscriptions_with_service_principal() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .get("/api/connection/azure/subscriptions")
            .add_query_param("auth_method", "service_principal")
            .add_query_param("client_id", "test-client-id")
            .add_query_param("client_secret", "test-secret")
            .await;

        let status_u16 = response.status_code().as_u16();
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }

    #[tokio::test]
    async fn test_list_azure_resource_groups() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .get("/api/connection/azure/resource-groups")
            .add_query_param("subscription_id", "test-subscription-id")
            .add_query_param("auth_method", "az_login")
            .await;

        let status_u16 = response.status_code().as_u16();
        // 成功（200）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 200 || status_u16 == 502,
            "Expected OK (200) or BAD_GATEWAY (502), got {}",
            status_u16
        );

        if status_u16 == 200 {
            let body: serde_json::Value = response.json();
            assert!(
                body.get("resource_groups").is_some(),
                "Response should have resource_groups field"
            );
        }
    }

    #[tokio::test]
    async fn test_list_azure_resource_groups_missing_subscription_id() {
        let app = create_test_app();
        let server = TestServer::new(app.into_make_service()).unwrap();

        let response = server
            .get("/api/connection/azure/resource-groups")
            .add_query_param("auth_method", "az_login")
            .await;

        // subscription_idが必須パラメータなので、バリデーションエラーが返る可能性がある
        let status_u16 = response.status_code().as_u16();
        // バリデーションエラー（400）または外部サービスエラー（502）のいずれか
        assert!(
            status_u16 == 400 || status_u16 == 502,
            "Expected BAD_REQUEST (400) or BAD_GATEWAY (502), got {}",
            status_u16
        );
    }
}
