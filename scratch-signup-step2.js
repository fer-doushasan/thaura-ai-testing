// Step 2: continue past email -> name -> observe the next step (password/OTP/etc).
// Does NOT submit a password or finalize the account.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence';
const TEST_EMAIL = process.argv[2];
const TEST_NAME = process.argv[3] || 'QA Test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const requests = [];
  page.on('request', (req) => {
    if (req.url().includes('backend.thaura.ai')) {
      requests.push({ method: req.method(), url: req.url(), postData: req.postData() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai')) {
      const entry = requests.slice().reverse().find(r => r.url === res.request().url() && !r.status);
      if (entry) {
        entry.status = res.status();
        try { entry.body = await res.text(); } catch (e) {}
      }
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(TEST_EMAIL);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  // Name step
  await page.locator('input[placeholder*="name" i]').first().fill(TEST_NAME);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${OUT_DIR}/05-after-name.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  fs.writeFileSync(`${OUT_DIR}/after-name-bodytext.txt`, bodyText);

  const inputs = await page.$$eval('input', (els) =>
    els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, autocomplete: e.autocomplete }))
  );
  fs.writeFileSync(`${OUT_DIR}/after-name-inputs.json`, JSON.stringify(inputs, null, 2));
  console.log('Inputs after name step:', JSON.stringify(inputs));

  fs.writeFileSync(`${OUT_DIR}/signup-step2-requests.json`, JSON.stringify(requests, null, 2));
  console.log('Backend requests:', requests.map(r => `${r.method} ${r.status} ${r.url}`).join('\n'));

  await browser.close();
})();
