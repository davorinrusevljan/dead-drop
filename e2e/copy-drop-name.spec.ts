import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3010';

test.describe('Copy Drop Name button on success page', () => {
  test.setTimeout(90000);

  test('COPY DROP NAME button appears and copies drop name to clipboard', async ({
    page,
    context,
  }) => {
    const dropName = `cdn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const content = `Clipboard test ${Date.now()}`;
    const adminPwd = 'test-admin-123';

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // CREATE a public drop
    await page.goto(`${BASE_URL}/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);

    // Wait for client-side hydration and availability check
    await page.waitForFunction(() => document.querySelector('.tag') !== null, { timeout: 20000 });

    await page.fill('textarea', content);
    await page.click('button:has-text("Public")');
    await page.fill('input[placeholder="min 8 characters"]', adminPwd);
    await page.fill('input[placeholder*="repeat password"]', adminPwd);
    await page.check('input[type="checkbox"]');

    await page
      .locator('button')
      .filter({ hasText: /CREATE DROP/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    // Verify success state
    expect(await page.locator('body').textContent()).toContain('DROP CREATED');

    // Verify "COPY DROP NAME" button exists (not "Go to Home")
    const copyDropNameBtn = page.locator('button:has-text("COPY DROP NAME")');
    await expect(copyDropNameBtn).toBeVisible();

    // Verify old "Go to Home" button is gone
    await expect(page.locator('button:has-text("Go to Home")')).toHaveCount(0);

    // Click the button and verify clipboard
    await copyDropNameBtn.click();
    await page.waitForTimeout(500);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(dropName);
  });
});
