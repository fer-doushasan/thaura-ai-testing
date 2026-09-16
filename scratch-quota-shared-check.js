// Does the 5-message free-tier quota belong to the ACCOUNT (shared across all of
// that account's independent sessions/tokens) or to the individual TOKEN/session
// (which would mean logging in again gives you a fresh, separate pool - a bypass)?
// Zero-cost check: just reads rate-limit/check with both tokens, sends nothing.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext({ storageState: './.state/session.json' });
  const contextB = await browser.newContext({ storageState: './.state/session-B.json' });

  const checkQuota = async (ctx) => {
    const resp = await ctx.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
    return await resp.json();
  };

  const quotaA = await checkQuota(contextA);
  const quotaB = await checkQuota(contextB);

  console.log('Token A (original session) quota:', JSON.stringify(quotaA));
  console.log('Token B (independent second session, same account) quota:', JSON.stringify(quotaB));
  console.log('Quota is SHARED across tokens (same remaining value):', quotaA.remaining === quotaB.remaining);

  await browser.close();
})();
