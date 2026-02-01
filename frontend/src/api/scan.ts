import apiClient from './client'

// ========================================
// 型定義
// ========================================

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
  /** タグ情報を取得するかどうか（デフォルト: true） */
  include_tags?: boolean
}

export interface ScanResponse {
  scan_id: string
  status: string
  summary?: Record<string, number>
  resources?: Record<string, unknown[]>
}

export interface ScanStatus {
  scan_id: string
  status: string
  progress: number
  message: string
  summary?: Record<string, number>
}

/** SSEストリーミングスキャンの進捗イベント */
export interface ScanProgressEvent {
  scan_id: string
  event_type: 'progress' | 'resource' | 'completed' | 'error'
  progress: number
  message: string
  resource_type?: string
  resource_count?: number
  data?: unknown
}

/** ストリーミングスキャンのコールバック関数 */
export interface ScanStreamCallbacks {
  onProgress?: (event: ScanProgressEvent) => void
  onResource?: (event: ScanProgressEvent) => void
  onCompleted?: (event: ScanProgressEvent) => void
  onError?: (error: Error | ScanProgressEvent) => void
}

// ========================================
// ヘルパー関数
// ========================================

/** APIのベースURLを取得（SSE用） */
function getApiBaseUrl(): string {
  const isTauri =
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ !== undefined

  return isTauri ? 'http://localhost:8000/api' : '/api'
}

/**
 * fetch APIを使用してSSEストリームを処理
 * EventSourceはGETのみ対応のため、POSTでSSEを受け取る場合はfetchを使用
 */
async function fetchSSEStream(
  url: string,
  body: unknown,
  callbacks: ScanStreamCallbacks
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSEイベントをパース（\n\nで区切られる）
      const events = buffer.split('\n\n')
      buffer = events.pop() || '' // 最後の不完全なイベントをバッファに保持

      for (const eventStr of events) {
        if (!eventStr.trim()) continue

        const lines = eventStr.split('\n')
        let eventData = ''

        for (const line of lines) {
          // event: はSSE仕様で使用されるが、データ内のevent_typeで判別するため読み飛ばし
          if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }

        if (eventData) {
          try {
            const event: ScanProgressEvent = JSON.parse(eventData)

            switch (event.event_type) {
              case 'progress':
                callbacks.onProgress?.(event)
                break
              case 'resource':
                callbacks.onResource?.(event)
                break
              case 'completed':
                callbacks.onCompleted?.(event)
                break
              case 'error':
                callbacks.onError?.(event)
                break
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError, eventData)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const scanApi = {
  /**
   * AWSスキャンを開始（従来のポーリング方式）
   */
  scanAws: async (config: ScanConfig): Promise<{ scan_id: string; status: string }> => {
    const response = await apiClient.post('/scan/aws', { config })
    return response.data
  },

  /**
   * Azureスキャンを開始（従来のポーリング方式）
   */
  scanAzure: async (config: ScanConfig): Promise<{ scan_id: string; status: string }> => {
    const response = await apiClient.post('/scan/azure', { config })
    return response.data
  },

  /**
   * スキャンステータスを取得
   */
  getStatus: async (scanId: string): Promise<ScanStatus> => {
    const response = await apiClient.get(`/scan/${scanId}/status`)
    return response.data
  },

  /**
   * AWSスキャンをSSEストリーミングで実行
   *
   * スキャンの進捗をリアルタイムでコールバック関数に通知します。
   * 従来のポーリング方式と比べて、より即座に進捗を受け取れます。
   *
   * @param config スキャン設定
   * @param callbacks 進捗通知用コールバック関数
   */
  scanAwsStream: async (
    config: ScanConfig,
    callbacks: ScanStreamCallbacks
  ): Promise<void> => {
    const baseUrl = getApiBaseUrl()
    await fetchSSEStream(`${baseUrl}/scan/aws/stream`, { config }, callbacks)
  },

  /**
   * AzureスキャンをSSEストリーミングで実行
   *
   * @param config スキャン設定
   * @param callbacks 進捗通知用コールバック関数
   */
  scanAzureStream: async (
    config: ScanConfig,
    callbacks: ScanStreamCallbacks
  ): Promise<void> => {
    const baseUrl = getApiBaseUrl()
    await fetchSSEStream(`${baseUrl}/scan/azure/stream`, { config }, callbacks)
  },

  /**
   * プロバイダーに応じたストリーミングスキャンを実行
   *
   * @param config スキャン設定
   * @param callbacks 進捗通知用コールバック関数
   */
  scanStream: async (
    config: ScanConfig,
    callbacks: ScanStreamCallbacks
  ): Promise<void> => {
    if (config.provider === 'aws') {
      await scanApi.scanAwsStream(config, callbacks)
    } else if (config.provider === 'azure') {
      await scanApi.scanAzureStream(config, callbacks)
    } else {
      throw new Error(`Unknown provider: ${config.provider}`)
    }
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

