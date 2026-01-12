use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::infra::generators::naming::NamingGenerator;
use crate::infra::templates::manager::TemplateManager;
use crate::models::GenerationConfig;

pub struct TerraformGenerator;

// Resource type to template file mapping
#[allow(dead_code)]
struct ResourceTemplate {
    resource_type: &'static str,
    template_path: &'static str,
    /// プロバイダー識別子（将来の拡張用）
    provider: &'static str,
}

impl TerraformGenerator {
    pub async fn generate(
        scan_data: &Value,
        config: &GenerationConfig,
        selected_resources: &HashMap<String, Vec<Value>>,
        output_path: &PathBuf,
    ) -> Result<Vec<String>> {
        let provider = scan_data
            .get("provider")
            .and_then(|v| v.as_str())
            .unwrap_or("aws");

        println!("[GENERATE] Starting generation for provider: {}", provider);
        println!("[GENERATE] Output path: {:?}", output_path);
        println!("[GENERATE] Selected resources: {:?}", selected_resources);

        // Define resource templates based on provider
        let templates = Self::get_templates_for_provider(provider);
        println!(
            "[GENERATE] Found {} templates for provider {}",
            templates.len(),
            provider
        );

        let mut generated_files = Vec::new();

        // Process each resource type
        for template_info in templates {
            let resource_type = template_info.resource_type;

            // Get resources from scan data
            let resources = scan_data
                .get(resource_type)
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            println!(
                "[GENERATE] Resource type '{}': found {} resources",
                resource_type,
                resources.len()
            );

            if resources.is_empty() {
                println!(
                    "[GENERATE] Skipping resource type '{}' (no resources)",
                    resource_type
                );
                continue;
            }

            // Filter by selected resources if provided
            // If selected_resources is empty or doesn't contain this resource type, use all resources
            let resources_to_process = if selected_resources.is_empty() {
                println!(
                    "[GENERATE] No selection filter provided, using all {} resources for type '{}'",
                    resources.len(),
                    resource_type
                );
                resources
            } else if let Some(selected) = selected_resources.get(resource_type) {
                println!(
                    "[GENERATE] Filtering resources for type '{}': {} selected",
                    resource_type,
                    selected.len()
                );
                if selected.is_empty() {
                    println!(
                        "[GENERATE] Skipping resource type '{}' (empty selection)",
                        resource_type
                    );
                    continue; // Skip if empty selection
                }

                // Extract selected IDs (handle both string IDs and object IDs)
                let selected_ids: Vec<String> = selected
                    .iter()
                    .filter_map(|s| {
                        // If it's a string, use it directly
                        if let Some(id_str) = s.as_str() {
                            Some(id_str.to_string())
                        } else if let Some(obj) = s.as_object() {
                            // If it's an object, try to extract ID from common fields
                            obj.get("user_name")
                                .or_else(|| obj.get("group_name"))
                                .or_else(|| obj.get("role_name"))
                                .or_else(|| obj.get("arn"))
                                .or_else(|| obj.get("id"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                        } else {
                            None
                        }
                    })
                    .collect();

                println!(
                    "[GENERATE] Extracted {} selected IDs: {:?}",
                    selected_ids.len(),
                    selected_ids
                );

                // Filter resources that match selected IDs
                let filtered: Vec<_> = resources
                    .iter()
                    .filter(|r| {
                        // Get resource identifier based on resource type
                        let resource_id = match resource_type {
                            "users" => r.get("user_name").and_then(|v| v.as_str()),
                            "groups" => r.get("group_name").and_then(|v| v.as_str()),
                            "roles" => r.get("role_name").and_then(|v| v.as_str()),
                            "policies" => r
                                .get("arn")
                                .or_else(|| r.get("policy_name"))
                                .and_then(|v| v.as_str()),
                            _ => r
                                .get("arn")
                                .or_else(|| r.get("id"))
                                .or_else(|| r.get("name"))
                                .and_then(|v| v.as_str()),
                        };

                        if let Some(id) = resource_id {
                            let matches = selected_ids.contains(&id.to_string());
                            if matches {
                                println!("[GENERATE] Resource '{}' matches selected ID", id);
                            }
                            matches
                        } else {
                            false
                        }
                    })
                    .cloned()
                    .collect();
                println!(
                    "[GENERATE] Filtered to {} resources for type '{}'",
                    filtered.len(),
                    resource_type
                );
                filtered
            } else {
                println!(
                    "[GENERATE] No selection filter for type '{}', using all {} resources",
                    resource_type,
                    resources.len()
                );
                resources
            };

            if resources_to_process.is_empty() {
                println!(
                    "[GENERATE] Skipping resource type '{}' (no resources to process)",
                    resource_type
                );
                continue;
            }

            println!(
                "[GENERATE] Processing {} resources for type '{}'",
                resources_to_process.len(),
                resource_type
            );

            // Generate files based on file split rule
            match config.file_split_rule.as_str() {
                "single" => {
                    println!(
                        "[GENERATE] Generating single file for type '{}'",
                        resource_type
                    );
                    let file_path = Self::generate_single_file(
                        &resources_to_process,
                        &template_info,
                        config,
                        output_path,
                    )
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to generate single file for type '{}'",
                            resource_type
                        )
                    })?;
                    println!("[GENERATE] Generated file: {}", file_path);
                    generated_files.push(file_path);
                }
                "by_resource_type" => {
                    println!(
                        "[GENERATE] Generating file by resource type for type '{}'",
                        resource_type
                    );
                    let file_path = Self::generate_by_resource_type(
                        &resources_to_process,
                        &template_info,
                        config,
                        output_path,
                    )
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to generate file by resource type for type '{}'",
                            resource_type
                        )
                    })?;
                    println!("[GENERATE] Generated file: {}", file_path);
                    generated_files.push(file_path);
                }
                "by_resource_name" => {
                    println!(
                        "[GENERATE] Generating files by resource name for type '{}'",
                        resource_type
                    );
                    let files = Self::generate_by_resource_name(
                        &resources_to_process,
                        &template_info,
                        config,
                        output_path,
                    )
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to generate files by resource name for type '{}'",
                            resource_type
                        )
                    })?;
                    println!(
                        "[GENERATE] Generated {} files for type '{}'",
                        files.len(),
                        resource_type
                    );
                    generated_files.extend(files);
                }
                _ => {
                    // Default to single file
                    println!(
                        "[GENERATE] Unknown file split rule '{}', defaulting to single file",
                        config.file_split_rule
                    );
                    let file_path = Self::generate_single_file(
                        &resources_to_process,
                        &template_info,
                        config,
                        output_path,
                    )
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to generate single file for type '{}'",
                            resource_type
                        )
                    })?;
                    println!("[GENERATE] Generated file: {}", file_path);
                    generated_files.push(file_path);
                }
            }
        }

        // Generate README if requested
        if config.generate_readme {
            println!("[GENERATE] Generating README");
            let readme_path = Self::generate_readme(config, output_path, &generated_files)
                .await
                .with_context(|| "Failed to generate README")?;
            println!("[GENERATE] Generated README: {}", readme_path);
            generated_files.push(readme_path);
        }

        println!(
            "[GENERATE] Generation complete. Generated {} files",
            generated_files.len()
        );
        if generated_files.is_empty() {
            return Err(anyhow::anyhow!(
                "No files were generated. This may be because:\n\
                1. No resources were found in the scan data\n\
                2. All resources were filtered out by selection\n\
                3. Template files could not be loaded\n\
                Please check the scan data and ensure resources exist."
            ));
        }

        Ok(generated_files)
    }

    fn get_templates_for_provider(provider: &str) -> Vec<ResourceTemplate> {
        match provider {
            "aws" => vec![
                ResourceTemplate {
                    resource_type: "users",
                    template_path: "aws/iam_user.tf.j2",
                    provider: "aws",
                },
                ResourceTemplate {
                    resource_type: "groups",
                    template_path: "aws/iam_group.tf.j2",
                    provider: "aws",
                },
                ResourceTemplate {
                    resource_type: "roles",
                    template_path: "aws/iam_role.tf.j2",
                    provider: "aws",
                },
                ResourceTemplate {
                    resource_type: "policies",
                    template_path: "aws/iam_policy.tf.j2",
                    provider: "aws",
                },
            ],
            "azure" => vec![
                ResourceTemplate {
                    resource_type: "role_definitions",
                    template_path: "azure/role_definition.tf.j2",
                    provider: "azure",
                },
                ResourceTemplate {
                    resource_type: "role_assignments",
                    template_path: "azure/role_assignment.tf.j2",
                    provider: "azure",
                },
            ],
            _ => vec![],
        }
    }

    async fn generate_single_file(
        resources: &[Value],
        template_info: &ResourceTemplate,
        config: &GenerationConfig,
        output_path: &Path,
    ) -> Result<String> {
        println!(
            "[GENERATE] Generating single file for {} resources",
            resources.len()
        );
        let mut content = String::new();

        for (idx, resource) in resources.iter().enumerate() {
            println!(
                "[GENERATE] Rendering resource {} of {}",
                idx + 1,
                resources.len()
            );
            let rendered = Self::render_resource(resource, template_info, config)
                .await
                .with_context(|| {
                    format!(
                        "Failed to render resource {} of type '{}'",
                        idx + 1,
                        template_info.resource_type
                    )
                })?;
            content.push_str(&rendered);
            content.push_str("\n\n");
        }

        let file_name = format!("{}.tf", template_info.resource_type);
        let file_path = output_path.join(&file_name);

        println!(
            "[GENERATE] Writing file: {:?} ({} bytes)",
            file_path,
            content.len()
        );
        fs::write(&file_path, content)
            .with_context(|| format!("Failed to write file: {:?}", file_path))?;

        // Verify file was written
        if !file_path.exists() {
            return Err(anyhow::anyhow!("File was not created: {:?}", file_path));
        }
        let metadata = fs::metadata(&file_path)?;
        println!(
            "[GENERATE] File written successfully: {:?} ({} bytes)",
            file_path,
            metadata.len()
        );

        Ok(file_name)
    }

    async fn generate_by_resource_type(
        resources: &[Value],
        template_info: &ResourceTemplate,
        config: &GenerationConfig,
        output_path: &Path,
    ) -> Result<String> {
        // Same as single file for now
        Self::generate_single_file(resources, template_info, config, output_path).await
    }

    async fn generate_by_resource_name(
        resources: &[Value],
        template_info: &ResourceTemplate,
        config: &GenerationConfig,
        output_path: &Path,
    ) -> Result<Vec<String>> {
        let mut files = Vec::new();

        for resource in resources {
            let rendered = Self::render_resource(resource, template_info, config).await?;

            // Get resource name for file name
            let resource_name = Self::get_resource_name(resource, template_info.resource_type)?;
            let file_name = format!(
                "{}_{}.tf",
                template_info.resource_type,
                NamingGenerator::apply_naming_convention(&resource_name, &config.naming_convention)
            );
            let file_path = output_path.join(&file_name);

            fs::write(&file_path, rendered)
                .with_context(|| format!("Failed to write file: {:?}", file_path))?;

            files.push(file_name);
        }

        Ok(files)
    }

    async fn render_resource(
        resource: &Value,
        template_info: &ResourceTemplate,
        config: &GenerationConfig,
    ) -> Result<String> {
        // Get resource name for Terraform resource identifier
        let resource_name = Self::get_resource_name(resource, template_info.resource_type)?;
        let terraform_resource_name =
            NamingGenerator::apply_naming_convention(&resource_name, &config.naming_convention);

        // Prepare context for template
        let mut context = serde_json::Map::new();
        context.insert(
            "resource_name".to_string(),
            Value::String(terraform_resource_name),
        );

        // Add resource data based on resource type
        match template_info.resource_type {
            "users" => {
                context.insert("user".to_string(), resource.clone());
            }
            "groups" => {
                context.insert("group".to_string(), resource.clone());
            }
            "roles" => {
                context.insert("role".to_string(), resource.clone());
            }
            "policies" => {
                context.insert("policy".to_string(), resource.clone());
            }
            _ => {
                // For other types, use generic "resource" key
                context.insert("resource".to_string(), resource.clone());
            }
        }

        let context_value = Value::Object(context);

        // Render template
        println!(
            "[GENERATE] Rendering template: {}",
            template_info.template_path
        );
        let rendered =
            TemplateManager::render_template(template_info.template_path, &context_value)
                .await
                .with_context(|| {
                    format!("Failed to render template: {}", template_info.template_path)
                })?;
        println!(
            "[GENERATE] Template rendered successfully ({} bytes)",
            rendered.len()
        );
        Ok(rendered)
    }

    fn get_resource_name(resource: &Value, resource_type: &str) -> Result<String> {
        match resource_type {
            "users" => Ok(resource
                .get("user_name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing user_name"))?
                .to_string()),
            "groups" => Ok(resource
                .get("group_name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing group_name"))?
                .to_string()),
            "roles" => Ok(resource
                .get("role_name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing role_name"))?
                .to_string()),
            "policies" => Ok(resource
                .get("policy_name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing policy_name"))?
                .to_string()),
            _ => {
                // Try common fields
                if let Some(name) = resource.get("name").and_then(|v| v.as_str()) {
                    Ok(name.to_string())
                } else if let Some(name) = resource.get("display_name").and_then(|v| v.as_str()) {
                    Ok(name.to_string())
                } else {
                    Err(anyhow::anyhow!("Cannot determine resource name"))
                }
            }
        }
    }

    async fn generate_readme(
        _config: &GenerationConfig,
        output_path: &Path,
        files: &[String],
    ) -> Result<String> {
        let mut readme = String::new();
        readme.push_str("# Terraform Code Generation\n\n");
        readme.push_str("This directory contains Terraform code generated by TFKosmos.\n\n");
        readme.push_str("## Generated Files\n\n");

        for file in files {
            readme.push_str(&format!("- {}\n", file));
        }

        readme.push_str("\n## Usage\n\n");
        readme.push_str("1. Review the generated Terraform files\n");
        readme.push_str("2. Run `terraform init` to initialize the Terraform working directory\n");
        readme.push_str("3. Run `terraform plan` to review the changes\n");
        readme.push_str("4. Run `terraform apply` to apply the changes\n\n");
        readme.push_str("## Import Script\n\n");
        readme.push_str(
            "Use the generated import script to import existing resources into Terraform state.\n",
        );

        let readme_path = output_path.join("README.md");
        fs::write(&readme_path, readme)
            .with_context(|| format!("Failed to write README: {:?}", readme_path))?;

        Ok("README.md".to_string())
    }

    pub async fn generate_import_script(
        scan_data: &Value,
        config: &GenerationConfig,
        selected_resources: &HashMap<String, Vec<Value>>,
        output_path: &Path,
    ) -> Result<Option<String>> {
        let provider = scan_data
            .get("provider")
            .and_then(|v| v.as_str())
            .unwrap_or("aws");

        let mut import_commands = Vec::new();

        // Process each resource type
        let templates = Self::get_templates_for_provider(provider);
        for template_info in templates {
            let resource_type = template_info.resource_type;

            let resources = scan_data
                .get(resource_type)
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            if resources.is_empty() {
                continue;
            }

            // Filter by selected resources if provided
            // If selected_resources is empty or doesn't contain this resource type, use all resources
            let resources_to_process = if selected_resources.is_empty() {
                println!("[GENERATE_IMPORT] No selection filter provided, using all {} resources for type '{}'", resources.len(), resource_type);
                resources
            } else if let Some(selected) = selected_resources.get(resource_type) {
                println!(
                    "[GENERATE_IMPORT] Filtering resources for type '{}': {} selected",
                    resource_type,
                    selected.len()
                );
                if selected.is_empty() {
                    println!(
                        "[GENERATE_IMPORT] Skipping resource type '{}' (empty selection)",
                        resource_type
                    );
                    continue;
                }

                // Extract selected IDs (handle both string IDs and object IDs)
                let selected_ids: Vec<String> = selected
                    .iter()
                    .filter_map(|s| {
                        // If it's a string, use it directly
                        if let Some(id_str) = s.as_str() {
                            Some(id_str.to_string())
                        } else if let Some(obj) = s.as_object() {
                            // If it's an object, try to extract ID from common fields
                            obj.get("user_name")
                                .or_else(|| obj.get("group_name"))
                                .or_else(|| obj.get("role_name"))
                                .or_else(|| obj.get("arn"))
                                .or_else(|| obj.get("id"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                        } else {
                            None
                        }
                    })
                    .collect();

                println!(
                    "[GENERATE_IMPORT] Extracted {} selected IDs: {:?}",
                    selected_ids.len(),
                    selected_ids
                );

                // Filter resources that match selected IDs
                let filtered: Vec<_> = resources
                    .iter()
                    .filter(|r| {
                        // Get resource identifier based on resource type
                        let resource_id = match resource_type {
                            "users" => r.get("user_name").and_then(|v| v.as_str()),
                            "groups" => r.get("group_name").and_then(|v| v.as_str()),
                            "roles" => r.get("role_name").and_then(|v| v.as_str()),
                            "policies" => r
                                .get("arn")
                                .or_else(|| r.get("policy_name"))
                                .and_then(|v| v.as_str()),
                            _ => r
                                .get("arn")
                                .or_else(|| r.get("id"))
                                .or_else(|| r.get("name"))
                                .and_then(|v| v.as_str()),
                        };

                        if let Some(id) = resource_id {
                            selected_ids.contains(&id.to_string())
                        } else {
                            false
                        }
                    })
                    .cloned()
                    .collect();

                println!(
                    "[GENERATE_IMPORT] Filtered to {} resources for type '{}'",
                    filtered.len(),
                    resource_type
                );
                filtered
            } else {
                println!(
                    "[GENERATE_IMPORT] No selection filter for type '{}', using all {} resources",
                    resource_type,
                    resources.len()
                );
                resources
            };

            println!(
                "[GENERATE_IMPORT] Processing {} resources for type '{}'",
                resources_to_process.len(),
                resource_type
            );
            for resource in resources_to_process {
                match Self::generate_import_command(&resource, resource_type, provider) {
                    Ok(import_cmd) => {
                        println!("[GENERATE_IMPORT] Generated import command: {}", import_cmd);
                        import_commands.push(import_cmd);
                    }
                    Err(e) => {
                        eprintln!(
                            "[GENERATE_IMPORT] Failed to generate import command for resource: {}",
                            e
                        );
                    }
                }
            }
        }

        println!(
            "[GENERATE_IMPORT] Total import commands generated: {}",
            import_commands.len()
        );
        if import_commands.is_empty() {
            println!("[GENERATE_IMPORT] No import commands generated, returning None");
            return Ok(None);
        }

        // Generate import script
        let script_content = match config.import_script_format.as_str() {
            "sh" => Self::generate_sh_import_script(&import_commands),
            "ps1" => Self::generate_ps1_import_script(&import_commands),
            _ => Self::generate_sh_import_script(&import_commands),
        };

        let script_name = match config.import_script_format.as_str() {
            "ps1" => "import.ps1",
            _ => "import.sh",
        };

        let script_path = output_path.join(script_name);
        println!(
            "[GENERATE_IMPORT] Writing import script: {:?} ({} bytes)",
            script_path,
            script_content.len()
        );
        fs::write(&script_path, script_content)
            .with_context(|| format!("Failed to write import script: {:?}", script_path))?;

        // Verify file was written
        if !script_path.exists() {
            return Err(anyhow::anyhow!(
                "Import script was not created: {:?}",
                script_path
            ));
        }
        let metadata = fs::metadata(&script_path)?;
        println!(
            "[GENERATE_IMPORT] Import script written successfully: {:?} ({} bytes)",
            script_path,
            metadata.len()
        );

        // Make script executable on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&script_path)?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&script_path, perms)?;
            println!("[GENERATE_IMPORT] Import script made executable");
        }

        Ok(Some(script_name.to_string()))
    }

    fn generate_import_command(
        resource: &Value,
        resource_type: &str,
        provider: &str,
    ) -> Result<String> {
        let resource_name = Self::get_resource_name(resource, resource_type)?;
        let terraform_resource_name = NamingGenerator::to_snake_case(&resource_name);

        match (provider, resource_type) {
            ("aws", "users") => {
                let arn = resource
                    .get("arn")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing ARN"))?;
                Ok(format!(
                    "terraform import aws_iam_user.{} {}",
                    terraform_resource_name, arn
                ))
            }
            ("aws", "groups") => {
                let arn = resource
                    .get("arn")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing ARN"))?;
                Ok(format!(
                    "terraform import aws_iam_group.{} {}",
                    terraform_resource_name, arn
                ))
            }
            ("aws", "roles") => {
                let arn = resource
                    .get("arn")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing ARN"))?;
                Ok(format!(
                    "terraform import aws_iam_role.{} {}",
                    terraform_resource_name, arn
                ))
            }
            ("aws", "policies") => {
                let arn = resource
                    .get("arn")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing ARN"))?;
                Ok(format!(
                    "terraform import aws_iam_policy.{} {}",
                    terraform_resource_name, arn
                ))
            }
            _ => Err(anyhow::anyhow!(
                "Unsupported provider/resource type combination"
            )),
        }
    }

    fn generate_sh_import_script(commands: &[String]) -> String {
        let mut script = String::new();
        script.push_str("#!/bin/bash\n");
        script.push_str("# Terraform import script\n");
        script.push_str("# Generated by TFKosmos\n\n");
        script.push_str("set -e\n\n");

        for cmd in commands {
            script.push_str(&format!("{}\n", cmd));
        }

        script
    }

    fn generate_ps1_import_script(commands: &[String]) -> String {
        let mut script = String::new();
        script.push_str("# Terraform import script\n");
        script.push_str("# Generated by TFKosmos\n\n");
        script.push_str("$ErrorActionPreference = \"Stop\"\n\n");

        for cmd in commands {
            script.push_str(&format!("{}\n", cmd));
        }

        script
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;
    use tempfile::TempDir;

    // ========================================
    // get_templates_for_provider のテスト
    // ========================================

    #[test]
    fn test_get_templates_for_aws() {
        let templates = TerraformGenerator::get_templates_for_provider("aws");
        assert_eq!(templates.len(), 4);

        let template_types: Vec<&str> = templates.iter().map(|t| t.resource_type).collect();
        assert!(template_types.contains(&"users"));
        assert!(template_types.contains(&"groups"));
        assert!(template_types.contains(&"roles"));
        assert!(template_types.contains(&"policies"));
    }

    #[test]
    fn test_get_templates_for_azure() {
        let templates = TerraformGenerator::get_templates_for_provider("azure");
        assert_eq!(templates.len(), 2);

        let template_types: Vec<&str> = templates.iter().map(|t| t.resource_type).collect();
        assert!(template_types.contains(&"role_definitions"));
        assert!(template_types.contains(&"role_assignments"));
    }

    #[test]
    fn test_get_templates_for_unknown_provider() {
        let templates = TerraformGenerator::get_templates_for_provider("unknown");
        assert_eq!(templates.len(), 0);
    }

    // ========================================
    // get_resource_name のテスト
    // ========================================

    #[test]
    fn test_get_resource_name_user() {
        let resource = json!({
            "user_name": "test-user",
            "arn": "arn:aws:iam::123456789012:user/test-user"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "users");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-user");
    }

    #[test]
    fn test_get_resource_name_group() {
        let resource = json!({
            "group_name": "test-group",
            "arn": "arn:aws:iam::123456789012:group/test-group"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "groups");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-group");
    }

    #[test]
    fn test_get_resource_name_role() {
        let resource = json!({
            "role_name": "test-role",
            "arn": "arn:aws:iam::123456789012:role/test-role"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "roles");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-role");
    }

    #[test]
    fn test_get_resource_name_policy() {
        let resource = json!({
            "policy_name": "test-policy",
            "arn": "arn:aws:iam::123456789012:policy/test-policy"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "policies");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-policy");
    }

    #[test]
    fn test_get_resource_name_missing_field() {
        let resource = json!({
            "arn": "arn:aws:iam::123456789012:user/test-user"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "users");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Missing user_name"));
    }

    #[test]
    fn test_get_resource_name_generic() {
        let resource = json!({
            "name": "generic-resource"
        });

        let result = TerraformGenerator::get_resource_name(&resource, "unknown_type");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "generic-resource");
    }

    // ========================================
    // generate_import_command のテスト
    // ========================================

    #[test]
    fn test_generate_import_command_aws_user() {
        let resource = json!({
            "user_name": "test-user",
            "arn": "arn:aws:iam::123456789012:user/test-user"
        });

        let result = TerraformGenerator::generate_import_command(&resource, "users", "aws");
        assert!(result.is_ok());

        let import_cmd = result.unwrap();
        assert!(import_cmd.contains("terraform import"));
        assert!(import_cmd.contains("aws_iam_user.test_user"));
        assert!(import_cmd.contains("arn:aws:iam::123456789012:user/test-user"));
    }

    #[test]
    fn test_generate_import_command_aws_group() {
        let resource = json!({
            "group_name": "test-group",
            "arn": "arn:aws:iam::123456789012:group/test-group"
        });

        let result = TerraformGenerator::generate_import_command(&resource, "groups", "aws");
        assert!(result.is_ok());

        let import_cmd = result.unwrap();
        assert!(import_cmd.contains("terraform import"));
        assert!(import_cmd.contains("aws_iam_group.test_group"));
        assert!(import_cmd.contains("arn:aws:iam::123456789012:group/test-group"));
    }

    #[test]
    fn test_generate_import_command_aws_role() {
        let resource = json!({
            "role_name": "test-role",
            "arn": "arn:aws:iam::123456789012:role/test-role"
        });

        let result = TerraformGenerator::generate_import_command(&resource, "roles", "aws");
        assert!(result.is_ok());

        let import_cmd = result.unwrap();
        assert!(import_cmd.contains("terraform import"));
        assert!(import_cmd.contains("aws_iam_role.test_role"));
        assert!(import_cmd.contains("arn:aws:iam::123456789012:role/test-role"));
    }

    #[test]
    fn test_generate_import_command_aws_policy() {
        let resource = json!({
            "policy_name": "test-policy",
            "arn": "arn:aws:iam::123456789012:policy/test-policy"
        });

        let result = TerraformGenerator::generate_import_command(&resource, "policies", "aws");
        assert!(result.is_ok());

        let import_cmd = result.unwrap();
        assert!(import_cmd.contains("terraform import"));
        assert!(import_cmd.contains("aws_iam_policy.test_policy"));
        assert!(import_cmd.contains("arn:aws:iam::123456789012:policy/test-policy"));
    }

    #[test]
    fn test_generate_import_command_unsupported_provider() {
        let resource = json!({
            "user_name": "test-user",
            "arn": "arn:aws:iam::123456789012:user/test-user"
        });

        let result = TerraformGenerator::generate_import_command(&resource, "users", "gcp");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Unsupported provider/resource type combination"));
    }

    // ========================================
    // generate_sh_import_script のテスト
    // ========================================

    #[test]
    fn test_generate_sh_import_script() {
        let commands = vec![
            "terraform import aws_iam_user.test_user arn:aws:iam::123456789012:user/test-user"
                .to_string(),
            "terraform import aws_iam_group.test_group arn:aws:iam::123456789012:group/test-group"
                .to_string(),
        ];

        let script = TerraformGenerator::generate_sh_import_script(&commands);

        assert!(script.contains("#!/bin/bash"));
        assert!(script.contains("set -e"));
        assert!(script.contains("terraform import aws_iam_user.test_user"));
        assert!(script.contains("terraform import aws_iam_group.test_group"));
    }

    // ========================================
    // generate_ps1_import_script のテスト
    // ========================================

    #[test]
    fn test_generate_ps1_import_script() {
        let commands = vec![
            "terraform import aws_iam_user.test_user arn:aws:iam::123456789012:user/test-user"
                .to_string(),
            "terraform import aws_iam_group.test_group arn:aws:iam::123456789012:group/test-group"
                .to_string(),
        ];

        let script = TerraformGenerator::generate_ps1_import_script(&commands);

        assert!(script.contains("$ErrorActionPreference"));
        assert!(script.contains("terraform import aws_iam_user.test_user"));
        assert!(script.contains("terraform import aws_iam_group.test_group"));
    }

    // ========================================
    // generate_readme のテスト
    // ========================================

    #[tokio::test]
    async fn test_generate_readme() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path();

        let config = GenerationConfig {
            output_path: output_path.to_str().unwrap().to_string(),
            file_split_rule: "single".to_string(),
            naming_convention: "snake_case".to_string(),
            import_script_format: "sh".to_string(),
            generate_readme: true,
            selected_resources: HashMap::new(),
        };

        let files = vec!["users.tf".to_string(), "groups.tf".to_string()];

        let result =
            TerraformGenerator::generate_readme(&config, &output_path.to_path_buf(), &files).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "README.md");

        let readme_path = output_path.join("README.md");
        assert!(readme_path.exists());

        let readme_content = std::fs::read_to_string(readme_path).unwrap();
        assert!(readme_content.contains("# Terraform Code Generation"));
        assert!(readme_content.contains("users.tf"));
        assert!(readme_content.contains("groups.tf"));
        assert!(readme_content.contains("terraform init"));
    }

    // ========================================
    // generate_import_script のテスト
    // ========================================

    #[tokio::test]
    async fn test_generate_import_script_with_resources() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path();

        let scan_data = json!({
            "provider": "aws",
            "users": [
                {
                    "user_name": "test-user",
                    "arn": "arn:aws:iam::123456789012:user/test-user"
                }
            ]
        });

        let config = GenerationConfig {
            output_path: output_path.to_str().unwrap().to_string(),
            file_split_rule: "single".to_string(),
            naming_convention: "snake_case".to_string(),
            import_script_format: "sh".to_string(),
            generate_readme: true,
            selected_resources: HashMap::new(),
        };

        let selected_resources = HashMap::new();

        let result = TerraformGenerator::generate_import_script(
            &scan_data,
            &config,
            &selected_resources,
            &output_path.to_path_buf(),
        )
        .await;

        assert!(result.is_ok());
        assert!(result.as_ref().unwrap().is_some());

        let script_name = result.unwrap().unwrap();
        assert_eq!(script_name, "import.sh");

        let script_path = output_path.join(&script_name);
        assert!(script_path.exists());

        let script_content = std::fs::read_to_string(script_path).unwrap();
        assert!(script_content.contains("#!/bin/bash"));
        assert!(script_content.contains("terraform import"));
        assert!(script_content.contains("aws_iam_user.test_user"));
    }

    #[tokio::test]
    async fn test_generate_import_script_ps1_format() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path();

        let scan_data = json!({
            "provider": "aws",
            "users": [
                {
                    "user_name": "test-user",
                    "arn": "arn:aws:iam::123456789012:user/test-user"
                }
            ]
        });

        let config = GenerationConfig {
            output_path: output_path.to_str().unwrap().to_string(),
            file_split_rule: "single".to_string(),
            naming_convention: "snake_case".to_string(),
            import_script_format: "ps1".to_string(),
            generate_readme: true,
            selected_resources: HashMap::new(),
        };

        let selected_resources = HashMap::new();

        let result = TerraformGenerator::generate_import_script(
            &scan_data,
            &config,
            &selected_resources,
            &output_path.to_path_buf(),
        )
        .await;

        assert!(result.is_ok());
        assert!(result.as_ref().unwrap().is_some());

        let script_name = result.unwrap().unwrap();
        assert_eq!(script_name, "import.ps1");

        let script_path = output_path.join(&script_name);
        assert!(script_path.exists());

        let script_content = std::fs::read_to_string(script_path).unwrap();
        assert!(script_content.contains("$ErrorActionPreference"));
        assert!(script_content.contains("terraform import"));
    }

    #[tokio::test]
    async fn test_generate_import_script_no_resources() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path();

        let scan_data = json!({
            "provider": "aws",
            "users": []
        });

        let config = GenerationConfig {
            output_path: output_path.to_str().unwrap().to_string(),
            file_split_rule: "single".to_string(),
            naming_convention: "snake_case".to_string(),
            import_script_format: "sh".to_string(),
            generate_readme: true,
            selected_resources: HashMap::new(),
        };

        let selected_resources = HashMap::new();

        let result = TerraformGenerator::generate_import_script(
            &scan_data,
            &config,
            &selected_resources,
            &output_path.to_path_buf(),
        )
        .await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}
