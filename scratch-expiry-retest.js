// Follow-up expiry/session investigation. Does NOT wait for real expiry (infeasible -
// exp is ~1 year out) and does NOT forge a signed token (we don't have the signing
// key, so a tampered payload would only prove signature validation, not exp
// enforcement specifically - would be a conflation, not a real answer).
// Instead, tests three concrete, safe, immediately-answerable questions:
//   1) Does the server ever rotate/reissue the session token on continued use,
//      or is the original token from 2026-09-14 still the exact one being served?
//   2) Is the cookie's own Max-Age/expires attribute synchronized with the JWT's
//      internal exp claim, or does the cookie enforce something shorter/different?
//   3) Is there any session/device-management UI (a "Sessions" or "Security" panel)
//      we haven't already found, analogous to how the "Memory" panel was previously
//      discovered by not assuming the account menu was fully mapped?
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence';

const ALLOWLIST = ['exp', 'iat', 'nbf', 'type', 'alg'];
function safeDecode(tokenValue) {
  if (!tokenValue || tokenValue.split('.').length !== 3) return { note: 'not JWT-shaped' };
  try {
    const payload = JSON.parse(Buffer.from(tokenValue.split('.')[1], 'base64').toString('utf8'));
    const out = {};
    for (const k of ALLOWLIST) if (k in payload) out[k] = payload[k];
    if (out.exp) out.expReadableUTC = new Date(out.exp * 1000).toISOString();
    if (out.iat) out.iatReadableUTC = new Date(out.iat * 1000).toISOString();
    return out;
  } catch (e) {
    return { note: 'decode failed: ' + e.message };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const result = { startedAt: new Date().toISOString() };

  // --- 1) Decode the CURRENT stored cookie's claims (from the local state file) ---
  const storedState = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const storedCookie = storedState.cookies.find(c => c.name === 'thaura_token');
  result.storedCookie_claims = safeDecode(storedCookie ? storedCookie.value : null);
  result.storedCookie_expiresAttr = storedCookie ? storedCookie.expires : null;
  result.storedCookie_expiresAttrReadable = storedCookie ? new Date(storedCookie.expires * 1000).toISOString() : null;

  // --- 2) Make a live authenticated request and inspect the RESPONSE for any Set-Cookie ---
  let setCookieSeen = null;
  page.on('response', (res) => {
    if (res.url().includes('/api/auth/me')) {
      const headers = res.headers();
      if (headers['set-cookie']) setCookieSeen = 'PRESENT (see raw header count only, not logging value)';
    }
  });
  const meResp = await context.request.get('https://backend.thaura.ai/api/auth/me');
  result.liveAuthMe_status = meResp.status();
  result.liveAuthMe_setCookieHeaderPresent = !!meResp.headers()['set-cookie'];
  result.liveAuthMe_bodyFieldsPresent = Object.keys(JSON.parse(await meResp.text()).user || {});

  // --- 3) Re-read the cookie jar AFTER the live request - did it change at all? ---
  const cookiesAfter = await context.cookies();
  const cookieAfter = cookiesAfter.find(c => c.name === 'thaura_token');
  result.cookieAfterLiveRequest_sameValueAsStored = cookieAfter ? (cookieAfter.value === storedCookie.value) : null;
  result.cookieAfterLiveRequest_claims = safeDecode(cookieAfter ? cookieAfter.value : null);

  // --- 4) Look for any session/device-management UI not previously mapped ---
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const accountBtn = page.locator('button', { hasText: 'Qa Test' }).last();
  await accountBtn.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const menuText = await page.locator('body').innerText().catch(() => '');
  result.accountMenu_fullText = menuText.slice(0, 1200);
  result.accountMenu_hasSessionsOrDevicesEntry = /session|device|security|active login/i.test(menuText);

  const settingsItem = page.locator('text=Settings').first();
  if (await settingsItem.count() > 0) {
    await settingsItem.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // Scroll the settings modal fully to make sure nothing below the fold was missed
    const modal = page.locator('[role="dialog"], .modal, [class*="dialog" i]').first();
    if (await modal.count() > 0) {
      await modal.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${OUT_DIR}/expiry-retest-settings-scrolled.png`, fullPage: true });
    const settingsText = await page.locator('body').innerText().catch(() => '');
    result.settingsModal_fullText = settingsText.slice(0, 2000);
    result.settingsModal_hasSessionsOrDevicesEntry = /session|device|active login|log out other|sign out other/i.test(settingsText);
  }

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/expiry-retest-results.json`, JSON.stringify(result, null, 2));

  console.log('=== EXPIRY RETEST SUMMARY ===');
  console.log('storedCookie_claims:', JSON.stringify(result.storedCookie_claims));
  console.log('storedCookie_expiresAttrReadable:', result.storedCookie_expiresAttrReadable);
  console.log('liveAuthMe_status:', result.liveAuthMe_status);
  console.log('liveAuthMe_setCookieHeaderPresent:', result.liveAuthMe_setCookieHeaderPresent);
  console.log('cookieAfterLiveRequest_sameValueAsStored:', result.cookieAfterLiveRequest_sameValueAsStored);
  console.log('accountMenu_hasSessionsOrDevicesEntry:', result.accountMenu_hasSessionsOrDevicesEntry);
  console.log('settingsModal_hasSessionsOrDevicesEntry:', result.settingsModal_hasSessionsOrDevicesEntry);

  await browser.close();
})();
