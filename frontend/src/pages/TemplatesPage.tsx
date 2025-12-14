import { useEffect, useState } from "react";
import { templatesApi, Template } from "../api/templates";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import SuccessMessage from "../components/common/SuccessMessage";
import Editor from "@monaco-editor/react";
import CodePreview from "../components/generate/CodePreview";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateContent();
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await templatesApi.list();
      setTemplates(result.templates);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "テンプレートの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateContent = async () => {
    if (!selectedTemplate) return;
    try {
      const source = selectedTemplate.has_user_override ? "user" : "default";
      const result = await templatesApi.get(
        selectedTemplate.resource_type,
        source
      );
      setEditorContent(result.content);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "テンプレートの読み込みに失敗しました"
      );
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      await templatesApi.save(selectedTemplate.resource_type, editorContent);
      setSuccess("テンプレートを保存しました");
      loadTemplates();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "保存に失敗しました"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!confirm("デフォルトに復元しますか？")) return;
    setSaving(true);
    setError(null);
    try {
      await templatesApi.delete(selectedTemplate.resource_type);
      setSuccess("デフォルトに復元しました");
      loadTemplates();
      if (selectedTemplate) {
        loadTemplateContent();
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "削除に失敗しました"
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate || !editorContent) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await templatesApi.preview(
        selectedTemplate.resource_type,
        editorContent
      );
      setPreview({ [selectedTemplate.resource_type]: result.preview });
      setShowPreview(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "プレビューの生成に失敗しました"
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <div style={{ width: "300px" }}>
        <h2>テンプレート一覧</h2>
        {error && (
          <ErrorMessage message={error} onClose={() => setError(null)} />
        )}
        {success && (
          <SuccessMessage message={success} onClose={() => setSuccess(null)} />
        )}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {templates.map((template) => (
            <button
              key={template.resource_type}
              onClick={() => setSelectedTemplate(template)}
              style={{
                padding: "0.75rem",
                textAlign: "left",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor:
                  selectedTemplate?.resource_type === template.resource_type
                    ? "#e7f3ff"
                    : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{template.resource_type}</div>
              <div style={{ fontSize: "0.875rem", color: "#666" }}>
                {template.has_user_override ? "カスタム" : "デフォルト"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {selectedTemplate ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2>{selectedTemplate.resource_type}</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handlePreview}
                  disabled={loadingPreview || !editorContent}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor:
                      loadingPreview || !editorContent
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {loadingPreview ? "プレビュー中..." : "プレビュー"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  保存
                </button>
                {selectedTemplate.has_user_override && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    デフォルトに復元
                  </button>
                )}
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <Editor
                height="400px"
                defaultLanguage="hcl"
                value={editorContent}
                onChange={(value) => setEditorContent(value || "")}
                theme="vs-dark"
              />
              {showPreview && preview && (
                <div>
                  <h3>プレビュー</h3>
                  <CodePreview preview={preview} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
            テンプレートを選択してください
          </div>
        )}
      </div>
    </div>
  );
}
