/* 12.3.2 — Test sur la VRAIE application : la confirmation du débit envoyée à l'expéditeur (réglage du numéro, reçu, adaptation par service).
   Supabase est un faux client qui enregistre les appels (aucun envoi réel, aucun SMS). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { available, launch, openApp } from './ui-harness.mjs';

const SHOTS = process.env.YOR_SHOTS || resolve(dirname(fileURLToPath(import.meta.url)), '../../.shots');
mkdirSync(SHOTS, { recursive: true });
const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

async function boot(lang = 'en', role = 'user') {
  const s = await openApp(browser, { node: null, lang, role });
  await s.page.evaluate(() => {
    Runtime.accounts = [{ id: 'a1', type: 'MAIN', currency: 'OMR', name: 'Main OMR', balance: 500, availableBalance: 500 }];
    window.__rpc = [];
    sb.rpc = async (name, args) => {
      window.__rpc.push({ name, args });
      if (name === 'fiat_send_external') return { data: { ok: true, transaction_id: 'tx-1', reference: 'TXN-TEST1', status: 'CONFIRMED', amount: args.p_amount, fee: 0, vat: 0, total: args.p_amount, exchange_rate: 1, destination_amount: args.p_amount, destination_currency: 'OMR' }, error: null };
      if (name === 'get_recipient_notice_status') return { data: window.__noticeRows || [], error: null };
      return { data: null, error: null };
    };
    /* faux appel de la fonction d'envoi des messages : il enregistre ce qu'on lui envoie, il n'envoie rien */
    window.__fn = [];
    sb.functions = { invoke: async (name, opts) => {
      window.__fn.push({ name, opts });
      if (window.__fnFail === 'throw') throw new Error('network down');
      if (window.__fnFail === 'error') return { data: null, error: { message: 'boom' } };
      if (window.__afterFlush) window.__noticeRows = window.__afterFlush;
      return { data: { processed: 1 }, error: null };
    } };
  });
  return s;
}
/* Parcours complet jusqu'au reçu (12.12.0 : numéro d'Oman seul, 10 OMR, PIN accepté — le PIN est testé ailleurs). */
async function sendToReceipt(s, number = '9876 5432') {
  await s.page.evaluate(() => R.go('country-select', { force: true }));
  await s.page.waitForSelector('#sp-num');
  await s.page.fill('#sp-num', number);
  await s.page.waitForFunction(() => !document.getElementById('sp-next').disabled);
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  await s.page.fill('#amt-input', '10');
  await s.page.waitForFunction(() => !document.getElementById('amt-next').disabled);
  await s.page.click('#amt-next');
  await s.page.waitForFunction(() => R.current() === 'tx-review');
  await s.page.evaluate(() => { PinEngine.authorize = async () => ({ ok: true, grant: 'grant-1' }); });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'receipt', null, { timeout: 15000 });
}


/* le clavier d'un téléphone se ferme avant l'appui : on le reproduit.
   L'application ignore un 2e appui sur le même bouton moins de 450 ms après le précédent (UIKit GUARD_MS) : on attend plus longtemps. */
const tapSave = async (page) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(700);
  await page.click('#confirm-phone-save');
};
const SENDER_ROWS = [
  { channel: 'SMS', audience: 'SENDER', status: 'SKIPPED', reason: 'no_sender_phone' },
  { channel: 'EMAIL', audience: 'SENDER', status: 'PENDING', reason: null },
  { channel: 'SMS', audience: 'EXTERNAL', status: 'PENDING', reason: null },
];

