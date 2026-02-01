import { memo, useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import ResourceDetail from "./ResourceDetail";

/** 仮想スクロールを有効にするリソース数のしきい値 */
const VIRTUALIZATION_THRESHOLD = 100;
/** 仮想スクロール時の行の高さ（ピクセル） */
const ROW_HEIGHT = 44;

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

const ResourceTable = memo(function ResourceTable({
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

  const allSelected = useMemo(
    () =>
      resources.length > 0 &&
      resources.every((r) => selectedIds.has(getResourceId(r))),
    [resources, selectedIds, getResourceId]
  );

  const someSelected = useMemo(
    () => resources.some((r) => selectedIds.has(getResourceId(r))),
    [resources, selectedIds, getResourceId]
  );

  const handleRowClick = useCallback((resource: any) => {
    setSelectedResource(resource);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedResource(null);
  }, []);

  const handleSort = useCallback((columnKey: string) => {
    setSortColumn((prevColumn) => {
      if (prevColumn === columnKey) {
        setSortDirection((prevDirection) => {
          if (prevDirection === "asc") return "desc";
          if (prevDirection === "desc") {
            setSortColumn(null);
            return null;
          }
          return "asc";
        });
        return prevColumn;
      } else {
        setSortDirection("asc");
        return columnKey;
      }
    });
  }, []);

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

  // 仮想スクロール用のスクロールコンテナref
  const parentRef = useRef<HTMLDivElement>(null);

  // リソース数が多い場合に仮想化を有効化
  const useVirtualization = sortedResources.length > VIRTUALIZATION_THRESHOLD;

  // 仮想スクロールの設定
  const virtualizer = useVirtualizer({
    count: sortedResources.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // 表示範囲外に追加でレンダリングする行数
  });

  // テーブルヘッダーのレンダリング
  const renderHeader = () => (
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
  );

  // テーブル行のレンダリング
  const renderRow = (resource: any, index: number, style?: React.CSSProperties) => {
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
          ...style,
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
  };

  // 通常のテーブルレンダリング（リソース数が少ない場合）
  const renderNormalTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        {renderHeader()}
        <tbody>
          {sortedResources.map((resource, index) => renderRow(resource, index))}
        </tbody>
      </table>
      {resources.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          リソースが見つかりません
        </div>
      )}
    </div>
  );

  // 仮想化されたテーブルレンダリング（リソース数が多い場合）
  const renderVirtualizedTable = () => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* 固定ヘッダー */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {renderHeader()}
        </table>
      </div>

      {/* 仮想化されたボディ */}
      <div
        ref={parentRef}
        style={{
          height: "500px",
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {/* 仮想化のためのスペーサー（上部） */}
            <tr style={{ height: virtualizer.getVirtualItems()[0]?.start || 0 }} />

            {/* 仮想化された行 */}
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const resource = sortedResources[virtualRow.index];
              return renderRow(resource, virtualRow.index, {
                height: `${virtualRow.size}px`,
              });
            })}

            {/* 仮想化のためのスペーサー（下部） */}
            <tr
              style={{
                height: virtualizer.getTotalSize() -
                  (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0),
              }}
            />
          </tbody>
        </table>
      </div>

      {/* 仮想化されたリソース数の表示 */}
      <div style={{ padding: "0.5rem", fontSize: "0.875rem", color: "#666", textAlign: "right" }}>
        {sortedResources.length.toLocaleString()} 件のリソース（仮想スクロール有効）
      </div>
    </div>
  );

  return (
    <>
      {useVirtualization ? renderVirtualizedTable() : renderNormalTable()}
      <ResourceDetail
        resource={selectedResource}
        resourceType={resourceType}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />
    </>
  );
});

export default ResourceTable;
