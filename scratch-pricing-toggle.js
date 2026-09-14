const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/website-scan';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://thaura.ai/pricing', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${OUT_DIR}/pricing-default-state.png`, fullPage: true });
  const defaultText = await page.locator('body').innerText();

  // Try clicking "Monthly" and "Annual" toggle options explicitly
  const monthlyBtn = page.locator('text=Monthly').first();
  const annualBtn = page.locator('text=Annual').first();

  let monthlyText = null, annualText = null;
  if (await monthlyBtn.count() > 0) {
    await monthlyBtn.click().catch(() => {});
    await page.waitForTimeout(800);
    monthlyText = await page.locator('body').innerText();
    await page.screenshot({ path: `${OUT_DIR}/pricing-monthly-selected.png`, fullPage: true });
  }
  if (await annualBtn.count() > 0) {
    await annualBtn.click().catch(() => {});
    await page.waitForTimeout(800);
    annualText = await page.locator('body').innerText();
    await page.screenshot({ path: `${OUT_DIR}/pricing-annual-selected.png`, fullPage: true });
  }

  const extractPriceLines = (text) => {
    if (!text) return null;
    return text.split('\n').filter(l => l.includes('$') || l.toLowerCase().includes('month') || l.toLowerCase().includes('year') || l.toLowerCase().includes('save'));
  };

  const result = {
    defaultPriceLines: extractPriceLines(defaultText),
    monthlyPriceLines: extractPriceLines(monthlyText),
    annualPriceLines: extractPriceLines(annualText),
  };
  fs.writeFileSync(`${OUT_DIR}/pricing-toggle-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
