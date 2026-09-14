// Single minimal call: with quota exhausted (remaining:0 confirmed), hit
// /v1/chat/completions DIRECTLY via session cookie, skipping the UI's
// rate-limit/check preflight, to see if the completions endpoint itself
// enforces the free-tier quota server-side.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/quota-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });

  const result = await page.evaluate(async () => {
    const res = await fetch('https://backend.thaura.ai/v1/chat/completions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'QA bypass check - reply OK' }], stream: false, max_tokens: 5 }),
    });
    const status = res.status;
    let body;
    try { body = await res.text(); } catch (e) { body = '<unreadable>'; }
    return { status, body: body.slice(0, 800) };
  });

  console.log('Direct completions call while quota exhausted -> status:', result.status);
  fs.writeFileSync(`${OUT_DIR}/bypass-check-result.json`, JSON.stringify(result, null, 2));
  await browser.close();
})();
