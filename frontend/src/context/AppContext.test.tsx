import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AppProvider,
  useApp,
  useScan,
  useConnection,
  useNotifications,
  appReducer,
  initialState,
  type AppState,
  type Action,
} from './AppContext';

// ========================================
// Reducerテスト
// ========================================

describe('appReducer', () => {
  describe('START_SCANアクション', () => {
    it('スキャンを開始する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'START_SCAN',
        payload: { scanId: 'test-scan-id', provider: 'aws' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan.scanId).toBe('test-scan-id');
      expect(newState.scan.provider).toBe('aws');
      expect(newState.scan.status).toBe('scanning');
      expect(newState.scan.progress).toBe(0);
      expect(newState.scan.message).toBe('スキャンを開始しています...');
    });

    it('Azureプロバイダーでスキャンを開始する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'START_SCAN',
        payload: { scanId: 'azure-scan-id', provider: 'azure' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan.scanId).toBe('azure-scan-id');
      expect(newState.scan.provider).toBe('azure');
      expect(newState.scan.status).toBe('scanning');
    });
  });

  describe('UPDATE_SCAN_PROGRESSアクション', () => {
    it('スキャンの進捗を更新する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        scan: {
          scanId: 'test-scan-id',
          provider: 'aws',
          status: 'scanning',
          progress: 30,
          message: '初期メッセージ',
        },
      };
      const action: Action = {
        type: 'UPDATE_SCAN_PROGRESS',
        payload: { progress: 50, message: 'ユーザーをスキャン中...' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan.progress).toBe(50);
      expect(newState.scan.message).toBe('ユーザーをスキャン中...');
      expect(newState.scan.scanId).toBe('test-scan-id');
      expect(newState.scan.status).toBe('scanning');
    });
  });

  describe('COMPLETE_SCANアクション', () => {
    it('スキャンを完了状態にする', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        scan: {
          scanId: 'test-scan-id',
          provider: 'aws',
          status: 'scanning',
          progress: 80,
          message: '処理中...',
        },
      };
      const action: Action = { type: 'COMPLETE_SCAN' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan.status).toBe('completed');
      expect(newState.scan.progress).toBe(100);
      expect(newState.scan.message).toBe('スキャンが完了しました');
      expect(newState.scan.scanId).toBe('test-scan-id');
    });
  });

  describe('FAIL_SCANアクション', () => {
    it('スキャンを失敗状態にする', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        scan: {
          scanId: 'test-scan-id',
          provider: 'aws',
          status: 'scanning',
          progress: 50,
          message: '処理中...',
        },
      };
      const action: Action = {
        type: 'FAIL_SCAN',
        payload: { message: '認証エラーが発生しました' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan.status).toBe('failed');
      expect(newState.scan.message).toBe('認証エラーが発生しました');
      expect(newState.scan.scanId).toBe('test-scan-id');
    });
  });

  describe('RESET_SCANアクション', () => {
    it('スキャン状態をリセットする', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        scan: {
          scanId: 'test-scan-id',
          provider: 'aws',
          status: 'completed',
          progress: 100,
          message: '完了',
        },
      };
      const action: Action = { type: 'RESET_SCAN' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.scan).toEqual(initialState.scan);
    });
  });

  describe('SET_AWS_CONNECTIONアクション', () => {
    it('AWS接続情報を設定する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'SET_AWS_CONNECTION',
        payload: { profile: 'test-profile', region: 'us-east-1' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.aws.profile).toBe('test-profile');
      expect(newState.connection.aws.region).toBe('us-east-1');
      expect(newState.connection.aws.isValidated).toBe(false);
    });

    it('AWS接続情報を部分的に更新する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        connection: {
          ...initialState.connection,
          aws: { profile: 'existing-profile', region: 'us-west-1', isValidated: true },
        },
      };
      const action: Action = {
        type: 'SET_AWS_CONNECTION',
        payload: { region: 'ap-northeast-1' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.aws.profile).toBe('existing-profile');
      expect(newState.connection.aws.region).toBe('ap-northeast-1');
      expect(newState.connection.aws.isValidated).toBe(true);
    });
  });

  describe('VALIDATE_AWS_CONNECTIONアクション', () => {
    it('AWS接続を有効化する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = { type: 'VALIDATE_AWS_CONNECTION' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.aws.isValidated).toBe(true);
    });
  });

  describe('INVALIDATE_AWS_CONNECTIONアクション', () => {
    it('AWS接続を無効化する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        connection: {
          ...initialState.connection,
          aws: { isValidated: true },
        },
      };
      const action: Action = { type: 'INVALIDATE_AWS_CONNECTION' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.aws.isValidated).toBe(false);
    });
  });

  describe('SET_AZURE_CONNECTIONアクション', () => {
    it('Azure接続情報を設定する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'SET_AZURE_CONNECTION',
        payload: { tenantId: 'test-tenant-id', clientId: 'test-client-id' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.azure.tenantId).toBe('test-tenant-id');
      expect(newState.connection.azure.clientId).toBe('test-client-id');
      expect(newState.connection.azure.authMethod).toBe('az_login');
      expect(newState.connection.azure.isValidated).toBe(false);
    });

    it('Azure接続の認証方法を変更する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'SET_AZURE_CONNECTION',
        payload: { authMethod: 'service_principal' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.azure.authMethod).toBe('service_principal');
    });
  });

  describe('VALIDATE_AZURE_CONNECTIONアクション', () => {
    it('Azure接続を有効化する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = { type: 'VALIDATE_AZURE_CONNECTION' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.azure.isValidated).toBe(true);
    });
  });

  describe('INVALIDATE_AZURE_CONNECTIONアクション', () => {
    it('Azure接続を無効化する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        connection: {
          ...initialState.connection,
          azure: { ...initialState.connection.azure, isValidated: true },
        },
      };
      const action: Action = { type: 'INVALIDATE_AZURE_CONNECTION' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.connection.azure.isValidated).toBe(false);
    });
  });

  describe('ADD_NOTIFICATIONアクション', () => {
    it('通知を追加する', () => {
      // Arrange
      const state: AppState = initialState;
      const action: Action = {
        type: 'ADD_NOTIFICATION',
        payload: {
          id: 'notification-1',
          type: 'success',
          message: 'テスト通知',
          duration: 3000,
        },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.notifications).toHaveLength(1);
      expect(newState.notifications[0]).toEqual({
        id: 'notification-1',
        type: 'success',
        message: 'テスト通知',
        duration: 3000,
      });
    });

    it('複数の通知を追加する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        notifications: [
          {
            id: 'notification-1',
            type: 'info',
            message: '最初の通知',
          },
        ],
      };
      const action: Action = {
        type: 'ADD_NOTIFICATION',
        payload: {
          id: 'notification-2',
          type: 'error',
          message: 'エラー通知',
        },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.notifications).toHaveLength(2);
      expect(newState.notifications[0].id).toBe('notification-1');
      expect(newState.notifications[1].id).toBe('notification-2');
    });
  });

  describe('REMOVE_NOTIFICATIONアクション', () => {
    it('指定した通知を削除する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        notifications: [
          { id: 'notification-1', type: 'info', message: '通知1' },
          { id: 'notification-2', type: 'success', message: '通知2' },
          { id: 'notification-3', type: 'warning', message: '通知3' },
        ],
      };
      const action: Action = {
        type: 'REMOVE_NOTIFICATION',
        payload: { id: 'notification-2' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.notifications).toHaveLength(2);
      expect(newState.notifications.find((n) => n.id === 'notification-2')).toBeUndefined();
      expect(newState.notifications[0].id).toBe('notification-1');
      expect(newState.notifications[1].id).toBe('notification-3');
    });

    it('存在しない通知IDを削除しようとしてもエラーにならない', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        notifications: [{ id: 'notification-1', type: 'info', message: '通知1' }],
      };
      const action: Action = {
        type: 'REMOVE_NOTIFICATION',
        payload: { id: 'non-existent-id' },
      };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.notifications).toHaveLength(1);
      expect(newState.notifications[0].id).toBe('notification-1');
    });
  });

  describe('CLEAR_NOTIFICATIONSアクション', () => {
    it('すべての通知を削除する', () => {
      // Arrange
      const state: AppState = {
        ...initialState,
        notifications: [
          { id: 'notification-1', type: 'info', message: '通知1' },
          { id: 'notification-2', type: 'success', message: '通知2' },
        ],
      };
      const action: Action = { type: 'CLEAR_NOTIFICATIONS' };

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState.notifications).toHaveLength(0);
    });
  });

  describe('デフォルトケース', () => {
    it('未知のアクションタイプの場合は状態を変更しない', () => {
      // Arrange
      const state: AppState = initialState;
      const action = { type: 'UNKNOWN_ACTION' } as unknown as Action;

      // Act
      const newState = appReducer(state, action);

      // Assert
      expect(newState).toEqual(state);
    });
  });
});

