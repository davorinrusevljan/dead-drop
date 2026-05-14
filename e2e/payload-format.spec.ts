import { test, expect } from '@playwright/test';
import { createHash } from 'crypto';

const API_URL = 'http://localhost:9090';
const BASE_URL = 'http://localhost:3010';

test.describe('Public Drop Payload Format', () => {
  test('create public drop through UI uses raw text format', async ({ page }) => {
    const dropName = `e2e-raw-text-${Date.now()}`;

    await page.goto(`${BASE_URL}/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.getByText(dropName)).toBeVisible();

    await page.getByRole('button', { name: /Public/ }).click();
    await page.locator('input[placeholder="min 8 characters"]').fill('testpassword123');
    await page.locator('input[placeholder="repeat password"]').fill('testpassword123');
    await page.locator('textarea').fill('E2E test: raw text content!');

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'CREATE DROP' }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByText('DROP CREATED')).toBeVisible();

    // Verify via API that payload is raw text (no wrapper, no base64)
    const dropId = createHash('sha256').update(dropName).digest('hex');
    const apiResponse = await page.request.get(
      `${API_URL}/api/v1/drops/${dropId}?I_agree_with_terms_and_conditions=true`
    );
    expect(apiResponse.ok()).toBeTruthy();
    const dropData = await apiResponse.json();

    expect(dropData.payload).toBe('E2E test: raw text content!');
    expect(dropData.payload).not.toContain('"type"');
    expect(dropData.payload).not.toContain('"content"');
  });

  test('view the created drop on homepage', async ({ page }) => {
    // Use the drop created by the previous test — navigate via hash
    // Since tests run in parallel, create our own
    const dropName = `e2e-view-${Date.now()}`;
    const dropId = createHash('sha256').update(dropName).digest('hex');
    const salt = 'testsaltview123';
    const adminHash = createHash('sha256')
      .update('password123' + salt)
      .digest('hex');

    // Create via API
    await fetch(`${API_URL}/api/v1/drops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload: 'Hello from API!',
        salt,
        mimeType: 'text/plain',
        adminHash,
        I_agree_with_terms_and_conditions: true,
      }),
    });

    // View via UI
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);

    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.content-viewer')).toContainText('Hello from API!');
  });
});
