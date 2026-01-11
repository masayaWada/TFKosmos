import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";

// ========================================
// 型定義
// ========================================

export type Provider = "aws" | "azure" | null;

export interface ScanState {
  scanId: string | null;
  provider: Provider;
  status: "idle" | "scanning" | "completed" | "failed";
  progress: number;
  message: string;
}

export interface AwsConnectionState {
  profile?: string;
  region?: string;
  assumeRoleArn?: string;
  isValidated: boolean;
}

export interface AzureConnectionState {
  authMethod: "az_login" | "service_principal";
  tenantId?: string;
  clientId?: string;
  isValidated: boolean;
}

export interface ConnectionState {
  aws: AwsConnectionState;
  azure: AzureConnectionState;
}

export interface Notification {
  id: string;
  type: "error" | "success" | "warning" | "info";
  message: string;
  duration?: number;
}

export interface AppState {
  scan: ScanState;
  connection: ConnectionState;
  notifications: Notification[];
}

// ========================================
// 初期状態
// ========================================

export const initialState: AppState = {
  scan: {
    scanId: null,
    provider: null,
    status: "idle",
    progress: 0,
    message: "",
  },
  connection: {
    aws: {
      isValidated: false,
    },
    azure: {
      authMethod: "az_login",
      isValidated: false,
    },
  },
  notifications: [],
};

// ========================================
// アクション定義
// ========================================

export type Action =
  // スキャン関連
  | { type: "START_SCAN"; payload: { scanId: string; provider: Provider } }
  | {
      type: "UPDATE_SCAN_PROGRESS";
      payload: { progress: number; message: string };
    }
  | { type: "COMPLETE_SCAN" }
  | { type: "FAIL_SCAN"; payload: { message: string } }
  | { type: "RESET_SCAN" }
  // AWS接続関連
  | { type: "SET_AWS_CONNECTION"; payload: Partial<AwsConnectionState> }
  | { type: "VALIDATE_AWS_CONNECTION" }
  | { type: "INVALIDATE_AWS_CONNECTION" }
  // Azure接続関連
  | { type: "SET_AZURE_CONNECTION"; payload: Partial<AzureConnectionState> }
  | { type: "VALIDATE_AZURE_CONNECTION" }
  | { type: "INVALIDATE_AZURE_CONNECTION" }
  // 通知関連
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "REMOVE_NOTIFICATION"; payload: { id: string } }
  | { type: "CLEAR_NOTIFICATIONS" };

// ========================================
// リデューサー
// ========================================

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // スキャン関連
    case "START_SCAN":
      return {
        ...state,
        scan: {
          ...state.scan,
          scanId: action.payload.scanId,
          provider: action.payload.provider,
          status: "scanning",
          progress: 0,
          message: "スキャンを開始しています...",
        },
      };
    case "UPDATE_SCAN_PROGRESS":
      return {
        ...state,
        scan: {
          ...state.scan,
          progress: action.payload.progress,
          message: action.payload.message,
        },
      };
    case "COMPLETE_SCAN":
      return {
        ...state,
        scan: {
          ...state.scan,
          status: "completed",
          progress: 100,
          message: "スキャンが完了しました",
        },
      };
    case "FAIL_SCAN":
      return {
        ...state,
        scan: {
          ...state.scan,
          status: "failed",
          message: action.payload.message,
        },
      };
    case "RESET_SCAN":
      return {
        ...state,
        scan: initialState.scan,
      };

    // AWS接続関連
    case "SET_AWS_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          aws: { ...state.connection.aws, ...action.payload },
        },
      };
    case "VALIDATE_AWS_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          aws: { ...state.connection.aws, isValidated: true },
        },
      };
    case "INVALIDATE_AWS_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          aws: { ...state.connection.aws, isValidated: false },
        },
      };

    // Azure接続関連
    case "SET_AZURE_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          azure: { ...state.connection.azure, ...action.payload },
        },
      };
    case "VALIDATE_AZURE_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          azure: { ...state.connection.azure, isValidated: true },
        },
      };
    case "INVALIDATE_AZURE_CONNECTION":
      return {
        ...state,
        connection: {
          ...state.connection,
          azure: { ...state.connection.azure, isValidated: false },
        },
      };

    // 通知関連
    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload.id
        ),
      };
    case "CLEAR_NOTIFICATIONS":
      return {
        ...state,
        notifications: [],
      };

    default:
      return state;
  }
}

// ========================================
// コンテキスト
// ========================================

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // 便利関数
  startScan: (scanId: string, provider: Provider) => void;
  updateScanProgress: (progress: number, message: string) => void;
  completeScan: () => void;
  failScan: (message: string) => void;
  resetScan: () => void;
  addNotification: (
    type: Notification["type"],
    message: string,
    duration?: number
  ) => void;
  removeNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ========================================
// プロバイダー
// ========================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // スキャン関連の便利関数
  const startScan = useCallback((scanId: string, provider: Provider) => {
    dispatch({ type: "START_SCAN", payload: { scanId, provider } });
  }, []);

  const updateScanProgress = useCallback((progress: number, message: string) => {
    dispatch({ type: "UPDATE_SCAN_PROGRESS", payload: { progress, message } });
  }, []);

  const completeScan = useCallback(() => {
    dispatch({ type: "COMPLETE_SCAN" });
  }, []);

  const failScan = useCallback((message: string) => {
    dispatch({ type: "FAIL_SCAN", payload: { message } });
  }, []);

  const resetScan = useCallback(() => {
    dispatch({ type: "RESET_SCAN" });
  }, []);

  // 通知関連の便利関数
  const addNotification = useCallback(
    (type: Notification["type"], message: string, duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: { id, type, message, duration },
      });

      // 自動削除
      if (duration) {
        setTimeout(() => {
          dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } });
        }, duration);
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } });
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    startScan,
    updateScanProgress,
    completeScan,
    failScan,
    resetScan,
    addNotification,
    removeNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ========================================
// カスタムフック
// ========================================

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

// 個別の状態へのアクセス用フック
export function useScan() {
  const { state, startScan, updateScanProgress, completeScan, failScan, resetScan } =
    useApp();
  return {
    ...state.scan,
    startScan,
    updateScanProgress,
    completeScan,
    failScan,
    resetScan,
  };
}

export function useConnection() {
  const { state, dispatch } = useApp();
  return {
    ...state.connection,
    setAwsConnection: (payload: Partial<AwsConnectionState>) =>
      dispatch({ type: "SET_AWS_CONNECTION", payload }),
    validateAwsConnection: () => dispatch({ type: "VALIDATE_AWS_CONNECTION" }),
    invalidateAwsConnection: () =>
      dispatch({ type: "INVALIDATE_AWS_CONNECTION" }),
    setAzureConnection: (payload: Partial<AzureConnectionState>) =>
      dispatch({ type: "SET_AZURE_CONNECTION", payload }),
    validateAzureConnection: () =>
      dispatch({ type: "VALIDATE_AZURE_CONNECTION" }),
    invalidateAzureConnection: () =>
      dispatch({ type: "INVALIDATE_AZURE_CONNECTION" }),
  };
}

export function useNotifications() {
  const { state, addNotification, removeNotification, dispatch } = useApp();
  return {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearNotifications: () => dispatch({ type: "CLEAR_NOTIFICATIONS" }),
  };
}
