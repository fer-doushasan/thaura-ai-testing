const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence';
const STATE_PATH = './.state/session.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext({ storageState: STATE_PATH });
  const pageA = await contextA.newPage();
  await pageA.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });

  const contextB = await browser.newContext({ storageState: STATE_PATH });
  const pageB = await contextB.newPage();
  await pageB.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });

  const check = async (page) => page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/api/auth/me', { credentials: 'include' });
    return { status: res.status };
  });

  const meA = await check(pageA);
  const meB = await check(pageB);
  console.log('Context A (device 1) /api/auth/me:', meA.status);
  console.log('Context B (device 2, same token) /api/auth/me:', meB.status);
  fs.writeFileSync(`${OUT_DIR}/concurrent-session-check.json`, JSON.stringify({ contextA_status: meA.status, contextB_status: meB.status }, null, 2));

  await browser.close();
})();
