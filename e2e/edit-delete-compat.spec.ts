import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'crypto';

const API_URL = 'http://localhost:9090';
const BASE_URL = 'http://localhost:3010';

test.describe.configure({ mode: 'serial' });

/**
 * Helper to create a public drop via API
 */
async function createPublicDrop(
  name: string,
  content: string,
  password: string,
  format: 'old-base64' | 'old-json' | 'new'
) {
  const id = createHash('sha256').update(name).digest('hex');
  const salt = randomBytes(16).toString('hex');

  let payload: string;
  if (format === 'old-base64') {
    payload = Buffer.from(JSON.stringify({ type: 'text', content })).toString('base64');
  } else if (format === 'old-json') {
    payload = JSON.stringify({ type: 'text', content });
  } else {
    payload = content;
  }

  const adminHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');

  const response = await fetch(`${API_URL}/api/v1/drops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      nameLength: name.length,
      tier: 'free',
      visibility: 'public',
      payload,
      salt,
      mimeType: 'text/plain',
      adminHash,
      I_agree_with_terms_and_conditions: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(`Failed to create drop: ${JSON.stringify(data)}`);
  }
}

test.describe('Edit/Delete - Old Format (base64+wrapper)', () => {
  const dropName = `old-base64-edit-${Date.now()}`;

  test('create old-format drop', async () => {
    await createPublicDrop(dropName, 'Original base64 content', 'password123', 'old-base64');
  });

  test('view old-format drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.content-viewer')).toContainText('Original base64 content');
  });

  test('edit old-format drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('EDITING')).toBeVisible();

    await page.locator('#edit-content').fill('Edited from old base64!');
    await page.locator('#edit-pwd').fill('password123');
    await page.getByRole('button', { name: /SAVE/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.locator('.content-viewer')).toContainText('Edited from old base64!');
  });

  test('delete old-format drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /Delete/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('#delete-pwd').fill('password123');
    await page.getByRole('button', { name: /^DELETE$/i }).click();
    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/\//g, '\\/')}\\/?$`));
  });
});

test.describe('Edit/Delete - Old Format (raw JSON wrapper)', () => {
  const dropName = `old-json-edit-${Date.now()}`;

  test('create raw-JSON drop', async () => {
    await createPublicDrop(dropName, 'Original raw JSON content', 'password123', 'old-json');
  });

  test('view and edit raw-JSON drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.content-viewer')).toContainText('Original raw JSON content');

    // Edit
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('#edit-content').fill('Edited from raw JSON!');
    await page.locator('#edit-pwd').fill('password123');
    await page.getByRole('button', { name: /SAVE/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.locator('.content-viewer')).toContainText('Edited from raw JSON!');
  });
});

test.describe('Edit/Delete - New Format (raw text)', () => {
  const dropName = `new-format-edit-${Date.now()}`;

  test('create new-format drop', async () => {
    await createPublicDrop(dropName, 'New format content', 'password123', 'new');
  });

  test('view, edit, delete new-format drop', async ({ page }) => {
    // View
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.content-viewer')).toContainText('New format content');

    // Edit
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('#edit-content').fill('Updated new format!');
    await page.locator('#edit-pwd').fill('password123');
    await page.getByRole('button', { name: /SAVE/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('.content-viewer')).toContainText('Updated new format!');

    // Delete
    await page.getByRole('button', { name: /Delete/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('#delete-pwd').fill('password123');
    await page.getByRole('button', { name: /^DELETE$/i }).click();
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/\//g, '\\/')}\\/?$`));
  });
});
