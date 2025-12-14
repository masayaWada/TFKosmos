interface ErrorMessageProps {
  message: string
  onClose?: () => void
}

export default function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb',
      borderRadius: '4px',
      marginBottom: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#721c24',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '0 0.5rem'
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

