const { chromium } = require('playwright');
const EMAIL = 'ferdoushasanferdous@gmail.com';
const OTPCODE = '083946';
const STATE_DIR = './.state';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const resp = await context.request.post('https://backend.thaura.ai/api/auth/verify-otp', {
    data: { email: EMAIL, code: OTPCODE },
    headers: { 'content-type': 'application/json' },
    failOnStatusCode: false,
  });
  console.log('status:', resp.status());
  console.log('body:', await resp.text());

  if (resp.status() === 200) {
    await context.storageState({ path: `${STATE_DIR}/session-B.json` });
    console.log('SUCCESS - Token B saved to .state/session-B.json');
  }

  await browser.close();
})();
