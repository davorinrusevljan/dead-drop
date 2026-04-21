const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
  });
  const page = await context.newPage();
  await page.goto('https://dead-drop.xyz/');
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();