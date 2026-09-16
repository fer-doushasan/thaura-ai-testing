const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './.state/session.json' });

  const resp = await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check');
  const quotaNow = await resp.json();

  const experiment = JSON.parse(fs.readFileSync('./discovery-evidence/quota-test/tc-window-type-experiment.json', 'utf8'));

  const result = {
    checkedAt: new Date().toISOString(),
    checkAfterUTC: experiment.checkAfterUTC,
    anchorMessageSentAt: experiment.anchorMessageSentAt,
    quotaBefore: experiment.quotaBefore,
    quotaAfterAnchor: experiment.quotaAfter,
    quotaNow,
  };

  fs.writeFileSync('./discovery-evidence/quota-test/tc-window-type-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
