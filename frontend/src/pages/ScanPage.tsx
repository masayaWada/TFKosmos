import { useState } from 'react'
import ScanConfigForm from '../components/scan/ScanConfigForm'

export default function ScanPage() {
  const [provider, setProvider] = useState<'aws' | 'azure'>('aws')

  return (
    <div>
      <h1>スキャン設定</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        IAMリソースをスキャンするプロバイダーを選択してください。
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>プロバイダー:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="radio"
              value="aws"
              checked={provider === 'aws'}
              onChange={(e) => setProvider(e.target.value as 'aws' | 'azure')}
            />
            AWS
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="radio"
              value="azure"
              checked={provider === 'azure'}
              onChange={(e) => setProvider(e.target.value as 'aws' | 'azure')}
            />
            Azure
          </label>
        </label>
      </div>

      <ScanConfigForm provider={provider} />
    </div>
  )
}
