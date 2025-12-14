use anyhow::Result;
use std::path::PathBuf;

pub struct TemplateManager;

impl TemplateManager {
    pub async fn load_template(template_name: &str) -> Result<String> {
        // Try user templates first, then default templates
        let user_path = PathBuf::from("templates_user/terraform").join(template_name);
        let default_path = PathBuf::from("templates_default/terraform").join(template_name);

        if user_path.exists() {
            Ok(std::fs::read_to_string(user_path)?)
        } else if default_path.exists() {
            Ok(std::fs::read_to_string(default_path)?)
        } else {
            Err(anyhow::anyhow!("Template not found: {}", template_name))
        }
    }

    pub async fn render_template(
        template_name: &str,
        context: &serde_json::Value,
    ) -> Result<String> {
        let template_content = Self::load_template(template_name).await?;

        // Use minijinja to render template
        let mut env = minijinja::Environment::new();
        env.add_template(template_name, &template_content)?;

        let template = env.get_template(template_name)?;
        Ok(template.render(context)?)
    }
}
