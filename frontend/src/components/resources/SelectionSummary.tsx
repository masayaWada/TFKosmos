import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface SelectionSummaryProps {
  selectedCount: number
  scanId: string
}

const SelectionSummary = memo(function SelectionSummary({ selectedCount, scanId }: SelectionSummaryProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(`/generate/${scanId}`);
  }, [navigate, scanId]);

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      backgroundColor: 'white',
      padding: '1rem',
      borderTop: '1px solid #ddd',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
    }}>
      <div>
        <strong>{selectedCount}</strong> 個のリソースが選択されています
      </div>
      <button
        onClick={handleClick}
        disabled={selectedCount === 0}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: selectedCount > 0 ? '#28a745' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: selectedCount > 0 ? 'pointer' : 'not-allowed'
        }}
      >
        生成設定へ進む
      </button>
    </div>
  )
});

export default SelectionSummary;

