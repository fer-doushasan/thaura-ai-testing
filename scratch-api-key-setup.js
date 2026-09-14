const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/api-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Open account menu -> Settings -> API
  await page.locator('text=Qa Test').first().click();
  await page.waitForTimeout(500);
  await page.locator('text=API').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/01-api-settings.png`, fullPage: true });

  const bodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/api-settings-bodytext.txt`, bodyText);
  console.log('API settings page text (first 1000 chars):', bodyText.slice(0, 1000));

  await browser.close();
})();
