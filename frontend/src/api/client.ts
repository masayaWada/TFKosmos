import axios, { AxiosError } from "axios";

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
    // Handle API error responses
    if (error.response?.data) {
      const errorData = error.response.data as any;
      if (errorData.error) {
        // Custom error format from backend
        const customError = new Error(
          errorData.error.message || "An error occurred"
        );
        (customError as any).code = errorData.error.code;
        (customError as any).details = errorData.error.details;
        return Promise.reject(customError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
