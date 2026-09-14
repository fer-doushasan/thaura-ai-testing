// Memory vs Incognito testing.
// 1. Send a distinctive fact in Chat A, check recall in unrelated Chat B (memory persistence).
// 2. Toggle Incognito, send a distinctive fact, check it does NOT appear in sidebar history.
// 3. Exit Incognito, start a new normal chat, check the incognito fact does NOT leak into memory.
const { chromium } = require('playwright');
const fs = require('fs');
const STATE_PATH = './.state/session.json';
const OUT_DIR = './discovery-evidence/memory-incognito-test';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const MEMORY_MARKER = 'GOLDFISH-4471';
const INCOGNITO_MARKER = 'PURPLEZEBRA-9902';

const log = {};

async function sendMessage(page, text, waitMs = 8000) {
  const composer = page.locator('[contenteditable="true"], textarea').first();
  await composer.click();
  await composer.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(waitMs);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const chatNetworkLog = [];
  page.on('request', (req) => {
    if (req.url().includes('/v1/chat/completions') || req.url().includes('/api/chats')) {
      chatNetworkLog.push({ method: req.method(), url: req.url(), postDataSnippet: (req.postData() || '').slice(0, 300) });
    }
  });

  await page.goto('https://thaura.ai/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // --- Step 1: Chat A - plant the memory fact ---
  await page.locator('text=New Chat').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await sendMessage(page, `Please remember this fact for future conversations: my test memory marker is ${MEMORY_MARKER}.`);
  await page.screenshot({ path: `${OUT_DIR}/01-chatA-planted.png`, fullPage: true });

  // --- Step 2: Chat B - unrelated new chat, test recall ---
  await page.locator('text=New Chat').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await sendMessage(page, 'What is my test memory marker? If you do not know, say you do not know.');
  await page.screenshot({ path: `${OUT_DIR}/02-chatB-recall-attempt.png`, fullPage: true });
  const chatBText = await page.locator('body').innerText().catch(() => '');
  log.memoryRecallSuccess = chatBText.includes(MEMORY_MARKER);
  log.chatBTextSnippet = chatBText.slice(-1500);

  // --- Step 3: Toggle Incognito ---
  const ghostIcon = page.locator('[aria-label*="incognito" i]').first();
  let incognitoToggled = false;
  if (await ghostIcon.count() > 0) {
    await ghostIcon.click();
    incognitoToggled = true;
  } else {
    // fallback: try the top-right ghost-shaped icon button
    const topRightBtn = page.locator('header button, button').filter({ hasText: '' }).last();
    console.log('No aria-label incognito icon found, attempting fallback selector');
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/03-after-incognito-toggle.png`, fullPage: true });
  log.incognitoToggledViaAriaLabel = incognitoToggled;

  // --- Step 4: Send a message while (presumably) in incognito ---
  await sendMessage(page, `Please remember this fact: my incognito marker is ${INCOGNITO_MARKER}.`);
  await page.screenshot({ path: `${OUT_DIR}/04-incognito-chat-sent.png`, fullPage: true });

  // --- Step 5: Check sidebar for this chat appearing in history ---
  const sidebarText = await page.locator('nav, aside, [class*="sidebar" i]').first().innerText().catch(async () => await page.locator('body').innerText());
  log.incognitoAppearsInSidebar = sidebarText.includes(INCOGNITO_MARKER.slice(0, 6)) || /incognito/i.test(sidebarText) === false ? sidebarText.toLowerCase().includes('incognito marker') : false;
  log.sidebarTextSnippet = sidebarText.slice(0, 1000);
  fs.writeFileSync(`${OUT_DIR}/sidebar-after-incognito.txt`, sidebarText);

  // --- Step 6: Turn OFF incognito, start new normal chat, test for leakage ---
  const ghostIconOff = page.locator('[aria-label*="incognito" i]').first();
  if (await ghostIconOff.count() > 0) {
    await ghostIconOff.click();
    await page.waitForTimeout(800);
  }
  await page.locator('text=New Chat').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await sendMessage(page, 'What is my incognito marker? If you do not know, say you do not know.');
  await page.screenshot({ path: `${OUT_DIR}/05-post-incognito-leak-check.png`, fullPage: true });
  const leakCheckText = await page.locator('body').innerText().catch(() => '');
  log.incognitoLeakedIntoMemory = leakCheckText.includes(INCOGNITO_MARKER);
  log.leakCheckTextSnippet = leakCheckText.slice(-1500);

  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(log, null, 2));
  fs.writeFileSync(`${OUT_DIR}/chat-network-log.json`, JSON.stringify(chatNetworkLog, null, 2));
  console.log('Memory/Incognito test complete.');
  console.log('memoryRecallSuccess:', log.memoryRecallSuccess);
  console.log('incognitoToggledViaAriaLabel:', log.incognitoToggledViaAriaLabel);
  console.log('incognitoLeakedIntoMemory:', log.incognitoLeakedIntoMemory);

  await browser.close();
})();
