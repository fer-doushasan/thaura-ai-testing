// Login v3: handles both new-user (email->name->otp) and returning-user
// (email->otp directly) flows. Waits for OTP via local hand-off file.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = './discovery-evidence';
const STATE_DIR = './.state';
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR);
const HANDOFF_FILE = path.join(STATE_DIR, 'otp-input.txt');
if (fs.existsSync(HANDOFF_FILE)) fs.unlinkSync(HANDOFF_FILE);

const EMAIL = 'ferdoushasanferdous@gmail.com';
const NAME = 'QA Test';

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
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(EMAIL);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  // Handle EITHER path: name field (new user) or OTP field (returning user)
  const nameField = page.locator('input[placeholder*="name" i]').first();
  const otpField = page.locator('input[autocomplete="one-time-code"]').first();

  let sawName = false;
  for (let i = 0; i < 10; i++) {
    if (await nameField.count() > 0 && await nameField.isVisible().catch(() => false)) { sawName = true; break; }
    if (await otpField.count() > 0 && await otpField.isVisible().catch(() => false)) { break; }
    await page.waitForTimeout(500);
  }

  if (sawName) {
    console.log('New-user path detected: filling name step');
    await nameField.fill(NAME);
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(1500);
  } else {
    console.log('Returning-user path detected: OTP requested directly after email');
  }

  await page.screenshot({ path: `${OUT_DIR}/12-otp-screen.png` });
  console.log('WAITING for hand-off file at .state/otp-input.txt (up to 8 minutes)...');

  const otp = await waitForOtp(8 * 60 * 1000);
  if (!otp) {
    console.log('TIMEOUT: no OTP received via hand-off file. Aborting.');
    await browser.close();
    process.exit(1);
  }
  console.log('OTP received via hand-off file (value not logged). Submitting...');

  await otpField.fill(otp);
  await page.waitForTimeout(500);
  const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue")').first();
  if (await verifyBtn.count() > 0) {
    try { await verifyBtn.click({ timeout: 3000 }); } catch (e) {}
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/13-after-otp-v3.png`, fullPage: true });

  const meCheck = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });
  console.log('Post-OTP /api/auth/me status:', meCheck.status);

  if (meCheck.status === 200) {
    await context.storageState({ path: `${STATE_DIR}/session.json` });
    console.log('Session state saved locally to .state/session.json (gitignored)');
  }

  await browser.close();
  console.log('Login flow complete. meCheck.status =', meCheck.status);
})();
