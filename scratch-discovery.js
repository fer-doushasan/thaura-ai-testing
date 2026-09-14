// Read-only discovery script. Does NOT sign up, log in, or submit any forms.
// Purpose: capture network requests, console output, and DOM structure of the
// public marketing site to identify routes, endpoints, and auth entry points.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = './discovery-evidence';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const requests = [];
const consoleMsgs = [];
const pageErrors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 QA-Assessment-Discovery'
  });
  const page = await context.newPage();

  page.on('request', (req) => {
    requests.push({ method: req.method(), url: req.url(), resourceType: req.resourceType() });
  });
  page.on('response', async (res) => {
    const req = res.request();
    const entry = requests.find(r => r.url === req.url() && !r.status);
    if (entry) entry.status = res.status();
  });
  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });

  console.log('Navigating to homepage...');
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${OUT_DIR}/01-homepage.png`, fullPage: true });

  // Capture cookies after homepage load
  const cookies = await context.cookies();
  fs.writeFileSync(`${OUT_DIR}/cookies-homepage.json`, JSON.stringify(cookies, null, 2));

  // Find all visible links/buttons text on homepage (nav + CTAs)
  const navLinks = await page.$$eval('a[href]', (els) =>
    els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') }))
       .filter(l => l.text)
  );
  fs.writeFileSync(`${OUT_DIR}/homepage-links.json`, JSON.stringify(navLinks, null, 2));

  // Look for a "Try Thaura" / "Get Started" / "Login" style entry point
  const candidateTexts = ['Try Thaura', 'Get Started', 'Sign in', 'Sign up', 'Log in', 'Login', 'Start building', 'Get Your API Key'];
  let clicked = null;
  for (const text of candidateTexts) {
    const locator = page.locator(`text=${text}`).first();
    if (await locator.count() > 0) {
      try {
        const href = await locator.evaluate(el => el.closest('a')?.getAttribute('href') || el.getAttribute('href'));
        console.log(`Found candidate CTA "${text}" -> href=${href}`);
        if (!clicked) clicked = { text, href };
      } catch (e) {}
    }
  }
  fs.writeFileSync(`${OUT_DIR}/candidate-cta.json`, JSON.stringify(clicked, null, 2));

  // Try clicking the primary CTA to see where it navigates (read-only: just observe URL/DOM, don't submit anything)
  if (clicked) {
    try {
      const locator = page.locator(`text=${clicked.text}`).first();
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
        locator.click({ timeout: 10000 }),
      ]);
      await page.waitForTimeout(2000);
      console.log('After click, URL =', page.url());
      await page.screenshot({ path: `${OUT_DIR}/02-after-cta-click.png`, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(`${OUT_DIR}/after-cta-click.html`, html);
      fs.writeFileSync(`${OUT_DIR}/after-cta-click-url.txt`, page.url());
    } catch (e) {
      console.log('Click failed:', e.message);
    }
  }

  fs.writeFileSync(`${OUT_DIR}/network-requests.json`, JSON.stringify(requests, null, 2));
  fs.writeFileSync(`${OUT_DIR}/console-messages.json`, JSON.stringify(consoleMsgs, null, 2));
  fs.writeFileSync(`${OUT_DIR}/page-errors.json`, JSON.stringify(pageErrors, null, 2));

  await browser.close();
  console.log('Discovery complete. Requests captured:', requests.length);
})();
