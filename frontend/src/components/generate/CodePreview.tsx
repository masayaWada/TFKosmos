import { memo, useState, useMemo, useEffect } from "react";
import Editor from "@monaco-editor/react";

interface CodePreviewProps {
  preview: Record<string, string>;
}

const getLanguage = (filename: string): string => {
  if (filename.endsWith(".tf")) return "hcl";
  if (filename.endsWith(".sh")) return "shell";
  if (filename.endsWith(".ps1")) return "powershell";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "yaml";
  return "plaintext";
};

const CodePreview = memo(function CodePreview({ preview }: CodePreviewProps) {
  const files = useMemo(() => Object.keys(preview), [preview]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Set first file as active tab if not set or if preview changes
  useEffect(() => {
    if (files.length > 0 && (!activeTab || !files.includes(activeTab))) {
      setActiveTab(files[0]);
    }
  }, [files, activeTab]);

  const activeLanguage = useMemo(() => {
    return activeTab ? getLanguage(activeTab) : "plaintext";
  }, [activeTab]);

  if (files.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        プレビューが利用できません
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#f5f5f5",
        }}
      >
        {files.map((filename) => (
          <button
            key={filename}
            onClick={() => setActiveTab(filename)}
            style={{
              padding: "0.75rem 1rem",
              border: "none",
              borderBottom:
                activeTab === filename
                  ? "2px solid #007bff"
                  : "2px solid transparent",
              backgroundColor: activeTab === filename ? "white" : "transparent",
              cursor: "pointer",
              fontWeight: activeTab === filename ? "bold" : "normal",
              color: activeTab === filename ? "#007bff" : "#666",
            }}
          >
            {filename}
          </button>
        ))}
      </div>

      {/* Editor */}
      {activeTab && preview[activeTab] && (
        <div style={{ height: "500px" }}>
          <Editor
            height="100%"
            language={activeLanguage}
            value={preview[activeTab]}
            theme="vs-light"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              fontSize: 14,
              lineNumbers: "on",
              folding: true,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </div>
  );
});

export default CodePreview;
