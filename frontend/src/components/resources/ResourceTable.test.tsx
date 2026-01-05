import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import ResourceTable from './ResourceTable';

// ResourceDetailをモック化
vi.mock('./ResourceDetail', () => ({
  default: ({ resource, isOpen, onClose }: any) => {
    if (!isOpen || !resource) return null;
    return (
      <div data-testid="resource-detail" onClick={onClose}>
        <div data-testid="detail-resource">{JSON.stringify(resource)}</div>
        <button data-testid="detail-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    );
  },
}));

describe('ResourceTable', () => {
  const mockResources = [
    { id: '1', name: 'Resource 1', type: 'user', created_at: '2024-01-01' },
    { id: '2', name: 'Resource 2', type: 'group', created_at: '2024-01-02' },
    { id: '3', name: 'Resource 3', type: 'role', created_at: '2024-01-03' },
  ];

  const mockColumns = [
    { key: 'name', label: '名前' },
    { key: 'type', label: 'タイプ' },
    { key: 'created_at', label: '作成日' },
  ];

  const defaultProps = {
    resources: mockResources,
    selectedIds: new Set<string>(),
    onSelectionChange: vi.fn(),
    onSelectAll: vi.fn(),
    getResourceId: (resource: any) => resource.id,
    columns: mockColumns,
    resourceType: 'users',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // テーブルレンダリングのテスト
  // ========================================

  describe('テーブルレンダリング', () => {
    it('リソースが正しく表示される', () => {
      // Act
      render(<ResourceTable {...defaultProps} />);

      // Assert
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
      expect(screen.getByText('Resource 2')).toBeInTheDocument();
      expect(screen.getByText('Resource 3')).toBeInTheDocument();
    });

    it('カラムヘッダーが正しく表示される', () => {
      // Act
      render(<ResourceTable {...defaultProps} />);

      // Assert
      expect(screen.getByText('名前')).toBeInTheDocument();
      expect(screen.getByText('タイプ')).toBeInTheDocument();
      expect(screen.getByText('作成日')).toBeInTheDocument();
    });

    it('リソースが空の場合はメッセージが表示される', () => {
      // Arrange
      const props = { ...defaultProps, resources: [] };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      expect(screen.getByText('リソースが見つかりません')).toBeInTheDocument();
    });

    it('カスタムレンダラーが使用される', () => {
      // Arrange
      const customColumns = [
        {
          key: 'name',
          label: '名前',
          render: (resource: any) => <span data-testid={`custom-${resource.id}`}>{resource.name.toUpperCase()}</span>,
        },
      ];
      const props = { ...defaultProps, columns: customColumns };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      expect(screen.getByTestId('custom-1')).toHaveTextContent('RESOURCE 1');
    });

    it('値が存在しない場合は「-」が表示される', () => {
      // Arrange
      const resourcesWithMissingValues = [
        { id: '1', name: 'Resource 1' }, // typeとcreated_atが欠如
      ];
      const props = { ...defaultProps, resources: resourcesWithMissingValues };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // 選択機能のテスト
  // ========================================

  describe('選択機能', () => {
    it('個別のリソースを選択できる', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      const props = { ...defaultProps, onSelectionChange };

      // Act
      render(<ResourceTable {...props} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // 最初のチェックボックスは「すべて選択」、2つ目以降が個別リソース
      const resourceCheckbox = checkboxes[1];
      await user.click(resourceCheckbox);

      // Assert
      expect(onSelectionChange).toHaveBeenCalledWith('1', true);
    });

    it('個別のリソースを解除できる', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      const selectedIds = new Set(['1', '2']);
      const props = { ...defaultProps, selectedIds, onSelectionChange };

      // Act
      render(<ResourceTable {...props} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const resourceCheckbox = checkboxes[1]; // Resource 1のチェックボックス
      await user.click(resourceCheckbox);

      // Assert
      expect(onSelectionChange).toHaveBeenCalledWith('1', false);
    });

    it('すべて選択チェックボックスが正しく動作する', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectAll = vi.fn();
      const props = { ...defaultProps, onSelectAll };

      // Act
      render(<ResourceTable {...props} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];
      await user.click(selectAllCheckbox);

      // Assert
      expect(onSelectAll).toHaveBeenCalledWith(true);
    });

    it('すべて解除が正しく動作する', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectAll = vi.fn();
      const selectedIds = new Set(['1', '2', '3']);
      const props = { ...defaultProps, selectedIds, onSelectAll };

      // Act
      render(<ResourceTable {...props} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];
      await user.click(selectAllCheckbox);

      // Assert
      expect(onSelectAll).toHaveBeenCalledWith(false);
    });

    it('すべて選択されている場合、すべて選択チェックボックスがチェックされる', () => {
      // Arrange
      const selectedIds = new Set(['1', '2', '3']);
      const props = { ...defaultProps, selectedIds };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
    });

    it('一部のみ選択されている場合、すべて選択チェックボックスがindeterminateになる', () => {
      // Arrange
      const selectedIds = new Set(['1', '2']);
      const props = { ...defaultProps, selectedIds };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0] as HTMLInputElement;
      expect(selectAllCheckbox.indeterminate).toBe(true);
    });

    it('選択されたリソースの行がハイライトされる', () => {
      // Arrange
      const selectedIds = new Set(['1']);
      const props = { ...defaultProps, selectedIds };

      // Act
      render(<ResourceTable {...props} />);

      // Assert
      const rows = screen.getAllByRole('row');
      // ヘッダー行を除く最初の行（Resource 1）が選択されている
      const selectedRow = rows[1];
      expect(selectedRow).toHaveStyle({ backgroundColor: 'rgb(231, 243, 255)' });
    });
  });

  // ========================================
  // ソート機能のテスト
  // ========================================

  describe('ソート機能', () => {
    it('カラムヘッダーをクリックすると昇順でソートされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const nameHeader = screen.getByText('名前');
      await user.click(nameHeader);

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // ヘッダー行を除く最初のデータ行
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('Resource 1');
      });
    });

    it('同じカラムを再度クリックすると降順でソートされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const nameHeader = screen.getByText('名前');
      await user.click(nameHeader); // 昇順
      await user.click(nameHeader); // 降順

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('Resource 3');
      });
    });

    it('同じカラムを3回クリックするとソートが解除される', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const nameHeader = screen.getByText('名前');
      await user.click(nameHeader); // 昇順
      await user.click(nameHeader); // 降順
      await user.click(nameHeader); // ソート解除

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // 元の順序に戻る
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('Resource 1');
      });
    });

    it('別のカラムをクリックすると新しいカラムでソートされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const nameHeader = screen.getByText('名前');
      await user.click(nameHeader); // 名前でソート

      const typeHeader = screen.getByText('タイプ');
      await user.click(typeHeader); // タイプでソート

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('group'); // タイプでソートされた最初の値
      });
    });

    it('ソート中のカラムがハイライトされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const nameHeader = screen.getByText('名前');
      await user.click(nameHeader);

      // Assert
      await waitFor(() => {
        expect(nameHeader).toHaveStyle({ backgroundColor: 'rgb(231, 243, 255)' });
      });
    });

    it('数値カラムが正しくソートされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const resourcesWithNumbers = [
        { id: '1', name: 'Resource 1', value: 30 },
        { id: '2', name: 'Resource 2', value: 10 },
        { id: '3', name: 'Resource 3', value: 20 },
      ];
      const columns = [{ key: 'name', label: '名前' }, { key: 'value', label: '値' }];
      const props = { ...defaultProps, resources: resourcesWithNumbers, columns };

      // Act
      render(<ResourceTable {...props} />);

      const valueHeader = screen.getByText('値');
      await user.click(valueHeader);

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('10');
      });
    });

    it('null値が正しく処理される', async () => {
      // Arrange
      const user = userEvent.setup();
      const resourcesWithNulls = [
        { id: '1', name: 'Resource 1', value: null },
        { id: '2', name: 'Resource 2', value: 10 },
        { id: '3', name: 'Resource 3', value: null },
      ];
      const columns = [{ key: 'name', label: '名前' }, { key: 'value', label: '値' }];
      const props = { ...defaultProps, resources: resourcesWithNulls, columns };

      // Act
      render(<ResourceTable {...props} />);

      const valueHeader = screen.getByText('値');
      await user.click(valueHeader);

      // Assert
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // 最初のデータ行は値が10のResource 2
        const firstDataRow = rows[1];
        expect(firstDataRow).toHaveTextContent('Resource 2');
        expect(firstDataRow).toHaveTextContent('10');
        // null値は最後に来る（Resource 1とResource 3のどちらか）
        const lastDataRow = rows[3];
        expect(lastDataRow).toHaveTextContent('-'); // null値は「-」として表示される
      });
    });
  });

  // ========================================
  // 詳細展開のテスト
  // ========================================

  describe('詳細展開', () => {
    it('行をクリックすると詳細が表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      await user.click(firstDataRow);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('resource-detail')).toBeInTheDocument();
        expect(screen.getByTestId('detail-resource')).toHaveTextContent('Resource 1');
      });
    });

    it('詳細モーダルを閉じることができる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      await user.click(firstDataRow);

      await waitFor(() => {
        expect(screen.getByTestId('resource-detail')).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId('detail-close');
      await user.click(closeButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('resource-detail')).not.toBeInTheDocument();
      });
    });

    it('チェックボックスをクリックしても詳細が開かない', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const resourceCheckbox = checkboxes[1];
      await user.click(resourceCheckbox);

      // Assert
      expect(screen.queryByTestId('resource-detail')).not.toBeInTheDocument();
    });

    it('詳細が開いている状態で別の行をクリックすると新しい詳細が表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<ResourceTable {...props} />);

      const rows = screen.getAllByRole('row');
      await user.click(rows[1]); // Resource 1

      await waitFor(() => {
        expect(screen.getByTestId('detail-resource')).toHaveTextContent('Resource 1');
      });

      await user.click(rows[2]); // Resource 2

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('detail-resource')).toHaveTextContent('Resource 2');
      });
    });
  });
});

