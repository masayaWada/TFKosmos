import { test, expect } from '@playwright/test';
import { ConnectionPage } from '../pages/ConnectionPage';
import { ScanPage } from '../pages/ScanPage';
import { ResourcesPage } from '../pages/ResourcesPage';
import { GeneratePage } from '../pages/GeneratePage';
import { TemplatesPage } from '../pages/TemplatesPage';

/**
 * エッジケースとエラーシナリオ E2Eテスト
 *
 * このテストはアプリケーションの堅牢性を検証するため、
 * 各種エラーシナリオ、エッジケース、異常系のテストを実施します。
 */
test.describe('エッジケースとエラーシナリオ', () => {
  test.describe('認証エラーシナリオ', () => {
    let connectionPage: ConnectionPage;

    test.beforeEach(async ({ page }) => {
      connectionPage = new ConnectionPage(page);
    });

    test.skip('AWS接続テスト: 無効なプロファイル', async ({ page }) => {
      await connectionPage.navigate();

      // 無効なプロファイルで接続テスト
      await connectionPage.testAWSConnection('invalid-profile-name', 'us-east-1');

      // エラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();
    });

    test.skip('Azure接続テスト: 無効なTenant ID', async ({ page }) => {
      await connectionPage.navigate();

      // 無効なTenant IDで接続テスト
      await connectionPage.testAzureConnection(
        'invalid-tenant-id',
        'client-id',
        'client-secret'
      );

      // エラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();
    });

    test.skip('Azure接続テスト: 無効なClient Secret', async ({ page }) => {
      await connectionPage.navigate();

      // 無効なClient Secretで接続テスト
      await connectionPage.testAzureConnection(
        'valid-tenant-id',
        'valid-client-id',
        'invalid-secret'
      );

      // エラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();
    });
  });

  test.describe('入力バリデーションエラー', () => {
    let scanPage: ScanPage;

    test.beforeEach(async ({ page }) => {
      scanPage = new ScanPage(page);
    });

    test('AWS: プロファイル未入力でスキャン実行', async ({ page }) => {
      await scanPage.navigate();
      await scanPage.selectAWSProvider();

      // プロファイルを空のままスキャンボタンをクリック
      await scanPage.awsProfileInput.fill('');
      await scanPage.scanButton.click();

      // ブラウザの標準バリデーションまたはエラーメッセージが表示されることを期待
      // 実装によってはボタンがdisabledになる可能性もある
    });

    test.skip('Azure: サブスクリプション未選択でスキャン実行', async ({ page }) => {
      await scanPage.navigate();
      await scanPage.selectAzureProvider();

      // サブスクリプションを選択せずにスキャンボタンをクリック
      await scanPage.scanButton.click();

      // エラーメッセージまたはバリデーションが表示されることを期待
    });
  });

  test.describe('ネットワークエラーシナリオ', () => {
    test.skip('バックエンドサーバーが停止している場合', async ({ page }) => {
      // バックエンドサーバーへの接続をブロック
      await page.route('http://localhost:8000/**', route => route.abort());

      const connectionPage = new ConnectionPage(page);
      await connectionPage.navigate();

      // AWS接続テストを実行
      await connectionPage.testAWSConnection('test-profile', 'us-east-1');

      // ネットワークエラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();

      // エラーメッセージにネットワーク関連のテキストが含まれることを確認
      const errorText = await connectionPage.errorMessage.textContent();
      expect(errorText).toMatch(/サーバー|接続|ネットワーク|失敗/);
    });

    test.skip('タイムアウトエラー', async ({ page }) => {
      // APIレスポンスを遅延させてタイムアウトを発生させる
      await page.route('http://localhost:8000/api/**', route => {
        setTimeout(() => route.continue(), 65000); // 65秒遅延（タイムアウト想定）
      });

      const scanPage = new ScanPage(page);
      await scanPage.navigate();

      await scanPage.startAWSScan('test-profile', undefined, 'test');

      // タイムアウトエラーが表示されることを確認
      await scanPage.expectScanError();
    });
  });

  test.describe('データ関連のエッジケース', () => {
    test.skip('スキャン結果がゼロ件の場合', async ({ page }) => {
      // スキャン結果が0件のモックデータを返すようにする
      await page.route('http://localhost:8000/api/resources/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            resources: [],
            total: 0,
            total_pages: 0,
            provider: 'aws'
          })
        });
      });

      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.navigateWithScanId('test-scan-id');

      // リソースが0件の場合の表示を確認
      const resourceCount = await resourcesPage.getResourceCount();
      expect(resourceCount).toBe(0);

      // 適切なメッセージが表示されることを確認（実装による）
      // 例: 「リソースが見つかりませんでした」など
    });

    test.skip('大量のリソースがある場合のページネーション', async ({ page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.navigateWithScanId('test-scan-id-large');

      // ページネーションが正しく機能することを確認
      await expect(resourcesPage.pageInfo).toBeVisible();

      // 次へボタンで複数ページを移動
      for (let i = 0; i < 3; i++) {
        const isDisabled = await resourcesPage.nextPageButton.isDisabled();
        if (!isDisabled) {
          await resourcesPage.goToNextPage();
          await page.waitForTimeout(500);
        } else {
          break;
        }
      }

      // 前へボタンで戻る
      await resourcesPage.goToPrevPage();
      await page.waitForTimeout(500);
    });

    test.skip('リソース選択なしで生成実行', async ({ page }) => {
      const generatePage = new GeneratePage(page);
      await generatePage.navigateWithScanId('test-scan-id');

      // リソース選択なしで生成実行
      await generatePage.generate();

      // エラーメッセージまたは警告が表示されることを確認
      // （実装によっては、空のTerraformファイルが生成される可能性もある）
    });
  });

  test.describe('UI操作のエッジケース', () => {
    test('複数タブの高速切り替え', async ({ page }) => {
      const connectionPage = new ConnectionPage(page);
      await connectionPage.navigate();

      // AWSとAzureタブを高速で切り替え
      for (let i = 0; i < 5; i++) {
        await connectionPage.switchToAWS();
        await connectionPage.switchToAzure();
      }

      // 最終的にAWSタブが表示されることを確認
      await connectionPage.switchToAWS();
      await expect(connectionPage.awsProfileInput).toBeVisible();
    });

    test.skip('リソース選択の連続操作', async ({ page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.navigateWithScanId('test-scan-id');

      // 全選択 → 全解除 → 個別選択を繰り返す
      await resourcesPage.selectAll();
      let selectedCount = await resourcesPage.getSelectedCount();
      expect(selectedCount).toBeGreaterThan(0);

      await resourcesPage.deselectAll();
      selectedCount = await resourcesPage.getSelectedCount();
      expect(selectedCount).toBe(0);

      // 個別に選択
      const resourceCount = await resourcesPage.getResourceCount();
      if (resourceCount > 0) {
        await resourcesPage.selectResource(0);
        selectedCount = await resourcesPage.getSelectedCount();
        expect(selectedCount).toBe(1);
      }
    });

    test.skip('フィルター適用中のタブ切り替え', async ({ page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.navigateWithScanId('test-scan-id');

      // フィルターを適用
      await resourcesPage.openFilter();
      await resourcesPage.filterBySimpleSearch('test');

      // タブを切り替え
      await resourcesPage.switchTab('groups');
      await page.waitForTimeout(500);

      // フィルターがクリアされているか、またはタブごとに独立していることを確認
      // （実装依存）
    });
  });

  test.describe('生成エラーシナリオ', () => {
    test.skip('無効な出力パス', async ({ page }) => {
      const generatePage = new GeneratePage(page);
      await generatePage.navigateWithScanId('test-scan-id');

      // 無効な出力パスを設定（例: 絶対パス、特殊文字を含むパスなど）
      await generatePage.setOutputPath('/invalid/absolute/path');

      await generatePage.generate();

      // エラーメッセージが表示されることを確認
      await generatePage.expectGenerationError();
    });

    test.skip('生成中に複数回生成ボタンをクリック', async ({ page }) => {
      const generatePage = new GeneratePage(page);
      await generatePage.navigateWithScanId('test-scan-id');

      // 生成を開始
      await generatePage.generate();

      // 生成中に再度生成ボタンをクリック
      await generatePage.generateButton.click();

      // ボタンがdisabledになっているか、エラーが表示されることを確認
      const isDisabled = await generatePage.generateButton.isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('テンプレートエラーシナリオ', () => {
    test.skip('空のテンプレート保存', async ({ page }) => {
      const templatesPage = new TemplatesPage(page);
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_user');

      // テンプレートを空にする
      await templatesPage.setEditorContent('');
      await page.waitForTimeout(1000); // バリデーション待ち

      // 保存を試みる
      await templatesPage.save();

      // エラーまたは警告が表示されることを確認
      // （実装によっては保存可能で、生成時にエラーになる可能性もある）
    });

    test.skip('非常に大きなテンプレート', async ({ page }) => {
      const templatesPage = new TemplatesPage(page);
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_user');

      // 非常に大きなテンプレート（10000行）を作成
      const largeContent = Array(10000)
        .fill('# Comment line\n')
        .join('');

      await templatesPage.setEditorContent(largeContent);
      await page.waitForTimeout(2000); // 処理待ち

      // 保存を試みる
      await templatesPage.save();

      // 成功またはエラーを確認（実装依存）
    });
  });

  test.describe('ブラウザバック/フォワード操作', () => {
    test.skip('スキャン完了後のブラウザバック', async ({ page }) => {
      const scanPage = new ScanPage(page);
      await scanPage.navigate();

      // スキャン実行と完了（モック）
      await scanPage.startAWSScan('test-profile', undefined, 'test');
      await scanPage.expectScanComplete();
      await scanPage.expectNavigationToResources();

      // ブラウザバック
      await page.goBack();

      // スキャンページに戻ることを確認
      expect(page.url()).toContain('/scan');
    });

    test.skip('生成完了後のブラウザバック', async ({ page }) => {
      const generatePage = new GeneratePage(page);
      await generatePage.navigateWithScanId('test-scan-id');

      // 生成実行
      await generatePage.generate();
      await generatePage.expectGenerationComplete();

      // ブラウザバック
      await page.goBack();

      // リソースページに戻ることを確認（または生成ページにとどまる）
      // 実装依存
    });
  });

  test.describe('同時実行シナリオ', () => {
    test.skip('複数のスキャンを同時実行', async ({ browser }) => {
      // 複数のコンテキストで同時にスキャンを実行
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      const scanPage1 = new ScanPage(page1);
      const scanPage2 = new ScanPage(page2);

      // 同時にスキャン開始
      await Promise.all([
        scanPage1.navigate().then(() => scanPage1.startAWSScan('profile1', undefined, 'test1')),
        scanPage2.navigate().then(() => scanPage2.startAWSScan('profile2', undefined, 'test2'))
      ]);

      // 両方のスキャンが完了することを確認
      await Promise.all([
        scanPage1.expectScanComplete(),
        scanPage2.expectScanComplete()
      ]);

      await context1.close();
      await context2.close();
    });
  });

  test.describe('セッション・状態管理', () => {
    test.skip('ページリロード後の選択状態保持', async ({ page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.navigateWithScanId('test-scan-id');

      // リソースを選択
      await resourcesPage.selectResource(0);
      const selectedCount = await resourcesPage.getSelectedCount();
      expect(selectedCount).toBeGreaterThan(0);

      // ページリロード
      await page.reload();

      // 選択状態が保持されていることを確認
      const selectedCountAfterReload = await resourcesPage.getSelectedCount();
      expect(selectedCountAfterReload).toBe(selectedCount);
    });

    test.skip('長時間アイドル後の操作', async ({ page }) => {
      const connectionPage = new ConnectionPage(page);
      await connectionPage.navigate();

      // 長時間待機（30秒）
      await page.waitForTimeout(30000);

      // 操作が正常に動作することを確認
      await connectionPage.testAWSConnection('test-profile', 'us-east-1');

      // タイムアウトやセッションエラーが発生しないことを確認
    });
  });
});
