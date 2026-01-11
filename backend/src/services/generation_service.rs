use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::infra::generators::terraform::TerraformGenerator;
use crate::infra::terraform::cli::TerraformCli;
use crate::models::{GenerationConfig, GenerationResponse};
use crate::services::scan_service::ScanService;

// In-memory cache for generation results (in production, use Redis or database)
pub type GenerationCache = Arc<RwLock<HashMap<String, GenerationCacheEntry>>>;

#[derive(Clone)]
pub struct GenerationCacheEntry {
    pub output_path: String,
    pub files: Vec<String>,
}

lazy_static::lazy_static! {
    pub static ref GENERATION_CACHE: GenerationCache = Arc::new(RwLock::new(HashMap::new()));
}

pub struct GenerationService;

impl GenerationService {
    pub async fn generate_terraform(
        scan_id: &str,
        config: GenerationConfig,
        selected_resources: HashMap<String, Vec<Value>>,
    ) -> Result<GenerationResponse> {
        println!(
            "[GENERATION_SERVICE] Starting generation for scan_id: {}",
            scan_id
        );
        println!(
            "[GENERATION_SERVICE] Config: output_path={}, file_split_rule={}, naming_convention={}",
            config.output_path, config.file_split_rule, config.naming_convention
        );
        println!(
            "[GENERATION_SERVICE] Selected resources: {:?}",
            selected_resources
        );

        // Get scan data
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found: {}", scan_id))?;

        println!(
            "[GENERATION_SERVICE] Scan data retrieved. Provider: {:?}",
            scan_data.get("provider")
        );

        // Generate Terraform code
        let generation_id = Uuid::new_v4().to_string();

        // Resolve output path - handle relative paths
        let output_path = if config.output_path.starts_with('/')
            || (cfg!(windows) && config.output_path.contains(':'))
        {
            // Absolute path
            PathBuf::from(&config.output_path).join(&generation_id)
        } else {
            // Relative path - resolve from current working directory or backend directory
            let base_path = if let Ok(current_dir) = std::env::current_dir() {
                // If we're in backend directory, use it; otherwise try backend subdirectory
                if current_dir.ends_with("backend") {
                    current_dir
                } else if current_dir.join("backend").exists() {
                    current_dir.join("backend")
                } else {
                    current_dir
                }
            } else {
                PathBuf::from(".")
            };
            base_path.join(&config.output_path).join(&generation_id)
        };

        println!(
            "[GENERATION_SERVICE] Creating output directory: {:?}",
            output_path
        );
        println!(
            "[GENERATION_SERVICE] Output path exists: {}",
            output_path.exists()
        );
        std::fs::create_dir_all(&output_path)
            .with_context(|| format!("Failed to create output directory: {:?}", output_path))?;

        // Verify directory was created
        if !output_path.exists() {
            return Err(anyhow::anyhow!(
                "Output directory was not created: {:?}",
                output_path
            ));
        }
        println!(
            "[GENERATION_SERVICE] Output directory created successfully: {:?}",
            output_path
        );

        println!("[GENERATION_SERVICE] Calling TerraformGenerator::generate");
        let files =
            TerraformGenerator::generate(&scan_data, &config, &selected_resources, &output_path)
                .await
                .context("Failed to generate Terraform files")?;

        println!("[GENERATION_SERVICE] Generated {} files", files.len());

        // Generate import script
        println!("[GENERATION_SERVICE] Generating import script");
        let import_script_path = TerraformGenerator::generate_import_script(
            &scan_data,
            &config,
            &selected_resources,
            &output_path,
        )
        .await
        .context("Failed to generate import script")?;

        if let Some(ref script_path) = import_script_path {
            println!(
                "[GENERATION_SERVICE] Import script generated: {}",
                script_path
            );
        } else {
            println!("[GENERATION_SERVICE] No import script generated (no resources to import)");
        }

        // Format generated Terraform files
        println!("[GENERATION_SERVICE] Formatting Terraform files with terraform fmt");
        match TerraformCli::fmt(&output_path) {
            Ok(formatted_files) => {
                if !formatted_files.is_empty() {
                    println!(
                        "[GENERATION_SERVICE] Formatted {} files:",
                        formatted_files.len()
                    );
                    for file in &formatted_files {
                        println!("[GENERATION_SERVICE]   - {}", file);
                    }
                } else {
                    println!("[GENERATION_SERVICE] All files were already formatted");
                }
            }
            Err(e) => {
                // フォーマットエラーは警告のみ（Terraformがインストールされていない環境でも動作するように）
                eprintln!(
                    "[GENERATION_SERVICE] Warning: Failed to format Terraform files: {}",
                    e
                );
                eprintln!("[GENERATION_SERVICE] Continuing without formatting. Please run 'terraform fmt' manually if needed.");
            }
        }

        // Generate preview: read first 1000 characters of each generated file
        println!(
            "[GENERATION_SERVICE] Generating preview for {} files",
            files.len()
        );
        let mut preview = std::collections::HashMap::new();
        for file_path in &files {
            let full_path = output_path.join(file_path);
            println!(
                "[GENERATION_SERVICE] Reading preview for file: {:?}",
                full_path
            );
            if full_path.exists() && full_path.is_file() {
                match std::fs::read_to_string(&full_path) {
                    Ok(content) => {
                        // Limit preview to first 1000 characters (not bytes)
                        let preview_content = Self::truncate_to_chars(&content, 1000);
                        let preview_len = preview_content.len();
                        preview.insert(file_path.clone(), preview_content);
                        println!(
                            "[GENERATION_SERVICE] Preview generated for {} ({} chars)",
                            file_path, preview_len
                        );
                    }
                    Err(e) => {
                        eprintln!(
                            "[GENERATION_SERVICE] Failed to read file for preview: {:?}, error: {}",
                            full_path, e
                        );
                    }
                }
            } else {
                eprintln!(
                    "[GENERATION_SERVICE] File does not exist for preview: {:?}",
                    full_path
                );
            }
        }

        // Also include import script in preview if it exists
        if let Some(ref script_path) = import_script_path {
            let full_path = output_path.join(script_path);
            println!(
                "[GENERATION_SERVICE] Reading preview for import script: {:?}",
                full_path
            );
            if full_path.exists() && full_path.is_file() {
                match std::fs::read_to_string(&full_path) {
                    Ok(content) => {
                        // Limit preview to first 1000 characters (not bytes)
                        let preview_content = Self::truncate_to_chars(&content, 1000);
                        let preview_len = preview_content.len();
                        preview.insert(script_path.clone(), preview_content);
                        println!(
                            "[GENERATION_SERVICE] Preview generated for import script ({} chars)",
                            preview_len
                        );
                    }
                    Err(e) => {
                        eprintln!("[GENERATION_SERVICE] Failed to read import script for preview: {:?}, error: {}", full_path, e);
                    }
                }
            } else {
                eprintln!(
                    "[GENERATION_SERVICE] Import script does not exist for preview: {:?}",
                    full_path
                );
            }
        }

        println!(
            "[GENERATION_SERVICE] Preview generation complete. {} files in preview",
            preview.len()
        );

        Ok(GenerationResponse {
            generation_id,
            output_path: output_path.to_string_lossy().to_string(),
            files,
            import_script_path,
            preview: Some(preview),
        })
    }

