import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3010';

test.describe('UI E2E - Full CRUD (Local)', () => {
  test.setTimeout(90000);

  test('public drop: create, view, edit, delete', async ({ page }) => {
    const dropName = `pub-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const content = `Public UI test ${Date.now()}`;
    const adminPwd = 'test-admin-123';

    // CREATE
    await page.goto(`${BASE_URL}/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const availableTag = page.locator('.tag:has-text("AVAILABLE")');
    await expect(availableTag).toBeVisible({ timeout: 5000 });

    await page.fill('textarea', content);
    await page.click('button:has-text("Public")');
    await page.fill('input[placeholder="min 8 characters"]', adminPwd);
    await page.fill('input[placeholder*="repeat password"]', adminPwd);
    await page.check('input[type="checkbox"]');

    await page
      .locator('button')
      .filter({ hasText: /CREATE DROP/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('DROP CREATED');

    // VIEW
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /VIEW/i }).first().click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('Public UI test');

    // EDIT
    await page.locator('button').filter({ hasText: /Edit/i }).first().click();
    await page.waitForTimeout(2000);

    await page.locator('input#edit-pwd').fill(adminPwd);
    await page.locator('textarea#edit-content').fill(`Updated public content ${Date.now()}`);
    await page.locator('button').filter({ hasText: /SAVE/i }).first().click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('Updated public');

    // DELETE - reload to reset client state
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /VIEW/i }).first().click();
    await page.waitForTimeout(3000);

    await page
      .locator('button')
      .filter({ hasText: /Delete/i })
      .first()
      .click();
    await page.waitForTimeout(2000);
    await page.locator('input#delete-pwd').fill(adminPwd);
    await page.waitForTimeout(500);
    await page
      .locator('button')
      .filter({ hasText: /^DELETE$/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/\//g, '\\/')}\\/?$`));
  });

  test('private drop: create, view, edit, delete', async ({ page }) => {
    const dropName = `priv-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const passPhrase = 'test-secure-phrase-123456';
    const content = `Private UI test ${Date.now()}`;

    // CREATE
    await page.goto(`${BASE_URL}/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const availableTag = page.locator('.tag:has-text("AVAILABLE")');
    await expect(availableTag).toBeVisible({ timeout: 5000 });

    await page.fill('textarea', content);
    await page.click('button:has-text("Private")');
    await page.fill('input[placeholder="min 8 characters"]', passPhrase);
    await page.fill('input[placeholder*="repeat password"]', passPhrase);
    await page.check('input[type="checkbox"]');

    await page
      .locator('button')
      .filter({ hasText: /CREATE DROP/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('DROP CREATED');

    // VIEW + UNLOCK
    await page.goto(`${BASE_URL}/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    const unlockInput = page.locator('input[placeholder="enter password"]');
    await expect(unlockInput).toBeVisible({ timeout: 5000 });
    await unlockInput.fill(passPhrase);
    await page
      .locator('button')
      .filter({ hasText: /UNLOCK/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('Private UI test');

    // EDIT
    await page.locator('button').filter({ hasText: /Edit/i }).first().click();
    await page.waitForTimeout(2000);

    await page.locator('textarea#edit-content').fill(`Updated private content ${Date.now()}`);

    const phraseInput = page.locator('input[placeholder="enter password"]');
    if (await phraseInput.isVisible({ timeout: 2000 })) {
      await phraseInput.fill(passPhrase);
    }

    await page.locator('button').filter({ hasText: /SAVE/i }).first().click();
    await page.waitForTimeout(3000);

    expect(await page.locator('body').textContent()).toContain('Updated private');

    // DELETE - reload to reset client state
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    const deleteUnlockInput = page.locator('input[placeholder="enter password"]');
    await expect(deleteUnlockInput).toBeVisible({ timeout: 5000 });
    await deleteUnlockInput.fill(passPhrase);
    await page
      .locator('button')
      .filter({ hasText: /UNLOCK/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    await page
      .locator('button')
      .filter({ hasText: /Delete/i })
      .first()
      .click();
    await page.waitForTimeout(2000);

    const deletePwdInput = page.locator('input#delete-pwd');
    if (await deletePwdInput.isVisible({ timeout: 2000 })) {
      await deletePwdInput.fill(passPhrase);
    }

    await page
      .locator('button')
      .filter({ hasText: /^DELETE$/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/\//g, '\\/')}\\/?$`));
  });
});
