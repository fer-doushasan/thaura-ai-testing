const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';

const FILES = [
  { key: 'valid_pdf', file: 'test-data/valid/sample.pdf' },
  { key: 'valid_xlsx', file: 'test-data/valid/sample.xlsx' },
  { key: 'valid_png', file: 'test-data/valid/sample.png' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const results = {};

  for (const spec of FILES) {
    let uploadResponseBody = null;
    const handler = async (res) => {
      if (res.url().includes('/api/uploads') && res.request().method() === 'POST') {
        try { uploadResponseBody = await res.json(); } catch (e) {}
      }
    };
    page.on('response', handler);

    await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.resolve(spec.file));
    await page.waitForTimeout(3500);

    page.off('response', handler);
    results[spec.key] = uploadResponseBody;
    console.log(`[${spec.key}]`, JSON.stringify(uploadResponseBody).slice(0, 300));
  }

  fs.writeFileSync(`${OUT_DIR}/extraction-verification.json`, JSON.stringify(results, null, 2));

  // Isolation probe: try to fetch OUR OWN uploaded file by fileId via plausible
  // endpoint patterns, both authenticated and unauthenticated.
  const fileId = results.valid_pdf && results.valid_pdf.fileId;
  if (fileId) {
    const patterns = [
      `https://backend.thaura.ai/api/files/${fileId}`,
      `https://backend.thaura.ai/api/uploads/${fileId}`,
      `https://backend.thaura.ai/api/user/files/${fileId}`,
    ];
    const isolationResults = [];
    for (const url of patterns) {
      const authRes = await page.evaluate(async (u) => {
        try { const r = await fetch(u, { credentials: 'include' }); return { status: r.status }; }
        catch (e) { return { error: e.message }; }
      }, url);
      isolationResults.push({ url, authFetchStatus: authRes.status ?? authRes.error });
    }

    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto('https://thaura.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    for (const entry of isolationResults) {
      const unauthRes = await freshPage.evaluate(async (u) => {
        try { const r = await fetch(u, { credentials: 'omit' }); return { status: r.status }; }
        catch (e) { return { error: e.message }; }
      }, entry.url);
      entry.unauthFetchStatus = unauthRes.status ?? unauthRes.error;
    }
    await freshContext.close();

    console.log('Isolation probe results:', JSON.stringify(isolationResults, null, 2));
    fs.writeFileSync(`${OUT_DIR}/isolation-probe-results.json`, JSON.stringify(isolationResults, null, 2));
  }

  await browser.close();
})();
