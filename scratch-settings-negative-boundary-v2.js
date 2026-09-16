// v2: fixes v1's bug - the Settings modal auto-closes after "Save Profile", so
// reusing a locator across cases without reopening the modal produced a stale
// element and a hung script (this is what happened last run: the long-name case
// saved successfully - and revealed a real finding, no length limit, causing the
// "Happy Wednesday, {name}" header to overflow and break layout - but the script
// then hung on the XSS case because it never reopened Settings). This version
// reopens Settings fresh before every single case and restores the name inside
// the same cycle before moving on, so the account is never left in a broken
// state between steps.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/settings-negative-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ORIGINAL_NAME = 'Qa Test';
const XSS_PAYLOAD = '<script>window.__xssFired=true;</script><img src=x onerror="window.__xssFired=true">';
const LONG_NAME = 'A'.repeat(2000);

async function openSettingsFresh(page) {
  // Always start from the main page so the account-name-based selector logic is irrelevant -
  // locate the bottom-left account button by its fixed "Free Plan" sibling text instead of by name.
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  const accountBtn = page.locator('button').filter({ has: page.locator('text=Free Plan') }).first();
  await accountBtn.click({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.locator('text=Settings').first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
}

async function setNameAndSave(page, value) {
  const nameField = page.locator('input[placeholder*="name" i], input[name="name" i]').first();
  await nameField.fill(value);
  const saveBtn = page.locator('button:has-text("Save Profile")').first();
  const disabled = await saveBtn.isDisabled().catch(() => false);
  if (disabled) {
    return { saveAttempted: false, saveButtonDisabled: true };
  }
  await saveBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  return { saveAttempted: true, saveButtonDisabled: false };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  let dialogFired = null;
  page.on('dialog', async (d) => { dialogFired = { message: d.message(), type: d.type() }; await d.dismiss(); });

  const result = { startedAt: new Date().toISOString() };

  // --- Baseline ---
  await openSettingsFresh(page);
  const nameField = page.locator('input[placeholder*="name" i], input[name="name" i]').first();
  const emailField = page.locator('input[placeholder*="email" i], input[type="email"], input[name="email" i]').first();
  result.nameField_found = await nameField.count() > 0;
  result.emailField_found = await emailField.count() > 0;
  result.baseline_nameValue = await nameField.inputValue().catch(() => null);
  result.emailField_editable = result.emailField_found ? !(await emailField.isDisabled().catch(() => true)) : null;
  await page.screenshot({ path: `${OUT_DIR}/00-baseline.png`, fullPage: true });

  // --- Case 1: blank name ---
  result.blankName_saveOutcome = await setNameAndSave(page, '');
  await page.screenshot({ path: `${OUT_DIR}/01-blank-name-attempt.png`, fullPage: true });
  if (result.blankName_saveOutcome.saveAttempted) {
    result.blankName_mainPageTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    await openSettingsFresh(page);
    result.blankName_fieldValueOnReopen = await page.locator('input[placeholder*="name" i], input[name="name" i]').first().inputValue().catch(() => null);
    await setNameAndSave(page, ORIGINAL_NAME); // restore before next case
  } else {
    // Save was correctly blocked client-side; field/account were never actually changed - just close the modal.
    await page.keyboard.press('Escape').catch(() => {});
  }

  // --- Case 2: max-length overflow (2000 chars) ---
  await openSettingsFresh(page);
  await setNameAndSave(page, LONG_NAME);
  await page.screenshot({ path: `${OUT_DIR}/02-long-name-after-save.png`, fullPage: true });
  result.longName_mainPageTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
  await openSettingsFresh(page);
  const reopenedField = page.locator('input[placeholder*="name" i], input[name="name" i]').first();
  result.longName_lengthPersistedOnReopen = (await reopenedField.inputValue().catch(() => '')).length;
  await page.screenshot({ path: `${OUT_DIR}/02b-settings-modal-with-long-name.png`, fullPage: true });
  await setNameAndSave(page, ORIGINAL_NAME); // restore

  // --- Case 3: XSS-style injection payload ---
  await openSettingsFresh(page);
  await setNameAndSave(page, XSS_PAYLOAD);
  await page.screenshot({ path: `${OUT_DIR}/03-xss-payload-after-save.png`, fullPage: true });
  result.xssPayload_dialogFired = dialogFired;
  result.xssPayload_windowFlagSet = await page.evaluate(() => window.__xssFired === true).catch(() => false);
  result.xssPayload_greetingHtmlSnippet = await page.evaluate(() => {
    const h1 = document.querySelector('h1, h2') || document.body;
    return h1.outerHTML.slice(0, 500);
  }).catch(() => null);
  result.xssPayload_bodyTextSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  result.xssPayload_dialogFiredAfterReload = dialogFired;
  result.xssPayload_windowFlagSetAfterReload = await page.evaluate(() => window.__xssFired === true).catch(() => false);
  await page.screenshot({ path: `${OUT_DIR}/04-after-reload-post-xss.png`, fullPage: true });
  await openSettingsFresh(page);
  await setNameAndSave(page, ORIGINAL_NAME); // restore

  // --- Final confirmation ---
  await openSettingsFresh(page);
  result.finalRestoredValue = await page.locator('input[placeholder*="name" i], input[name="name" i]').first().inputValue().catch(() => null);
  await page.screenshot({ path: `${OUT_DIR}/05-final-restored.png`, fullPage: true });

  result.endedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
