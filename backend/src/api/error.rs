use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// 統一されたエラーレスポンス形式
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    /// エラーコード（クライアント側での処理に使用）
    pub code: String,
    /// 人間が読めるエラーメッセージ
    pub message: String,
    /// 追加の詳細情報（オプション）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// APIエラー型
#[derive(Debug)]
pub enum ApiError {
    /// バリデーションエラー（400 Bad Request）
    Validation(String),
    /// 認証エラー（401 Unauthorized）
    #[allow(dead_code)]
    Unauthorized(String),
    /// 禁止されたアクセス（403 Forbidden）
    #[allow(dead_code)]
    Forbidden(String),
    /// リソースが見つからない（404 Not Found）
    NotFound(String),
    /// 外部サービスエラー（502 Bad Gateway）
    ExternalService { service: String, message: String },
    /// 内部サーバーエラー（500 Internal Server Error）
    Internal(String),
}

impl ApiError {
    /// エラーコードを取得
    fn code(&self) -> &'static str {
        match self {
            ApiError::Validation(_) => "VALIDATION_ERROR",
            ApiError::Unauthorized(_) => "UNAUTHORIZED",
            ApiError::Forbidden(_) => "FORBIDDEN",
            ApiError::NotFound(_) => "NOT_FOUND",
            ApiError::ExternalService { .. } => "EXTERNAL_SERVICE_ERROR",
            ApiError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    /// HTTPステータスコードを取得
    fn status_code(&self) -> StatusCode {
        match self {
            ApiError::Validation(_) => StatusCode::BAD_REQUEST,
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::Forbidden(_) => StatusCode::FORBIDDEN,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::ExternalService { .. } => StatusCode::BAD_GATEWAY,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// エラーメッセージを取得
    fn message(&self) -> String {
        match self {
            ApiError::Validation(msg) => msg.clone(),
            ApiError::Unauthorized(msg) => msg.clone(),
            ApiError::Forbidden(msg) => msg.clone(),
            ApiError::NotFound(msg) => msg.clone(),
            ApiError::ExternalService { service, message } => {
                format!("{} service error: {}", service, message)
            }
            ApiError::Internal(msg) => msg.clone(),
        }
    }

    /// 追加の詳細情報を取得
    fn details(&self) -> Option<serde_json::Value> {
        match self {
            ApiError::ExternalService { service, .. } => {
                Some(serde_json::json!({ "service": service }))
            }
            _ => None,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ErrorResponse {
            error: ErrorDetail {
                code: self.code().to_string(),
                message: self.message(),
                details: self.details(),
            },
        };

        (status, Json(body)).into_response()
    }
}

// anyhow::ErrorからApiErrorへの変換
impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        // エラーメッセージを解析してより適切なエラー型を選択
        let message = err.to_string();

        if message.contains("not found") || message.contains("Not found") {
            ApiError::NotFound(message)
        } else if message.contains("validation") || message.contains("invalid") {
            ApiError::Validation(message)
        } else if message.contains("unauthorized") || message.contains("authentication") {
            ApiError::Unauthorized(message)
        } else {
            ApiError::Internal(message)
        }
    }
}

/// 後方互換性のためのヘルパー関数（既存コードからの移行用）
/// 既存の `{ "detail": "message" }` 形式も引き続きサポート
#[allow(dead_code)]
pub fn legacy_error_response(
    status: StatusCode,
    message: impl Into<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        status,
        Json(serde_json::json!({ "detail": message.into() })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_error_status_code() {
        // Arrange
        let error = ApiError::Validation("Invalid input".to_string());

        // Act
        let status_code = error.status_code();
        let code = error.code();

        // Assert
        assert_eq!(
            status_code,
            StatusCode::BAD_REQUEST,
            "ValidationエラーはBAD_REQUESTを返すべき"
        );
        assert_eq!(
            code, "VALIDATION_ERROR",
            "Validationエラーのコードは'VALIDATION_ERROR'であるべき"
        );
    }

    #[test]
    fn test_not_found_error_status_code() {
        // Arrange
        let error = ApiError::NotFound("Resource not found".to_string());

        // Act
        let status_code = error.status_code();
        let code = error.code();

        // Assert
        assert_eq!(
            status_code,
            StatusCode::NOT_FOUND,
            "NotFoundエラーはNOT_FOUNDを返すべき"
        );
        assert_eq!(
            code, "NOT_FOUND",
            "NotFoundエラーのコードは'NOT_FOUND'であるべき"
        );
    }

    #[test]
    fn test_external_service_error_has_details() {
        // Arrange
        let error = ApiError::ExternalService {
            service: "AWS".to_string(),
            message: "Connection failed".to_string(),
        };

        // Act
        let status_code = error.status_code();
        let details = error.details();

        // Assert
        assert_eq!(
            status_code,
            StatusCode::BAD_GATEWAY,
            "ExternalServiceエラーはBAD_GATEWAYを返すべき"
        );
        assert!(
            details.is_some(),
            "ExternalServiceエラーには詳細情報が含まれるべき"
        );
    }

    #[test]
    fn test_external_service_error_message_format() {
        // Arrange
        let service = "AWS";
        let message = "Connection failed";
        let error = ApiError::ExternalService {
            service: service.to_string(),
            message: message.to_string(),
        };

        // Act
        let error_message = error.message();

        // Assert
        assert!(
            error_message.contains(service),
            "エラーメッセージにサービス名が含まれるべき"
        );
        assert!(
            error_message.contains(message),
            "エラーメッセージに元のメッセージが含まれるべき"
        );
    }

    #[test]
    fn test_anyhow_error_conversion_not_found() {
        // Arrange
        let err = anyhow::anyhow!("Resource not found");

        // Act
        let api_error: ApiError = err.into();

        // Assert
        assert!(
            matches!(api_error, ApiError::NotFound(_)),
            "'not found'を含むエラーはNotFoundに変換されるべき"
        );
    }

    #[test]
    fn test_anyhow_error_conversion_validation() {
        // Arrange
        let err = anyhow::anyhow!("validation failed: invalid input");

        // Act
        let api_error: ApiError = err.into();

        // Assert
        assert!(
            matches!(api_error, ApiError::Validation(_)),
            "'validation'を含むエラーはValidationに変換されるべき"
        );
    }

    #[test]
    fn test_anyhow_error_conversion_internal() {
        // Arrange
        let err = anyhow::anyhow!("Something went wrong");

        // Act
        let api_error: ApiError = err.into();

        // Assert
        assert!(
            matches!(api_error, ApiError::Internal(_)),
            "特定キーワードを含まないエラーはInternalに変換されるべき"
        );
    }

    #[test]
    fn test_internal_error_status_code() {
        // Arrange
        let error = ApiError::Internal("Internal server error".to_string());

        // Act
        let status_code = error.status_code();
        let code = error.code();

        // Assert
        assert_eq!(
            status_code,
            StatusCode::INTERNAL_SERVER_ERROR,
            "InternalエラーはINTERNAL_SERVER_ERRORを返すべき"
        );
        assert_eq!(
            code, "INTERNAL_ERROR",
            "Internalエラーのコードは'INTERNAL_ERROR'であるべき"
        );
    }
}
