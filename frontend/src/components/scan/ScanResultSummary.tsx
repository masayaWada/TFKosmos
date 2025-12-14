import { useEffect, useState } from "react";
import { scanApi, ScanStatus } from "../../api/scan";

interface ScanResultSummaryProps {
  scanId: string;
  provider?: "aws" | "azure";
}

export default function ScanResultSummary({
  scanId,
  provider,
}: ScanResultSummaryProps) {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const status: ScanStatus = await scanApi.getStatus(scanId);
        if (status.summary) {
          setSummary(status.summary);
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to load scan summary:", err);
        setLoading(false);
      }
    };

    if (scanId) {
      loadSummary();
    }
  }, [scanId]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!summary || Object.keys(summary).length === 0) {
    return null;
  }

  const awsLabels: Record<string, string> = {
    users: "Users",
    groups: "Groups",
    roles: "Roles",
    policies: "Policies",
    attachments: "Attachments",
    cleanup: "Cleanup",
  };

  const azureLabels: Record<string, string> = {
    role_definitions: "Role Definitions",
    role_assignments: "Role Assignments",
  };

  const labels = provider === "azure" ? azureLabels : awsLabels;

  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        marginTop: "1rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>
        スキャン結果サマリー
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
        }}
      >
        {Object.entries(summary).map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: "0.75rem",
              backgroundColor: "white",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                color: "#666",
                marginBottom: "0.25rem",
              }}
            >
              {labels[key] || key}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#007bff",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
