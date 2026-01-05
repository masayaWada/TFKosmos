import { test, expect } from '@playwright/test';
import { ScanPage } from '../pages/ScanPage';
import { scanTestData } from '../fixtures/test-data';

test.describe('スキャンフロー', () => {
  let scanPage: ScanPage;

  test.beforeEach(async ({ page }) => {
    scanPage = new ScanPage(page);
    await scanPage.navigate();
  });

  test.describe('スキャン設定画面の表示', () => {
    test('スキャンページが正しく表示される', async ({ page }) => {
      // プロバイダー選択が表示されることを確認
      await expect(scanPage.providerSelect).toBeVisible();

      // スキャンボタンが表示されることを確認
      await expect(scanPage.scanButton).toBeVisible();
    });

    test('プロバイダー選択（AWS）', async ({ page }) => {
      // AWSを選択
      await scanPage.selectAWSProvider();

      // AWS固有のフォームが表示されることを確認
      await expect(scanPage.awsProfileInput).toBeVisible();
      await expect(scanPage.awsRegionSelect).toBeVisible();
    });

    test('プロバイダー選択（Azure）', async ({ page }) => {
      // Azureを選択
      await scanPage.selectAzureProvider();

      // Azure固有のフォームが表示されることを確認
      await expect(scanPage.azureSubscriptionSelect).toBeVisible();
    });
  });

  test.describe('スキャン実行（AWS）', () => {
    test.skip('AWSスキャンの開始', async ({ page }) => {
      // Note: 実際のAWS認証情報とバックエンドが必要なため、スキップ

      // スキャン開始
      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        scanTestData.aws.region,
        scanTestData.aws.namePrefix
      );

      // 進捗バーが表示されることを確認
      await scanPage.expectProgressVisible();
    });

    test.skip('AWSスキャンの完了', async ({ page }) => {
      // Note: 実際のAWS認証情報とバックエンドが必要なため、スキップ

      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        scanTestData.aws.region
      );

      // スキャン完了メッセージが表示されることを確認
      await scanPage.expectScanComplete();

      // リソースページに遷移することを確認
      await scanPage.expectNavigationToResources();
    });

    test.skip('AWSスキャンのエラー', async ({ page }) => {
      // Note: 実際のAWS認証情報とバックエンドが必要なため、スキップ

      // 無効な設定でスキャン開始
      await scanPage.startAWSScan('invalid-profile', 'us-east-1');

      // エラーメッセージが表示されることを確認
      await scanPage.expectScanError();
    });
  });

  test.describe('スキャン実行（Azure）', () => {
    test.skip('Azureスキャンの開始', async ({ page }) => {
      // Note: 実際のAzure認証情報とバックエンドが必要なため、スキップ

      // スキャン開始
      await scanPage.startAzureScan(
        scanTestData.azure.subscription,
        scanTestData.azure.resourceGroup
      );

      // 進捗バーが表示されることを確認
      await scanPage.expectProgressVisible();
    });

    test.skip('Azureスキャンの完了', async ({ page }) => {
      // Note: 実際のAzure認証情報とバックエンドが必要なため、スキップ

      await scanPage.startAzureScan(scanTestData.azure.subscription);

      // スキャン完了メッセージが表示されることを確認
      await scanPage.expectScanComplete();

      // リソースページに遷移することを確認
      await scanPage.expectNavigationToResources();
    });

    test.skip('Azureスキャンのエラー', async ({ page }) => {
      // Note: 実際のAzure認証情報とバックエンドが必要なため、スキップ

      // 無効な設定でスキャン開始
      await scanPage.startAzureScan('invalid-subscription');

      // エラーメッセージが表示されることを確認
      await scanPage.expectScanError();
    });
  });

  test.describe('進捗表示', () => {
    test.skip('スキャン中の進捗表示', async ({ page }) => {
      // Note: 実際のバックエンドが必要なため、スキップ

      await scanPage.startAWSScan(
        scanTestData.aws.profile,
        scanTestData.aws.region
      );

      // 進捗バーが表示されることを確認
      await expect(scanPage.progressBar).toBeVisible();

      // 進捗テキストが表示されることを確認
      await expect(scanPage.progressText).toBeVisible();
    });
  });
});