test('réglages : champ « numéro pour les confirmations SMS », refus d\'un numéro sans indicatif, enregistrement normalisé dans les préférences de la personne', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => {
    window.__docs = [];
    Runtime.settings = Object.assign({ theme: 'dark' }, Runtime.settings || {}); Runtime.security = Runtime.security || {}; Runtime.contacts = Runtime.contacts || []; Runtime.bankAccounts = Runtime.bankAccounts || [];
    Runtime.profile = Runtime.profile || { firstName: 'Test', lastName: 'User' }; Runtime.ctx = Object.assign({ yorId: 'YORTEST', role: 'user', uid: 'u-1' }, Runtime.ctx || {});
    UserContext.requireCtx = () => ({ uid: 'u-1', role: 'user' });
    UserDataEngine.writeDoc = async (uid, name, data) => { window.__docs.push({ uid, name, data }); };
    R.go('settings', { force: true });
  });
  await s.page.waitForSelector('#confirm-phone');
  assert.match(await s.page.innerText('#screens'), /SMS confirmation number/i);
  await s.page.fill('#confirm-phone', '77986533');
  await tapSave(s.page);
  assert.match(await s.page.innerText('#confirm-phone-err'), /country code/i, 'un numéro sans indicatif est refusé');
  assert.equal(await s.page.evaluate(() => window.__docs.length), 0, 'rien n\'est enregistré');
  await s.page.fill('#confirm-phone', 'abc');
  await tapSave(s.page);
  assert.equal(await s.page.evaluate(() => window.__docs.length), 0);
  await s.page.fill('#confirm-phone', '00968 7798 6533');
  await tapSave(s.page);
  await s.page.waitForFunction(() => window.__docs.length === 1);
  const doc = await s.page.evaluate(() => window.__docs[0]);
  assert.equal(doc.name, 'preferences');
  assert.equal(doc.data.confirmPhone, '+96877986533', 'le préfixe 00 devient +, espaces retirés');
  assert.equal(await s.page.evaluate(() => Runtime.settings.confirmPhone), '+96877986533');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('réglages : un numéro vide supprime le numéro enregistré ; le champ est pré-rempli', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => {
    window.__docs = [];
    Runtime.settings = Object.assign({ theme: 'dark' }, Runtime.settings || {}); Runtime.security = Runtime.security || {}; Runtime.contacts = Runtime.contacts || []; Runtime.bankAccounts = Runtime.bankAccounts || [];
    Runtime.profile = Runtime.profile || { firstName: 'Test', lastName: 'User' }; Runtime.ctx = Object.assign({ yorId: 'YORTEST', role: 'user', uid: 'u-1' }, Runtime.ctx || {});
    UserContext.requireCtx = () => ({ uid: 'u-1', role: 'user' });
    UserDataEngine.writeDoc = async (uid, name, data) => { window.__docs.push({ uid, name, data }); };
    Runtime.settings.confirmPhone = '+96877986533';
    R.go('settings', { force: true });
  });
  await s.page.waitForSelector('#confirm-phone');
  assert.equal(await s.page.inputValue('#confirm-phone'), '+96877986533');
  await s.page.fill('#confirm-phone', '');
  await tapSave(s.page);
  await s.page.waitForFunction(() => window.__docs.length === 1);
  assert.equal(await s.page.evaluate(() => window.__docs[0].data.confirmPhone), '');
  await s.ctx.close();
});

test('normalizeConfirmPhone : formats acceptés et refusés', { skip }, async () => {
  const s = await boot();
  const r = await s.page.evaluate(() => ['+968 7798 6533', '00968 77986533', '(+225) 07-00-00-00-00', '', '   ', '77986533', '+12', 'abc', '+968 7798 65A3', '+9686'.padEnd(20, '1')].map(normalizeConfirmPhone));
  assert.deepEqual(r, ['+96877986533', '+96877986533', '+2250700000000', '', '', null, null, null, null, null]);
  await s.ctx.close();
});

