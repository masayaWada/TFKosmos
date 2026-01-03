import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import ValidationPanel from './ValidationPanel';
import * as generateModule from '../../api/generate';

// generateApiをモック化
vi.mock('../../api/generate', () => ({
  generateApi: {
    checkTerraform: vi.fn(),
    validate: vi.fn(),
    checkFormat: vi.fn(),
    format: vi.fn(),
  },
}));

describe('ValidationPanel', () => {
  const mockGenerationId = 'test-generation-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Terraform CLIステータス', () => {
    it('Terraform CLIが利用可能な場合、バージョン情報を表示する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.checkTerraform).mockResolvedValue({
        available: true,
        version: '1.4.4',
      });

      // Act
      render(<ValidationPanel generationId={mockGenerationId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Terraform検証')).toBeInTheDocument();
        expect(screen.getByText(/Terraform 1\.4\.4/)).toBeInTheDocument();
      });
    });

    it('Terraform CLIが利用不可能な場合、エラーメッセージを表示する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.checkTerraform).mockResolvedValue({
        available: false,
        version: '',
      });

      // Act
      render(<ValidationPanel generationId={mockGenerationId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Terraform CLIが見つかりません')).toBeInTheDocument();
        expect(
          screen.getByText(/検証機能を使用するには、Terraform CLIをインストールしてください/)
        ).toBeInTheDocument();
      });
    });

    it('Terraform CLIチェック中はローディング表示を行う', () => {
      // Arrange
      vi.mocked(generateModule.generateApi.checkTerraform).mockImplementation(
        () => new Promise(() => {}) // 永続的に待機
      );

      // Act
      render(<ValidationPanel generationId={mockGenerationId} />);

      // Assert
      expect(screen.getByText('Terraform CLIを確認中...')).toBeInTheDocument();
    });
  });

  describe('検証機能', () => {
    beforeEach(() => {
      vi.mocked(generateModule.generateApi.checkTerraform).mockResolvedValue({
        available: true,
        version: '1.4.4',
      });
    });

    it('検証実行ボタンをクリックすると検証を実行する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: true,
        files_changed: [],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(generateModule.generateApi.validate).toHaveBeenCalledWith(mockGenerationId);
        expect(generateModule.generateApi.checkFormat).toHaveBeenCalledWith(mockGenerationId);
      });
    });

    it('検証成功時、成功メッセージを表示する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: true,
        files_changed: [],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('検証成功')).toBeInTheDocument();
        expect(screen.getByText('フォーマット済み')).toBeInTheDocument();
      });
    });

    it('検証エラー時、エラーメッセージを表示する', async () => {
      // Arrange
      const errors = [
        'Error: Invalid resource configuration',
        'Error: Missing required argument',
      ];
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: false,
        errors,
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: true,
        files_changed: [],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('検証エラー')).toBeInTheDocument();
        expect(screen.getByText(`エラー (${errors.length})`)).toBeInTheDocument();
        errors.forEach((error) => {
          expect(screen.getByText(error)).toBeInTheDocument();
        });
      });
    });

    it('警告がある場合、警告メッセージを表示する', async () => {
      // Arrange
      const warnings = ['Warning: Deprecated syntax detected', 'Warning: Resource may be recreated'];
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings,
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: true,
        files_changed: [],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('検証成功')).toBeInTheDocument();
        expect(screen.getByText(`警告 (${warnings.length})`)).toBeInTheDocument();
        warnings.forEach((warning) => {
          expect(screen.getByText(warning)).toBeInTheDocument();
        });
      });
    });

    it('検証失敗時、エラーメッセージを表示する', async () => {
      // Arrange
      const errorMessage = 'Network error';
      vi.mocked(generateModule.generateApi.validate).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('フォーマット機能', () => {
    beforeEach(() => {
      vi.mocked(generateModule.generateApi.checkTerraform).mockResolvedValue({
        available: true,
        version: '1.4.4',
      });
    });

    it('フォーマットが必要な場合、自動フォーマットボタンを表示する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: false,
        files_changed: ['main.tf', 'variables.tf'],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('フォーマットが必要')).toBeInTheDocument();
        expect(screen.getByText('自動フォーマット')).toBeInTheDocument();
        expect(screen.getByText(/変更が必要なファイル: main\.tf, variables\.tf/)).toBeInTheDocument();
      });
    });

    it('自動フォーマットボタンをクリックするとフォーマットを実行する', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: false,
        files_changed: ['main.tf'],
      });
      vi.mocked(generateModule.generateApi.format).mockResolvedValue({
        success: true,
        files_formatted: ['main.tf'],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('自動フォーマット')).toBeInTheDocument();
      });

      // Act
      const formatButton = screen.getByText('自動フォーマット');
      fireEvent.click(formatButton);

      // Assert
      await waitFor(() => {
        expect(generateModule.generateApi.format).toHaveBeenCalledWith(mockGenerationId);
        // フォーマット後、再検証が実行される
        expect(generateModule.generateApi.validate).toHaveBeenCalledTimes(2);
      });
    });

    it('フォーマット済みの場合、自動フォーマットボタンを表示しない', async () => {
      // Arrange
      vi.mocked(generateModule.generateApi.validate).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(generateModule.generateApi.checkFormat).mockResolvedValue({
        formatted: true,
        files_changed: [],
      });

      render(<ValidationPanel generationId={mockGenerationId} />);

      await waitFor(() => {
        expect(screen.getByText('検証実行')).toBeInTheDocument();
      });

      // Act
      const validateButton = screen.getByText('検証実行');
      fireEvent.click(validateButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('フォーマット済み')).toBeInTheDocument();
        expect(screen.queryByText('自動フォーマット')).not.toBeInTheDocument();
      });
    });
  });
});
