const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const contextB = await browser.newContext({ storageState: './.state/session-B.json' });
  const pageB = await contextB.newPage();
  await pageB.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(1000);

  const composer = pageB.locator('[contenteditable="true"], textarea').first();
  await composer.click();
  await composer.fill('QA quota-sharing test via Token B - reply with just OK');
  await pageB.keyboard.press('Enter');
  await pageB.waitForTimeout(8000);

  const contextA = await browser.newContext({ storageState: './.state/session.json' });
  const checkQuota = async (ctx) => {
    const resp = await ctx.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
    return await resp.json();
  };
  const quotaA = await checkQuota(contextA);
  const quotaB = await checkQuota(contextB);

  console.log('After sending 1 message via Token B:');
  console.log('Token A quota:', JSON.stringify(quotaA));
  console.log('Token B quota:', JSON.stringify(quotaB));
  console.log('Quota is SHARED (A also dropped):', quotaA.remaining === quotaB.remaining && quotaA.remaining === 4);

  await browser.close();
})();
