import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import ScanTargetSelector from './ScanTargetSelector';

describe('ScanTargetSelector', () => {
  describe('AWSプロバイダーの場合', () => {
    // テストデータのファクトリー関数
    const createDefaultProps = (overrides = {}) => ({
      provider: 'aws' as const,
      scanTargets: {
        users: true,
        groups: false,
        roles: true,
        policies: false,
        attachments: false,
      },
      toggleTarget: vi.fn(),
      toggleAllTargets: vi.fn(),
      ...overrides,
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('AWS用のスキャン対象を全て表示する', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByText('スキャン対象')).toBeInTheDocument();
      expect(screen.getByLabelText(/Users/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Groups/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Roles/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Policies/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Attachments/)).toBeInTheDocument();
    });

    it('チェックボックスの状態が正しく反映される', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByLabelText(/Users/)).toBeChecked();
      expect(screen.getByLabelText(/Groups/)).not.toBeChecked();
      expect(screen.getByLabelText(/Roles/)).toBeChecked();
      expect(screen.getByLabelText(/Policies/)).not.toBeChecked();
    });

    it('チェックボックスをクリックするとtoggleTargetが呼ばれる', () => {
      // Arrange
      const toggleTarget = vi.fn();
      const props = createDefaultProps({ toggleTarget });

      // Act
      render(<ScanTargetSelector {...props} />);
      fireEvent.click(screen.getByLabelText(/Groups/));
      fireEvent.click(screen.getByLabelText(/Users/));

      // Assert
      expect(toggleTarget).toHaveBeenCalledWith('groups');
      expect(toggleTarget).toHaveBeenCalledWith('users');
      expect(toggleTarget).toHaveBeenCalledTimes(2);
    });

    it('IAM親チェックボックスが表示される', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByLabelText(/IAM/)).toBeInTheDocument();
    });

    it('IAM親チェックボックスをクリックするとtoggleAllTargetsが呼ばれる', () => {
      // Arrange
      const toggleAllTargets = vi.fn();
      const props = createDefaultProps({ toggleAllTargets });

      // Act
      render(<ScanTargetSelector {...props} />);
      fireEvent.click(screen.getByLabelText(/IAM/));

      // Assert
      // 一部チェックされているので、クリックすると全部解除（false）
      expect(toggleAllTargets).toHaveBeenCalledWith(false);
      expect(toggleAllTargets).toHaveBeenCalledTimes(1);
    });

    it('全ての子がチェックされている場合、IAM親チェックボックスがチェック状態になる', () => {
      // Arrange
      const props = createDefaultProps({
        scanTargets: {
          users: true,
          groups: true,
          roles: true,
          policies: true,
          attachments: true,
        },
      });

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByLabelText(/IAM/)).toBeChecked();
    });

    it('全ての子がチェック解除されている場合、IAMをクリックすると全部チェックされる', () => {
      // Arrange
      const toggleAllTargets = vi.fn();
      const props = createDefaultProps({
        scanTargets: {
          users: false,
          groups: false,
          roles: false,
          policies: false,
          attachments: false,
        },
        toggleAllTargets,
      });

      // Act
      render(<ScanTargetSelector {...props} />);
      fireEvent.click(screen.getByLabelText(/IAM/));

      // Assert
      expect(toggleAllTargets).toHaveBeenCalledWith(true);
      expect(toggleAllTargets).toHaveBeenCalledTimes(1);
    });
  });

  describe('Azureプロバイダーの場合', () => {
    // テストデータのファクトリー関数
    const createDefaultProps = (overrides = {}) => ({
      provider: 'azure' as const,
      scanTargets: {
        role_definitions: true,
        role_assignments: false,
      },
      toggleTarget: vi.fn(),
      toggleAllTargets: vi.fn(),
      ...overrides,
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Azure用のスキャン対象を全て表示する', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByText('スキャン対象')).toBeInTheDocument();
      expect(screen.getByLabelText(/Role Definitions/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Role Assignments/)).toBeInTheDocument();
    });

    it('AWS用のスキャン対象は表示されない', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.queryByLabelText(/Users/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Policies/)).not.toBeInTheDocument();
    });

    it('チェックボックスの状態が正しく反映される', () => {
      // Arrange
      const props = createDefaultProps();

      // Act
      render(<ScanTargetSelector {...props} />);

      // Assert
      expect(screen.getByLabelText(/Role Definitions/)).toBeChecked();
      expect(screen.getByLabelText(/Role Assignments/)).not.toBeChecked();
    });
  });
});
