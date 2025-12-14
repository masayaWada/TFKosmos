import { useState } from 'react'
import AwsConnectionForm from './AwsConnectionForm'
import AzureConnectionForm from './AzureConnectionForm'

export default function ConnectionTabs() {
  const [activeTab, setActiveTab] = useState<'aws' | 'azure'>('aws')

  return (
    <div>
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('aws')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'aws' ? '#007bff' : 'transparent',
            color: activeTab === 'aws' ? 'white' : '#333',
            cursor: 'pointer',
            borderBottom: activeTab === 'aws' ? '2px solid #007bff' : '2px solid transparent'
          }}
        >
          AWS
        </button>
        <button
          onClick={() => setActiveTab('azure')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'azure' ? '#007bff' : 'transparent',
            color: activeTab === 'azure' ? 'white' : '#333',
            cursor: 'pointer',
            borderBottom: activeTab === 'azure' ? '2px solid #007bff' : '2px solid transparent'
          }}
        >
          Azure
        </button>
      </div>
      {activeTab === 'aws' ? <AwsConnectionForm /> : <AzureConnectionForm />}
    </div>
  )
}

