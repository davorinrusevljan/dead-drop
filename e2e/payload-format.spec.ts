import { test, expect } from '@playwright/test';
import { createHash } from 'crypto';

const API_URL = 'http://localhost:9090';
const BASE_URL = 'http://localhost:3010';

test.describe.configure({ mode: 'serial' });

test.describe('Public Drop Payload Format - Backward Compat + New Format', () => {
  test('new format: raw text payload displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/#new-format-public-drop`);
    await page.waitForTimeout(2000);

    // Should land on unlock state with PUBLIC tag
    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await expect(page.getByText('new-format-public-drop')).toBeVisible();

    // Check terms and click VIEW
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    // Content should display correctly
    const content = page.locator('.content-viewer');
    await expect(content).toBeVisible();
    await expect(content).toContainText('Hello World! This is a new format public drop.');
  });

  test('legacy base64+wrapper payload displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/#old-format-public-drop`);
    await page.waitForTimeout(2000);

    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await expect(page.getByText('old-format-public-drop')).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    const content = page.locator('.content-viewer');
    await expect(content).toBeVisible();
    await expect(content).toContainText('Hello from old format!');
  });

  test('legacy raw JSON wrapper payload displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/#raw-json-public-drop`);
    await page.waitForTimeout(2000);

    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await expect(page.getByText('raw-json-public-drop')).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    const content = page.locator('.content-viewer');
    await expect(content).toBeVisible();
    await expect(content).toContainText('This drop has raw JSON payload!');
  });

  test('create new public drop through UI uses raw text format', async ({ page }) => {
    const dropName = `e2e-new-format-${Date.now()}`;

    // Navigate to create page
    await page.goto(`${BASE_URL}/create/#${dropName}`);
    await page.waitForTimeout(1000);

    // Verify name loaded
    await expect(page.getByText(dropName)).toBeVisible();

    // Select PUBLIC visibility
    await page.getByRole('button', { name: /Public/ }).click();

    // Fill form
    await page.locator('input[placeholder="min 8 characters"]').fill('testpassword123');
    await page.locator('input[placeholder="repeat password"]').fill('testpassword123');
    await page.locator('textarea').fill('E2E test: raw text content!');

    // Agree to terms
    await page.locator('input[type="checkbox"]').check();

    // Submit
    await page.getByRole('button', { name: 'CREATE DROP' }).click();
    await page.waitForTimeout(2000);

    // Should show success
    await expect(page.getByText('DROP CREATED')).toBeVisible();

    // Verify the shareable URL format
    const urlDisplay = page.locator('.success-url');
    await expect(urlDisplay).toContainText(`#${dropName}`);

    // Now verify via API that payload is raw text (not base64, not JSON wrapper)
    const dropId = createHash('sha256').update(dropName).digest('hex');
    const apiResponse = await page.request.get(
      `${API_URL}/api/v1/drops/${dropId}?I_agree_with_terms_and_conditions=true`
    );
    expect(apiResponse.ok()).toBeTruthy();
    const dropData = await apiResponse.json();

    // New format: payload should be the raw text directly
    expect(dropData.payload).toBe('E2E test: raw text content!');
    // Should NOT contain JSON wrapper
    expect(dropData.payload).not.toContain('"type"');
    expect(dropData.payload).not.toContain('"content"');
  });

  test('view the newly created drop back on homepage (round-trip)', async ({ page }) => {
    await page.goto(`${BASE_URL}/#new-format-public-drop`);
    await page.waitForTimeout(2000);

    await expect(page.getByText('👁 PUBLIC')).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.content-viewer')).toContainText('Hello World!');
  });
});
