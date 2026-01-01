import { useState } from 'react'

interface Props {
  onQuery: (query: string) => void
  onClear: () => void
  isLoading?: boolean
  error?: string
}

export default function QueryInput({ onQuery, onClear, isLoading, error }: Props) {
  const [query, setQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onQuery(query.trim())
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='例: tags.env == "production" AND user_name LIKE "app-*"'
          style={{
            flex: 1,
            padding: '0.5rem',
            border: error ? '1px solid #dc3545' : '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '検索中...' : '検索'}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('')
            onClear()
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          クリア
        </button>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          style={{
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ?
        </button>
      </form>

      {error && (
        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {error}
        </div>
      )}

      {showHelp && (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '1rem',
          marginTop: '0.5rem',
          fontSize: '0.875rem',
        }}>
          <strong>クエリ構文</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li><code>field == "value"</code> - 等価</li>
            <li><code>field != "value"</code> - 不等価</li>
            <li><code>field LIKE "pattern*"</code> - パターンマッチ</li>
            <li><code>field IN ["a", "b"]</code> - 配列に含まれる</li>
            <li><code>expr AND expr</code> - 論理積</li>
            <li><code>expr OR expr</code> - 論理和</li>
            <li><code>NOT expr</code> - 否定</li>
            <li><code>tags.env</code> - ネストフィールドアクセス</li>
          </ul>
          <strong>例</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li><code>user_name == "admin"</code></li>
            <li><code>tags.env == "production"</code></li>
            <li><code>path LIKE "/admin/*"</code></li>
            <li><code>role IN ["admin", "moderator"]</code></li>
            <li><code>tags.env == "production" AND user_name LIKE "app-*"</code></li>
            <li><code>(path == "/" OR path LIKE "/admin/*") AND NOT tags.temporary == "true"</code></li>
          </ul>
        </div>
      )}
    </div>
  )
}
