import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import ScanProgressBar from './ScanProgressBar';

describe('ScanProgressBar', () => {
  it('進捗率を表示する', () => {
    // Arrange
    const progress = 50;
    const message = '処理中...';

    // Act
    render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('進捗率が10%以下の場合、パーセンテージ表示しない', () => {
    // Arrange
    const progress = 5;
    const message = '処理中...';

    // Act
    render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
  });

  it('メッセージを表示する', () => {
    // Arrange
    const progress = 30;
    const message = 'ユーザーをスキャン中...';

    // Act
    render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('メッセージが空の場合、デフォルトメッセージを表示する', () => {
    // Arrange
    const progress = 30;
    const message = '';

    // Act
    render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    expect(screen.getByText('スキャン中...')).toBeInTheDocument();
  });

  it('進捗が100%未満の場合、ローディングスピナーを表示する', () => {
    // Arrange
    const progress = 80;
    const message = '処理中...';

    // Act
    const { container } = render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    const spinnerContainer = container.querySelector('div[style*="text-align: center"]');
    expect(spinnerContainer).toBeInTheDocument();
  });

  it('進捗が100%の場合、ローディングスピナーを表示しない', () => {
    // Arrange
    const progress = 100;
    const message = '完了';

    // Act
    const { container } = render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    const spinnerContainer = container.querySelector('div[style*="padding: 2rem"]');
    expect(spinnerContainer).not.toBeInTheDocument();
  });

  it('プログレスバーの幅が進捗率に応じて設定される', () => {
    // Arrange
    const progress = 75;
    const message = '処理中...';

    // Act
    const { container } = render(<ScanProgressBar progress={progress} message={message} />);

    // Assert
    const progressFill = container.querySelector('div[style*="width: 75%"]');
    expect(progressFill).toBeInTheDocument();
  });
});
