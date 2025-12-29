import { describe, it, expect } from 'vitest';
import { render } from '../../test/utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('正常にレンダリングされる', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('スピナー要素が存在する', () => {
    const { container } = render(<LoadingSpinner />);
    // スピナーのdiv要素が存在することを確認
    const spinnerElement = container.querySelector('div > div');
    expect(spinnerElement).toBeInTheDocument();
  });

  it('アニメーション用のstyle要素が存在する', () => {
    const { container } = render(<LoadingSpinner />);
    const styleElement = container.querySelector('style');
    expect(styleElement).toBeInTheDocument();
    expect(styleElement?.textContent).toContain('@keyframes spin');
  });
});