    pub async fn create_zip(output_path: &str, generation_id: &str) -> Result<Vec<u8>> {
        use zip::write::{FileOptions, ZipWriter};
        use zip::CompressionMethod;

        let path = PathBuf::from(output_path);

        // Check if directory exists
        if !path.exists() {
            return Err(anyhow::anyhow!(
                "Output directory does not exist: {}. Generation may have failed.",
                output_path
            ));
        }

        if !path.is_dir() {
            return Err(anyhow::anyhow!(
                "Output path is not a directory: {}",
                output_path
            ));
        }

        // Check if directory is empty
        let mut has_files = false;
        for entry in std::fs::read_dir(&path)? {
            let entry = entry?;
            let entry_path = entry.path();
            if entry_path.is_file() {
                has_files = true;
                break;
            } else if entry_path.is_dir() {
                // Check if subdirectory has files
                for sub_entry in std::fs::read_dir(&entry_path)? {
                    let sub_entry = sub_entry?;
                    if sub_entry.path().is_file() {
                        has_files = true;
                        break;
                    }
                }
                if has_files {
                    break;
                }
            }
        }

        if !has_files {
            return Err(anyhow::anyhow!(
                "No files were generated. The output directory is empty: {}. Please check if generation completed successfully.",
                output_path
            ));
        }

        let mut zip_data = Vec::new();
        {
            let mut zip = ZipWriter::new(std::io::Cursor::new(&mut zip_data));
            let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

            Self::add_directory_to_zip(&mut zip, &path, &path, options)?;

            zip.finish()?;
        }

        // Verify ZIP file is not empty
        if zip_data.is_empty() {
            return Err(anyhow::anyhow!(
                "Failed to create ZIP file: no data was written. Generation ID: {}",
                generation_id
            ));
        }

        Ok(zip_data)
    }

