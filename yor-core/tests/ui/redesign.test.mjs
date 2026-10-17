/* Refonte 12.4.0 (design système) sur la VRAIE application : index.html réel + CSP réelle ; Supabase remplacé par un faux client sans session.
   Les données ci-dessous sont des données de TEST injectées dans Runtime par ce fichier uniquement (jamais dans le produit).
   Ce que ces tests prouvent : le statut réel pilote le reçu et les listes ; l'accueil n'affiche que des valeurs lues ; les cartes ne se disent ni
   « Visa », ni « Mastercard », ni « actives » sans émetteur réel ; mise en page sans débordement ; mouvement réduit ; impression du reçu.
   Ce qu'ils NE prouvent PAS : le rendu sur un vrai iPhone / Android, ni l'impression sur papier. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { available, launch, openApp, WEB } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

/* données de test : un transfert réussi, un en cours, un échoué, un reçu en entrée, un envoi crypto */
const seed = () => {
  const now = Date.now();
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000', photo: null };
  Runtime.accounts = [
    { id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 1250.5, availableBalance: 1250.5, reservedBalance: 0, status: 'ACTIVE', country: 'OM' },
    { id: 'a2', type: 'WEST_AFRICA', name: 'West Africa XOF', currency: 'XOF', balance: 85000, availableBalance: 85000, reservedBalance: 0, status: 'ACTIVE', country: 'CI' }
  ];
  Runtime.transactions = [
    { id: 't1', reference: 'YOR-TX-OK-0001', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'SUCCESS', currency: 'OMR', amount: 20, fee: 0.5, vat: 0, total: 20.5, createdAt: now - 3600e3, beneficiary: { name: 'Aisha Said', phone: '+96891234567', country: 'OM' } },
    { id: 't2', reference: 'YOR-TX-IN-0002', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'IN', status: 'CONFIRMED', currency: 'OMR', amount: 45.25, fee: 0, vat: 0, total: 45.25, createdAt: now - 7200e3, beneficiary: { name: 'Khalid Nasser' } },
    { id: 't3', reference: 'YOR-TX-CR-0003', kind: 'CRYPTO_SEND', type: 'CRYPTO_SEND', direction: 'OUT', status: 'SUCCESS', asset: 'USDT', network: 'tron', currency: 'OMR', amount: 325, fee: 1.2, vat: 0, total: 326.2, createdAt: now - 86400e3 },
    { id: 't4', reference: 'YOR-TX-PEND-0004', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'PENDING', currency: 'OMR', amount: 10, fee: 0.3, vat: 0, total: 10.3, createdAt: now - 90000e3, beneficiary: { name: 'Orange Money', phone: '+2250700000000' } },
    { id: 't5', reference: 'YOR-TX-FAIL-0005', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'FAILED', currency: 'OMR', amount: 5, fee: 0, vat: 0, total: 5, createdAt: now - 200000e3, beneficiary: { name: 'Test Failed' } }
  ];
  /* cartes « héritées » : avec cvv et status ACTIVE, comme les anciennes données ; elles ne doivent PAS être présentées comme actives */
  Runtime.cards = [
    { id: 'c1', type: 'VIRTUAL', brand: 'YOR', theme: 'midnight', holderName: 'SAJAD AJMI', number: '9701123412341234', expiryMonth: 10, expiryYear: 2030, cvv: '123', currency: 'OMR', frozen: false, contactless: true, online: true, atm: true, monthlyLimit: 0, label: '', status: 'ACTIVE', createdAt: now },
    { id: 'c2', type: 'VIRTUAL', brand: 'YOR', theme: 'metal', holderName: 'SAJAD AJMI', number: '9701999988887777', cvv: '456', currency: 'OMR', frozen: true, label: 'Online', status: 'ACTIVE', createdAt: now }
  ];
  Runtime.notifications = [{ id: 'n1', title: 'x', message: 'y', read: false, createdAt: now }];
  Runtime.receipts = [];
};
const open = async (opts = {}) => {
  const s = await openApp(browser, opts);
  await s.page.evaluate(seed);
  if (opts.lang === 'ar') await s.page.evaluate(() => { DeviceLang.set('ar'); LANG = 'ar'; applyI18n(); });
  if (opts.theme) await s.page.evaluate(th => document.documentElement.setAttribute('data-theme', th), opts.theme);
  return s;
};
const receiptFor = async (page, txId) => {
  await page.evaluate(id => {
    const tx = Runtime.transactions.find(x => x.id === id);
    Runtime.receipts = [{ id: 'r-' + id, transactionId: id, status: 'SUCCESS' /* le snapshot dit SUCCESS : c'est le statut RÉEL de la transaction qui doit gagner */, createdAt: tx.createdAt, amount: tx.amount, currency: tx.currency, fee: tx.fee, vat: 0, total: tx.total, reference: tx.reference, beneficiary: tx.beneficiary }];
    return R.go('receipt', { force: true });
  }, txId);
  await page.waitForSelector('#receipt .receipt-view');
};
const noOverflow = async (page, label) => {
  const m = await page.evaluate(() => { const s = document.querySelector('.screen.active'); return { sw: s.scrollWidth, cw: s.clientWidth }; });
  assert.ok(m.sw <= m.cw + 1, `${label} : débordement horizontal (${m.sw} > ${m.cw})`);
};

