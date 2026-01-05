import { Page } from '@playwright/test';

/**
 * ベースページクラス
 * すべてのページオブジェクトの基底クラス
 */
export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 指定したURLに遷移する
   */
  async goto(path: string) {
    await this.page.goto(path);
  }

  /**
   * ページタイトルを取得する
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * 現在のURLを取得する
   */
  getURL(): string {
    return this.page.url();
  }

  /**
   * 指定した時間待機する
   */
  async wait(milliseconds: number) {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * スクリーンショットを取得する
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  /**
   * 通知メッセージが表示されるまで待機する
   */
  async waitForNotification(text?: string) {
    if (text) {
      await this.page.waitForSelector(`text=${text}`, { timeout: 5000 });
    } else {
      await this.page.waitForSelector('[role="alert"]', { timeout: 5000 });
    }
  }

  /**
   * ローディング完了まで待機する
   */
  async waitForLoading() {
    await this.page.waitForLoadState('networkidle');
  }
}
