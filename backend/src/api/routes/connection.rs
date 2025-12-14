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
    #[serde(default)]
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
    #[serde(default)]
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
) -> Result<Json<ConnectionTestResponse>, (StatusCode, Json<Value>)> {
    match ConnectionService::test_aws_connection(
        request.profile.clone(),
        request.assume_role_arn.clone(),
        request.assume_role_session_name.clone(),
    )
    .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}

async fn test_azure_connection(
    Json(request): Json<AzureConnectionRequest>,
) -> Result<Json<ConnectionTestResponse>, (StatusCode, Json<Value>)> {
    match ConnectionService::test_azure_connection(
        request.auth_method.clone(),
        request.tenant_id.clone(),
        request.service_principal_config.clone(),
    )
    .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
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
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
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

    match ConnectionService::list_azure_subscriptions(
        params.auth_method,
        params.tenant_id,
        service_principal_config,
    )
    .await
    {
        Ok(subscriptions) => Ok(Json(json!({ "subscriptions": subscriptions }))),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
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
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
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

    match ConnectionService::list_azure_resource_groups(
        params.subscription_id,
        params.auth_method,
        params.tenant_id,
        service_principal_config,
    )
    .await
    {
        Ok(resource_groups) => Ok(Json(json!({ "resource_groups": resource_groups }))),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": e.to_string() })),
        )),
    }
}
