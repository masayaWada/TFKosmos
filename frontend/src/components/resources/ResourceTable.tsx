import { useState, useMemo } from "react";
import ResourceDetail from "./ResourceDetail";

interface ResourceTableProps {
  resources: any[];
  selectedIds: Set<string>;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  getResourceId: (resource: any) => string;
  columns: {
    key: string;
    label: string;
    render?: (resource: any) => React.ReactNode;
  }[];
  resourceType: string;
}

type SortDirection = "asc" | "desc" | null;

export default function ResourceTable({
  resources,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  getResourceId,
  columns,
  resourceType,
}: ResourceTableProps) {
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const allSelected =
    resources.length > 0 &&
    resources.every((r) => selectedIds.has(getResourceId(r)));
  const someSelected = resources.some((r) => selectedIds.has(getResourceId(r)));

  const handleRowClick = (resource: any) => {
    setSelectedResource(resource);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedResource(null);
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const sortedResources = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return resources;
    }

    const sorted = [...resources].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [resources, sortColumn, sortDirection]);

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  border: "1px solid #ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input)
                      input.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </th>
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                const sortIcon = isSorted
                  ? sortDirection === "asc"
                    ? " ↑"
                    : sortDirection === "desc"
                    ? " ↓"
                    : ""
                  : "";
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "1px solid #ddd",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: isSorted ? "#e7f3ff" : "#f5f5f5",
                    }}
                  >
                    {col.label}
                    {sortIcon}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedResources.map((resource, index) => {
              const id = getResourceId(resource);
              const isSelected = selectedIds.has(id);
              return (
                <tr
                  key={id}
                  style={{
                    backgroundColor: isSelected
                      ? "#e7f3ff"
                      : index % 2 === 0
                      ? "white"
                      : "#f9f9f9",
                    cursor: "pointer",
                  }}
                  onClick={() => handleRowClick(resource)}
                >
                  <td
                    style={{ padding: "0.75rem", border: "1px solid #ddd" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectionChange(id, e.target.checked)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ padding: "0.75rem", border: "1px solid #ddd" }}
                    >
                      {col.render
                        ? col.render(resource)
                        : resource[col.key] || "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {resources.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
            リソースが見つかりません
          </div>
        )}
      </div>
      <ResourceDetail
        resource={selectedResource}
        resourceType={resourceType}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />
    </>
  );
}
