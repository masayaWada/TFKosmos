import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('メッセージを表示する', () => {
    render(<ErrorMessage message="エラーが発生しました" />);
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
  });

  it('複数行のメッセージを正しく表示する', () => {
    const multilineMessage = `エラー1
エラー2
エラー3`;
    render(<ErrorMessage message={multilineMessage} />);
    expect(screen.getByText('エラー1')).toBeInTheDocument();
    expect(screen.getByText('エラー2')).toBeInTheDocument();
    expect(screen.getByText('エラー3')).toBeInTheDocument();
  });

  it('onCloseが未指定の場合、閉じるボタンを表示しない', () => {
    render(<ErrorMessage message="エラー" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('onCloseが指定されている場合、閉じるボタンをクリックで呼び出す', () => {
    const handleClose = vi.fn();
    render(<ErrorMessage message="エラー" onClose={handleClose} />);

    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
