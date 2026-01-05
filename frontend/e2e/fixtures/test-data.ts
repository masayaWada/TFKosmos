/**
 * E2Eテスト用のテストデータ
 */

/**
 * AWS接続テスト用データ
 */
export const awsTestData = {
  validConnection: {
    profile: 'default',
    region: 'us-east-1',
  },
  invalidConnection: {
    profile: 'invalid-profile',
    region: 'us-east-1',
  },
};

/**
 * Azure接続テスト用データ
 */
export const azureTestData = {
  validConnection: {
    authMethod: 'service_principal',
    tenantId: 'test-tenant-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
  invalidConnection: {
    authMethod: 'service_principal',
    tenantId: 'invalid-tenant',
    clientId: 'invalid-client',
    clientSecret: 'invalid-secret',
  },
};

/**
 * スキャン設定テスト用データ
 */
export const scanTestData = {
  aws: {
    profile: 'default',
    region: 'us-east-1',
    namePrefix: 'test-',
  },
  azure: {
    subscription: 'test-subscription',
    resourceGroup: 'test-rg',
  },
};
