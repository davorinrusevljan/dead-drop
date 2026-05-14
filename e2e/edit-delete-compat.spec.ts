import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'crypto';

const API_URL = 'http://localhost:9090';
const BASE_URL = 'http://localhost:3010';

test.describe.configure({ mode: 'serial' });

/**
 * Helper to create a public drop via API
 */
async function createPublicDrop(name: string, content: string, password: string) {
  const id = createHash('sha256').update(name).digest('hex');
  const salt = randomBytes(16).toString('hex');
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
      payload: content,
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

test.describe('Public Drop - View, Edit, Delete', () => {
  const dropName = `e2e-ved-${Date.now()}`;

  test('create drop', async () => {
    await createPublicDrop(dropName, 'Original content', 'password123');
  });

  test('view drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText('👁 PUBLIC')).toBeVisible();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.content-viewer')).toContainText('Original content');
  });

  test('edit drop', async ({ page }) => {
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForTimeout(2000);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('EDITING')).toBeVisible();

    await page.locator('#edit-content').fill('Edited content!');
    await page.locator('#edit-pwd').fill('password123');
    await page.getByRole('button', { name: /SAVE/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.locator('.content-viewer')).toContainText('Edited content!');
  });

  test('delete drop', async ({ page }) => {
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
