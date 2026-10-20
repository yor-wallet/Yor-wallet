/* The animated "film" on the home page. Proves: it is labelled as an illustration with fictitious data, plays on its own
   when visible, can be paused, chapters are clickable, and nothing plays for users who ask for reduced motion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, SETTINGS } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });
const h = { 'rpc:sulfa_public_settings': () => SETTINGS };
const current = page => page.$eval('#film-h ~ ol [aria-current="step"] .font-extrabold', el => el.textContent);

test('film: labelled as illustration, autoplays when visible, pause stops it, chapters jump', { skip }, async () => {
  const s = await open(browser, { lang: 'en', handlers: h });
  await s.page.locator('#film-h').scrollIntoViewIfNeeded();
  assert.match(await s.page.innerText('section:has(#film-h)'), /fictitious data/);
  assert.equal(await current(s.page), 'Sign-up');
  await s.page.waitForFunction(() => document.querySelector('#film-h ~ ol [aria-current="step"]')?.textContent.includes('ID card'), null, { timeout: 9000 });
  await s.page.click('button:has-text("Pause")');
  const at = await current(s.page);
  await s.page.waitForTimeout(6000);
  assert.equal(await current(s.page), at, 'paused = no scene change');
  await s.page.click('#film-h ~ ol button:has-text("Disbursement confirmed")');
  assert.equal(await current(s.page), 'Disbursement confirmed');
  assert.match(await s.page.innerText('.phone'), /TRF-2026-10-0001/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reduced motion: the film does not autoplay and every reveal is visible at once', { skip }, async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route('https://sulfa-e2e.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) }));
  await page.addInitScript(() => localStorage.setItem('sulfa_lang', 'en'));
  await page.goto(srv.url + '/');
  await page.locator('#film-h').scrollIntoViewIfNeeded();
  assert.match(await page.innerText('section:has(#film-h)'), /▶ Play/);
  await page.waitForTimeout(6000);
  assert.equal(await current(page), 'Sign-up');
  const hidden = await page.$$eval('.reveal', els => els.filter(e => getComputedStyle(e).opacity !== '1').length);
  assert.equal(hidden, 0);
  await ctx.close();
});
