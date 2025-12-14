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
