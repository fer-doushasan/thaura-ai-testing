// Follow-up to scratch-api-rate-limit-test.js: that run's concurrency test was
// confounded because it fired only 2s after a 65-request burst had already
// tripped the 60/min limit, so all 9 concurrent requests got 429 for the wrong
// reason. This waits out the per-minute window first, then fires exactly 9
// concurrent requests in isolation so any 429 can be attributed to the
// 8-concurrent-requests limit specifically, not a stale per-minute limit.
const fs = require('fs');
const KEY = fs.readFileSync('./.state/api-key.txt', 'utf8').trim();
const OUT_DIR = './discovery-evidence/api-test';

const BASE = 'https://backend.thaura.ai/v1/chat/completions';
const BODY = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });
const HEADERS = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function fire(label) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE, { method: 'POST', headers: HEADERS, body: BODY });
    const text = await res.text();
    let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = text.slice(0, 200); }
    return { label, status: res.status, errorType: parsed?.error?.type, tMs: Date.now() - t0 };
  } catch (e) {
    return { label, error: e.message, tMs: Date.now() - t0 };
  }
}

(async () => {
  console.log('Waiting 75s for the per-minute rate-limit window to clear before isolating the concurrency test...');
  await new Promise(r => setTimeout(r, 75000));

  // Sanity check: a single request should be back to 402 (not 429) before trusting the concurrency result.
  const sanity = await fire('sanity-single');
  console.log('[sanity-single] ->', sanity.status, sanity.errorType);

  const concurrentStart = Date.now();
  const concurrent = await Promise.all(Array.from({ length: 9 }, (_, i) => fire(`conc-${i + 1}`)));
  const elapsedMs = Date.now() - concurrentStart;
  const statusCounts = {};
  for (const r of concurrent) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

  concurrent.forEach(r => console.log(`[${r.label}] -> ${r.status} (${r.errorType || ''})`));
  console.log('Concurrent status counts:', JSON.stringify(statusCounts));

  const result = {
    startedAt: new Date().toISOString(),
    sanityCheck_beforeConcurrency: sanity,
    concurrent_elapsedMs: elapsedMs,
    concurrent_results: concurrent,
    concurrent_statusCounts: statusCounts,
    interpretation: sanity.status === 402
      ? 'Per-minute window confirmed clear (sanity check returned 402, not 429) before the concurrency burst - any 429 among the 9 concurrent results is attributable to the concurrency limit specifically.'
      : 'Per-minute window was NOT clear (sanity check itself returned ' + sanity.status + ') - concurrency result below may still be confounded.',
  };
  fs.writeFileSync(`${OUT_DIR}/concurrency-test-isolated-results.json`, JSON.stringify(result, null, 2));
  console.log('Isolated concurrency test complete.');
})();
