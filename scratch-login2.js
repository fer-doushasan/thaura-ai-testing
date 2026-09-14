// Login completion, v2: triggers OTP once, then waits for the code via a local
// hand-off file (./.state/otp-input.txt) so we never re-trigger request-otp
// (which invalidates prior codes) and never pass the OTP as a CLI arg/env var log.
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

const SENSITIVE_KEYS = /token|secret|password|otp|api[_-]?key|session|cookie|auth(?!entication_error|entication_required)/i;
function redactBody(text) {
  try {
    const obj = JSON.parse(text);
    const walk = (o) => {
      if (Array.isArray(o)) return o.map(walk);
      if (o && typeof o === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(o)) out[k] = SENSITIVE_KEYS.test(k) ? '<REDACTED>' : walk(v);
        return out;
      }
      return o;
    };
    return JSON.stringify(walk(obj));
  } catch (e) { return '<non-JSON body, not stored>'; }
}

async function waitForOtp(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(HANDOFF_FILE)) {
      const code = fs.readFileSync(HANDOFF_FILE, 'utf8').trim();
      fs.unlinkSync(HANDOFF_FILE); // delete immediately after reading
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

  const authRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('backend.thaura.ai')) {
      authRequests.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai')) {
      const entry = authRequests.slice().reverse().find(r => r.url === res.request().url() && !r.status);
      if (entry) {
        entry.status = res.status();
        try { entry.bodyRedacted = redactBody(await res.text()); } catch (e) {}
      }
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(EMAIL);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1200);
  await page.locator('input[placeholder*="name" i]').first().fill(NAME);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  console.log('OTP requested and sent to', EMAIL);
  console.log('WAITING for hand-off file at .state/otp-input.txt (up to 8 minutes)...');

  const otp = await waitForOtp(8 * 60 * 1000);
  if (!otp) {
    console.log('TIMEOUT: no OTP received via hand-off file. Aborting.');
    await browser.close();
    process.exit(1);
  }
  console.log('OTP received via hand-off file (value not logged). Submitting...');

  const otpInput = page.locator('input[autocomplete="one-time-code"]').first();
  await otpInput.fill(otp);
  await page.waitForTimeout(500);
  const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue")').first();
  if (await verifyBtn.count() > 0) {
    try { await verifyBtn.click({ timeout: 3000 }); } catch (e) {}
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/06-after-otp.png`, fullPage: true });

  const meCheck = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    let body = null;
    try { body = await res.json(); } catch (e) {}
    return { status: res.status, body };
  });
  console.log('Post-OTP /api/auth/me status:', meCheck.status);
  fs.writeFileSync(`${OUT_DIR}/post-login-me-check.json`, JSON.stringify({ status: meCheck.status, bodyRedacted: redactBody(JSON.stringify(meCheck.body || {})) }, null, 2));

  const cookies = await context.cookies();
  const redactedCookies = cookies.map(c => ({
    name: c.name, domain: c.domain, path: c.path, expires: c.expires,
    httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
    valueLength: c.value.length, value: '<REDACTED>',
  }));
  fs.writeFileSync(`${OUT_DIR}/session-cookies-redacted.json`, JSON.stringify(redactedCookies, null, 2));

  const storageDump = await page.evaluate(() => {
    const dump = (storage) => {
      const out = {};
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); out[k] = storage.getItem(k); }
      return out;
    };
    return { localStorage: dump(window.localStorage), sessionStorage: dump(window.sessionStorage) };
  });
  const redactStorage = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const sensitive = SENSITIVE_KEYS.test(k) || (typeof v === 'string' && v.startsWith('eyJ'));
      out[k] = { valueLength: (v || '').length, value: sensitive ? '<REDACTED>' : (v && v.length < 60 ? v : '<REDACTED-LONG-VALUE>') };
    }
    return out;
  };
  fs.writeFileSync(`${OUT_DIR}/session-storage-redacted.json`, JSON.stringify({
    localStorage: redactStorage(storageDump.localStorage),
    sessionStorage: redactStorage(storageDump.sessionStorage),
  }, null, 2));

  fs.writeFileSync(`${OUT_DIR}/auth-requests-redacted.json`, JSON.stringify(authRequests, null, 2));

  await context.storageState({ path: `${STATE_DIR}/session.json` });
  console.log('Session state saved locally to .state/session.json (gitignored, not for reports)');

  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/07-post-login-dashboard.png`, fullPage: true });

  await browser.close();
  console.log('Login flow complete. meCheck.status =', meCheck.status, '| cookies =', redactedCookies.length);
})();
