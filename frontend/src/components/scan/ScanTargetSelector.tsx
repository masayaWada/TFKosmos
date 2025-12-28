import { formStyles } from "../../styles/formStyles";

interface ScanTargetSelectorProps {
  provider: "aws" | "azure";
  scanTargets: Record<string, boolean>;
  toggleTarget: (target: string) => void;
}

const AWS_TARGETS = [
  { key: "users", label: "Users" },
  { key: "groups", label: "Groups" },
  { key: "roles", label: "Roles" },
  { key: "policies", label: "Policies" },
  { key: "attachments", label: "Attachments" },
  { key: "cleanup", label: "Cleanup (Access Keys, Login Profiles, MFA)" },
];

const AZURE_TARGETS = [
  { key: "role_definitions", label: "Role Definitions" },
  { key: "role_assignments", label: "Role Assignments" },
];

export default function ScanTargetSelector({
  provider,
  scanTargets,
  toggleTarget,
}: ScanTargetSelectorProps) {
  const targets = provider === "aws" ? AWS_TARGETS : AZURE_TARGETS;

  return (
    <div style={formStyles.fieldGroup}>
      <label style={formStyles.label}>スキャン対象</label>
      <div style={formStyles.checkboxGroup}>
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
  );
}
