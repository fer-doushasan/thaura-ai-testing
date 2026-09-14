const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const KEY_PATH = './.state/api-key.txt';
const OUT_DIR = './discovery-evidence/api-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  let createKeyResponseBody = null;
  let createKeyUrl = null;
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('backend.thaura.ai') && /key/i.test(res.url())) {
      createKeyUrl = res.url();
      try { createKeyResponseBody = await res.json(); } catch (e) {}
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.locator('text=Qa Test').first().click();
  await page.waitForTimeout(500);
  await page.locator('text=API').first().click();
  await page.waitForTimeout(1000);
  await page.locator('text=Create New API Key').first().click();
  await page.waitForTimeout(1000);

  const createKeyBtn = page.locator('button:has-text("Create key")').first();
  await createKeyBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT_DIR}/04-key-result.png`, fullPage: true });

  console.log('Create-key endpoint hit:', createKeyUrl);
  if (createKeyResponseBody) {
    // Find the key-shaped field without logging its value
    const SENSITIVE_FIELD_NAMES = ['key', 'apiKey', 'secret', 'token'];
    let keyValue = null;
    for (const name of SENSITIVE_FIELD_NAMES) {
      if (createKeyResponseBody[name] && typeof createKeyResponseBody[name] === 'string' && createKeyResponseBody[name].length > 15) {
        keyValue = createKeyResponseBody[name];
        break;
      }
    }
    // Also check nested one level (e.g. {apiKey: {key: '...'}})
    if (!keyValue) {
      for (const v of Object.values(createKeyResponseBody)) {
        if (v && typeof v === 'object') {
          for (const name of SENSITIVE_FIELD_NAMES) {
            if (v[name] && typeof v[name] === 'string' && v[name].length > 15) { keyValue = v[name]; break; }
          }
        }
      }
    }
    if (keyValue) {
      fs.writeFileSync(KEY_PATH, keyValue);
      console.log('Key captured and saved locally (value not logged). Length:', keyValue.length);
    } else {
      console.log('Response received but no key-shaped field found. Response keys:', Object.keys(createKeyResponseBody));
      // Save a redacted version of the response structure for debugging
      const redacted = {};
      for (const [k, v] of Object.entries(createKeyResponseBody)) {
        redacted[k] = SENSITIVE_FIELD_NAMES.includes(k) ? '<REDACTED>' : (typeof v === 'string' && v.length > 15 ? '<REDACTED-LONG-STRING>' : v);
      }
      fs.writeFileSync(`${OUT_DIR}/create-key-response-redacted.json`, JSON.stringify(redacted, null, 2));
    }
  } else {
    console.log('No create-key response captured.');
  }

  await browser.close();
})();
