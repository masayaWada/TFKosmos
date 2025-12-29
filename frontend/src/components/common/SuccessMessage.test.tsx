import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import SuccessMessage from './SuccessMessage';

describe('SuccessMessage', () => {
  it('メッセージを表示する', () => {
    render(<SuccessMessage message="操作が成功しました" />);
    expect(screen.getByText('操作が成功しました')).toBeInTheDocument();
  });

  it('onCloseが未指定の場合、閉じるボタンを表示しない', () => {
    render(<SuccessMessage message="成功" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('onCloseが指定されている場合、閉じるボタンをクリックで呼び出す', () => {
    const handleClose = vi.fn();
    render(<SuccessMessage message="成功" onClose={handleClose} />);

    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
