import { useState } from "react";
import { connectionApi, AzureConnectionConfig } from "../../api/connection";
import LoadingSpinner from "../common/LoadingSpinner";
import ErrorMessage from "../common/ErrorMessage";
import SuccessMessage from "../common/SuccessMessage";

export default function AzureConnectionForm() {
  const [authMethod, setAuthMethod] = useState<
    "az_login" | "service_principal"
  >("az_login");
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const config: AzureConnectionConfig = {};
      if (authMethod) config.auth_method = authMethod;
      if (tenantId) config.tenant_id = tenantId;
      if (authMethod === "service_principal") {
        config.service_principal_config = {
          client_id: clientId,
          client_secret: clientSecret,
          tenant_id: tenantId,
        };
      }

      const result = await connectionApi.testAzure(config);
      setSuccess(
        `接続成功${
          result.subscription_name ? `: ${result.subscription_name}` : ""
        }`
      );

      // 接続設定をlocalStorageに保存
      const connectionSettings = {
        auth_method: authMethod,
        tenant_id: tenantId || undefined,
        client_id: authMethod === "service_principal" ? clientId : undefined,
        client_secret:
          authMethod === "service_principal" ? clientSecret : undefined,
      };
      localStorage.setItem(
        "azure_connection_settings",
        JSON.stringify(connectionSettings)
      );
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "接続に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <h2>Azure接続設定</h2>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {success && (
        <SuccessMessage message={success} onClose={() => setSuccess(null)} />
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          認証方式
        </label>
        <select
          value={authMethod}
          onChange={(e) =>
            setAuthMethod(e.target.value as "az_login" | "service_principal")
          }
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <option value="az_login">Azure CLI (az login)</option>
          <option value="service_principal">Service Principal</option>
        </select>
      </div>

      {authMethod === "service_principal" && (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              テナントID
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
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
              Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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
              Client Secret
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>
        </>
      )}

      <button
        onClick={handleTest}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "接続テスト中..." : "接続テスト"}
      </button>
      {loading && <LoadingSpinner />}
    </div>
  );
}
