// Cross-ACCOUNT file isolation test (item 3.3, previously marked NOT TESTED / out of
// scope because only one real account was available). The user has confirmed
// ferdoushasan382@gmail.com is a second real account they themselves control (not
// "another real person's account"), so this is now in scope.
//
// Logs in fresh via OTP as Account B, saves its session SEPARATELY from the primary
// "Qa Test" session (.state/session.json / Token A is never touched), then - fully
// authenticated as Account B - attempts to fetch files known to belong to Account A
// by fileId (planted during earlier upload tests). No chat messages are sent, so
// this costs 0 quota on either account.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = './discovery-evidence/upload-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const STATE_DIR = './.state';
const HANDOFF_FILE = path.join(STATE_DIR, 'otp-input-accountB.txt');
if (fs.existsSync(HANDOFF_FILE)) fs.unlinkSync(HANDOFF_FILE);

const EMAIL_B = 'ferdoushasan382@gmail.com';

// Known Account-A fileIds from prior upload tests (extraction-verification.json, image-ocr-verification.json)
const ACCOUNT_A_FILE_IDS = [
  { label: 'valid_pdf', fileId: '4c313b0a6445c6a8a1d2d5732099b68b' },
  { label: 'valid_xlsx', fileId: 'fc14a17ca3c75ba979118ca212e74d0e' },
  { label: 'valid_png_earlier', fileId: '4011aeb5b53bb2930c0da507343d7eb6' },
  { label: 'valid_png_ocr_test', fileId: 'c8e1fe02a7224da9020d0a44c2d9fafc' },
];

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
  const context = await browser.newContext(); // fresh, unrelated context - Account A's session untouched
  const page = await context.newPage();

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('text=Try Thaura').first().click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(EMAIL_B);
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
    await nameField.fill('QA Test B');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: `${OUT_DIR}/../crossaccount-otp-screen.png` });
  console.log('OTP requested for Account B (' + EMAIL_B + ').');
  console.log('>>> Please check that inbox and write the 6-digit code to: .state/otp-input-accountB.txt');
  console.log('WAITING up to 8 minutes...');

  const otp = await waitForOtp(8 * 60 * 1000);
  if (!otp) {
    console.log('TIMEOUT: no OTP received. Aborting - Account A untouched.');
    await browser.close();
    process.exit(1);
  }
  console.log('OTP received (value not logged). Submitting...');

  await otpField.fill(otp);
  await page.waitForTimeout(500);
  const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue")').first();
  if (await verifyBtn.count() > 0) { try { await verifyBtn.click({ timeout: 3000 }); } catch (e) {} }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/../crossaccount-after-otp.png`, fullPage: true });

  const meCheck = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    const body = res.status === 200 ? await res.json() : null;
    return { status: res.status, id: body?.id, plan: body?.plan };
  });
  console.log('Account B /api/auth/me status:', meCheck.status, 'userId:', meCheck.id);

  const result = {
    startedAt: new Date().toISOString(),
    accountB_meCheck: meCheck,
    accountA_userId_forComparison: 'cmu1145wi03oajyr4f0noby2n',
    isolationProbes: [],
  };

  if (meCheck.status === 200) {
    await context.storageState({ path: `${STATE_DIR}/session-accountB.json` });
    console.log('Account B session saved to .state/session-accountB.json (separate from Token A)');

    // Probe each known Account-A fileId, fully authenticated as Account B
    for (const { label, fileId } of ACCOUNT_A_FILE_IDS) {
      const patterns = [
        `https://backend.thaura.ai/api/files/${fileId}`,
        `https://backend.thaura.ai/api/uploads/${fileId}`,
        `https://backend.thaura.ai/api/user/files/${fileId}`,
      ];
      for (const url of patterns) {
        const res = await page.evaluate(async (u) => {
          try {
            const r = await fetch(u, { credentials: 'include' });
            let bodySnippet = null;
            try { bodySnippet = (await r.text()).slice(0, 200); } catch (e) {}
            return { status: r.status, bodySnippet };
          } catch (e) { return { error: e.message }; }
        }, url);
        result.isolationProbes.push({ label, fileId, url, ...res });
        console.log(`[${label}] ${url} -> ${res.status ?? res.error}`);
      }
    }
  } else {
    result.note = 'Account B login/auth check failed - isolation probes skipped.';
  }

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/cross-account-isolation-results.json`, JSON.stringify(result, null, 2));
  console.log('Cross-account isolation test complete.');

  await browser.close();
})();
