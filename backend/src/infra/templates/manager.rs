use anyhow::{Context, Result};
use std::path::PathBuf;

pub struct TemplateManager;

impl TemplateManager {
    fn get_template_base_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        
        // Get current working directory
        if let Ok(current_dir) = std::env::current_dir() {
            println!("[TEMPLATE] Current working directory: {:?}", current_dir);
            
            // Try relative to current directory
            paths.push(current_dir.join("templates_user/terraform"));
            paths.push(current_dir.join("templates_default/terraform"));
            
            // Try relative to backend directory (if running from project root)
            paths.push(current_dir.join("backend/templates_user/terraform"));
            paths.push(current_dir.join("backend/templates_default/terraform"));
            
            // Try relative to executable location
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    println!("[TEMPLATE] Executable directory: {:?}", exe_dir);
                    // Go up to project root if running from target/debug or target/release
                    if exe_dir.ends_with("target/debug") || exe_dir.ends_with("target/release") {
                        if let Some(backend_dir) = exe_dir.parent().and_then(|p| p.parent()) {
                            paths.push(backend_dir.join("templates_user/terraform"));
                            paths.push(backend_dir.join("templates_default/terraform"));
                        }
                    }
                }
            }
        }
        
        // Also try absolute paths from common locations
        paths.push(PathBuf::from("templates_user/terraform"));
        paths.push(PathBuf::from("templates_default/terraform"));
        paths.push(PathBuf::from("backend/templates_user/terraform"));
        paths.push(PathBuf::from("backend/templates_default/terraform"));
        
        paths
    }

    pub async fn load_template(template_name: &str) -> Result<String> {
        println!("[TEMPLATE] Loading template: {}", template_name);
        
        let base_paths = Self::get_template_base_paths();
        
        // Try user templates first, then default templates
        for base_path in &base_paths {
            // Check if this is a user template path
            if base_path.to_string_lossy().contains("templates_user") {
                let user_path = base_path.join(template_name);
                if user_path.exists() {
                    println!("[TEMPLATE] Found template at user path: {:?}", user_path);
                    let content = std::fs::read_to_string(&user_path)
                        .with_context(|| format!("Failed to read template from user path: {:?}", user_path))?;
                    println!("[TEMPLATE] Template loaded successfully ({} bytes)", content.len());
                    return Ok(content);
                }
            }
            
            // Try default template path
            if base_path.to_string_lossy().contains("templates_default") {
                let default_path = base_path.join(template_name);
                if default_path.exists() {
                    println!("[TEMPLATE] Found template at default path: {:?}", default_path);
                    let content = std::fs::read_to_string(&default_path)
                        .with_context(|| format!("Failed to read template from default path: {:?}", default_path))?;
                    println!("[TEMPLATE] Template loaded successfully ({} bytes)", content.len());
                    return Ok(content);
                }
            }
        }
        
        // If we get here, template was not found
        let searched_paths: Vec<String> = base_paths.iter()
            .map(|p| format!("  - {:?}/{}", p, template_name))
            .collect();
        
        Err(anyhow::anyhow!(
            "Template not found: {}\n\
            Searched paths:\n{}\n\
            Please ensure the template file exists.",
            template_name,
            searched_paths.join("\n")
        ))
    }

    pub async fn render_template(
        template_name: &str,
        context: &serde_json::Value,
    ) -> Result<String> {
        println!("[TEMPLATE] Rendering template: {}", template_name);
        let template_content = Self::load_template(template_name).await?;

        // Use minijinja to render template
        let mut env = minijinja::Environment::new();
        env.add_template(template_name, &template_content)
            .with_context(|| format!("Failed to add template '{}' to environment", template_name))?;

        let template = env.get_template(template_name)
            .with_context(|| format!("Failed to get template '{}' from environment", template_name))?;
        
        let rendered = template.render(context)
            .with_context(|| format!("Failed to render template '{}' with context", template_name))?;
        
        println!("[TEMPLATE] Template rendered successfully ({} bytes)", rendered.len());
        Ok(rendered)
    }
}
