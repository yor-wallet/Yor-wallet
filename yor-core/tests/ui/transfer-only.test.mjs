/* 12.12.0 — l'application ne fait QUE des transferts d'argent : toute la section crypto (et les comptes bancaires, qui n'existaient que pour elle)
   est invisible et inaccessible, sans que le code conservé ne soit supprimé (drapeau FEATURES.crypto = false).
   Test sur la VRAIE application, Supabase remplacé par un faux client sans session. */
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

const CRYPTO_WORDS = /crypto|bitcoin|\bBTC\b|\bETH\b|USDT|YOR-USDT|blockchain|tron|wallet connect|swap|\bmarkets?\b/i;
const shot = async (page, name) => { await page.waitForTimeout(1200); await page.screenshot({ path: SHOTS + '/' + name }); };   /* attend la fin des transitions */
const seed = (s, role = 'user') => s.page.evaluate((r) => {
  const c = { uid: 'u1', userId: 'U1', yorId: 'YOR1', role: r }; UserContext.set(c); Runtime.ctx = c;
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000' };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 250.5, availableBalance: 250.5, reservedBalance: 0, status: 'ACTIVE', country: 'OM' },
                      { id: 'a2', type: 'CRYPTO', name: 'BTC', currency: 'BTC', balance: 0.5, availableBalance: 0.5, reservedBalance: 0, status: 'ACTIVE' }];
  const now = Date.now();
  Runtime.transactions = [
    { id: 't1', type: 'FIAT_EXTERNAL', status: 'CONFIRMED', amount: 12, currency: 'OMR', direction: 'OUT', reference: 'YOR-TX-20261017-FIAT01', createdAt: now - 3600e3, counterparty: '+968 9123 4567' },
    { id: 't2', type: 'CRYPTO_BUY', asset: 'BTC', status: 'CONFIRMED', amount: 0.01, currency: 'BTC', direction: 'IN', reference: 'YOR-TX-20261017-CRYP01', createdAt: now - 1800e3 },
  ];
  Runtime.receipts = []; Runtime.notifications = []; Runtime.cards = [];
  openHome();
}, role);

test('version 13.0.0 ; le drapeau FEATURES.crypto est faux et gelé', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  const st = await s.page.evaluate(() => ({ v: CONFIG.APP.version, c: FEATURES.crypto, f: Object.isFrozen(FEATURES) }));
  assert.equal(st.v, '13.0.0'); assert.equal(st.c, false); assert.equal(st.f, true);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

for (const role of ['user', 'admin']) {
  test(`accueil (${role}) : aucune action, aucun solde, aucune ligne crypto ; actions = Envoyer, Historique, Services…`, { skip }, async () => {
    const s = await openApp(browser, { node: null, role });
    await seed(s, role);
    await s.page.waitForSelector('.ds-home');
    const home = await s.page.innerText('.ds-home');
    assert.doesNotMatch(home, CRYPTO_WORDS, 'aucun mot crypto à l\'accueil : ' + home.replace(/\s+/g, ' ').slice(0, 300));
    assert.equal(await s.page.locator('[data-nav^="crypto"], [data-nav="chain"], [data-nav="banks"]').count(), 0, 'aucun lien crypto / chaîne / banques à l\'écran');
    assert.ok(await s.page.locator('.rv-acts [data-nav="country-select"]').count() === 1, 'l\'action « Envoyer » existe');
    assert.match(home, /12\.000/, 'le transfert d\'argent est bien dans la liste');
    assert.doesNotMatch(home, /0\.01/, 'l\'opération crypto n\'est pas listée');
    await shot(s.page, '50-home-' + role + '.png');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  });
}

test('barre du bas : Accueil, Cartes, Envoyer, Historique, Services — aucune entrée crypto', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await seed(s);
  const items = await s.page.$$eval('#bottom-nav [data-nav]', els => els.map(e => e.getAttribute('data-nav')));
  assert.ok(items.length >= 4, items.join(','));
  assert.ok(!items.some(i => /crypto|chain|banks/.test(i)), items.join(','));
  assert.ok(items.includes('country-select'), 'le bouton central Envoyer : ' + items.join(','));
  await s.ctx.close();
});

