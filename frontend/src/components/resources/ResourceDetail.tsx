import { useEffect } from "react";

interface ResourceDetailProps {
  resource: any;
  resourceType: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ResourceDetail({
  resource,
  resourceType,
  isOpen,
  onClose,
}: ResourceDetailProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !resource) {
    return null;
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getResourceTitle = (): string => {
    if (resourceType === "users")
      return resource.user_name || resource.id || "User";
    if (resourceType === "groups")
      return resource.group_name || resource.id || "Group";
    if (resourceType === "roles")
      return resource.role_name || resource.id || "Role";
    if (resourceType === "policies")
      return resource.policy_name || resource.id || "Policy";
    if (resourceType === "attachments") {
      const entityType =
        resource.entity_type || resource.target_type || "Entity";
      const entityName = resource.entity_name || resource.target_name || "";
      return `${entityType}: ${entityName}`;
    }
    if (resourceType === "role_assignments") {
      return (
        resource.role_definition_name ||
        resource.assignment_id ||
        "Role Assignment"
      );
    }
    if (resourceType === "role_definitions") {
      return (
        resource.role_name || resource.role_definition_id || "Role Definition"
      );
    }
    if (resourceType === "cleanup") {
      return `${resource.type || "Cleanup"} - ${
        resource.resource?.user_name ||
        resource.resource?.access_key_id ||
        resource.resource?.serial_number ||
        ""
      }`;
    }
    return "Resource";
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          maxWidth: "800px",
          maxHeight: "90vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>{getResourceTitle()}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#666",
              padding: "0.25rem 0.5rem",
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "1.5rem",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(resource).map(([key, value]) => {
                // Skip nested objects that are already displayed
                if (key === "resource" && typeof value === "object") {
                  return (
                    <tr key={key}>
                      <td
                        style={{
                          padding: "0.75rem",
                          borderBottom: "1px solid #eee",
                          fontWeight: "bold",
                          verticalAlign: "top",
                          width: "200px",
                        }}
                      >
                        {key}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            padding: "0.5rem",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "4px",
                            overflow: "auto",
                            maxHeight: "200px",
                          }}
                        >
                          {formatValue(value)}
                        </pre>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={key}>
                    <td
                      style={{
                        padding: "0.75rem",
                        borderBottom: "1px solid #eee",
                        fontWeight: "bold",
                        verticalAlign: "top",
                        width: "200px",
                      }}
                    >
                      {key}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {typeof value === "object" && value !== null ? (
                        <pre
                          style={{
                            margin: 0,
                            padding: "0.5rem",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "4px",
                            overflow: "auto",
                            maxHeight: "200px",
                          }}
                        >
                          {formatValue(value)}
                        </pre>
                      ) : (
                        formatValue(value)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #ddd",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