// ========================================
// カスタムフックテスト
// ========================================

describe('useApp', () => {
  it('AppProviderの外で使用するとエラーを投げる', () => {
    // Arrange & Act & Assert
    expect(() => {
      renderHook(() => useApp());
    }).toThrow('useApp must be used within an AppProvider');
  });

  it('AppProvider内で使用するとコンテキスト値を返す', () => {
    // Arrange & Act
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    // Assert
    expect(result.current.state).toBeDefined();
    expect(result.current.dispatch).toBeDefined();
    expect(result.current.startScan).toBeDefined();
    expect(result.current.updateScanProgress).toBeDefined();
    expect(result.current.completeScan).toBeDefined();
    expect(result.current.failScan).toBeDefined();
    expect(result.current.resetScan).toBeDefined();
    expect(result.current.addNotification).toBeDefined();
    expect(result.current.removeNotification).toBeDefined();
  });

  it('startScanを呼び出すとスキャンが開始される', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.startScan('test-scan-id', 'aws');
    });

    // Assert
    expect(result.current.state.scan.scanId).toBe('test-scan-id');
    expect(result.current.state.scan.provider).toBe('aws');
    expect(result.current.state.scan.status).toBe('scanning');
  });

  it('updateScanProgressを呼び出すと進捗が更新される', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.startScan('test-scan-id', 'aws');
    });

    // Act
    act(() => {
      result.current.updateScanProgress(50, 'ユーザーをスキャン中...');
    });

    // Assert
    expect(result.current.state.scan.progress).toBe(50);
    expect(result.current.state.scan.message).toBe('ユーザーをスキャン中...');
  });

  it('completeScanを呼び出すとスキャンが完了する', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.startScan('test-scan-id', 'aws');
    });

    // Act
    act(() => {
      result.current.completeScan();
    });

    // Assert
    expect(result.current.state.scan.status).toBe('completed');
    expect(result.current.state.scan.progress).toBe(100);
  });

  it('failScanを呼び出すとスキャンが失敗する', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.startScan('test-scan-id', 'aws');
    });

    // Act
    act(() => {
      result.current.failScan('エラーが発生しました');
    });

    // Assert
    expect(result.current.state.scan.status).toBe('failed');
    expect(result.current.state.scan.message).toBe('エラーが発生しました');
  });

  it('resetScanを呼び出すとスキャン状態がリセットされる', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.startScan('test-scan-id', 'aws');
      result.current.completeScan();
    });

    // Act
    act(() => {
      result.current.resetScan();
    });

    // Assert
    expect(result.current.state.scan).toEqual(initialState.scan);
  });

  it('addNotificationを呼び出すと通知が追加される', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.addNotification('success', 'テスト通知');
    });

    // Assert
    expect(result.current.state.notifications).toHaveLength(1);
    expect(result.current.state.notifications[0].type).toBe('success');
    expect(result.current.state.notifications[0].message).toBe('テスト通知');
  });

  it('removeNotificationを呼び出すと通知が削除される', () => {
    // Arrange
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.addNotification('info', 'テスト通知');
    });

    const notificationId = result.current.state.notifications[0]?.id;
    expect(notificationId).toBeDefined();

    // Act
    act(() => {
      result.current.removeNotification(notificationId!);
    });

    // Assert
    expect(result.current.state.notifications).toHaveLength(0);
  });
});

