const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/memory-incognito-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // The account trigger is the bottom-left button showing "Qa Test" / "Free Plan" (avatar OT).
  // Use role=button with accessible name matching, falling back to nearest button ancestor of the text.
  const accountBtnCandidates = await page.locator('button').evaluateAll(els =>
    els.filter(e => e.innerText && e.innerText.includes('Qa Test')).map(e => ({ text: e.innerText.slice(0, 60), outerHTML: e.outerHTML.slice(0, 200) }))
  );
  fs.writeFileSync(`${OUT_DIR}/account-button-candidates.json`, JSON.stringify(accountBtnCandidates, null, 2));

  const accountBtn = page.locator('button', { hasText: 'Qa Test' }).last();
  await accountBtn.click({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/debug-01-after-account-click.png`, fullPage: true });

  const menuText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/debug-menu-bodytext.txt`, menuText);
  console.log('Menu open? contains Memory:', menuText.includes('Memory'));

  await browser.close();
})();
