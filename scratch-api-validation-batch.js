// All zero-cost validation/format tests. Every case here either fails body
// validation (400) before reaching the balance check, or passes validation
// and hits the balance gate (402) - in neither case does generation happen,
// so no tokens are ever billed regardless of outcome.
const fs = require('fs');
const KEY = fs.readFileSync('./.state/api-key.txt', 'utf8').trim();
const OUT_DIR = './discovery-evidence/api-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://backend.thaura.ai/v1/chat/completions';

const TESTS = [
  { id: 'API-07-empty-messages', body: { messages: [] } },
  { id: 'API-08-invalid-messages-type', body: { messages: 'hello' } },
  { id: 'API-09-invalid-model', body: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4' } },
  { id: 'API-10-temp-below-0', body: { messages: [{ role: 'user', content: 'hi' }], temperature: -0.1 } },
  { id: 'API-11-temp-above-2', body: { messages: [{ role: 'user', content: 'hi' }], temperature: 2.1 } },
  { id: 'API-12-temp-boundary-0', body: { messages: [{ role: 'user', content: 'hi' }], temperature: 0.0, max_tokens: 5 } },
  { id: 'API-13-temp-boundary-2', body: { messages: [{ role: 'user', content: 'hi' }], temperature: 2.0, max_tokens: 5 } },
  { id: 'API-15-max_completion_tokens-over-cap', body: { messages: [{ role: 'user', content: 'hi' }], max_completion_tokens: 32001 } },
  { id: 'API-15b-max_tokens-over-cap', body: { messages: [{ role: 'user', content: 'hi' }], max_tokens: 32001 } },
  { id: 'API-14-max_completion_tokens-boundary-32000', body: { messages: [{ role: 'user', content: 'hi' }], max_completion_tokens: 32000 } },
  { id: 'API-17-both-max-params-precedence', body: { messages: [{ role: 'user', content: 'hi' }], max_tokens: 500, max_completion_tokens: 100 } },
  { id: 'API-18-legacy-functions-param', body: { messages: [{ role: 'user', content: 'hi' }], functions: [{ name: 'test', parameters: {} }] } },
  { id: 'API-19-legacy-function_call-param', body: { messages: [{ role: 'user', content: 'hi' }], function_call: 'auto' } },
  { id: 'API-20-ignored-params-format-check', body: { messages: [{ role: 'user', content: 'hi' }], top_p: 0.5, frequency_penalty: 1, presence_penalty: 1, n: 1, user: 'qa-test' } },
  { id: 'API-21-tools-format-check', body: { messages: [{ role: 'user', content: 'hi' }], tools: [{ type: 'function', function: { name: 'get_weather', parameters: { type: 'object', properties: {} } } }], tool_choice: 'auto' } },
];

async function run() {
  const results = [];
  for (const t of TESTS) {
    try {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body),
      });
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = text.slice(0, 300); }
      results.push({ id: t.id, requestBody: t.body, status: res.status, response: parsed });
      console.log(`[${t.id}] -> ${res.status}`, JSON.stringify(parsed).slice(0, 200));
    } catch (e) {
      results.push({ id: t.id, requestBody: t.body, error: e.message });
      console.log(`[${t.id}] ERROR:`, e.message);
    }
  }
  fs.writeFileSync(`${OUT_DIR}/validation-batch-results.json`, JSON.stringify(results, null, 2));
  console.log('\nBatch complete. All calls non-billable (validation-rejected or balance-gated before generation).');
}
run();
