const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/memory-incognito-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const netLog = [];
  page.on('request', (req) => {
    if (req.url().includes('backend.thaura.ai')) netLog.push({ method: req.method(), url: req.url() });
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Identify the ghost/incognito icon precisely
  const allButtons = await page.locator('header button, button[aria-label]').evaluateAll(els =>
    els.map(e => ({ ariaLabel: e.getAttribute('aria-label'), title: e.getAttribute('title'), html: e.outerHTML.slice(0, 150) }))
  );
  fs.writeFileSync(`${OUT_DIR}/all-buttons-probe.json`, JSON.stringify(allButtons, null, 2));

  // The ghost icon was at top-right in earlier screenshots; try clicking last header button
  const headerButtons = page.locator('header button, [class*="header" i] button');
  const count = await headerButtons.count();
  console.log('Header button count:', count);

  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = headerButtons.nth(i);
    const label = await btn.getAttribute('aria-label').catch(() => null);
    if (label && /incognito|ghost|private/i.test(label)) {
      await btn.click();
      clicked = true;
      console.log('Clicked incognito toggle via aria-label:', label);
      break;
    }
  }

  if (!clicked) {
    // Fallback: click the icon-only button at the very top-right corner
    const topRight = page.locator('svg').last();
    console.log('No labeled incognito button found; trying coordinate-based click on top-right icon area');
    await page.mouse.click(1239, 36);
    clicked = true;
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/incognito-toggle-result.png`, fullPage: true });
  fs.writeFileSync(`${OUT_DIR}/toggle-network-log.json`, JSON.stringify(netLog, null, 2));

  const bodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/post-toggle-bodytext.txt`, bodyText);
  console.log('Post-toggle body text (first 500 chars):', bodyText.slice(0, 500));

  await browser.close();
})();
