// TC-QUOTA-01: send short messages sequentially in one chat thread, observe
// behavior at message #5 and #6. Reuses saved session (no OTP needed).
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence/quota-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const STATE_PATH = './.state/session.json';

const log = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const chatRequests = [];
  page.on('response', async (res) => {
    if (res.url().includes('backend.thaura.ai') && (res.url().includes('chat') || res.url().includes('message'))) {
      let bodySnippet = null;
      try {
        const text = await res.text();
        bodySnippet = text.slice(0, 500);
      } catch (e) {}
      chatRequests.push({ url: res.url(), status: res.status(), method: res.request().method(), bodySnippet, at: new Date().toISOString() });
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const composer = page.locator('[contenteditable="true"], textarea').first();

  for (let i = 1; i <= 6; i++) {
    const msg = `QA quota test message ${i} - reply with just OK`;
    log.push({ messageNumber: i, sentAt: new Date().toISOString(), text: msg });

    await composer.click();
    await composer.fill(msg);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(6000); // allow response to stream/complete

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const blockedIndicators = /limit|quota|upgrade|try again|reset|wait/i.test(bodyText.slice(-800));
    log[log.length - 1].blockedIndicatorSeen = blockedIndicators;

    await page.screenshot({ path: `${OUT_DIR}/msg-${i}.png`, fullPage: true });
    console.log(`Message ${i} sent. Blocked-indicator heuristic:`, blockedIndicators);
  }

  const finalBodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(`${OUT_DIR}/final-page-text.txt`, finalBodyText);
  fs.writeFileSync(`${OUT_DIR}/quota-test-log.json`, JSON.stringify(log, null, 2));
  fs.writeFileSync(`${OUT_DIR}/chat-network-requests.json`, JSON.stringify(chatRequests, null, 2));

  await browser.close();
  console.log('Quota test complete.');
})();
