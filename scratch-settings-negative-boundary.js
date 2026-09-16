// Question 6: negative/boundary testing on the Settings/Account profile form
// (Name field - the only user-editable text field found in Settings besides
// toggles). Tests: blank submission, max-length overflow, and an XSS-style
// injection payload (self-XSS scope only - own account, own field). Restores
// the original Name afterward so the account is left as found.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/settings-negative-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ORIGINAL_NAME = 'Qa Test';
const XSS_PAYLOAD = '<script>window.__xssFired=true;</script><img src=x onerror="window.__xssFired=true">';
const LONG_NAME = 'A'.repeat(5000);

async function openSettings(page) {
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const accountBtn = page.locator('button', { hasText: 'Qa Test' }).last();
  await accountBtn.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const settingsItem = page.locator('text=Settings').first();
  await settingsItem.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function getNameField(page) {
  return page.locator('input[placeholder*="name" i], input[name="name" i]').first();
}
async function getEmailField(page) {
  return page.locator('input[placeholder*="email" i], input[type="email"], input[name="email" i]').first();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  let dialogFired = null;
  page.on('dialog', async (d) => { dialogFired = { message: d.message(), type: d.type() }; await d.dismiss(); });

  const result = { startedAt: new Date().toISOString() };

  // --- Baseline: confirm current name, check whether Email field is editable ---
  await openSettings(page);
  const nameField = await getNameField(page);
  const emailField = await getEmailField(page);
  result.nameField_found = await nameField.count() > 0;
  result.emailField_found = await emailField.count() > 0;
  result.baseline_nameValue = result.nameField_found ? await nameField.inputValue().catch(() => null) : null;
  result.emailField_editable = result.emailField_found ? !(await emailField.isDisabled().catch(() => true)) : null;
  await page.screenshot({ path: `${OUT_DIR}/00-baseline.png`, fullPage: true });

  const saveBtn = page.locator('button:has-text("Save Profile")').first();

  // --- Case 1: blank name submission ---
  if (result.nameField_found) {
    await nameField.fill('');
    await saveBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/01-blank-name-after-save.png`, fullPage: true });
    result.blankName_bodyTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 1200);
    result.blankName_fieldValueAfter = await nameField.inputValue().catch(() => null);
  }

  // --- Case 2: max-length overflow (5000 chars) ---
  if (result.nameField_found) {
    await nameField.fill(LONG_NAME);
    const acceptedLength = (await nameField.inputValue().catch(() => '')).length;
    result.longName_lengthAcceptedInField = acceptedLength; // does the input itself truncate client-side?
    await saveBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/02-long-name-after-save.png`, fullPage: true });
    result.longName_bodyTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 1200);
  }

  // --- Case 3: XSS-style injection payload in Name ---
  if (result.nameField_found) {
    await nameField.fill(XSS_PAYLOAD);
    await saveBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/03-xss-payload-after-save.png`, fullPage: true });
    result.xssPayload_dialogFired = dialogFired; // non-null would mean the script actually executed
    result.xssPayload_windowFlagSet = await page.evaluate(() => window.__xssFired === true).catch(() => false);
    result.xssPayload_rawHtmlInDom = await page.evaluate(() => document.body.innerHTML.includes('<script>window.__xssFired')).catch(() => null);
    result.xssPayload_bodyTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 1200);
    // Reload to see if a stored (not just reflected) payload would fire on fresh render
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    result.xssPayload_dialogFiredAfterReload = dialogFired;
    result.xssPayload_windowFlagSetAfterReload = await page.evaluate(() => window.__xssFired === true).catch(() => false);
    await page.screenshot({ path: `${OUT_DIR}/04-after-reload-post-xss.png`, fullPage: true });
  }

  // --- Restore original name ---
  await openSettings(page);
  const nameFieldRestore = await getNameField(page);
  if (await nameFieldRestore.count() > 0) {
    await nameFieldRestore.fill(ORIGINAL_NAME);
    await page.locator('button:has-text("Save Profile")').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    result.restoredNameValue = await nameFieldRestore.inputValue().catch(() => null);
    await page.screenshot({ path: `${OUT_DIR}/05-restored.png`, fullPage: true });
  }

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
