import apiClient from './client'

export interface Template {
  resource_type: string
  template_path: string
  has_user_override: boolean
  default_source: string
  user_source: string | null
}

export interface ValidationError {
  error_type: 'jinja2' | 'terraform'
  message: string
  line?: number
  column?: number
}

export interface ValidationResponse {
  valid: boolean
  errors: ValidationError[]
}

export const templatesApi = {
  list: async (): Promise<{ templates: Template[] }> => {
    const response = await apiClient.get('/templates')
    return response.data
  },

  get: async (resourceType: string, source: 'default' | 'user' = 'user') => {
    // URL encode the resource type to handle slashes (e.g., aws/cleanup_access_key.tf.j2)
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.get(`/templates/${encodedResourceType}`, {
      params: { source }
    })
    return response.data
  },

  save: async (resourceType: string, content: string) => {
    // URL encode the resource type to handle slashes
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.put(`/templates/${encodedResourceType}`, { content })
    return response.data
  },

  delete: async (resourceType: string) => {
    // URL encode the resource type to handle slashes
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.delete(`/templates/${encodedResourceType}`)
    return response.data
  },

  preview: async (resourceType: string, content: string, context?: any) => {
    // URL encode the resource type to handle slashes
    // Use /preview/*template_name route structure
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.post(`/templates/preview/${encodedResourceType}`, {
      content,
      context
    })
    return response.data
  },

  validate: async (resourceType: string, content: string): Promise<ValidationResponse> => {
    // URL encode the resource type to handle slashes
    const encodedResourceType = encodeURIComponent(resourceType)
    const response = await apiClient.post(`/templates/validate/${encodedResourceType}`, {
      content
    })
    return response.data
  }
}

