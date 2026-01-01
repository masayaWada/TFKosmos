import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { generateApi, GenerationConfig } from "../api/generate";
import GenerationConfigForm from "../components/generate/GenerationConfigForm";
import CodePreview from "../components/generate/CodePreview";
import ValidationPanel from "../components/generate/ValidationPanel";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import SuccessMessage from "../components/common/SuccessMessage";

export default function GeneratePage() {
  const { scanId } = useParams<{ scanId: string }>();
  const [config, setConfig] = useState<GenerationConfig>({
    output_path: "./terraform-output",
    file_split_rule: "by_resource_type",
    naming_convention: "snake_case",
    import_script_format: "sh",
    generate_readme: true,
  });
  const [selectedResources, setSelectedResources] = useState<
    Record<string, string[]>
  >({});
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (scanId) {
      loadSelectedResources();
    }
  }, [scanId]);

  const loadSelectedResources = async () => {
    if (!scanId) return;
    try {
      const { resourcesApi } = await import("../api/resources");
      const result = await resourcesApi.getSelectedResources(scanId);
      if (result.selections) {
        // Convert Value[] to string[] (IDs)
        const selections: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(result.selections)) {
          if (Array.isArray(value)) {
            selections[key] = value.map((v: any) => {
              // If it's a string, use it directly; if it's an object, extract ID
              if (typeof v === "string") {
                return v;
              } else if (v && typeof v === "object") {
                // Try to get ID from common fields
                return (
                  v.user_name ||
                  v.group_name ||
                  v.role_name ||
                  v.arn ||
                  v.id ||
                  JSON.stringify(v)
                );
              }
              return String(v);
            });
          }
        }
        setSelectedResources(selections);
        console.log("Loaded selected resources:", selections);
      }
    } catch (err) {
      console.error("Failed to load selected resources:", err);
      // Ignore errors - use empty selection
    }
  };

  const handleGenerate = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // バックエンドサーバーが起動しているか確認
      try {
        await fetch("http://localhost:8000/health");
      } catch (healthError) {
        setError(
          "バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。\n" +
            "エラー: " +
            (healthError instanceof Error
              ? healthError.message
              : String(healthError))
        );
        setLoading(false);
        return;
      }

      const result = await generateApi.generate(
        scanId,
        config,
        selectedResources
      );
      setGenerationResult(result);
      setSuccess("Terraformコードの生成が完了しました");
    } catch (err: any) {
      console.error("Generation error:", err);
      let errorMessage = "生成に失敗しました";

      if (err.response) {
        // HTTPエラーレスポンス
        const detail = err.response.data?.detail;
        if (detail) {
          errorMessage = detail;
        } else {
          errorMessage = `HTTP ${err.response.status}: ${err.response.statusText}`;
        }
      } else if (err.request) {
        // リクエストは送信されたが、レスポンスが返ってこなかった
        errorMessage =
          "バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generationResult?.generation_id) return;
    try {
      const blob = await generateApi.download(generationResult.generation_id);

      // Check if blob is empty
      if (blob.size === 0) {
        setError(
          "ダウンロードされたZIPファイルが空です。生成されたファイルが存在しない可能性があります。"
        );
        return;
      }

      // Check if blob is actually a ZIP file (check first bytes)
      const arrayBuffer = await blob.slice(0, 4).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      // ZIP files start with "PK" (0x50 0x4B)
      if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4b) {
        // Might be an error JSON response, try to parse it
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          setError(errorData.detail || "ダウンロードに失敗しました");
        } catch {
          setError(
            "ダウンロードされたファイルが有効なZIPファイルではありません。"
          );
        }
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "terraform-output.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess("ZIPファイルのダウンロードが完了しました");
    } catch (err: any) {
      // Handle different error types
      if (err.response) {
        // Try to parse error response as JSON
        if (err.response.data instanceof Blob) {
          const text = await err.response.data.text();
          try {
            const errorData = JSON.parse(text);
            setError(errorData.detail || "ダウンロードに失敗しました");
          } catch {
            setError("ダウンロードに失敗しました");
          }
        } else {
          setError(
            err.response?.data?.detail ||
              err.message ||
              "ダウンロードに失敗しました"
          );
        }
      } else {
        setError(err.message || "ダウンロードに失敗しました");
      }
    }
  };

  return (
    <div>
      <h1>生成設定</h1>
      <p style={{ marginBottom: "1rem", color: "#666" }}>
        スキャンID: {scanId}
      </p>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {success && (
        <SuccessMessage message={success} onClose={() => setSuccess(null)} />
      )}

      <GenerationConfigForm config={config} onChange={setConfig} />

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            marginRight: "1rem",
          }}
        >
          {loading ? "生成中..." : "生成実行"}
        </button>

        {generationResult && (
          <button
            onClick={handleDownload}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ZIPダウンロード
          </button>
        )}
      </div>

      {loading && <LoadingSpinner />}

      {generationResult && (
        <ValidationPanel generationId={generationResult.generation_id} />
      )}

      {generationResult && generationResult.preview && (
        <div style={{ marginTop: "2rem" }}>
          <h2>プレビュー</h2>
          <CodePreview preview={generationResult.preview} />
        </div>
      )}
    </div>
  );
}
