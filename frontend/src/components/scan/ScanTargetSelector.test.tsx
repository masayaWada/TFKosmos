import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import ScanTargetSelector from './ScanTargetSelector';

describe('ScanTargetSelector', () => {
  describe('AWSプロバイダーの場合', () => {
    const defaultProps = {
      provider: 'aws' as const,
      scanTargets: {
        users: true,
        groups: false,
        roles: true,
        policies: false,
        attachments: false,
        cleanup: false,
      },
      toggleTarget: vi.fn(),
      toggleAllTargets: vi.fn(),
    };

    it('AWS用のスキャン対象を全て表示する', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.getByText('スキャン対象')).toBeInTheDocument();
      expect(screen.getByLabelText(/Users/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Groups/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Roles/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Policies/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Attachments/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Cleanup/)).toBeInTheDocument();
    });

    it('チェックボックスの状態が正しく反映される', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.getByLabelText(/Users/)).toBeChecked();
      expect(screen.getByLabelText(/Groups/)).not.toBeChecked();
      expect(screen.getByLabelText(/Roles/)).toBeChecked();
      expect(screen.getByLabelText(/Policies/)).not.toBeChecked();
    });

    it('チェックボックスをクリックするとtoggleTargetが呼ばれる', () => {
      const toggleTarget = vi.fn();
      const toggleAllTargets = vi.fn();
      render(<ScanTargetSelector {...defaultProps} toggleTarget={toggleTarget} toggleAllTargets={toggleAllTargets} />);

      fireEvent.click(screen.getByLabelText(/Groups/));
      expect(toggleTarget).toHaveBeenCalledWith('groups');

      fireEvent.click(screen.getByLabelText(/Users/));
      expect(toggleTarget).toHaveBeenCalledWith('users');
    });

    it('IAM親チェックボックスが表示される', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.getByLabelText(/IAM/)).toBeInTheDocument();
    });

    it('IAM親チェックボックスをクリックするとtoggleAllTargetsが呼ばれる', () => {
      const toggleAllTargets = vi.fn();
      // 一部チェックされている状態
      render(<ScanTargetSelector {...defaultProps} toggleAllTargets={toggleAllTargets} />);

      fireEvent.click(screen.getByLabelText(/IAM/));
      // 一部チェックされているので、クリックすると全部解除（false）
      expect(toggleAllTargets).toHaveBeenCalledWith(false);
    });

    it('全ての子がチェックされている場合、IAM親チェックボックスがチェック状態になる', () => {
      const allCheckedProps = {
        ...defaultProps,
        scanTargets: {
          users: true,
          groups: true,
          roles: true,
          policies: true,
          attachments: true,
          cleanup: true,
        },
      };
      render(<ScanTargetSelector {...allCheckedProps} />);

      expect(screen.getByLabelText(/IAM/)).toBeChecked();
    });

    it('全ての子がチェック解除されている場合、IAMをクリックすると全部チェックされる', () => {
      const toggleAllTargets = vi.fn();
      const noneCheckedProps = {
        ...defaultProps,
        scanTargets: {
          users: false,
          groups: false,
          roles: false,
          policies: false,
          attachments: false,
          cleanup: false,
        },
        toggleAllTargets,
      };
      render(<ScanTargetSelector {...noneCheckedProps} />);

      fireEvent.click(screen.getByLabelText(/IAM/));
      expect(toggleAllTargets).toHaveBeenCalledWith(true);
    });
  });

  describe('Azureプロバイダーの場合', () => {
    const defaultProps = {
      provider: 'azure' as const,
      scanTargets: {
        role_definitions: true,
        role_assignments: false,
      },
      toggleTarget: vi.fn(),
      toggleAllTargets: vi.fn(),
    };

    it('Azure用のスキャン対象を全て表示する', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.getByText('スキャン対象')).toBeInTheDocument();
      expect(screen.getByLabelText(/Role Definitions/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Role Assignments/)).toBeInTheDocument();
    });

    it('AWS用のスキャン対象は表示されない', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.queryByLabelText(/Users/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Policies/)).not.toBeInTheDocument();
    });

    it('チェックボックスの状態が正しく反映される', () => {
      render(<ScanTargetSelector {...defaultProps} />);

      expect(screen.getByLabelText(/Role Definitions/)).toBeChecked();
      expect(screen.getByLabelText(/Role Assignments/)).not.toBeChecked();
    });
  });
});