test('txState : seul un statut confirmé est « success » ; échec = « failed » ; tout le reste (même inconnu ou absent) = « pending »', { skip }, async () => {
  const s = await open();
  const r = await s.page.evaluate(() => ['SUCCESS', 'confirmed', 'COMPLETED', 'FAILED', 'rejected', 'CANCELLED', 'REFUNDED', 'reversed', 'PENDING', 'PROCESSING', 'weird', '', null, undefined].map(x => txState(x)));
  assert.deepEqual(r, ['success', 'success', 'success', 'failed', 'failed', 'failed', 'failed', 'failed', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu : le STATUT RÉEL pilote l\'écran (réussi / en cours / échoué), jamais un échec ou un « en cours » présenté comme un succès', { skip }, async () => {
  const s = await open();
  await receiptFor(s.page, 't1');
  assert.ok(await s.page.locator('.receipt-view.rc-success').count(), 'réussi');
  let txt = await s.page.innerText('#receipt');
  assert.match(txt, /Transfer successful/); assert.match(txt, /Total debited/); assert.match(txt, /FRD-TX-OK-0001/); assert.doesNotMatch(txt, /YOR-TX/, 'la référence affichée est celle de Friendly (FRD-), jamais YOR-');
  assert.equal(await s.page.getAttribute('.rc-badge', 'aria-label'), 'Completed');

  await receiptFor(s.page, 't4');
  assert.ok(await s.page.locator('.receipt-view.rc-pending').count(), 'en cours');
  txt = await s.page.innerText('#receipt');
  assert.doesNotMatch(txt, /Transfer successful/, 'un transfert en cours ne dit pas « réussi »');
  assert.match(txt, /in progress/i);
  assert.equal(await s.page.getAttribute('.rc-badge', 'aria-label'), 'In progress');

  await receiptFor(s.page, 't5');
  assert.ok(await s.page.locator('.receipt-view.rc-failed').count(), 'échoué');
  txt = await s.page.innerText('#receipt');
  assert.doesNotMatch(txt, /Transfer successful/, 'un échec ne dit pas « réussi »');
  assert.doesNotMatch(txt, /Total debited/, 'un échec n\'affiche pas de débit');
  assert.match(txt, /failed/i);
  assert.equal(await s.page.getAttribute('.rc-badge', 'aria-label'), 'Failed');

  await receiptFor(s.page, 't2');   /* reçu entrant : libellé « reçu », pas de frais ni de débit */
  txt = await s.page.innerText('#receipt');
  assert.match(txt, /Money received/); assert.match(txt, /Amount received/); assert.doesNotMatch(txt, /Total debited/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu : copier la référence écrit la vraie référence dans le presse-papiers (aucune référence inventée)', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => { window.__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async v => { window.__clip.push(v); } }, configurable: true }); });
  await receiptFor(s.page, 't5');
  await s.page.click('.rc-copy');
  await s.page.waitForFunction(() => window.__clip.length === 1);
  assert.deepEqual(await s.page.evaluate(() => window.__clip), ['FRD-TX-FAIL-0005'], 'on copie la référence affichée (FRD-) ; elle est retrouvée telle quelle par la recherche');
  assert.equal(await s.page.innerText('#receipt-ref'), 'FRD-TX-FAIL-0005');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('accueil : valeurs LUES uniquement ; bouton masquer/afficher ; 4 actions rapides qui existent (sans crypto) ; aucun pourcentage inventé', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('.ds-balance');
  /* 12.6.0 : le solde s'affiche en dollars par défaut ; le montant d'origine (OMR) et le taux écrit restent visibles */
  assert.match(await s.page.innerText('.ds-bal-amt'), /3,252\.30/);
  assert.match(await s.page.innerText('.ds-bal-orig'), /OMR 1,250\.500.*1 OMR = 2\.6008 USD/);
  const home = await s.page.innerText('.ds-home');
  assert.doesNotMatch(home, /%/, 'aucun pourcentage (les cours crypto sont une table statique, pas du direct)');
  assert.equal(await s.page.locator('.rv-acts [data-nav]').count(), 4, 'actions rapides : ' + (await s.page.$$eval('.rv-acts [data-nav]', els => els.map(e => e.getAttribute('data-nav')))).join(','));
  assert.equal(await s.page.locator('.rv-acts [data-nav^="crypto"]').count(), 0, 'plus aucune action crypto');
  /* masquer : le montant et les montants de la liste disparaissent, rien n'est fabriqué */
  await s.page.evaluate(() => { Runtime.hideBalance = true; return R.go('home', { force: true }); });
  assert.doesNotMatch(await s.page.innerText('.ds-bal-amt'), /\d/);
  const amts = await s.page.$$eval('.ds-home .item-amount', els => els.map(e => e.textContent.trim()));
  assert.ok(amts.length > 0 && amts.every(a => a === '••••'), 'montants masqués : ' + amts.join(','));
  assert.equal(await s.page.getAttribute('.ds-eye', 'aria-pressed'), 'true');
  await s.page.evaluate(() => { Runtime.hideBalance = false; });
  /* chaque action rapide ouvre bien l'écran annoncé */
  for (const nav of ['country-select', 'history', 'services']) {
    await s.page.evaluate(() => R.go('home', { force: true }));
    await s.page.click(`.rv-acts [data-nav="${nav}"]`);
    await s.page.waitForFunction(n => R.current() === n, nav, { timeout: 5000 });
  }
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('accueil : sans transaction → état vide honnête ; avant chargement → squelette sans aucun chiffre', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => { Runtime.transactions = []; return R.go('home', { force: true }); });
  assert.match(await s.page.innerText('.ds-home'), /No transactions yet/);
  assert.equal(await s.page.locator('.ds-home .tx-row').count(), 0);
  await s.page.evaluate(() => { Runtime.profile = null; Runtime.ctx = null; Runtime.accounts = []; return R.go('home', { force: true }); });
  await s.page.waitForSelector('.sk');
  assert.ok(await s.page.locator('[aria-busy="true"]').count());
  assert.doesNotMatch(await s.page.innerText('#home'), /\d/, 'le squelette ne montre aucun chiffre');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('historique : groupé par jour, statuts réels visibles ; filtres « en cours » / « échouées » ; les lignes restent cliquables après un filtre', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => R.go('history', { force: true }));
  await s.page.waitForSelector('#history-list .tx-row');
  assert.ok(await s.page.locator('.rv-day').count() >= 3, 'groupes par jour');
  assert.equal(await s.page.locator('.tx-row.st-failed').count(), 1);
  assert.equal(await s.page.locator('.tx-row.st-pending').count(), 1);
  assert.match(await s.page.innerText('.tx-row.st-failed'), /Failed/);
  assert.match(await s.page.innerText('.tx-row.st-pending'), /In progress/);
  await s.page.click('[data-filter="pending"]');
  assert.equal(await s.page.locator('#history-list .tx-row').count(), 1);
  assert.match(await s.page.innerText('#history-list'), /Orange Money/);
  await s.page.click('[data-filter="failed"]');
  assert.equal(await s.page.locator('#history-list .tx-row').count(), 1);
  await s.page.click('#history-list .tx-row');
  await s.page.waitForFunction(() => R.current() === 'receipt');
  assert.ok(await s.page.locator('.receipt-view.rc-failed').count(), 'le reçu ouvert depuis la liste filtrée est celui de la transaction échouée');
  assert.equal(await s.page.evaluate(() => Runtime.receipts.length), 1, 'un seul reçu créé (pas de double clic)');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('cartes : « Aperçu » tant qu\'aucun émetteur réel n\'existe ; aucun Visa / Mastercard / CVV / puce / numéro complet ; l\'emplacement réseau reste vide', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => R.go('cards', { force: true }));
  await s.page.waitForSelector('.rv-card');
  const html = await s.page.evaluate(() => document.getElementById('cards').innerHTML);
  assert.doesNotMatch(html, /visa|mastercard|network-mark|rv-chip|rv-nfc/i);
  const txt = await s.page.innerText('#cards');
  assert.doesNotMatch(txt, /\bcvv\b/i); assert.doesNotMatch(txt, /\bactive\b/i);
  assert.doesNotMatch(html, /9701123412341234|9701 1234 1234 1234/, 'le numéro complet n\'est pas dans la page avant le code PIN');
  assert.equal(await s.page.locator('.rv-net-slot').count(), 0);
  assert.doesNotMatch(txt, /Preview cards|not issued yet/i, '12.9.0 : plus de mention « aperçu / non émise » sur les cartes');
  assert.match(txt, /not a payment card number/i, 'la référence de carte Friendly n\'est jamais présentée comme un numéro de carte de paiement');
  assert.equal(await s.page.locator('.rv-state.s-preview').count(), 0, 'aucune étiquette sur une carte non émise');
  assert.equal(await s.page.locator('.rv-state.s-frozen').count(), 1, 'la carte gelée est annoncée gelée');
  assert.match(txt, /No card activity/, 'pas d\'activité inventée');
  /* quand la donnée de la carte porte un vrai réseau ET un vrai émetteur : l'emplacement s'affiche et la carte est « Active » */
  await s.page.evaluate(() => { Runtime.cards[0].network = 'TESTNET'; Runtime.cards[0].issuer = 'TEST ISSUER'; Runtime.cards[0].issued = true; return R.go('cards', { force: true }); });
  assert.equal(await s.page.locator('.rv-net-slot').count(), 1);
  assert.match(await s.page.innerText('.rv-slide[data-i="0"] .rv-state'), /Active/i);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('cartes : les 7 designs (dont Obsidian) existent ; créer une carte = aperçu sans CVV, sans option « physique », sans réseau', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => R.go('cards-add', { force: true }));
  await s.page.waitForSelector('#rv-nsw .rv-swatch');
  assert.equal(await s.page.locator('#rv-nsw .rv-swatch').count(), 7);
  const t = await s.page.innerText('#cards-add');
  assert.doesNotMatch(t, /physical|physique|cvv|visa|mastercard/i);
  assert.match(t, /not a payment card number/i);
  await s.page.click('[data-rv="newTheme:metal"]');
  assert.ok(await s.page.locator('#rv-prev .rv-card.th-metal').count());
  await s.page.click('[data-rv="create"]');
  await s.page.waitForFunction(() => R.current() === 'cards', null, { timeout: 8000 });
  const c = await s.page.evaluate(() => Runtime.cards[0]);
  assert.equal(c.theme, 'metal'); assert.equal(c.issued, false); assert.equal(c.status, 'PREVIEW'); assert.equal(c.type, 'VIRTUAL');
  assert.ok(!('cvv' in c) && !('network' in c) && !('expiryMonth' in c), 'aucun CVV, réseau ni date d\'expiration fabriqués : ' + Object.keys(c).join(','));
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('cartes : toucher une carte ouvre ses détails ; l\'ID de carte n\'est pas affiché sans PIN', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => R.go('cards', { force: true }));
  await s.page.waitForSelector('.rv-card');
  await s.page.click('.rv-slide[data-i="0"] .rv-card .rv-front');
  await s.page.waitForFunction(() => R.current() === 'card-settings');
  const html = await s.page.evaluate(() => document.getElementById('card-settings').innerHTML);
  assert.doesNotMatch(html, /9701123412341234|9701 1234 1234 1234/);
  const t = await s.page.innerText('#card-settings');
  assert.match(t, /Card details/); assert.match(t, /Protected by your PIN/); assert.match(t, /not a payment card number/i);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

for (const [name, viewport] of [['320', { width: 320, height: 640 }], ['390', { width: 390, height: 844 }], ['768', { width: 768, height: 1024 }], ['1440', { width: 1440, height: 900 }]]) {
  for (const [theme, lang] of [['dark', 'en'], ['light', 'fr'], ['dark', 'ar']]) {
    test(`mise en page ${name}px ${theme}/${lang} : aucun débordement horizontal (accueil, cartes, historique, reçu échoué, détails de carte)`, { skip }, async () => {
      const s = await open({ viewport, theme, lang });
      for (const sc of ['home', 'cards', 'history', 'card-settings', 'cards-add']) {
        await s.page.evaluate(x => R.go(x, { force: true }), sc);
        await s.page.waitForTimeout(450);
        await noOverflow(s.page, `${sc} ${name}/${theme}/${lang}`);
      }
      await receiptFor(s.page, 't5');
      await s.page.waitForTimeout(450);
      await noOverflow(s.page, `receipt ${name}/${theme}/${lang}`);
      assert.deepEqual(s.errors, []);
      await s.ctx.close();
    });
  }
}

test('mouvement réduit : le reçu s\'affiche directement dans son état final (pas d\'animation de tracé)', { skip }, async () => {
  const s = await open();
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await receiptFor(s.page, 't1');
  const r = await s.page.evaluate(() => { const c = getComputedStyle(document.querySelector('.rc-badge .rc-c')); return { an: c.animationName, off: c.strokeDashoffset }; });
  assert.equal(r.an, 'none'); assert.equal(parseFloat(r.off), 0);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('impression : seul le reçu s\'imprime (barres de navigation et boutons masqués)', { skip }, async () => {
  const s = await open();
  await receiptFor(s.page, 't1');
  await s.page.emulateMedia({ media: 'print' });
  const d = await s.page.evaluate(() => ['.receipt-actions', '.rc-done', '#bottom-nav', '.rc-copy'].map(q => { const e = document.querySelector(q); return e ? getComputedStyle(e).display : 'absent'; }));
  assert.ok(d.every(x => x === 'none' || x === 'absent'), 'masqués à l\'impression : ' + d.join(','));
  assert.ok(await s.page.isVisible('.rc-sheet'));
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('code : aucune marque tierce (Visa, Mastercard, Binance, Revolut, BMCT) dans le JS, le CSS, le HTML et les SVG de l\'app', { skip }, async () => {
  const bad = /\bvisa\b|mastercard|binance|revolut|\bBMCT\b/i;
  const hits = [];
  const walk = d => { for (const f of readdirSync(d)) { const p = resolve(d, f); const st = statSync(p); if (st.isDirectory()) { if (!/node_modules|\.git$|^vendor$|^walletconnect$/.test(f)) walk(p); } else if (/\.(js|css|html|svg|webmanifest)$/.test(f)) { const t = readFileSync(p, 'utf8'); if (bad.test(t)) hits.push(p.replace(WEB, '')); } } };
  walk(WEB);
  assert.deepEqual(hits, [], 'marques tierces trouvées : ' + hits.join(', '));
});

/* ---------- reçu exporté (PNG / PDF) : l'affiche suit le statut RÉEL, comme l'écran ---------- */
const posterOf = (page) => page.evaluate(() => ReceiptExport.svg(window.__YOR_LAST_RECEIPT__, window.__YOR_LAST_RECEIPT_VIEW__));
const decode = (s) => s.replace(/<[^>]+>/g, '|').replace(/&amp;/g, '&');

test('reçu exporté : réussi = vert + « Total debited » ; en cours = ambre, jamais « successful » ; échoué = rouge, aucune ligne de débit', { skip }, async () => {
  const s = await open();
  await receiptFor(s.page, 't1');
  let svg = await posterOf(s.page);
  assert.match(svg, /#0F7B4A/); assert.match(decode(svg), /Transfer successful/); assert.match(decode(svg), /Total debited/); assert.match(decode(svg), /FRD-TX-OK-0001/);
  assert.match(decode(svg), /Friendly Pay/); assert.doesNotMatch(decode(svg), /NEX WALLET|YOR WALLET/);

  await receiptFor(s.page, 't4');
  svg = await posterOf(s.page);
  assert.match(svg, /#8A5300/); assert.doesNotMatch(svg, /#0F7B4A/, 'aucune couleur de succès sur un reçu en cours');
  assert.doesNotMatch(decode(svg), /Transfer successful/); assert.match(decode(svg), /FRD-TX-PEND-0004/);

  await receiptFor(s.page, 't5');
  svg = await posterOf(s.page);
  assert.match(svg, /#B42318/); assert.doesNotMatch(svg, /#0F7B4A/);
  assert.doesNotMatch(decode(svg), /Transfer successful|Total debited|Fees/);
  assert.match(decode(svg), /FRD-TX-FAIL-0005/); assert.match(decode(svg), /Failed/i);

  await receiptFor(s.page, 't2');   /* entrant : « Amount received », pas de frais */
  svg = await posterOf(s.page);
  assert.match(decode(svg), /Amount received/); assert.doesNotMatch(decode(svg), /Total debited/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu exporté : PNG et PDF sont de vrais fichiers (signature PNG, en-tête %PDF) et contiennent la vraie référence dans leur nom', { skip }, async () => {
  const s = await open();
  await receiptFor(s.page, 't5');
  const grab = async (action) => {
    const [dl] = await Promise.all([s.page.waitForEvent('download'), s.page.click(`[data-action="${action}"]`)]);
    const p = await dl.path();
    return { name: dl.suggestedFilename(), buf: readFileSync(p) };
  };
  const png = await grab('download-receipt');
  assert.equal(png.name, 'FRIENDLY-PAY-FRD-TX-FAIL-0005.png');
  assert.deepEqual([...png.buf.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const pdf = await grab('download-pdf');
  assert.equal(pdf.name, 'FRIENDLY-PAY-FRD-TX-FAIL-0005.pdf');
  assert.equal(pdf.buf.subarray(0, 5).toString(), '%PDF-'); assert.match(pdf.buf.subarray(-6).toString(), /%%EOF/);
  assert.ok(pdf.buf.length > 4000);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

for (const lang of ['fr', 'ar']) {
  test(`reçu exporté (${lang}) : affiche générée sans erreur, sens d'écriture correct`, { skip }, async () => {
    const s = await open({ lang });
    await receiptFor(s.page, 't4');
    const svg = await posterOf(s.page);
    assert.match(svg, /<svg /); assert.match(svg, lang === 'ar' ? /فرندي باي/ : /Friendly Pay/); assert.doesNotMatch(svg, /NEX WALLET|YOR WALLET/);
    if (lang === 'ar') { assert.match(svg, /text-anchor="end"/, 'arabe : texte aligné à droite'); assert.doesNotMatch(svg, /letter-spacing/, 'arabe : jamais de lettres espacées'); }
    const [dl] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-action="download-receipt"]')]);
    assert.equal(readFileSync(await dl.path()).subarray(1, 4).toString(), 'PNG');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  });
}

/* ---------- carte « Obsidian » (design YOR exclusif, 12.4.1) ---------- */
test('carte Obsidian : thème proposé en premier et par défaut, rendu sans marque tierce ni faux statut (aperçu, pas « active »)', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => { Runtime.cards[0].theme = 'obsidian'; return R.go('cards', { force: true }); });
  await s.page.waitForSelector('.rv-card.th-obsidian');
  const face = await s.page.evaluate(() => { const f = document.querySelector('.rv-card.th-obsidian .rv-front'); const c = getComputedStyle(f); return { bg: c.backgroundImage, text: f.innerText, state: f.closest('.rv-card').dataset.state }; });
  assert.match(face.bg, /repeating-linear-gradient/, 'motif gravé dessiné en CSS');
  assert.equal(face.state, 'preview');
  assert.doesNotMatch(face.text, /visa|mastercard|active/i);
  assert.equal(await s.page.locator('.rv-card.th-obsidian .rv-net-slot').count(), 0, 'pas de réseau sans émetteur réel');
  await s.page.evaluate(() => R.go('cards-add', { force: true }));
  await s.page.waitForSelector('.rv-swatch');
  const sw = await s.page.$$eval('.rv-swatch', e => e.map(x => x.className.replace(/.*th-(\w+).*/, '$1')));
  assert.equal(sw[0], 'obsidian'); assert.equal(sw.length, 7);
  assert.ok(await s.page.locator('.rv-swatch.th-obsidian[aria-pressed="true"]').count(), 'Obsidian est le choix par défaut');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

/* ---------- 12.5.0 : reçu — solde du registre, « Faire un autre transfert », état de livraison du SMS, remboursé = non abouti ----------
   Supabase est un faux client : aucun appel réel, aucun SMS. Ces tests prouvent le comportement de l'écran, pas la remise réelle d'un SMS. */
const stubRpc = (page, { balance = null, notices = [] } = {}) => page.evaluate(({ balance, notices }) => {
  supabaseReady = true; window.__rpcCalls = []; window.__bal = balance; window.__notices = notices;
  sb.rpc = async (name) => {
    window.__rpcCalls.push(name);
    if (name === 'get_tx_balance_after') return { data: window.__bal, error: null };
    if (name === 'get_recipient_notice_status') return { data: window.__notices, error: null };
    return { data: null, error: null };
  };
}, { balance, notices });
const called = (page, name) => page.waitForFunction(n => (window.__rpcCalls || []).includes(n), name, { timeout: 5000 });

test('reçu 12.6.0 : le reçu n\'affiche JAMAIS le solde restant (écran, export PNG / PDF) et ne le lit même plus au serveur — réussi, échoué, crypto, solde visible ou masqué', { skip }, async () => {
  /* le registre répond « 1 229.500 » : s'il était lu ou dessiné, le test le verrait */
  for (const [label, tx, mode] of [['réussi', 't1', null], ['en cours', 't4', null], ['échec', 't5', null], ['crypto', 't3', null], ['réussi, solde masqué', 't1', 'hide']]) {
    const s = await open();
    await stubRpc(s.page, { balance: { amount: 1229.5, asset: 'OMR', at: '2026-10-12T15:43:00Z' } });
    if (mode === 'hide') await s.page.evaluate(() => { Runtime.hideBalance = true; });
    await receiptFor(s.page, tx);
    await s.page.waitForTimeout(400);
    assert.equal(await s.page.locator('#receipt-balance').count(), 0, label + ' : aucune ligne de solde');
    const txt = await s.page.innerText('#receipt');
    assert.doesNotMatch(txt, /Available balance|Remaining balance|Solde disponible|Solde restant|1[,\s]?229\.500/, label + ' : aucun solde dans le texte du reçu');
    const calls = await s.page.evaluate(() => window.__rpcCalls.filter(n => n === 'get_tx_balance_after').length);
    assert.equal(calls, 0, label + ' : le reçu ne lit plus le solde au serveur');
    const view = await s.page.evaluate(() => window.__YOR_LAST_RECEIPT_VIEW__);
    assert.ok(!('balance' in view), label + ' : pas de champ « balance » dans les données d\'export');
    const svg = await s.page.evaluate(() => ReceiptExport.svg(window.__YOR_LAST_RECEIPT__, window.__YOR_LAST_RECEIPT_VIEW__));
    assert.doesNotMatch(svg, /Available balance|Remaining balance|Solde|الرصيد|1[,\s]?229\.500/, label + ' : aucun solde dans l\'image / le PDF');
    assert.deepEqual(s.errors, [], label);
    await s.ctx.close();
  }
  /* les traductions du solde de reçu n'existent plus (rien à afficher par erreur) */
  const s2 = await open();
  assert.equal(await s2.page.evaluate(() => ['en', 'fr', 'ar'].some(l => 'receipt.balance' in TR[l])), false);
  await s2.ctx.close();
});

test('reçu 12.5.0 : « Faire un autre transfert » (virement → départ du parcours, envoi crypto → envoi crypto, jamais sur un reçu entrant) ; « Retour à l\'accueil » conservé ; masqué à l\'impression', { skip }, async () => {
  let s = await open();
  await receiptFor(s.page, 't1');
  assert.equal(await s.page.locator('.rc-another').count(), 1);
  assert.equal(await s.page.getAttribute('.rc-another', 'data-nav'), 'country-select');
  assert.match(await s.page.innerText('.rc-another'), /Make another transfer/);
  assert.ok(await s.page.locator('.rc-done.btn-secondary').count(), 'Retour à l\'accueil reste présent, en second');
  assert.match(await s.page.innerText('.rc-done'), /Back to home/);
  await s.page.emulateMedia({ media: 'print' });
  assert.equal(await s.page.evaluate(() => getComputedStyle(document.querySelector('.rc-another')).display), 'none', 'masqué à l\'impression');
  await s.page.emulateMedia({ media: 'screen' });
  await s.page.click('.rc-another');
  await s.page.waitForFunction(() => R.current() === 'country-select', null, { timeout: 5000 });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();

  s = await open();
  await receiptFor(s.page, 't2');                                   /* reçu ENTRANT : aucune relance de transfert */
  assert.equal(await s.page.locator('.rc-another').count(), 0);
  assert.ok(await s.page.locator('.rc-done.btn-primary').count(), 'seul bouton du bas = Retour à l\'accueil');
  await receiptFor(s.page, 't3');                                   /* envoi crypto */
  assert.equal(await s.page.getAttribute('.rc-another', 'data-nav'), 'crypto-send');
  await s.ctx.close();

  s = await open({ lang: 'ar' });
  await receiptFor(s.page, 't1');
  assert.match(await s.page.innerText('.rc-another'), /إجراء تحويل آخر/);
  await s.ctx.close();
  s = await open({ lang: 'fr' });
  await s.page.evaluate(() => { DeviceLang.set('fr'); LANG = 'fr'; applyI18n(); });
  await receiptFor(s.page, 't1');
  assert.match(await s.page.innerText('.rc-another'), /Faire un autre transfert/);
  await s.ctx.close();
});

test('reçu 12.5.0 : état de livraison du SMS — remis / non remis / en attente / inconnu / non suivi ; la mise en garde disparaît seulement quand tout est tranché', { skip }, async () => {
  const s = await open();
  const mk = (d, status = 'SENT') => [{ channel: 'SMS', audience: 'SENDER', status, delivery: d, reason: null }, { channel: 'SMS', audience: 'EXTERNAL', status, delivery: d, reason: null }];
  const show = async (notices) => {
    await stubRpc(s.page, { notices });
    await receiptFor(s.page, 't1');
    await s.page.waitForSelector('#receipt-notice .receipt-row');
    return s.page.innerText('#receipt-notice');
  };
  let txt = await show(mk('DELIVERED'));
  assert.match(txt, /Delivered to the phone/); assert.doesNotMatch(txt, /does not prove/, 'tout est remis : plus de mise en garde');
  txt = await show(mk('UNDELIVERABLE'));
  assert.match(txt, /Not delivered/); assert.doesNotMatch(txt, /Delivered to the phone|credit/);
  const color = await s.page.evaluate(() => getComputedStyle(document.querySelector('#receipt-notice .receipt-row-value')).color);
  assert.notEqual(color, await s.page.evaluate(() => getComputedStyle(document.body).color), 'le refus est coloré');
  txt = await show(mk('UNDELIVERABLE').map(n => Object.assign({}, n, { reason: 'sms_credits_missing' })));
  assert.match(txt, /Not delivered · no SMS credit on the provider account yet/, 'la cause réelle (plus de crédit) est dite');
  txt = await show(mk('PENDING'));
  assert.match(txt, /waiting for the delivery report/); assert.match(txt, /does not prove/);
  txt = await show(mk('UNKNOWN'));
  assert.match(txt, /no delivery report received/); assert.match(txt, /does not prove/);
  txt = await show(mk('UNSUPPORTED'));
  assert.match(txt, /Passed to the provider/); assert.doesNotMatch(txt, /Delivered to the phone|Not delivered/); assert.match(txt, /does not prove/);
  txt = await show(mk(null));
  assert.match(txt, /Passed to the provider/); assert.doesNotMatch(txt, /Delivered to the phone/);
  txt = await show([{ channel: 'SMS', audience: 'SENDER', status: 'FAILED', delivery: null, reason: 'sms_credits_missing' }]);
  assert.match(txt, /no SMS credit/); assert.doesNotMatch(txt, /Delivered to the phone/, 'un SMS en échec n\'est jamais « remis »');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu 12.5.0 : un remboursement / une annulation du registre n\'est jamais présenté « en cours » ni « réussi »', { skip }, async () => {
  const s = await open();
  await s.page.evaluate(() => {
    Runtime.transactions.push({ id: 't6', reference: 'YOR-TX-REF-0006', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'REFUNDED', currency: 'OMR', amount: 7, fee: 0.2, vat: 0, total: 7.2, createdAt: Date.now() - 1000, beneficiary: { name: 'Test Refund' } });
    Runtime.transactions.push({ id: 't7', reference: 'YOR-TX-REV-0007', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'REVERSED', currency: 'OMR', amount: 8, fee: 0.2, vat: 0, total: 8.2, createdAt: Date.now() - 2000, beneficiary: { name: 'Test Reverse' } });
  });
  for (const id of ['t6', 't7']) {
    await receiptFor(s.page, id);
    assert.ok(await s.page.locator('.receipt-view.rc-failed').count(), id + ' : écran « non abouti »');
    assert.equal(await s.page.locator('.receipt-view.rc-success, .receipt-view.rc-pending').count(), 0);
    assert.doesNotMatch(await s.page.innerText('#receipt'), /Total debited/, 'aucun débit affirmé pour une opération non aboutie');
  }
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
