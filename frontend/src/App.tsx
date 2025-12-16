import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "./components/common/Layout";
import ConnectionPage from "./pages/ConnectionPage";
import ScanPage from "./pages/ScanPage";
import ResourcesPage from "./pages/ResourcesPage";
import GeneratePage from "./pages/GeneratePage";
import TemplatesPage from "./pages/TemplatesPage";
import LoadingSpinner from "./components/common/LoadingSpinner";

// Tauri環境かどうかを判定
const isTauri =
  typeof window !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ !== undefined;

function App() {
  const [backendReady, setBackendReady] = useState(!isTauri); // ブラウザ環境では常にtrue
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    // Tauri環境の場合のみ、バックエンドの準備完了を待つ
    if (!isTauri) {
      return;
    }

    const checkBackendHealth = async () => {
      const maxAttempts = 60; // 最大60回試行（60秒）
      const interval = 1000; // 1秒ごと

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const response = await fetch("http://localhost:8000/health", {
            method: "GET",
            signal: AbortSignal.timeout(2000), // 2秒のタイムアウト
          });

          if (response.ok) {
            setBackendReady(true);
            setBackendError(null);
            return;
          }
        } catch (error) {
          // エラーは無視して再試行
          if (i === maxAttempts - 1) {
            setBackendError(
              "バックエンドサーバーに接続できませんでした。バックエンドが起動しているか確認してください。"
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    };

    checkBackendHealth();
  }, []);

  // バックエンドが準備完了していない場合、ローディング画面を表示
  if (!backendReady) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "1rem",
        }}
      >
        <LoadingSpinner />
        <div style={{ textAlign: "center" }}>
          <p>バックエンドサーバーを起動しています...</p>
          {backendError && (
            <p style={{ color: "red", marginTop: "1rem" }}>{backendError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ConnectionPage />} />
          <Route path="/connection" element={<ConnectionPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/resources/:scanId" element={<ResourcesPage />} />
          <Route path="/generate/:scanId" element={<GeneratePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
