/* Test sur la VRAIE application (12.12.0) : l'envoi d'argent ne demande plus qu'un numéro de mobile d'Oman, puis le montant en rials ;
   AUCUN frais ; la requête envoyée au serveur est la bonne ; l'animation suit l'état RÉEL (sécurisé → envoi → confirmé / non abouti).
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

async function boot(lang = 'en', opts = {}) {
  const s = await openApp(browser, { node: null, lang, role: 'user', ...opts });
  await s.page.evaluate(() => {
    Runtime.accounts = [{ id: 'a1', type: 'MAIN', currency: 'OMR', name: 'Main OMR', balance: 500, availableBalance: 500 }];
    window.__rpc = [];
    sb.rpc = async (name, args) => {
      window.__rpc.push({ name, args });
      if (name === 'fiat_send_external') {
        if (window.__rpcDelay) await new Promise(r => setTimeout(r, window.__rpcDelay));
        if (window.__rpcFail) return { data: null, error: { message: 'boom' } };
        return { data: { ok: true, transaction_id: 'tx-1', reference: 'YOR-TX-20261017-AAAAAA', status: 'CONFIRMED', amount: args.p_amount, fee: 0, vat: 0, total: args.p_amount, exchange_rate: 1, destination_amount: args.p_amount, destination_currency: 'OMR' }, error: null };
      }
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
const shot = async (page, name, opts) => { await page.waitForTimeout(800); await page.screenshot({ path: SHOTS + '/' + name, ...(opts || {}) }); };   /* attend la fin de la transition d'écran / du tracé de la coche */
const openNumber = async (page) => { await page.evaluate(() => R.go('country-select', { force: true })); await page.waitForSelector('#sp-num'); };
const typeNumber = async (page, v) => { await page.fill('#sp-num', v); };
const enabled = (page) => page.evaluate(() => !document.getElementById('sp-next').disabled);

/* Parcours complet jusqu'au reçu : numéro seul, 10 OMR, PIN accepté (le PIN est testé ailleurs). */
async function goToReview(s, num = '9123 4567', amount = '10') {
  await openNumber(s.page);
  await typeNumber(s.page, num);
  await s.page.waitForFunction(() => !document.getElementById('sp-next').disabled);
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  await s.page.fill('#amt-input', amount);
  await s.page.waitForFunction(() => !document.getElementById('amt-next').disabled);
  await s.page.click('#amt-next');
  await s.page.waitForFunction(() => R.current() === 'tx-review');
  await s.page.evaluate(() => { PinEngine.authorize = async () => ({ ok: true, grant: 'grant-1' }); });
}
async function sendToReceipt(s, num, amount) {
  await goToReview(s, num, amount);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'receipt', null, { timeout: 15000 });
}

