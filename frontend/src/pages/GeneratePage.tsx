import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateApi, GenerationConfig } from "../api/generate";
import { resourcesApi } from "../api/resources";
import GenerationConfigForm from "../components/generate/GenerationConfigForm";
import CodePreview from "../components/generate/CodePreview";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import SuccessMessage from "../components/common/SuccessMessage";

export default function GeneratePage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
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
    // 実際の実装では、リソース選択状態を取得する必要があります
    // ここでは簡易的に実装しています
  };

  const handleGenerate = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await generateApi.generate(
        scanId,
        config,
        selectedResources
      );
      setGenerationResult(result);
      setSuccess("Terraformコードの生成が完了しました");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "生成に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generationResult?.generation_id) return;
    try {
      const blob = await generateApi.download(generationResult.generation_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "terraform-output.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "ダウンロードに失敗しました"
      );
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

      {generationResult && generationResult.preview && (
        <div style={{ marginTop: "2rem" }}>
          <h2>プレビュー</h2>
          <CodePreview preview={generationResult.preview} />
        </div>
      )}
    </div>
  );
}
