import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { resourcesApi, DependencyGraph as DependencyGraphData } from "../api/resources";
import ResourceTabs from "../components/resources/ResourceTabs";
import ResourceTable from "../components/resources/ResourceTable";
import SelectionSummary from "../components/resources/SelectionSummary";
import ScanResultSummary from "../components/scan/ScanResultSummary";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import QueryInput from "../components/resources/QueryInput";
import DependencyGraph from "../components/resources/DependencyGraph";

export default function ResourcesPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const [activeTab, setActiveTab] = useState("users");
  const [resources, setResources] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [provider, setProvider] = useState<"aws" | "azure" | null>(null);
  const [filterText, setFilterText] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [queryMode, setQueryMode] = useState<'simple' | 'advanced'>('simple');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraphData | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);

  const awsTabs = [
    { id: "users", label: "Users" },
    { id: "groups", label: "Groups" },
    { id: "roles", label: "Roles" },
    { id: "policies", label: "Policies" },
    { id: "attachments", label: "Attachments" },
    { id: "cleanup", label: "Cleanup" },
    { id: "dependencies", label: "Dependencies" },
  ];

  const azureTabs = [
    { id: "role_assignments", label: "Role Assignments" },
    { id: "role_definitions", label: "Role Definitions" },
    { id: "dependencies", label: "Dependencies" },
  ];

  const tabs = provider === "azure" ? azureTabs : awsTabs;

  useEffect(() => {
    if (scanId) {
      // Reset page to 1 when tab or filter changes
      setPage(1);
    }
  }, [scanId, activeTab, filterText]);

  useEffect(() => {
    if (scanId) {
      if (activeTab === 'dependencies') {
        loadDependencies();
      } else {
        loadResources();
        loadSelectedResources();
      }
    }
  }, [scanId, activeTab, page, filterText]);

  useEffect(() => {
    if (scanId) {
      // Debounce save to avoid too many API calls
      const timeoutId = setTimeout(() => {
        saveSelectedResources();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedIds, activeTab]);

  const loadDependencies = async () => {
    if (!scanId) return;
    setLoadingDependencies(true);
    setError(null);
    try {
      const result = await resourcesApi.getDependencies(scanId);
      setDependencyGraph(result);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "依存関係の取得に失敗しました"
      );
    } finally {
      setLoadingDependencies(false);
    }
  };

  const loadResources = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      // Build filter object if filter text is provided
      let filter: string | undefined;
      if (filterText.trim()) {
        const filterObj: Record<string, string> = {};
        // Simple filter: search in common fields
        filterObj.search = filterText.trim();
        filter = JSON.stringify(filterObj);
      }

      const result = await resourcesApi.getResources(
        scanId,
        activeTab,
        page,
        50,
        filter
      );
      setResources(result.resources || []);
      setTotalPages(result.total_pages || 1);
      setTotalCount(result.total || 0);

      // Set provider from response if available
      if (result.provider && !provider) {
        setProvider(result.provider);
        // Set default tab based on provider
        if (result.provider === "azure") {
          setActiveTab("role_assignments");
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "リソースの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedResources = async () => {
    if (!scanId) return;
    try {
      const result = await resourcesApi.getSelectedResources(scanId);
      if (result.selections && result.selections[activeTab]) {
        const savedIds = result.selections[activeTab] || [];
        setSelectedIds(new Set(savedIds));
      }
    } catch (err) {
      // Ignore errors when loading selections
    }
  };

  const saveSelectedResources = async () => {
    if (!scanId) return;

    try {
      // Get current selections for all tabs
      const currentSelections = await resourcesApi
        .getSelectedResources(scanId)
        .catch(() => ({ selections: {} }));
      const allSelections: Record<string, string[]> =
        currentSelections.selections || {};

      // Update selections for current tab
      allSelections[activeTab] = Array.from(selectedIds);

      await resourcesApi.selectResources(scanId, allSelections);
    } catch (err) {
      // Ignore errors when saving selections
      console.error("Failed to save selected resources:", err);
    }
  };

  const handleQuery = async (query: string) => {
    if (!scanId) return;
    setQueryError(null);
    setLoading(true);
    setError(null);
    try {
      const result = await resourcesApi.query(scanId, query, {
        type: activeTab,
        page: 1,
        pageSize: 50,
      });
      setResources(result.resources || []);
      setTotalPages(result.total_pages || 1);
      setTotalCount(result.total || 0);
      setPage(1);
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || err.message || 'クエリ実行エラー');
    } finally {
      setLoading(false);
    }
  };

  const handleClearQuery = () => {
    setQueryError(null);
    loadResources();
  };

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(resources.map((r) => getResourceId(r))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const getResourceId = (resource: any): string => {
    if (activeTab === "users") return resource.user_name || resource.id;
    if (activeTab === "groups") return resource.group_name || resource.id;
    if (activeTab === "roles") return resource.role_name || resource.id;
    if (activeTab === "policies") return resource.arn || resource.id;
    if (activeTab === "attachments") {
      // Create unique ID from entity type, name, policy type, and policy name/ARN
      const entityType = resource.entity_type || resource.target_type || "";
      const entityName = resource.entity_name || resource.target_name || "";
      const policyType = resource.policy_type || "managed";
      const policyId = resource.policy_arn || resource.policy_name || "";
      return (
        `${entityType}_${entityName}_${policyType}_${policyId}` ||
        resource.attachment_id ||
        resource.id
      );
    }
    if (activeTab === "role_assignments")
      return resource.assignment_id || resource.id;
    if (activeTab === "role_definitions")
      return resource.role_definition_id || resource.id;
    if (activeTab === "cleanup") {
      const cleanupType = resource.type;
      const cleanupResource = resource.resource;
      if (cleanupType === "access_key")
        return cleanupResource?.access_key_id || resource.id;
      if (cleanupType === "login_profile")
        return `login_profile_${cleanupResource?.user_name}` || resource.id;
      if (cleanupType === "mfa_device")
        return cleanupResource?.serial_number || resource.id;
    }
    return resource.id || JSON.stringify(resource);
  };

  const getColumns = () => {
    if (activeTab === "users") {
      return [
        { key: "user_name", label: "User Name" },
        { key: "arn", label: "ARN" },
        { key: "path", label: "Path" },
      ];
    }
    if (activeTab === "groups") {
      return [
        { key: "group_name", label: "Group Name" },
        { key: "arn", label: "ARN" },
        { key: "path", label: "Path" },
      ];
    }
    if (activeTab === "roles") {
      return [
        { key: "role_name", label: "Role Name" },
        { key: "arn", label: "ARN" },
        { key: "path", label: "Path" },
      ];
    }
    if (activeTab === "policies") {
      return [
        { key: "policy_name", label: "Policy Name" },
        { key: "arn", label: "ARN" },
        { key: "path", label: "Path" },
      ];
    }
    if (activeTab === "attachments") {
      return [
        {
          key: "entity_type",
          label: "Target Type",
          render: (resource: any) => {
            const type = resource.entity_type || resource.target_type || "-";
            return type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter
          },
        },
        {
          key: "entity_name",
          label: "Target Name",
          render: (resource: any) =>
            resource.entity_name || resource.target_name || "-",
        },
        {
          key: "policy_type",
          label: "Policy Type",
          render: (resource: any) => {
            if (resource.policy_type === "inline") {
              return "Inline Policy";
            }
            return "Managed Policy";
          },
        },
        {
          key: "policy_name",
          label: "Policy Name",
          render: (resource: any) => resource.policy_name || "-",
        },
        {
          key: "policy_arn",
          label: "Policy ARN",
          render: (resource: any) =>
            resource.policy_arn ||
            (resource.policy_type === "inline" ? "-" : "-"),
        },
      ];
    }
    if (activeTab === "role_assignments") {
      return [
        { key: "role_definition_name", label: "Role Name" },
        {
          key: "principal_name",
          label: "Principal Name",
          render: (resource: any) =>
            resource.principal_name || resource.principal_id || "-",
        },
        { key: "principal_type", label: "Principal Type" },
        { key: "scope", label: "Scope" },
      ];
    }
    if (activeTab === "role_definitions") {
      return [
        { key: "role_name", label: "Role Name" },
        { key: "description", label: "Description" },
        { key: "role_type", label: "Role Type" },
        { key: "scope", label: "Scope" },
      ];
    }
    if (activeTab === "cleanup") {
      return [
        { key: "type", label: "Type" },
        {
          key: "resource",
          label: "Resource",
          render: (r: any) => {
            const res = r.resource;
            if (r.type === "access_key") return res?.access_key_id || "-";
            if (r.type === "login_profile") return res?.user_name || "-";
            if (r.type === "mfa_device") return res?.serial_number || "-";
            return "-";
          },
        },
      ];
    }
    return [];
  };

  if (loading && resources.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>リソース一覧</h1>
          <p style={{ margin: "0.5rem 0", color: "#666" }}>
            スキャンID: {scanId}
          </p>
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: showFilter ? "#007bff" : "#f5f5f5",
            color: showFilter ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {showFilter ? "フィルタを閉じる" : "フィルタ"}
        </button>
      </div>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {scanId && (
        <ScanResultSummary scanId={scanId} provider={provider || undefined} />
      )}

      {showFilter && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="radio"
                checked={queryMode === 'simple'}
                onChange={() => setQueryMode('simple')}
              />
              {' '}シンプル検索
            </label>
            <label style={{ marginLeft: '1rem' }}>
              <input
                type="radio"
                checked={queryMode === 'advanced'}
                onChange={() => setQueryMode('advanced')}
              />
              {' '}高度なクエリ
            </label>
          </div>

          {queryMode === 'simple' ? (
            <>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                検索フィルタ
              </label>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="リソース名、ARN、IDなどで検索..."
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
              {filterText && (
                <button
                  onClick={() => setFilterText("")}
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.5rem 1rem",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  クリア
                </button>
              )}
            </>
          ) : (
            <QueryInput
              onQuery={handleQuery}
              onClear={handleClearQuery}
              isLoading={loading}
              error={queryError || undefined}
            />
          )}
        </div>
      )}

      <ResourceTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      >
        {activeTab === 'dependencies' ? (
          loadingDependencies ? (
            <LoadingSpinner />
          ) : dependencyGraph ? (
            <DependencyGraph data={dependencyGraph} />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              依存関係データがありません
            </div>
          )
        ) : loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <ResourceTable
              resources={resources}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
              getResourceId={getResourceId}
              columns={getColumns()}
              resourceType={activeTab}
            />
            {totalPages > 0 && (
              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: page === 1 ? "#f5f5f5" : "white",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    color: page === 1 ? "#999" : "#333",
                  }}
                >
                  前へ
                </button>
                <span style={{ padding: "0.5rem", fontWeight: "bold" }}>
                  {page} / {totalPages} ページ (全 {totalCount} 件)
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: page === totalPages ? "#f5f5f5" : "white",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    color: page === totalPages ? "#999" : "#333",
                  }}
                >
                  次へ
                </button>
              </div>
            )}
            <SelectionSummary
              selectedCount={selectedIds.size}
              scanId={scanId || ""}
            />
          </>
        )}
      </ResourceTabs>
    </div>
  );
}
