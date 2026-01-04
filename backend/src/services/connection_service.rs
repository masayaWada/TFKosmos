use anyhow::Result;
use std::collections::HashMap;

use crate::infra::aws::client_factory::AwsClientFactory;
use crate::infra::azure::client_factory::AzureClientFactory;
use crate::models::{AzureResourceGroup, AzureSubscription, ConnectionTestResponse};

pub struct ConnectionService;

impl ConnectionService {
    pub async fn test_aws_connection(
        profile: Option<String>,
        assume_role_arn: Option<String>,
        assume_role_session_name: Option<String>,
    ) -> Result<ConnectionTestResponse> {
        AwsClientFactory::test_connection(profile, assume_role_arn, assume_role_session_name).await
    }

    pub async fn test_azure_connection(
        auth_method: Option<String>,
        tenant_id: Option<String>,
        service_principal_config: Option<HashMap<String, String>>,
    ) -> Result<ConnectionTestResponse> {
        AzureClientFactory::test_connection(
            auth_method,
            tenant_id,
            service_principal_config,
        )
        .await
    }

    pub async fn list_azure_subscriptions(
        auth_method: Option<String>,
        tenant_id: Option<String>,
        service_principal_config: Option<HashMap<String, String>>,
    ) -> Result<Vec<AzureSubscription>> {
        AzureClientFactory::list_subscriptions(auth_method, tenant_id, service_principal_config)
            .await
    }

    pub async fn list_azure_resource_groups(
        subscription_id: String,
        auth_method: Option<String>,
        tenant_id: Option<String>,
        service_principal_config: Option<HashMap<String, String>>,
    ) -> Result<Vec<AzureResourceGroup>> {
        AzureClientFactory::list_resource_groups(
            subscription_id,
            auth_method,
            tenant_id,
            service_principal_config,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require AWS/Azure SDK mocks which are complex to set up.
    // For now, we test the service structure and API contract.
    // Integration tests with actual AWS/Azure test accounts should be added separately.

    #[test]
    fn test_connection_service_exists() {
        // Verify that ConnectionService can be instantiated
        let _service = ConnectionService;
    }

    #[tokio::test]
    async fn test_aws_connection_accepts_optional_parameters() {
        // This test verifies the function signature accepts None values
        // Result may be Ok or Err depending on local AWS configuration
        let _result = ConnectionService::test_aws_connection(None, None, None).await;

        // Test passes if function completes without panicking
        // Actual result depends on local environment (Ok if AWS configured, Err if not)
    }

    #[tokio::test]
    async fn test_azure_connection_accepts_optional_parameters() {
        // This test verifies the function signature accepts None values
        // Result may be Ok or Err depending on local Azure configuration
        let _result = ConnectionService::test_azure_connection(None, None, None).await;

        // Test passes if function completes without panicking
    }

    #[tokio::test]
    async fn test_list_azure_subscriptions_signature() {
        // Verify function signature - result depends on local configuration
        let _result = ConnectionService::list_azure_subscriptions(None, None, None).await;

        // Test passes if function completes without panicking
    }

    #[tokio::test]
    async fn test_list_azure_resource_groups_signature() {
        // Verify function signature - result depends on local configuration
        let subscription_id = "test-subscription-id".to_string();
        let _result = ConnectionService::list_azure_resource_groups(
            subscription_id,
            None,
            None,
            None,
        )
        .await;

        // Test passes if function completes without panicking
    }
}
