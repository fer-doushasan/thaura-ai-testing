// Non-destructive session inspection: reuses saved storageState (no OTP needed).
// Decodes ONLY the exp/iat claims from the session token if it's a JWT (never logs
// the raw token, signature, or full payload). Explores authenticated UI for
// settings/password, and tests concurrent-session behavior (two contexts, same token).
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence';
const STATE_PATH = './.state/session.json';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Context A: primary "device"
  const contextA = await browser.newContext({ storageState: STATE_PATH });
  const pageA = await contextA.newPage();
  await pageA.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await pageA.waitForTimeout(1500);
  await pageA.screenshot({ path: `${OUT_DIR}/08-authenticated-home.png`, fullPage: true });

  // Decode JWT claims safely (exp/iat only) without ever printing the raw token
  const cookies = await contextA.cookies();
  const tokenCookie = cookies.find(c => c.name === 'thaura_token');
  let claimsSummary = null;
  if (tokenCookie && tokenCookie.value.split('.').length === 3) {
    try {
      const payloadB64 = tokenCookie.value.split('.')[1];
      const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      const ALLOWLIST = ['exp', 'iat', 'nbf', 'type', 'alg'];
      claimsSummary = {};
      for (const k of ALLOWLIST) if (k in payloadJson) claimsSummary[k] = payloadJson[k];
      if (claimsSummary.exp) claimsSummary.expReadableUTC = new Date(claimsSummary.exp * 1000).toISOString();
      if (claimsSummary.iat) claimsSummary.iatReadableUTC = new Date(claimsSummary.iat * 1000).toISOString();
    } catch (e) {
      claimsSummary = { note: 'Cookie is not a decodable JWT (opaque token) - ' + e.message };
    }
  } else {
    claimsSummary = { note: 'Cookie is not JWT-shaped (not 3 dot-separated segments) - opaque session token' };
  }
  fs.writeFileSync(`${OUT_DIR}/token-claims-safe.json`, JSON.stringify(claimsSummary, null, 2));
  console.log('Token claims (safe subset):', JSON.stringify(claimsSummary));

  // Look for user menu / settings entry point
  const menuCandidates = ['[aria-label*="account" i]', '[aria-label*="user" i]', '[aria-label*="profile" i]', '[aria-label*="settings" i]', 'text=Qa Test', 'text=Settings'];
  let settingsOpened = false;
  for (const sel of menuCandidates) {
    const loc = pageA.locator(sel).first();
    if (await loc.count() > 0) {
      try {
        await loc.click({ timeout: 3000 });
        await pageA.waitForTimeout(1000);
        console.log('Clicked candidate menu selector:', sel);
        break;
      } catch (e) {}
    }
  }
  await pageA.screenshot({ path: `${OUT_DIR}/09-after-menu-click.png`, fullPage: true });

  const settingsLink = pageA.locator('text=Settings').first();
  if (await settingsLink.count() > 0) {
    try {
      await settingsLink.click({ timeout: 3000 });
      await pageA.waitForTimeout(1500);
      settingsOpened = true;
    } catch (e) {}
  }
  await pageA.screenshot({ path: `${OUT_DIR}/10-settings.png`, fullPage: true });

  const bodyText = await pageA.locator('body').innerText().catch(() => '');
  const hasPasswordMention = /password/i.test(bodyText);
  fs.writeFileSync(`${OUT_DIR}/settings-password-check.json`, JSON.stringify({ settingsOpened, hasPasswordMention }, null, 2));
  console.log('Settings opened:', settingsOpened, '| "password" text found on page:', hasPasswordMention);

  // Concurrent session test: Context B with the SAME storageState (simulates 2nd device)
  const contextB = await browser.newContext({ storageState: STATE_PATH });
  const pageB = await contextB.newPage();
  const meB = await pageB.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });
  const meA = await pageA.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });
  console.log('Concurrent session check -> Context A /api/auth/me:', meA.status, '| Context B /api/auth/me:', meB.status);
  fs.writeFileSync(`${OUT_DIR}/concurrent-session-check.json`, JSON.stringify({ contextA_status: meA.status, contextB_status: meB.status }, null, 2));

  await contextB.close();
  await browser.close();
})();
