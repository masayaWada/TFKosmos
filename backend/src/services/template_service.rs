use anyhow::Result;
use serde_json::{json, Value};
use std::path::PathBuf;

pub struct TemplateService;

impl TemplateService {
    pub async fn list_templates() -> Result<Vec<serde_json::Value>> {
        let default_dir = PathBuf::from("templates_default/terraform");
        let user_dir = PathBuf::from("templates_user/terraform");

        let mut template_map: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();

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
            let a_type = a.get("resource_type").and_then(|v| v.as_str()).unwrap_or("");
            let b_type = b.get("resource_type").and_then(|v| v.as_str()).unwrap_or("");
            a_type.cmp(b_type)
        });

        Ok(templates)
    }

    pub async fn get_template(template_name: &str, source: Option<&str>) -> Result<serde_json::Value> {
        let user_path = PathBuf::from("templates_user/terraform").join(template_name);
        let default_path = PathBuf::from("templates_default/terraform").join(template_name);

        let (content, actual_source) = match source {
            Some("user") => {
                if user_path.exists() {
                    (std::fs::read_to_string(user_path)?, "user")
                } else {
                    return Err(anyhow::anyhow!("User template not found: {}", template_name));
                }
            }
            Some("default") => {
                if default_path.exists() {
                    (std::fs::read_to_string(default_path)?, "default")
                } else {
                    return Err(anyhow::anyhow!("Default template not found: {}", template_name));
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
        let sample_context = context.unwrap_or_else(|| Self::generate_sample_context(template_name));

        // Create a temporary template file and render it
        let mut env = minijinja::Environment::new();
        env.add_template(template_name, template_content)?;
        let template = env.get_template(template_name)?;
        Ok(template.render(&sample_context)?)
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
                    "policy_document": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"*\"}]}"
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
                    let relative_path = path.strip_prefix(base_dir)
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
                        let default_path = PathBuf::from("templates_default/terraform").join(&relative_path);
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
                    template_map.insert(resource_type.clone(), json!({
                        "resource_type": resource_type,
                        "template_path": format!("terraform/{}", relative_path),
                        "has_user_override": has_user_override,
                        "default_source": default_source,
                        "user_source": user_source
                    }));
                } else if path.is_dir() {
                    Self::list_templates_in_dir(&path, base_dir, template_map, is_user)?;
                }
            }
        }
        Ok(())
    }
}