test('page de transfert : un seul champ, le numéro de mobile — ni pays, ni service, ni nom, ni nationalité', { skip }, async () => {
  const s = await boot();
  await openNumber(s.page);
  assert.equal(await s.page.locator('.screen.active input:not([type=hidden]), .screen.active select, .screen.active textarea').count(), 1, 'un seul champ de saisie');
  assert.equal(await s.page.locator('[data-cty], [data-svc], #id-value, #ben-first, #ben-last, #ben-nat').count(), 0, 'plus de liste de pays ni de services');
  assert.equal(await s.page.locator('.screen.active').getByText('+968').first().isVisible(), true, 'l\'indicatif d\'Oman est affiché, il ne se tape pas');
  assert.equal(await enabled(s.page), false, 'bouton bloqué tant que le numéro est vide');
  assert.equal(await s.page.getAttribute('#sp-num', 'inputmode'), 'numeric');
  assert.equal(await s.page.getAttribute('#sp-num', 'dir'), 'ltr');
  await shot(s.page, '30-transfer-number.png');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('numéro d\'Oman : 8 chiffres qui commencent par 7 ou 9 ; messages précis ; formes collées acceptées', { skip }, async () => {
  const s = await boot();
  await openNumber(s.page);
  const err = () => s.page.innerText('#sp-err');
  await typeNumber(s.page, '12345678');
  assert.match(await err(), /starts with 7 or 9/); assert.equal(await enabled(s.page), false);
  await typeNumber(s.page, '9123');
  assert.equal((await err()).trim(), '', 'pas de reproche pendant la saisie');
  await s.page.locator('#sp-num').blur();
  assert.match(await err(), /8 digits/); assert.equal(await enabled(s.page), false);
  await typeNumber(s.page, '9123 4567');
  assert.equal((await err()).trim(), ''); assert.equal(await enabled(s.page), true);
  for (const form of ['+968 9123 4567', '00968 9123-4567', '96891234567', '+96891234567', '(968) 9123 4567', '٩١٢٣٤٥٦٧', '9123.4567']) {
    await typeNumber(s.page, '');
    await typeNumber(s.page, form);
    assert.equal(await s.page.inputValue('#sp-num'), '9123 4567', 'forme collée « ' + form + ' » → ' + await s.page.inputValue('#sp-num'));
    assert.equal(await enabled(s.page), true, form);
  }
  await typeNumber(s.page, '71234567');
  assert.equal(await enabled(s.page), true, 'les numéros en 7 sont valides aussi');
  await typeNumber(s.page, '9123456789012');
  assert.equal(await s.page.inputValue('#sp-num'), '9123 4567', 'jamais plus de 8 chiffres');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('on ne peut pas s\'envoyer de l\'argent à soi-même (son propre numéro est refusé)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { Runtime.profile = { phone: '+968 9111 2222' }; });
  await openNumber(s.page);
  await typeNumber(s.page, '9111 2222');
  assert.match(await s.page.innerText('#sp-err'), /your own number/i);
  assert.equal(await enabled(s.page), false);
  await typeNumber(s.page, '9111 2223');
  assert.equal(await enabled(s.page), true);
  await s.ctx.close();
});

test('un numéro déjà enregistré dans les contacts est reconnu (nom affiché) et repris dans le bénéficiaire', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { Runtime.contacts = [{ id: 'c1', number: '+968 9234 5678', name: 'Aisha', fullName: 'Aisha Said', country: 'OM' }]; });
  await openNumber(s.page);
  await typeNumber(s.page, '9234 5678');
  await s.page.waitForSelector('#sp-known .sp-known');
  assert.match(await s.page.innerText('#sp-known'), /Saved contact[\s\S]*Aisha Said/);
  await shot(s.page, '32-transfer-known.png');
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  assert.equal(await s.page.evaluate(() => TX_STATE.beneficiary.name), 'Aisha Said');
  assert.match(await s.page.innerText('.sp-to'), /Aisha Said[\s\S]*\+968 9234 5678/);
  await s.ctx.close();
});

test('écran du montant : en rials (3 décimales), AUCUN frais, aucune TVA, aucun total ; solde insuffisant et limites refusés', { skip }, async () => {
  const s = await boot();
  await openNumber(s.page);
  await typeNumber(s.page, '9123 4567');
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  const txt = await s.page.innerText('.screen.active');
  assert.doesNotMatch(txt, /\bfees?\b|\bVAT\b|\btotal\b|\bcommission\b/i, 'aucune ligne de frais : ' + txt.replace(/\s+/g, ' '));
  assert.equal(await s.page.locator('#sum-fee, #sum-vat, #sum-total, .summary').count(), 0);
  assert.match(txt, /\+968 9123 4567/, 'le destinataire reste affiché');
  await s.page.fill('#amt-input', '10.12345');
  assert.equal(await s.page.inputValue('#amt-input'), '10.123', 'trois décimales au plus');
  await s.page.fill('#amt-input', '١٢٫٥');
  assert.equal(await s.page.inputValue('#amt-input'), '12.5', 'chiffres arabes et virgule acceptés');
  await s.page.fill('#amt-input', '0.05');
  assert.equal(await s.page.locator('#amt-next').isDisabled(), true); assert.match(await s.page.innerText('#amt-err'), /Minimum amount/);
  await s.page.fill('#amt-input', '500');
  assert.equal(await s.page.locator('#amt-next').isDisabled(), false, 'tout le solde peut être envoyé : il n\'y a pas de frais à garder');
  await s.page.fill('#amt-input', '500.001');
  assert.equal(await s.page.locator('#amt-next').isDisabled(), true); assert.match(await s.page.innerText('#amt-err'), /insufficient|balance/i);
  await s.page.fill('#amt-input', '3500');
  assert.equal(await s.page.locator('#amt-next').isDisabled(), true);
  await s.page.fill('#amt-input', '20');
  await shot(s.page, '33-transfer-amount.png');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('confirmation : montant envoyé seul (pas de frais), numéro lisible ; le serveur reçoit le bon objet', { skip }, async () => {
  const s = await boot();
  await goToReview(s);
  const rv = await s.page.innerText('.screen.active');
  assert.match(rv, /\+968 9123 4567/); assert.match(rv, /10\.000/);
  assert.doesNotMatch(rv, /\bfees?\b|\bVAT\b|\btotal\b/i, 'aucune ligne de frais à la confirmation');
  await shot(s.page, '34-transfer-review.png');
  await s.page.evaluate(() => { window.__noticeRows = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'PENDING', reason: 'sms_credits_missing' }]; });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());   /* bouton clavier (masqué à l'écran, présent pour l'accessibilité) */
  await s.page.waitForFunction(() => R.current() === 'receipt', null, { timeout: 15000 });
  const call = await s.page.evaluate(() => window.__rpc.find(c => c.name === 'fiat_send_external'));
  assert.ok(call, 'fiat_send_external appelé');
  assert.equal(call.args.p_amount, 10); assert.equal(call.args.p_dest_currency, 'OMR');
  const b = call.args.p_beneficiary;
  assert.equal(b.phone, '+96891234567', 'numéro international sans espace');
  assert.equal(b.country, 'OM'); assert.equal(b.identifierType, 'PHONE');
  assert.equal(b.firstName, ''); assert.equal(b.lastName, '');
  assert.equal('nationality' in b, false, 'la nationalité n\'est pas envoyée');
  assert.equal(call.args.p_pin_grant, 'grant-1');
  assert.equal(typeof call.args.p_idempotency_key, 'string'); assert.ok(call.args.p_idempotency_key.length >= 8);
  /* reçu : numéro une seule fois, aucune ligne « total débité » (pas de frais), état réel du message */
  await s.page.waitForSelector('#receipt-notice .receipt-row');
  const rc = await s.page.innerText('#receipt');
  assert.equal((rc.match(/\+968 9123 4567/g) || []).length, 1, 'le numéro n\'apparaît qu\'une fois');
  assert.doesNotMatch(rc, /Total debited|\bFees\b|\bVAT\b/, 'reçu sans frais');
  assert.match(rc, /FRD-TX-20261017-AAAAAA/, 'la référence affichée est « FRD-TX-… »');
  const notice = await s.page.innerText('#receipt-notice');
  assert.match(notice, /message to the recipient/i); assert.match(notice, /SMS/);
  assert.match(notice, /Waiting to be sent · no SMS credit on the provider account yet/, 'état réel et raison, jamais « envoyé » inventé');
  await shot(s.page, '35-transfer-receipt.png', { fullPage: true });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('un ancien reçu avec frais garde sa ligne « total débité » ; un reçu sans frais ne l\'affiche pas', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => {
    Runtime.receipts.push({ id: 'old', transactionId: 'tx-old', status: 'SUCCESS', amount: 5, currency: 'OMR', fee: 1, vat: 0.05, total: 6.05,
      beneficiary: { name: null, phone: '+96877986533', country: 'OM' }, network: 'Local phone transfer', reference: 'YOR-TX-20261001-OLD111', createdAt: Date.now() - 86400000 * 16 });
    window.__noticeRows = [];
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('#receipt');
  let rc = await s.page.innerText('#receipt');
  assert.match(rc, /Total debited[\s\S]*6\.050/, 'les frais réels de l\'historique restent visibles');
  assert.match(rc, /\+968 7798 6533/, 'numéro lisible');
  await s.page.evaluate(() => {
    Runtime.receipts.push({ id: 'new', transactionId: 'tx-new', status: 'SUCCESS', amount: 5, currency: 'OMR', fee: 0, vat: 0, total: 5,
      beneficiary: { name: null, phone: '+96877986533', country: 'OM' }, network: 'Local phone transfer', reference: 'YOR-TX-20261017-NEW222', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForFunction(() => /NEW222/.test(document.getElementById('receipt').innerText));
  rc = await s.page.innerText('#receipt');
  assert.doesNotMatch(rc, /Total debited/);
  await s.ctx.close();
});

test('animation d\'envoi : sécurisé → envoi (tant que le serveur n\'a pas répondu) → confirmé, puis le reçu ; jamais « confirmé » avant la réponse', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__rpcDelay = 4500; });
  await goToReview(s);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'processing');
  const phase = () => s.page.evaluate(() => (document.querySelector('.proc-view') || {}).dataset ? document.querySelector('.proc-view').dataset.phase : null);
  const label = () => s.page.evaluate(() => (document.getElementById('sx-label') || {}).textContent);
  assert.equal(await phase(), 'secure'); assert.equal(await label(), 'Securing your transfer');
  assert.match(await s.page.innerText('.proc-view'), /\+968 9123 4567/); assert.match(await s.page.innerText('.proc-view'), /10\.000/);
  await s.page.waitForFunction(() => document.querySelector('.proc-view').dataset.phase === 'send', null, { timeout: 4000 });
  assert.equal(await label(), 'Sending your money');
  await shot(s.page, '36-anim-send.png');
  await s.page.waitForTimeout(1200);
  assert.equal(await phase(), 'send', 'tant que le serveur n\'a pas répondu, l\'animation reste en « envoi »');
  assert.equal(await s.page.evaluate(() => !!document.querySelector('.sx-coin').getAttribute('transform')), true, 'la pièce voyage');
  await s.page.waitForFunction(() => document.querySelector('.proc-view') && document.querySelector('.proc-view').dataset.phase === 'success', null, { timeout: 9000 });
  assert.equal(await label(), 'Transfer confirmed');
  await shot(s.page, '37-anim-success.png');
  await s.page.waitForFunction(() => R.current() === 'receipt', null, { timeout: 6000 });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('animation d\'envoi : si le serveur refuse, elle montre « non abouti », jamais « confirmé », puis l\'écran « Transfert non abouti » (12.14.0)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__rpcFail = true; });
  await goToReview(s);
  await s.page.evaluate(() => { window.__phases = []; new MutationObserver(() => { const v = document.querySelector('.proc-view'); if (v && window.__phases[window.__phases.length - 1] !== v.dataset.phase) window.__phases.push(v.dataset.phase); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-phase'], childList: true }); });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'processing');
  await s.page.waitForFunction(() => document.querySelector('.proc-view') && document.querySelector('.proc-view').dataset.phase === 'fail', null, { timeout: 8000 });
  assert.equal(await s.page.evaluate(() => document.getElementById('sx-label').textContent), 'The transfer was not completed');
  assert.equal(await s.page.evaluate(() => document.querySelector('.proc-view').classList.contains('sx-stopped')), true, 'la pièce s\'arrête');
  await shot(s.page, '38-anim-fail.png');
  /* 12.14.0 : plus de retour silencieux à l'accueil : un écran dit que le serveur a refusé et propose Réessayer / Modifier / Accueil */
  await s.page.waitForFunction(() => R.current() === 'tx-result', null, { timeout: 6000 });
  assert.match(await s.page.innerText('#tx-result'), /Transfer not completed/);
  assert.match(await s.page.innerText('#tx-result'), /No money left your account/);
  assert.equal(await s.page.locator('[data-px="txr-check"]').count(), 0, 'un refus certain ne propose pas de « vérifier le statut »');
  const phases = await s.page.evaluate(() => window.__phases);
  assert.ok(!phases.includes('success'), 'jamais « succès » : ' + phases.join(' > '));
  assert.equal(await s.page.evaluate(() => window.__rpc.filter(c => c.name === 'fiat_send_external').length), 1, 'un seul appel, pas de nouvel essai silencieux');
  await s.ctx.close();
});

test('animation d\'envoi : « réduire les animations » = chaque état est montré sans mouvement (la pièce ne voyage pas)', { skip }, async () => {
  const s = await boot('en', { reducedMotion: true });
  await s.page.evaluate(() => { window.__rpcDelay = 2500; });
  await goToReview(s);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => document.querySelector('.proc-view') && document.querySelector('.proc-view').dataset.phase === 'send', null, { timeout: 5000 });
  await s.page.waitForTimeout(600);
  assert.equal(await s.page.evaluate(() => document.querySelector('.sx-coin').getAttribute('transform')), null, 'aucune pièce animée par script');
  await s.page.waitForFunction(() => document.querySelector('.proc-view') && document.querySelector('.proc-view').dataset.phase === 'success', null, { timeout: 8000 });
  assert.equal(await s.page.evaluate(() => document.getElementById('sx-label').textContent), 'Transfer confirmed');
  await s.ctx.close();
});

test('arabe : le sens est inversé (l\'expéditeur à droite), le numéro reste de gauche à droite, tout est traduit', { skip }, async () => {
  const s = await boot('ar');
  await openNumber(s.page);
  assert.equal(await s.page.evaluate(() => document.documentElement.dir), 'rtl');
  assert.equal(await s.page.getAttribute('#sp-num', 'dir'), 'ltr');
  assert.match(await s.page.innerText('.screen.active h1'), /لمن تريد الإرسال/);
  await typeNumber(s.page, '9123 4567');
  await shot(s.page, '39-transfer-number-ar.png');
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  await s.page.fill('#amt-input', '10');
  await s.page.click('#amt-next');
  await s.page.waitForFunction(() => R.current() === 'tx-review');
  await s.page.evaluate(() => { PinEngine.authorize = async () => ({ ok: true, grant: 'grant-1' }); window.__rpcDelay = 2500; });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'processing');
  const xs = await s.page.evaluate(() => { const a = document.querySelector('.sx-pa').getBoundingClientRect(), b = document.querySelector('.sx-pb').getBoundingClientRect(); return { a: a.x, b: b.x }; });
  assert.ok(xs.a > xs.b, 'en arabe l\'expéditeur est à droite du destinataire');
  assert.match(await s.page.evaluate(() => document.getElementById('sx-label').textContent), /تأمين/);
  await s.ctx.close();
  const e = await boot('en');
  await e.page.evaluate(() => { window.__rpcDelay = 2500; });
  await goToReview(e);
  await e.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await e.page.waitForFunction(() => R.current() === 'processing');
  const ex = await e.page.evaluate(() => { const a = document.querySelector('.sx-pa').getBoundingClientRect(), b = document.querySelector('.sx-pb').getBoundingClientRect(); return { a: a.x, b: b.x }; });
  assert.ok(ex.a < ex.b, 'en anglais l\'expéditeur est à gauche');
  await e.ctx.close();
});

test('petit écran 320 px : aucun débordement horizontal sur les 4 écrans du transfert', { skip }, async () => {
  const s = await boot('fr', { viewport: { width: 320, height: 640 } });
  const overflow = () => s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await openNumber(s.page); assert.ok((await overflow()) <= 0, 'numéro');
  await typeNumber(s.page, '9123 4567'); await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount'); assert.ok((await overflow()) <= 0, 'montant');
  await s.page.fill('#amt-input', '12.345'); await s.page.click('#amt-next');
  await s.page.waitForFunction(() => R.current() === 'tx-review'); assert.ok((await overflow()) <= 0, 'confirmation');
  await s.page.evaluate(() => { PinEngine.authorize = async () => ({ ok: true, grant: 'grant-1' }); window.__rpcDelay = 2500; });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'processing'); assert.ok((await overflow()) <= 0, 'animation');
  await shot(s.page, '40-anim-320-fr.png');
  await s.ctx.close();
});

test('reçu sans aucun message en file : aucune ligne « Message au destinataire » (rien d\'inventé)', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => { window.__noticeRows = []; });
  await s.page.evaluate(() => {
    Runtime.receipts.push({ id: 'r1', transactionId: 'tx-9', status: 'SUCCESS', amount: 5, currency: 'OMR', fee: 0, vat: 0, total: 5,
      beneficiary: { name: null, phone: '+968 77986533', country: 'OM' }, network: 'Local phone transfer', reference: 'TXN-9', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('#receipt-notice', { state: 'attached' });
  await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('#receipt-notice').isVisible(), false);
  await s.ctx.close();
});

test('après l\'envoi, l\'application demande l\'envoi du message : seulement l\'identifiant de la transaction, jamais un numéro ni un e-mail', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__noticeRows = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'PENDING', reason: null }]; window.__afterFlush = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'SENT', reason: null }]; });
  await sendToReceipt(s);
  await s.page.waitForFunction(() => /Passed to the provider/.test((document.getElementById('receipt-notice') || {}).innerText || ''), null, { timeout: 8000 });
  const calls = await s.page.evaluate(() => window.__fn);
  assert.ok(calls.length >= 1, 'la fonction send-notice est appelée');
  for (const c of calls) {
    assert.equal(c.name, 'send-notice');
    assert.deepEqual(c.opts, { body: { tx_id: 'tx-1' } }, 'le corps ne contient que l\'identifiant de la transaction');
  }
  assert.match(await s.page.innerText('#receipt-notice'), /SMS[\s\S]*Passed to the provider/, 'l\'état affiché vient de la lecture serveur après l\'envoi');
  assert.match(await s.page.innerText('#receipt-notice'), /does not prove the message arrived/, 'le reçu ne laisse pas croire que le message est arrivé');
  assert.doesNotMatch(await s.page.innerText('#receipt-notice'), /\bdelivered\b|\breceived\b/i);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

