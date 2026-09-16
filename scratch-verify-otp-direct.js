const { chromium } = require('playwright');
const fs = require('fs');
const EMAIL = 'ferdoushasanferdous@gmail.com';
const OTP = '083946';
const STATE_DIR = './.state';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const resp = await context.request.post('https://backend.thaura.ai/api/auth/verify-otp', {
    data: { email: EMAIL, otp: OTP },
    headers: { 'content-type': 'application/json' },
    failOnStatusCode: false,
  });
  console.log('Attempt 1 (field=otp) status:', resp.status());
  const body1 = await resp.text();
  console.log('body:', body1);

  if (resp.status() === 200) {
    await context.storageState({ path: `${STATE_DIR}/session-B.json` });
    console.log('SUCCESS - Token B saved to .state/session-B.json');
  }

  await browser.close();
})();
