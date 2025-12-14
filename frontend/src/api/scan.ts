import apiClient from './client'

export interface ScanConfig {
  provider: 'aws' | 'azure'
  profile?: string
  assume_role_arn?: string
  assume_role_session_name?: string
  subscription_id?: string
  auth_method?: string
  tenant_id?: string
  scope_type?: string
  scope_value?: string
  scan_targets: Record<string, boolean>
  filters?: Record<string, string>
}

export interface ScanResponse {
  scan_id: string
  status: string
  summary?: Record<string, number>
  resources?: Record<string, any[]>
}

export interface ScanStatus {
  scan_id: string
  status: string
  progress: number
  message: string
  summary?: Record<string, number>
}

export const scanApi = {
  scanAws: async (config: ScanConfig): Promise<{ scan_id: string; status: string }> => {
    const response = await apiClient.post('/scan/aws', { config })
    return response.data
  },

  scanAzure: async (config: ScanConfig): Promise<{ scan_id: string; status: string }> => {
    const response = await apiClient.post('/scan/azure', { config })
    return response.data
  },

  getStatus: async (scanId: string): Promise<ScanStatus> => {
    const response = await apiClient.get(`/scan/${scanId}/status`)
    return response.data
  }
}

export interface AzureSubscription {
  subscription_id: string
  display_name: string
  state: string
}

export interface AzureResourceGroup {
  name: string
  location: string
}

export const azureApi = {
  listSubscriptions: async (authMethod?: string, tenantId?: string, clientId?: string, clientSecret?: string): Promise<{ subscriptions: AzureSubscription[] }> => {
    const params = new URLSearchParams()
    if (authMethod) params.append('auth_method', authMethod)
    if (tenantId) params.append('tenant_id', tenantId)
    if (clientId) params.append('client_id', clientId)
    if (clientSecret) params.append('client_secret', clientSecret)
    const response = await apiClient.get(`/connection/azure/subscriptions?${params.toString()}`)
    return response.data
  },

  listResourceGroups: async (subscriptionId: string, authMethod?: string, tenantId?: string, clientId?: string, clientSecret?: string): Promise<{ resource_groups: AzureResourceGroup[] }> => {
    const params = new URLSearchParams()
    params.append('subscription_id', subscriptionId)
    if (authMethod) params.append('auth_method', authMethod)
    if (tenantId) params.append('tenant_id', tenantId)
    if (clientId) params.append('client_id', clientId)
    if (clientSecret) params.append('client_secret', clientSecret)
    const response = await apiClient.get(`/connection/azure/resource-groups?${params.toString()}`)
    return response.data
  }
}

