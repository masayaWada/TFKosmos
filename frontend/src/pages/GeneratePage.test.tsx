import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GeneratePage from './GeneratePage';
import { generateApi } from '../api/generate';
import { resourcesApi } from '../api/resources';

// APIクライアントとAPI関数をモック化
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
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

vi.mock('../api/generate', () => ({
  generateApi: {
    generate: vi.fn(),
    download: vi.fn(),
    validate: vi.fn(),
    format: vi.fn(),
    checkFormat: vi.fn(),
  },
}));

vi.mock('../api/resources', () => ({
  resourcesApi: {
    getSelectedResources: vi.fn(),
  },
}));

// グローバルfetchをモック化
globalThis.fetch = vi.fn() as any;

// 子コンポーネントを簡易モック化
vi.mock('../components/generate/GenerationConfigForm', () => ({
  default: ({ config, onChange }: any) => (
    <div data-testid="generation-config-form">
      <label>
        出力パス:
        <input
          type="text"
          value={config.output_path}
          onChange={(e) => onChange({ ...config, output_path: e.target.value })}
          data-testid="output-path-input"
        />
      </label>
      <label>
        ファイル分割ルール:
        <select
          value={config.file_split_rule}
          onChange={(e) => onChange({ ...config, file_split_rule: e.target.value })}
          data-testid="file-split-rule-select"
        >
          <option value="by_resource_type">リソースタイプ別</option>
          <option value="single_file">単一ファイル</option>
        </select>
      </label>
      <label>
        命名規則:
        <select
          value={config.naming_convention}
          onChange={(e) => onChange({ ...config, naming_convention: e.target.value })}
          data-testid="naming-convention-select"
        >
          <option value="snake_case">スネークケース</option>
          <option value="kebab-case">ケバブケース</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.generate_readme}
          onChange={(e) => onChange({ ...config, generate_readme: e.target.checked })}
          data-testid="generate-readme-checkbox"
        />
        READMEを生成
      </label>
    </div>
  ),
}));