test('Services : un seul groupe d\'argent + compte et aide ; aucune tuile crypto, YOR-USDT ni banques', { skip }, async () => {
  for (const role of ['user', 'admin']) {
    const s = await openApp(browser, { node: null, role });
    await seed(s, role);
    await s.page.evaluate(() => R.go('services', { force: true }));
    await s.page.waitForSelector('.yb-svc');
    const groups = await s.page.$$eval('.yb-sec h2', els => els.map(e => e.textContent.trim()));
    assert.deepEqual(groups, ['Money', 'Account & help'], role + ' : ' + groups.join(' | '));
    assert.equal(await s.page.locator('[data-nav^="crypto"], [data-nav="chain"], [data-nav="banks"]').count(), 0, role);
    assert.doesNotMatch(await s.page.innerText('.screen.active'), CRYPTO_WORDS, role);
    if (role === 'user') await shot(s.page, '51-services.png');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  }
});

test('liens directs et appels internes vers la crypto, la chaîne ou les banques : on arrive à l\'accueil, rien n\'est construit', { skip }, async () => {
  for (const role of ['user', 'admin']) {
    for (const hash of ['#/crypto', '#/crypto/market', '#/crypto/spot/btc', '#/chain', '#/banks', '#/banks/add']) {
      const s = await openApp(browser, { node: null, role, hash });
      await seed(s, role);
      assert.equal(await s.page.evaluate(() => R.current()), 'home', role + ' ' + hash);
      await s.ctx.close();
    }
    const s = await openApp(browser, { node: null, role });
    await seed(s, role);
    for (const id of ['crypto', 'crypto-market', 'crypto-buy', 'crypto-send', 'crypto-swap', 'crypto-receive', 'crypto-to-bank', 'crypto-networks', 'chain', 'banks', 'banks-add']) {
      await s.page.evaluate((x) => R.go(x, { force: true }), id);
      await s.page.waitForFunction(() => R.current() === 'home', null, { timeout: 4000 });
      assert.equal(await s.page.locator('#' + id).count(), 0, role + ' : l\'écran « ' + id + ' » n\'est jamais construit');
    }
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  }
});

test('ordinateur (menu latéral) et menu tiroir : aucune entrée crypto ni banques', { skip }, async () => {
  const s = await openApp(browser, { node: null, viewport: { width: 1280, height: 800 } });
  await seed(s);
  const side = await s.page.$$eval('#side-nav [data-nav]', els => els.map(e => e.getAttribute('data-nav')));
  assert.deepEqual(side, ['home', 'history', 'notifications', 'cards', 'profile', 'settings']);
  const drawer = await s.page.evaluate(() => { try { return typeof openDrawer === 'function' ? (openDrawer(), document.body.innerText) : ''; } catch (e) { return ''; } });
  assert.doesNotMatch(drawer, /crypto|market|network|bank/i, 'menu tiroir : ' + drawer.replace(/\s+/g, ' ').slice(0, 200));
  await s.ctx.close();
});

test('historique : les opérations crypto ne sont pas listées, pas de filtre « crypto » ni « virements » ; les transferts d\'argent restent', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await seed(s);
  await s.page.evaluate(() => R.go('history', { force: true }));
  await s.page.waitForSelector('.screen.active');
  await s.page.waitForTimeout(500);
  const txt = await s.page.innerText('.screen.active');
  assert.match(txt, /12\.000/); assert.doesNotMatch(txt, /0\.01|BTC/);
  const chips = await s.page.$$eval('.screen.active .chip', els => els.map(e => e.textContent.trim().toLowerCase()));
  assert.ok(!chips.some(c => /crypto/.test(c)), 'filtres : ' + chips.join(','));
  assert.ok(chips.length >= 2, 'les filtres de statut restent : ' + chips.join(','));
  await shot(s.page, '52-history.png');
  await s.ctx.close();
});

test('réglages : ni portefeuille connecté ni comptes bancaires ; la confirmation par SMS / e-mail est décrite sans frais', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await seed(s);
  await s.page.evaluate(() => R.go('settings', { force: true }));
  await s.page.waitForSelector('.settings-group');
  const txt = await s.page.innerText('.screen.active');
  assert.doesNotMatch(txt, /connected wallet|wallet connect|bank accounts|crypto/i, 'réglages : ' + txt.replace(/\s+/g, ' ').slice(0, 300));
  assert.equal(await s.page.locator('[data-nwc-slot]').count(), 0);
  assert.equal(await s.page.locator('[data-nav="banks"]').count(), 0);
  assert.match(txt, /amount sent and your available balance/i);
  assert.doesNotMatch(txt, /\bfees?\b/i, 'plus de mention de frais');
  await s.ctx.close();
});

test('aucun fichier crypto n\'est chargé par erreur au démarrage : pas de WalletConnect / AppKit, aucun appel externe hors Supabase', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await seed(s);
  assert.deepEqual(s.external, ['GET cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js']);
  assert.equal(await s.page.evaluate(() => typeof NexWC === 'undefined' || !document.querySelector('[data-nwc-slot]')), true);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
