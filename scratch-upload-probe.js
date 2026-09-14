const { chromium } = require('playwright');
const path = require('path');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';
const fs = require('fs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Click the "+" attach button
  const plusBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(0);
  // Try more targeted: the plus button near composer
  const attachBtn = page.locator('[aria-label*="attach" i], button:has-text("+")').first();
  console.log('attachBtn count:', await attachBtn.count());

  // Look for a file input directly (often present even if hidden)
  const fileInput = page.locator('input[type="file"]');
  console.log('file input count (before click):', await fileInput.count());

  if (await attachBtn.count() > 0) {
    await attachBtn.click();
    await page.waitForTimeout(800);
  }
  console.log('file input count (after click):', await fileInput.count());
  await page.screenshot({ path: `${OUT_DIR}/probe-after-attach-click.png`, fullPage: true });

  if (await fileInput.count() > 0) {
    await fileInput.first().setInputFiles(path.resolve('./test-data/valid/sample.pdf'));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT_DIR}/probe-after-file-set.png`, fullPage: true });
    console.log('File set on input successfully.');
  } else {
    console.log('No file input found - need alternate approach.');
  }

  await browser.close();
})();
