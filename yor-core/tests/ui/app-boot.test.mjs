/* Test sur la VRAIE application (index.html, CSP de _headers) : démarrage sans erreur, tuile « YOR-USDT » dans Services,
   écran joignable et câblé par wire.js, CSP qui laisse passer Nile et bloque le mainnet.
   Supabase est remplacé par un faux client sans session ; TronLink et le nœud Nile sont faux (réponses réelles enregistrées). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { available, launch, openApp } from './ui-harness.mjs';
import { loadChain, makeClock, makeNode } from '../web/harness.mjs';
import { ADDR } from '../web/fixtures.mjs';

const SHOTS = process.env.YOR_SHOTS || resolve(dirname(fileURLToPath(import.meta.url)), '../../.shots');
mkdirSync(SHOTS, { recursive: true });
const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
const Y = loadChain();
const newNode = () => makeNode(Y, makeClock(Date.now()), {});
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

test('l\'app démarre sans erreur avec la CSP réelle ; seul appel externe : le faux client Supabase', { skip }, async () => {
  const s = await openApp(browser, { node: newNode() });
  const st = await s.page.evaluate(() => ({ r: typeof renderChain, w: typeof wireChain, y: typeof window.YorChain, frozen: Object.isFrozen(window.YorChain), v: CONFIG.APP.version }));
  assert.deepEqual(s.errors, [], 'aucune erreur ni avertissement dans la console (CSP comprise)');
  assert.equal(st.r, 'function'); assert.equal(st.w, 'function'); assert.equal(st.y, 'object'); assert.equal(st.frozen, true);
  assert.deepEqual(s.external, ['GET cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js']);
  assert.equal(st.v, '12.13.0');
  await s.ctx.close();
});

test('Services : la tuile YOR-USDT est avant le groupe Crypto et ouvre l\'écran, le bouton Retour revient à Services (code crypto conservé, drapeau réactivé pour le test)', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), crypto: true });
  await s.page.evaluate(() => R.go('services', { force: true }));
  await s.page.waitForSelector('[data-nav="chain"]');
  const order = await s.page.$$eval('.yb-sec h2', els => els.map(e => e.textContent.trim()));
  assert.ok(order.length >= 2, 'groupes présents : ' + order.join(' | '));
  assert.deepEqual(order.slice(0, 2), ['Money', 'Blockchain (test network)'], 'le groupe Blockchain suit Money, avant Crypto : ' + order.join(' | '));
  const tile = await s.page.locator('[data-nav="chain"]').innerText();
  assert.equal(tile.trim(), "YOR-USDT");
  await s.page.screenshot({ path: SHOTS + '/20-services.png' });
  await s.page.click('[data-nav="chain"]');
  await s.page.waitForSelector('#chain.active .ch-wrap, #chain.active .ch-card');
  assert.match(await s.page.innerText('#chain'), /TronLink was not detected/);
  assert.equal(await s.page.evaluate(() => R.current()), 'chain');
  await s.page.screenshot({ path: SHOTS + '/21-chain-in-app.png' });
  await s.page.click('#chain [data-chain="back"]');
  await s.page.waitForFunction(() => R.current() === 'services');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('dans l\'app réelle : connexion TronLink, solde Nile, tout passe par la CSP (aucune violation)', { skip }, async () => {
  const node = newNode();
  const s = await openApp(browser, { node, wallet: { address: ADDR.user }, crypto: true });
  await s.page.evaluate(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.blockedURI + ' ' + e.violatedDirective)); });
  await s.page.evaluate(() => R.go('chain', { force: true }));
  await s.page.waitForSelector('[data-chain="connect"]');
  await s.page.click('[data-chain="connect"]');
  await s.page.waitForSelector('.ch-big');
  const txt = await s.page.innerText('#chain');
  assert.match(txt, /1,870,000\.00/);
  assert.match(txt, /TEST BALANCE/);
  assert.deepEqual(await s.page.evaluate(() => window.__csp), []);
  assert.ok(node.calls.length > 5 && node.calls.every(c => c.host === 'nile.trongrid.io'));
  await s.page.screenshot({ path: SHOTS + '/22-chain-in-app-connected.png' });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('la CSP de l\'app bloque TRON mainnet et tout hôte non listé (sécurité en profondeur)', { skip }, async () => {
  const s = await openApp(browser, { node: newNode() });
  const res = await s.page.evaluate(async () => {
    const out = {};
    for (const h of ['https://api.trongrid.io/wallet/getnowblock', 'https://api.shasta.trongrid.io/wallet/getnowblock', 'https://example.org/']) {
      try { await fetch(h, { method: 'POST', body: '{}' }); out[h] = 'allowed'; } catch (e) { out[h] = 'blocked'; }
    }
    return out;
  });
  assert.deepEqual(res, { 'https://api.trongrid.io/wallet/getnowblock': 'blocked', 'https://api.shasta.trongrid.io/wallet/getnowblock': 'blocked', 'https://example.org/': 'blocked' });
  assert.ok(!s.external.some(e => /api\.trongrid\.io|shasta/.test(e)), 'aucune requête mainnet/shasta n\'est partie du navigateur');
  await s.ctx.close();
});

test('compte NON admin : ni tuile, ni groupe Blockchain, et l\'accès direct (R.go et #/chain) renvoie à l\'accueil', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), role: 'user', crypto: true });
  await s.page.evaluate(() => R.go('services', { force: true }));
  await s.page.waitForSelector('.yb-svc');
  assert.equal(await s.page.locator('[data-nav="chain"]').count(), 0, 'pas de tuile YOR-USDT');
  const groups = await s.page.$$eval('.yb-sec h2', els => els.map(e => e.textContent.trim()));
  assert.ok(!groups.some(g => /Blockchain|YOR-USDT/i.test(g)), 'pas de groupe Blockchain : ' + groups.join(' | '));
  assert.deepEqual(groups.slice(0, 2), ['Money', 'Crypto'], 'le reste de Services est inchangé');
  await s.page.evaluate(() => R.go('chain', { force: true }));
  await s.page.waitForFunction(() => R.current() === 'home');
  assert.equal(await s.page.locator('#chain').count(), 0, 'l\'écran n\'est jamais construit pour un non-admin');
  await s.page.evaluate(() => { location.hash = '#/chain'; });
  await s.page.waitForTimeout(600);
  assert.notEqual(await s.page.evaluate(() => R.current()), 'chain');
  assert.equal(await s.page.locator('#chain').count(), 0);
  assert.equal(await s.page.evaluate(() => typeof renderChain === 'function' && renderChain()), '', 'renderChain() est vide sans le rôle admin');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('compte admin : tuile et écran présents (les deux administrateurs ont le même accès)', { skip }, async () => {
  const s = await openApp(browser, { node: newNode(), role: 'admin', crypto: true });
  await s.page.evaluate(() => R.go('services', { force: true }));
  await s.page.waitForSelector('[data-nav="chain"]');
  assert.equal(await s.page.evaluate(() => canUseChain()), true);
  await s.ctx.close();
});
