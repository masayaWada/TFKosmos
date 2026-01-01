import apiClient from './client'

export interface DependencyNode {
  id: string
  node_type: string
  name: string
  data: any
}

export interface DependencyEdge {
  source: string
  target: string
  edge_type: string
  label?: string
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
}

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
  },

  query: async (
    scanId: string,
    query: string,
    options?: { type?: string; page?: number; pageSize?: number }
  ) => {
    const response = await apiClient.post(`/resources/${scanId}/query`, {
      query,
      type: options?.type,
      page: options?.page,
      page_size: options?.pageSize,
    })
    return response.data
  },

  getDependencies: async (
    scanId: string,
    rootId?: string
  ): Promise<DependencyGraph> => {
    const params = rootId ? { root_id: rootId } : {}
    const response = await apiClient.get(`/resources/${scanId}/dependencies`, { params })
    return response.data
  }
}

