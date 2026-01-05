import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 接続ページ（Connection Page）のPage Object
 */
export class ConnectionPage extends BasePage {
  // AWS接続フォーム
  readonly awsTab: Locator;
  readonly awsProfileInput: Locator;
  readonly awsRegionSelect: Locator;
  readonly awsTestButton: Locator;

  // Azure接続フォーム
  readonly azureTab: Locator;
  readonly azureAuthMethodSelect: Locator;
  readonly azureTenantIdInput: Locator;
  readonly azureClientIdInput: Locator;
  readonly azureClientSecretInput: Locator;
  readonly azureTestButton: Locator;

  // 共通
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    // AWS
    this.awsTab = page.getByRole('tab', { name: /AWS/i });
    this.awsProfileInput = page.getByLabel(/Profile/i);
    this.awsRegionSelect = page.getByLabel(/Region/i);
    this.awsTestButton = page.getByRole('button', { name: /Test AWS Connection/i });

    // Azure
    this.azureTab = page.getByRole('tab', { name: /Azure/i });
    this.azureAuthMethodSelect = page.getByLabel(/Authentication Method/i);
    this.azureTenantIdInput = page.getByLabel(/Tenant ID/i);
    this.azureClientIdInput = page.getByLabel(/Client ID/i);
    this.azureClientSecretInput = page.getByLabel(/Client Secret/i);
    this.azureTestButton = page.getByRole('button', { name: /Test Azure Connection/i });

    // 共通
    this.successMessage = page.locator('[role="alert"]').filter({ hasText: /success/i });
    this.errorMessage = page.locator('[role="alert"]').filter({ hasText: /error|fail/i });
  }

  /**
   * 接続ページに遷移する
   */
  async navigate() {
    await this.goto('/connection');
  }

  /**
   * AWSタブに切り替える
   */
  async switchToAWS() {
    await this.awsTab.click();
  }

  /**
   * Azureタブに切り替える
   */
  async switchToAzure() {
    await this.azureTab.click();
  }

  /**
   * AWS接続テストを実行する
   */
  async testAWSConnection(profile: string, region: string) {
    await this.switchToAWS();
    await this.awsProfileInput.fill(profile);
    await this.awsRegionSelect.selectOption(region);
    await this.awsTestButton.click();
  }

  /**
   * Azure接続テストを実行する（サービスプリンシパル）
   */
  async testAzureConnection(tenantId: string, clientId: string, clientSecret: string) {
    await this.switchToAzure();
    await this.azureAuthMethodSelect.selectOption('service_principal');
    await this.azureTenantIdInput.fill(tenantId);
    await this.azureClientIdInput.fill(clientId);
    await this.azureClientSecretInput.fill(clientSecret);
    await this.azureTestButton.click();
  }

  /**
   * 成功メッセージが表示されることを確認する
   */
  async expectSuccessMessage() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * エラーメッセージが表示されることを確認する
   */
  async expectErrorMessage() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 10000 });
  }
}
