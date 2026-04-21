import { test, expect } from '@playwright/test';

const PROD_API_URL = 'https://api.dead-drop.xyz';
const PROD_FRONTEND_URL = 'https://dead-drop.xyz';

test.describe('Production E2E - v1 API Verification', () => {
  test('API responses should include X-API-Version header', async ({ request }) => {
    const healthResponse = await request.get(`${PROD_API_URL}/api/v1/health`);
    expect(healthResponse.ok()).toBe(true);
    const apiVersion = healthResponse.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');

    const dropsResponse = await request.get(`${PROD_API_URL}/api/v1/drops/generate-name`);
    expect(dropsResponse.ok()).toBe(true);
    const dropsApiVersion = dropsResponse.headers()['x-api-version'];
    expect(dropsApiVersion).toBe('1.0.0');
  });

  test('should generate name using v1 API', async ({ request }) => {
    const response = await request.get(`${PROD_API_URL}/api/v1/drops/generate-name`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.name).toBeDefined();
    expect(data.name).toMatch(/^[a-z0-9-]+$/);
    expect(data.id).toBeDefined();
    expect(data.id).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should check drop availability using v1 API', async ({ request }) => {
    const response = await request.get(
      `${PROD_API_URL}/api/v1/drops/check/7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d`
    );
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.available).toBeDefined();
  });

  test('should create a public drop using v1 API', async ({ request }) => {
    const crypto = require('crypto');
    const dropName = `test-prod-create-${Date.now()}`;
    const dropId = crypto.createHash('sha256').update(dropName).digest('hex');
    const salt = Array.from(crypto.randomBytes(16))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');

    const contentPayload = { type: 'text', content: 'Production create test' };
    const payload = btoa(JSON.stringify(contentPayload));
    const adminHash = crypto
      .createHash('sha256')
      .update('test-admin-123' + salt)
      .digest('hex');

    const response = await request.post(`${PROD_API_URL}/api/v1/drops`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload,
        salt,
        mimeType: 'text/plain',
        adminHash,
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.version).toBe(1);
    expect(data.tier).toBe('free');

    // Verify API version header
    const apiVersion = response.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');
  });

  test('should fetch drop history using v1 API', async ({ request }) => {
    // First create a drop
    const crypto = require('crypto');
    const dropName = `test-prod-history-${Date.now()}`;
    const dropId = crypto.createHash('sha256').update(dropName).digest('hex');
    const salt = Array.from(crypto.randomBytes(16))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');

    const contentPayload = { type: 'text', content: 'Production history test' };
    const payload = btoa(JSON.stringify(contentPayload));
    const adminHash = crypto
      .createHash('sha256')
      .update('test-admin-123' + salt)
      .digest('hex');

    await request.post(`${PROD_API_URL}/api/v1/drops`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload,
        salt,
        mimeType: 'text/plain',
        adminHash,
      },
    });

    // Now fetch history
    const historyResponse = await request.get(`${PROD_API_URL}/api/v1/drops/${dropId}/history`);
    expect(historyResponse.ok()).toBe(true);

    const historyData = await historyResponse.json();
    expect(historyData.versions).toBeDefined();
    expect(historyData.versions.length).toBeGreaterThan(0);

    // Verify API version header
    const apiVersion = historyResponse.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');
  });

  test('old API routes should return 404', async ({ request }) => {
    const healthResponse = await request.get(`${PROD_API_URL}/api/health`);
    expect(healthResponse.status()).toBe(404);

    const generateResponse = await request.get(`${PROD_API_URL}/api/drops/generate-name`);
    expect(generateResponse.status()).toBe(404);
  });

  test('frontend should load and be accessible', async ({ page }) => {
    await page.goto(PROD_FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Check page title
    const title = await page.title();
    expect(title).toContain('dead-drop');

    // Check main page elements are present
    await expect(page.locator('body')).toBeVisible();
  });

  test('frontend should use v1 API for name generation', async ({ page }) => {
    // Monitor API requests
    const apiRequests: string[] = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
      }
      route.continue();
    });

    await page.goto(PROD_FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click generate button
    const generateBtn = page.locator('button[title="Generate random name"]').first();
    await generateBtn.click();
    await page.waitForTimeout(3000);

    // Check for v1 API requests
    const v1Requests = apiRequests.filter((url) => url.includes('/api/v1/'));
    expect(v1Requests.length).toBeGreaterThan(0);

    // Check no non-v1 requests
    const nonV1Requests = apiRequests.filter((url) => url.includes('/api/') && !url.includes('/api/v1/'));
    expect(nonV1Requests.length).toBe(0);
  });

  test('frontend full flow: generate, check, verify v1 API', async ({ page }) => {
    await page.goto(PROD_FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Monitor API requests
    const apiRequests: string[] = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
      }
      route.continue();
    });

    // Click generate button
    const generateBtn = page.locator('button[title="Generate random name"]').first();
    await generateBtn.click();
    await page.waitForTimeout(3000);

    // Get the generated name
    const createInput = page.locator('input[placeholder="enter-your-drop-name"]');
    const name = await createInput.inputValue();
    expect(name.length).toBeGreaterThan(10);

    // Verify we made v1 API requests
    const v1Requests = apiRequests.filter((url) => url.includes('/api/v1/'));
    expect(v1Requests.length).toBeGreaterThan(0);

    // Verify no non-v1 requests
    const nonV1Requests = apiRequests.filter((url) => url.includes('/api/') && !url.includes('/api/v1/'));
    expect(nonV1Requests.length).toBe(0);

    // Verify generate name endpoint was called
    const generateRequests = v1Requests.filter((url) => url.includes('/api/v1/drops/generate-name'));
    expect(generateRequests.length).toBeGreaterThan(0);
  });
});