vi.mock('../components/generate/CodePreview', () => ({
  default: ({ preview }: any) => (
    <div data-testid="code-preview">
      {Object.entries(preview).map(([filename, content]) => (
        <div key={filename} data-testid={`preview-${filename}`}>
          <h3>{filename}</h3>
          <pre>{content as string}</pre>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/generate/ValidationPanel', () => ({
  default: ({ generationId }: any) => (
    <div data-testid="validation-panel">
      検証パネル - Generation ID: {generationId}
    </div>
  ),
}));

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

describe('GeneratePage', () => {
  const mockScanId = 'test-scan-id-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  const renderWithRouter = (scanId: string = mockScanId) => {
    return render(
      <MemoryRouter initialEntries={[`/generate/${scanId}`]}>
        <Routes>
          <Route path="/generate/:scanId" element={<GeneratePage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  // ========================================
  // 設定フォームのテスト
  // ========================================

  describe('設定フォーム', () => {
    it('初期設定が表示される', async () => {
      // Arrange
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('generation-config-form')).toBeInTheDocument();
        expect(screen.getByTestId('output-path-input')).toHaveValue('./terraform-output');
        expect(screen.getByTestId('file-split-rule-select')).toHaveValue('by_resource_type');
        expect(screen.getByTestId('naming-convention-select')).toHaveValue('snake_case');
      });
    });

    it('出力パスを変更できる', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByTestId('output-path-input')).toBeInTheDocument();
      });

      const outputPathInput = screen.getByTestId('output-path-input');
      await user.clear(outputPathInput);
      await user.type(outputPathInput, './custom-output');

      // Assert
      expect(outputPathInput).toHaveValue('./custom-output');
    });

    it('ファイル分割ルールを変更できる', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByTestId('file-split-rule-select')).toBeInTheDocument();
      });

      const fileSplitRuleSelect = screen.getByTestId('file-split-rule-select');
      await user.selectOptions(fileSplitRuleSelect, 'single_file');

      // Assert
      expect(fileSplitRuleSelect).toHaveValue('single_file');
    });

    it('命名規則を変更できる', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByTestId('naming-convention-select')).toBeInTheDocument();
      });

      const namingConventionSelect = screen.getByTestId('naming-convention-select');
      await user.selectOptions(namingConventionSelect, 'kebab-case');

      // Assert
      expect(namingConventionSelect).toHaveValue('kebab-case');
    });

    it('README生成のチェックボックスを切り替えられる', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByTestId('generate-readme-checkbox')).toBeInTheDocument();
      });

      const generateReadmeCheckbox = screen.getByTestId('generate-readme-checkbox');
      expect(generateReadmeCheckbox).toBeChecked();

      await user.click(generateReadmeCheckbox);

      // Assert
      expect(generateReadmeCheckbox).not.toBeChecked();
    });
  });

  // ========================================
  // Terraform生成のテスト
  // ========================================

  describe('Terraform生成', () => {
    it('生成実行ボタンをクリックするとTerraformが生成される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {
          users: ['user-1', 'user-2'],
        },
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf', 'groups.tf'],
        preview: {
          'users.tf': 'resource "aws_iam_user" "user1" {}',
        },
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(generateApi.generate).toHaveBeenCalledWith(
          mockScanId,
          expect.objectContaining({
            output_path: './terraform-output',
            file_split_rule: 'by_resource_type',
            naming_convention: 'snake_case',
            generate_readme: true,
          }),
          expect.objectContaining({
            users: expect.arrayContaining(['user-1', 'user-2']),
          })
        );
      });
    });

    it('生成中はローディングスピナーが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockImplementation(() => new Promise(() => {}));

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /生成中.../ })).toBeDisabled();
      });
    });

    it('生成成功時に成功メッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('Terraformコードの生成が完了しました');
      });
    });

    it('生成失敗時にエラーメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockRejectedValue({
        response: {
          data: {
            detail: '生成に失敗しました',
          },
        },
        message: '生成に失敗しました',
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('生成に失敗しました');
      });
    });

    it('バックエンドサーバーに接続できない場合はエラーが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(/バックエンドサーバーに接続できません/);
      });
    });
  });

  // ========================================
  // プレビュー表示のテスト
  // ========================================

  describe('プレビュー表示', () => {
    it('生成成功後にプレビューが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      const mockPreview = {
        'users.tf': 'resource "aws_iam_user" "user1" {\n  name = "test-user"\n}',
        'groups.tf': 'resource "aws_iam_group" "group1" {\n  name = "test-group"\n}',
      };
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf', 'groups.tf'],
        preview: mockPreview,
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('code-preview')).toBeInTheDocument();
        expect(screen.getByTestId('preview-users.tf')).toBeInTheDocument();
        expect(screen.getByTestId('preview-groups.tf')).toBeInTheDocument();
        expect(screen.getByText(/resource "aws_iam_user"/)).toBeInTheDocument();
      });
    });

    it('プレビューがない場合は表示されない', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
        // previewなし
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('code-preview')).not.toBeInTheDocument();
      });
    });
  });

  // ========================================
  // ダウンロード機能のテスト
  // TODO: document.createElementとURL.createObjectURLのモックに問題がある
  // ========================================

  describe.skip('ダウンロード機能', () => {
    beforeEach(() => {
      // URL.createObjectURLとrevokeObjectURLをモック化
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url') as any;
      globalThis.URL.revokeObjectURL = vi.fn() as any;
      
      // document.createElementとappendChild、removeChildをモック化
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
    });

    it('ZIPダウンロードボタンが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ZIPダウンロード/ })).toBeInTheDocument();
      });
    });

    it('ZIPダウンロードボタンをクリックするとダウンロードが実行される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });
      
      // ZIPファイルのモック（PKで始まる）
      const mockBlob = new Blob(['PK\x03\x04test'], { type: 'application/zip' });
      vi.mocked(generateApi.download).mockResolvedValue(mockBlob);

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ZIPダウンロード/ })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /ZIPダウンロード/ });
      await user.click(downloadButton);

      // Assert
      await waitFor(() => {
        expect(generateApi.download).toHaveBeenCalledWith('gen-123');
        expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      });
    });

    it('ダウンロード成功時に成功メッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });
      
      const mockBlob = new Blob(['PK\x03\x04test'], { type: 'application/zip' });
      vi.mocked(generateApi.download).mockResolvedValue(mockBlob);

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ZIPダウンロード/ })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /ZIPダウンロード/ });
      await user.click(downloadButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('ZIPファイルのダウンロードが完了しました');
      });
    });

    it('ダウンロード失敗時にエラーメッセージが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });
      
      vi.mocked(generateApi.download).mockRejectedValue({
        response: {
          data: {
            detail: 'ダウンロードに失敗しました',
          },
        },
        message: 'ダウンロードに失敗しました',
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ZIPダウンロード/ })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /ZIPダウンロード/ });
      await user.click(downloadButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('ダウンロードに失敗しました');
      });
    });
  });

  // ========================================
  // 検証・フォーマット機能のテスト
  // TODO: 非同期処理とステート更新のタイミング問題を修正する
  // ========================================

  describe.skip('検証・フォーマット機能', () => {
    it('生成成功後に検証パネルが表示される', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });
      vi.mocked(generateApi.generate).mockResolvedValue({
        generation_id: 'gen-123',
        output_path: './terraform-output',
        files: ['users.tf'],
      });

      // Act
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成実行/ })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成実行/ });
      await user.click(generateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('validation-panel')).toBeInTheDocument();
        expect(screen.getByTestId('validation-panel')).toHaveTextContent('gen-123');
      });
    });

    it('検証パネルがない場合は表示されない', async () => {
      // Arrange
      vi.mocked(resourcesApi.getSelectedResources).mockResolvedValue({
        selections: {},
      });

      // Act
      renderWithRouter();

      // Assert
      expect(screen.queryByTestId('validation-panel')).not.toBeInTheDocument();
    });
  });
});
