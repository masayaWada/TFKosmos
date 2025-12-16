use anyhow::{Context, Result};
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
        println!("[GENERATION_SERVICE] Starting generation for scan_id: {}", scan_id);
        println!("[GENERATION_SERVICE] Config: output_path={}, file_split_rule={}, naming_convention={}", 
                 config.output_path, config.file_split_rule, config.naming_convention);
        println!("[GENERATION_SERVICE] Selected resources: {:?}", selected_resources);
        
        // Get scan data
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found: {}", scan_id))?;

        println!("[GENERATION_SERVICE] Scan data retrieved. Provider: {:?}", 
                 scan_data.get("provider"));

        // Generate Terraform code
        let generation_id = Uuid::new_v4().to_string();
        
        // Resolve output path - handle relative paths
        let output_path = if config.output_path.starts_with('/') || 
            (cfg!(windows) && config.output_path.contains(':')) {
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

        println!("[GENERATION_SERVICE] Creating output directory: {:?}", output_path);
        println!("[GENERATION_SERVICE] Output path exists: {}", output_path.exists());
        std::fs::create_dir_all(&output_path)
            .with_context(|| format!("Failed to create output directory: {:?}", output_path))?;
        
        // Verify directory was created
        if !output_path.exists() {
            return Err(anyhow::anyhow!("Output directory was not created: {:?}", output_path));
        }
        println!("[GENERATION_SERVICE] Output directory created successfully: {:?}", output_path);

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
            println!("[GENERATION_SERVICE] Import script generated: {}", script_path);
        } else {
            println!("[GENERATION_SERVICE] No import script generated (no resources to import)");
        }

        // Generate preview: read first 1000 characters of each generated file
        println!("[GENERATION_SERVICE] Generating preview for {} files", files.len());
        let mut preview = std::collections::HashMap::new();
        for file_path in &files {
            let full_path = output_path.join(file_path);
            println!("[GENERATION_SERVICE] Reading preview for file: {:?}", full_path);
            if full_path.exists() && full_path.is_file() {
                match std::fs::read_to_string(&full_path) {
                    Ok(content) => {
                        // Limit preview to first 1000 characters (not bytes)
                        let preview_content = Self::truncate_to_chars(&content, 1000);
                        let preview_len = preview_content.len();
                        preview.insert(file_path.clone(), preview_content);
                        println!("[GENERATION_SERVICE] Preview generated for {} ({} chars)", file_path, preview_len);
                    }
                    Err(e) => {
                        eprintln!("[GENERATION_SERVICE] Failed to read file for preview: {:?}, error: {}", full_path, e);
                    }
                }
            } else {
                eprintln!("[GENERATION_SERVICE] File does not exist for preview: {:?}", full_path);
            }
        }

        // Also include import script in preview if it exists
        if let Some(ref script_path) = import_script_path {
            let full_path = output_path.join(script_path);
            println!("[GENERATION_SERVICE] Reading preview for import script: {:?}", full_path);
            if full_path.exists() && full_path.is_file() {
                match std::fs::read_to_string(&full_path) {
                    Ok(content) => {
                        // Limit preview to first 1000 characters (not bytes)
                        let preview_content = Self::truncate_to_chars(&content, 1000);
                        let preview_len = preview_content.len();
                        preview.insert(script_path.clone(), preview_content);
                        println!("[GENERATION_SERVICE] Preview generated for import script ({} chars)", preview_len);
                    }
                    Err(e) => {
                        eprintln!("[GENERATION_SERVICE] Failed to read import script for preview: {:?}, error: {}", full_path, e);
                    }
                }
            } else {
                eprintln!("[GENERATION_SERVICE] Import script does not exist for preview: {:?}", full_path);
            }
        }
        
        println!("[GENERATION_SERVICE] Preview generation complete. {} files in preview", preview.len());

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