test('ancien reçu Orange Money (Côte d\'Ivoire, avec frais) : confirmation à l\'expéditeur + message au bénéficiaire, montant en FCFA ET montant débité en OMR', { skip }, async () => {
  /* l'envoi vers l'étranger n'est plus proposé (12.12.0), mais l'historique garde ces reçus et ils doivent rester exacts */
  const s = await boot();
  await s.page.evaluate((rows) => {
    window.__noticeRows = rows;
    Runtime.receipts.push({ id: 'r-ci', transactionId: 'tx-ci', status: 'SUCCESS', amount: 10, currency: 'OMR', fee: 1, vat: 0.05, total: 11.05,
      destinationAmount: 11225, destinationCurrency: 'XOF', exchangeRate: 1122.5, beneficiary: { name: null, phone: '+225 07 00 00 00 00', country: 'CI' }, network: 'Orange Money', reference: 'TXN-CI1', createdAt: Date.now() - 86400000 * 9 });
    R.go('receipt', { force: true });
  }, SENDER_ROWS);
  await s.page.waitForSelector('#receipt-notice .receipt-row');
  const notice = await s.page.innerText('#receipt-notice');
  assert.match(notice, /confirmation sent to you/i);
  assert.match(notice, /message to the recipient/i);
  assert.match(notice, /add your number in Settings/i, 'sans numéro enregistré, le reçu l\'explique');
  assert.ok(notice.search(/confirmation sent to you/i) < notice.search(/message to the recipient/i), 'la confirmation à l\'expéditeur vient en premier');
  const rc = await s.page.innerText('#receipt');
  assert.match(rc, /≈\s*[\d,. ]+\s*XOF/, 'montant en FCFA sous le montant principal');
  assert.match(rc, /Recipient receives/i);
  assert.match(rc, /Rate/);
  assert.match(rc, /Total debited[\s\S]*OMR|OMR[\s\S]*Total debited/i, 'les frais réels de l\'ancien envoi restent visibles');
  await s.page.waitForTimeout(800);
  await s.page.screenshot({ path: SHOTS + '/32-receipt-orange-sender.png', fullPage: true });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu Oman (numéro de mobile, OMR → OMR) : tout en OMR, aucune ligne « bénéficiaire reçoit », taux ni frais', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate((rows) => { window.__noticeRows = rows; }, SENDER_ROWS);
  await sendToReceipt(s, '9876 5432');
  await s.page.waitForSelector('#receipt-notice .receipt-row');
  const call = await s.page.evaluate(() => window.__rpc.find(c => c.name === 'fiat_send_external'));
  assert.equal(call.args.p_dest_currency, 'OMR');
  const rc = await s.page.innerText('#receipt');
  assert.doesNotMatch(rc, /Recipient receives/i);
  assert.doesNotMatch(rc, /\bRate\b/);
  assert.doesNotMatch(rc, /≈/);
  assert.doesNotMatch(rc, /XOF|AED/);
  assert.doesNotMatch(rc, /Total debited|\bFees\b|\bVAT\b/i, 'aucun frais : le total débité est le montant envoyé');
  assert.match(await s.page.innerText('#receipt-notice'), /confirmation sent to you/i);
  await s.page.waitForTimeout(800);
  await s.page.screenshot({ path: SHOTS + '/33-receipt-oman-sender.png', fullPage: true });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu en français : titres et états de la confirmation à l\'expéditeur', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => {
    window.__noticeRows = [{ channel: 'SMS', audience: 'SENDER', status: 'SENT', reason: null }, { channel: 'EMAIL', audience: 'SENDER', status: 'SENT', reason: null }];
    Runtime.receipts.push({ id: 'r3', transactionId: 'tx-5', status: 'SUCCESS', amount: 1, currency: 'OMR', fee: 0.1, vat: 0.005, total: 1.105,
      destinationAmount: 1980, destinationCurrency: 'XOF', exchangeRate: 1980, beneficiary: { name: null, phone: '+225 07 00 00 00 00', country: 'CI' }, network: 'Orange Money', reference: 'TXN-5', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('#receipt-notice .receipt-row');
  const notice = await s.page.innerText('#receipt-notice');
  assert.match(notice, /confirmation qui vous est envoyée/i);
  assert.doesNotMatch(notice, /message au destinataire/i, 'aucun message au bénéficiaire dans cette file');
  assert.match(notice, /Transmis au fournisseur/);
  assert.match(await s.page.innerText('#receipt'), /1\s?980\s?XOF/);
  await s.ctx.close();
});

test('crypto : aucun message (le reçu n\'affiche aucune section de confirmation)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => {
    window.__noticeRows = [];
    Runtime.receipts.push({ id: 'r4', transactionId: 'tx-c1', status: 'SUCCESS', amount: 5, asset: 'USDT', network: 'TRON', fee: 0, total: 5, reference: 'TXN-C1', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('#receipt-notice', { state: 'attached' });
  await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('#receipt-notice').isVisible(), false);
  assert.equal(await s.page.evaluate(() => window.__fn.length), 0);
  await s.ctx.close();
});

/* 12.3.4 — le reçu montre le numéro de l'expéditeur (« De / From »), le même que celui vu par le destinataire dans le SMS. */
test('numéro de l\'expéditeur : normalisation (indicatif pays, 00, sans +), jamais inventé', { skip }, async () => {
  const s = await boot();
  const out = await s.page.evaluate(() => {
    const run = (settings, profile) => { Runtime.settings = settings; Runtime.profile = profile; return receiptSenderPhone(); };
    return {
      spaced: run({ confirmPhone: '+968 7798 6533' }, { country: 'OM', phone: '' }),
      local: run({ confirmPhone: '77986533' }, { country: 'OM', phone: '' }),
      intlNoPlus: run({ confirmPhone: '96877986533' }, { country: 'OM', phone: '' }),
      doubleZero: run({ confirmPhone: '0096877986533' }, { country: 'OM', phone: '' }),
      profileFallback: run({}, { country: 'OM', phone: '+968 7523 5685' }),
      settingsWin: run({ confirmPhone: '+968 7798 6533' }, { country: 'OM', phone: '+968 7523 5685' }),
      empty: run({}, { country: 'OM', phone: '' }),
      tooShort: run({ confirmPhone: '123' }, { country: 'OM', phone: '' }),
    };
  });
  assert.deepEqual(out, { spaced: '+96877986533', local: '+96877986533', intlNoPlus: '+96877986533', doubleZero: '+96877986533',
    profileFallback: '+96875235685', settingsWin: '+96877986533', empty: '', tooShort: '' });
  await s.ctx.close();
});

test('reçu : ligne « De » avec le numéro de l\'expéditeur (réglage), absente sans numéro, absente en crypto, présente dans l\'export', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__noticeRows = []; });
  await sendToReceipt(s, '9876 5432');
  /* le faux magasin de données renvoie des réglages vides après le transfert : on pose le numéro puis on rouvre le reçu */
  await s.page.evaluate(() => { Runtime.settings = Object.assign({}, Runtime.settings, { confirmPhone: '+968 7798 6533' }); R.go('receipt', { force: true }); });
  await s.page.waitForSelector('#receipt-from');
  const from = await s.page.innerText('#receipt-from');
  assert.match(from, /From/);
  assert.match(from, /\+96877986533/);
  const view = await s.page.evaluate(() => window.__YOR_LAST_RECEIPT_VIEW__.fromPhone);
  assert.equal(view, '+96877986533');
  assert.doesNotMatch(await s.page.innerText('#receipt'), /Bank Muscat/i, 'aucun nom de banque tierce sur le reçu');
  /* sans numéro : pas de ligne (rien d'inventé) */
  await s.page.evaluate(() => {
    Runtime.settings = Object.assign({}, Runtime.settings, { confirmPhone: '' }); Runtime.profile = Object.assign({}, Runtime.profile, { phone: '' });
    Runtime.receipts.push({ id: 'r9', transactionId: 'tx-9', status: 'SUCCESS', amount: 1, currency: 'OMR', fee: 0.1, vat: 0.005, total: 1.105, beneficiary: { phone: '+968 9876 5432', country: 'OM' }, reference: 'TXN-9', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('.receipt-view');
  assert.equal(await s.page.locator('#receipt-from').count(), 0);
  /* crypto : pas de ligne */
  await s.page.evaluate(() => {
    Runtime.settings = Object.assign({}, Runtime.settings, { confirmPhone: '+968 7798 6533' });
    Runtime.receipts.push({ id: 'r10', transactionId: 'tx-c2', status: 'SUCCESS', amount: 5, asset: 'USDT', network: 'TRON', fee: 0, total: 5, reference: 'TXN-C2', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('.receipt-view');
  assert.equal(await s.page.locator('#receipt-from').count(), 0);
  await s.ctx.close();
});

test('reçu en arabe et en français : libellé « من » / « De »', { skip }, async () => {
  for (const [lang, re] of [['fr', /De\b/], ['ar', /من/]]) {
    const s = await boot(lang);
    await s.page.evaluate((l) => {
      LANG = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';   /* openApp ne règle que fr / en */
      Runtime.settings = Object.assign({}, Runtime.settings, { confirmPhone: '+968 7798 6533' });
      Runtime.receipts.push({ id: 'r11', transactionId: 'tx-11', status: 'SUCCESS', amount: 1, currency: 'OMR', fee: 0.1, vat: 0.005, total: 1.105, beneficiary: { phone: '+968 9876 5432', country: 'OM' }, reference: 'TXN-11', createdAt: Date.now() });
      R.go('receipt', { force: true });
    }, lang);
    await s.page.waitForSelector('#receipt-from');
    assert.match(await s.page.innerText('#receipt-from'), re);
    assert.match(await s.page.innerText('#receipt-from'), /\+96877986533/);
    await s.ctx.close();
  }
});