    /// Truncate a string to a maximum number of characters, ensuring we don't slice in the middle of a UTF-8 character.
    /// This prevents panics when slicing multi-byte UTF-8 characters (e.g., Japanese text).
    fn truncate_to_chars(s: &str, max_chars: usize) -> String {
        let char_count = s.chars().count();
        if char_count <= max_chars {
            return s.to_string();
        }

        // Find the byte index of the character at position max_chars
        // This ensures we slice at a character boundary, not in the middle of a multi-byte character
        let mut char_count = 0;
        let mut byte_index = 0;
        for (idx, _) in s.char_indices() {
            if char_count >= max_chars {
                byte_index = idx;
                break;
            }
            char_count += 1;
        }

        // If we didn't find a break point (shouldn't happen), return the full string
        if byte_index == 0 {
            s.to_string()
        } else {
            format!("{}...", &s[..byte_index])
        }
    }

    fn add_directory_to_zip(
        zip: &mut zip::ZipWriter<std::io::Cursor<&mut Vec<u8>>>,
        dir: &PathBuf,
        base: &PathBuf,
        options: zip::write::FileOptions,
    ) -> Result<()> {
        use std::io::{Read, Write};

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.strip_prefix(base)
                .map_err(|_| anyhow::anyhow!(
                    "Path {:?} is not a child of base path {:?}. This may occur due to symbolic links or filesystem issues.",
                    path, base
                ))?
                .to_string_lossy()
                .replace('\\', "/");

            if path.is_file() {
                zip.start_file(&name, options)?;
                let mut file = std::fs::File::open(&path)?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                zip.write_all(&buffer)?;
            } else if path.is_dir() {
                zip.add_directory(&name, options)?;
                Self::add_directory_to_zip(zip, &path, base, options)?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ScanConfig;
    use crate::services::scan_service::ScanService;
    use serde_json::json;
    use std::collections::HashMap;
    use tempfile::TempDir;

    // テストデータの作成ヘルパー
    fn create_test_scan_data() -> Value {
        json!({
            "provider": "aws",
            "users": [
                {
                    "user_name": "test-user",
                    "arn": "arn:aws:iam::123456789012:user/test-user",
                    "user_id": "AIDAEXAMPLE",
                    "create_date": "2023-01-01T00:00:00Z"
                }
            ],
            "groups": [
                {
                    "group_name": "test-group",
                    "arn": "arn:aws:iam::123456789012:group/test-group",
                    "group_id": "AGPAEXAMPLE",
                    "create_date": "2023-01-01T00:00:00Z"
                }
            ],
            "roles": [
                {
                    "role_name": "test-role",
                    "arn": "arn:aws:iam::123456789012:role/test-role",
                    "role_id": "AROAEXAMPLE",
                    "create_date": "2023-01-01T00:00:00Z",
                    "assume_role_policy_document": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"lambda.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"
                }
            ],
            "policies": [
                {
                    "policy_name": "test-policy",
                    "arn": "arn:aws:iam::123456789012:policy/test-policy",
                    "policy_id": "ANPAEXAMPLE",
                    "description": "Test policy",
                    "create_date": "2023-01-01T00:00:00Z",
                    "policy_document": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Sid": "TestStatement",
                                "Effect": "Allow",
                                "Action": ["s3:GetObject"],
                                "Resource": ["arn:aws:s3:::test-bucket/*"]
                            }
                        ]
                    }
                }
            ]
        })
    }

    fn create_test_config(output_path: &str) -> GenerationConfig {
        GenerationConfig {
            output_path: output_path.to_string(),
            file_split_rule: "single".to_string(),
            naming_convention: "snake_case".to_string(),
            generate_readme: true,
            import_script_format: "sh".to_string(),
            selected_resources: HashMap::new(),
        }
    }

    // ========================================
    // truncate_to_chars のテスト
    // ========================================

    #[test]
    fn test_truncate_to_chars_short_string() {
        let input = "Hello World";
        let result = GenerationService::truncate_to_chars(input, 100);
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn test_truncate_to_chars_exact_length() {
        let input = "Hello";
        let result = GenerationService::truncate_to_chars(input, 5);
        assert_eq!(result, "Hello");
    }

    #[test]
    fn test_truncate_to_chars_long_string() {
        let input = "Hello World, this is a test string";
        let result = GenerationService::truncate_to_chars(input, 10);
        assert_eq!(result, "Hello Worl...");
    }

    #[test]
    fn test_truncate_to_chars_multibyte_characters() {
        // 日本語のマルチバイト文字のテスト
        let input = "こんにちは世界";
        let result = GenerationService::truncate_to_chars(input, 5);
        // "こんにちは" の5文字 + "..."
        assert_eq!(result, "こんにちは...");
    }

    #[test]
    fn test_truncate_to_chars_mixed_characters() {
        let input = "Hello世界";
        let result = GenerationService::truncate_to_chars(input, 6);
        assert_eq!(result, "Hello世...");
    }

    // ========================================
    // create_zip のテスト
    // ========================================

    #[tokio::test]
    async fn test_create_zip_success() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        // テストファイルを作成
        std::fs::write(
            temp_dir.path().join("test.tf"),
            "resource \"aws_iam_user\" \"test\" {}",
        )
        .unwrap();

        let result = GenerationService::create_zip(output_path, "test-id").await;
        assert!(result.is_ok());

        let zip_data = result.unwrap();
        assert!(!zip_data.is_empty());
    }

    #[tokio::test]
    async fn test_create_zip_directory_not_exists() {
        let result = GenerationService::create_zip("/nonexistent/path", "test-id").await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Output directory does not exist"));
    }

    #[tokio::test]
    async fn test_create_zip_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let result = GenerationService::create_zip(output_path, "test-id").await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No files were generated"));
    }

    #[tokio::test]
    async fn test_create_zip_not_a_directory() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "test").unwrap();

        let result = GenerationService::create_zip(file_path.to_str().unwrap(), "test-id").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not a directory"));
    }

    // ========================================
    // generate_terraform のテスト
    // ========================================

    #[tokio::test]
    async fn test_generate_terraform_success() {
        // テスト用のスキャンデータを準備
        let scan_id = "test-scan-id";
        let scan_data = create_test_scan_data();

        let config = ScanConfig {
            provider: "aws".to_string(),
            account_id: None,
            profile: None,
            assume_role_arn: None,
            assume_role_session_name: None,
            subscription_id: None,
            tenant_id: None,
            auth_method: None,
            service_principal_config: None,
            scope_type: None,
            scope_value: None,
            scan_targets: HashMap::new(),
            filters: HashMap::new(),
        };

        // スキャン結果を登録
        ScanService::insert_test_scan_data(scan_id.to_string(), config, scan_data).await;

        // 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let gen_config = create_test_config(output_path);
        let selected_resources = HashMap::new(); // 全リソースを選択

        // Terraform生成を実行
        let result =
            GenerationService::generate_terraform(scan_id, gen_config, selected_resources).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(!response.generation_id.is_empty());
        assert!(!response.files.is_empty());
        assert!(response.preview.is_some());

        // 生成されたファイルが存在することを確認
        for file in &response.files {
            let file_path = PathBuf::from(&response.output_path).join(file);
            assert!(
                file_path.exists(),
                "Generated file should exist: {:?}",
                file_path
            );
        }
    }

    #[tokio::test]
    async fn test_generate_terraform_scan_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let gen_config = create_test_config(output_path);
        let selected_resources = HashMap::new();

        let result = GenerationService::generate_terraform(
            "nonexistent-scan-id",
            gen_config,
            selected_resources,
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Scan not found"));
    }

    #[tokio::test]
    async fn test_generate_terraform_with_selected_resources() {
        // テスト用のスキャンデータを準備
        let scan_id = "test-scan-selected";
        let scan_data = create_test_scan_data();

        let config = ScanConfig {
            provider: "aws".to_string(),
            account_id: None,
            profile: None,
            assume_role_arn: None,
            assume_role_session_name: None,
            subscription_id: None,
            tenant_id: None,
            auth_method: None,
            service_principal_config: None,
            scope_type: None,
            scope_value: None,
            scan_targets: HashMap::new(),
            filters: HashMap::new(),
        };

        ScanService::insert_test_scan_data(scan_id.to_string(), config, scan_data).await;

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let gen_config = create_test_config(output_path);

        // 特定のリソースのみを選択
        let mut selected_resources = HashMap::new();
        selected_resources.insert("users".to_string(), vec![json!("test-user")]);

        let result =
            GenerationService::generate_terraform(scan_id, gen_config, selected_resources).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(!response.files.is_empty());

        // usersファイルのみが生成されることを確認
        let users_file_exists = response.files.iter().any(|f| f.contains("users"));
        assert!(users_file_exists, "Users file should be generated");
    }

    #[tokio::test]
    async fn test_generate_terraform_preview_generation() {
        let scan_id = "test-scan-preview";
        let scan_data = create_test_scan_data();

        let config = ScanConfig {
            provider: "aws".to_string(),
            account_id: None,
            profile: None,
            assume_role_arn: None,
            assume_role_session_name: None,
            subscription_id: None,
            tenant_id: None,
            auth_method: None,
            service_principal_config: None,
            scope_type: None,
            scope_value: None,
            scan_targets: HashMap::new(),
            filters: HashMap::new(),
        };

        ScanService::insert_test_scan_data(scan_id.to_string(), config, scan_data).await;

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let gen_config = create_test_config(output_path);
        let selected_resources = HashMap::new();

        let result =
            GenerationService::generate_terraform(scan_id, gen_config, selected_resources).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.preview.is_some());

        let preview = response.preview.unwrap();
        assert!(!preview.is_empty());

        // プレビューの内容が1000文字以内であることを確認
        for (file_name, content) in preview {
            assert!(
                content.len() <= 1003,
                "Preview for {} should be <= 1000 chars + '...'",
                file_name
            );
        }
    }

    #[tokio::test]
    async fn test_generate_terraform_with_readme() {
        let scan_id = "test-scan-readme";
        let scan_data = create_test_scan_data();

        let config = ScanConfig {
            provider: "aws".to_string(),
            account_id: None,
            profile: None,
            assume_role_arn: None,
            assume_role_session_name: None,
            subscription_id: None,
            tenant_id: None,
            auth_method: None,
            service_principal_config: None,
            scope_type: None,
            scope_value: None,
            scan_targets: HashMap::new(),
            filters: HashMap::new(),
        };

        ScanService::insert_test_scan_data(scan_id.to_string(), config, scan_data).await;

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let mut gen_config = create_test_config(output_path);
        gen_config.generate_readme = true;

        let selected_resources = HashMap::new();

        let result =
            GenerationService::generate_terraform(scan_id, gen_config, selected_resources).await;

        assert!(result.is_ok());

        let response = result.unwrap();

        // README.mdが生成されたことを確認
        let readme_exists = response.files.iter().any(|f| f == "README.md");
        assert!(readme_exists, "README.md should be generated");

        // README.mdファイルが実際に存在することを確認
        let readme_path = PathBuf::from(&response.output_path).join("README.md");
        assert!(readme_path.exists(), "README.md file should exist");
    }

    #[tokio::test]
    async fn test_generate_terraform_import_script_generation() {
        let scan_id = "test-scan-import";
        let scan_data = create_test_scan_data();

        let config = ScanConfig {
            provider: "aws".to_string(),
            account_id: None,
            profile: None,
            assume_role_arn: None,
            assume_role_session_name: None,
            subscription_id: None,
            tenant_id: None,
            auth_method: None,
            service_principal_config: None,
            scope_type: None,
            scope_value: None,
            scan_targets: HashMap::new(),
            filters: HashMap::new(),
        };

        ScanService::insert_test_scan_data(scan_id.to_string(), config, scan_data).await;

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        let gen_config = create_test_config(output_path);
        let selected_resources = HashMap::new();

        let result =
            GenerationService::generate_terraform(scan_id, gen_config, selected_resources).await;

        assert!(result.is_ok());

        let response = result.unwrap();

        // インポートスクリプトが生成されたことを確認
        assert!(response.import_script_path.is_some());

        let import_script_path = response.import_script_path.unwrap();
        assert_eq!(import_script_path, "import.sh");

        // インポートスクリプトファイルが実際に存在することを確認
        let script_path = PathBuf::from(&response.output_path).join(&import_script_path);
        assert!(script_path.exists(), "Import script should exist");

        // スクリプトの内容を確認
        let script_content = std::fs::read_to_string(script_path).unwrap();
        assert!(script_content.contains("#!/bin/bash"));
        assert!(script_content.contains("terraform import"));
    }
}
