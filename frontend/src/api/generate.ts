import apiClient from "./client";

export interface GenerationConfig {
  output_path: string;
  file_split_rule?: string;
  naming_convention?: string;
  import_script_format?: string;
  generate_readme?: boolean;
  selected_resources?: Record<string, string[]>;
}

export interface GenerationResponse {
  generation_id: string;
  output_path: string;
  files: string[];
  preview?: Record<string, string>;
}

export interface TerraformStatus {
  available: boolean;
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FormatResult {
  formatted: boolean;
  diff?: string;
  files_changed: string[];
}

export const generateApi = {
  generate: async (
    scanId: string,
    config: GenerationConfig,
    selectedResources: Record<string, string[]>
  ) => {
    const response = await apiClient.post("/generate/terraform", {
      scan_id: scanId,
      config,
      selected_resources: selectedResources,
    });
    return response.data;
  },

  download: async (generationId: string) => {
    try {
      const response = await apiClient.get(
        `/generate/${generationId}/download`,
        {
          responseType: "blob",
        }
      );

      // Check if blob is empty
      if (response.data.size === 0) {
        throw new Error(
          "ダウンロードされたZIPファイルが空です。生成されたファイルが存在しない可能性があります。"
        );
      }

      // Check if response is actually a ZIP file (check Content-Type)
      const contentType = response.headers["content-type"];
      if (contentType && contentType.includes("application/json")) {
        // Error response was returned as JSON, parse it
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.detail || "ダウンロードに失敗しました");
      }

      return response.data;
    } catch (error: any) {
      // Handle axios errors
      if (error.response) {
        const contentType = error.response.headers["content-type"];
        // If error response is JSON, parse it
        if (contentType && contentType.includes("application/json")) {
          const text = await error.response.data.text();
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || "ダウンロードに失敗しました");
          } catch {
            throw new Error(
              `ダウンロードに失敗しました (HTTP ${error.response.status})`
            );
          }
        } else {
          // Blob error response, try to parse as text
          try {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || "ダウンロードに失敗しました");
          } catch {
            throw new Error(
              `ダウンロードに失敗しました (HTTP ${error.response.status})`
            );
          }
        }
      }
      throw error;
    }
  },

  checkTerraform: async (): Promise<TerraformStatus> => {
    const response = await apiClient.get("/generate/terraform/check");
    return response.data;
  },

  validate: async (generationId: string): Promise<ValidationResult> => {
    const response = await apiClient.post(`/generate/${generationId}/validate`);
    return response.data;
  },

  checkFormat: async (generationId: string): Promise<FormatResult> => {
    const response = await apiClient.get(`/generate/${generationId}/format/check`);
    return response.data;
  },

  format: async (
    generationId: string
  ): Promise<{ success: boolean; files_formatted: string[] }> => {
    const response = await apiClient.post(`/generate/${generationId}/format`);
    return response.data;
  },
};
