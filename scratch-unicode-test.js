// Unicode/RTL input handling test via the Contact form. Data entry + rendering
// checks only - never completes a real submission (same approach as the
// earlier validation test: required-field/email-format gating blocks the
// actual POST, so no real message reaches Thaura's inbox).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/unicode-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLES = {
  bangla: 'আমি একজন সফটওয়্যার পরীক্ষক। এটি একটি পরীক্ষামূলক বার্তা।',
  arabic_rtl: 'أنا مهندس اختبار البرمجيات. هذه رسالة اختبار.',
  mixed_bangla_english: 'Testing QA আমি টেস্টিং করছি with mixed script 混合 текст',
  emoji: '🚀🔥💯 Testing emoji rendering 😀🎉👍 QA-EMOJI-TEST',
  long_unicode: 'অ'.repeat(500) + 'ব'.repeat(500),
  special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\',
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const postRequests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err)));
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on('request', (req) => { if (req.method() === 'POST' && !req.url().includes('/api/auth/')) postRequests.push(req.url()); });

  await page.goto('https://thaura.ai/contact', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const results = {};
  const messageField = page.locator('textarea').first();
  const nameField = page.locator('input[name*="name" i]').first();

  for (const [key, sample] of Object.entries(SAMPLES)) {
    await nameField.fill('').catch(() => {});
    await messageField.fill('').catch(() => {});
    await nameField.fill(sample.slice(0, 200)).catch(() => {});
    await messageField.fill(sample).catch(() => {});
    await page.waitForTimeout(300);

    const nameValue = await nameField.inputValue().catch(() => null);
    const messageValue = await messageField.inputValue().catch(() => null);
    results[key] = {
      inputLength: sample.length,
      nameFieldRoundTrip: nameValue === sample.slice(0, 200),
      messageFieldRoundTrip: messageValue === sample,
    };
    await page.screenshot({ path: `${OUT_DIR}/${key}.png` });
  }

  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify({
    perSample: results,
    consoleErrors,
    failedRequests,
    postRequestsFired: postRequests,
  }, null, 2));

  console.log(JSON.stringify(results, null, 2));
  console.log('Console errors during test:', consoleErrors.length, consoleErrors);
  console.log('Failed requests:', failedRequests.length);
  console.log('POST requests fired (should be 0 - no real submission):', postRequests.length);

  await browser.close();
})();
