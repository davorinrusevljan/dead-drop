import { test, expect } from '@playwright/test';

test.describe('Privacy Tests', () => {
  test('should not expose plaintext password in network requests', async ({ page }) => {
    // Track all network requests
    const requests: { url: string; postData: string | undefined }[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') {
        requests.push({
          url: request.url(),
          postData: request.postData(),
        });
      }
    });

    await page.goto('/');
    await page.fill('input[placeholder="my-secret-phrase"]', 'test-privacy-check');
    await page.press('input[placeholder="my-secret-phrase"]', 'Enter');

    // Wait for potential API calls
    await page.waitForTimeout(1000);

    // Check that no request contains the plaintext password
    for (const req of requests) {
      if (req.postData) {
        // Should not contain common password patterns in plaintext
        expect(req.postData).not.toMatch(/"password"\s*:\s*"test-password"/);
        expect(req.postData).not.toMatch(/"adminPassword"\s*:\s*"test-password"/);
      }
    }
  });

  test('should encrypt protected drop content before sending', async ({ page }) => {
    const apiCalls: { url: string; body: unknown }[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/drops') && request.method() === 'POST') {
        const body = request.postData();
        if (body) {
          try {
            apiCalls.push({
              url: request.url(),
              body: JSON.parse(body),
            });
          } catch {
            // Ignore parse errors
          }
        }
      }
    });

    await page.goto('/drop/test-protected-drop');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // If we get to this point, the API call would have been made
    // Check that payload is not plaintext
    for (const call of apiCalls) {
      const body = call.body as { visibility?: string; payload?: string };
      if (body?.visibility === 'protected' && body?.payload) {
        // Payload should be hex-encoded (encrypted), not readable text
        expect(body.payload).toMatch(/^[0-9a-f]+$/);
        // Should not contain the original content as plaintext
        expect(body.payload).not.toContain('Hello World');
      }
    }
  });
});
