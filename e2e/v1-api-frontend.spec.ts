import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:9090/api/v1';

// Web Crypto helpers (works in both Node and browser)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function btoaNode(str: string): string {
  return btoa(str);
}

test.describe('Frontend E2E - v1 API Verification', () => {
  test.beforeEach(async ({ page, context }) => {
    // Monitor all API requests to verify they use v1
    const apiRequests: string[] = [];
    context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
      }
      route.continue();
    });

    // Store for verification
    (page as unknown as Record<string, string[]>).apiRequests = apiRequests;

    await page.goto('http://localhost:3010');
    // Wait for client-side hydration
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should generate a name using v1 API', async ({ page }) => {
    // Click the generate icon button (it's an SVG inside a button with title="Generate random name")
    const generateBtn = page.locator('button[title="Generate random name"]').first();
    await generateBtn.click();
    await page.waitForTimeout(2000);

    // Get the generated name from the create input
    const createInput = page.locator('input[placeholder="enter-your-drop-name"]');
    const name = await createInput.inputValue();

    expect(name.length).toBeGreaterThan(10);
    expect(name).toMatch(/^[a-z0-9-]+$/);

    // Check API requests
    const apiRequests = (page as unknown as Record<string, string[]>).apiRequests as string[];
    const generateRequest = apiRequests.find((url) => url.includes('/api/v1/drops/generate-name'));
    expect(generateRequest).toBeDefined();

    // Verify no non-v1 requests
    const nonV1Requests = apiRequests.filter(
      (url) => url.includes('/api/') && !url.includes('/api/v1/')
    );
    expect(nonV1Requests.length).toBe(0);
  });

  test('should check drop availability using v1 API', async ({ page }) => {
    // Enter a test name
    const createInput = page.locator('input[placeholder="enter-your-drop-name"]');
    await createInput.fill('test-drop-availability-check');
    await page.waitForTimeout(2000);

    // Check API requests
    const apiRequests = (page as unknown as Record<string, string[]>).apiRequests as string[];
    const checkRequest = apiRequests.find((url) => url.includes('/api/v1/drops/check'));
    expect(checkRequest).toBeDefined();
  });

  test('should create a public drop using v1 API', async ({ request }) => {
    const dropName = `test-create-${Date.now()}`;
    const dropId = await sha256(dropName);
    const salt = generateSalt();

    const contentPayload = { type: 'text', content: 'Create test content' };
    const payload = btoaNode(JSON.stringify(contentPayload));
    const adminHash = await sha256('test-admin-123' + salt);

    const response = await request.post(`${API_URL}/drops`, {
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
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.version).toBe(1);

    // Verify API version header
    const apiVersion = response.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');
  });

  test('API responses should include X-API-Version header', async ({ request }) => {
    const healthResponse = await request.get(`${API_URL}/health`);
    expect(healthResponse.ok()).toBe(true);
    const apiVersion = healthResponse.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');

    const dropsResponse = await request.get(`${API_URL}/drops/generate-name`);
    expect(dropsResponse.ok()).toBe(true);
    const dropsApiVersion = dropsResponse.headers()['x-api-version'];
    expect(dropsApiVersion).toBe('1.0.0');
  });

  test('old API routes should return 404', async ({ request }) => {
    const healthResponse = await request.get('http://localhost:9090/api/health');
    expect(healthResponse.status()).toBe(404);

    const generateResponse = await request.get('http://localhost:9090/api/drops/generate-name');
    expect(generateResponse.status()).toBe(404);
  });

  test('should fetch drop history using v1 API', async ({ request }) => {
    // First create a drop
    const dropName = `test-history-${Date.now()}`;
    const dropId = await sha256(dropName);
    const salt = generateSalt();

    const contentPayload = { type: 'text', content: 'History test content' };
    const payload = btoaNode(JSON.stringify(contentPayload));
    const adminHash = await sha256('test-admin-123' + salt);

    await request.post(`${API_URL}/drops`, {
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
        I_agree_with_terms_and_conditions: true,
      },
    });

    // Now fetch history via API
    const historyResponse = await request.get(
      `${API_URL}/drops/${dropId}/history?I_agree_with_terms_and_conditions=true`
    );
    expect(historyResponse.ok()).toBe(true);

    const historyData = await historyResponse.json();
    expect(historyData.versions).toBeDefined();
    expect(historyData.versions.length).toBeGreaterThan(0);

    // Verify API version header
    const apiVersion = historyResponse.headers()['x-api-version'];
    expect(apiVersion).toBe('1.0.0');
  });
});
