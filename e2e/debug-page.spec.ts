import { test, expect } from '@playwright/test';

test.describe('Debug Page Load', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('http://localhost:3010/');

    // Take a screenshot
    await page.screenshot({ path: 'debug-homepage.png' });

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if page loaded
    const title = await page.title();

    // Look for any content
    const content = await page.content();

    // Check for specific elements
    const header = page.locator('header').first();

    // Look for inputs
    const inputs = await page.locator('input').all();

    for (const input of inputs) {
      const placeholder = await input.getAttribute('placeholder');
    }
  });

  test('should wait for React to hydrate', async ({ page }) => {
    await page.goto('http://localhost:3010/');

    // Wait longer for hydration
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'debug-homepage-3s.png' });

    // Look for the split container
    const splitContainer = page.locator('.split-container');
    const isVisible = await splitContainer.isVisible().catch(() => false);

    if (!isVisible) {
      // Look for error messages
      const bodyText = await page.locator('body').textContent();
    }
  });
});
