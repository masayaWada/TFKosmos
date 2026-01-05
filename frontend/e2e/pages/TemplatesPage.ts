import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * テンプレートページ（Templates Page）のPage Object
 */
export class TemplatesPage extends BasePage {
  // テンプレート一覧
  readonly templateList: Locator;
  readonly templateListItems: Locator;

  // エディタセクション
  readonly editorSection: Locator;
  readonly monacoEditor: Locator;

  // アクションボタン
  readonly previewButton: Locator;
  readonly saveButton: Locator;
  readonly restoreButton: Locator;

  // メッセージ
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  // バリデーションエラー
  readonly validationErrorsSection: Locator;
  readonly validationErrorItems: Locator;

  // プレビュー
  readonly previewSection: Locator;
  readonly codePreview: Locator;

  constructor(page: Page) {
    super(page);

    // テンプレート一覧
    this.templateList = page.locator('div').filter({ hasText: /テンプレート一覧/ }).first();
    this.templateListItems = page.locator('button').filter({ hasText: /iam_user|iam_group|iam_role|iam_policy/ });

    // エディタ
    this.editorSection = page.locator('div').filter({ hasText: /monaco-editor/ });
    this.monacoEditor = page.locator('.monaco-editor').first();

    // アクションボタン
    this.previewButton = page.getByRole('button', { name: /^プレビュー$/ });
    this.saveButton = page.getByRole('button', { name: /^保存$/ });
    this.restoreButton = page.getByRole('button', { name: /^デフォルトに復元$/ });

    // メッセージ
    this.successMessage = page.locator('div').filter({ hasText: /保存しました|復元しました/ });
    this.errorMessage = page.locator('div').filter({ hasText: /失敗|エラー/ });

    // バリデーションエラー
    this.validationErrorsSection = page.locator('div').filter({ hasText: /バリデーションエラー/ });
    this.validationErrorItems = page.locator('li').filter({ hasText: /line|エラー/ });

    // プレビュー
    this.previewSection = page.locator('h3').filter({ hasText: /^プレビュー$/ });
    this.codePreview = page.locator('pre code, .monaco-editor').nth(1); // 2番目のエディタ（プレビュー用）
  }

  /**
   * テンプレートページに遷移する
   */
  async navigate() {
    await this.goto('/templates');
  }

  /**
   * テンプレートを選択する
   */
  async selectTemplate(resourceType: 'iam_user' | 'iam_group' | 'iam_role' | 'iam_policy') {
    const template = this.page.getByRole('button', { name: new RegExp(resourceType, 'i') }).first();
    await template.click();
  }

  /**
   * エディタにテキストを入力する（Monaco Editor用）
   */
  async setEditorContent(content: string) {
    // Monaco Editorは特殊なので、直接入力ではなくAPIを使う
    await this.page.evaluate((text) => {
      const editor = (window as any).monaco?.editor?.getModels()[0];
      if (editor) {
        editor.setValue(text);
      }
    }, content);
  }

  /**
   * エディタの内容を取得する
   */
  async getEditorContent(): Promise<string> {
    return await this.page.evaluate(() => {
      const editor = (window as any).monaco?.editor?.getModels()[0];
      return editor ? editor.getValue() : '';
    });
  }

  /**
   * プレビューを実行する
   */
  async preview() {
    await this.previewButton.click();
  }

  /**
   * テンプレートを保存する
   */
  async save() {
    await this.saveButton.click();
  }

  /**
   * デフォルトに復元する
   */
  async restore() {
    // 確認ダイアログを処理
    this.page.on('dialog', dialog => dialog.accept());
    await this.restoreButton.click();
  }

  /**
   * 保存成功メッセージが表示されることを確認する
   */
  async expectSaveSuccess() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * 保存エラーメッセージが表示されることを確認する
   */
  async expectSaveError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * プレビューが表示されることを確認する
   */
  async expectPreviewVisible() {
    await this.previewSection.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * バリデーションエラーが表示されることを確認する
   */
  async expectValidationErrors() {
    await this.validationErrorsSection.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * バリデーションエラー数を取得する
   */
  async getValidationErrorCount(): Promise<number> {
    return await this.validationErrorItems.count();
  }

  /**
   * エディタが表示されることを確認する
   */
  async expectEditorVisible() {
    await this.monacoEditor.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * 復元ボタンが表示されることを確認する（カスタムテンプレートの場合）
   */
  async expectRestoreButtonVisible() {
    await this.restoreButton.waitFor({ state: 'visible', timeout: 5000 });
  }
}
