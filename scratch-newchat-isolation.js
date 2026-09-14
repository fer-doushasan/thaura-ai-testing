const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/upload-test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Attach a file in the current (fresh) composer
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.resolve('./test-data/valid/sample.pdf'));
  await page.waitForTimeout(2500);
  const urlBeforeNewChat = page.url();
  const hasAttachmentBefore = (await page.locator('text=sample.pdf').count()) > 0;
  console.log('URL before New Chat click:', urlBeforeNewChat);
  console.log('Attachment visible before New Chat click:', hasAttachmentBefore);

  // Click New Chat explicitly and wait for real navigation/state change
  const newChatBtn = page.locator('text=New Chat').first();
  await newChatBtn.click();
  await page.waitForTimeout(1500);
  const urlAfterNewChat = page.url();
  const hasAttachmentAfter = (await page.locator('text=sample.pdf').count()) > 0;
  console.log('URL after New Chat click:', urlAfterNewChat);
  console.log('Attachment still visible after New Chat click:', hasAttachmentAfter);
  console.log('URL actually changed:', urlBeforeNewChat !== urlAfterNewChat);

  await page.screenshot({ path: `${OUT_DIR}/isolation-retest-after-newchat.png`, fullPage: true });

  fs.writeFileSync(`${OUT_DIR}/newchat-isolation-retest.json`, JSON.stringify({
    urlBeforeNewChat, urlAfterNewChat, urlChanged: urlBeforeNewChat !== urlAfterNewChat,
    hasAttachmentBefore, hasAttachmentAfter,
  }, null, 2));

  await browser.close();
})();
