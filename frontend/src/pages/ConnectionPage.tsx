import ConnectionTabs from '../components/connection/ConnectionTabs'

export default function ConnectionPage() {
  return (
    <div>
      <h1>接続設定</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        AWSまたはAzureへの接続設定を行い、接続をテストしてください。
      </p>
      <ConnectionTabs />
    </div>
  )
}
