import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 生成設定ページ（Generate Page）のPage Object
 */
export class GeneratePage extends BasePage {
  // 設定フォーム
  readonly outputPathInput: Locator;
  readonly fileSplitRuleSelect: Locator;
  readonly namingConventionSelect: Locator;
  readonly importScriptFormatSelect: Locator;
  readonly generateReadmeCheckbox: Locator;

  // アクションボタン
  readonly generateButton: Locator;
  readonly downloadButton: Locator;

  // Terraform CLI検証（ValidationPanel）
  readonly terraformStatusSection: Locator;
  readonly terraformVersionText: Locator;
  readonly validateButton: Locator;
  readonly formatCheckButton: Locator;
  readonly formatApplyButton: Locator;

  // メッセージ
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  // プレビュー
  readonly previewSection: Locator;
  readonly codePreview: Locator;

  constructor(page: Page) {
    super(page);

    // 設定フォーム
    this.outputPathInput = page.getByLabel(/^出力パス$/);
    this.fileSplitRuleSelect = page.getByLabel(/^ファイル分割ルール$/);
    this.namingConventionSelect = page.getByLabel(/^命名規則$/);
    this.importScriptFormatSelect = page.getByLabel(/^インポートスクリプト形式$/);
    this.generateReadmeCheckbox = page.getByLabel(/^README生成$/);

    // アクションボタン
    this.generateButton = page.getByRole('button', { name: /^生成実行$/ });
    this.downloadButton = page.getByRole('button', { name: /^ZIPダウンロード$/ });

    // Terraform CLI検証
    this.terraformStatusSection = page.locator('div').filter({ hasText: /Terraform CLI ステータス/ }).first();
    this.terraformVersionText = page.locator('text=/Terraform v\\d+\\.\\d+\\.\\d+/');
    this.validateButton = page.getByRole('button', { name: /^検証実行$/ });
    this.formatCheckButton = page.getByRole('button', { name: /^フォーマットチェック$/ });
    this.formatApplyButton = page.getByRole('button', { name: /^フォーマット適用$/ });

    // メッセージ
    this.successMessage = page.locator('div').filter({ hasText: /完了しました|成功/ });
    this.errorMessage = page.locator('div').filter({ hasText: /失敗|エラー/ });
    this.loadingSpinner = page.locator('div').filter({ hasText: /生成中/ });

    // プレビュー
    this.previewSection = page.locator('h2').filter({ hasText: /^プレビュー$/ });
    this.codePreview = page.locator('pre code, .monaco-editor').first();
  }

  /**
   * 生成設定ページに遷移する
   */
  async navigateWithScanId(scanId: string) {
    await this.goto(`/generate/${scanId}`);
  }

  /**
   * 出力パスを設定する
   */
  async setOutputPath(path: string) {
    await this.outputPathInput.fill(path);
  }

  /**
   * ファイル分割ルールを選択する
   */
  async setFileSplitRule(rule: 'single_file' | 'by_resource_type' | 'by_resource') {
    await this.fileSplitRuleSelect.selectOption(rule);
  }

  /**
   * 命名規則を選択する
   */
  async setNamingConvention(convention: 'snake_case' | 'camelCase' | 'PascalCase') {
    await this.namingConventionSelect.selectOption(convention);
  }

  /**
   * インポートスクリプト形式を選択する
   */
  async setImportScriptFormat(format: 'sh' | 'ps1') {
    await this.importScriptFormatSelect.selectOption(format);
  }

  /**
   * README生成のチェックボックスを切り替える
   */
  async toggleGenerateReadme(checked: boolean) {
    if (checked) {
      await this.generateReadmeCheckbox.check();
    } else {
      await this.generateReadmeCheckbox.uncheck();
    }
  }

  /**
   * 生成を実行する
   */
  async generate() {
    await this.generateButton.click();
  }

  /**
   * ZIPファイルをダウンロードする
   */
  async downloadZip() {
    // ダウンロード待機
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    const download = await downloadPromise;
    return download;
  }

  /**
   * Terraform検証を実行する
   */
  async runValidation() {
    await this.validateButton.click();
  }

  /**
   * フォーマットチェックを実行する
   */
  async runFormatCheck() {
    await this.formatCheckButton.click();
  }

  /**
   * フォーマット適用を実行する
   */
  async applyFormat() {
    await this.formatApplyButton.click();
  }

  /**
   * 生成完了メッセージが表示されることを確認する
   */
  async expectGenerationComplete() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * 生成エラーメッセージが表示されることを確認する
   */
  async expectGenerationError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * ダウンロードボタンが表示されることを確認する
   */
  async expectDownloadButtonVisible() {
    await this.downloadButton.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * プレビューが表示されることを確認する
   */
  async expectPreviewVisible() {
    await this.previewSection.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Terraform CLIステータスが表示されることを確認する
   */
  async expectTerraformStatusVisible() {
    await this.terraformStatusSection.waitFor({ state: 'visible', timeout: 5000 });
  }
}
