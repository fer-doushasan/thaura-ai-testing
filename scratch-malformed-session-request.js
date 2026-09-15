// Follow-up safety-conscious probe (no free-tier UI message consumed):
// send a deliberately malformed body straight to the session-cookie-authed
// /v1/chat/completions endpoint (the same route the web UI calls) to see
// whether request validation happens before or after quota accounting, and
// whether an invalid request produces a genuine error without being counted
// as a used message. This is a read/validate-only probe, not a real chat
// send through the UI, and current quota is already 0 so nothing is at risk.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/quota-test';

const result = { startedAt: new Date().toISOString() };

async function checkRateLimit(context) {
  const resp = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  try { return await resp.json(); } catch (e) { return { error: 'parse-failed', status: resp.status() }; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });

  result.rateLimit_before = await checkRateLimit(context);

  // Malformed: missing "messages" entirely (mirrors the malformed-payload
  // shape already validated as 400 on the paid API in earlier testing).
  const resp1 = await context.request.post('https://backend.thaura.ai/v1/chat/completions', {
    data: { model: 'thaura' },
    headers: { 'content-type': 'application/json' },
    failOnStatusCode: false,
  });
  result.malformed_missingMessages = { status: resp1.status(), bodySnippet: (await resp1.text()).slice(0, 500) };
  result.rateLimit_after_malformed1 = await checkRateLimit(context);

  // Malformed: messages present but wrong type (string instead of array).
  const resp2 = await context.request.post('https://backend.thaura.ai/v1/chat/completions', {
    data: { model: 'thaura', messages: 'not-an-array' },
    headers: { 'content-type': 'application/json' },
    failOnStatusCode: false,
  });
  result.malformed_wrongMessagesType = { status: resp2.status(), bodySnippet: (await resp2.text()).slice(0, 500) };
  result.rateLimit_after_malformed2 = await checkRateLimit(context);

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/malformed-session-request-results.json`, JSON.stringify(result, null, 2));

  console.log('=== MALFORMED SESSION-AUTH REQUEST SUMMARY ===');
  console.log('rateLimit_before:', JSON.stringify(result.rateLimit_before));
  console.log('malformed_missingMessages:', JSON.stringify(result.malformed_missingMessages));
  console.log('rateLimit_after_malformed1:', JSON.stringify(result.rateLimit_after_malformed1));
  console.log('malformed_wrongMessagesType:', JSON.stringify(result.malformed_wrongMessagesType));
  console.log('rateLimit_after_malformed2:', JSON.stringify(result.rateLimit_after_malformed2));

  await browser.close();
})();
