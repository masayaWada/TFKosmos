import { test, expect } from '@playwright/test';
import { ConnectionPage } from '../pages/ConnectionPage';
import { awsTestData, azureTestData } from '../fixtures/test-data';

test.describe('接続テストフロー', () => {
  let connectionPage: ConnectionPage;

  test.beforeEach(async ({ page }) => {
    connectionPage = new ConnectionPage(page);
    await connectionPage.navigate();
  });

  test.describe('AWS接続テスト', () => {
    test('AWS接続画面の表示', async ({ page }) => {
      // AWS タブが表示されることを確認
      await expect(connectionPage.awsTab).toBeVisible();

      // AWSタブに切り替え
      await connectionPage.switchToAWS();

      // フォーム要素が表示されることを確認
      await expect(connectionPage.awsProfileInput).toBeVisible();
      await expect(connectionPage.awsRegionSelect).toBeVisible();
      await expect(connectionPage.awsTestButton).toBeVisible();
    });

    test('AWS認証情報入力', async ({ page }) => {
      await connectionPage.switchToAWS();

      // Profile入力
      await connectionPage.awsProfileInput.fill(awsTestData.validConnection.profile);
      await expect(connectionPage.awsProfileInput).toHaveValue(awsTestData.validConnection.profile);

      // Region選択
      await connectionPage.awsRegionSelect.selectOption(awsTestData.validConnection.region);
      await expect(connectionPage.awsRegionSelect).toHaveValue(awsTestData.validConnection.region);
    });

    test.skip('AWS接続テスト実行（成功）', async ({ page }) => {
      // Note: 実際のAWS認証情報が必要なため、スキップ
      // CI/CD環境で実行する場合は、モックサーバーを使用する

      await connectionPage.testAWSConnection(
        awsTestData.validConnection.profile,
        awsTestData.validConnection.region
      );

      // 成功メッセージが表示されることを確認
      await connectionPage.expectSuccessMessage();
    });

    test.skip('AWS接続テスト実行（失敗）', async ({ page }) => {
      // Note: 実際のAWS認証情報が必要なため、スキップ

      await connectionPage.testAWSConnection(
        awsTestData.invalidConnection.profile,
        awsTestData.invalidConnection.region
      );

      // エラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();
    });
  });

  test.describe('Azure接続テスト', () => {
    test('Azure接続画面の表示', async ({ page }) => {
      // Azure タブが表示されることを確認
      await expect(connectionPage.azureTab).toBeVisible();

      // Azureタブに切り替え
      await connectionPage.switchToAzure();

      // フォーム要素が表示されることを確認
      await expect(connectionPage.azureAuthMethodSelect).toBeVisible();
      await expect(connectionPage.azureTestButton).toBeVisible();
    });

    test('Azure認証情報入力（サービスプリンシパル）', async ({ page }) => {
      await connectionPage.switchToAzure();

      // 認証方法選択
      await connectionPage.azureAuthMethodSelect.selectOption('service_principal');

      // サービスプリンシパル情報入力
      await connectionPage.azureTenantIdInput.fill(azureTestData.validConnection.tenantId);
      await expect(connectionPage.azureTenantIdInput).toHaveValue(azureTestData.validConnection.tenantId);

      await connectionPage.azureClientIdInput.fill(azureTestData.validConnection.clientId);
      await expect(connectionPage.azureClientIdInput).toHaveValue(azureTestData.validConnection.clientId);

      await connectionPage.azureClientSecretInput.fill(azureTestData.validConnection.clientSecret);
      await expect(connectionPage.azureClientSecretInput).toHaveValue(azureTestData.validConnection.clientSecret);
    });

    test.skip('Azure接続テスト実行（成功）', async ({ page }) => {
      // Note: 実際のAzure認証情報が必要なため、スキップ

      await connectionPage.testAzureConnection(
        azureTestData.validConnection.tenantId,
        azureTestData.validConnection.clientId,
        azureTestData.validConnection.clientSecret
      );

      // 成功メッセージが表示されることを確認
      await connectionPage.expectSuccessMessage();
    });

    test.skip('Azure接続テスト実行（失敗）', async ({ page }) => {
      // Note: 実際のAzure認証情報が必要なため、スキップ

      await connectionPage.testAzureConnection(
        azureTestData.invalidConnection.tenantId,
        azureTestData.invalidConnection.clientId,
        azureTestData.invalidConnection.clientSecret
      );

      // エラーメッセージが表示されることを確認
      await connectionPage.expectErrorMessage();
    });
  });

  test.describe('タブ切り替え', () => {
    test('AWSとAzureのタブを切り替え', async ({ page }) => {
      // 初期状態（AWS）
      await connectionPage.switchToAWS();
      await expect(connectionPage.awsProfileInput).toBeVisible();

      // Azureに切り替え
      await connectionPage.switchToAzure();
      await expect(connectionPage.azureAuthMethodSelect).toBeVisible();

      // 再度AWSに切り替え
      await connectionPage.switchToAWS();
      await expect(connectionPage.awsProfileInput).toBeVisible();
    });
  });
});