describe('useScan', () => {
  it('スキャン状態と関数を返す', () => {
    // Arrange & Act
    const { result } = renderHook(() => useScan(), {
      wrapper: AppProvider,
    });

    // Assert
    expect(result.current.scanId).toBeNull();
    expect(result.current.provider).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.message).toBe('');
    expect(result.current.startScan).toBeDefined();
    expect(result.current.updateScanProgress).toBeDefined();
    expect(result.current.completeScan).toBeDefined();
    expect(result.current.failScan).toBeDefined();
    expect(result.current.resetScan).toBeDefined();
  });

  it('startScanを呼び出すとスキャン状態が更新される', () => {
    // Arrange
    const { result } = renderHook(() => useScan(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.startScan('test-scan-id', 'aws');
    });

    // Assert
    expect(result.current.scanId).toBe('test-scan-id');
    expect(result.current.provider).toBe('aws');
    expect(result.current.status).toBe('scanning');
  });
});

describe('useConnection', () => {
  it('接続状態と関数を返す', () => {
    // Arrange & Act
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    // Assert
    expect(result.current.aws).toBeDefined();
    expect(result.current.azure).toBeDefined();
    expect(result.current.setAwsConnection).toBeDefined();
    expect(result.current.validateAwsConnection).toBeDefined();
    expect(result.current.invalidateAwsConnection).toBeDefined();
    expect(result.current.setAzureConnection).toBeDefined();
    expect(result.current.validateAzureConnection).toBeDefined();
    expect(result.current.invalidateAzureConnection).toBeDefined();
  });

  it('setAwsConnectionを呼び出すとAWS接続情報が設定される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.setAwsConnection({ profile: 'test-profile', region: 'us-east-1' });
    });

    // Assert
    expect(result.current.aws.profile).toBe('test-profile');
    expect(result.current.aws.region).toBe('us-east-1');
  });

  it('validateAwsConnectionを呼び出すとAWS接続が有効化される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.validateAwsConnection();
    });

    // Assert
    expect(result.current.aws.isValidated).toBe(true);
  });

  it('invalidateAwsConnectionを呼び出すとAWS接続が無効化される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.validateAwsConnection();
    });

    // Act
    act(() => {
      result.current.invalidateAwsConnection();
    });

    // Assert
    expect(result.current.aws.isValidated).toBe(false);
  });

  it('setAzureConnectionを呼び出すとAzure接続情報が設定される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.setAzureConnection({
        tenantId: 'test-tenant-id',
        clientId: 'test-client-id',
      });
    });

    // Assert
    expect(result.current.azure.tenantId).toBe('test-tenant-id');
    expect(result.current.azure.clientId).toBe('test-client-id');
  });

  it('validateAzureConnectionを呼び出すとAzure接続が有効化される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.validateAzureConnection();
    });

    // Assert
    expect(result.current.azure.isValidated).toBe(true);
  });

  it('invalidateAzureConnectionを呼び出すとAzure接続が無効化される', () => {
    // Arrange
    const { result } = renderHook(() => useConnection(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.validateAzureConnection();
    });

    // Act
    act(() => {
      result.current.invalidateAzureConnection();
    });

    // Assert
    expect(result.current.azure.isValidated).toBe(false);
  });
});

