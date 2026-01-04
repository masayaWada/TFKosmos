import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resourcesApi } from './resources';
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

describe('resourcesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResources', () => {
    it('正常系: リソース一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [
          {
            id: 'resource-1',
            type: 'aws_iam_user',
            name: 'test-user',
            data: {},
          },
          {
            id: 'resource-2',
            type: 'aws_iam_group',
            name: 'test-group',
            data: {},
          },
        ],
        total: 2,
        page: 1,
        page_size: 50,
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getResources('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/resources/test-scan-id', {
        params: { page: 1, page_size: 50 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 型フィルタでリソース一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [
          {
            id: 'resource-1',
            type: 'aws_iam_user',
            name: 'test-user',
            data: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getResources(
        'test-scan-id',
        'aws_iam_user'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/resources/test-scan-id', {
        params: { type: 'aws_iam_user', page: 1, page_size: 50 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: ページネーションでリソース一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [],
        total: 100,
        page: 2,
        page_size: 25,
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getResources(
        'test-scan-id',
        undefined,
        2,
        25
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/resources/test-scan-id', {
        params: { page: 2, page_size: 25 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: フィルタでリソース一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [
          {
            id: 'resource-1',
            type: 'aws_iam_user',
            name: 'test-user',
            data: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getResources(
        'test-scan-id',
        undefined,
        1,
        50,
        'name:test-user'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/resources/test-scan-id', {
        params: { page: 1, page_size: 50, filter: 'name:test-user' },
      });
      expect(result).toEqual(mockResponse);
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
      await expect(
        resourcesApi.getResources('invalid-scan-id')
      ).rejects.toThrow('Scan not found');
    });
  });

  describe('getSelectedResources', () => {
    it('正常系: 選択されたリソース一覧を取得できる', async () => {
      // Arrange
      const mockResponse = {
        selections: {
          aws_iam_user: ['resource-1', 'resource-2'],
          aws_iam_group: ['resource-3'],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getSelectedResources('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/resources/test-scan-id/select'
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 選択されたリソースがない場合、空のオブジェクトを返す', async () => {
      // Arrange
      const mockResponse = {
        selections: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getSelectedResources('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/resources/test-scan-id/select'
      );
      expect(result).toEqual(mockResponse);
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
      await expect(
        resourcesApi.getSelectedResources('invalid-scan-id')
      ).rejects.toThrow('Scan not found');
    });
  });

  describe('selectResources', () => {
    it('正常系: リソースを選択できる', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        message: 'Resources selected',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      const selections = {
        aws_iam_user: ['resource-1', 'resource-2'],
        aws_iam_group: ['resource-3'],
      };

      // Act
      const result = await resourcesApi.selectResources(
        'test-scan-id',
        selections
      );

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith(
        '/resources/test-scan-id/select',
        { selections }
      );
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: 無効なリソースIDの場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Invalid resource ID',
        'VALIDATION_ERROR',
        400
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      const selections = {
        aws_iam_user: ['invalid-resource-id'],
      };

      // Act & Assert
      await expect(
        resourcesApi.selectResources('test-scan-id', selections)
      ).rejects.toThrow('Invalid resource ID');
    });
  });

  describe('query', () => {
    it('正常系: クエリでリソースを検索できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [
          {
            id: 'resource-1',
            type: 'aws_iam_user',
            name: 'test-user',
            data: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.query(
        'test-scan-id',
        'type:aws_iam_user'
      );

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith(
        '/resources/test-scan-id/query',
        {
          query: 'type:aws_iam_user',
          type: undefined,
          page: undefined,
          page_size: undefined,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常系: オプション付きでクエリを実行できる', async () => {
      // Arrange
      const mockResponse = {
        resources: [],
        total: 0,
        page: 2,
        page_size: 25,
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.query(
        'test-scan-id',
        'name:test',
        {
          type: 'aws_iam_user',
          page: 2,
          pageSize: 25,
        }
      );

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith(
        '/resources/test-scan-id/query',
        {
          query: 'name:test',
          type: 'aws_iam_user',
          page: 2,
          page_size: 25,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: 無効なクエリの場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Invalid query syntax',
        'VALIDATION_ERROR',
        400
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      // Act & Assert
      await expect(
        resourcesApi.query('test-scan-id', 'invalid:query:syntax')
      ).rejects.toThrow('Invalid query syntax');
    });
  });

  describe('getDependencies', () => {
    it('正常系: 依存グラフを取得できる', async () => {
      // Arrange
      const mockResponse = {
        nodes: [
          {
            id: 'node-1',
            node_type: 'resource',
            name: 'test-user',
            data: {},
          },
          {
            id: 'node-2',
            node_type: 'resource',
            name: 'test-group',
            data: {},
          },
        ],
        edges: [
          {
            source: 'node-1',
            target: 'node-2',
            edge_type: 'member_of',
            label: 'member',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getDependencies('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/resources/test-scan-id/dependencies',
        { params: {} }
      );
      expect(result).toEqual(mockResponse);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('正常系: rootIdを指定して依存グラフを取得できる', async () => {
      // Arrange
      const mockResponse = {
        nodes: [
          {
            id: 'node-1',
            node_type: 'resource',
            name: 'test-user',
            data: {},
          },
        ],
        edges: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getDependencies(
        'test-scan-id',
        'resource-1'
      );

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/resources/test-scan-id/dependencies',
        { params: { root_id: 'resource-1' } }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常系: 依存関係がない場合、空のグラフを返す', async () => {
      // Arrange
      const mockResponse = {
        nodes: [],
        edges: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await resourcesApi.getDependencies('test-scan-id');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith(
        '/resources/test-scan-id/dependencies',
        { params: {} }
      );
      expect(result).toEqual(mockResponse);
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
      await expect(
        resourcesApi.getDependencies('invalid-scan-id')
      ).rejects.toThrow('Scan not found');
    });

    it('エラーハンドリング: rootIdが無効な場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Resource not found',
        'NOT_FOUND',
        404
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(
        resourcesApi.getDependencies('test-scan-id', 'invalid-resource-id')
      ).rejects.toThrow('Resource not found');
    });
  });
});

