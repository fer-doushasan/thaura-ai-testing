// Follow-up to close the one deprioritized item from the file-upload/data-integrity
// matrix: can the assistant actually read text baked INTO an image (not metadata),
// when asked in a live, non-quota-blocked chat turn? The original attempt in
// scratch-upload-full.js (valid_png entry, 2026-09-14) ran while the account was
// already quota-exhausted, so the "send" silently hit the "Out of messages" modal
// instead of a real model turn - this was never actually answered.
// Uses exactly 1 of the free-tier's 5-message/5-hour quota (checked via
// scratch-check-quota-now.js immediately before running: 3 remaining).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const IMG_MARKER = 'QA-IMG-MARKER-30457'; // baked into test-data/valid/sample.png as rendered text, per test-data/generate_fixtures.py

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const result = { startedAt: new Date().toISOString(), imgMarkerExpected: IMG_MARKER };

  const rateLimitBefore = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  result.rateLimit_before = await rateLimitBefore.json();

  const uploadRequests = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/uploads') && res.request().method() === 'POST') {
      try { uploadRequests.push(await res.json()); } catch (e) {}
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // New chat for isolation, matching the pattern used for every other upload test
  await page.locator('text=New Chat').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.resolve('test-data/valid/sample.png'));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT_DIR}/image_ocr-after-attach.png`, fullPage: true });

  const composer = page.locator('[contenteditable="true"], textarea').first();
  await composer.click();
  await composer.fill('What text is written in this image? Quote it exactly, character for character.');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(10000);

  await page.screenshot({ path: `${OUT_DIR}/image_ocr-after-send.png`, fullPage: true });
  const finalText = await page.locator('body').innerText().catch(() => '');
  result.finalBodyTextSnippet = finalText.slice(-2000);
  result.uploadNetworkResponses = uploadRequests;
  result.markerFoundInReply = finalText.includes(IMG_MARKER);
  result.chatUrl = page.url();

  const rateLimitAfter = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  result.rateLimit_after = await rateLimitAfter.json();

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/image-ocr-verification.json`, JSON.stringify(result, null, 2));
  console.log('markerFoundInReply:', result.markerFoundInReply);
  console.log('rateLimit_after:', JSON.stringify(result.rateLimit_after));

  await browser.close();
})();
