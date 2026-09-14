const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence';
const STATE_PATH = './.state/session.json';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Context A: will be logged out
  const contextA = await browser.newContext({ storageState: STATE_PATH });
  const pageA = await contextA.newPage();
  await pageA.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });

  // Capture the pre-logout cookie value IN MEMORY ONLY (never written to disk raw)
  const preCookies = await contextA.cookies();
  const preToken = preCookies.find(c => c.name === 'thaura_token');

  // Context B: separate "second device" holding the SAME token, opened BEFORE logout
  const contextB = await browser.newContext({ storageState: STATE_PATH });
  const pageB = await contextB.newPage();
  await pageB.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });

  const checkMe = async (page) => page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return res.status;
  });

  console.log('Pre-logout: Context A /api/auth/me =', await checkMe(pageA));
  console.log('Pre-logout: Context B /api/auth/me =', await checkMe(pageB));

  // Perform logout via UI in Context A
  await pageA.locator('text=Qa Test').first().click();
  await pageA.waitForTimeout(800);
  await pageA.locator('text=Logout').first().click();
  await pageA.waitForTimeout(2500);
  await pageA.screenshot({ path: `${OUT_DIR}/11-after-logout.png`, fullPage: true });

  const postLogoutCookiesA = await contextA.cookies();
  const tokenStillPresentA = postLogoutCookiesA.some(c => c.name === 'thaura_token');
  console.log('Post-logout: Context A thaura_token cookie still present locally?', tokenStillPresentA);

  const meAfterA = await checkMe(pageA);
  console.log('Post-logout: Context A /api/auth/me =', meAfterA);

  // Replay the OLD (pre-logout) token value in a brand-new context to test server-side invalidation
  const contextC = await browser.newContext();
  const pageC = await contextC.newPage();
  await pageC.goto('https://thaura.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (preToken) {
    await contextC.addCookies([{
      name: 'thaura_token', value: preToken.value, domain: preToken.domain, path: preToken.path,
      httpOnly: preToken.httpOnly, secure: preToken.secure, sameSite: preToken.sameSite, expires: preToken.expires,
    }]);
  }
  const meReplayed = await checkMe(pageC);
  console.log('Replayed OLD pre-logout token in new context -> /api/auth/me =', meReplayed);

  // Check Context B (second device, never logged out itself) after A's logout
  const meB_afterA_logout = await checkMe(pageB);
  console.log('Context B (separate device, same original token) after A logged out -> /api/auth/me =', meB_afterA_logout);

  const summary = {
    preLogout: { contextA: 'checked', contextB: 'checked' },
    postLogoutContextA_meStatus: meAfterA,
    postLogoutContextA_cookieStillPresentLocally: tokenStillPresentA,
    replayedOldTokenAfterLogout_meStatus: meReplayed,
    contextB_afterA_logout_meStatus: meB_afterA_logout,
  };
  fs.writeFileSync(`${OUT_DIR}/logout-invalidation-summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
})();
