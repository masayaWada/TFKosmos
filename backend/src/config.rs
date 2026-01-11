use std::env;

/// アプリケーション設定
#[derive(Debug, Clone)]
pub struct Config {
    /// 実行環境（development, production）
    pub environment: Environment,
    /// サーバーがリッスンするホスト
    pub host: String,
    /// サーバーがリッスンするポート
    pub port: u16,
    /// CORS許可オリジン（カンマ区切り、空の場合は全許可）
    pub cors_origins: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Environment {
    Development,
    Production,
}

impl Config {
    /// 環境変数から設定を読み込む
    pub fn from_env() -> Self {
        let environment = match env::var("TFKOSMOS_ENV")
            .unwrap_or_else(|_| "development".to_string())
            .to_lowercase()
            .as_str()
        {
            "production" | "prod" => Environment::Production,
            _ => Environment::Development,
        };

        let host = env::var("TFKOSMOS_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

        let port = env::var("TFKOSMOS_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8000);

        // CORS許可オリジン
        // 例: TFKOSMOS_CORS_ORIGINS="http://localhost:5173,https://example.com"
        let cors_origins = env::var("TFKOSMOS_CORS_ORIGINS")
            .map(|origins| {
                origins
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_else(|_| Vec::new());

        Config {
            environment,
            host,
            port,
            cors_origins,
        }
    }

    /// 開発環境かどうか
    #[allow(dead_code)]
    pub fn is_development(&self) -> bool {
        self.environment == Environment::Development
    }

    /// 本番環境かどうか
    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }

    /// サーバーのバインドアドレス
    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            environment: Environment::Development,
            host: "0.0.0.0".to_string(),
            port: 8000,
            cors_origins: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        // Arrange & Act
        let config = Config::default();

        // Assert
        assert_eq!(
            config.environment,
            Environment::Development,
            "デフォルト環境はDevelopmentであるべき"
        );
        assert_eq!(
            config.host, "0.0.0.0",
            "デフォルトホストは0.0.0.0であるべき"
        );
        assert_eq!(config.port, 8000, "デフォルトポートは8000であるべき");
        assert!(
            config.cors_origins.is_empty(),
            "デフォルトCORSオリジンは空であるべき"
        );
    }

    #[test]
    fn test_is_development() {
        // Arrange
        let config = Config {
            environment: Environment::Development,
            ..Default::default()
        };

        // Act & Assert
        assert!(
            config.is_development(),
            "Development環境ではis_development()がtrueを返すべき"
        );
        assert!(
            !config.is_production(),
            "Development環境ではis_production()がfalseを返すべき"
        );
    }

    #[test]
    fn test_is_production() {
        // Arrange
        let config = Config {
            environment: Environment::Production,
            ..Default::default()
        };

        // Act & Assert
        assert!(
            config.is_production(),
            "Production環境ではis_production()がtrueを返すべき"
        );
        assert!(
            !config.is_development(),
            "Production環境ではis_development()がfalseを返すべき"
        );
    }

    #[test]
    fn test_bind_address() {
        // Arrange
        let config = Config {
            host: "127.0.0.1".to_string(),
            port: 3000,
            ..Default::default()
        };

        // Act
        let bind_address = config.bind_address();

        // Assert
        assert_eq!(
            bind_address, "127.0.0.1:3000",
            "バインドアドレスはhost:port形式であるべき"
        );
    }

    #[test]
    fn test_bind_address_default_values() {
        // Arrange
        let config = Config::default();

        // Act
        let bind_address = config.bind_address();

        // Assert
        assert_eq!(
            bind_address, "0.0.0.0:8000",
            "デフォルト値でのバインドアドレスは0.0.0.0:8000であるべき"
        );
    }
}
