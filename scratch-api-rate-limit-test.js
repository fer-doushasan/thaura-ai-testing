// Question 5.5: verify documented rate limits (60 requests/minute, 8 concurrent
// requests per key) return 429 rate_limit_exceeded. Uses the zero-balance key -
// every call fails at auth/rate-limit/billing before generation, so none are
// billable regardless of outcome. One-time burst, not sustained load.
const fs = require('fs');
const KEY = fs.readFileSync('./.state/api-key.txt', 'utf8').trim();
const OUT_DIR = './discovery-evidence/api-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

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
  const result = { startedAt: new Date().toISOString() };

  // --- Part 1: 65 sequential requests, as fast as possible, to probe the 60/min limit ---
  const sequential = [];
  const seqStart = Date.now();
  for (let i = 1; i <= 65; i++) {
    const r = await fire(`seq-${i}`);
    sequential.push(r);
    console.log(`[seq-${i}] -> ${r.status || r.error} (${r.errorType || ''})`);
  }
  result.sequential_elapsedMs = Date.now() - seqStart;
  result.sequential_results = sequential;
  const statusCounts = {};
  for (const r of sequential) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  result.sequential_statusCounts = statusCounts;
  result.sequential_first429Index = sequential.findIndex(r => r.status === 429) + 1 || null;

  // Brief pause so the concurrency test isn't confused with the tail of the sequential burst
  await new Promise(r => setTimeout(r, 2000));

  // --- Part 2: 9 truly concurrent requests, to probe the 8-concurrent limit ---
  const concurrentStart = Date.now();
  const concurrent = await Promise.all(Array.from({ length: 9 }, (_, i) => fire(`conc-${i + 1}`)));
  result.concurrent_elapsedMs = Date.now() - concurrentStart;
  result.concurrent_results = concurrent;
  const concurrentStatusCounts = {};
  for (const r of concurrent) concurrentStatusCounts[r.status] = (concurrentStatusCounts[r.status] || 0) + 1;
  result.concurrent_statusCounts = concurrentStatusCounts;

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/rate-limit-test-results.json`, JSON.stringify(result, null, 2));
  console.log('\nSequential status counts:', JSON.stringify(statusCounts));
  console.log('Concurrent status counts:', JSON.stringify(concurrentStatusCounts));
  console.log('Rate-limit test complete.');
})();
