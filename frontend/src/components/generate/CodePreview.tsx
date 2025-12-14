import { useState } from "react";
import Editor from "@monaco-editor/react";

interface CodePreviewProps {
  preview: Record<string, string>;
}

export default function CodePreview({ preview }: CodePreviewProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Set first file as active tab if not set
  if (!activeTab && Object.keys(preview).length > 0) {
    setActiveTab(Object.keys(preview)[0]);
  }

  const files = Object.keys(preview);

  if (files.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        プレビューが利用できません
      </div>
    );
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
            language={getLanguage(activeTab)}
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
}
