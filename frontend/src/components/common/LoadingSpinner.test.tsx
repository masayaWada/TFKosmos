import { describe, it, expect } from 'vitest';
import { render } from '../../test/utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('正常にレンダリングされる', () => {
    // Arrange & Act
    const { container } = render(<LoadingSpinner />);

    // Assert
    expect(container.firstChild).toBeInTheDocument();
  });

  it('スピナー要素が存在する', () => {
    // Arrange & Act
    const { container } = render(<LoadingSpinner />);

    // Assert
    const spinnerElement = container.querySelector('div > div');
    expect(spinnerElement).toBeInTheDocument();
  });

  it('アニメーション用のstyle要素が存在する', () => {
    // Arrange & Act
    const { container } = render(<LoadingSpinner />);

    // Assert
    const styleElement = container.querySelector('style');
    expect(styleElement).toBeInTheDocument();
    expect(styleElement?.textContent).toContain('@keyframes spin');
  });
});
