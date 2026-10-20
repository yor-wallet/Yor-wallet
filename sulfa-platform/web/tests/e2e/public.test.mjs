/* Real static build in Chromium. Proves: Arabic RTL by default, language switch, simulator = server settings,
   no horizontal scroll on phones, honest "not loaded" state. Does NOT prove: rendering on a real iPhone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, SETTINGS } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });

const settings = { 'rpc:sulfa_public_settings': () => SETTINGS };

test('home: Arabic and right-to-left by default, brand and honest card note', { skip }, async () => {
  const s = await open(browser, { handlers: settings });
  await s.page.waitForSelector('h1');
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await s.page.getAttribute('html', 'lang'), 'ar');
  assert.match(await s.page.innerText('h1'), /خطوتك نحو/);
  assert.match(await s.page.innerText('main'), /لا توجد موافقة تلقائية/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('language switch: French then English, direction follows, choice is remembered', { skip }, async () => {
  const s = await open(browser, { handlers: settings });
  await s.page.selectOption('header select', 'fr');
  await s.page.waitForFunction(() => document.documentElement.dir === 'ltr');
  assert.match(await s.page.innerText('h1'), /Votre pas vers/);
  await s.page.selectOption('header select', 'en');
  await s.page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.match(await s.page.innerText('h1'), /Your step towards/);
  await s.page.reload(); await s.page.waitForSelector('h1');
  assert.equal(await s.page.getAttribute('html', 'lang'), 'en');
  await s.ctx.close();
});

test('simulator uses the administrator settings read from the server (2 % fee, 1 %/month)', { skip }, async () => {
  const s = await open(browser, { path: '/simulator/', lang: 'en', handlers: settings });
  await s.page.click('button:has-text("6 months")');
  await s.page.$eval('#sim-amount', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2000'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await s.page.waitForFunction(() => document.body.innerText.includes('360.000'));
  const txt = await s.page.innerText('main');
  assert.match(txt, /40\.000 OMR/); assert.match(txt, /120\.000 OMR/); assert.match(txt, /2,160\.000 OMR/);
  assert.doesNotMatch(txt, /could not be loaded/);
  assert.ok(s.calls.some(c => c.key === 'rpc:sulfa_public_settings'));
  await s.ctx.close();
});

test('simulator says so when the settings cannot be loaded (no invented fees)', { skip }, async () => {
  const s = await open(browser, { path: '/simulator/', lang: 'en', handlers: { 'rpc:sulfa_public_settings': () => 'abort' } });
  await s.page.waitForSelector('text=could not be loaded');
  await s.ctx.close();
});

test('phone width (375 px): no page wider than the screen, in Arabic and French', { skip }, async () => {
  for (const lang of ['ar', 'fr']) {
    for (const path of ['/', '/how-it-works/', '/simulator/', '/eligibility/', '/faq/', '/about/', '/help/', '/contact/', '/privacy/', '/terms/', '/regulatory/', '/login/', '/signup/', '/forgot-password/']) {
      const s = await open(browser, { path, lang, handlers: settings, viewport: { width: 375, height: 812 } });
      await s.page.waitForSelector('main');
      const w = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(w.sw <= w.cw, `${lang} ${path}: ${w.sw} > ${w.cw}`);
      assert.deepEqual(s.errors, [], `${lang} ${path}`);
      await s.ctx.close();
    }
  }
});

test('regulatory page claims no licence; signup refuses minors and bad phone numbers before any call', { skip }, async () => {
  const r = await open(browser, { path: '/regulatory/', lang: 'en', handlers: settings });
  const t = await r.page.innerText('main');
  assert.match(t, /does not claim that SULFA holds a licence/); assert.match(t, /Central Bank of Oman/);
  await r.ctx.close();
  const s = await open(browser, { path: '/signup/', lang: 'en', handlers: settings });
  await s.page.fill('input[autocomplete=given-name]', 'Aisha'); await s.page.fill('input[autocomplete=family-name]', 'Said');
  await s.page.fill('input[type=email]', 'aisha@example.test'); await s.page.fill('input[type=tel]', '9001');
  await s.page.fill('input[type=date]', '2015-01-01');
  await s.page.fill('input[autocomplete=new-password] >> nth=0', 'abcdefgh'); await s.page.fill('input[autocomplete=new-password] >> nth=1', 'abcdefgh');
  await s.page.check('input[type=checkbox]');
  await s.page.click('button[type=submit]');
  const txt = await s.page.innerText('form');
  assert.match(txt, /at least 18/); assert.match(txt, /\+968… format/);
  assert.equal(s.calls.filter(c => c.key.includes('/auth/v1/signup')).length, 0);
  await s.ctx.close();
});
