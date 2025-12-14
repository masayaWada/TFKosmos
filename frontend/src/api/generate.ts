import apiClient from './client'

export interface GenerationConfig {
  output_path: string
  file_split_rule?: string
  naming_convention?: string
  import_script_format?: string
  generate_readme?: boolean
  selected_resources?: Record<string, string[]>
}

export interface GenerationResponse {
  generation_id: string
  output_path: string
  files: string[]
  preview?: Record<string, string>
}

export const generateApi = {
  generate: async (scanId: string, config: GenerationConfig, selectedResources: Record<string, string[]>) => {
    const response = await apiClient.post('/generate/terraform', {
      scan_id: scanId,
      config,
      selected_resources: selectedResources
    })
    return response.data
  },

  download: async (generationId: string) => {
    const response = await apiClient.get(`/generate/${generationId}/download`, {
      responseType: 'blob'
    })
    return response.data
  }
}

