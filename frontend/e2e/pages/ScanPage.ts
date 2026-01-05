import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * スキャンページ（Scan Page）のPage Object
 */
export class ScanPage extends BasePage {
  // プロバイダー選択
  readonly providerSelect: Locator;

  // AWS設定
  readonly awsProfileInput: Locator;
  readonly awsRegionSelect: Locator;
  readonly awsNamePrefixInput: Locator;

  // Azure設定
  readonly azureSubscriptionSelect: Locator;
  readonly azureResourceGroupSelect: Locator;

  // スキャン実行
  readonly scanButton: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;

  // 結果
  readonly scanCompleteMessage: Locator;
  readonly scanErrorMessage: Locator;

  constructor(page: Page) {
    super(page);

    // プロバイダー選択
    this.providerSelect = page.getByLabel(/Provider/i);

    // AWS設定
    this.awsProfileInput = page.getByLabel(/Profile/i);
    this.awsRegionSelect = page.getByLabel(/Region/i);
    this.awsNamePrefixInput = page.getByLabel(/Name Prefix/i);

    // Azure設定
    this.azureSubscriptionSelect = page.getByLabel(/Subscription/i);
    this.azureResourceGroupSelect = page.getByLabel(/Resource Group/i);

    // スキャン実行
    this.scanButton = page.getByRole('button', { name: /Start Scan|Scan/i });
    this.progressBar = page.locator('[role="progressbar"]');
    this.progressText = page.locator('text=/Scanning|Processing/i');

    // 結果
    this.scanCompleteMessage = page.locator('text=/Scan completed|Success/i');
    this.scanErrorMessage = page.locator('text=/Scan failed|Error/i');
  }

  /**
   * スキャンページに遷移する
   */
  async navigate() {
    await this.goto('/scan');
  }

  /**
   * AWSプロバイダーを選択する
   */
  async selectAWSProvider() {
    await this.providerSelect.selectOption('aws');
  }

  /**
   * Azureプロバイダーを選択する
   */
  async selectAzureProvider() {
    await this.providerSelect.selectOption('azure');
  }

  /**
   * AWSスキャンを実行する
   */
  async startAWSScan(profile: string, region: string, namePrefix?: string) {
    await this.selectAWSProvider();
    await this.awsProfileInput.fill(profile);
    await this.awsRegionSelect.selectOption(region);
    if (namePrefix) {
      await this.awsNamePrefixInput.fill(namePrefix);
    }
    await this.scanButton.click();
  }

  /**
   * Azureスキャンを実行する
   */
  async startAzureScan(subscription: string, resourceGroup?: string) {
    await this.selectAzureProvider();
    await this.azureSubscriptionSelect.selectOption(subscription);
    if (resourceGroup) {
      await this.azureResourceGroupSelect.selectOption(resourceGroup);
    }
    await this.scanButton.click();
  }

  /**
   * スキャン進捗バーが表示されることを確認する
   */
  async expectProgressVisible() {
    await this.progressBar.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * スキャン完了メッセージが表示されることを確認する
   */
  async expectScanComplete() {
    await this.scanCompleteMessage.waitFor({ state: 'visible', timeout: 60000 });
  }

  /**
   * スキャンエラーメッセージが表示されることを確認する
   */
  async expectScanError() {
    await this.scanErrorMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * リソースページに遷移することを確認する
   */
  async expectNavigationToResources() {
    await this.page.waitForURL('**/resources', { timeout: 10000 });
  }
}
