/* 12.3.7 — « envoyer à n'importe quelle adresse crypto ».
   Ce banc exécute l'application RÉELLE (index.html + CSP) dans Chromium, avec un faux Supabase sans session, un faux TronLink et un faux nœud Nile.
   Il prouve : le nettoyage du texte collé, le nouveau comportement de l'écran d'adresse (avertissement au lieu de blocage, même bornes que le serveur),
   l'adresse COMPLÈTE affichée à la confirmation, et l'écran TronLink (nettoyage, message clair pour une adresse 0x).
   Il NE prouve PAS : l'acceptation par la vraie base (fonction SQL _crypto_send_external_impl, vérifiée à part en lecture), ni un envoi réel sur une chaîne. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, openApp } from './ui-harness.mjs';
import { loadChain, makeClock, makeNode } from '../web/harness.mjs';
import { ADDR, HEX } from '../web/fixtures.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
const Y = loadChain();
const newNode = () => makeNode(Y, makeClock(Date.now()), {});
const ETH = '0x52908400098527886E0F7030069857D2E4169EE7';
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const BTC_LEGACY = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
const SOL = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
const XRP = 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh';
const ZW = '​', LRM = '‎', NBSP = ' ', BOM = '﻿';

let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const validate = (page, net, addr) => page.evaluate(([n, a]) => AddressEngine.validate(n, a), [net, addr]);

test('AddressEngine : tout ce que le serveur accepte peut être envoyé ; le format propre au réseau n\'est qu\'un avertissement', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  /* adresses conformes : strict */
  assert.deepEqual(await validate(s.page, 'tron', ADDR.deployer), { ok: true, strict: true, address: ADDR.deployer });
  assert.equal((await validate(s.page, 'ethereum', ETH)).strict, true);
  assert.equal((await validate(s.page, 'bsc', ETH)).strict, true);
  assert.equal((await validate(s.page, 'polygon', ETH)).strict, true);
  assert.equal((await validate(s.page, 'bitcoin', BTC)).strict, true);
  assert.equal((await validate(s.page, 'bitcoin', BTC_LEGACY)).strict, true);
  assert.equal((await validate(s.page, 'solana', SOL)).strict, true);
  assert.equal((await validate(s.page, 'xrp', XRP)).strict, true);
  /* format d'un autre réseau : PAS bloqué, mais signalé avec le réseau probable */
  let r = await validate(s.page, 'tron', ETH);
  assert.deepEqual([r.ok, r.strict, r.looksLike], [true, false, 'ethereum']);
  r = await validate(s.page, 'ethereum', ADDR.deployer);
  assert.deepEqual([r.ok, r.strict, r.looksLike], [true, false, 'tron']);
  r = await validate(s.page, 'solana', BTC);
  assert.deepEqual([r.ok, r.strict], [true, false]);
  /* format inconnu mais accepté par le serveur (15 à 128 caractères de A-Z a-z 0-9 : _ . -) */
  r = await validate(s.page, 'tron', 'cosmos1abcdefghijklmnopqrstuvwxyz0123');
  assert.deepEqual([r.ok, r.strict, r.looksLike], [true, false, null]);
  assert.equal((await validate(s.page, 'tron', 'a'.repeat(15))).ok, true, '15 caractères : minimum du serveur');
  assert.equal((await validate(s.page, 'tron', 'a'.repeat(128))).ok, true, '128 caractères : maximum du serveur');
  /* ce que le serveur refuserait est refusé tout de suite (pas de faux « envoyé » ensuite) */
  assert.equal((await validate(s.page, 'tron', 'a'.repeat(14))).ok, false, '14 caractères : le serveur refuse');
  assert.equal((await validate(s.page, 'tron', 'a'.repeat(129))).ok, false, '129 caractères : le serveur refuse');
  assert.equal((await validate(s.page, 'tron', 'abcdefghijklmnop$qrstuvwxyz')).ok, false, 'caractère interdit par le serveur');
  assert.equal((await validate(s.page, 'tron', 'abcdefghijklmnop/qrstuvwxyz')).ok, false);
  assert.equal((await validate(s.page, 'tron', '')).ok, false);
  assert.equal((await validate(s.page, 'tron', null)).ok, false);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('AddressEngine.clean : retire ce qui n\'est pas l\'adresse (espaces, invisibles, schéma, paramètres, guillemets) sans jamais rien inventer', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  const clean = x => s.page.evaluate(a => AddressEngine.clean(a), x);
  assert.equal(await clean('  ' + ADDR.deployer + '  \n'), ADDR.deployer);
  assert.equal(await clean(ADDR.deployer.slice(0, 10) + ' ' + ADDR.deployer.slice(10)), ADDR.deployer, 'espace au milieu (retour à la ligne d\'un message)');
  assert.equal(await clean(ZW + ADDR.deployer + LRM + NBSP + BOM), ADDR.deployer, 'caractères invisibles et de sens d\'écriture');
  assert.equal(await clean('"' + ADDR.deployer + '"'), ADDR.deployer);
  assert.equal(await clean('(' + ETH + '),'), ETH);
  assert.equal(await clean('tron:' + ADDR.deployer), ADDR.deployer);
  assert.equal(await clean('ethereum:' + ETH + '@1?value=1e18'), ETH);
  assert.equal(await clean('bitcoin:' + BTC + '?amount=0.1&label=x'), BTC);
  assert.equal(await clean('0X' + ETH.slice(2)), ETH, '0X majuscule');
  assert.equal(await clean(null), '');
  assert.equal(await clean(undefined), '');
  /* ne devine pas : une adresse tronquée reste tronquée */
  assert.equal(await clean(ADDR.deployer.slice(0, -3)), ADDR.deployer.slice(0, -3));
  await s.ctx.close();
});

