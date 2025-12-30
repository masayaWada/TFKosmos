import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('メッセージを表示する', () => {
    // Arrange
    const message = 'エラーが発生しました';

    // Act
    render(<ErrorMessage message={message} />);

    // Assert
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('複数行のメッセージを正しく表示する', () => {
    // Arrange
    const multilineMessage = `エラー1
エラー2
エラー3`;

    // Act
    render(<ErrorMessage message={multilineMessage} />);

    // Assert
    expect(screen.getByText('エラー1')).toBeInTheDocument();
    expect(screen.getByText('エラー2')).toBeInTheDocument();
    expect(screen.getByText('エラー3')).toBeInTheDocument();
  });

  it('onCloseが未指定の場合、閉じるボタンを表示しない', () => {
    // Arrange & Act
    render(<ErrorMessage message="エラー" />);

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('onCloseが指定されている場合、閉じるボタンをクリックで呼び出す', () => {
    // Arrange
    const handleClose = vi.fn();

    // Act
    render(<ErrorMessage message="エラー" onClose={handleClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    // Assert
    expect(closeButton).toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
