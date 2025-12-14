use anyhow::Result;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

use crate::infra::generators::terraform::TerraformGenerator;
use crate::models::{GenerationConfig, GenerationResponse};
use crate::services::scan_service::ScanService;

pub struct GenerationService;

impl GenerationService {
    pub async fn generate_terraform(
        scan_id: &str,
        config: GenerationConfig,
        selected_resources: HashMap<String, Vec<Value>>,
    ) -> Result<GenerationResponse> {
        // Get scan data
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        // Generate Terraform code
        let generation_id = Uuid::new_v4().to_string();
        let output_path = PathBuf::from(&config.output_path).join(&generation_id);

        std::fs::create_dir_all(&output_path)?;

        let files =
            TerraformGenerator::generate(&scan_data, &config, &selected_resources, &output_path)
                .await?;

        // Generate import script
        let import_script_path = TerraformGenerator::generate_import_script(
            &scan_data,
            &config,
            &selected_resources,
            &output_path,
        )
        .await?;

        // Generate preview: read first 1000 characters of each generated file
        let mut preview = std::collections::HashMap::new();
        for file_path in &files {
            let full_path = output_path.join(file_path);
            if full_path.exists() && full_path.is_file() {
                if let Ok(content) = std::fs::read_to_string(&full_path) {
                    // Limit preview to first 1000 characters (not bytes)
                    let preview_content = Self::truncate_to_chars(&content, 1000);
                    preview.insert(file_path.clone(), preview_content);
                }
            }
        }

        // Also include import script in preview if it exists
        if let Some(ref script_path) = import_script_path {
            let full_path = output_path.join(script_path);
            if full_path.exists() && full_path.is_file() {
                if let Ok(content) = std::fs::read_to_string(&full_path) {
                    // Limit preview to first 1000 characters (not bytes)
                    let preview_content = Self::truncate_to_chars(&content, 1000);
                    preview.insert(script_path.clone(), preview_content);
                }
            }
        }

        Ok(GenerationResponse {
            generation_id,
            output_path: output_path.to_string_lossy().to_string(),
            files,
            import_script_path,
            preview: Some(preview),
        })
    }

    pub async fn create_zip(output_path: &str, _generation_id: &str) -> Result<Vec<u8>> {
        use zip::write::{FileOptions, ZipWriter};
        use zip::CompressionMethod;

        let mut zip_data = Vec::new();
        {
            let mut zip = ZipWriter::new(std::io::Cursor::new(&mut zip_data));
            let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

            let path = PathBuf::from(output_path);
            if path.exists() {
                Self::add_directory_to_zip(&mut zip, &path, &path, options)?;
            }

            zip.finish()?;
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