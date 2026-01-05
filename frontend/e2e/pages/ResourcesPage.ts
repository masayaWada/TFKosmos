import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * リソースページ（Resources Page）のPage Object
 */
export class ResourcesPage extends BasePage {
  // タブ
  readonly usersTab: Locator;
  readonly groupsTab: Locator;
  readonly rolesTab: Locator;
  readonly policiesTab: Locator;
  readonly attachmentsTab: Locator;
  readonly cleanupTab: Locator;
  readonly dependenciesTab: Locator;
  // Azure専用タブ
  readonly roleAssignmentsTab: Locator;
  readonly roleDefinitionsTab: Locator;

  // フィルター
  readonly filterButton: Locator;
  readonly filterInput: Locator;
  readonly clearFilterButton: Locator;
  readonly simpleSearchRadio: Locator;
  readonly advancedQueryRadio: Locator;

  // リソーステーブル
  readonly resourceTable: Locator;
  readonly selectAllCheckbox: Locator;
  readonly resourceRows: Locator;

  // ページネーション
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  // 選択サマリー
  readonly selectionSummary: Locator;
  readonly nextToGenerateButton: Locator;

  constructor(page: Page) {
    super(page);

    // AWS タブ
    this.usersTab = page.getByRole('button', { name: /^Users$/i });
    this.groupsTab = page.getByRole('button', { name: /^Groups$/i });
    this.rolesTab = page.getByRole('button', { name: /^Roles$/i });
    this.policiesTab = page.getByRole('button', { name: /^Policies$/i });
    this.attachmentsTab = page.getByRole('button', { name: /^Attachments$/i });
    this.cleanupTab = page.getByRole('button', { name: /^Cleanup$/i });
    this.dependenciesTab = page.getByRole('button', { name: /^Dependencies$/i });

    // Azure タブ
    this.roleAssignmentsTab = page.getByRole('button', { name: /^Role Assignments$/i });
    this.roleDefinitionsTab = page.getByRole('button', { name: /^Role Definitions$/i });

    // フィルター
    this.filterButton = page.getByRole('button', { name: /^フィルタ/ });
    this.filterInput = page.getByPlaceholder(/リソース名、ARN、IDなどで検索/);
    this.clearFilterButton = page.getByRole('button', { name: /^クリア$/ });
    this.simpleSearchRadio = page.getByLabel(/シンプル検索/);
    this.advancedQueryRadio = page.getByLabel(/高度なクエリ/);

    // リソーステーブル
    this.resourceTable = page.locator('table').first();
    this.selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    this.resourceRows = page.locator('tbody tr');

    // ページネーション
    this.prevPageButton = page.getByRole('button', { name: /^前へ$/ });
    this.nextPageButton = page.getByRole('button', { name: /^次へ$/ });
    this.pageInfo = page.locator('text=/\\d+ \\/ \\d+ ページ/');

    // 選択サマリー
    this.selectionSummary = page.locator('div').filter({ hasText: /選択中/ });
    this.nextToGenerateButton = page.getByRole('button', { name: /次へ: 生成設定/ });
  }

  /**
   * リソースページに遷移する
   */
  async navigateWithScanId(scanId: string) {
    await this.goto(`/resources/${scanId}`);
  }

  /**
   * タブを切り替える
   */
  async switchTab(tabName: 'users' | 'groups' | 'roles' | 'policies' | 'attachments' | 'cleanup' | 'dependencies' | 'role_assignments' | 'role_definitions') {
    const tabMap = {
      users: this.usersTab,
      groups: this.groupsTab,
      roles: this.rolesTab,
      policies: this.policiesTab,
      attachments: this.attachmentsTab,
      cleanup: this.cleanupTab,
      dependencies: this.dependenciesTab,
      role_assignments: this.roleAssignmentsTab,
      role_definitions: this.roleDefinitionsTab,
    };
    await tabMap[tabName].click();
  }

  /**
   * フィルターを開く
   */
  async openFilter() {
    await this.filterButton.click();
  }

  /**
   * フィルターを閉じる
   */
  async closeFilter() {
    const isOpen = await this.filterInput.isVisible();
    if (isOpen) {
      await this.filterButton.click();
    }
  }

  /**
   * シンプル検索でフィルターを適用する
   */
  async filterBySimpleSearch(searchText: string) {
    await this.openFilter();
    await this.simpleSearchRadio.check();
    await this.filterInput.fill(searchText);
  }

  /**
   * フィルターをクリアする
   */
  async clearFilter() {
    await this.clearFilterButton.click();
  }

  /**
   * 全てのリソースを選択する
   */
  async selectAll() {
    await this.selectAllCheckbox.check();
  }

  /**
   * 全ての選択を解除する
   */
  async deselectAll() {
    await this.selectAllCheckbox.uncheck();
  }

  /**
   * 特定のリソースを選択する
   */
  async selectResource(rowIndex: number) {
    const checkbox = this.resourceRows.nth(rowIndex).locator('input[type="checkbox"]');
    await checkbox.check();
  }

  /**
   * 特定のリソースの選択を解除する
   */
  async deselectResource(rowIndex: number) {
    const checkbox = this.resourceRows.nth(rowIndex).locator('input[type="checkbox"]');
    await checkbox.uncheck();
  }

  /**
   * 次のページに移動する
   */
  async goToNextPage() {
    await this.nextPageButton.click();
  }

  /**
   * 前のページに移動する
   */
  async goToPrevPage() {
    await this.prevPageButton.click();
  }

  /**
   * 生成設定ページに遷移する
   */
  async goToGenerate() {
    await this.nextToGenerateButton.click();
  }

  /**
   * 選択されたリソース数を取得する
   */
  async getSelectedCount(): Promise<number> {
    const text = await this.selectionSummary.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * リソース行の総数を取得する
   */
  async getResourceCount(): Promise<number> {
    return await this.resourceRows.count();
  }

  /**
   * 依存関係グラフが表示されることを確認する
   */
  async expectDependencyGraphVisible() {
    await this.page.locator('svg').waitFor({ state: 'visible', timeout: 10000 });
  }
}
