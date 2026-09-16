// Item 2 (rolling vs fixed window) experiment - anchor message.
// Sends exactly 1 precisely-timestamped message, then this experiment will be
// checked again ~5 hours later (via a scheduled follow-up) to see whether the
// quota fully resets to 5 (fixed batch window) or only partially credits back
// (rolling/per-message window).
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './.state/session.json' });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const quotaBefore = await (await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check')).json();

  const sentAt = new Date().toISOString();
  const composer = page.locator('[contenteditable="true"], textarea').first();
  await composer.click();
  await composer.fill('QA window-type-experiment anchor message - reply with just OK');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000);

  const quotaAfter = await (await context.request.get('https://backend.thaura.ai/api/chats/rate-limit/check')).json();

  const fiveHoursLaterISO = new Date(new Date(sentAt).getTime() + 5 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(); // +5h5m buffer

  const record = {
    experiment: 'TC-quota-window-type (fixed vs rolling)',
    anchorMessageSentAt: sentAt,
    quotaBefore,
    quotaAfter,
    checkAfterUTC: fiveHoursLaterISO,
    instructions: 'At checkAfterUTC or later, call GET /api/chats/rate-limit/check with the same session. If remaining returns to 5 (or resetAt clears having been null all along), that indicates a FIXED batch window anchored to this single message. If remaining only shows partial/no change consistent with a per-message timer, that indicates a ROLLING window.',
  };
  fs.writeFileSync('./discovery-evidence/quota-test/tc-window-type-experiment.json', JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));

  await browser.close();
})();
