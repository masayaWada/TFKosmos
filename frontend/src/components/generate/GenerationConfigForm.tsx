import { GenerationConfig } from "../../api/generate";

interface GenerationConfigFormProps {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
}

export default function GenerationConfigForm({
  config,
  onChange,
}: GenerationConfigFormProps) {
  const updateConfig = (updates: Partial<GenerationConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <h2>生成設定</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          出力先パス
        </label>
        <input
          type="text"
          value={config.output_path}
          onChange={(e) => updateConfig({ output_path: e.target.value })}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          ファイル分割ルール
        </label>
        <select
          value={config.file_split_rule || "single"}
          onChange={(e) => updateConfig({ file_split_rule: e.target.value })}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <option value="single">単一ファイル</option>
          <option value="by_resource_type">リソースタイプ別</option>
          <option value="by_resource_name">リソース名別</option>
          <option value="by_resource_group">リソースグループ別</option>
          <option value="by_subscription">サブスクリプション別</option>
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          命名規則
        </label>
        <select
          value={config.naming_convention || "snake_case"}
          onChange={(e) => updateConfig({ naming_convention: e.target.value })}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <option value="snake_case">snake_case</option>
          <option value="kebab-case">kebab-case</option>
          <option value="original">original</option>
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Importスクリプト形式
        </label>
        <select
          value={config.import_script_format || "sh"}
          onChange={(e) =>
            updateConfig({ import_script_format: e.target.value })
          }
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <option value="sh">Bash (sh)</option>
          <option value="ps1">PowerShell (ps1)</option>
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={config.generate_readme !== false}
            onChange={(e) =>
              updateConfig({ generate_readme: e.target.checked })
            }
          />
          READMEを生成
        </label>
      </div>
    </div>
  );
}
