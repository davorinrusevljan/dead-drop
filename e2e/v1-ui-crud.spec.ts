import { test, expect } from '@playwright/test';

const PROD_FRONTEND_URL = 'http://localhost:3010';

test.describe('UI E2E - Full CRUD on Production', () => {
  test('public drop: create, view, edit, delete', async ({ page }) => {
    // Generate a unique name
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const dropName = `pub-${timestamp}-${random}`;
    const content = `Public UI test ${Date.now()}`;

    console.log('Creating public drop:', dropName);

    // CREATE: Navigate to create page
    await page.goto(`https://dead-drop.xyz/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check availability
    const availableTag = page.locator('.tag:has-text("AVAILABLE")');
    await expect(availableTag).toBeVisible({ timeout: 5000 });

    // Fill form
    await page.fill('textarea', content);
    await page.click('button:has-text("Public")');
    await page.fill('input[placeholder="min 8 characters"]', 'test-admin-123');
    await page.fill('input[placeholder*="repeat password"]', 'test-admin-123');
    await page.check('input[type="checkbox"]');

    // Create the drop
    const createBtn = page.locator('button').filter({ hasText: /CREATE DROP/i }).first();
    await createBtn.click();
    await page.waitForTimeout(3000);

    // Verify creation
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('DROP CREATED');
    console.log('✓ Public drop created');

    // VIEW: Navigate to drop page
    await page.goto(`https://dead-drop.xyz/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to TOS for viewing
    const viewTermsCheckbox = page.locator('input[type="checkbox"]').first();
    await viewTermsCheckbox.check();
    await page.waitForTimeout(500);

    // Click VIEW button
    const viewBtn = page.locator('button').filter({ hasText: /VIEW/i }).first();
    await viewBtn.click();
    await page.waitForTimeout(3000);

    // Verify content is visible
    const viewBodyText = await page.locator('body').textContent();
    expect(viewBodyText).toContain('Public UI test');
    console.log('✓ Public drop viewed');

    // EDIT: Update the drop
    const editBtn = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editBtn.isVisible({ timeout: 5000 })) {
      await editBtn.click();
      await page.waitForTimeout(2000);

      // Enter admin password
      const passwordInput = page.locator('input[placeholder*="admin password"]');
      if (await passwordInput.isVisible({ timeout: 3000 })) {
        await passwordInput.fill('test-admin-123');
        const submitBtn = page.locator('button').filter({ hasText: /Submit|Unlock/i }).first();
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }

      // Update content
      const newTextarea = page.locator('textarea').first();
      await newTextarea.fill(`Updated public content ${Date.now()}`);

      // Save
      const saveBtn = page.locator('button').filter({ hasText: /Save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(3000);

      // Verify update
      const updatedBodyText = await page.locator('body').textContent();
      expect(updatedBodyText).toContain('Updated public');
      console.log('✓ Public drop edited');
    }

    // DELETE: Delete the drop
    await page.goto(`https://dead-drop.xyz/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Agree to TOS for viewing first
    const deleteViewCheckbox = page.locator('input[type="checkbox"]').first();
    await deleteViewCheckbox.check();
    await page.waitForTimeout(500);

    const deleteViewBtn = page.locator('button').filter({ hasText: /VIEW/i }).first();
    await deleteViewBtn.click();
    await page.waitForTimeout(3000);

    const deleteBtn = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 })) {
      await deleteBtn.click();
      await page.waitForTimeout(2000);

      // Confirm delete
      const confirmBtn = page.locator('button').filter({ hasText: /Delete|Confirm/i }).nth(1);
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Verify deleted
    const deletedBodyText = await page.locator('body').textContent();
    expect(deletedBodyText).toContain('not found');
    console.log('✓ Public drop deleted');
  });

  test('private drop: create, view, edit, delete', async ({ page }) => {
    // Generate a unique name
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const dropName = `priv-${timestamp}-${random}`;
    const passPhrase = 'test-secure-phrase-123456';
    const content = `Private UI test ${Date.now()}`;

    console.log('Creating private drop:', dropName);

    // CREATE: Navigate to create page
    await page.goto(`https://dead-drop.xyz/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check availability
    const availableTag = page.locator('.tag:has-text("AVAILABLE")');
    await expect(availableTag).toBeVisible({ timeout: 5000 });

    // Fill form
    await page.fill('textarea', content);
    await page.click('button:has-text("Private")');
    await page.fill('input[placeholder="min 8 characters"]', passPhrase);
    await page.fill('input[placeholder*="repeat password"]', passPhrase);
    await page.check('input[type="checkbox"]');

    // Create the drop
    const createBtn = page.locator('button').filter({ hasText: /CREATE DROP/i }).first();
    await createBtn.click();
    await page.waitForTimeout(3000);

    // Verify creation
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('DROP CREATED');
    console.log('✓ Private drop created');

    // VIEW: Navigate to drop page and unlock
    await page.goto(`https://dead-drop.xyz/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to TOS for viewing
    const viewTermsCheckbox = page.locator('input[type="checkbox"]').first();
    await viewTermsCheckbox.check();
    await page.waitForTimeout(500);

    // Enter pass phrase and unlock
    const unlockInput = page.locator('input[placeholder="enter password"]');
    await expect(unlockInput).toBeVisible({ timeout: 5000 });
    await unlockInput.fill(passPhrase);

    const unlockBtn = page.locator('button').filter({ hasText: /UNLOCK/i }).first();
    await unlockBtn.click();
    await page.waitForTimeout(3000);

    // Verify content is visible
    const viewBodyText = await page.locator('body').textContent();
    expect(viewBodyText).toContain('Private UI test');
    console.log('✓ Private drop viewed and unlocked');

    // EDIT: Update the drop
    const editBtn = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editBtn.isVisible({ timeout: 5000 })) {
      await editBtn.click();
      await page.waitForTimeout(2000);

      // Update content
      const textarea = page.locator('textarea').first();
      await textarea.fill(`Updated private content ${Date.now()}`);

      // Enter pass phrase
      const phraseInput = page.locator('input[placeholder="enter password"]');
      if (await phraseInput.isVisible({ timeout: 2000 })) {
        await phraseInput.fill(passPhrase);
      }

      // Save
      const saveBtn = page.locator('button').filter({ hasText: /Save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(3000);

      // Verify update
      const updatedBodyText = await page.locator('body').textContent();
      expect(updatedBodyText).toContain('Updated private');
      console.log('✓ Private drop edited');
    }

    // DELETE: Delete the drop
    await page.goto(`https://dead-drop.xyz/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Agree to TOS for viewing
    const deleteViewCheckbox = page.locator('input[type="checkbox"]').first();
    await deleteViewCheckbox.check();
    await page.waitForTimeout(500);

    const deleteViewBtn = page.locator('button').filter({ hasText: /UNLOCK/i }).first();
    await deleteViewBtn.click();
    await page.waitForTimeout(3000);

    const deleteBtn = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 })) {
      await deleteBtn.click();
      await page.waitForTimeout(2000);

      // Confirm delete
      const confirmBtn = page.locator('button').filter({ hasText: /Delete|Confirm/i }).nth(1);
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Verify deleted
    const deletedBodyText = await page.locator('body').textContent();
    expect(deletedBodyText).toContain('not found');
    console.log('✓ Private drop deleted');
  });
});
