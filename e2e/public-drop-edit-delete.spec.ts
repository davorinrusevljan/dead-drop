import { test, expect } from '@playwright/test';

// Run tests serially to avoid shared state
test.describe.configure({ mode: 'serial' });

test.describe('Public Drop Edit/Delete UI', () => {
  const dropName = `test-public-edit-del-${Date.now()}`;
  const password = 'edit-delete-test-123';
  const originalContent = 'Original content for edit test';
  const updatedContent = 'Updated content after edit';

  test('should create a public drop', async ({ page }) => {
    // Navigate to create page
    await page.goto(`http://localhost:3010/create/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Switch to Public visibility
    await page.click('button:has-text("Public")');
    await page.waitForTimeout(500);

    // Fill in password
    const passwordInput = page.locator('input[placeholder="min 8 characters"]').first();
    await passwordInput.fill(password);

    // Confirm password
    const confirmPasswordInput = page.locator('input[placeholder="repeat password"]');
    await confirmPasswordInput.fill(password);

    // Fill in content
    const contentTextarea = page.locator('textarea[placeholder*="secret message"]');
    await contentTextarea.fill(originalContent);

    // Check terms
    await page.locator('input[type="checkbox"]').check();

    // Create drop
    await page.click('button:has-text("CREATE DROP")');
    await page.waitForTimeout(3000);

    // Verify success
    await expect(page.locator('text=DROP CREATED')).toBeVisible();
  });

  test('should view the created public drop', async ({ page }) => {
    // Navigate to view page
    await page.goto(`http://localhost:3010/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to terms
    await page.locator('input[type="checkbox"]').check();
    await page.waitForTimeout(500);

    // Click VIEW
    await page.click('button:has-text("VIEW")');
    await page.waitForTimeout(2000);

    // Verify content is visible
    await expect(page.locator(`text=${originalContent}`)).toBeVisible();
  });

  test('should edit the public drop with correct password', async ({ page }) => {
    // Navigate to view page
    await page.goto(`http://localhost:3010/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to terms and view
    await page.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("VIEW")');
    await page.waitForTimeout(2000);

    // Click Edit button
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(1000);

    // Fill in admin password (for public drops, editing requires password)
    const adminPasswordInput = page.locator('input#edit-pwd');
    await adminPasswordInput.fill(password);

    // Update content
    const contentTextarea = page.locator('textarea#edit-content');
    await contentTextarea.fill(updatedContent);

    // Save
    await page.click('button:has-text("SAVE")');
    await page.waitForTimeout(3000);

    // Verify success - should be back in view mode with updated content
    const contentVisible = await page.locator(`text=${updatedContent}`).isVisible().catch(() => false);

    if (!contentVisible) {
      // Check if there's an error
      const bodyText = await page.locator('body').textContent();
    }

    expect(contentVisible).toBe(true);
  });

  test('should fail to edit with wrong password', async ({ page }) => {
    // Navigate to view page
    await page.goto(`http://localhost:3010/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to terms and view
    await page.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("VIEW")');
    await page.waitForTimeout(2000);

    // Click Edit button
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(1000);

    // Fill in WRONG password
    const adminPasswordInput = page.locator('input#edit-pwd');
    await adminPasswordInput.fill('wrong-password');

    // Update content
    const contentTextarea = page.locator('textarea#edit-content');
    await contentTextarea.fill('This should not be saved');

    // Save
    await page.click('button:has-text("SAVE")');
    await page.waitForTimeout(2000);

    // Should see error message
    const errorVisible = await page.locator('text=Invalid password').isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('should delete the public drop with correct password', async ({ page }) => {
    // Navigate to view page
    await page.goto(`http://localhost:3010/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Agree to terms and view
    await page.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("VIEW")');
    await page.waitForTimeout(2000);

    // Click Delete button
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(1000);

    // Fill in admin password
    const deletePasswordInput = page.locator('input#delete-pwd');
    await deletePasswordInput.fill(password);

    // Confirm delete
    await page.click('button:has-text("DELETE")');
    await page.waitForTimeout(3000);

    // Should be redirected to home page
    const currentUrl = page.url();
    expect(currentUrl).toBe('http://localhost:3010/');

    // Verify the drop no longer exists by checking that the name is available
    // Enter the drop name in the create lane to check availability
    await page.goto(`http://localhost:3010/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Enter the drop name in create lane
    const createInput = page.locator('input[placeholder="enter-your-drop-name"]');
    await createInput.fill(dropName);
    await page.waitForTimeout(1500);

    // Should show "Name available" (meaning the drop was deleted)
    const availableVisible = await page.locator('text=Name available').isVisible().catch(() => false);

    expect(availableVisible).toBe(true);
  });
});
