import { describe, it, expect, vi, beforeEach } from 'vitest';
import { templatesApi } from './templates';
import apiClient from './client';
import { ApiError } from './client';

// apiClientをモック化
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();
  return {
    ...actual,
    default: {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    },
  };
});

describe('templatesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('正常系: テンプレート一覧が取得できる', async () => {
      // Arrange
      const mockResponse = {
        templates: [
          {
            resource_type: 'aws/iam_user.tf.j2',
            template_path: 'terraform/aws/iam_user.tf.j2',
            has_user_override: false,
            default_source: 'default content',
            user_source: null,
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.list();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/templates');
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: APIエラーが発生した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Failed to fetch templates',
        'INTERNAL_ERROR',
        500
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.list()).rejects.toThrow('Failed to fetch templates');
    });
  });

  describe('get', () => {
    it('正常系: テンプレートが取得できる（user source）', async () => {
      // Arrange
      const mockResponse = {
        resource_type: 'aws/iam_user.tf.j2',
        source: 'user',
        content: 'user template content',
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.get('aws/iam_user.tf.j2', 'user');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/templates/aws%2Fiam_user.tf.j2', {
        params: { source: 'user' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: テンプレートが取得できる（default source）', async () => {
      // Arrange
      const mockResponse = {
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'default template content',
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.get('aws/iam_user.tf.j2', 'default');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/templates/aws%2Fiam_user.tf.j2', {
        params: { source: 'default' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: sourceを指定しない場合、デフォルトでuserが使用される', async () => {
      // Arrange
      const mockResponse = {
        resource_type: 'aws/iam_user.tf.j2',
        source: 'user',
        content: 'template content',
      };

      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.get('aws/iam_user.tf.j2');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/templates/aws%2Fiam_user.tf.j2', {
        params: { source: 'user' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: テンプレートが見つからない場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Template not found',
        'NOT_FOUND',
        404
      );
      vi.mocked(apiClient.get).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.get('nonexistent.tf.j2')).rejects.toThrow('Template not found');
    });
  });

  describe('save', () => {
    it('正常系: テンプレートが保存できる', async () => {
      // Arrange
      const mockResponse = {
        message: 'Template updated successfully',
      };

      vi.mocked(apiClient.put).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.save('aws/iam_user.tf.j2', 'template content');

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/templates/aws%2Fiam_user.tf.j2', {
        content: 'template content',
      });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: 保存に失敗した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Failed to save template',
        'INTERNAL_ERROR',
        500
      );
      vi.mocked(apiClient.put).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.save('aws/iam_user.tf.j2', 'content')).rejects.toThrow(
        'Failed to save template'
      );
    });
  });

  describe('delete', () => {
    it('正常系: テンプレートが削除できる', async () => {
      // Arrange
      const mockResponse = {
        message: 'Template deleted successfully',
      };

      vi.mocked(apiClient.delete).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.delete('aws/iam_user.tf.j2');

      // Assert
      expect(apiClient.delete).toHaveBeenCalledWith('/templates/aws%2Fiam_user.tf.j2');
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: 削除に失敗した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Failed to delete template',
        'INTERNAL_ERROR',
        500
      );
      vi.mocked(apiClient.delete).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.delete('aws/iam_user.tf.j2')).rejects.toThrow(
        'Failed to delete template'
      );
    });
  });

  describe('preview', () => {
    it('正常系: テンプレートプレビューが生成できる', async () => {
      // Arrange
      const mockResponse = {
        preview: 'rendered template content',
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.preview('aws/iam_user.tf.j2', 'template content');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/templates/preview/aws%2Fiam_user.tf.j2', {
        content: 'template content',
        context: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('正常系: カスタムコンテキストでプレビューが生成できる', async () => {
      // Arrange
      const mockResponse = {
        preview: 'rendered template content',
      };
      const customContext = {
        resource_name: 'test_user',
        user: { user_name: 'test-user' },
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.preview('aws/iam_user.tf.j2', 'template content', customContext);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/templates/preview/aws%2Fiam_user.tf.j2', {
        content: 'template content',
        context: customContext,
      });
      expect(result).toEqual(mockResponse);
    });

    it('エラーハンドリング: プレビュー生成に失敗した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Template preview failed',
        'VALIDATION_ERROR',
        400
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.preview('aws/iam_user.tf.j2', 'content')).rejects.toThrow(
        'Template preview failed'
      );
    });
  });

  describe('validate', () => {
    it('正常系: 有効なテンプレートが検証できる', async () => {
      // Arrange
      const mockResponse = {
        valid: true,
        errors: [],
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.validate('aws/iam_user.tf.j2', 'template content');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/templates/validate/aws%2Fiam_user.tf.j2', {
        content: 'template content',
      });
      expect(result).toEqual(mockResponse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('正常系: 無効なテンプレートが検証できる', async () => {
      // Arrange
      const mockResponse = {
        valid: false,
        errors: [
          {
            error_type: 'jinja2',
            message: 'Syntax error',
            line: 1,
            column: 10,
          },
        ],
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: mockResponse,
      } as any);

      // Act
      const result = await templatesApi.validate('aws/iam_user.tf.j2', 'invalid content');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/templates/validate/aws%2Fiam_user.tf.j2', {
        content: 'invalid content',
      });
      expect(result).toEqual(mockResponse);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error_type).toBe('jinja2');
    });

    it('エラーハンドリング: 検証に失敗した場合、エラーをスローする', async () => {
      // Arrange
      const error = new ApiError(
        'Validation failed',
        'INTERNAL_ERROR',
        500
      );
      vi.mocked(apiClient.post).mockRejectedValue(error);

      // Act & Assert
      await expect(templatesApi.validate('aws/iam_user.tf.j2', 'content')).rejects.toThrow(
        'Validation failed'
      );
    });
  });
});

