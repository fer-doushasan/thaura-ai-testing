// TC-08: Independent concurrent session test.
// Performs a SECOND, fully independent OTP login for the SAME account, without
// touching the existing session (.state/session.json / "Token A" stays as-is).
// The new session is saved separately to .state/session-B.json ("Token B").
// Waits for the OTP via a local hand-off file - never typed into chat/logs.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = './discovery-evidence';
const STATE_DIR = './.state';
const HANDOFF_FILE = path.join(STATE_DIR, 'otp-input-B.txt');
if (fs.existsSync(HANDOFF_FILE)) fs.unlinkSync(HANDOFF_FILE);

const EMAIL = 'ferdoushasanferdous@gmail.com';

async function waitForOtp(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(HANDOFF_FILE)) {
      const code = fs.readFileSync(HANDOFF_FILE, 'utf8').trim();
      fs.unlinkSync(HANDOFF_FILE);
      return code;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(); // fresh, unrelated context - no storageState reused
  const page = await context.newPage();

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(EMAIL);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  const nameField = page.locator('input[placeholder*="name" i]').first();
  const otpField = page.locator('input[autocomplete="one-time-code"]').first();
  let sawName = false;
  for (let i = 0; i < 10; i++) {
    if (await nameField.count() > 0 && await nameField.isVisible().catch(() => false)) { sawName = true; break; }
    if (await otpField.count() > 0 && await otpField.isVisible().catch(() => false)) { break; }
    await page.waitForTimeout(500);
  }
  if (sawName) {
    await nameField.fill('QA Test');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: `${OUT_DIR}/second-login-otp-screen.png` });
  console.log('OTP requested for the SECOND independent session.');
  console.log('>>> Please check the inbox and write the 6-digit code to: .state/otp-input-B.txt');
  console.log('WAITING up to 8 minutes...');

  const otp = await waitForOtp(8 * 60 * 1000);
  if (!otp) {
    console.log('TIMEOUT: no OTP received via .state/otp-input-B.txt. Aborting - Token A untouched.');
    await browser.close();
    process.exit(1);
  }
  console.log('OTP received (value not logged). Submitting...');

  await otpField.fill(otp);
  await page.waitForTimeout(500);
  const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue")').first();
  if (await verifyBtn.count() > 0) { try { await verifyBtn.click({ timeout: 3000 }); } catch (e) {} }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/second-login-after-otp.png`, fullPage: true });

  const meCheck = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });
  console.log('Second-session /api/auth/me status:', meCheck.status);

  if (meCheck.status === 200) {
    await context.storageState({ path: `${STATE_DIR}/session-B.json` });
    console.log('Token B session saved to .state/session-B.json (gitignored, separate from Token A)');
  }

  // Decode Token B's safe claims for comparison against Token A
  const cookies = await context.cookies();
  const tokenB = cookies.find(c => c.name === 'thaura_token');
  let claimsB = null;
  if (tokenB && tokenB.value.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(tokenB.value.split('.')[1], 'base64').toString('utf8'));
    claimsB = { exp: payload.exp, iat: payload.iat };
    claimsB.expReadableUTC = new Date(claimsB.exp * 1000).toISOString();
    claimsB.iatReadableUTC = new Date(claimsB.iat * 1000).toISOString();
  }

  fs.writeFileSync(`${OUT_DIR}/second-login-result.json`, JSON.stringify({
    meCheck_status: meCheck.status,
    tokenB_claims: claimsB,
    at: new Date().toISOString(),
  }, null, 2));

  await browser.close();
  console.log('Second independent login flow complete.');
})();
