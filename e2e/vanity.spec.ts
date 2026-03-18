import { test, expect } from '@playwright/test';

test.describe('Vanity URL Tests', () => {
  test('should reject 3-char name on Standard tier', async ({ page }) => {
    await page.goto('/');

    // Enter a 3-character name (vanity URL)
    const input = page.locator('input[placeholder="my-secret-drop-name"]');
    await input.fill('abc');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // Should see validation error about name length
    await expect(page.locator('text=/at least 12 characters/')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should accept 12-char name on Standard tier', async ({ page }) => {
    await page.goto('/');

    // Enter a 12-character name (minimum for Standard)
    const input = page.locator('input[placeholder="my-secret-drop-name"]');
    await input.fill('abcdefghijkl');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // Should either show "not found" (name available) or "found" (drop exists)
    // Either way, it means the name was valid
    const notFoundLocator = page.locator('text=/not found|available|create/i');
    const foundLocator = page.locator('text=/found|view|unlock/i');

    const isNotFound = await notFoundLocator.isVisible().catch(() => false);
    const isFound = await foundLocator.isVisible().catch(() => false);

    expect(isNotFound || isFound).toBe(true);
  });

  test('should accept names with spaces that normalize to valid length', async ({ page }) => {
    await page.goto('/');

    // Enter a name with spaces: "my secret file" -> "my-secret-file" (14 chars)
    const input = page.locator('input[placeholder="my-secret-drop-name"]');
    await input.fill('my secret file');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // Should not show validation error (14 chars after normalization is >= 12)
    const errorLocator = page.locator('text=/at least 12 characters/');
    const isErrorVisible = await errorLocator.isVisible().catch(() => false);

    expect(isErrorVisible).toBe(false);
  });

  test('should use fragment routing for drop names', async ({ page }) => {
    await page.goto('/');

    // Enter a name
    const input = page.locator('input[placeholder="my-secret-drop-name"]');
    await input.fill('test-fragment-routing');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(1000);

    // URL should have fragment
    const url = page.url();
    expect(url).toContain('#test-fragment-routing');
  });
});
