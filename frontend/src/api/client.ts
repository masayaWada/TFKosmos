import axios, { AxiosError } from "axios";

// ========================================
// 型定義
// ========================================

/** バックエンドからのエラーレスポンス形式 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** レガシーエラーレスポンス形式（後方互換性） */
interface LegacyErrorResponse {
  detail: string;
}

/** カスタムAPIエラー */
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** エラーが外部サービス（AWS/Azure）に起因するかどうか */
  isExternalServiceError(): boolean {
    return this.code === "EXTERNAL_SERVICE_ERROR";
  }

  /** リソースが見つからないエラーかどうか */
  isNotFoundError(): boolean {
    return this.code === "NOT_FOUND";
  }

  /** バリデーションエラーかどうか */
  isValidationError(): boolean {
    return this.code === "VALIDATION_ERROR";
  }
}

// ========================================
// APIクライアント設定
// ========================================

// ランタイム環境に応じて API のベースURLを切り替える
// - ブラウザ (Vite dev / 静的ホスティング):
//   `/api` を使用し、Vite の proxy や同一オリジン設定に従う
// - Tauri (dev / 本番):
//   ローカルのバックエンド http://localhost:8000/api を直接叩く
const isTauri =
  typeof window !== "undefined" &&
  // Tauri v2 で定義されるグローバル
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ !== undefined;

const apiBaseUrl = isTauri ? "http://localhost:8000/api" : "/api";

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 500;

    // Handle API error responses
    if (error.response?.data) {
      const errorData = error.response.data as
        | ApiErrorResponse
        | LegacyErrorResponse;

      // 新しいエラー形式
      if ("error" in errorData && errorData.error) {
        return Promise.reject(
          new ApiError(
            errorData.error.message || "An error occurred",
            errorData.error.code || "UNKNOWN_ERROR",
            status,
            errorData.error.details
          )
        );
      }

      // レガシーエラー形式（後方互換性）
      if ("detail" in errorData && errorData.detail) {
        return Promise.reject(
          new ApiError(errorData.detail, "LEGACY_ERROR", status)
        );
      }
    }

    // ネットワークエラーなど
    if (error.code === "ERR_NETWORK") {
      return Promise.reject(
        new ApiError(
          "バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。",
          "NETWORK_ERROR",
          0
        )
      );
    }

    // タイムアウト
    if (error.code === "ECONNABORTED") {
      return Promise.reject(
        new ApiError(
          "リクエストがタイムアウトしました。再度お試しください。",
          "TIMEOUT_ERROR",
          0
        )
      );
    }

    // その他のエラー
    return Promise.reject(
      new ApiError(error.message || "An error occurred", "UNKNOWN_ERROR", status)
    );
  }
);

export default apiClient;

// ========================================
// ユーティリティ関数
// ========================================

/**
 * エラーからユーザー向けメッセージを取得
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "予期しないエラーが発生しました";
}
