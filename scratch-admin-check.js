const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/website-scan';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Test 1: authenticated as our non-admin test account
  const authContext = await browser.newContext({ storageState: STATE_PATH });
  const authPage = await authContext.newPage();
  await authPage.goto('https://thaura.ai/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await authPage.waitForTimeout(1500);
  await authPage.screenshot({ path: `${OUT_DIR}/admin-as-nonadmin-user.png`, fullPage: true });
  const authPageText = await authPage.locator('body').innerText().catch(() => '');
  const authPageUrl = authPage.url();

  // Test 2: fully unauthenticated
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto('https://thaura.ai/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await anonPage.waitForTimeout(1500);
  await anonPage.screenshot({ path: `${OUT_DIR}/admin-as-anonymous.png`, fullPage: true });
  const anonPageText = await anonPage.locator('body').innerText().catch(() => '');
  const anonPageUrl = anonPage.url();

  console.log('=== As non-admin authenticated user ===');
  console.log('Final URL:', authPageUrl);
  console.log('Page text (first 500 chars):', authPageText.slice(0, 500));
  console.log('');
  console.log('=== As anonymous user ===');
  console.log('Final URL:', anonPageUrl);
  console.log('Page text (first 500 chars):', anonPageText.slice(0, 500));

  fs.writeFileSync(`${OUT_DIR}/admin-access-check.json`, JSON.stringify({
    nonAdminUser: { finalUrl: authPageUrl, textSnippet: authPageText.slice(0, 1000) },
    anonymous: { finalUrl: anonPageUrl, textSnippet: anonPageText.slice(0, 1000) },
  }, null, 2));

  await browser.close();
})();