describe('useNotifications', () => {
  it('通知状態と関数を返す', () => {
    // Arrange & Act
    const { result } = renderHook(() => useNotifications(), {
      wrapper: AppProvider,
    });

    // Assert
    expect(result.current.notifications).toEqual([]);
    expect(result.current.addNotification).toBeDefined();
    expect(result.current.removeNotification).toBeDefined();
    expect(result.current.clearNotifications).toBeDefined();
  });

  it('addNotificationを呼び出すと通知が追加される', () => {
    // Arrange
    const { result } = renderHook(() => useNotifications(), {
      wrapper: AppProvider,
    });

    // Act
    act(() => {
      result.current.addNotification('error', 'エラーが発生しました');
    });

    // Assert
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('error');
    expect(result.current.notifications[0].message).toBe('エラーが発生しました');
  });

  it('removeNotificationを呼び出すと通知が削除される', () => {
    // Arrange
    const { result } = renderHook(() => useNotifications(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.addNotification('warning', '警告');
    });

    const notificationId = result.current.notifications[0]?.id;
    expect(notificationId).toBeDefined();

    // Act
    act(() => {
      result.current.removeNotification(notificationId!);
    });

    // Assert
    expect(result.current.notifications).toHaveLength(0);
  });

  it('clearNotificationsを呼び出すとすべての通知が削除される', () => {
    // Arrange
    const { result } = renderHook(() => useNotifications(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.addNotification('info', '通知1');
      result.current.addNotification('success', '通知2');
    });

    // Act
    act(() => {
      result.current.clearNotifications();
    });

    // Assert
    expect(result.current.notifications).toHaveLength(0);
  });
});

