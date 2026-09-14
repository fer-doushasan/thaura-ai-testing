const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const OUT_DIR = './discovery-evidence/lighthouse';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = {
  home: 'https://thaura.ai/home',
  pricing: 'https://thaura.ai/pricing',
  api: 'https://thaura.ai/api-platform',
  faq: 'https://thaura.ai/faq',
};

async function run() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  const options = { logLevel: 'error', output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], port: chrome.port };

  const summary = {};
  for (const [key, url] of Object.entries(PAGES)) {
    console.log(`Running Lighthouse for ${key} (${url})...`);
    try {
      const runnerResult = await lighthouse(url, options);
      fs.writeFileSync(`${OUT_DIR}/${key}-full-report.json`, runnerResult.report);
      const lhr = runnerResult.lhr;
      summary[key] = {
        url,
        performance: lhr.categories.performance?.score,
        accessibility: lhr.categories.accessibility?.score,
        bestPractices: lhr.categories['best-practices']?.score,
        seo: lhr.categories.seo?.score,
        LCP: lhr.audits['largest-contentful-paint']?.displayValue,
        CLS: lhr.audits['cumulative-layout-shift']?.displayValue,
        TBT: lhr.audits['total-blocking-time']?.displayValue,
        TTFB: lhr.audits['server-response-time']?.displayValue,
        speedIndex: lhr.audits['speed-index']?.displayValue,
        totalByteWeight: lhr.audits['total-byte-weight']?.displayValue,
        requestCount: lhr.audits['network-requests']?.details?.items?.length,
      };
      console.log(`[${key}] Perf=${summary[key].performance} A11y=${summary[key].accessibility} BP=${summary[key].bestPractices} SEO=${summary[key].seo} LCP=${summary[key].LCP} CLS=${summary[key].CLS}`);
    } catch (e) {
      summary[key] = { url, error: e.message };
      console.log(`[${key}] ERROR: ${e.message}`);
    }
  }

  fs.writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  await chrome.kill();
  console.log('\nLighthouse audits complete.');
}
run();
