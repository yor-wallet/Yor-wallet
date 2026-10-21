/* Client area with a mocked signed-in session. Proves: balances come only from the server summary; an application is
   submitted with the server quote; a network cut is shown as UNCERTAIN and the retry reuses the SAME idempotency key;
   a withdrawal above the available balance is blocked before sending. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, PROFILE, QUOTE, SETTINGS } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });

const user = { id: 'c1000000-0000-0000-0000-0000000000c1', email: 'aisha@example.test' };
const SUMMARY = { balance: 1500, reserved: 200, available: 1300, currency: 'OMR', open_applications: 0, approved_total: 2000, outstanding: 1800, repaid_total: 360, next_due: { date: '2026-11-20', amount: 360, reference: 'SLF-20261020-AAAA' }, unread: 1 };
const base = (extra = {}) => ({
  'rpc:sulfa_ensure_profile': () => PROFILE(), 'GET:sulfa_admins': () => [], 'rpc:sulfa_public_settings': () => SETTINGS, 'rpc:sulfa_my_summary': () => SUMMARY,
  'GET:sulfa_applications': () => [], 'GET:sulfa_notifications': () => [{ id: 'n1', user_id: user.id, template_key: 'DISBURSEMENT_CONFIRMED', params: { amount: 2000, reference: 'SLF-1', tx_reference: 'SLFTX-9', first_due: '2026-11-20' }, entity_type: 'application', entity_id: 'a1', read_at: null, created_at: '2026-10-20T08:00:00Z' }],
  ...extra,
});

test('dashboard: amounts are the server summary, notification text is built from recorded parameters', { skip }, async () => {
  const s = await open(browser, { path: '/client/', lang: 'en', user, handlers: base() });
  await s.page.waitForSelector('text=Available balance');
  const t = await s.page.innerText('main');
  assert.match(t, /1,300\.000 OMR/); assert.match(t, /1,500\.000 OMR/); assert.match(t, /1,800\.000 OMR/);
  assert.match(t, /2,000\.000 OMR was credited to your balance \(operation SLFTX-9\)/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('not signed in: the client area redirects to login', { skip }, async () => {
  const s = await open(browser, { path: '/client/withdraw/', lang: 'en', handlers: base() });
  await s.page.waitForURL(/\/login\/\?next=%2Fclient%2Fwithdraw%2F/);
  await s.ctx.close();
});

test('apply: server quote shown, network cut = uncertain, retry sends the SAME idempotency key, then the recorded application', { skip }, async () => {
  const app = { id: 'a1', reference: 'SLF-20261020-AAAA', user_id: user.id, requested_amount: 2000, requested_term: 6, quote: QUOTE, approved_amount: null, approved_term: null, approved_quote: null, status: 'SUBMITTED', decision_reason: null, created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-20T08:00:00Z', terms_accepted_at: '2026-10-20T08:00:00Z' };
  const s = await open(browser, { path: '/client/apply/?amount=2000&term=6', lang: 'en', user, handlers: base({
    'rpc:sulfa_quote': () => QUOTE,
    'rpc:sulfa_submit_application': (_b, _u, n) => (n === 1 ? 'abort' : app),
    'GET:sulfa_applications': () => [app], 'GET:sulfa_application_events': () => [{ id: 1, application_id: 'a1', from_status: null, to_status: 'SUBMITTED', actor_role: 'CLIENT', reason: null, created_at: app.created_at }],
    'GET:sulfa_installments': () => [],
  }) });
  await s.page.click('button:has-text("Show the official calculation")');
  await s.page.waitForSelector('text=Server calculation');
  assert.match(await s.page.innerText('main'), /2,160\.000 OMR/);
  const submit = s.page.locator('button:has-text("Confirm and send my application")');
  assert.equal(await submit.isDisabled(), true, 'terms must be accepted first');
  await s.page.check('main input[type=checkbox]');
  await submit.click();
  await s.page.waitForSelector('text=Uncertain result');
  assert.doesNotMatch(await s.page.innerText('main'), /Application recorded/);
  await s.page.click('button:has-text("Check again")');
  await s.page.waitForURL(/\/client\/applications\/\?id=a1&new=1/);
  await s.page.waitForSelector('text=Application recorded');
  const sent = s.calls.filter(c => c.key === 'rpc:sulfa_submit_application').map(c => c.body);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].p_idempotency_key, sent[1].p_idempotency_key, 'same operation, same key');
  assert.deepEqual({ ...sent[0], p_idempotency_key: 'k' }, { p_amount: 2000, p_term: 6, p_accept_terms: true, p_idempotency_key: 'k' });
  await s.ctx.close();
});

test('withdrawal: more than the available balance is blocked before sending; a server refusal is certain', { skip }, async () => {
  const s = await open(browser, { path: '/client/withdraw/', lang: 'en', user, handlers: base({
    'GET:sulfa_withdrawals': () => [], 'GET:sulfa_banks': () => [],
    'rpc:sulfa_request_withdrawal': () => ({ status: 400, body: { code: '22023', message: 'sulfa_insufficient_funds', details: null, hint: null } }),
  }) });
  await s.page.waitForSelector('text=Send the withdrawal request');
  await s.page.click('button:has-text("Choose your bank")');                     // empty list mocked: "other bank" with a free name
  await s.page.click('[role="dialog"] button:has-text("Other bank")');
  await s.page.fill('form input >> nth=0', '1300.001');
  await s.page.fill('form input >> nth=1', 'Bank'); await s.page.fill('form input >> nth=3', 'OM00 1234');
  assert.match(await s.page.innerText('form'), /Insufficient available balance/);
  assert.equal(await s.page.locator('button[type=submit]').isDisabled(), true);
  await s.page.fill('form input >> nth=0', '100');
  await s.page.click('button[type=submit]');
  await s.page.waitForSelector('text=The operation was not carried out');
  assert.match(await s.page.innerText('form'), /Insufficient available balance/);
  await s.ctx.close();
});
