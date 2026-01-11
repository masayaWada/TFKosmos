use crate::models::{TemplateValidationResponse, ValidationError};
use anyhow::Result;
use serde_json::{json, Value};
use std::path::PathBuf;

pub struct TemplateService;

impl TemplateService {
    pub async fn list_templates() -> Result<Vec<serde_json::Value>> {
        let default_dir = PathBuf::from("templates_default/terraform");
        let user_dir = PathBuf::from("templates_user/terraform");

        let mut template_map: std::collections::HashMap<String, serde_json::Value> =
            std::collections::HashMap::new();

        // List default templates
        if default_dir.exists() {
            Self::list_templates_in_dir(&default_dir, &default_dir, &mut template_map, false)?;
        }

        // List user templates (overrides defaults)
        if user_dir.exists() {
            Self::list_templates_in_dir(&user_dir, &user_dir, &mut template_map, true)?;
        }

        let mut templates: Vec<serde_json::Value> = template_map.into_values().collect();
        templates.sort_by(|a, b| {
            let a_type = a
                .get("resource_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let b_type = b
                .get("resource_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            a_type.cmp(b_type)
        });

        Ok(templates)
    }

    pub async fn get_template(
        template_name: &str,
        source: Option<&str>,
    ) -> Result<serde_json::Value> {
        let user_path = PathBuf::from("templates_user/terraform").join(template_name);
        let default_path = PathBuf::from("templates_default/terraform").join(template_name);

        let (content, actual_source) = match source {
            Some("user") => {
                if user_path.exists() {
                    (std::fs::read_to_string(user_path)?, "user")
                } else {
                    return Err(anyhow::anyhow!(
                        "User template not found: {}",
                        template_name
                    ));
                }
            }
            Some("default") => {
                if default_path.exists() {
                    (std::fs::read_to_string(default_path)?, "default")
                } else {
                    return Err(anyhow::anyhow!(
                        "Default template not found: {}",
                        template_name
                    ));
                }
            }
            _ => {
                // Try user first, then default
                if user_path.exists() {
                    (std::fs::read_to_string(user_path)?, "user")
                } else if default_path.exists() {
                    (std::fs::read_to_string(default_path)?, "default")
                } else {
                    return Err(anyhow::anyhow!("Template not found: {}", template_name));
                }
            }
        };

        Ok(json!({
            "resource_type": template_name,
            "source": actual_source,
            "content": content
        }))
    }

    pub async fn create_template(template_name: &str, content: &str) -> Result<()> {
        let user_dir = PathBuf::from("templates_user/terraform");
        let template_path = user_dir.join(template_name);

        // Create parent directories if needed (e.g., aws/, azure/)
        if let Some(parent) = template_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(&template_path, content)?;

        Ok(())
    }

    pub async fn delete_template(template_name: &str) -> Result<()> {
        let user_path = PathBuf::from("templates_user/terraform").join(template_name);

        if user_path.exists() {
            std::fs::remove_file(user_path)?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Template not found: {}", template_name))
        }
    }

    pub async fn preview_template(
        template_name: &str,
        template_content: &str,
        context: Option<Value>,
    ) -> Result<String> {
        // Use provided context or generate sample context based on template name
        let sample_context =
            context.unwrap_or_else(|| Self::generate_sample_context(template_name));

        // Create a temporary template file and render it
        let mut env = minijinja::Environment::new();
        env.set_trim_blocks(true);
        env.set_lstrip_blocks(true);
        env.add_template(template_name, template_content)?;
        let template = env.get_template(template_name)?;
        Ok(template.render(&sample_context)?)
    }

    /// テンプレートの構文を検証する（レンダリングは行わない）
    pub async fn validate_template(
        template_name: &str,
        template_content: &str,
    ) -> Result<TemplateValidationResponse> {
        let mut errors = Vec::new();

        // 1. Jinja2構文チェック（minijinjaでパース）
        let mut env = minijinja::Environment::new();
        env.set_trim_blocks(true);
        env.set_lstrip_blocks(true);
        if let Err(e) = env.add_template(template_name, template_content) {
            errors.push(ValidationError {
                error_type: "jinja2".to_string(),
                message: e.to_string(),
                line: e.line().map(|l| l as u32),
                column: None,
            });
        }

        // 2. レンダリングテスト（サンプルコンテキストで）
        if errors.is_empty() {
            let sample_context = Self::generate_sample_context(template_name);
            if let Err(e) = env
                .get_template(template_name)
                .and_then(|t| t.render(&sample_context))
            {
                errors.push(ValidationError {
                    error_type: "jinja2".to_string(),
                    message: format!("レンダリングエラー: {}", e),
                    line: None,
                    column: None,
                });
            }
        }

        Ok(TemplateValidationResponse {
            valid: errors.is_empty(),
            errors,
        })
    }

    fn generate_sample_context(template_name: &str) -> Value {
        // Generate sample context based on template name
        if template_name.contains("iam_user") {
            json!({
                "resource_name": "example_user",
                "user": {
                    "user_name": "example-user",
                    "path": "/",
                    "tags": {
                        "Environment": "Production",
                        "Team": "DevOps"
                    }
                }
            })
        } else if template_name.contains("iam_group") {
            json!({
                "resource_name": "example_group",
                "group": {
                    "group_name": "example-group",
                    "path": "/",
                    "tags": {
                        "Environment": "Production"
                    }
                }
            })
        } else if template_name.contains("iam_role") {
            json!({
                "resource_name": "example_role",
                "role": {
                    "role_name": "example-role",
                    "path": "/",
                    "assume_role_policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"ec2.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"
                }
            })
        } else if template_name.contains("iam_policy") {
            json!({
                "resource_name": "example_policy",
                "policy": {
                    "policy_name": "example-policy",
                    "path": "/",
                    "policy_version": "2012-10-17",
                    "statements": [
                        {
                            "sid": "AllowS3Read",
                            "effect": "Allow",
                            "actions": ["s3:GetObject", "s3:ListBucket"],
                            "resources": ["arn:aws:s3:::example-bucket/*", "arn:aws:s3:::example-bucket"]
                        }
                    ]
                }
            })
        } else if template_name.contains("role_definition") {
            json!({
                "resource_name": "example_role_definition",
                "role_definition": {
                    "role_name": "Example Role",
                    "description": "Example role definition",
                    "role_type": "CustomRole",
                    "scope": "/subscriptions/12345678-1234-1234-1234-123456789012"
                }
            })
        } else if template_name.contains("role_assignment") {
            json!({
                "resource_name": "example_role_assignment",
                "role_assignment": {
                    "assignment_id": "12345678-1234-1234-1234-123456789012",
                    "role_definition_name": "Contributor",
                    "principal_name": "user@example.com",
                    "principal_type": "User",
                    "scope": "/subscriptions/12345678-1234-1234-1234-123456789012"
                }
            })
        } else {
            json!({
                "resource_name": "example_resource",
                "resource": {
                    "name": "example",
                    "id": "123"
                }
            })
        }
    }

    fn list_templates_in_dir(
        dir: &PathBuf,
        base_dir: &PathBuf,
        template_map: &mut std::collections::HashMap<String, serde_json::Value>,
        is_user: bool,
    ) -> Result<()> {
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("j2") {
                    // Get relative path from base_dir
                    let relative_path = path
                        .strip_prefix(base_dir)
                        .map_err(|_| anyhow::anyhow!("Failed to get relative path"))?
                        .to_string_lossy()
                        .replace('\\', "/");

                    // Use relative path as resource_type (e.g., "aws/iam_user.tf.j2")
                    let resource_type = relative_path.clone();

                    // Check if user template exists
                    let user_path = PathBuf::from("templates_user/terraform").join(&relative_path);
                    let has_user_override = user_path.exists();

                    // Get default source if this is a default template
                    let default_source = if !is_user {
                        std::fs::read_to_string(&path).unwrap_or_default()
                    } else {
                        // If this is a user template, try to read default
                        let default_path =
                            PathBuf::from("templates_default/terraform").join(&relative_path);
                        if default_path.exists() {
                            std::fs::read_to_string(default_path).unwrap_or_default()
                        } else {
                            String::new()
                        }
                    };

                    // Get user source if exists
                    let user_source = if is_user {
                        Some(std::fs::read_to_string(&path).unwrap_or_default())
                    } else if has_user_override {
                        Some(std::fs::read_to_string(user_path).unwrap_or_default())
                    } else {
                        None
                    };

                    // Update or insert template info
                    template_map.insert(
                        resource_type.clone(),
                        json!({
                            "resource_type": resource_type,
                            "template_path": format!("terraform/{}", relative_path),
                            "has_user_override": has_user_override,
                            "default_source": default_source,
                            "user_source": user_source
                        }),
                    );
                } else if path.is_dir() {
                    Self::list_templates_in_dir(&path, base_dir, template_map, is_user)?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_create_template() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&user_template_dir).unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        let template_name = "test_template.tf.j2";
        let template_content = r#"resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name }}"
}"#;

        // Act
        let result = TemplateService::create_template(template_name, template_content).await;

        // Assert
        assert!(result.is_ok(), "Template should be created successfully");

        let template_path = user_template_dir.join(template_name);
        assert!(template_path.exists(), "Template file should exist");

        let saved_content = fs::read_to_string(&template_path).unwrap();
        assert_eq!(
            saved_content, template_content,
            "Saved content should match"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_create_template_with_subdirectory() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&user_template_dir).unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        let template_name = "aws/iam_user.tf.j2";
        let template_content = r#"resource "aws_iam_user" "{{ resource_name }}" {}"#;

        // Act
        let result = TemplateService::create_template(template_name, template_content).await;

        // Assert
        assert!(result.is_ok(), "Template should be created successfully");

        let template_path = user_template_dir.join("aws/iam_user.tf.j2");
        assert!(
            template_path.exists(),
            "Template file should exist in subdirectory"
        );

        let saved_content = fs::read_to_string(&template_path).unwrap();
        assert_eq!(
            saved_content, template_content,
            "Saved content should match"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_delete_template() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&user_template_dir).unwrap();

        let template_name = "test_template.tf.j2";
        let template_path = user_template_dir.join(template_name);
        fs::write(&template_path, "test content").unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act
        let result = TemplateService::delete_template(template_name).await;

        // Assert
        assert!(result.is_ok(), "Template should be deleted successfully");
        assert!(!template_path.exists(), "Template file should not exist");

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_delete_template_not_found() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&user_template_dir).unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act
        let result = TemplateService::delete_template("nonexistent_template.tf.j2").await;

        // Assert
        assert!(
            result.is_err(),
            "Deleting non-existent template should fail"
        );
        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("not found"),
            "Error message should indicate template not found"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_list_templates() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let default_template_dir = temp_dir.path().join("templates_default/terraform/aws");
        let user_template_dir = temp_dir.path().join("templates_user/terraform/aws");
        fs::create_dir_all(&default_template_dir).unwrap();
        fs::create_dir_all(&user_template_dir).unwrap();

        // デフォルトテンプレートを作成
        fs::write(
            default_template_dir.join("iam_user.tf.j2"),
            "default template",
        )
        .unwrap();
        fs::write(
            default_template_dir.join("iam_role.tf.j2"),
            "default role template",
        )
        .unwrap();

        // ユーザーテンプレートを作成（デフォルトを上書き）
        fs::write(user_template_dir.join("iam_user.tf.j2"), "user template").unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act
        let result = TemplateService::list_templates().await;

        // Assert
        assert!(result.is_ok(), "List templates should succeed");
        let templates = result.unwrap();

        // テンプレートが存在することを確認
        assert!(!templates.is_empty(), "Should have templates");

        // iam_userテンプレートがユーザーオーバーライドを持っていることを確認
        let iam_user_template = templates.iter().find(|t| {
            t.get("resource_type")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                == "aws/iam_user.tf.j2"
        });
        assert!(
            iam_user_template.is_some(),
            "iam_user template should exist"
        );

        let iam_user = iam_user_template.unwrap();
        assert_eq!(
            iam_user.get("has_user_override").and_then(|v| v.as_bool()),
            Some(true),
            "iam_user should have user override"
        );
        assert!(
            iam_user.get("user_source").is_some(),
            "iam_user should have user_source"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_get_template_from_user() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&user_template_dir).unwrap();

        let template_name = "test_template.tf.j2";
        let template_content = "user template content";
        fs::write(user_template_dir.join(template_name), template_content).unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act
        let result = TemplateService::get_template(template_name, Some("user")).await;

        // Assert
        assert!(result.is_ok(), "Template should be retrieved successfully");
        let template = result.unwrap();
        assert_eq!(
            template.get("source").and_then(|v| v.as_str()),
            Some("user"),
            "Source should be user"
        );
        assert_eq!(
            template.get("content").and_then(|v| v.as_str()),
            Some(template_content),
            "Content should match"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_get_template_from_default() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let default_template_dir = temp_dir.path().join("templates_default/terraform");
        fs::create_dir_all(&default_template_dir).unwrap();

        let template_name = "test_template.tf.j2";
        let template_content = "default template content";
        fs::write(default_template_dir.join(template_name), template_content).unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act
        let result = TemplateService::get_template(template_name, Some("default")).await;

        // Assert
        assert!(result.is_ok(), "Template should be retrieved successfully");
        let template = result.unwrap();
        assert_eq!(
            template.get("source").and_then(|v| v.as_str()),
            Some("default"),
            "Source should be default"
        );
        assert_eq!(
            template.get("content").and_then(|v| v.as_str()),
            Some(template_content),
            "Content should match"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_get_template_user_preferred() {
        // Arrange: 一時ディレクトリを作成
        let temp_dir = TempDir::new().unwrap();
        let default_template_dir = temp_dir.path().join("templates_default/terraform");
        let user_template_dir = temp_dir.path().join("templates_user/terraform");
        fs::create_dir_all(&default_template_dir).unwrap();
        fs::create_dir_all(&user_template_dir).unwrap();

        let template_name = "test_template.tf.j2";
        fs::write(default_template_dir.join(template_name), "default content").unwrap();
        fs::write(user_template_dir.join(template_name), "user content").unwrap();

        // カレントディレクトリを一時ディレクトリに変更
        let original_dir = std::env::current_dir().unwrap();
        std::env::set_current_dir(temp_dir.path()).unwrap();

        // Act: sourceを指定しない場合、ユーザーテンプレートが優先される
        let result = TemplateService::get_template(template_name, None).await;

        // Assert
        assert!(result.is_ok(), "Template should be retrieved successfully");
        let template = result.unwrap();
        assert_eq!(
            template.get("source").and_then(|v| v.as_str()),
            Some("user"),
            "User template should be preferred"
        );
        assert_eq!(
            template.get("content").and_then(|v| v.as_str()),
            Some("user content"),
            "User content should be returned"
        );

        // 元のディレクトリに戻す
        std::env::set_current_dir(original_dir).unwrap();
    }

    #[tokio::test]
    async fn test_preview_template() {
        // Arrange
        let template_name = "iam_user.tf.j2";
        let template_content = r#"resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name }}"
  path = "{{ user.path }}"
}"#;

        let context = serde_json::json!({
            "resource_name": "test_user",
            "user": {
                "user_name": "test-user",
                "path": "/"
            }
        });

        // Act
        let result =
            TemplateService::preview_template(template_name, template_content, Some(context)).await;

        // Assert
        assert!(result.is_ok(), "Template preview should succeed");
        let preview = result.unwrap();
        assert!(
            preview.contains("test_user"),
            "Preview should contain resource_name"
        );
        assert!(
            preview.contains("test-user"),
            "Preview should contain user_name"
        );
    }

    #[tokio::test]
    async fn test_preview_template_with_default_context() {
        // Arrange
        let template_name = "iam_user.tf.j2";
        let template_content = r#"resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name }}"
}"#;

        // Act: コンテキストを指定しない場合、サンプルコンテキストが使用される
        let result = TemplateService::preview_template(template_name, template_content, None).await;

        // Assert
        assert!(
            result.is_ok(),
            "Template preview should succeed with default context"
        );
        let preview = result.unwrap();
        assert!(
            preview.contains("example_user"),
            "Preview should contain default resource_name"
        );
    }

    #[tokio::test]
    async fn test_validate_template_valid_jinja2() {
        // 正しいJinja2テンプレートの検証
        let template_name = "iam_user.tf.j2"; // generate_sample_context() が認識できる名前に変更
        let valid_content = r#"
resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name }}"
  path = "{{ user.path }}"
}
"#;

        let result = TemplateService::validate_template(template_name, valid_content)
            .await
            .unwrap();

        assert!(result.valid, "Valid template should pass validation");
        assert_eq!(
            result.errors.len(),
            0,
            "Valid template should have no errors"
        );
    }

    #[tokio::test]
    async fn test_validate_template_invalid_jinja2_syntax() {
        // 不正なJinja2構文（閉じタグがない）
        let template_name = "iam_user.tf.j2";
        let invalid_content = r#"
resource "aws_iam_user" "{{ resource_name" {
  name = "{{ user.user_name }}"
}
"#;

        let result = TemplateService::validate_template(template_name, invalid_content)
            .await
            .unwrap();

        assert!(!result.valid, "Invalid template should fail validation");
        assert!(
            !result.errors.is_empty(),
            "Invalid template should have errors"
        );
        assert_eq!(result.errors[0].error_type, "jinja2");
    }

    #[tokio::test]
    async fn test_validate_template_filter_error() {
        // 存在しないフィルターを使用するテンプレート（エラーになる）
        let template_name = "iam_user.tf.j2";
        let content_with_invalid_filter = r#"
resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name | nonexistent_filter }}"
}
"#;

        let result = TemplateService::validate_template(template_name, content_with_invalid_filter)
            .await
            .unwrap();

        // 存在しないフィルターはレンダリングエラーになる
        assert!(
            !result.valid,
            "Template with invalid filter should fail validation"
        );
        assert!(!result.errors.is_empty(), "Should have rendering errors");
        assert_eq!(result.errors[0].error_type, "jinja2");
    }

    #[tokio::test]
    async fn test_validate_template_empty_content() {
        // 空のテンプレート
        let template_name = "iam_user.tf.j2";
        let empty_content = "";

        let result = TemplateService::validate_template(template_name, empty_content)
            .await
            .unwrap();

        // 空のテンプレートは有効とみなす
        assert!(result.valid, "Empty template should be valid");
        assert_eq!(result.errors.len(), 0);
    }

    #[tokio::test]
    async fn test_validate_template_complex_valid() {
        // 複雑だが有効なテンプレート（条件分岐とループを含む）
        let template_name = "aws/iam_user.tf.j2";
        let complex_content = r#"
resource "aws_iam_user" "{{ resource_name }}" {
  name = "{{ user.user_name }}"
  path = "{{ user.path }}"

  {% if user.tags %}
  tags = {
    {% for key in user.tags %}
    "{{ key }}" = "{{ user.tags[key] }}"
    {% endfor %}
  }
  {% endif %}
}
"#;

        let result = TemplateService::validate_template(template_name, complex_content)
            .await
            .unwrap();

        assert!(
            result.valid,
            "Complex valid template should pass validation"
        );
        assert_eq!(result.errors.len(), 0);
    }
}
