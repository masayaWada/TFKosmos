import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  scanApi,
  ScanConfig,
  azureApi,
  AzureSubscription,
  AzureResourceGroup,
  ScanProgressEvent,
} from "../../api/scan";
import ErrorMessage from "../common/ErrorMessage";
import { formStyles } from "../../styles/formStyles";
import AzureScopeSelector from "./AzureScopeSelector";
import ScanTargetSelector from "./ScanTargetSelector";
import ScanProgressBar from "./ScanProgressBar";

interface ScanConfigFormProps {
  provider: "aws" | "azure";
  onScanComplete?: (scanId: string) => void;
}

const AWS_DEFAULT_TARGETS = {
  users: true,
  groups: true,
  roles: false,
  policies: false,
  attachments: true,
};

const AZURE_DEFAULT_TARGETS = {
  role_definitions: true,
  role_assignments: true,
};

export default function ScanConfigForm({
  provider,
  onScanComplete,
}: ScanConfigFormProps) {
  const navigate = useNavigate();
  const [scanTargets, setScanTargets] = useState<Record<string, boolean>>(
    provider === "aws" ? AWS_DEFAULT_TARGETS : AZURE_DEFAULT_TARGETS
  );
  const [namePrefix, setNamePrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [, setScanId] = useState<string | null>(null);

  // AWS specific
  const [profile, setProfile] = useState("");
  const [assumeRoleArn, setAssumeRoleArn] = useState("");

  // Azure specific
  const [subscriptionId, setSubscriptionId] = useState("");
  const [scopeType, setScopeType] = useState("subscription");
  const [scopeValue, setScopeValue] = useState("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");
  const [selectedResourceGroup, setSelectedResourceGroup] = useState("");
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingResourceGroups, setLoadingResourceGroups] = useState(false);
  const [azureAuthSettings, setAzureAuthSettings] = useState<{
    auth_method?: string;
    tenant_id?: string;
    client_id?: string;
    client_secret?: string;
  } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Reset scan targets when provider changes
  useEffect(() => {
    setScanTargets(
      provider === "aws" ? AWS_DEFAULT_TARGETS : AZURE_DEFAULT_TARGETS
    );
  }, [provider]);

  // Load subscriptions function
  const loadSubscriptions = useCallback(async () => {
    const savedSettings = localStorage.getItem("azure_connection_settings");
    if (!savedSettings) {
      setError(
        "接続設定が見つかりません。接続設定ページで接続テストを実行してください。"
      );
      return;
    }

    setLoadingSubscriptions(true);
    setError(null);
    try {
      const result = await azureApi.listSubscriptions(
        azureAuthSettings?.auth_method,
        azureAuthSettings?.tenant_id,
        azureAuthSettings?.client_id,
        azureAuthSettings?.client_secret
      );
      setSubscriptions(result.subscriptions);
      if (result.subscriptions.length === 0) {
        setError(
          "サブスクリプションが見つかりませんでした。Azure CLIでログインしているか、認証情報が正しいか確認してください。"
        );
      } else {
        setError(null);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "サブスクリプションの取得に失敗しました";
      setError(errorMessage);
      console.error("Failed to load subscriptions:", err);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, [azureAuthSettings]);

  // Load Azure connection settings from localStorage
  useEffect(() => {
    if (provider === "azure") {
      const savedSettings = localStorage.getItem("azure_connection_settings");
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setAzureAuthSettings(parsed);
          setError(null);
        } catch (e) {
          console.error("Failed to parse Azure connection settings:", e);
          setError("接続設定の読み込みに失敗しました。");
          setAzureAuthSettings({});
        }
      } else {
        setAzureAuthSettings({});
        setError(
          "接続設定が見つかりません。接続設定ページで接続テストを実行してください。"
        );
      }
      setSettingsLoaded(true);
    } else {
      setAzureAuthSettings(null);
      setSettingsLoaded(false);
      setError(null);
    }
  }, [provider]);

  // Load subscriptions when Azure provider is selected and settings are loaded
  useEffect(() => {
    if (provider === "azure" && settingsLoaded) {
      loadSubscriptions();
    }
  }, [provider, settingsLoaded, loadSubscriptions]);

  // Load resource groups when subscription is selected and scope type is resource_group
  useEffect(() => {
    if (
      provider === "azure" &&
      scopeType === "resource_group" &&
      selectedSubscriptionId
    ) {
      loadResourceGroups(selectedSubscriptionId);
    } else {
      setResourceGroups([]);
      setSelectedResourceGroup("");
    }
  }, [provider, scopeType, selectedSubscriptionId]);

  // Update subscriptionId and scopeValue when selections change
  useEffect(() => {
    if (scopeType === "subscription") {
      setSubscriptionId(selectedSubscriptionId);
      setScopeValue(selectedSubscriptionId);
    } else if (scopeType === "resource_group") {
      setSubscriptionId(selectedSubscriptionId);
      setScopeValue(selectedResourceGroup);
    } else {
      setSubscriptionId(selectedSubscriptionId);
    }
  }, [scopeType, selectedSubscriptionId, selectedResourceGroup]);

  const loadResourceGroups = async (subId: string) => {
    setLoadingResourceGroups(true);
    try {
      const result = await azureApi.listResourceGroups(
        subId,
        azureAuthSettings?.auth_method,
        azureAuthSettings?.tenant_id,
        azureAuthSettings?.client_id,
        azureAuthSettings?.client_secret
      );
      setResourceGroups(result.resource_groups);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        error.response?.data?.detail ||
          error.message ||
          "リソースグループの取得に失敗しました"
      );
    } finally {
      setLoadingResourceGroups(false);
    }
  };

  // SSE スキャンのキャンセル用ref
  const scanAbortedRef = useRef(false);

  /**
   * SSEストリーミングを使用してスキャンを実行
   * ブラウザがSSEに対応していない場合やエラーが発生した場合はポーリングにフォールバック
   */
  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setProgressMessage("スキャンを開始しています...");
    setScanId(null);
    scanAbortedRef.current = false;

    const config: ScanConfig = {
      provider,
      scan_targets: scanTargets,
      filters: namePrefix ? { name_prefix: namePrefix } : {},
    };

    if (provider === "aws") {
      if (profile) config.profile = profile;
      if (assumeRoleArn) config.assume_role_arn = assumeRoleArn;
    } else {
      if (subscriptionId) config.subscription_id = subscriptionId;
      if (scopeType) config.scope_type = scopeType;
      if (scopeValue) config.scope_value = scopeValue;
    }

    // SSEストリーミングを試行
    try {
      await handleScanWithStreaming(config);
    } catch (streamError) {
      console.warn("SSE streaming failed, falling back to polling:", streamError);
      // SSEが失敗した場合はポーリングにフォールバック
      await handleScanWithPolling(config);
    }
  };

  /**
   * SSEストリーミングでスキャンを実行
   */
  const handleScanWithStreaming = async (config: ScanConfig) => {
    let completedScanId: string | null = null;

    await scanApi.scanStream(config, {
      onProgress: (event: ScanProgressEvent) => {
        if (scanAbortedRef.current) return;
        setProgress(event.progress);
        setProgressMessage(event.message);
        if (event.scan_id) {
          setScanId(event.scan_id);
        }
      },
      onResource: (event: ScanProgressEvent) => {
        if (scanAbortedRef.current) return;
        setProgress(event.progress);
        const resourceInfo = event.resource_type && event.resource_count !== undefined
          ? `${event.resource_type}: ${event.resource_count}件`
          : event.message;
        setProgressMessage(resourceInfo);
      },
      onCompleted: (event: ScanProgressEvent) => {
        if (scanAbortedRef.current) return;
        setProgress(100);
        setProgressMessage("スキャンが完了しました");
        setLoading(false);
        completedScanId = event.scan_id;

        if (onScanComplete) {
          onScanComplete(event.scan_id);
        }
        navigate(`/resources/${event.scan_id}`);
      },
      onError: (error) => {
        if (scanAbortedRef.current) return;
        const message = error instanceof Error
          ? error.message
          : (error as ScanProgressEvent).message || "スキャンに失敗しました";
        setError(message);
        setLoading(false);
      },
    });

    // completedイベントが発火しなかった場合（SSE接続が切れた場合など）
    if (!completedScanId && !scanAbortedRef.current) {
      throw new Error("SSE stream ended without completion");
    }
  };

  /**
   * ポーリングでスキャンを実行（フォールバック）
   */
  const handleScanWithPolling = async (config: ScanConfig) => {
    try {
      const result =
        provider === "aws"
          ? await scanApi.scanAws(config)
          : await scanApi.scanAzure(config);

      const currentScanId = result.scan_id;
      setScanId(currentScanId);

      const progressInterval = setInterval(async () => {
        if (scanAbortedRef.current) {
          clearInterval(progressInterval);
          return;
        }

        try {
          const status = await scanApi.getStatus(currentScanId);
          setProgress(status.progress || 0);
          setProgressMessage(status.message || "スキャン中...");

          if (status.status === "completed") {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressMessage("スキャンが完了しました");
            setLoading(false);

            if (onScanComplete) {
              onScanComplete(currentScanId);
            }
            navigate(`/resources/${currentScanId}`);
          } else if (status.status === "failed" || status.status === "error") {
            clearInterval(progressInterval);
            setError(status.message || "スキャンに失敗しました");
            setLoading(false);
          }
        } catch {
          // Ignore errors during polling
        }
      }, 500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        error.response?.data?.detail || error.message || "スキャンに失敗しました"
      );
      setLoading(false);
    }
  };

  const toggleTarget = (target: string) => {
    setScanTargets((prev) => ({ ...prev, [target]: !prev[target] }));
  };

  const toggleAllTargets = useCallback(
    (checked: boolean) => {
      const defaultTargets =
        provider === "aws" ? AWS_DEFAULT_TARGETS : AZURE_DEFAULT_TARGETS;
      const newTargets: Record<string, boolean> = {};
      Object.keys(defaultTargets).forEach((key) => {
        newTargets[key] = checked;
      });
      setScanTargets(newTargets);
    },
    [provider]
  );

  return (
    <div style={formStyles.container}>
      <h2>{provider === "aws" ? "AWS" : "Azure"} IAMスキャン設定</h2>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {provider === "aws" ? (
        <>
          <div style={formStyles.fieldGroup}>
            <label style={formStyles.label}>プロファイル</label>
            <input
              type="text"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="default"
              style={formStyles.input}
            />
          </div>
          <div style={formStyles.fieldGroup}>
            <label style={formStyles.label}>Assume Role ARN (オプション)</label>
            <input
              type="text"
              value={assumeRoleArn}
              onChange={(e) => setAssumeRoleArn(e.target.value)}
              style={formStyles.input}
            />
          </div>
        </>
      ) : (
        <AzureScopeSelector
          scopeType={scopeType}
          setScopeType={setScopeType}
          selectedSubscriptionId={selectedSubscriptionId}
          setSelectedSubscriptionId={setSelectedSubscriptionId}
          selectedResourceGroup={selectedResourceGroup}
          setSelectedResourceGroup={setSelectedResourceGroup}
          scopeValue={scopeValue}
          setScopeValue={setScopeValue}
          subscriptions={subscriptions}
          resourceGroups={resourceGroups}
          loadingSubscriptions={loadingSubscriptions}
          loadingResourceGroups={loadingResourceGroups}
        />
      )}

      <ScanTargetSelector
        provider={provider}
        scanTargets={scanTargets}
        toggleTarget={toggleTarget}
        toggleAllTargets={toggleAllTargets}
      />

      <div style={formStyles.fieldGroup}>
        <label style={formStyles.label}>
          名前プレフィックスフィルタ (オプション)
        </label>
        <input
          type="text"
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
          placeholder="prod-"
          style={formStyles.input}
        />
      </div>

      <button
        onClick={handleScan}
        disabled={loading}
        style={{
          ...formStyles.button,
          ...(loading ? formStyles.buttonDisabled : {}),
          marginBottom: loading ? "1rem" : "0",
        }}
      >
        {loading ? "スキャン実行中..." : "スキャン実行"}
      </button>

      {loading && (
        <ScanProgressBar progress={progress} message={progressMessage} />
      )}
    </div>
  );
}
