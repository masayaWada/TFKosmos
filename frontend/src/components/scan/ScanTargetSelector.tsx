import { memo, useMemo, useRef, useEffect, useState } from "react";
import { formStyles } from "../../styles/formStyles";

interface ScanTargetSelectorProps {
  provider: "aws" | "azure";
  scanTargets: Record<string, boolean>;
  toggleTarget: (target: string) => void;
  toggleAllTargets: (checked: boolean) => void;
}

const AWS_TARGETS = [
  { key: "users", label: "Users (Access Keys, Login Profiles, MFA)" },
  { key: "groups", label: "Groups" },
  { key: "roles", label: "Roles" },
  { key: "policies", label: "Policies" },
  { key: "attachments", label: "Attachments" },
];

const AZURE_TARGETS = [
  { key: "role_definitions", label: "Role Definitions" },
  { key: "role_assignments", label: "Role Assignments" },
];

const accordionStyles = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    userSelect: "none" as const,
  },
  toggleButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    color: "#666",
    transition: "transform 0.2s ease",
  },
  content: {
    marginLeft: "1.5rem",
    overflow: "hidden",
    transition: "max-height 0.2s ease, opacity 0.2s ease",
  },
  contentExpanded: {
    maxHeight: "500px",
    opacity: 1,
    paddingTop: "0.5rem",
  },
  contentCollapsed: {
    maxHeight: "0",
    opacity: 0,
    paddingTop: "0",
  },
};

const ScanTargetSelector = memo(function ScanTargetSelector({
  provider,
  scanTargets,
  toggleTarget,
  toggleAllTargets,
}: ScanTargetSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const targets = useMemo(
    () => (provider === "aws" ? AWS_TARGETS : AZURE_TARGETS),
    [provider]
  );

  const parentCheckboxRef = useRef<HTMLInputElement>(null);

  // 親チェックボックスの状態を計算
  const { allChecked, someChecked, checkedCount } = useMemo(() => {
    const count = targets.filter(
      ({ key }) => scanTargets[key] ?? false
    ).length;
    return {
      allChecked: count === targets.length,
      someChecked: count > 0 && count < targets.length,
      checkedCount: count,
    };
  }, [targets, scanTargets]);

  // indeterminate状態を設定
  useEffect(() => {
    if (parentCheckboxRef.current) {
      parentCheckboxRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  const handleParentChange = () => {
    // 一部または全部チェックされている場合は全部解除、全部未チェックの場合は全部チェック
    toggleAllTargets(!allChecked && !someChecked);
  };

  const toggleAccordion = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div style={formStyles.fieldGroup}>
      <label style={formStyles.label}>スキャン対象</label>
      <div style={formStyles.checkboxGroup}>
        {/* 親チェックボックス: IAM with accordion */}
        <div style={accordionStyles.header}>
          <button
            type="button"
            onClick={toggleAccordion}
            style={{
              ...accordionStyles.toggleButton,
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "折りたたむ" : "展開する"}
          >
            &#9654;
          </button>
          <label style={{ ...formStyles.checkbox, fontWeight: "bold", margin: 0 }}>
            <input
              ref={parentCheckboxRef}
              type="checkbox"
              checked={allChecked}
              onChange={handleParentChange}
            />
            IAM
            <span style={{ fontWeight: "normal", color: "#666", marginLeft: "0.5rem" }}>
              ({checkedCount}/{targets.length})
            </span>
          </label>
        </div>
        {/* 子チェックボックス: 各リソースタイプ (アコーディオン) */}
        <div
          style={{
            ...accordionStyles.content,
            ...(isExpanded
              ? accordionStyles.contentExpanded
              : accordionStyles.contentCollapsed),
          }}
        >
          {targets.map(({ key, label }) => (
            <label key={key} style={formStyles.checkbox}>
              <input
                type="checkbox"
                checked={scanTargets[key] ?? false}
                onChange={() => toggleTarget(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
});

export default ScanTargetSelector;
