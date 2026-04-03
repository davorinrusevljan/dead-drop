import { expect, test } from '@playwright/test';

test.describe('Admin Users Page', () => {
  test.beforeEach(async ({ page }) => {
    // Users page redirects to login if not authenticated
    await page.goto('/users');
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check we're on login page
    const loginCard = page.locator('.admin-login-card');
    await expect(loginCard).toBeVisible();

    // Check URL contains /login
    expect(page.url()).toContain('/login');
  });

  test('should have proper dark theme styling on login redirect', async ({ page }) => {
    // Wait for login page to load
    await page.waitForSelector('.admin-login-card', { timeout: 10000 });

    const body = page.locator('body');

    // Check background is dark
    const bgColor = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBe('rgb(3, 3, 5)'); // #030305
  });
});
