import { test, expect } from '@playwright/test';

test.describe('Public Drop UI - Full Flow', () => {
  test('should create a public drop through the UI', async ({ page }) => {
    // Generate a unique drop name
    const dropName = `test-public-ui-${Date.now()}`;

    // Navigate directly to create page with the drop name in the hash
    await page.goto(`http://localhost:3010/create/#${dropName}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: 'test-homepage-initial.png' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of create page
    await page.screenshot({ path: 'test-create-page.png' });

    // Switch to Public visibility
    await page.click('button:has-text("Public")');
    await page.waitForTimeout(500);

    // Fill in password
    const password = 'test-password-123';
    const passwordInput = page.locator('input[placeholder="min 8 characters"]').first();
    await passwordInput.fill(password);

    // Confirm password
    const confirmPasswordInput = page.locator('input[placeholder="repeat password"]');
    await confirmPasswordInput.fill(password);

    // Fill in content
    const content = 'This is a test public drop created via Playwright';
    const contentTextarea = page.locator('textarea[placeholder*="secret message"]');
    await contentTextarea.fill(content);

    // Check the terms checkbox
    const termsCheckbox = page.locator('input[type="checkbox"]');
    await termsCheckbox.check();

    // Take screenshot before submitting
    await page.screenshot({ path: 'test-before-submit.png' });

    // Click Create button
    await page.click('button:has-text("CREATE DROP")');
    await page.waitForTimeout(3000);

    // Take screenshot of result
    await page.screenshot({ path: 'test-result.png' });

    // Check if success message appears
    const successElement = page.locator('text=DROP CREATED');
    const isVisible = await successElement.isVisible().catch(() => false);

    if (!isVisible) {
      // Check for error message
      const bodyText = await page.locator('body').textContent();

      // Try to find any error message
      const errorElements = page.locator('.error-message, p:has-text("error"), p:has-text("Error")');
      const errorCount = await errorElements.count();

      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
      }

      throw new Error('Drop creation failed - see screenshots for details');
    }

    // Verify success
    await expect(successElement).toBeVisible();

    // Now try to view the drop to verify it was created
    await page.goto(`http://localhost:3010/#${dropName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // For public drops, still need to agree to terms and click VIEW
    // Check if there's a VIEW button
    const viewButton = page.locator('button:has-text("VIEW")');
    const hasViewButton = await viewButton.isVisible().catch(() => false);

    if (hasViewButton) {
      // Agree to terms checkbox
      const termsCheckbox = page.locator('input[type="checkbox"]');
      await termsCheckbox.check();
      await page.waitForTimeout(500);

      // Click VIEW button
      await viewButton.click();
      await page.waitForTimeout(2000);
    }

    // Should see the content (public drop can be viewed without password)
    const contentVisible = await page.locator(`text=${content}`).isVisible().catch(() => false);

    if (!contentVisible) {
      const bodyText = await page.locator('body').textContent();
    }

    expect(contentVisible).toBe(true);
  });
});
