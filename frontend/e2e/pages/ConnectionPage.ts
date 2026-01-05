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
    // タブは実際にはrole="tab"を持たないbutton要素
    this.awsTab = page.getByRole('button', { name: /^AWS$/ });
    // プロファイル入力は複数ある可能性があるため、従来の方法セクションのものを取得
    this.awsProfileInput = page.getByLabel(/^プロファイル$/).first();
    // AWSリージョンはinput要素で「AWSリージョン（オプション）」というラベル
    this.awsRegionSelect = page.getByLabel(/AWSリージョン/i);
    // 接続テストボタンは日本語テキスト
    this.awsTestButton = page.getByRole('button', { name: /^接続テスト$/ });

    // Azure
    // タブは実際にはrole="tab"を持たないbutton要素
    this.azureTab = page.getByRole('button', { name: /^Azure$/ });
    // 認証方式は日本語ラベル
    this.azureAuthMethodSelect = page.getByLabel(/^認証方式$/);
    // テナントIDは日本語ラベル
    this.azureTenantIdInput = page.getByLabel(/^テナントID$/);
    // Client IDは英語のまま
    this.azureClientIdInput = page.getByLabel(/^Client ID$/);
    // Client Secretは英語のまま
    this.azureClientSecretInput = page.getByLabel(/^Client Secret$/);
    // 接続テストボタンは日本語テキスト
    this.azureTestButton = page.getByRole('button', { name: /^接続テスト$/ });

    // 共通
    // 成功/エラーメッセージはrole="alert"を持たないdiv要素
    // 成功メッセージは「接続成功」というテキストを含む
    this.successMessage = page.locator('div').filter({ hasText: /接続成功/i });
    // エラーメッセージはエラーメッセージコンポーネントのスタイル（背景色#f8d7da）で識別
    // または「接続に失敗」「エラー」「失敗」というテキストを含む
    this.errorMessage = page.locator('div').filter({ 
      hasText: /接続に失敗|エラー|失敗/i 
    });
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
  async testAWSConnection(profile: string, region?: string) {
    await this.switchToAWS();
    await this.awsProfileInput.fill(profile);
    // AWSリージョンはinput要素で「aws login（推奨）」セクション内にある
    // 従来の方法のセクションには存在しないため、オプショナル
    if (region) {
      await this.awsRegionSelect.fill(region);
    }
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
