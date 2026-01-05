import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import QueryInput from './QueryInput';

describe('QueryInput', () => {
  const defaultProps = {
    onQuery: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // クエリ検証のテスト
  // ========================================

  describe('クエリ検証', () => {
    it('クエリ入力フィールドが表示される', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      expect(input).toBeInTheDocument();
    });

    it('クエリを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'user_name == "test"');

      // Assert
      expect(input).toHaveValue('user_name == "test"');
    });

    it('空のクエリでは検索ボタンが無効になる', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      const submitButton = screen.getByRole('button', { name: /検索/ });
      expect(submitButton).toBeDisabled();
    });

    it('空白のみのクエリでは検索ボタンが無効になる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, '   ');

      // Assert
      const submitButton = screen.getByRole('button', { name: /検索/ });
      expect(submitButton).toBeDisabled();
    });

    it('有効なクエリでは検索ボタンが有効になる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'user_name == "test"');

      // Assert
      const submitButton = screen.getByRole('button', { name: /検索/ });
      expect(submitButton).not.toBeDisabled();
    });

    it('クエリ入力時に前後の空白がトリムされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const onQuery = vi.fn();
      const props = { ...defaultProps, onQuery };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, '  user_name == "test"  ');

      const submitButton = screen.getByRole('button', { name: /検索/ });
      await user.click(submitButton);

      // Assert
      expect(onQuery).toHaveBeenCalledWith('user_name == "test"');
    });
  });

  // ========================================
  // エラー表示のテスト
  // ========================================

  describe('エラー表示', () => {
    it('エラーがない場合はエラーメッセージが表示されない', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      expect(screen.queryByText(/エラー/i)).not.toBeInTheDocument();
    });

    it('エラープロップが渡されるとエラーメッセージが表示される', () => {
      // Arrange
      const props = { ...defaultProps, error: 'クエリ構文エラー' };

      // Act
      render(<QueryInput {...props} />);

      // Assert
      expect(screen.getByText('クエリ構文エラー')).toBeInTheDocument();
    });

    it('エラーがある場合、入力フィールドのボーダーが赤くなる', () => {
      // Arrange
      const props = { ...defaultProps, error: 'クエリ構文エラー' };

      // Act
      render(<QueryInput {...props} />);

      // Assert
      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      expect(input).toHaveStyle({ border: '1px solid rgb(220, 53, 69)' });
    });

    it('エラーがない場合、入力フィールドのボーダーが通常色になる', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      expect(input).toHaveStyle({ border: '1px solid rgb(221, 221, 221)' });
    });
  });

  // ========================================
  // クエリ実行のテスト
  // ========================================

  describe('クエリ実行', () => {
    it('フォーム送信でクエリが実行される', async () => {
      // Arrange
      const user = userEvent.setup();
      const onQuery = vi.fn();
      const props = { ...defaultProps, onQuery };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'user_name == "test"');

      const form = input.closest('form');
      if (form) {
        await userEvent.type(input, '{enter}');
      }

      // Assert
      await waitFor(() => {
        expect(onQuery).toHaveBeenCalledWith('user_name == "test"');
      });
    });

    it('検索ボタンをクリックするとクエリが実行される', async () => {
      // Arrange
      const user = userEvent.setup();
      const onQuery = vi.fn();
      const props = { ...defaultProps, onQuery };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'user_name == "test"');

      const submitButton = screen.getByRole('button', { name: /検索/ });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(onQuery).toHaveBeenCalledWith('user_name == "test"');
      });
    });

    it('ローディング中は検索ボタンが無効になる', () => {
      // Arrange
      const props = { ...defaultProps, isLoading: true };

      // Act
      render(<QueryInput {...props} />);

      // Assert
      const submitButton = screen.getByRole('button', { name: /検索中.../ });
      expect(submitButton).toBeDisabled();
    });

    it('ローディング中は検索ボタンのテキストが変わる', () => {
      // Arrange
      const props = { ...defaultProps, isLoading: true };

      // Act
      render(<QueryInput {...props} />);

      // Assert
      expect(screen.getByText('検索中...')).toBeInTheDocument();
    });

    it('ローディング中でもクエリ入力は可能', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps, isLoading: true };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'test query');

      // Assert
      expect(input).toHaveValue('test query');
    });

    it('ローディング中はクエリ実行ができない', async () => {
      // Arrange
      const user = userEvent.setup();
      const onQuery = vi.fn();
      const props = { ...defaultProps, onQuery, isLoading: true };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'test query');

      const submitButton = screen.getByRole('button', { name: /検索中.../ });
      await user.click(submitButton);

      // Assert
      expect(onQuery).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // クリア機能のテスト
  // ========================================

  describe('クリア機能', () => {
    it('クリアボタンが表示される', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      expect(screen.getByRole('button', { name: /クリア/ })).toBeInTheDocument();
    });

    it('クリアボタンをクリックするとクエリがクリアされる', async () => {
      // Arrange
      const user = userEvent.setup();
      const onClear = vi.fn();
      const props = { ...defaultProps, onClear };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'test query');

      const clearButton = screen.getByRole('button', { name: /クリア/ });
      await user.click(clearButton);

      // Assert
      expect(input).toHaveValue('');
      expect(onClear).toHaveBeenCalled();
    });

    it('クリア後は検索ボタンが無効になる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const input = screen.getByPlaceholderText(/例: tags.env == "production"/);
      await user.type(input, 'test query');

      const clearButton = screen.getByRole('button', { name: /クリア/ });
      await user.click(clearButton);

      // Assert
      const submitButton = screen.getByRole('button', { name: /検索/ });
      expect(submitButton).toBeDisabled();
    });
  });

  // ========================================
  // ヘルプ表示のテスト
  // ========================================

  describe('ヘルプ表示', () => {
    it('ヘルプボタンが表示される', () => {
      // Act
      render(<QueryInput {...defaultProps} />);

      // Assert
      expect(screen.getByRole('button', { name: '?' })).toBeInTheDocument();
    });

    it('ヘルプボタンをクリックするとヘルプが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const helpButton = screen.getByRole('button', { name: '?' });
      await user.click(helpButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('クエリ構文')).toBeInTheDocument();
      });
    });

    it('ヘルプボタンを再度クリックするとヘルプが非表示になる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const helpButton = screen.getByRole('button', { name: '?' });
      await user.click(helpButton);

      await waitFor(() => {
        expect(screen.getByText('クエリ構文')).toBeInTheDocument();
      });

      await user.click(helpButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('クエリ構文')).not.toBeInTheDocument();
      });
    });

    it('ヘルプにクエリ構文の説明が含まれる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const helpButton = screen.getByRole('button', { name: '?' });
      await user.click(helpButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/field == "value"/)).toBeInTheDocument();
        expect(screen.getByText(/field != "value"/)).toBeInTheDocument();
        expect(screen.getByText(/field LIKE "pattern\*"/)).toBeInTheDocument();
        expect(screen.getByText(/expr AND expr/)).toBeInTheDocument();
        expect(screen.getByText(/expr OR expr/)).toBeInTheDocument();
      });
    });

    it('ヘルプにクエリの例が含まれる', async () => {
      // Arrange
      const user = userEvent.setup();
      const props = { ...defaultProps };

      // Act
      render(<QueryInput {...props} />);

      const helpButton = screen.getByRole('button', { name: '?' });
      await user.click(helpButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/user_name == "admin"/)).toBeInTheDocument();
        // tags.env == "production"は複数箇所に存在するため、getAllByTextを使用
        const tagsEnvElements = screen.getAllByText(/tags\.env == "production"/);
        expect(tagsEnvElements.length).toBeGreaterThan(0);
      });
    });
  });
});