for (const mode of ['throw', 'error']) {
  test(`si la fonction d'envoi échoue (${mode}), le transfert et le reçu ne sont pas touchés ; l'état reste « en attente »`, { skip }, async () => {
    const s = await boot();
    await s.page.evaluate((m) => { window.__fnFail = m; window.__noticeRows = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'PENDING', reason: 'provider_error' }]; }, mode);
    await sendToReceipt(s);
    await s.page.waitForSelector('#receipt-notice .receipt-row');
    assert.match(await s.page.innerText('#receipt-notice'), /Waiting to be sent/);
    assert.ok((await s.page.evaluate(() => window.__fn.length)) >= 1);
    assert.ok(await s.page.evaluate(() => window.__rpc.some(c => c.name === 'fiat_send_external')), 'le transfert a bien été enregistré');
    assert.equal(await s.page.evaluate(() => R.current()), 'receipt');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  });
}

test('12.3.3 : si le premier appel de secours n\'atteint pas le serveur, un second essai part 3 s plus tard ; le reçu en refait au plus un autre ; jamais de boucle (un doublon reste sans effet côté serveur)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__fnFail = 'throw'; window.__noticeRows = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'PENDING', reason: null }]; });
  await sendToReceipt(s);
  await s.page.waitForFunction(() => window.__fn.length >= 2, null, { timeout: 8000 });
  await s.page.waitForTimeout(7500);             /* laisse passer le second essai du reçu (3 s) */
  const n1 = await s.page.evaluate(() => window.__fn.length);
  assert.ok(n1 >= 2 && n1 <= 4, 'au plus 2 essais pour l\'envoi et 2 pour le reçu : ' + n1);
  await s.page.waitForTimeout(4500);
  assert.equal(await s.page.evaluate(() => window.__fn.length), n1, 'puis plus rien : pas de boucle');
  for (const c of await s.page.evaluate(() => window.__fn)) assert.deepEqual(c.opts, { body: { tx_id: 'tx-1' } });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('un message déjà envoyé : la page de reçu n\'appelle pas la fonction une seconde fois', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => {
    window.__noticeRows = [{ channel: 'SMS', audience: 'EXTERNAL', status: 'SENT', reason: null }, { channel: 'EMAIL', audience: 'EXTERNAL', status: 'SKIPPED', reason: 'country_not_enabled' }];
    Runtime.receipts.push({ id: 'r2', transactionId: 'tx-7', status: 'SUCCESS', amount: 5, currency: 'OMR', fee: 0, vat: 0, total: 5,
      beneficiary: { name: null, phone: '+968 77986533', country: 'OM' }, network: 'Local phone transfer', reference: 'TXN-7', createdAt: Date.now() });
    R.go('receipt', { force: true });
  });
  await s.page.waitForSelector('#receipt-notice .receipt-row');
  await s.page.waitForTimeout(500);
  assert.match(await s.page.innerText('#receipt-notice'), /Transmis au fournisseur/);
  assert.match(await s.page.innerText('#receipt-notice'), /ne prouve pas que le message est arrivé/);
  assert.equal(await s.page.evaluate(() => window.__fn.length), 0, 'rien à renvoyer : aucun appel');
  await s.ctx.close();
});

test('ancien client sans sb.functions : l\'envoi du transfert fonctionne quand même', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { delete sb.functions; window.__noticeRows = []; });
  await sendToReceipt(s);
  assert.equal(await s.page.evaluate(() => R.current()), 'receipt');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
