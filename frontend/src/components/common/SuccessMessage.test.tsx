import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import SuccessMessage from './SuccessMessage';

describe('SuccessMessage', () => {
  it('メッセージを表示する', () => {
    // Arrange
    const message = '操作が成功しました';

    // Act
    render(<SuccessMessage message={message} />);

    // Assert
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('onCloseが未指定の場合、閉じるボタンを表示しない', () => {
    // Arrange & Act
    render(<SuccessMessage message="成功" />);

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('onCloseが指定されている場合、閉じるボタンをクリックで呼び出す', () => {
    // Arrange
    const handleClose = vi.fn();

    // Act
    render(<SuccessMessage message="成功" onClose={handleClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    // Assert
    expect(closeButton).toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
