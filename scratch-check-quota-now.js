const { chromium } = require('playwright');
const STATE_PATH = './.state/session.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const resp = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  console.log('STATUS', resp.status());
  console.log('BODY', await resp.text());
  await browser.close();
})();
