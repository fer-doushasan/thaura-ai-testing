// Phase 5: does a failed/interrupted assistant response consume a free
// message? Uses the LAST remaining message in the current 5h window, so this
// must succeed cleanly on the first attempt.
//
// Technique: send a message that requires a longer streamed reply, wait just
// long enough for the request to reach the server and start streaming, then
// reload the page to simulate a dropped client connection mid-generation
// (a realistic, non-abusive failure mode - not a crafted malformed payload).
// Then inspect: chat state after reload, /v1/chat/active-turns, and whether
// the rate-limit counter reflects the message as consumed.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/quota-test';

const result = { startedAt: new Date().toISOString() };

async function checkRateLimit(context) {
  const resp = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  try { return await resp.json(); } catch (e) { return { error: 'parse-failed', status: resp.status() }; }
}

async function checkActiveTurns(context) {
  const resp = await context.request.get('https://backend.thaura.ai/v1/chat/active-turns');
  try { return { status: resp.status(), body: await resp.json() }; } catch (e) { return { status: resp.status(), error: 'parse-failed' }; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const networkLog = [];
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai') && (res.url().includes('chat') || res.url().includes('completions'))) {
      networkLog.push({ url: res.url(), status: res.status(), method: res.request().method(), at: new Date().toISOString() });
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  result.rateLimit_before = await checkRateLimit(context);
  result.activeTurns_before = await checkActiveTurns(context);

  await page.locator('text=New Chat').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const composer = page.locator('[contenteditable="true"], textarea').first();
  await composer.click();
  await composer.fill('QA interrupted-response test: please write a detailed 300-word explanation of the differences between TCP and UDP, covering reliability, ordering, and use cases.');

  const sendTime = Date.now();
  await page.keyboard.press('Enter');

  // Let the request reach the server and streaming begin, then cut the
  // client connection by reloading before the reply can complete.
  await page.waitForTimeout(1400);
  result.chatUrlBeforeInterrupt = page.url();
  const midStreamText = await page.locator('body').innerText().catch(() => '');
  result.midStreamSnippet = midStreamText.slice(-800);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { result.reloadError = e.message; });
  result.interruptedAtMs = Date.now() - sendTime;
  await page.waitForTimeout(3000);

  result.rateLimit_immediately_after_interrupt = await checkRateLimit(context);
  result.activeTurns_immediately_after_interrupt = await checkActiveTurns(context);

  const afterReloadText = await page.locator('body').innerText().catch(() => '');
  result.afterReloadSnippet = afterReloadText.slice(-2000);
  await page.screenshot({ path: `${OUT_DIR}/interrupted-response-after-reload.png`, fullPage: true });

  // Give the backend a little more time in case generation/quota accounting
  // is asynchronous, then re-check once more.
  await page.waitForTimeout(8000);
  result.rateLimit_after_wait = await checkRateLimit(context);
  result.activeTurns_after_wait = await checkActiveTurns(context);

  const finalText = await page.locator('body').innerText().catch(() => '');
  result.finalTextSnippet = finalText.slice(-2000);
  await page.screenshot({ path: `${OUT_DIR}/interrupted-response-final-state.png`, fullPage: true });

  result.networkLog = networkLog;
  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/failed-response-quota-test.json`, JSON.stringify(result, null, 2));

  console.log('=== FAILED-RESPONSE QUOTA TEST SUMMARY ===');
  console.log('rateLimit_before:', JSON.stringify(result.rateLimit_before));
  console.log('rateLimit_immediately_after_interrupt:', JSON.stringify(result.rateLimit_immediately_after_interrupt));
  console.log('rateLimit_after_wait:', JSON.stringify(result.rateLimit_after_wait));
  console.log('interruptedAtMs:', result.interruptedAtMs);

  await browser.close();
})();
