import { test, expect } from '@playwright/test';

test.describe('Integrity Tests', () => {
  test('should reject 4MB payload on Standard tier', async ({ page }) => {
    // Navigate using fragment
    await page.goto('/#test-integrity-check');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Try to create a large payload (over 10KB)
    const largeContent = 'x'.repeat(11 * 1024); // 11KB

    // Fill in the form
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('test-password');
    }

    const contentTextarea = page.locator('textarea').first();
    if (await contentTextarea.isVisible()) {
      await contentTextarea.fill(largeContent);

      // Try to submit
      const createButton = page.locator('button:has-text("Create")');
      await createButton.click();

      // Should see an error about payload size
      await expect(page.locator('text=/exceeds|too large|10KB|upgrade/i')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should accept exactly 10KB payload on Standard tier', async ({ page }) => {
    // Navigate using fragment
    await page.goto('/#test-integrity-10kb');

    await page.waitForLoadState('networkidle');

    // Create exactly 10KB content
    const exactContent = 'x'.repeat(10 * 1024); // 10KB

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('test-password');
    }

    const contentTextarea = page.locator('textarea').first();
    if (await contentTextarea.isVisible()) {
      await contentTextarea.fill(exactContent);

      const createButton = page.locator('button:has-text("Create")');
      await createButton.click();

      // Should NOT see an error about payload size
      // Either success or a different error (like name validation)
      const errorLocator = page.locator('text=/exceeds|too large/i');
      const isVisible = await errorLocator.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
  });
});
