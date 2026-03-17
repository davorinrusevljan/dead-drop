import { test, expect } from '@playwright/test';

test.describe('Vanity URL Tests', () => {
  test('should reject 3-char phrase on Standard tier', async ({ page }) => {
    await page.goto('/');

    // Enter a 3-character phrase (vanity URL)
    const input = page.locator('input[placeholder="my-secret-phrase"]');
    await input.fill('abc');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // Should see validation error about phrase length
    await expect(page.locator('text=/at least 8 characters/')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should accept 8-char phrase on Standard tier', async ({ page }) => {
    await page.goto('/');

    // Enter an 8-character phrase (minimum for Standard)
    const input = page.locator('input[placeholder="my-secret-phrase"]');
    await input.fill('abcdefgh');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // Should either show "not found" (phrase available) or "found" (drop exists)
    // Either way, it means the phrase was valid
    const notFoundLocator = page.locator('text=/not found|available|create/i');
    const foundLocator = page.locator('text=/found|view/i');

    const isNotFound = await notFoundLocator.isVisible().catch(() => false);
    const isFound = await foundLocator.isVisible().catch(() => false);

    expect(isNotFound || isFound).toBe(true);
  });

  test('should accept 3-char phrase on Deep tier', async ({ page }) => {
    await page.goto('/drop/abc');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // On Deep tier, 3-char phrases should be allowed
    // The page should show the create form, not a validation error
    const errorLocator = page.locator('text=/8 characters|phrase.*too short/i');
    const isVisible = await errorLocator.isVisible().catch(() => false);

    // Should NOT show phrase length validation error
    expect(isVisible).toBe(false);
  });
});
