import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import AzureConnectionForm from './AzureConnectionForm';
import { connectionApi } from '../../api/connection';
import { ApiError } from '../../api/client';

// connectionApiをモック化
vi.mock('../../api/connection', () => ({
  connectionApi: {
    testAzure: vi.fn(),
  },
}));

// localStorageをモック化
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AzureConnectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('初期レンダリング', () => {
    it('フォームが正しく表示される', () => {
      // Act
      render(<AzureConnectionForm />);

      // Assert
      expect(screen.getByText('Azure接続設定')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /接続テスト/i })).toBeInTheDocument();
    });

    it('デフォルトでaz_loginが選択されている', () => {
      // Act
      render(<AzureConnectionForm />);

      // Assert
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      expect(authMethodSelect.value).toBe('az_login');
      const textboxes = screen.queryAllByRole('textbox');
      expect(textboxes.length).toBe(0);
    });
  });

  describe('認証方法選択', () => {
    it('認証方式を変更できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      // Assert
      expect(authMethodSelect.value).toBe('service_principal');
    });

    it('service_principalを選択すると、サービスプリンシパル設定フィールドが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      // Assert
      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('az_loginに戻すと、サービスプリンシパル設定フィールドが非表示になる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');
      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(3);
      });

      await user.selectOptions(authMethodSelect, 'az_login');

      // Assert
      await waitFor(() => {
        const textboxes = screen.queryAllByRole('textbox');
        expect(textboxes.length).toBe(0);
      });
    });
  });

  describe('サービスプリンシパル設定', () => {
    it('テナントIDを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      await waitFor(() => {
        expect(screen.getByLabelText(/テナントID/i)).toBeInTheDocument();
      });

      const tenantIdInput = screen.getByLabelText(/テナントID/i) as HTMLInputElement;
      await user.clear(tenantIdInput);
      await user.type(tenantIdInput, 'test-tenant-id');

      // Assert
      expect(tenantIdInput.value).toBe('test-tenant-id');
    });

    it('Client IDを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(3);
      });

      const textboxes = screen.getAllByRole('textbox');
      const clientIdInput = textboxes[1] as HTMLInputElement;
      await user.clear(clientIdInput);
      await user.type(clientIdInput, 'test-client-id');

      // Assert
      expect(clientIdInput.value).toBe('test-client-id');
    });

    it('Client Secretを入力できる', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(3);
      });

      const textboxes = screen.getAllByRole('textbox');
      const clientSecretInput = textboxes[2] as HTMLInputElement;
      await user.clear(clientSecretInput);
      await user.type(clientSecretInput, 'test-client-secret');

      // Assert
      expect(clientSecretInput.value).toBe('test-client-secret');
      expect(clientSecretInput.type).toBe('password');
    });
  });

  describe('接続テスト実行', () => {
    it('az_loginで接続テストが成功する場合、成功メッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        subscription_name: 'test-subscription',
      };
      vi.mocked(connectionApi.testAzure).mockResolvedValue(mockResponse);
      render(<AzureConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAzure).toHaveBeenCalledWith({
          auth_method: 'az_login',
        });
      });
      await waitFor(() => {
        expect(screen.getByText(/接続成功: test-subscription/i)).toBeInTheDocument();
      });
    });

    it('subscription_nameがない場合でも接続テストが成功する', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
      };
      vi.mocked(connectionApi.testAzure).mockResolvedValue(mockResponse);
      render(<AzureConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/接続成功/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/test-subscription/i)).not.toBeInTheDocument();
    });

    it('service_principalで接続テストが成功する場合、設定がlocalStorageに保存される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        subscription_name: 'test-subscription',
      };
      vi.mocked(connectionApi.testAzure).mockResolvedValue(mockResponse);
      render(<AzureConnectionForm />);

      // Act
      const authMethodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(authMethodSelect, 'service_principal');

      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(3);
      });

      const textboxes = screen.getAllByRole('textbox');
      const tenantIdInput = textboxes[0] as HTMLInputElement;
      await user.clear(tenantIdInput);
      await user.type(tenantIdInput, 'test-tenant-id');

      const clientIdInput = textboxes[1] as HTMLInputElement;
      await user.clear(clientIdInput);
      await user.type(clientIdInput, 'test-client-id');

      const clientSecretInput = textboxes[2] as HTMLInputElement;
      await user.clear(clientSecretInput);
      await user.type(clientSecretInput, 'test-client-secret');

      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(connectionApi.testAzure).toHaveBeenCalledWith({
          auth_method: 'service_principal',
          tenant_id: 'test-tenant-id',
          service_principal_config: {
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            tenant_id: 'test-tenant-id',
          },
        });
      });

      await waitFor(() => {
        const savedSettings = JSON.parse(localStorage.getItem('azure_connection_settings') || '{}');
        expect(savedSettings.auth_method).toBe('service_principal');
        expect(savedSettings.tenant_id).toBe('test-tenant-id');
        expect(savedSettings.client_id).toBe('test-client-id');
        expect(savedSettings.client_secret).toBeUndefined(); // セキュリティ上の理由で保存されない
      });
    });

    it('az_loginで接続テストが成功する場合、設定がlocalStorageに保存される', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        subscription_name: 'test-subscription',
      };
      vi.mocked(connectionApi.testAzure).mockResolvedValue(mockResponse);
      render(<AzureConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        const savedSettings = JSON.parse(localStorage.getItem('azure_connection_settings') || '{}');
        expect(savedSettings.auth_method).toBe('az_login');
        expect(savedSettings.client_id).toBeUndefined();
      });
    });

    it('接続テスト中はボタンが無効化される', async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveTest: (value: any) => void;
      const testPromise = new Promise((resolve) => {
        resolveTest = resolve;
      });
      vi.mocked(connectionApi.testAzure).mockReturnValue(testPromise as any);
      render(<AzureConnectionForm />);

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
        success: true,
        subscription_name: 'test-subscription',
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
      vi.mocked(connectionApi.testAzure).mockRejectedValue(error);
      render(<AzureConnectionForm />);

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
      vi.mocked(connectionApi.testAzure).mockRejectedValue(error);
      render(<AzureConnectionForm />);

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
      vi.mocked(connectionApi.testAzure).mockRejectedValue(error);
      render(<AzureConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('認証に失敗しました')).toBeInTheDocument();
      });
    });

    it('認証エラーが発生した場合、エラーメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new ApiError('Authentication failed', 'VALIDATION_ERROR', 401);
      vi.mocked(connectionApi.testAzure).mockRejectedValue(error);
      render(<AzureConnectionForm />);

      // Act
      const testButton = screen.getByRole('button', { name: /接続テスト/i });
      await user.click(testButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      });
    });
  });
});
