import { useState, useEffect } from "react";
import {
  generateApi,
  ValidationResult,
  FormatResult,
  TerraformStatus,
} from "../../api/generate";

interface Props {
  generationId: string;
}

export default function ValidationPanel({ generationId }: Props) {
  const [terraformStatus, setTerraformStatus] =
    useState<TerraformStatus | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [formatResult, setFormatResult] = useState<FormatResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isLoadingTerraform, setIsLoadingTerraform] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkTerraform();
  }, []);

  const checkTerraform = async () => {
    setIsLoadingTerraform(true);
    try {
      const status = await generateApi.checkTerraform();
      setTerraformStatus(status);
    } catch {
      setTerraformStatus({ available: false, version: "" });
    } finally {
      setIsLoadingTerraform(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const result = await generateApi.validate(generationId);
      setValidationResult(result);

      const format = await generateApi.checkFormat(generationId);
      setFormatResult(format);
    } catch (err: any) {
      setError(err.message || "検証に失敗しました");
    } finally {
      setIsValidating(false);
    }
  };

  const handleFormat = async () => {
    setIsFormatting(true);
    setError(null);
    try {
      await generateApi.format(generationId);
      // 再検証
      await handleValidate();
    } catch (err: any) {
      setError(err.message || "フォーマットに失敗しました");
    } finally {
      setIsFormatting(false);
    }
  };

  // Show loading state while checking Terraform CLI
  if (isLoadingTerraform) {
    return (
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "4px",
          padding: "1rem",
          marginTop: "1rem",
          color: "#666",
        }}
      >
        Terraform CLIを確認中...
      </div>
    );
  }

  // Show error if Terraform CLI is not available
  if (!terraformStatus?.available) {
    return (
      <div
        style={{
          backgroundColor: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: "4px",
          padding: "1rem",
          marginTop: "1rem",
        }}
      >
        <strong>Terraform CLIが見つかりません</strong>
        <p>検証機能を使用するには、Terraform CLIをインストールしてください。</p>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "1rem",
        marginTop: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Terraform検証</h3>
        <span style={{ fontSize: "0.875rem", color: "#666" }}>
          Terraform {terraformStatus.version}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={handleValidate}
          disabled={isValidating}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isValidating ? "not-allowed" : "pointer",
          }}
        >
          {isValidating ? "検証中..." : "検証実行"}
        </button>

        {formatResult && !formatResult.formatted && (
          <button
            onClick={handleFormat}
            disabled={isFormatting}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#ffc107",
              color: "black",
              border: "none",
              borderRadius: "4px",
              cursor: isFormatting ? "not-allowed" : "pointer",
            }}
          >
            {isFormatting ? "フォーマット中..." : "自動フォーマット"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#dc3545", marginBottom: "1rem" }}>{error}</div>
      )}

      {validationResult && (
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: validationResult.valid ? "#28a745" : "#dc3545",
              }}
            />
            <strong>
              {validationResult.valid ? "検証成功" : "検証エラー"}
            </strong>
          </div>

          {validationResult.errors.length > 0 && (
            <div
              style={{
                backgroundColor: "#f8d7da",
                padding: "0.5rem",
                borderRadius: "4px",
                marginBottom: "0.5rem",
              }}
            >
              <strong>エラー ({validationResult.errors.length})</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.5rem" }}>
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div
              style={{
                backgroundColor: "#fff3cd",
                padding: "0.5rem",
                borderRadius: "4px",
              }}
            >
              <strong>警告 ({validationResult.warnings.length})</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.5rem" }}>
                {validationResult.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {formatResult && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: formatResult.formatted ? "#28a745" : "#ffc107",
              }}
            />
            <strong>
              {formatResult.formatted
                ? "フォーマット済み"
                : "フォーマットが必要"}
            </strong>
          </div>

          {formatResult.files_changed.length > 0 && (
            <div style={{ fontSize: "0.875rem", color: "#666" }}>
              変更が必要なファイル: {formatResult.files_changed.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
