import { ReactNode } from 'react'

interface ResourceTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: { id: string; label: string }[]
  children: ReactNode
}

export default function ResourceTabs({ activeTab, onTabChange, tabs, children }: ResourceTabsProps) {
  return (
    <div>
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === tab.id ? '#007bff' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#333',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #007bff' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}

