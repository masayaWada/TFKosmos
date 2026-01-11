import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesPage from './TemplatesPage';
import { templatesApi } from '../api/templates';

// Monaco Editorをモック化
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, onMount }: any) => {
    // onMountを呼び出してエディタの参照を設定
    if (onMount) {
      const mockEditor = {
        getModel: () => ({
          getLineCount: () => 10,
        }),
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn(),
      };
      setTimeout(() => onMount(mockEditor), 0);
    }
    return (
      <div data-testid="monaco-editor">
        <textarea
          data-testid="editor-textarea"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  },
}));

// templatesApiをモック化
vi.mock('../api/templates', () => ({
  templatesApi: {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    preview: vi.fn(),
    validate: vi.fn(),
  },
}));

// 子コンポーネントをモック化
vi.mock('../components/common/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">読み込み中...</div>,
}));

vi.mock('../components/common/ErrorMessage', () => ({
  default: ({ message, onClose }: any) => (
    <div data-testid="error-message">
      {message}
      <button onClick={onClose} data-testid="error-close">閉じる</button>
    </div>
  ),
}));

vi.mock('../components/common/SuccessMessage', () => ({
  default: ({ message, onClose }: any) => (
    <div data-testid="success-message">
      {message}
      <button onClick={onClose} data-testid="success-close">閉じる</button>
    </div>
  ),
}));

