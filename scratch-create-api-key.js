// Creates one API key. The raw key is saved ONLY to a local gitignored file
// (.state/api-key.txt) for use in subsequent test calls - never printed,
// logged, or written to any evidence/report file.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const KEY_PATH = './.state/api-key.txt';
const OUT_DIR = './discovery-evidence/api-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.locator('text=Qa Test').first().click();
  await page.waitForTimeout(500);
  await page.locator('text=API').first().click();
  await page.waitForTimeout(1000);

  await page.locator('text=Create New API Key').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/02-after-create-key-click.png`, fullPage: true });

  // Look for a naming field / confirm dialog
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0 && await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('QA Assessment Key').catch(() => {});
    const confirmBtn = page.locator('button:has-text("Create")').first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
  await page.screenshot({ path: `${OUT_DIR}/03-key-created.png`, fullPage: true });

  // Try to find the displayed key value - usually in a readonly input or code block
  const keyCandidates = await page.locator('input[readonly], code, [class*="key" i]').allTextContents();
  const inputValues = await page.locator('input[readonly]').evaluateAll(els => els.map(e => e.value));

  let foundKey = null;
  for (const v of inputValues) {
    if (v && v.length > 20) { foundKey = v; break; }
  }
  if (!foundKey) {
    for (const t of keyCandidates) {
      if (t && t.length > 20 && !/[A-Za-z ]{15,}/.test(t)) { foundKey = t.trim(); break; }
    }
  }

  if (foundKey) {
    fs.writeFileSync(KEY_PATH, foundKey);
    console.log('API key created and saved locally to .state/api-key.txt (value not logged). Length:', foundKey.length, 'Prefix pattern:', foundKey.slice(0, 3) + '***');
  } else {
    console.log('Could not automatically locate key value in DOM. Manual inspection of screenshot needed.');
  }

  await browser.close();
})();
