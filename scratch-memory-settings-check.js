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
      try { body = (await res.text()).slice(0, 3000); } catch (e) {}
      netLog.push({ url: res.url(), status: res.status(), method: res.request().method(), body });
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Open account menu (bottom-left "Qa Test" button), then click "Memory"
  await page.locator('text=Qa Test').last().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByText('Memory', { exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${OUT_DIR}/11-memory-settings-panel.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/memory-settings-bodytext.txt`, bodyText);
  fs.writeFileSync(`${OUT_DIR}/memory-settings-network-log.json`, JSON.stringify(netLog, null, 2));

  console.log('Memory panel text snippet:', bodyText.slice(0, 1500));
  console.log('--- network log ---');
  console.log(JSON.stringify(netLog, null, 2).slice(0, 3000));

  await browser.close();
})();
