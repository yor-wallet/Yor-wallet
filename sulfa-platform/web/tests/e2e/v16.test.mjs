/* SULFA 1.6: bank list in the withdrawal, mandatory selfie, validation e-mail status, local data engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, open, serve, PROFILE, SETTINGS } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });

const user = { id: 'c1000000-0000-0000-0000-0000000000c1', email: 'aisha@example.test' };
const admin = { id: 'a0000000-0000-0000-0000-00000000000a', email: 'admin@example.test' };
const SUMMARY = { balance: 1500, reserved: 0, available: 1500, currency: 'OMR', open_applications: 0, approved_total: 0, outstanding: 0, repaid_total: 0, next_due: null, unread: 0 };
const BANKS = [
  { code: 'BANK_MUSCAT', name_ar: 'بنك مسقط', name_en: 'Bank Muscat', kind: 'LOCAL', sort: 10 },
  { code: 'BANK_NIZWA', name_ar: 'بنك نزوى', name_en: 'Bank Nizwa', kind: 'ISLAMIC', sort: 70 },
  { code: 'QNB', name_ar: 'بنك قطر الوطني', name_en: 'Qatar National Bank', kind: 'FOREIGN', sort: 130 },
];
const client = (extra = {}) => ({ 'rpc:sulfa_ensure_profile': () => PROFILE(), 'GET:sulfa_admins': () => [], 'rpc:sulfa_public_settings': () => SETTINGS, 'rpc:sulfa_my_summary': () => SUMMARY, ...extra });

test('withdrawal: the client picks an Omani bank from the grouped, searchable list; the server receives its code', { skip }, async () => {
  const s = await open(browser, { path: '/client/withdraw/', lang: 'en', user, viewport: { width: 390, height: 844 }, handlers: client({
    'GET:sulfa_withdrawals': () => [], 'GET:sulfa_banks': () => BANKS,
    'rpc:sulfa_request_withdrawal': b => ({ id: 'w1', reference: 'SLFWD-1', amount: b.p_amount, status: 'RECEIVED', bank_name: 'Bank Nizwa / بنك نزوى', created_at: '2026-10-21T08:00:00Z' }),
  }) });
  await s.page.click('button:has-text("Choose your bank")');
  const sheet = s.page.locator('[role="dialog"][aria-label="Choose your bank"]');
  await sheet.waitFor();
  for (const g of ['Omani banks', 'Islamic banks', 'Foreign banks in Oman']) assert.match(await sheet.innerText(), new RegExp(g, 'i'));
  await sheet.locator('input').fill('نزوى');                                     // Arabic search works
  assert.equal(await sheet.locator('ul button').count(), 1);
  await sheet.locator('ul button').click();
  await s.page.waitForSelector('button:has-text("Bank Nizwa")');
  await s.page.fill('input[inputmode=decimal]', '100');
  await s.page.fill('input[dir=ltr]:not([inputmode])', 'OM0012345678');
  await s.page.click('button:has-text("Send the withdrawal request")');
  await s.page.waitForSelector('text=SLFWD-1');
  const call = s.calls.find(c => c.key === 'rpc:sulfa_request_withdrawal');
  assert.equal(call.body.p_bank_code, 'BANK_NIZWA'); assert.equal(call.body.p_bank, ''); assert.equal(call.body.p_amount, 100);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('verification: the selfie is one of the three required items; a photo is sent as document type "selfie"', { skip }, async () => {
  const s = await open(browser, { path: '/client/documents/', lang: 'en', user, handlers: client({
    'rpc:sulfa_ensure_profile': () => PROFILE({ identity_status: 'PENDING' }),
    'GET:sulfa_documents': () => [], 'POST:/storage/v1/object/*': () => ({ Key: 'sulfa-identity/x', Id: 'obj1' }), 'rpc:sulfa_register_document': () => 'doc1',
  }) });
  await s.page.waitForSelector('text=Three items are required');
  const card = s.page.locator('section:has(h3:has-text("Verification selfie"))');
  assert.match(await card.innerText(), /Required/);
  await card.locator('input[type=file]').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await card.locator('button:has-text("Send this selfie")').click();
  await s.page.waitForFunction(() => true);
  await new Promise(r => setTimeout(r, 600));
  const up = s.calls.find(c => c.key.startsWith('POST:/storage/v1/object/sulfa-identity/'));
  assert.ok(up && /\/selfie-\d+\.jpg$/.test(up.key), 'uploaded into the private bucket as selfie-….jpg');
  assert.equal(s.calls.find(c => c.key === 'rpc:sulfa_register_document').body.p_type, 'selfie');
  await s.ctx.close();
});

test('admin: after a validation the Arabic e-mail is requested and its REAL state is shown (no provider = not sent)', { skip }, async () => {
  const doc = { id: 'd1', user_id: user.id, document_type: 'selfie', storage_path: `${user.id}/selfie-1.jpg`, status: 'IN_REVIEW', review_reason: null, reviewed_at: null, created_at: '2026-10-21T08:00:00Z' };
  const s = await open(browser, { path: '/admin/documents/', lang: 'en', user: admin, handlers: {
    'rpc:sulfa_ensure_profile': () => PROFILE({ user_id: admin.id }), 'GET:sulfa_admins': () => [{ role: 'ADMIN', active: true }],
    'GET:sulfa_documents': () => [doc], 'GET:sulfa_profiles': () => [PROFILE()],
    'rpc:sulfa_admin_review_document': () => ({ ...doc, status: 'VERIFIED' }),
    'POST:/functions/v1/sulfa-mailer': () => ({ configured: false, pending: 1, sent: 0, failed: 0 }),
  } });
  await s.page.click('td button:has-text("Verify")');
  await s.page.click('dialog[open] button:has-text("Verify")');
  await s.page.waitForSelector('text=Validation e-mail not sent');
  assert.ok(s.calls.some(c => c.key === 'POST:/functions/v1/sulfa-mailer'));
  assert.ok(!(await s.page.innerText('main')).includes('e-mail sent'), 'never claims a sending that did not happen');
  await s.ctx.close();
});

test('data engine: the app reopens instantly on the last good data, then the server answer; sign-out wipes the device copy', { skip }, async () => {
  let slow = false;
  const s = await open(browser, { path: '/client/', lang: 'en', user, viewport: { width: 390, height: 844 }, handlers: client({
    'GET:sulfa_applications': () => [], 'GET:sulfa_notifications': () => [], 'GET:sulfa_installments': () => [],
    'rpc:sulfa_my_summary': async () => { if (slow) await new Promise(r => setTimeout(r, 4000)); return SUMMARY; },
  }) });
  await s.page.waitForSelector('text=1,500.000 OMR');
  assert.ok(await s.page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('sulfa:v2:'))), 'a copy is kept on the device');
  slow = true;
  const t0 = Date.now();
  await s.page.reload();
  await s.page.waitForSelector('text=1,500.000 OMR', { timeout: 2500 });
  assert.ok(Date.now() - t0 < 2500, 'shown before the slow server answered');
  await s.page.locator('nav.tabbar button:has-text("More")').click();
  await s.page.locator('[role="dialog"][aria-label="More"] button:has-text("Sign out")').click();
  await s.page.waitForURL(/\/app\/$/, { timeout: 8000 });
  assert.ok(!(await s.page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('sulfa:v2:')))), 'nothing of the session stays on the device');
  await s.ctx.close();
});
