import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import ScanProgressBar from './ScanProgressBar';

describe('ScanProgressBar', () => {
  it('進捗率を表示する', () => {
    render(<ScanProgressBar progress={50} message="処理中..." />);

    // 進捗率50%が表示されている
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('進捗率が10%以下の場合、パーセンテージ表示しない', () => {
    render(<ScanProgressBar progress={5} message="処理中..." />);

    // 5%は表示されない
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
  });

  it('メッセージを表示する', () => {
    render(<ScanProgressBar progress={30} message="ユーザーをスキャン中..." />);

    expect(screen.getByText('ユーザーをスキャン中...')).toBeInTheDocument();
  });

  it('メッセージが空の場合、デフォルトメッセージを表示する', () => {
    render(<ScanProgressBar progress={30} message="" />);

    expect(screen.getByText('スキャン中...')).toBeInTheDocument();
  });

  it('進捗が100%未満の場合、ローディングスピナーを表示する', () => {
    const { container } = render(<ScanProgressBar progress={80} message="処理中..." />);

    // LoadingSpinnerコンポーネントが存在する
    const spinnerContainer = container.querySelector('div[style*="text-align: center"]');
    expect(spinnerContainer).toBeInTheDocument();
  });

  it('進捗が100%の場合、ローディングスピナーを表示しない', () => {
    const { container } = render(<ScanProgressBar progress={100} message="完了" />);

    // LoadingSpinnerコンポーネントはpaddingが2remのdivを持つ
    const spinnerContainer = container.querySelector('div[style*="padding: 2rem"]');
    expect(spinnerContainer).not.toBeInTheDocument();
  });

  it('プログレスバーの幅が進捗率に応じて設定される', () => {
    const { container } = render(<ScanProgressBar progress={75} message="処理中..." />);

    // プログレスバーの幅が75%
    const progressFill = container.querySelector('div[style*="width: 75%"]');
    expect(progressFill).toBeInTheDocument();
  });
});
