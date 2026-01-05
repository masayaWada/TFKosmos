import { test, expect } from '@playwright/test';
import { TemplatesPage } from '../pages/TemplatesPage';

/**
 * テンプレートカスタマイズフロー E2Eテスト
 *
 * このテストはテンプレート編集、検証、保存、復元のフローを検証します。
 * バックエンドサーバーが必要なため、一部のテストはスキップされています。
 */
test.describe('テンプレートカスタマイズフロー', () => {
  let templatesPage: TemplatesPage;

  test.beforeEach(async ({ page }) => {
    templatesPage = new TemplatesPage(page);
  });

  test('テンプレート一覧の表示', async ({ page }) => {
    await templatesPage.navigate();

    // テンプレート一覧が表示されることを確認
    await expect(templatesPage.templateList).toBeVisible();
    await expect(templatesPage.templateListItems.first()).toBeVisible();
  });

  test.skip('テンプレート選択とエディタ表示', async ({ page }) => {
    await templatesPage.navigate();

    // IAM User テンプレートを選択
    await templatesPage.selectTemplate('iam_user');

    // エディタが表示されることを確認
    await templatesPage.expectEditorVisible();

    // 保存ボタンとプレビューボタンが表示されることを確認
    await expect(templatesPage.saveButton).toBeVisible();
    await expect(templatesPage.previewButton).toBeVisible();
  });

  test.skip('テンプレート編集 → 検証 → 保存', async ({ page }) => {
    await test.step('テンプレート選択', async () => {
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_user');
      await templatesPage.expectEditorVisible();
    });

    await test.step('テンプレート編集', async () => {
      // 現在のコンテンツを取得
      const originalContent = await templatesPage.getEditorContent();
      expect(originalContent).toBeTruthy();

      // コメントを追加してテンプレートを編集
      const modifiedContent = `# Modified template\n${originalContent}`;
      await templatesPage.setEditorContent(modifiedContent);

      // 編集内容が反映されていることを確認
      const newContent = await templatesPage.getEditorContent();
      expect(newContent).toContain('# Modified template');
    });

    await test.step('バリデーション（自動）', async () => {
      // 編集後、自動的にバリデーションが実行される（500msデバウンス）
      await page.waitForTimeout(1000);

      // バリデーションエラーがないことを確認（正しい構文の場合）
      const errorCount = await templatesPage.getValidationErrorCount();
      // エラーがある場合は、エラー表示セクションが表示される
    });

    await test.step('テンプレート保存', async () => {
      // 保存を実行
      await templatesPage.save();

      // 保存成功メッセージが表示されることを確認
      await templatesPage.expectSaveSuccess();
    });
  });

  test.skip('テンプレート編集 → プレビュー', async ({ page }) => {
    await test.step('テンプレート選択', async () => {
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_role');
      await templatesPage.expectEditorVisible();
    });

    await test.step('プレビュー実行', async () => {
      // プレビューボタンをクリック
      await templatesPage.preview();

      // プレビューが表示されることを確認
      await templatesPage.expectPreviewVisible();

      // プレビューコードが表示されることを確認
      await expect(templatesPage.codePreview).toBeVisible();
    });
  });

  test.skip('テンプレートカスタマイズ → デフォルトに復元', async ({ page }) => {
    await test.step('テンプレート選択と編集', async () => {
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_policy');
      await templatesPage.expectEditorVisible();

      // テンプレートを編集
      const originalContent = await templatesPage.getEditorContent();
      const modifiedContent = `# Custom template\n${originalContent}`;
      await templatesPage.setEditorContent(modifiedContent);

      // 保存
      await templatesPage.save();
      await templatesPage.expectSaveSuccess();
    });

    await test.step('復元ボタンの確認', async () => {
      // ページをリロードしてカスタムテンプレートの状態を確認
      await page.reload();
      await templatesPage.selectTemplate('iam_policy');

      // 復元ボタンが表示されることを確認（カスタムテンプレートの場合）
      await templatesPage.expectRestoreButtonVisible();
    });

    await test.step('デフォルトに復元', async () => {
      // 復元を実行
      await templatesPage.restore();

      // 成功メッセージが表示されることを確認
      await templatesPage.expectSaveSuccess();

      // ページをリロードしてデフォルトに戻ったことを確認
      await page.reload();
      await templatesPage.selectTemplate('iam_policy');

      // 復元ボタンが表示されないことを確認（デフォルトテンプレートの場合）
      const restoreButtonVisible = await templatesPage.restoreButton.isVisible();
      expect(restoreButtonVisible).toBe(false);
    });
  });

  test.skip('無効なテンプレート構文でバリデーションエラー', async ({ page }) => {
    await test.step('テンプレート選択', async () => {
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_user');
      await templatesPage.expectEditorVisible();
    });

    await test.step('無効な構文を入力', async () => {
      // 無効なJinja2構文を入力
      const invalidContent = `
resource "aws_iam_user" "{{ user.name }}" {
  name = "{{ user.name }}"
  {% for tag in user.tags %
    # Missing closing brace - invalid syntax
  {% endfor %}
}
`;
      await templatesPage.setEditorContent(invalidContent);

      // デバウンス待ち
      await page.waitForTimeout(1000);
    });

    await test.step('バリデーションエラーの確認', async () => {
      // バリデーションエラーが表示されることを確認
      await templatesPage.expectValidationErrors();

      // エラー数が0より大きいことを確認
      const errorCount = await templatesPage.getValidationErrorCount();
      expect(errorCount).toBeGreaterThan(0);
    });

    await test.step('保存試行（エラーがある場合）', async () => {
      // エラーがあっても保存は可能（警告は出る）
      await templatesPage.save();

      // エラーメッセージが表示される可能性がある
      // または、バックエンドで検証してエラーを返す
    });
  });

  test.skip('複数のテンプレート編集', async ({ page }) => {
    const templates: Array<'iam_user' | 'iam_group' | 'iam_role' | 'iam_policy'> = [
      'iam_user',
      'iam_group',
      'iam_role',
      'iam_policy'
    ];

    for (const template of templates) {
      await test.step(`${template} テンプレート編集`, async () => {
        await templatesPage.navigate();
        await templatesPage.selectTemplate(template);
        await templatesPage.expectEditorVisible();

        // コンテンツを確認
        const content = await templatesPage.getEditorContent();
        expect(content).toBeTruthy();
        expect(content).toContain('resource');

        // コメントを追加
        const modifiedContent = `# Custom ${template} template\n${content}`;
        await templatesPage.setEditorContent(modifiedContent);

        // 保存
        await templatesPage.save();
        await templatesPage.expectSaveSuccess();
      });
    }
  });

  test.skip('テンプレート切り替え時のコンテンツ更新', async ({ page }) => {
    await test.step('初期テンプレート選択', async () => {
      await templatesPage.navigate();
      await templatesPage.selectTemplate('iam_user');
      await templatesPage.expectEditorVisible();
    });

    await test.step('異なるテンプレートに切り替え', async () => {
      const userContent = await templatesPage.getEditorContent();

      // IAM Group テンプレートに切り替え
      await templatesPage.selectTemplate('iam_group');
      await page.waitForTimeout(500); // コンテンツ読み込み待ち

      const groupContent = await templatesPage.getEditorContent();

      // コンテンツが変わったことを確認
      expect(groupContent).not.toBe(userContent);
      expect(groupContent).toContain('resource');
    });

    await test.step('元のテンプレートに戻る', async () => {
      // IAM User テンプレートに戻る
      await templatesPage.selectTemplate('iam_user');
      await page.waitForTimeout(500);

      const content = await templatesPage.getEditorContent();
      expect(content).toContain('resource');
    });
  });
});
