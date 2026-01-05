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
    // プロバイダーはradioボタンで「プロバイダー:」というラベルを持つ
    this.providerSelect = page.getByLabel(/プロバイダー/i);

    // AWS設定
    // プロファイルは日本語ラベル
    this.awsProfileInput = page.getByLabel(/^プロファイル$/);
    // AWSリージョン選択はScanConfigFormには存在しない（削除）
    // 代わりにAssume Role ARNフィールドがあるが、テストでは使用しない想定
    // 互換性のため、空のロケーターを設定（使用されない）
    this.awsRegionSelect = page.locator('input[type="text"]').first();
    // 名前プレフィックスは日本語ラベル
    this.awsNamePrefixInput = page.getByLabel(/名前プレフィックス/i);

    // Azure設定
    // サブスクリプションは日本語ラベル
    this.azureSubscriptionSelect = page.getByLabel(/^サブスクリプション$/);
    // リソースグループは日本語ラベル
    this.azureResourceGroupSelect = page.getByLabel(/^リソースグループ$/);

    // スキャン実行
    // スキャンボタンは日本語テキスト
    this.scanButton = page.getByRole('button', { name: /^スキャン実行$/ });
    // プログレスバーはrole="progressbar"を持たないdiv要素
    // ScanProgressBarコンポーネントのスタイルで識別
    this.progressBar = page.locator('div').filter({ hasText: /スキャン中|スキャンを開始/i });
    // プログレステキストは日本語
    this.progressText = page.locator('text=/スキャン中|スキャンを開始|スキャンが完了/i');

    // 結果
    // スキャン完了メッセージは日本語
    this.scanCompleteMessage = page.locator('text=/スキャンが完了|スキャン完了/i');
    // スキャンエラーメッセージは日本語
    this.scanErrorMessage = page.locator('text=/スキャンに失敗|エラー/i');
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
    // プロバイダーはradioボタンなので、clickを使用
    await this.page.getByRole('radio', { name: /^AWS$/ }).click();
  }

  /**
   * Azureプロバイダーを選択する
   */
  async selectAzureProvider() {
    // プロバイダーはradioボタンなので、clickを使用
    await this.page.getByRole('radio', { name: /^Azure$/ }).click();
  }

  /**
   * AWSスキャンを実行する
   */
  async startAWSScan(profile: string, region?: string, namePrefix?: string) {
    await this.selectAWSProvider();
    await this.awsProfileInput.fill(profile);
    // AWSリージョン選択はScanConfigFormには存在しないため、regionパラメータは無視
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
