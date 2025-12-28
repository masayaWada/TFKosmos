import { formStyles } from "../../styles/formStyles";
import { AzureSubscription, AzureResourceGroup } from "../../api/scan";

interface AzureScopeSelectorProps {
  scopeType: string;
  setScopeType: (value: string) => void;
  selectedSubscriptionId: string;
  setSelectedSubscriptionId: (value: string) => void;
  selectedResourceGroup: string;
  setSelectedResourceGroup: (value: string) => void;
  scopeValue: string;
  setScopeValue: (value: string) => void;
  subscriptions: AzureSubscription[];
  resourceGroups: AzureResourceGroup[];
  loadingSubscriptions: boolean;
  loadingResourceGroups: boolean;
}

export default function AzureScopeSelector({
  scopeType,
  setScopeType,
  selectedSubscriptionId,
  setSelectedSubscriptionId,
  selectedResourceGroup,
  setSelectedResourceGroup,
  scopeValue,
  setScopeValue,
  subscriptions,
  resourceGroups,
  loadingSubscriptions,
  loadingResourceGroups,
}: AzureScopeSelectorProps) {
  return (
    <>
      <div style={formStyles.fieldGroup}>
        <label style={formStyles.label}>スコープタイプ</label>
        <select
          value={scopeType}
          onChange={(e) => {
            setScopeType(e.target.value);
            if (e.target.value !== "resource_group") {
              setSelectedResourceGroup("");
            }
          }}
          style={formStyles.select}
        >
          <option value="subscription">Subscription</option>
          <option value="management_group">Management Group</option>
          <option value="resource_group">Resource Group</option>
        </select>
      </div>

      {scopeType === "subscription" && (
        <SubscriptionSelector
          selectedSubscriptionId={selectedSubscriptionId}
          setSelectedSubscriptionId={setSelectedSubscriptionId}
          subscriptions={subscriptions}
          loadingSubscriptions={loadingSubscriptions}
        />
      )}

      {scopeType === "resource_group" && (
        <>
          <SubscriptionSelector
            selectedSubscriptionId={selectedSubscriptionId}
            setSelectedSubscriptionId={(value) => {
              setSelectedSubscriptionId(value);
              setSelectedResourceGroup("");
            }}
            subscriptions={subscriptions}
            loadingSubscriptions={loadingSubscriptions}
          />
          {selectedSubscriptionId && (
            <div style={formStyles.fieldGroup}>
              <label style={formStyles.label}>リソースグループ</label>
              {loadingResourceGroups ? (
                <div style={formStyles.loading}>読み込み中...</div>
              ) : (
                <select
                  value={selectedResourceGroup}
                  onChange={(e) => setSelectedResourceGroup(e.target.value)}
                  style={formStyles.select}
                >
                  <option value="">選択してください</option>
                  {resourceGroups.map((rg) => (
                    <option key={rg.name} value={rg.name}>
                      {rg.name} ({rg.location})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </>
      )}

      {scopeType === "management_group" && (
        <div style={formStyles.fieldGroup}>
          <SubscriptionSelector
            selectedSubscriptionId={selectedSubscriptionId}
            setSelectedSubscriptionId={setSelectedSubscriptionId}
            subscriptions={subscriptions}
            loadingSubscriptions={loadingSubscriptions}
            label="サブスクリプション（認証用）"
          />
          <div style={{ marginTop: "0.5rem" }}>
            <label style={formStyles.label}>管理グループ名</label>
            <input
              type="text"
              value={scopeValue}
              onChange={(e) => setScopeValue(e.target.value)}
              placeholder="管理グループ名を入力"
              style={formStyles.input}
            />
          </div>
        </div>
      )}
    </>
  );
}

interface SubscriptionSelectorProps {
  selectedSubscriptionId: string;
  setSelectedSubscriptionId: (value: string) => void;
  subscriptions: AzureSubscription[];
  loadingSubscriptions: boolean;
  label?: string;
}

function SubscriptionSelector({
  selectedSubscriptionId,
  setSelectedSubscriptionId,
  subscriptions,
  loadingSubscriptions,
  label = "サブスクリプション",
}: SubscriptionSelectorProps) {
  return (
    <div style={formStyles.fieldGroup}>
      <label style={formStyles.label}>{label}</label>
      {loadingSubscriptions ? (
        <div style={formStyles.loading}>読み込み中...</div>
      ) : (
        <select
          value={selectedSubscriptionId}
          onChange={(e) => setSelectedSubscriptionId(e.target.value)}
          style={formStyles.select}
        >
          <option value="">選択してください</option>
          {subscriptions.map((sub) => (
            <option key={sub.subscription_id} value={sub.subscription_id}>
              {sub.display_name} ({sub.subscription_id})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
