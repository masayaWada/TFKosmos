import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { scanApi, ScanConfig, azureApi, AzureSubscription, AzureResourceGroup } from '../../api/scan'
import LoadingSpinner from '../common/LoadingSpinner'
import ErrorMessage from '../common/ErrorMessage'

interface ScanConfigFormProps {
  provider: 'aws' | 'azure'
  onScanComplete?: (scanId: string) => void
}

export default function ScanConfigForm({ provider, onScanComplete }: ScanConfigFormProps) {
  const navigate = useNavigate()
  const [scanTargets, setScanTargets] = useState<Record<string, boolean>>(
    provider === 'aws' 
      ? {
          users: true,
          groups: true,
          roles: false,
          policies: false,
          attachments: true,
          cleanup: false
        }
      : {
          role_definitions: true,
          role_assignments: true
        }
  )
  const [namePrefix, setNamePrefix] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [scanId, setScanId] = useState<string | null>(null)

  // AWS specific
  const [profile, setProfile] = useState('')
  const [assumeRoleArn, setAssumeRoleArn] = useState('')

  // Azure specific
  const [subscriptionId, setSubscriptionId] = useState('')
  const [scopeType, setScopeType] = useState('subscription')
  const [scopeValue, setScopeValue] = useState('')
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('')
  const [selectedResourceGroup, setSelectedResourceGroup] = useState('')
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([])
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [loadingResourceGroups, setLoadingResourceGroups] = useState(false)
  const [azureAuthSettings, setAzureAuthSettings] = useState<{
    auth_method?: string
    tenant_id?: string
    client_id?: string
    client_secret?: string
  } | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Reset scan targets when provider changes
  useEffect(() => {
    setScanTargets(
      provider === 'aws' 
        ? {
            users: true,
            groups: true,
            roles: false,
            policies: false,
            attachments: true,
            cleanup: false
          }
        : {
            role_definitions: true,
            role_assignments: true
          }
    )
  }, [provider])

  // Load subscriptions function
  const loadSubscriptions = useCallback(async () => {
    // localStorageに接続設定がない場合はスキップ
    const savedSettings = localStorage.getItem('azure_connection_settings')
    if (!savedSettings) {
      setError('接続設定が見つかりません。接続設定ページで接続テストを実行してください。')
      return
    }

    setLoadingSubscriptions(true)
    setError(null)
    try {
      const result = await azureApi.listSubscriptions(
        azureAuthSettings?.auth_method,
        azureAuthSettings?.tenant_id,
        azureAuthSettings?.client_id,
        azureAuthSettings?.client_secret
      )
      setSubscriptions(result.subscriptions)
      if (result.subscriptions.length === 0) {
        setError('サブスクリプションが見つかりませんでした。Azure CLIでログインしているか、認証情報が正しいか確認してください。')
      } else {
        setError(null) // 成功した場合はエラーをクリア
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'サブスクリプションの取得に失敗しました'
      setError(errorMessage)
      console.error('Failed to load subscriptions:', err)
    } finally {
      setLoadingSubscriptions(false)
    }
  }, [azureAuthSettings])

  // Load Azure connection settings from localStorage
  useEffect(() => {
    if (provider === 'azure') {
      const savedSettings = localStorage.getItem('azure_connection_settings')
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setAzureAuthSettings(parsed)
          setError(null) // 接続設定が見つかった場合はエラーをクリア
        } catch (e) {
          console.error('Failed to parse Azure connection settings:', e)
          setError('接続設定の読み込みに失敗しました。')
          setAzureAuthSettings({})
        }
      } else {
        // localStorageにデータがない場合でも、空のオブジェクトを設定して試行（az_loginの場合）
        setAzureAuthSettings({})
        setError('接続設定が見つかりません。接続設定ページで接続テストを実行してください。')
      }
      setSettingsLoaded(true)
    } else {
      setAzureAuthSettings(null)
      setSettingsLoaded(false)
      setError(null)
    }
  }, [provider])

  // Load subscriptions when Azure provider is selected and settings are loaded
  useEffect(() => {
    if (provider === 'azure' && settingsLoaded) {
      loadSubscriptions()
    }
  }, [provider, settingsLoaded, loadSubscriptions])

  // Load resource groups when subscription is selected and scope type is resource_group
  useEffect(() => {
    if (provider === 'azure' && scopeType === 'resource_group' && selectedSubscriptionId) {
      loadResourceGroups(selectedSubscriptionId)
    } else {
      setResourceGroups([])
      setSelectedResourceGroup('')
    }
  }, [provider, scopeType, selectedSubscriptionId])

  // Update subscriptionId and scopeValue when selections change
  useEffect(() => {
    if (scopeType === 'subscription') {
      setSubscriptionId(selectedSubscriptionId)
      setScopeValue(selectedSubscriptionId)
    } else if (scopeType === 'resource_group') {
      setSubscriptionId(selectedSubscriptionId)
      setScopeValue(selectedResourceGroup)
    } else {
      // management_group or other
      setSubscriptionId(selectedSubscriptionId)
    }
  }, [scopeType, selectedSubscriptionId, selectedResourceGroup])

  const loadResourceGroups = async (subId: string) => {
    setLoadingResourceGroups(true)
    try {
      const result = await azureApi.listResourceGroups(
        subId,
        azureAuthSettings?.auth_method,
        azureAuthSettings?.tenant_id,
        azureAuthSettings?.client_id,
        azureAuthSettings?.client_secret
      )
      setResourceGroups(result.resource_groups)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'リソースグループの取得に失敗しました')
    } finally {
      setLoadingResourceGroups(false)
    }
  }

  const handleScan = async () => {
    setLoading(true)
    setError(null)
    setProgress(0)
    setProgressMessage('スキャンを開始しています...')
    setScanId(null)

    try {
      const config: ScanConfig = {
        provider,
        scan_targets: scanTargets,
        filters: namePrefix ? { name_prefix: namePrefix } : {}
      }

      if (provider === 'aws') {
        if (profile) config.profile = profile
        if (assumeRoleArn) config.assume_role_arn = assumeRoleArn
      } else {
        if (subscriptionId) config.subscription_id = subscriptionId
        if (scopeType) config.scope_type = scopeType
        if (scopeValue) config.scope_value = scopeValue
      }

      // Start scan and get scan_id immediately
      const result = provider === 'aws'
        ? await scanApi.scanAws(config)
        : await scanApi.scanAzure(config)

      const currentScanId = result.scan_id
      setScanId(currentScanId)

      // Poll for progress while scan is running
      const progressInterval = setInterval(async () => {
        try {
          const status = await scanApi.getStatus(currentScanId)
          setProgress(status.progress || 0)
          setProgressMessage(status.message || 'スキャン中...')
          
          if (status.status === 'completed') {
            clearInterval(progressInterval)
            setProgress(100)
            setProgressMessage('スキャンが完了しました')
            setLoading(false)
            
            if (onScanComplete) {
              onScanComplete(currentScanId)
            }
            navigate(`/resources/${currentScanId}`)
          } else if (status.status === 'failed' || status.status === 'error') {
            clearInterval(progressInterval)
            setError(status.message || 'スキャンに失敗しました')
            setLoading(false)
          }
        } catch (err) {
          // Ignore errors during polling
        }
      }, 500) // Poll every 500ms

    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'スキャンに失敗しました')
      setLoading(false)
    }
  }

  const toggleTarget = (target: string) => {
    setScanTargets(prev => ({ ...prev, [target]: !prev[target] }))
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2>{provider === 'aws' ? 'AWS' : 'Azure'} IAMスキャン設定</h2>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {provider === 'aws' ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              プロファイル
            </label>
            <input
              type="text"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="default"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Assume Role ARN (オプション)
            </label>
            <input
              type="text"
              value={assumeRoleArn}
              onChange={(e) => setAssumeRoleArn(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              スコープタイプ
            </label>
            <select
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value)
                if (e.target.value !== 'resource_group') {
                  setSelectedResourceGroup('')
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="subscription">Subscription</option>
              <option value="management_group">Management Group</option>
              <option value="resource_group">Resource Group</option>
            </select>
          </div>

          {scopeType === 'subscription' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                サブスクリプション
              </label>
              {loadingSubscriptions ? (
                <div style={{ padding: '0.5rem', color: '#666' }}>読み込み中...</div>
              ) : (
                <select
                  value={selectedSubscriptionId}
                  onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">選択してください</option>
                  {subscriptions.map((sub) => (
                    <option key={sub.subscription_id} value={sub.subscription_id}>
                      {sub.display_name} ({sub.subscription_id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {scopeType === 'resource_group' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  サブスクリプション
                </label>
                {loadingSubscriptions ? (
                  <div style={{ padding: '0.5rem', color: '#666' }}>読み込み中...</div>
                ) : (
                  <select
                    value={selectedSubscriptionId}
                    onChange={(e) => {
                      setSelectedSubscriptionId(e.target.value)
                      setSelectedResourceGroup('')
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="">選択してください</option>
                    {subscriptions.map((sub) => (
                      <option key={sub.subscription_id} value={sub.subscription_id}>
                        {sub.display_name} ({sub.subscription_id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedSubscriptionId && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    リソースグループ
                  </label>
                  {loadingResourceGroups ? (
                    <div style={{ padding: '0.5rem', color: '#666' }}>読み込み中...</div>
                  ) : (
                    <select
                      value={selectedResourceGroup}
                      onChange={(e) => setSelectedResourceGroup(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="">選択してください</option>
                      {resourceGroups.map((rg) => (
                        <option key={rg.name} value={rg.name}>
                          {rg.name} ({rg.location})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}

          {scopeType === 'management_group' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                サブスクリプション（認証用）
              </label>
              {loadingSubscriptions ? (
                <div style={{ padding: '0.5rem', color: '#666' }}>読み込み中...</div>
              ) : (
                <select
                  value={selectedSubscriptionId}
                  onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">選択してください</option>
                  {subscriptions.map((sub) => (
                    <option key={sub.subscription_id} value={sub.subscription_id}>
                      {sub.display_name} ({sub.subscription_id})
                    </option>
                  ))}
                </select>
              )}
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  管理グループ名
                </label>
                <input
                  type="text"
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  placeholder="管理グループ名を入力"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          スキャン対象
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {provider === 'aws' ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.users}
                  onChange={() => toggleTarget('users')}
                />
                Users
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.groups}
                  onChange={() => toggleTarget('groups')}
                />
                Groups
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.roles}
                  onChange={() => toggleTarget('roles')}
                />
                Roles
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.policies}
                  onChange={() => toggleTarget('policies')}
                />
                Policies
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.attachments}
                  onChange={() => toggleTarget('attachments')}
                />
                Attachments
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.cleanup}
                  onChange={() => toggleTarget('cleanup')}
                />
                Cleanup (Access Keys, Login Profiles, MFA)
              </label>
            </>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.role_definitions}
                  onChange={() => toggleTarget('role_definitions')}
                />
                Role Definitions
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={scanTargets.role_assignments}
                  onChange={() => toggleTarget('role_assignments')}
                />
                Role Assignments
              </label>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          名前プレフィックスフィルタ (オプション)
        </label>
        <input
          type="text"
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
          placeholder="prod-"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <button
        onClick={handleScan}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          marginBottom: loading ? '1rem' : '0'
        }}
      >
        {loading ? 'スキャン実行中...' : 'スキャン実行'}
      </button>
      {loading && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ 
            width: '100%', 
            backgroundColor: '#e0e0e0', 
            borderRadius: '4px', 
            height: '24px',
            marginBottom: '0.5rem',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              backgroundColor: '#28a745',
              height: '100%',
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {progress > 10 ? `${progress}%` : ''}
            </div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontSize: '14px',
            marginTop: '0.5rem'
          }}>
            {progressMessage || 'スキャン中...'}
          </div>
          {progress < 100 && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <LoadingSpinner />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

