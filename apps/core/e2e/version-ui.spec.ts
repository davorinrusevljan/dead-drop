import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const API_URL = process.env.API_URL || 'http://localhost:9090';

test.describe('Drop Version UI E2E', () => {
  test('create public drop and see version history', async ({ page }) => {
    // Create a public drop via API (no encryption required)
    const genResponse = await fetch(`${API_URL}/api/drops/generate-name`);
    const gen = (await genResponse.json()) as { name: string; id: string };
    const dropName = gen.name;
    const dropId = gen.id;
    const password = 'testpassword123';

    const { computePublicAdminHash, generateSalt } = await import('@dead-drop/engine');
    const salt = generateSalt();
    const adminHash = await computePublicAdminHash(password, salt);

    await fetch(`${API_URL}/api/drops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload: btoa(JSON.stringify({ type: 'text', content: 'Version 1 content' })),
        salt,
        adminHash,
        mimeType: 'text/plain',
      }),
    });

    // Navigate to drop
    await page.goto(`${BASE_URL}/#/${dropName}`);
    await page.waitForLoadState('networkidle');

    // Agree to terms and view
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'VIEW' }).click();

    // Wait for view state
    await page.waitForTimeout(2000);

    // Version section should be visible
    await expect(page.getByText('1 version available')).toBeVisible();

    // Expand version list
    await page.getByText('1 version available').click();
    await page.waitForTimeout(500);

    // Should show Version 1 button
    await expect(page.getByRole('button', { name: /Version 1/ })).toBeVisible();
    // Should also show "(current)" marker
    await expect(page.getByText('(current)')).toBeVisible();
  });

  test('create drop with multiple versions', async ({ page }) => {
    // Create a public drop with 2 versions
    const genResponse = await fetch(`${API_URL}/api/drops/generate-name`);
    const gen = (await genResponse.json()) as { name: string; id: string };
    const dropName = gen.name;
    const dropId = gen.id;
    const password = 'testpassword123';

    const { computePublicAdminHash, generateSalt } = await import('@dead-drop/engine');
    const salt = generateSalt();
    const adminHash = await computePublicAdminHash(password, salt);

    // Version 1
    await fetch(`${API_URL}/api/drops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload: btoa(JSON.stringify({ type: 'text', content: 'First version content' })),
        salt,
        adminHash,
        mimeType: 'text/plain',
      }),
    });

    // Version 2 - update via API
    const updateResponse = await fetch(`${API_URL}/api/drops/${dropId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: btoa(JSON.stringify({ type: 'text', content: 'Second version content' })),
        adminPassword: password,
      }),
    });

    // Check if update succeeded
    expect(updateResponse.ok).toBe(true);

    // Navigate and view
    await page.goto(`${BASE_URL}/#/${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(2000);

    // Should show 2 versions
    await expect(page.getByText('2 versions available')).toBeVisible();

    // Expand version list
    await page.locator('button:has-text("2 versions available")').click();
    await page.waitForTimeout(500);

    // Should show both version buttons
    await expect(page.getByRole('button', { name: /Version 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Version 2/ })).toBeVisible();
  });

  test('click version to view historical content in popup', async ({ page }) => {
    // Create a public drop with 2 versions
    const genResponse = await fetch(`${API_URL}/api/drops/generate-name`);
    const gen = (await genResponse.json()) as { name: string; id: string };
    const dropName = gen.name;
    const dropId = gen.id;
    const password = 'testpassword123';

    const { computePublicAdminHash, generateSalt } = await import('@dead-drop/engine');
    const salt = generateSalt();
    const adminHash = await computePublicAdminHash(password, salt);

    // Version 1
    await fetch(`${API_URL}/api/drops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dropId,
        nameLength: dropName.length,
        tier: 'free',
        visibility: 'public',
        payload: btoa(
          JSON.stringify({ type: 'text', content: 'First version - original content' })
        ),
        salt,
        adminHash,
        mimeType: 'text/plain',
      }),
    });

    // Version 2 - update via API
    await fetch(`${API_URL}/api/drops/${dropId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: btoa(
          JSON.stringify({ type: 'text', content: 'Second version - updated content' })
        ),
        adminPassword: password,
      }),
    });

    // Navigate and view
    await page.goto(`${BASE_URL}/#/${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'VIEW' }).click();
    await page.waitForTimeout(2000);

    // Should show 2 versions
    await expect(page.getByText('2 versions available')).toBeVisible();

    // Expand version list
    await page.locator('button:has-text("2 versions available")').click();
    await page.waitForTimeout(500);

    // Click Version 1
    await page.getByRole('button', { name: /Version 1/ }).click();
    await page.waitForTimeout(500);

    // Popup should show Version 1 content
    await expect(page.getByText('First version - original content')).toBeVisible();
    // Use .nth(1) to get the Copy button in the popup (not the one in main view)
    await expect(page.getByRole('button', { name: 'Copy' }).nth(1)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

    // Close popup
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(500);

    // Popup should be gone
    await expect(page.getByText('First version - original content')).not.toBeVisible();

    // Current view should show Version 2 content
    await expect(page.getByText('Second version - updated content')).toBeVisible();
  });
});
