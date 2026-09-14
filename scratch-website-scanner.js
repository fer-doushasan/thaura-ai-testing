// Task 02 website scanner: crawls known public pages (unauthenticated),
// captures status/redirects, canonical/title/meta/OG/Twitter tags,
// mixed-content, console errors, failed subresource requests, and
// internal/external links for later validation.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/website-scan';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  '/', '/home', '/story', '/constitution', '/api-platform', '/download',
  '/pricing', '/faq', '/contact', '/careers', '/community', '/donate',
  '/privacy-policy', '/terms-of-service', '/data-processing-addendum', '/imprint',
];

const BASE = 'https://thaura.ai';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  for (const path of PAGES) {
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    const allRequests = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err)));
    page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
    page.on('response', (res) => {
      allRequests.push({ url: res.url(), status: res.status() });
    });

    const entry = { path, url: BASE + path };
    try {
      const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
      entry.finalUrl = page.url();
      entry.status = resp.status();
      entry.redirected = entry.finalUrl !== (BASE + path) && entry.finalUrl !== (BASE + path + '/');

      const meta = await page.evaluate(() => {
        const get = (sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; };
        const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
        const httpResources = Array.from(document.querySelectorAll('img[src], script[src], link[href]'))
          .map(el => el.getAttribute('src') || el.getAttribute('href'))
          .filter(u => u && u.startsWith('http://'));
        return {
          title: document.title,
          metaDescription: get('meta[name="description"]', 'content'),
          canonical: get('link[rel="canonical"]', 'href'),
          ogTitle: get('meta[property="og:title"]', 'content'),
          ogDescription: get('meta[property="og:description"]', 'content'),
          ogImage: get('meta[property="og:image"]', 'content'),
          ogUrl: get('meta[property="og:url"]', 'content'),
          ogType: get('meta[property="og:type"]', 'content'),
          twitterCard: get('meta[name="twitter:card"]', 'content'),
          twitterTitle: get('meta[name="twitter:title"]', 'content'),
          twitterDescription: get('meta[name="twitter:description"]', 'content'),
          twitterImage: get('meta[name="twitter:image"]', 'content'),
          links,
          httpResources,
        };
      });
      Object.assign(entry, meta);
      entry.consoleErrors = consoleErrors;
      entry.failedRequests = failedRequests;
      entry.subresourceErrorStatuses = allRequests.filter(r => r.status >= 400);
      entry.totalRequests = allRequests.length;
    } catch (e) {
      entry.error = e.message;
    }
    results.push(entry);
    console.log(`[${path}] status=${entry.status} title="${entry.title}" canonical=${entry.canonical} consoleErrors=${(entry.consoleErrors||[]).length}`);
    await page.close();
  }

  fs.writeFileSync(`${OUT_DIR}/scan-results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  console.log('\nScan complete.');
})();
