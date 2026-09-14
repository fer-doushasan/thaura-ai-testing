// Step 1 of signup discovery: open the "Try Thaura" modal, enter the test email,
// click Continue, and OBSERVE what the next step asks for (password / OTP / magic link).
// Does not submit a password or complete signup yet.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence';
const TEST_EMAIL = process.argv[2];
if (!TEST_EMAIL) {
  console.error('Usage: node scratch-signup-step1.js <email>');
  process.exit(1);
}

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
      const entry = requests.find(r => r.url === res.request().url() && !r.status);
      if (entry) {
        entry.status = res.status();
        try { entry.body = await res.text(); } catch (e) {}
      }
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(TEST_EMAIL);
  await page.screenshot({ path: `${OUT_DIR}/03-email-filled.png` });

  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${OUT_DIR}/04-after-continue.png`, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(`${OUT_DIR}/after-continue.html`, html);

  // Try to describe what fields are now visible
  const inputs = await page.$$eval('input', (els) =>
    els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, autocomplete: e.autocomplete }))
  );
  fs.writeFileSync(`${OUT_DIR}/after-continue-inputs.json`, JSON.stringify(inputs, null, 2));

  const bodyText = await page.locator('body').innerText();
  fs.writeFileSync(`${OUT_DIR}/after-continue-bodytext.txt`, bodyText);

  fs.writeFileSync(`${OUT_DIR}/signup-step1-requests.json`, JSON.stringify(requests, null, 2));

  console.log('Inputs now visible:', JSON.stringify(inputs));
  console.log('Backend requests during this step:', requests.length);

  await browser.close();
})();
