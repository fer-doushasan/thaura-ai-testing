// File access isolation check - quota-independent (upload happens before send).
// Attach a valid file, capture the uploaded file's reference/URL from the
// /api/uploads response, then try to fetch it from an UNAUTHENTICATED context
// to see if uploaded files are protected by auth or accessible via a bare URL.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  let uploadResponseBody = null;
  page.on('response', async (res) => {
    if (res.url().includes('/api/uploads') && res.request().method() === 'POST') {
      try { uploadResponseBody = await res.json(); } catch (e) { try { uploadResponseBody = await res.text(); } catch (e2) {} }
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  // Reload to a genuinely fresh state (bypass any lingering composer state)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.resolve('./test-data/valid/sample.pdf'));
  await page.waitForTimeout(3000);

  console.log('Upload response body:', JSON.stringify(uploadResponseBody));
  fs.writeFileSync(`${OUT_DIR}/isolation-upload-response.json`, JSON.stringify(uploadResponseBody, null, 2));

  // Try to find a URL in the response
  let fileUrl = null;
  const findUrl = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string' && obj.startsWith('http')) return obj;
    if (typeof obj === 'object') {
      for (const v of Object.values(obj)) {
        const found = findUrl(v);
        if (found) return found;
      }
    }
    return null;
  };
  fileUrl = findUrl(uploadResponseBody);
  console.log('Extracted file URL:', fileUrl);

  if (fileUrl) {
    // Test 1: fetch with authenticated context (should work)
    const authFetch = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      return { status: res.status };
    }, fileUrl);
    console.log('Authenticated fetch of file URL -> status:', authFetch.status);

    // Test 2: fetch from a brand-new UNAUTHENTICATED context
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto('https://thaura.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const unauthFetch = await freshPage.evaluate(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'omit' });
        return { status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    }, fileUrl);
    console.log('UNAUTHENTICATED fetch of same file URL -> status:', JSON.stringify(unauthFetch));
    fs.writeFileSync(`${OUT_DIR}/isolation-result.json`, JSON.stringify({ fileUrl, authFetchStatus: authFetch.status, unauthFetch }, null, 2));
    await freshContext.close();
  } else {
    console.log('No URL found in upload response - cannot test isolation this way.');
    fs.writeFileSync(`${OUT_DIR}/isolation-result.json`, JSON.stringify({ note: 'No file URL found in /api/uploads response body' }, null, 2));
  }

  await browser.close();
})();
