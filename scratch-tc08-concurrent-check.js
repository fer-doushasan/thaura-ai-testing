// TC-08 core test: are Token A (original session) and Token B (freshly, independently
// issued via a separate OTP verification) both valid AT THE SAME TIME?
const { chromium } = require('playwright');
const fs = require('fs');

const ALLOWLIST = ['exp', 'iat'];
function safeDecode(tokenValue) {
  if (!tokenValue || tokenValue.split('.').length !== 3) return { note: 'not JWT-shaped' };
  const payload = JSON.parse(Buffer.from(tokenValue.split('.')[1], 'base64').toString('utf8'));
  const out = {};
  for (const k of ALLOWLIST) if (k in payload) out[k] = payload[k];
  if (out.exp) out.expReadableUTC = new Date(out.exp * 1000).toISOString();
  if (out.iat) out.iatReadableUTC = new Date(out.iat * 1000).toISOString();
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const contextA = await browser.newContext({ storageState: './.state/session.json' });
  const contextB = await browser.newContext({ storageState: './.state/session-B.json' });

  const checkMe = async (ctx) => {
    const resp = await ctx.request.get('https://backend.thaura.ai/api/auth/me');
    return { status: resp.status(), body: await resp.text() };
  };

  const meA = await checkMe(contextA);
  const meB = await checkMe(contextB);

  const cookiesA = await contextA.cookies();
  const cookiesB = await contextB.cookies();
  const tokenA = cookiesA.find(c => c.name === 'thaura_token');
  const tokenB = cookiesB.find(c => c.name === 'thaura_token');

  const result = {
    tokensAreDifferentValues: tokenA && tokenB ? (tokenA.value !== tokenB.value) : null,
    tokenA_claims: safeDecode(tokenA ? tokenA.value : null),
    tokenB_claims: safeDecode(tokenB ? tokenB.value : null),
    meA_status: meA.status,
    meB_status: meB.status,
    bothValidSimultaneously: meA.status === 200 && meB.status === 200,
    at: new Date().toISOString(),
  };

  fs.writeFileSync('./discovery-evidence/tc08-concurrent-independent-sessions.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
