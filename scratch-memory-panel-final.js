const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/memory-incognito-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const netLog = [];
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai') && /memor/i.test(res.url())) {
      let body = null;
      try { body = (await res.text()).slice(0, 4000); } catch (e) {}
      netLog.push({ url: res.url(), status: res.status(), method: res.request().method(), body });
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const accountBtn = page.locator('button', { hasText: 'Qa Test' }).last();
  await accountBtn.click({ timeout: 10000 });
  await page.waitForTimeout(800);

  // Click the "Memory" menu item specifically (role=menuitem or plain text button in the opened dropdown)
  const memoryItem = page.locator('[role="menuitem"], button, div').filter({ hasText: /^Memory$/ }).last();
  const count = await memoryItem.count();
  console.log('Memory item candidates:', count);
  await memoryItem.click({ timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${OUT_DIR}/11-memory-settings-panel.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/memory-settings-bodytext.txt`, bodyText);
  fs.writeFileSync(`${OUT_DIR}/memory-settings-network-log.json`, JSON.stringify(netLog, null, 2));

  console.log('=== MEMORY PANEL TEXT ===');
  console.log(bodyText.slice(0, 2000));
  console.log('=== NETWORK LOG ===');
  console.log(JSON.stringify(netLog, null, 2).slice(0, 4000));

  await browser.close();
})();
