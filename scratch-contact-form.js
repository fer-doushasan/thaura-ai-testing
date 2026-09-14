const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/website-scan';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const submissionRequests = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && !req.url().includes('/api/auth/')) {
      submissionRequests.push({ method: req.method(), url: req.url(), postData: (req.postData() || '').slice(0, 500) });
    }
  });

  await page.goto('https://thaura.ai/contact', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/contact-form-initial.png`, fullPage: true });

  const formFields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    return inputs.map(el => ({
      tag: el.tagName, type: el.type || null, name: el.name || null,
      placeholder: el.placeholder || null, required: el.required || false,
    }));
  });
  fs.writeFileSync(`${OUT_DIR}/contact-form-fields.json`, JSON.stringify(formFields, null, 2));
  console.log('Form fields:', JSON.stringify(formFields, null, 2));

  // Test 1: submit completely blank
  const submitBtn = page.locator('button[type="submit"], button:has-text("Send")').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/contact-blank-submit.png`, fullPage: true });
    const blankValidationText = await page.locator('body').innerText();
    fs.writeFileSync(`${OUT_DIR}/contact-blank-submit-text.txt`, blankValidationText);
  }

  // Test 2: invalid email format in email field, other fields filled with harmless text (XSS-safe test string), then check validation - do NOT actually submit successfully
  const emailField = page.locator('input[type="email"], input[name*="email" i]').first();
  const nameField = page.locator('input[name*="name" i]').first();
  const messageField = page.locator('textarea').first();

  if (await emailField.count() > 0) await emailField.fill('not-an-email').catch(() => {});
  if (await nameField.count() > 0) await nameField.fill('<script>alert(1)</script>').catch(() => {});
  if (await messageField.count() > 0) await messageField.fill('QA test - harmless XSS probe: <script>alert(1)</script> and unicode: مرحبا').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/contact-invalid-email-filled.png`, fullPage: true });

  if (await submitBtn.count() > 0) {
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/contact-invalid-email-submit-attempt.png`, fullPage: true });
    const invalidEmailText = await page.locator('body').innerText();
    fs.writeFileSync(`${OUT_DIR}/contact-invalid-email-submit-text.txt`, invalidEmailText);

    // Check if the script tag got reflected/executed anywhere unescaped
    const nameFieldValueAfter = await nameField.inputValue().catch(() => null);
    console.log('Name field value after XSS probe (should be literal text, not executed):', nameFieldValueAfter);
  }

  fs.writeFileSync(`${OUT_DIR}/contact-submission-requests.json`, JSON.stringify(submissionRequests, null, 2));
  console.log('POST requests fired during form tests:', submissionRequests.length);

  await browser.close();
})();
