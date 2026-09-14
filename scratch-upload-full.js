const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const FILES = [
  { key: 'valid_pdf', file: 'test-data/valid/sample.pdf', prompt: 'What is the verification marker string in this document? Quote it exactly.' },
  { key: 'valid_xlsx', file: 'test-data/valid/sample.xlsx', prompt: 'What is the value in the Marker column of this spreadsheet? Quote it exactly.' },
  { key: 'valid_png', file: 'test-data/valid/sample.png', prompt: 'What text is written in this image? Quote it exactly.' },
  { key: 'empty_pdf', file: 'test-data/invalid/empty.pdf', prompt: 'What does this file contain?' },
  { key: 'empty_png', file: 'test-data/invalid/empty.png', prompt: 'What does this image show?' },
  { key: 'corrupted_pdf', file: 'test-data/invalid/corrupted.pdf', prompt: 'What does this file contain?' },
  { key: 'corrupted_png', file: 'test-data/invalid/corrupted.png', prompt: 'What does this image show?' },
  { key: 'password_protected_pdf', file: 'test-data/invalid/password-protected.pdf', prompt: 'What does this file contain?' },
  { key: 'oversized_8mb', file: 'test-data/boundary/oversized_8mb.pdf', prompt: 'What is the verification marker string in this document?' },
  { key: 'oversized_60mb', file: 'test-data/boundary/oversized_60mb.pdf', prompt: 'What is the verification marker string in this document?' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const results = [];

  for (const spec of FILES) {
    const entry = { key: spec.key, file: spec.file, startedAt: new Date().toISOString() };
    const uploadRequests = [];
    const respHandler = async (res) => {
      if (res.url().includes('backend.thaura.ai') && (res.url().includes('upload') || res.url().includes('file') || res.url().includes('attachment'))) {
        uploadRequests.push({ url: res.url(), status: res.status(), method: res.request().method() });
      }
    };
    page.on('response', respHandler);

    try {
      // New chat for isolation
      await page.locator('text=New Chat').first().click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(path.resolve(spec.file));

      // Wait for attach to process; longer wait for bigger files
      const sizeMB = fs.statSync(spec.file).size / (1024 * 1024);
      const waitMs = sizeMB > 20 ? 30000 : sizeMB > 4 ? 12000 : 3000;
      await page.waitForTimeout(waitMs);

      await page.screenshot({ path: `${OUT_DIR}/${spec.key}-after-attach.png`, fullPage: true });

      // Check for an inline error near the attachment (upload rejected client-side)
      const bodyTextAfterAttach = await page.locator('body').innerText().catch(() => '');
      entry.bodyTextAfterAttachSnippet = bodyTextAfterAttach.slice(0, 1500);

      // Try to send
      const composer = page.locator('[contenteditable="true"], textarea').first();
      await composer.click({ timeout: 5000 }).catch(() => {});
      await composer.fill(spec.prompt).catch(() => {});
      await page.keyboard.press('Enter');

      const sendWaitMs = sizeMB > 20 ? 45000 : 10000;
      await page.waitForTimeout(sendWaitMs);

      await page.screenshot({ path: `${OUT_DIR}/${spec.key}-after-send.png`, fullPage: true });
      const finalText = await page.locator('body').innerText().catch(() => '');
      entry.finalBodyTextSnippet = finalText.slice(-2000);
      entry.uploadNetworkRequests = uploadRequests;
      entry.status = 'completed-run';
    } catch (e) {
      entry.status = 'error';
      entry.error = e.message;
    } finally {
      page.off('response', respHandler);
    }

    entry.endedAt = new Date().toISOString();
    results.push(entry);
    fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(results, null, 2));
    console.log(`[${spec.key}] done ->`, entry.status);
  }

  await browser.close();
  console.log('All file upload tests complete.');
})();
