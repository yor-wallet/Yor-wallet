/* Administration with a mocked ADMIN session. Proves: reference capital is shown apart from real funds; a refusal needs a
   reason; a disbursement confirmation needs an internal reference and sends an idempotency key; a reviewer sees no decision
   buttons; non-administrators are refused. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, PROFILE, QUOTE } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });

const admin = { id: 'a0000000-0000-0000-0000-00000000000a', email: 'admin@example.test' };
const client = PROFILE();
const APP = (o = {}) => ({ id: 'app1', reference: 'SLF-20261020-BBBB', user_id: client.user_id, requested_amount: 2000, requested_term: 6, quote: QUOTE, approved_amount: null, approved_term: null, approved_quote: null, status: 'SUBMITTED', decision_reason: null, disbursement_tx_id: null, created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-20T08:00:00Z', terms_accepted_at: '2026-10-20T08:00:00Z', ...o });
const base = (role, extra = {}) => ({
  'rpc:sulfa_ensure_profile': () => PROFILE({ user_id: admin.id, first_name: 'Admin', last_name: 'One', email: admin.email }),
  'GET:sulfa_admins': () => (role ? [{ role, active: true }] : []),
  'GET:sulfa_profiles': () => [client], 'GET:sulfa_application_events': () => [], 'GET:sulfa_installments': () => [], 'GET:sulfa_repayments': () => [], 'GET:sulfa_documents': () => [],
  ...extra,
});
const OVERVIEW = { reference_capital: 1000000, currency: 'OMR', cash_available: 0, capital_recorded: 0, receivables: 0, fee_income: 0, client_balances: 0, reserved: 0, clients: 1, applications: { SUBMITTED: 1 }, approved_amount: 0, disbursed_amount: 0, repaid_amount: 0, pending_requested: 2000, withdrawn_amount: 0, withdrawals_open: 0, documents_pending: 2, operators_enabled: 0 };

test('overview: 1,000,000.000 OMR reference capital shown apart from real funds (0.000) with a warning', { skip }, async () => {
  const s = await open(browser, { path: '/admin/', lang: 'en', user: admin, handlers: base('ADMIN', { 'rpc:sulfa_admin_overview': () => OVERVIEW }) });
  await s.page.waitForSelector('text=Reference capital (configured)');
  const t = await s.page.innerText('main');
  assert.match(t, /1,000,000\.000 OMR/); assert.match(t, /Funds actually recorded \(cash\)\s*0\.000 OMR/); assert.match(t, /No funds recorded/);
  assert.match(t, /Active external operators: 0/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('a signed-in client without an admin role is refused', { skip }, async () => {
  const s = await open(browser, { path: '/admin/', lang: 'en', user: admin, handlers: base(null) });
  await s.page.waitForSelector('text=Administrators only');
  assert.equal(s.calls.filter(c => c.key === 'rpc:sulfa_admin_overview').length, 0);
  await s.ctx.close();
});

test('decline needs a reason; the RPC receives the action and the reason', { skip }, async () => {
  let status = 'SUBMITTED';
  const s = await open(browser, { path: '/admin/applications/?id=app1', lang: 'en', user: admin, handlers: base('ADMIN', {
    'GET:sulfa_applications': () => [APP({ status })],
    'rpc:sulfa_admin_decide_application': b => { status = 'REJECTED'; return APP({ status, decision_reason: b.p_reason }); },
  }) });
  await s.page.click('main button:has-text("Decline")');
  const confirm = s.page.locator('dialog button:has-text("Decline")');
  assert.equal(await confirm.isDisabled(), true, 'no reason = no decision');
  await s.page.fill('dialog textarea', 'Income too low for the requested amount');
  await confirm.click();
  await s.page.waitForSelector('main >> text=Declined');
  const call = s.calls.find(c => c.key === 'rpc:sulfa_admin_decide_application');
  assert.deepEqual(call.body, { p_id: 'app1', p_action: 'REJECT', p_reason: 'Income too low for the requested amount', p_amount: null, p_term: null });
  await s.ctx.close();
});

test('disbursement confirmation needs the internal reference and sends an idempotency key; refusal when funds are missing is shown', { skip }, async () => {
  const s = await open(browser, { path: '/admin/applications/?id=app1', lang: 'en', user: admin, handlers: base('ADMIN', {
    'GET:sulfa_applications': () => [APP({ status: 'DISBURSEMENT_PENDING', approved_amount: 2000, approved_term: 6, approved_quote: QUOTE })],
    'rpc:sulfa_admin_disbursement': () => ({ status: 400, body: { code: '22023', message: 'sulfa_platform_funds_insufficient', details: null, hint: null } }),
  }) });
  await s.page.click('main button:has-text("Confirm the disbursement")');
  const confirm = s.page.locator('dialog button:has-text("Confirm the disbursement")');
  assert.equal(await confirm.isDisabled(), true, 'reference required');
  await s.page.fill('dialog input', 'BANK-TRF-0001');
  await confirm.click();
  await s.page.waitForSelector('dialog >> text=Insufficient platform funds');
  const call = s.calls.find(c => c.key === 'rpc:sulfa_admin_disbursement');
  assert.equal(call.body.p_action, 'CONFIRM'); assert.equal(call.body.p_internal_ref, 'BANK-TRF-0001');
  assert.match(call.body.p_idempotency_key, /^disb-/);
  await s.ctx.close();
});

test('reviewer: can read the application but gets no decision button', { skip }, async () => {
  const s = await open(browser, { path: '/admin/applications/?id=app1', lang: 'en', user: admin, handlers: base('REVIEWER', { 'GET:sulfa_applications': () => [APP()] }) });
  await s.page.waitForSelector('text=Reviewer role');
  assert.equal(await s.page.locator('main button:has-text("Approve")').count(), 0);
  await s.ctx.close();
});

test('regression: signing in through the form as an administrator lands on /admin/, not /client/', { skip }, async () => {
  const { session } = await import('./harness.mjs');
  const s = await open(browser, { path: '/login/', lang: 'en', handlers: base('SUPER_ADMIN', {
    'POST:/auth/v1/token': () => session(admin),
    'GET:sulfa_admins': async () => { await new Promise(r => setTimeout(r, 700)); return [{ role: 'SUPER_ADMIN', active: true }]; },   // slow role lookup
    'rpc:sulfa_admin_overview': () => OVERVIEW,
  }) });
  await s.page.fill('input[type=email]', admin.email); await s.page.fill('input[type=password]', 'x-test-password');
  await s.page.click('button[type=submit]');
  await s.page.waitForURL(/\/admin\/$/);
  await s.page.waitForSelector('text=Reference capital (configured)');
  assert.ok(!s.calls.some(c => c.key === 'rpc:sulfa_my_summary'), 'the client dashboard was never opened');
  await s.ctx.close();
});