test('écran « Envoyer crypto » (app réelle) : adresse d\'un autre format = avertissement, bouton Suivant ACTIF ; adresse illisible = bloquée', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  await s.page.evaluate(() => { CRYPTO_FLOW.send = { asset: 'usdt', network: 'tron', address: null, memo: null, amount: 0 }; R.go('crypto-send-address', { force: true }); });
  await s.page.waitForSelector('#send-addr');
  const next = s.page.locator('#addr-next');
  assert.equal(await next.isDisabled(), true, 'vide : désactivé');

  await s.page.fill('#send-addr', ADDR.deployer);
  await s.page.waitForFunction(() => /Beneficiary recognized|Reconnu/i.test(document.getElementById('addr-status').innerText));
  assert.equal(await next.isDisabled(), false, 'adresse TRON conforme');

  await s.page.fill('#send-addr', ETH);
  await s.page.waitForFunction(() => /standard/i.test(document.getElementById('addr-status').innerText));
  let msg = await s.page.innerText('#addr-status');
  assert.match(msg, /does not look like a standard (TRON|Tron)/i, msg);
  assert.match(msg, /looks like an? Ethereum/i, msg);
  assert.equal(await next.isDisabled(), false, 'avertissement seulement : on peut continuer');

  await s.page.fill('#send-addr', 'abc');
  await s.page.waitForFunction(() => /Invalid address/i.test(document.getElementById('addr-status').innerText));
  assert.equal(await next.isDisabled(), true, 'trop court : bloqué');

  /* copier-coller sale : l'adresse nettoyée est celle qui est retenue */
  await s.page.fill('#send-addr', ' ' + ZW + ADDR.deployer + '\n');
  await s.page.waitForFunction(() => /Beneficiary recognized/i.test(document.getElementById('addr-status').innerText));
  await next.click();
  await s.page.waitForSelector('#sendamt-input');
  assert.equal(await s.page.evaluate(() => CRYPTO_FLOW.send.address), ADDR.deployer);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('confirmation : l\'adresse COMPLÈTE est affichée (plus seulement début…fin), y compris une adresse de format inhabituel', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  const odd = 'cosmos1abcdefghijklmnopqrstuvwxyz0123456789ab';
  await s.page.evaluate(a => {
    const asset = CRYPTO_ASSETS.find(x => x.id === 'usdt');
    CRYPTO_FLOW.pending = { kind: 'SEND', data: { asset, assetId: 'usdt', symbol: 'USDT', amount: 5, networkFee: 1.2, fee: 0, total: 6.2, network: 'TRON', networkId: 'tron', toAddress: a, memo: null, walletId: null } };
    R.go('crypto-review', { force: true });
  }, odd);
  await s.page.waitForSelector('.summary-row');
  const values = await s.page.$$eval('.summary-v', els => els.map(e => e.textContent));
  assert.ok(values.includes(odd), 'adresse complète affichée : ' + JSON.stringify(values));
  assert.ok(!values.some(v => v.includes('…')), 'aucune troncature');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('envoi vers une adresse inconnue du serveur : la base reçoit l\'adresse NETTOYÉE et les refus précis du serveur ont un message précis', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  /* faux sb.rpc : enregistre l'appel et renvoie une erreur SQL choisie */
  const res = await s.page.evaluate(async () => {
    const calls = []; let next = null;
    const realReady = supabaseReady, real = sb;
    supabaseReady = true;
    sb = { rpc: async (fn, args) => { calls.push({ fn, args }); return next ? { data: null, error: { message: next } } : { data: { ok: true, status: 'PENDING', reference: 'R', transaction_id: 'T' }, error: null }; } };
    const out = {};
    const send = async (addr) => CryptoBuyEngine.sendExternal({ symbol: 'usdt', network: 'tron', address: addr, memo: null, amount: 1, idemKey: uuid(), pinGrant: null });
    out.ok = await send('  TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad ');
    for (const m of ['invalid_address', 'self_transfer', 'address_network_mismatch', 'unsupported_asset_network', 'invalid_amount', 'insufficient_balance']) {
      next = m; out[m] = (await send('TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad' + m.length)).error;
    }
    out.calls = calls.map(c => [c.fn, c.args.p_address]);
    sb = real; supabaseReady = realReady;
    return out;
  });
  assert.equal(res.ok.ok, true);
  assert.deepEqual(res.calls[0], ['crypto_send_external', 'TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad']);
  assert.equal(res.invalid_address, 'errors.INVALID_ADDRESS');
  assert.equal(res.self_transfer, 'errors.SELF_TRANSFER');
  assert.equal(res.address_network_mismatch, 'errors.ADDRESS_NETWORK_MISMATCH');
  assert.equal(res.unsupported_asset_network, 'errors.UNSUPPORTED_NETWORK');
  assert.equal(res.invalid_amount, 'errors.INVALID_AMOUNT');
  assert.equal(res.insufficient_balance, 'errors.INSUFFICIENT_BALANCE');
  /* les nouveaux textes existent en EN / FR / AR */
  const keys = ['errors.ADDRESS_NETWORK_MISMATCH', 'errors.UNSUPPORTED_NETWORK', 'crypto.addressUnusual', 'crypto.addressLooksLike'];
  const have = await s.page.evaluate(ks => ['en', 'fr', 'ar'].map(l => ks.map(k => !!(TR[l] && TR[l][k]))), keys);
  assert.deepEqual(have, [[true, true, true, true], [true, true, true, true], [true, true, true, true]]);
  await s.ctx.close();
});

test('YorChain.cleanAddressInput (écran TronLink) : nettoie, extrait d\'un lien d\'explorateur, convertit l\'hexadécimal 41…, ne devine jamais', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  const clean = x => s.page.evaluate(a => window.YorChain.cleanAddressInput(a), x);
  assert.equal(await clean(' ' + ZW + ADDR.deployer + '\n'), ADDR.deployer);
  assert.equal(await clean('"' + ADDR.deployer + '"'), ADDR.deployer);
  assert.equal(await clean('tron:' + ADDR.deployer + '?amount=1'), ADDR.deployer);
  assert.equal(await clean('https://nile.tronscan.org/#/address/' + ADDR.deployer), ADDR.deployer, 'lien d\'explorateur');
  assert.equal(await clean('https://nile.tronscan.org/#/address/' + ADDR.deployer + '/transfers'), ADDR.deployer);
  assert.equal(await clean(HEX.user), ADDR.user, 'forme hexadécimale TRON (41 + 40 hex) -> forme T…');
  assert.equal(await clean(HEX.user.toUpperCase()), ADDR.user);
  assert.equal(await clean(HEX.user.slice(0, -2)), HEX.user.slice(0, -2), 'hex tronqué : laissé tel quel (sera refusé)');
  assert.equal(await clean(ADDR.deployer.slice(0, -1)), ADDR.deployer.slice(0, -1), 'adresse tronquée : laissée telle quelle');
  assert.equal(await clean(null), '');
  /* accord avec AddressEngine.clean sur les cas communs */
  for (const x of [' ' + ZW + ADDR.deployer + '\n', '"' + ADDR.deployer + '"', 'tron:' + ADDR.deployer, ADDR.deployer + '?x=1', ADDR.deployer.slice(0, 12) + ' ' + ADDR.deployer.slice(12)]) {
    const [a, b] = await s.page.evaluate(v => [AddressEngine.clean(v), window.YorChain.cleanAddressInput(v)], x);
    assert.equal(a, b, 'les deux nettoyages sont d\'accord sur ' + JSON.stringify(x));
  }
  /* une adresse de type 0x n'est jamais convertie en adresse TRON (ce serait un autre réseau) */
  assert.equal(await clean(ETH), ETH);
  assert.equal(await s.page.evaluate(a => window.YorChain.isAddress(a), ETH), false);
  await s.ctx.close();
});

