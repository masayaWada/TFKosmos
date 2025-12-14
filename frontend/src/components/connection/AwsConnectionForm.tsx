import { useState } from "react";
import { connectionApi, AwsConnectionConfig } from "../../api/connection";
import LoadingSpinner from "../common/LoadingSpinner";
import ErrorMessage from "../common/ErrorMessage";
import SuccessMessage from "../common/SuccessMessage";

export default function AwsConnectionForm() {
  const [profile, setProfile] = useState("");
  const [region, setRegion] = useState("");
  const [assumeRoleArn, setAssumeRoleArn] = useState("");
  const [assumeRoleSessionName, setAssumeRoleSessionName] =
    useState("tfkosmos");
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await connectionApi.awsLogin(
        profile || undefined,
        region || undefined
      );
      if (result.success) {
        setSuccess(
          "aws loginが完了しました。ブラウザで認証を完了してください。"
        );
        // ログイン後、自動的に接続テストを実行
        setTimeout(() => {
          handleTest();
        }, 2000);
      } else {
        setError(result.detail || "aws loginに失敗しました");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "aws loginに失敗しました"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const config: AwsConnectionConfig = {};
      if (profile) config.profile = profile;
      if (assumeRoleArn) config.assume_role_arn = assumeRoleArn;
      if (assumeRoleSessionName)
        config.assume_role_session_name = assumeRoleSessionName;

      const result = await connectionApi.testAws(config);
      setSuccess(`接続成功: Account ID ${result.account_id}`);
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
      <h2>AWS接続設定</h2>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {success && (
        <SuccessMessage message={success} onClose={() => setSuccess(null)} />
      )}

      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "4px",
          border: "1px solid #dee2e6",
        }}
      >
        <h3
          style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem" }}
        >
          aws login（推奨）
        </h3>
        <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem" }}>
          ブラウザベースの認証により、アクセスキーを保存せずにセキュアに接続できます。
          AWS CLI v2.32.0以降が必要です。
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "bold",
            }}
          >
            プロファイル（オプション）
          </label>
          <input
            type="text"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="default"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
          <small style={{ color: "#666" }}>
            空欄の場合はデフォルトプロファイルを使用
          </small>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "bold",
            }}
          >
            AWSリージョン（オプション）
          </label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="ap-northeast-1"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
          <small style={{ color: "#666" }}>空欄の場合は既存の設定を使用</small>
        </div>

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loginLoading ? "not-allowed" : "pointer",
            opacity: loginLoading ? 0.6 : 1,
            marginRight: "0.5rem",
          }}
        >
          {loginLoading ? "aws login実行中..." : "aws login実行"}
        </button>
        {loginLoading && <LoadingSpinner />}
      </div>

      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#fff3cd",
          borderRadius: "4px",
          border: "1px solid #ffc107",
        }}
      >
        <h3
          style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem" }}
        >
          従来の方法（アクセスキー使用）
        </h3>
        <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem" }}>
          アクセスキーを使用する場合は、事前にaws configureで設定してください。
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          プロファイル
        </label>
        <input
          type="text"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="default"
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        />
        <small style={{ color: "#666" }}>
          空欄の場合はデフォルトプロファイルを使用
        </small>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Assume Role ARN (オプション)
        </label>
        <input
          type="text"
          value={assumeRoleArn}
          onChange={(e) => setAssumeRoleArn(e.target.value)}
          placeholder="arn:aws:iam::123456789012:role/AdminRole"
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
          Session Name (オプション)
        </label>
        <input
          type="text"
          value={assumeRoleSessionName}
          onChange={(e) => setAssumeRoleSessionName(e.target.value)}
          placeholder="tfkosmos"
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        />
      </div>

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
