import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionApi } from './connection';
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

describe('connectionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testAws', () => {
    it('正常系: AWS接続テストが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Connection successful',
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {
        profile: 'test-profile',
        assume_role_arn: 'arn:aws:iam::123456789012:role/test-role',
        assume_role_session_name: 'test-session',
      };

      // Act
      const result = await connectionApi.testAws(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/aws/test', {
        provider: 'aws',
        ...config,
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 最小限の設定でAWS接続テストが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Connection successful',
        account_id: '123456789012',
        user_arn: 'arn:aws:iam::123456789012:user/test-user',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {};

      // Act
      const result = await connectionApi.testAws(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/aws/test', {
        provider: 'aws',
      });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: APIエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'AWS connection failed',
        'EXTERNAL_SERVICE_ERROR',
        500
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        profile: 'test-profile',
      };

      // Act & Assert
      await expect(connectionApi.testAws(config)).rejects.toThrow(
        'AWS connection failed'
      );
      expect(apiClient.post).toHaveBeenCalledWith('/connection/aws/test', {
        provider: 'aws',
        ...config,
      });
    });

    it('エラーハンドリング: ネットワークエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Network error',
        'NETWORK_ERROR',
        0
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        profile: 'test-profile',
      };

      // Act & Assert
      await expect(connectionApi.testAws(config)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('testAzure', () => {
    it('正常系: Azure接続テストが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Connection successful',
        subscription_name: 'test-subscription',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {
        auth_method: 'service_principal',
        tenant_id: 'test-tenant-id',
        service_principal_config: {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          tenant_id: 'test-tenant-id',
        },
      };

      // Act
      const result = await connectionApi.testAzure(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/azure/test', {
        provider: 'azure',
        ...config,
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 最小限の設定でAzure接続テストが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Connection successful',
        subscription_name: 'test-subscription',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const config = {};

      // Act
      const result = await connectionApi.testAzure(config);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/azure/test', {
        provider: 'azure',
      });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: APIエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Azure connection failed',
        'EXTERNAL_SERVICE_ERROR',
        500
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        auth_method: 'service_principal',
        tenant_id: 'test-tenant-id',
      };

      // Act & Assert
      await expect(connectionApi.testAzure(config)).rejects.toThrow(
        'Azure connection failed'
      );
      expect(apiClient.post).toHaveBeenCalledWith('/connection/azure/test', {
        provider: 'azure',
        ...config,
      });
    });

    it('エラーハンドリング: ネットワークエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Network error',
        'NETWORK_ERROR',
        0
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        auth_method: 'device_code',
      };

      // Act & Assert
      await expect(connectionApi.testAzure(config)).rejects.toThrow(
        'Network error'
      );
    });

    it('エラーハンドリング: 認証エラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Authentication failed',
        'VALIDATION_ERROR',
        401
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const config = {
        auth_method: 'service_principal',
        service_principal_config: {
          client_id: 'invalid-id',
          client_secret: 'invalid-secret',
        },
      };

      // Act & Assert
      await expect(connectionApi.testAzure(config)).rejects.toThrow(
        'Authentication failed'
      );
    });
  });

  describe('awsLogin', () => {
    it('正常系: AWSログインが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Login process started',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await connectionApi.awsLogin('test-profile', 'us-east-1');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/aws/login', {
        profile: 'test-profile',
        region: 'us-east-1',
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: パラメータなしでAWSログインが成功する', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Login process started',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await connectionApi.awsLogin();

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/connection/aws/login', {
        profile: undefined,
        region: undefined,
      });
      expect(result).toEqual(mockResponse);
    });
  });
});