test('écran TronLink (app réelle) : une adresse collée avec espaces / caractère invisible passe ; une adresse 0x reçoit un message clair, rien n\'est envoyé', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), wallet: { address: ADDR.user }, crypto: true });
  await s.page.evaluate(() => R.go('chain', { force: true }));
  await s.page.waitForSelector('[data-chain="connect"]');
  await s.page.click('[data-chain="connect"]');
  await s.page.waitForSelector('.ch-big');
  await s.page.fill('#ch-to', ZW + ' ' + ADDR.deployer + ' \n');
  await s.page.fill('#ch-amount', '1.5');
  await s.page.click('[data-chain="review"]');
  await s.page.waitForSelector('[data-chain="confirm"]');
  assert.match(await s.page.innerText('#chain'), new RegExp(ADDR.deployer), 'la confirmation montre l\'adresse nettoyée, complète');
  await s.page.click('[data-chain="cancel"]');
  await s.page.waitForSelector('#ch-to');

  await s.page.fill('#ch-to', ETH);
  await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]');
  await s.page.waitForSelector('#ch-form-msg:not([hidden])');
  const err = await s.page.innerText('#ch-form-msg');
  assert.match(err, /Ethereum-style address/, err);
  assert.match(err, /starts with T/, err);
  assert.equal(await s.page.locator('[data-chain="confirm"]').count(), 0, 'pas de page de confirmation');
  assert.equal(await s.page.evaluate(() => window.__tl.signCalls.length), 0, 'TronLink n\'a pas été appelé');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
