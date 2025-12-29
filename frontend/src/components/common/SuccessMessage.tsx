import { memo } from 'react';

interface SuccessMessageProps {
  message: string
  onClose?: () => void
}

const SuccessMessage = memo(function SuccessMessage({ message, onClose }: SuccessMessageProps) {
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#d4edda',
      color: '#155724',
      border: '1px solid #c3e6cb',
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
            color: '#155724',
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
});

export default SuccessMessage;

