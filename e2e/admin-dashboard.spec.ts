import { test, expect } from '@playwright/test';

const ADMIN_UI = 'http://localhost:3011';
const ADMIN_API = 'http://localhost:9091';

test.describe('admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login via API to get auth cookie
    const response = await page.request.post(`${ADMIN_API}/api/auth/login`, {
      data: { username: 'admin', password: 'admin1234' },
    });
    expect(response.ok()).toBeTruthy();

    // Navigate to dashboard (cookie should be set on API domain)
    // We need to set the cookie for the UI domain since API and UI are on different ports
    const setCookieHeader = response.headers()['set-cookie'];
    expect(setCookieHeader).toBeDefined();

    // Extract token from set-cookie header
    const tokenMatch = setCookieHeader?.match(/admin_auth_token=([^;]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch![1];

    // Set cookie on UI domain
    await page.context().addCookies([
      {
        name: 'admin_auth_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Go to dashboard
    await page.goto(`${ADMIN_UI}/dashboard`);
  });

  test('should show overview stat cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('.admin-stat-card');

    // First row has 5 overview cards: Total, Active, Expired, Created Today, Created This Week
    const firstRowCards = page.locator('.admin-stats-grid').first().locator('.admin-stat-card');
    await expect(firstRowCards).toHaveCount(5);

    // Verify labels
    const labels = [
      'Total Drops',
      'Active Drops',
      'Expired Drops',
      'Created Today',
      'Created This Week',
    ];
    for (let i = 0; i < labels.length; i++) {
      await expect(firstRowCards.nth(i).locator('.admin-stat-label')).toHaveText(labels[i]);
    }
  });

  test('should display expired drops count', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('.admin-stat-value.danger', { timeout: 10000 });

    const expiredCard = page.locator('.admin-stat-card').filter({ hasText: 'Expired Drops' });
    const expiredValue = expiredCard.locator('.admin-stat-value');

    // Should be a non-negative number
    const text = await expiredValue.textContent();
    const count = parseInt(text ?? '', 10);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should fetch overview data from API', async ({ page }) => {
    // Set up interceptor BEFORE navigation
    const overviewPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/stats/overview') && resp.status() === 200
    );

    // The beforeEach already navigated, so reload to capture the request
    await page.reload();

    const response = await overviewPromise;
    const data = await response.json();

    expect(data).toHaveProperty('totalDrops');
    expect(data).toHaveProperty('activeDrops');
    expect(data).toHaveProperty('expiredDrops');
    expect(typeof data.totalDrops).toBe('number');
    expect(typeof data.activeDrops).toBe('number');
    expect(typeof data.expiredDrops).toBe('number');
  });
});
