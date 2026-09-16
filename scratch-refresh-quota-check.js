const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './.state/session.json' });
  const page = await context.newPage();

  const checkQuota = async () => {
    const resp = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
    return await resp.json();
  };

  const before = await checkQuota();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Reload multiple times to simulate a user refreshing repeatedly hoping to reset quota
  for (let i = 0; i < 3; i++) {
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
  }

  const after = await checkQuota();

  const result = { before, after, unchanged: before.remaining === after.remaining, at: new Date().toISOString() };
  fs.writeFileSync('./discovery-evidence/quota-test/tc-refresh-does-not-bypass-quota.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
