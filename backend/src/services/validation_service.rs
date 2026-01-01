use anyhow::Result;
use std::path::PathBuf;

use crate::infra::terraform::{TerraformCli, FormatResult, ValidationResult, TerraformVersion};

pub struct ValidationService;

impl ValidationService {
    /// Terraform CLIの利用可能性をチェック
    pub fn check_terraform() -> TerraformVersion {
        TerraformCli::version().unwrap_or(TerraformVersion {
            version: String::new(),
            available: false,
        })
    }

    /// 生成されたTerraformコードを検証
    pub async fn validate_generation(generation_id: &str) -> Result<ValidationResult> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!(
                "Generation output not found: {}",
                generation_id
            ));
        }

        // terraform init
        TerraformCli::init(&output_dir)?;

        // terraform validate
        TerraformCli::validate(&output_dir)
    }

    /// フォーマットチェック
    pub async fn check_format(generation_id: &str) -> Result<FormatResult> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!(
                "Generation output not found: {}",
                generation_id
            ));
        }

        TerraformCli::fmt_check(&output_dir)
    }

    /// 自動フォーマット
    pub async fn format_code(generation_id: &str) -> Result<Vec<String>> {
        let output_dir = PathBuf::from(format!("./terraform-output/{}", generation_id));

        if !output_dir.exists() {
            return Err(anyhow::anyhow!(
                "Generation output not found: {}",
                generation_id
            ));
        }

        TerraformCli::fmt(&output_dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[tokio::test]
    async fn test_check_terraform() {
        let result = ValidationService::check_terraform();
        assert!(result.available);
        assert!(!result.version.is_empty());
        println!("Terraform available: version {}", result.version);
    }

    #[tokio::test]
    async fn test_validate_generation_success() {
        // テスト用のディレクトリが存在する場合のみ実行
        let test_dir = "./terraform-output/test-validation";
        if std::path::Path::new(test_dir).exists() {
            let result = ValidationService::validate_generation("test-validation").await;
            assert!(result.is_ok());
            let validation_result = result.unwrap();
            assert!(validation_result.valid);
            println!("Validation successful");
        } else {
            println!("Test directory not found, skipping test");
        }
    }

    #[tokio::test]
    async fn test_validate_generation_not_found() {
        let result = ValidationService::validate_generation("non-existent-id").await;
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("not found"));
    }

    #[tokio::test]
    async fn test_check_format_success() {
        // テスト用のディレクトリが存在する場合のみ実行
        let test_dir = "./terraform-output/test-validation";
        if std::path::Path::new(test_dir).exists() {
            let result = ValidationService::check_format("test-validation").await;
            assert!(result.is_ok());
            let format_result = result.unwrap();
            // フォーマットされているはず
            assert!(format_result.formatted);
            println!("Format check successful: formatted = {}", format_result.formatted);
        } else {
            println!("Test directory not found, skipping test");
        }
    }

    #[tokio::test]
    async fn test_format_code_with_unformatted_file() {
        // 一時的なテストディレクトリを作成
        let test_id = format!("test-format-{}", uuid::Uuid::new_v4());
        let test_dir = format!("./terraform-output/{}", test_id);
        fs::create_dir_all(&test_dir).unwrap();

        // フォーマットされていないTerraformファイルを作成
        let unformatted = r#"resource "null_resource" "test" {
triggers = {
value = "test"
}
}
"#;
        let mut file = fs::File::create(format!("{}/main.tf", test_dir)).unwrap();
        file.write_all(unformatted.as_bytes()).unwrap();

        // フォーマット実行
        let result = ValidationService::format_code(&test_id).await;
        assert!(result.is_ok());
        let files_formatted = result.unwrap();
        assert!(!files_formatted.is_empty());
        println!("Formatted files: {:?}", files_formatted);

        // クリーンアップ
        let _ = fs::remove_dir_all(&test_dir);
    }
}
