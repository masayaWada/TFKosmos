import apiClient from './client'

export const resourcesApi = {
  getResources: async (
    scanId: string,
    type?: string,
    page: number = 1,
    pageSize: number = 50,
    filter?: string
  ) => {
    const params: any = { page, page_size: pageSize }
    if (type) params.type = type
    if (filter) params.filter = filter
    const response = await apiClient.get(`/resources/${scanId}`, { params })
    return response.data
  },

  selectResources: async (scanId: string, selections: Record<string, string[]>) => {
    const response = await apiClient.post(`/resources/${scanId}/select`, { selections })
    return response.data
  },

  getSelectedResources: async (scanId: string) => {
    const response = await apiClient.get(`/resources/${scanId}/select`)
    return response.data
  }
}

