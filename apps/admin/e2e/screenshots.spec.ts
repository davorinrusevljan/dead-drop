import { test, expect } from '@playwright/test';

test.describe('Screenshots', () => {
  test('take screenshot of login page', async ({ page }) => {
    await page.goto('/login');
    await page.screenshot({ path: 'test-results/login-screenshot.png', fullPage: true });
  });

  test('take screenshot of dashboard loading state', async ({ page }) => {
    await page.goto('/dashboard');
    await page.screenshot({
      path: 'test-results/dashboard-loading-screenshot.png',
      fullPage: true,
    });
  });
});
