import { test, expect, type Page, type BrowserContext } from '@playwright/test';

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

// Track browser-originated /api/** calls for v1 verification.
// Scoped to /api/** — intercepting every asset (**/*) only adds latency.
async function trackApiRequests(context: BrowserContext): Promise<string[]> {
  const apiRequests: string[] = [];
  await context.route('**/api/**', (route) => {
    apiRequests.push(route.request().url());
    return route.continue();
  });
  return apiRequests;
}

// Load the landing page and wait until it is truly interactive.
//
// The create input auto-fills only after React hydration + health check +
// generate-name have all completed (API path or local fallback), so a
// non-empty value is a deterministic readiness signal — unlike
// networkidle + fixed sleeps, which race hydration in `next dev`.
async function openLanding(page: Page) {
  await page.goto('/');
  const createInput = page.locator('input[placeholder="enter-your-drop-name"]');
  await expect(createInput).not.toHaveValue('', { timeout: 20_000 });
  const generateBtn = page.locator('button[title="Generate random name"]').first();
  return { createInput, generateBtn };
}

test.describe('Frontend E2E - v1 API Verification', () => {
  test('should generate a name using v1 API', async ({ page, context }) => {
    const apiRequests = await trackApiRequests(context);
    const { createInput, generateBtn } = await openLanding(page);

    // Retry the click until the input value actually changes: a click that
    // lands pre-hydration is a silent no-op, and the fetch inside the click
    // handler can be slow in dev mode. No fixed sleeps.
    await expect(async () => {
      const before = await createInput.inputValue();
      await generateBtn.click();
      await expect
        .poll(async () => (await createInput.inputValue()) !== before, { timeout: 5_000 })
        .toBe(true);
    }).toPass({ timeout: 20_000 });

    const name = await createInput.inputValue();

    expect(name.length).toBeGreaterThan(10);
    expect(name).toMatch(/^[a-z0-9-]+$/);

    // Check API requests
    const generateRequest = apiRequests.find((url) => url.includes('/api/v1/drops/generate-name'));
    expect(generateRequest).toBeDefined();

    // Verify no non-v1 requests
    const nonV1Requests = apiRequests.filter(
      (url) => url.includes('/api/') && !url.includes('/api/v1/')
    );
    expect(nonV1Requests.length).toBe(0);
  });

  test('should check drop availability using v1 API', async ({ page, context }) => {
    const apiRequests = await trackApiRequests(context);
    const { createInput } = await openLanding(page);

    // Availability check fires from a 300ms debounce after the input
    // changes, and the route handler's push lands asynchronously after the
    // request event — poll the intercepted-request log instead of sleeping
    // or racing waitForRequest against the handler.
    await createInput.fill('test-drop-availability-check');
    await expect
      .poll(() => apiRequests.find((url) => url.includes('/api/v1/drops/check')), {
        timeout: 10_000,
      })
      .toBeDefined();
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
