import { ValidationError } from '../../api/templates'

interface Props {
  errors: ValidationError[]
  onErrorClick?: (error: ValidationError) => void
}

export default function ValidationErrors({ errors, onErrorClick }: Props) {
  if (errors.length === 0) return null

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '4px',
      padding: '0.75rem',
      marginBottom: '1rem'
    }}>
      <strong>バリデーションエラー ({errors.length})</strong>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
        {errors.map((error, index) => (
          <li
            key={index}
            onClick={() => onErrorClick?.(error)}
            style={{ cursor: error.line ? 'pointer' : 'default', color: '#856404' }}
          >
            [{error.error_type}]
            {error.line && ` 行${error.line}`}
            {error.column && `:${error.column}`}
            : {error.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
