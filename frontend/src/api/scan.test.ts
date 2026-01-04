import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanApi, azureApi } from './scan';
import apiClient from './client';
import { ApiError } from './client';

// apiClientをモック化（ApiErrorは実際のモジュールから取得）
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  return {
    ...actual,
    default: {
      post: mockPost,
      get: mockGet,
    },
  };
});

describe('scanApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scanAws', () => {
    it('正常系: AWSスキャンが開始される', async () => {
      // Arrange
      const mockResponse = {
        scan_id: 'test-scan-id',
        status: 'running',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {
        provider: 'aws' as const,
        profile: 'test-profile',
        scan_targets: {
          users: true,
          groups: true,
        },
      };

      // Act
      const result = await scanApi.scanAws(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/scan/aws', { config });
      expect(result).toEqual(mockResponse);
      expect(result.scan_id).toBe('test-scan-id');
      expect(result.status).toBe('running');
    });

    it('正常系: 最小限の設定でAWSスキャンが開始される', async () => {
      // Arrange
      const mockResponse = {
        scan_id: 'test-scan-id-2',
        status: 'running',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {
        provider: 'aws' as const,
        scan_targets: {
          users: true,
        },
      };

      // Act
      const result = await scanApi.scanAws(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/scan/aws', { config });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: APIエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Scan failed',
        'EXTERNAL_SERVICE_ERROR',
        500
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        provider: 'aws' as const,
        scan_targets: {
          users: true,
        },
      };

      // Act & Assert
      await expect(scanApi.scanAws(config)).rejects.toThrow('Scan failed');
      expect(apiClient.post).toHaveBeenCalledWith('/scan/aws', { config });
    });
  });

  describe('scanAzure', () => {
    it('正常系: Azureスキャンが開始される', async () => {
      // Arrange
      const mockResponse = {
        scan_id: 'test-scan-id-azure',
        status: 'running',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {
        provider: 'azure' as const,
        subscription_id: 'test-subscription-id',
        scope_type: 'subscription',
        scope_value: 'test-subscription-id',
        scan_targets: {
          role_definitions: true,
          role_assignments: true,
        },
      };

      // Act
      const result = await scanApi.scanAzure(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/scan/azure', { config });
      expect(result).toEqual(mockResponse);
      expect(result.scan_id).toBe('test-scan-id-azure');
      expect(result.status).toBe('running');
    });

    it('エラーハンドリング: APIエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Azure scan failed',
        'EXTERNAL_SERVICE_ERROR',
        500
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        provider: 'azure' as const,
        subscription_id: 'test-subscription-id',
        scan_targets: {
          role_definitions: true,
        },
      };

      // Act & Assert
      await expect(scanApi.scanAzure(config)).rejects.toThrow(
        'Azure scan failed'
      );
      expect(apiClient.post).toHaveBeenCalledWith('/scan/azure', { config });
    });
  });

  describe('getStatus', () => {
    it('正常系: スキャン状態を取得できる', async () => {
      // Arrange
      const mockResponse = {
        scan_id: 'test-scan-id',
        status: 'completed',
        progress: 100,
        message: 'Scan completed successfully',
        summary: {
          users: 10,
          groups: 5,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await scanApi.getStatus('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/scan/test-scan-id/status');
      expect(result).toEqual(mockResponse);
      expect(result.scan_id).toBe('test-scan-id');
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('正常系: 実行中のスキャン状態を取得できる', async () => {
      // Arrange
      const mockResponse = {
        scan_id: 'test-scan-id',
        status: 'running',
        progress: 50,
        message: 'Scanning in progress',
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await scanApi.getStatus('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/scan/test-scan-id/status');
      expect(result).toEqual(mockResponse);
      expect(result.status).toBe('running');
      expect(result.progress).toBe(50);
    });

    it('エラーハンドリング: スキャンIDが見つからない場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Scan not found',
        'NOT_FOUND',
        404
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(scanApi.getStatus('invalid-scan-id')).rejects.toThrow(
        'Scan not found'
      );
      expect(apiClient.get).toHaveBeenCalledWith('/scan/invalid-scan-id/status');
    });

    it('エラーハンドリング: ネットワークエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Network error',
        'NETWORK_ERROR',
        0
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(scanApi.getStatus('test-scan-id')).rejects.toThrow(
        'Network error'
      );
    });
  });
});

describe('azureApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSubscriptions', () => {
    it('正常系: Azureサブスクリプション一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        subscriptions: [
          {
            subscription_id: 'sub-1',
            display_name: 'Subscription 1',
            state: 'Enabled',
          },
          {
            subscription_id: 'sub-2',
            display_name: 'Subscription 2',
            state: 'Enabled',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listSubscriptions(
        'device_code',
        'test-tenant-id'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/subscriptions?auth_method=device_code&tenant_id=test-tenant-id'
      );
      expect(result).toEqual(mockResponse);
      expect(result.subscriptions).toHaveLength(2);
    });

    it('正常系: サービスプリンシパルでサブスクリプション一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        subscriptions: [
          {
            subscription_id: 'sub-1',
            display_name: 'Subscription 1',
            state: 'Enabled',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listSubscriptions(
        'service_principal',
        'test-tenant-id',
        'test-client-id',
        'test-client-secret'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/subscriptions?auth_method=service_principal&tenant_id=test-tenant-id&client_id=test-client-id&client_secret=test-client-secret'
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常系: パラメータなしでサブスクリプション一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        subscriptions: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listSubscriptions();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/subscriptions?'
      );
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: 認証エラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Authentication failed',
        'VALIDATION_ERROR',
        401
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(
        azureApi.listSubscriptions('service_principal', 'invalid-tenant-id')
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('listResourceGroups', () => {
    it('正常系: Azureリソースグループ一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resource_groups: [
          {
            name: 'rg-1',
            location: 'japaneast',
          },
          {
            name: 'rg-2',
            location: 'japanwest',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listResourceGroups(
        'test-subscription-id',
        'device_code',
        'test-tenant-id'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/resource-groups?subscription_id=test-subscription-id&auth_method=device_code&tenant_id=test-tenant-id'
      );
      expect(result).toEqual(mockResponse);
      expect(result.resource_groups).toHaveLength(2);
    });

    it('正常系: サービスプリンシパルでリソースグループ一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resource_groups: [
          {
            name: 'rg-1',
            location: 'japaneast',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listResourceGroups(
        'test-subscription-id',
        'service_principal',
        'test-tenant-id',
        'test-client-id',
        'test-client-secret'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/resource-groups?subscription_id=test-subscription-id&auth_method=service_principal&tenant_id=test-tenant-id&client_id=test-client-id&client_secret=test-client-secret'
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 最小限のパラメータでリソースグループ一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resource_groups: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await azureApi.listResourceGroups('test-subscription-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/connection/azure/resource-groups?subscription_id=test-subscription-id'
      );
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: サブスクリプションIDが無効な場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Subscription not found',
        'NOT_FOUND',
        404
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(
        azureApi.listResourceGroups('invalid-subscription-id')
      ).rejects.toThrow('Subscription not found');
    });

    it('エラーハンドリング: 認証エラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Authentication failed',
        'VALIDATION_ERROR',
        401
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(
        azureApi.listResourceGroups(
          'test-subscription-id',
          'service_principal',
          'invalid-tenant-id'
        )
      ).rejects.toThrow('Authentication failed');
    });
  });
});

