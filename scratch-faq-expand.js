const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/claims-check';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://thaura.ai/faq', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Click every accordion question to expand answers
  const questions = await page.locator('button, [role="button"], summary').all();
  console.log('Clickable elements found:', questions.length);
  for (const q of questions) {
    try {
      const text = await q.textContent();
      if (text && text.trim().length > 5 && text.length < 150) {
        await q.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150);
      }
    } catch (e) {}
  }
  await page.waitForTimeout(1000);

  const fullText = await page.locator('body').innerText();
  fs.writeFileSync(`${OUT_DIR}/faq-expanded-text.txt`, fullText);
  console.log('Saved expanded FAQ text, length:', fullText.length);

  await browser.close();
})();
