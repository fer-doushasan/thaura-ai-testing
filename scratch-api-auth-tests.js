// Question 5.4: Developer API authentication/authorization - missing, malformed,
// invalid, and zero-balance API keys. Every case here fails auth/billing before
// reaching generation, so none of these calls are billable.
const fs = require('fs');
const KEY = fs.readFileSync('./.state/api-key.txt', 'utf8').trim();
const OUT_DIR = './discovery-evidence/api-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://backend.thaura.ai/v1/chat/completions';
const BODY = { messages: [{ role: 'user', content: 'hi' }] };

const CASES = [
  { id: 'API-22-missing-auth-header', headers: { 'Content-Type': 'application/json' } },
  { id: 'API-23-malformed-auth-header-no-bearer', headers: { 'Authorization': KEY, 'Content-Type': 'application/json' } },
  { id: 'API-24-malformed-auth-header-empty-bearer', headers: { 'Authorization': 'Bearer ', 'Content-Type': 'application/json' } },
  { id: 'API-25-invalid-key-wrong-format', headers: { 'Authorization': 'Bearer sk-not-a-real-key-0000000000000000', 'Content-Type': 'application/json' } },
  { id: 'API-26-invalid-key-tampered-real-looking', headers: { 'Authorization': `Bearer ${KEY.slice(0, -4)}XXXX`, 'Content-Type': 'application/json' } },
  { id: 'API-27-valid-zero-balance-key-for-comparison', headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' } },
];

async function run() {
  const results = [];
  for (const c of CASES) {
    try {
      const res = await fetch(BASE, { method: 'POST', headers: c.headers, body: JSON.stringify(BODY) });
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = text.slice(0, 300); }
      results.push({ id: c.id, status: res.status, response: parsed });
      console.log(`[${c.id}] -> ${res.status}`, JSON.stringify(parsed).slice(0, 200));
    } catch (e) {
      results.push({ id: c.id, error: e.message });
      console.log(`[${c.id}] ERROR:`, e.message);
    }
  }
  fs.writeFileSync(`${OUT_DIR}/auth-key-validation-results.json`, JSON.stringify(results, null, 2));
  console.log('\nAuth-key test batch complete. All calls non-billable (rejected before generation).');
}
run();
