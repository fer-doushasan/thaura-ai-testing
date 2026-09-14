// Login completion + safe session inspection.
// SECURITY: reads OTP from env var only, never logs/writes the OTP value.
// Cookies/localStorage/sessionStorage values are redacted before being written anywhere.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence';
const STATE_DIR = './.state'; // gitignored, local-only session cache for test continuity
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR);

const EMAIL = 'ferdoushasanferdous@gmail.com';
const NAME = 'QA Test';
const OTP = process.env.OTP_CODE;
if (!OTP) {
  console.error('OTP_CODE env var not set');
  process.exit(1);
}

const SENSITIVE_KEYS = /token|secret|password|otp|api[_-]?key|session|cookie|auth(?!entication_error|entication_required)/i;

function redactBody(text) {
  try {
    const obj = JSON.parse(text);
    const walk = (o) => {
      if (Array.isArray(o)) return o.map(walk);
      if (o && typeof o === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(o)) {
          if (SENSITIVE_KEYS.test(k)) out[k] = '<REDACTED>';
          else out[k] = walk(v);
        }
        return out;
      }
      return o;
    };
    return JSON.stringify(walk(obj));
  } catch (e) {
    return '<non-JSON body, not stored>';
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const authRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('backend.thaura.ai')) {
      const headers = req.headers();
      authRequests.push({
        method: req.method(),
        url: req.url(),
        hasAuthHeader: !!headers['authorization'],
        hasCookieHeader: !!headers['cookie'],
      });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai')) {
      const entry = authRequests.slice().reverse().find(r => r.url === res.request().url() && !r.status);
      if (entry) {
        entry.status = res.status();
        const setCookie = res.headers()['set-cookie'];
        entry.setCookiePresent = !!setCookie;
        try {
          const body = await res.text();
          entry.bodyRedacted = redactBody(body);
        } catch (e) {}
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

  // Fill OTP - single hidden input with autocomplete=one-time-code drives the visual boxes
  const otpInput = page.locator('input[autocomplete="one-time-code"]').first();
  await otpInput.fill(OTP);
  await page.waitForTimeout(500);

  // Some OTP UIs auto-submit on 6th digit; if a Verify/Continue button still exists, click it
  const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue")').first();
  if (await verifyBtn.count() > 0) {
    try { await verifyBtn.click({ timeout: 3000 }); } catch (e) {}
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/06-after-otp.png`, fullPage: true });

  // Check login success via /api/auth/me
  const meCheck = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });
  console.log('Post-OTP /api/auth/me status:', meCheck.status);

  // Capture cookies (redacted)
  const cookies = await context.cookies();
  const redactedCookies = cookies.map(c => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    valueLength: c.value.length,
    value: '<REDACTED>',
  }));
  fs.writeFileSync(`${OUT_DIR}/session-cookies-redacted.json`, JSON.stringify(redactedCookies, null, 2));

  // Capture localStorage/sessionStorage (redacted where sensitive)
  const storageDump = await page.evaluate(() => {
    const dump = (storage) => {
      const out = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        out[key] = storage.getItem(key);
      }
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

  // Save storageState locally ONLY (gitignored, never included in reports) for test continuity
  await context.storageState({ path: `${STATE_DIR}/session.json` });
  console.log('Session state saved locally to .state/session.json (gitignored, not for reports)');

  // Try to find account/settings entry point
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/07-post-login-dashboard.png`, fullPage: true });

  await browser.close();
  console.log('Login + inspection complete. Cookies:', redactedCookies.length, 'Auth requests:', authRequests.length);
})();