vi.mock('../components/generate/CodePreview', () => ({
  default: ({ preview }: any) => (
    <div data-testid="code-preview">
      {Object.entries(preview || {}).map(([key, value]) => (
        <div key={key} data-testid={`preview-${key}`}>
          {String(value)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/templates/ValidationErrors', () => ({
  default: ({ errors, onErrorClick }: any) => (
    <div data-testid="validation-errors">
      {errors.map((error: any, index: number) => (
        <div
          key={index}
          data-testid={`validation-error-${index}`}
          onClick={() => onErrorClick?.(error)}
        >
          {error.message} (Line: {error.line})
        </div>
      ))}
    </div>
  ),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // テンプレート一覧表示のテスト
  // ========================================

  describe('テンプレート一覧表示', () => {
    it('テンプレート一覧が表示される', async () => {
      // Arrange
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
        {
          resource_type: 'aws/iam_role.tf.j2',
          template_path: 'terraform/aws/iam_role.tf.j2',
          has_user_override: true,
          default_source: 'default content',
          user_source: 'user content',
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      // Act
      render(<TemplatesPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('テンプレート一覧')).toBeInTheDocument();
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
        expect(screen.getByText('aws/iam_role.tf.j2')).toBeInTheDocument();
        expect(screen.getByText('デフォルト')).toBeInTheDocument();
        expect(screen.getByText('カスタム')).toBeInTheDocument();
      });
    });

    it('ローディング中はスピナーが表示される', () => {
      // Arrange
      vi.mocked(templatesApi.list).mockImplementation(() => new Promise(() => {}));

      // Act
      render(<TemplatesPage />);

      // Assert
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('エラーが発生した場合、エラーメッセージが表示される', async () => {
      // Arrange
      vi.mocked(templatesApi.list).mockRejectedValue({
        response: {
          data: {
            detail: 'テンプレートの取得に失敗しました',
          },
        },
        message: 'テンプレートの取得に失敗しました',
      });

      // Act
      render(<TemplatesPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'テンプレートの取得に失敗しました'
        );
      });
    });
  });

  // ========================================
  // テンプレート編集のテスト
  // ========================================

  describe('テンプレート編集', () => {
    it('テンプレートを選択するとエディタに内容が表示される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'template content',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      // Assert
      await waitFor(() => {
        expect(templatesApi.get).toHaveBeenCalledWith('aws/iam_user.tf.j2', 'default');
        expect(screen.getByTestId('editor-textarea')).toHaveValue('template content');
      });
    });

    it('エディタの内容を編集できる', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'initial content',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('editor-textarea');
      await user.clear(textarea);
      await user.type(textarea, 'edited content');

      // Assert
      expect(textarea).toHaveValue('edited content');
    });

    it('Monaco Editorがマウントされる', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'template content',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      });
    });
  });

  // ========================================
  // 検証機能のテスト
  // TODO: fake timersとuserEventの組み合わせによる問題を修正する
  // ========================================

  describe.skip('検証機能', () => {
    it('エディタの内容が変更されると検証が実行される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'initial content',
      });

      vi.mocked(templatesApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('editor-textarea');
      await user.type(textarea, 'new content');

      // デバウンスを待つ
      vi.advanceTimersByTime(600);

      // Assert
      await waitFor(() => {
        expect(templatesApi.validate).toHaveBeenCalled();
      });
    });

    it('検証エラーが表示される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'initial content',
      });

      vi.mocked(templatesApi.validate).mockResolvedValue({
        valid: false,
        errors: [
          {
            error_type: 'jinja2',
            message: 'Syntax error',
            line: 1,
            column: 10,
          },
        ],
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('editor-textarea');
      await user.type(textarea, 'invalid');

      // デバウンスを待つ
      vi.advanceTimersByTime(600);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('validation-errors')).toBeInTheDocument();
        expect(screen.getByTestId('validation-error-0')).toHaveTextContent('Syntax error');
      });
    });
  });

  // ========================================
  // 保存・削除のテスト
  // ========================================

  describe('保存・削除', () => {
    it('テンプレートが保存できる', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'initial content',
      });

      vi.mocked(templatesApi.save).mockResolvedValue({
        message: 'Template updated successfully',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(templatesApi.save).toHaveBeenCalledWith('aws/iam_user.tf.j2', 'initial content');
        expect(screen.getByTestId('success-message')).toHaveTextContent('テンプレートを保存しました');
      });
    });

    it('ユーザーテンプレートが削除できる', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: true,
          default_source: 'default content',
          user_source: 'user content',
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'user',
        content: 'user content',
      });

      vi.mocked(templatesApi.delete).mockResolvedValue({
        message: 'Template deleted successfully',
      });

      // window.confirmをモック化
      window.confirm = vi.fn(() => true);

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByText('デフォルトに復元')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('デフォルトに復元');
      await user.click(deleteButton);

      // Assert
      await waitFor(() => {
        expect(templatesApi.delete).toHaveBeenCalledWith('aws/iam_user.tf.j2');
        expect(screen.getByTestId('success-message')).toHaveTextContent('デフォルトに復元しました');
      });
    });

    it('保存エラーが表示される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'initial content',
      });

      vi.mocked(templatesApi.save).mockRejectedValue({
        response: {
          data: {
            detail: '保存に失敗しました',
          },
        },
        message: '保存に失敗しました',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('保存に失敗しました');
      });
    });
  });

  // ========================================
  // プレビュー機能のテスト
  // ========================================

  describe('プレビュー機能', () => {
    it('テンプレートプレビューが表示される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'template content',
      });

      vi.mocked(templatesApi.preview).mockResolvedValue({
        preview: 'rendered content',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByText('プレビュー')).toBeInTheDocument();
      });

      const previewButton = screen.getByText('プレビュー');
      await user.click(previewButton);

      // Assert
      await waitFor(() => {
        expect(templatesApi.preview).toHaveBeenCalledWith('aws/iam_user.tf.j2', 'template content');
        expect(screen.getByTestId('code-preview')).toBeInTheDocument();
      });
    });

    it('プレビュー生成エラーが表示される', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      const mockTemplates = [
        {
          resource_type: 'aws/iam_user.tf.j2',
          template_path: 'terraform/aws/iam_user.tf.j2',
          has_user_override: false,
          default_source: 'default content',
          user_source: null,
        },
      ];

      vi.mocked(templatesApi.list).mockResolvedValue({
        templates: mockTemplates,
      });

      vi.mocked(templatesApi.get).mockResolvedValue({
        resource_type: 'aws/iam_user.tf.j2',
        source: 'default',
        content: 'template content',
      });

      vi.mocked(templatesApi.preview).mockRejectedValue({
        response: {
          data: {
            detail: 'プレビューの生成に失敗しました',
          },
        },
        message: 'プレビューの生成に失敗しました',
      });

      // Act
      render(<TemplatesPage />);
      await waitFor(() => {
        expect(screen.getByText('aws/iam_user.tf.j2')).toBeInTheDocument();
      });

      const templateButton = screen.getByText('aws/iam_user.tf.j2').closest('button');
      if (templateButton) {
        await user.click(templateButton);
      }

      await waitFor(() => {
        expect(screen.getByText('プレビュー')).toBeInTheDocument();
      });

      const previewButton = screen.getByText('プレビュー');
      await user.click(previewButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('プレビューの生成に失敗しました');
      });
    });
  });
});

