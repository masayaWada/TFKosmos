import { test, expect } from '@playwright/test';
import { ConnectionPage } from '../pages/ConnectionPage';
import { ScanPage } from '../pages/ScanPage';
import { ResourcesPage } from '../pages/ResourcesPage';
import { GeneratePage } from '../pages/GeneratePage';
import { awsTestData, scanTestData } from '../fixtures/test-data';

/**
 * AWS完全フロー E2Eテスト
 *
 * このテストは実際のAWS認証情報とバックエンドサーバーが必要なため、
 * デフォルトではスキップされます。
 *
 * テストを実行する場合：
 * 1. バックエンドサーバーを起動: `make dev`
 * 2. 有効なAWS認証情報を設定
 * 3. テストからスキップを削除して実行
 */
test.describe('AWS完全フロー', () => {
  let connectionPage: ConnectionPage;
  let scanPage: ScanPage;
  let resourcesPage: ResourcesPage;
  let generatePage: GeneratePage;

  test.beforeEach(async ({ page }) => {
    connectionPage = new ConnectionPage(page);
    scanPage = new ScanPage(page);
    resourcesPage = new ResourcesPage(page);
    generatePage = new GeneratePage(page);
  });

  test.skip('AWS接続 → スキャン → リソース選択 → Terraform生成 → ダウンロード', async ({ page }) => {
    // ステップ1: AWS接続テスト
    await test.step('AWS接続テスト', async () => {
      await connectionPage.navigate();
      await connectionPage.testAWSConnection(
        awsTestData.validConnection.profile,
        awsTestData.validConnection.region
      );
      await connectionPage.expectSuccessMessage();
    });

    // ステップ2: AWSスキャン実行
    let scanId: string | null = null;
    await test.step('AWSスキャン実行', async () => {
      await scanPage.navigate();
      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        undefined, // region は ScanConfigForm に存在しない
        scanTestData.aws.namePrefix
      );

      // 進捗バーが表示されることを確認
      await scanPage.expectProgressVisible();

      // スキャン完了まで待機（最大60秒）
      await scanPage.expectScanComplete();

      // リソースページへの遷移を確認
      await scanPage.expectNavigationToResources();

      // URLからスキャンIDを取得
      const url = page.url();
      const match = url.match(/\/resources\/([^\/]+)/);
      if (match) {
        scanId = match[1];
      }
    });

    // スキャンIDが取得できなかった場合はテスト失敗
    if (!scanId) {
      throw new Error('スキャンIDを取得できませんでした');
    }

    // ステップ3: リソース選択
    await test.step('リソース選択', async () => {
      // リソースページが正しく表示されることを確認
      await expect(resourcesPage.usersTab).toBeVisible();

      // Users タブでリソースを選択
      await resourcesPage.switchTab('users');
      const userCount = await resourcesPage.getResourceCount();

      if (userCount > 0) {
        // 最初のユーザーを選択
        await resourcesPage.selectResource(0);
        const selectedCount = await resourcesPage.getSelectedCount();
        expect(selectedCount).toBeGreaterThan(0);
      }

      // Groups タブに切り替えてリソースを選択
      await resourcesPage.switchTab('groups');
      const groupCount = await resourcesPage.getResourceCount();

      if (groupCount > 0) {
        // 最初のグループを選択
        await resourcesPage.selectResource(0);
      }

      // Roles タブに切り替えてリソースを選択
      await resourcesPage.switchTab('roles');
      const roleCount = await resourcesPage.getResourceCount();

      if (roleCount > 0) {
        // 最初のロールを選択
        await resourcesPage.selectResource(0);
      }

      // 生成設定ページへ遷移
      await resourcesPage.goToGenerate();
    });

    // ステップ4: Terraform生成
    await test.step('Terraform生成', async () => {
      // 生成設定ページが正しく表示されることを確認
      await expect(generatePage.generateButton).toBeVisible();

      // 設定を変更（オプション）
      await generatePage.setOutputPath('./terraform-output-test');
      await generatePage.setFileSplitRule('by_resource_type');
      await generatePage.setNamingConvention('snake_case');
      await generatePage.toggleGenerateReadme(true);

      // 生成実行
      await generatePage.generate();

      // 生成完了まで待機（最大30秒）
      await generatePage.expectGenerationComplete();

      // ダウンロードボタンが表示されることを確認
      await generatePage.expectDownloadButtonVisible();

      // プレビューが表示されることを確認
      await generatePage.expectPreviewVisible();
    });

    // ステップ5: ZIPダウンロード
    await test.step('ZIPダウンロード', async () => {
      // ダウンロードを実行
      const download = await generatePage.downloadZip();

      // ダウンロードされたファイルを検証
      expect(download.suggestedFilename()).toBe('terraform-output.zip');

      // ファイルサイズが0より大きいことを確認
      const path = await download.path();
      if (path) {
        const fs = require('fs');
        const stats = fs.statSync(path);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  test.skip('AWS接続 → スキャン → 依存関係グラフ表示', async ({ page }) => {
    // ステップ1: AWS接続テスト
    await test.step('AWS接続テスト', async () => {
      await connectionPage.navigate();
      await connectionPage.testAWSConnection(
        awsTestData.validConnection.profile,
        awsTestData.validConnection.region
      );
      await connectionPage.expectSuccessMessage();
    });

    // ステップ2: AWSスキャン実行
    let scanId: string | null = null;
    await test.step('AWSスキャン実行', async () => {
      await scanPage.navigate();
      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        undefined,
        scanTestData.aws.namePrefix
      );

      await scanPage.expectScanComplete();
      await scanPage.expectNavigationToResources();

      const url = page.url();
      const match = url.match(/\/resources\/([^\/]+)/);
      if (match) {
        scanId = match[1];
      }
    });

    if (!scanId) {
      throw new Error('スキャンIDを取得できませんでした');
    }

    // ステップ3: 依存関係グラフ表示
    await test.step('依存関係グラフ表示', async () => {
      // Dependencies タブに切り替え
      await resourcesPage.switchTab('dependencies');

      // 依存関係グラフが表示されることを確認
      await resourcesPage.expectDependencyGraphVisible();

      // グラフにノードが存在することを確認
      const svgNodes = page.locator('svg circle, svg rect');
      const nodeCount = await svgNodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });

  test.skip('AWS接続 → スキャン → フィルタリング → リソース選択', async ({ page }) => {
    // ステップ1: AWS接続テスト
    await test.step('AWS接続テスト', async () => {
      await connectionPage.navigate();
      await connectionPage.testAWSConnection(
        awsTestData.validConnection.profile,
        awsTestData.validConnection.region
      );
      await connectionPage.expectSuccessMessage();
    });

    // ステップ2: AWSスキャン実行
    await test.step('AWSスキャン実行', async () => {
      await scanPage.navigate();
      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        undefined,
        scanTestData.aws.namePrefix
      );

      await scanPage.expectScanComplete();
      await scanPage.expectNavigationToResources();
    });

    // ステップ3: フィルタリングとリソース選択
    await test.step('フィルタリングとリソース選択', async () => {
      // Users タブに切り替え
      await resourcesPage.switchTab('users');

      // 初期リソース数を取得
      const initialCount = await resourcesPage.getResourceCount();
      expect(initialCount).toBeGreaterThan(0);

      // フィルターを開く
      await resourcesPage.openFilter();

      // シンプル検索でフィルター
      await resourcesPage.filterBySimpleSearch('admin');

      // フィルター適用後のリソース数を確認（減っているはず）
      await page.waitForTimeout(1000); // フィルタリング処理待ち
      const filteredCount = await resourcesPage.getResourceCount();

      // フィルタリングされたリソースが表示されることを確認
      // （結果が0件でもエラーにはしない - admin という名前のリソースがない可能性）

      // フィルタークリア
      await resourcesPage.clearFilter();

      // リソース数が元に戻ることを確認
      await page.waitForTimeout(1000);
      const clearedCount = await resourcesPage.getResourceCount();
      expect(clearedCount).toBe(initialCount);
    });
  });
});
