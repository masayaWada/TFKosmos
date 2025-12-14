import apiClient from './client'

export interface AwsConnectionConfig {
  profile?: string
  assume_role_arn?: string
  assume_role_session_name?: string
}

export interface AzureConnectionConfig {
  auth_method?: string
  tenant_id?: string
  service_principal_config?: Record<string, string>
}

export const connectionApi = {
  awsLogin: async (profile?: string, region?: string) => {
    const response = await apiClient.post('/connection/aws/login', {
      profile,
      region
    })
    return response.data
  },

  testAws: async (config: AwsConnectionConfig) => {
    const response = await apiClient.post('/connection/aws/test', {
      provider: 'aws',
      ...config
    })
    return response.data
  },

  testAzure: async (config: AzureConnectionConfig) => {
    const response = await apiClient.post('/connection/azure/test', {
      provider: 'azure',
      ...config
    })
    return response.data
  }
}

