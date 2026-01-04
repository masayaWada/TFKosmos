import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import AwsConnectionForm from './AwsConnectionForm';
import { connectionApi } from '../../api/connection';
import { ApiError } from '../../api/client';

// connectionApiをモック化
vi.mock('../../api/connection', () => ({
  connectionApi: {
    awsLogin: vi.fn(),
    testAws: vi.fn(),
  },
}));

describe('AwsConnectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('初期レンダリング', () => {
    it('フォームが正しく表示される', () => {
      // Act
      render(<AwsConnectionForm />);

      // Assert
      expect(screen.getByText('AWS接続設定')).toBeInTheDocument();
      expect(screen.getByText('aws login（推奨）')).toBeInTheDocument();
      expect(screen.getByText('従来の方法（アクセスキー使用）')).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText('default').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('arn:aws:iam::123456789012:role/AdminRole')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('tfkosmos')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /接続テスト/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /aws login実行/i })).toBeInTheDocument();
    });

    it('デフォルト値が正しく設定されている', () => {
      // Act
      render(<AwsConnectionForm />);

      // Assert
      const sessionNameInput = screen.getByPlaceholderText('tfkosmos') as HTMLInputElement;
      expect(sessionNameInput.value).toBe('tfkosmos');
    });
  });

  describe('フォーム入力', () => {
    it('プロファイルを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AwsConnectionForm />);

      // Act
      const profileInputs = screen.getAllByPlaceholderText('default');
      const profileInput = profileInputs[0] as HTMLInputElement;
      await user.clear(profileInput);
      await user.type(profileInput, 'test-profile');

      // Assert
      expect(profileInput.value).toBe('test-profile');
    });

    it('リージョンを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AwsConnectionForm />);

      // Act
      const regionInput = screen.getByPlaceholderText('ap-northeast-1') as HTMLInputElement;
      await user.clear(regionInput);
      await user.type(regionInput, 'us-east-1');

      // Assert
      expect(regionInput.value).toBe('us-east-1');
    });

    it('Assume Role ARNを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AwsConnectionForm />);

      // Act
      const assumeRoleInput = screen.getByPlaceholderText('arn:aws:iam::123456789012:role/AdminRole') as HTMLInputElement;
      await user.clear(assumeRoleInput);
      await user.type(assumeRoleInput, 'arn:aws:iam::123456789012:role/TestRole');

      // Assert
      expect(assumeRoleInput.value).toBe('arn:aws:iam::123456789012:role/TestRole');
    });

    it('Session Nameを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AwsConnectionForm />);

      // Act
      const sessionNameInput = screen.getByPlaceholderText('tfkosmos') as HTMLInputElement;
      await user.clear(sessionNameInput);
      await user.type(sessionNameInput, 'custom-session');

      // Assert
      expect(sessionNameInput.value).toBe('custom-session');
    });
  });

  describe('接続テスト実行', () => {
    it('接続テストが成功する場合、成功メッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };
      vi.mocked(connectionApi.testAws).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAws).toHaveBeenCalledWith({
          assume_role_session_name: 'tfkosmos',
        });
      });
      await waitFor(() => {
        expect(screen.getByText(/接続成功: Account ID 123456789012/i)).toBeInTheDocument();
      });
    });

    it('プロファイルを指定して接続テストが成功する', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };
      vi.mocked(connectionApi.testAws).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const profileInputs = screen.getAllByPlaceholderText('default');
      const profileInput = profileInputs[1] as HTMLInputElement; // 従来の方法のプロファイル入力
      await user.clear(profileInput);
      await user.type(profileInput, 'test-profile');

      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAws).toHaveBeenCalledWith({
          profile: 'test-profile',
          assume_role_session_name: 'tfkosmos',
        });
      });
    });

    it('Assume Role ARNを指定して接続テストが成功する', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };
      vi.mocked(connectionApi.testAws).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const assumeRoleInput = screen.getByPlaceholderText('arn:aws:iam::123456789012:role/AdminRole') as HTMLInputElement;
      await user.clear(assumeRoleInput);
      await user.type(assumeRoleInput, 'arn:aws:iam::123456789012:role/TestRole');

      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAws).toHaveBeenCalledWith({
          assume_role_arn: 'arn:aws:iam::123456789012:role/TestRole',
          assume_role_session_name: 'tfkosmos',
        });
      });
    });

    it('Session Nameを変更して接続テストが成功する', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };
      vi.mocked(connectionApi.testAws).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const sessionNameInput = screen.getByPlaceholderText('tfkosmos') as HTMLInputElement;
      await user.clear(sessionNameInput);
      await user.type(sessionNameInput, 'custom-session');

      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAws).toHaveBeenCalledWith({
          assume_role_session_name: 'custom-session',
        });
      });
    });

    it('接続テスト中はボタンが無効化される', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveTest: (value: any) => void;
      const testPromise = new Promise((resolve) => {
        resolveTest = resolve;
      });
      vi.mocked(connectionApi.testAws).mockReturnValue(testPromise as any);
      render(<AwsConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(testButton).toBeDisabled();
      });
      expect(screen.getByText(/接続テスト中/i)).toBeInTheDocument();

      // Cleanup
      resolveTest!({
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      });
      await waitFor(() => {
        expect(testButton).not.toBeDisabled();
      });
    });
  });

  describe('エラー表示', () => {
    it('接続テストが失敗した場合、エラーメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new ApiError('接続に失敗しました', 'EXTERNAL_SERVICE_ERROR', 500);
      vi.mocked(connectionApi.testAws).mockRejectedValue(error);
      render(<AwsConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('接続に失敗しました')).toBeInTheDocument();
      });
    });

    it('エラーメッセージを閉じることができる', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new ApiError('接続に失敗しました', 'EXTERNAL_SERVICE_ERROR', 500);
      vi.mocked(connectionApi.testAws).mockRejectedValue(error);
      render(<AwsConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('接続に失敗しました')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn => btn.textContent === '×');
      expect(closeButton).toBeInTheDocument();
      await user.click(closeButton!);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('接続に失敗しました')).not.toBeInTheDocument();
      });
    });

    it('APIレスポンスのdetailが含まれる場合、そのメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const error: any = new Error('Network error');
      error.response = {
        data: {
          detail: '認証に失敗しました',
        },
      };
      vi.mocked(connectionApi.testAws).mockRejectedValue(error);
      render(<AwsConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('認証に失敗しました')).toBeInTheDocument();
      });
    });
  });

  describe('aws login機能', () => {
    it('aws loginが成功する場合、成功メッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        message: 'Login process started',
      };
      vi.mocked(connectionApi.awsLogin).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const loginButton = screen.getByRole('button', { name: /aws login実行/i });
      await user.click(loginButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.awsLogin).toHaveBeenCalledWith(undefined, undefined);
      });
      await waitFor(() => {
        expect(screen.getByText(/aws loginが完了しました/i)).toBeInTheDocument();
      });
    });

    it('プロファイルとリージョンを指定してaws loginが成功する', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        message: 'Login process started',
      };
      vi.mocked(connectionApi.awsLogin).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const profileInput = screen.getAllByPlaceholderText('default')[0] as HTMLInputElement;
      await user.clear(profileInput);
      await user.type(profileInput, 'test-profile');

      const regionInput = screen.getByPlaceholderText('ap-northeast-1') as HTMLInputElement;
      await user.clear(regionInput);
      await user.type(regionInput, 'us-east-1');

      const loginButton = screen.getByRole('button', { name: /aws login実行/i });
      await user.click(loginButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.awsLogin).toHaveBeenCalledWith('test-profile', 'us-east-1');
      });
    });

    it('aws loginが失敗した場合、エラーメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: false,
        detail: 'aws loginに失敗しました',
      };
      vi.mocked(connectionApi.awsLogin).mockResolvedValue(mockResponse);
      render(<AwsConnectionForm />);

      // Act
      const loginButton = screen.getByRole('button', { name: /aws login実行/i });
      await user.click(loginButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('aws loginに失敗しました')).toBeInTheDocument();
      });
    });

    it('aws login中はボタンが無効化される', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      vi.mocked(connectionApi.awsLogin).mockReturnValue(loginPromise as any);
      render(<AwsConnectionForm />);

      // Act
      const loginButton = screen.getByRole('button', { name: /aws login実行/i });
      await user.click(loginButton);

      // Assert
      await waitFor(() => {
        expect(loginButton).toBeDisabled();
      });
      expect(screen.getByText(/aws login実行中/i)).toBeInTheDocument();

      // Cleanup
      resolveLogin!({
        success: true,
        message: 'Login process started',
      });
      await waitFor(() => {
        expect(loginButton).not.toBeDisabled();
      });
    });
  });
});