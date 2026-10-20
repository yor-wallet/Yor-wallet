/* Charts and insights show real, computed numbers. 2000 OMR / 6 months, 2 % fee, 1 %/month: cost 160 = 8 %,
   one month less saves 20, one month more costs 20; balance 2160 → 0. Client dashboard figures come from installment rows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, PROFILE, QUOTE, SETTINGS } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });

test('simulator analysis: breakdown, remaining-balance chart with tooltip, computed insights, table view', { skip }, async () => {
  const s = await open(browser, { path: '/simulator/', lang: 'en', handlers: { 'rpc:sulfa_public_settings': () => SETTINGS } });
  await s.page.click('button:has-text("6 months")');
  await s.page.$eval('#sim-amount', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2000'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await s.page.waitForSelector('text=Analysis of your simulation');
  const t = await s.page.innerText('main');
  assert.match(t, /total cost \(fees \+ financing cost\) is 160\.000 OMR, i\.e\. 8 %/);
  assert.match(t, /Over 5 months: instalment 428\.000 OMR, and 20\.000 OMR less/);
  assert.match(t, /Over 7 months: instalment 311\.429 OMR, but 20\.000 OMR more/);
  assert.match(t, /92\.6 %/); assert.match(t, /5\.6 %/); assert.match(t, /1\.9 %/);          // 2000 / 120 / 40 of 2160
  const svg = s.page.locator('figure:has-text("Left to repay after each instalment") svg');
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  await s.page.mouse.move(box.x + 10, box.y + box.height / 2);
  await s.page.mouse.move(box.x + (64 + (560 - 78) / 6) / 560 * box.width, box.y + box.height / 2, { steps: 5 });   // over instalment 1
  const tip = s.page.locator('figure:has-text("Left to repay after each instalment") div.pointer-events-none');
  await tip.waitFor();
  assert.match(await tip.innerText(), /After instalment 1\s+Left 1,800\.000 OMR/);
  await s.page.click('summary:has-text("Show the data as a table")');
  assert.match(await s.page.innerText('figure:has-text("Left to repay after each instalment") table'), /After instalment 6\s+0\.000 OMR/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('client dashboard: share repaid and schedule chart from the real installment rows, projected payoff date', { skip }, async () => {
  const user = { id: 'c1000000-0000-0000-0000-0000000000c1', email: 'aisha@example.test' };
  const app = { id: 'a1', reference: 'SLF-20261020-AAAA', user_id: user.id, requested_amount: 2000, requested_term: 6, quote: QUOTE, approved_amount: 2000, approved_term: 6, approved_quote: QUOTE, status: 'DISBURSED', created_at: '2026-10-20T08:00:00Z' };
  const inst = [1, 2, 3, 4, 5, 6].map(n => ({ id: 'i' + n, application_id: 'a1', seq: n, due_date: `2026-${String(10 + n > 12 ? n - 2 : 10 + n).padStart(2, '0')}-20`.replace(/^2026-(0[1-4])/, '2027-$1'), amount_due: 360, amount_paid: n === 1 ? 360 : n === 2 ? 100 : 0, status: n === 1 ? 'PAID' : n === 2 ? 'PARTIAL' : 'DUE' }));
  const s = await open(browser, { path: '/client/', lang: 'en', user, handlers: {
    'rpc:sulfa_ensure_profile': () => PROFILE(), 'GET:sulfa_admins': () => [],
    'rpc:sulfa_my_summary': () => ({ balance: 0, reserved: 0, available: 0, open_applications: 0, approved_total: 2000, outstanding: 1700, repaid_total: 460, next_due: { date: inst[1].due_date, amount: 260, reference: app.reference }, unread: 0 }),
    'GET:sulfa_applications': () => [app], 'GET:sulfa_notifications': () => [], 'GET:sulfa_installments': () => inst } });
  await s.page.waitForSelector('text=Share repaid');
  const t = await s.page.innerText('main');
  assert.match(t, /460\.000 OMR repaid out of 2,160\.000 OMR/);
  assert.match(t, /21%/);                                                                  // 460 / 2160
  assert.match(t, /fully repaid on 20 Apr 2027/);
  assert.match(t, /Schedule of SLF-20261020-AAAA/);
  assert.equal(await s.page.locator('figure:has-text("Schedule of") svg g').count(), 6);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('characters: labelled for screen readers, the film shows a character per scene', { skip }, async () => {
  const s = await open(browser, { lang: 'en', handlers: { 'rpc:sulfa_public_settings': () => SETTINGS } });
  assert.ok(await s.page.locator('img[aria-label="Aisha, client"]').count() >= 1);
  assert.match(await s.page.innerText('#cast-h ~ p, section:has(#cast-h)'), /Illustrative AI-generated portraits/);
  await s.page.locator('#film-h').scrollIntoViewIfNeeded();
  await s.page.click('#film-h ~ ol button:has-text("Verification")');
  await s.page.waitForSelector('section:has(#film-h) img[aria-label="Maryam, administrator"]');
  await s.ctx.close();
});
