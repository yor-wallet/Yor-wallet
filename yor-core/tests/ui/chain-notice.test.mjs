/* E-mail des envois YOR-USDT (12.3.6), côté application, dans Chromium : l'app RÉELLE (index.html + CSP), un FAUX TronLink, un FAUX nœud Nile,
   un FAUX client Supabase dont `functions.invoke` enregistre les appels. Ce banc prouve QUAND l'app demande les e-mails et AVEC QUOI ;
   il ne prouve pas la livraison d'un e-mail (voir tests/edge-sim/chain-notice.test.mjs pour le serveur, et NOTICES.md). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, openApp } from './ui-harness.mjs';
import { loadChain, makeClock, makeNode } from '../web/harness.mjs';
import { ADDR, transferInfo } from '../web/fixtures.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
const Y = loadChain();
const newNode = () => makeNode(Y, makeClock(Date.now()), {});
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

async function setup(wallet = {}) {
  const node = newNode();
  const s = await openApp(browser, { node, wallet: { address: ADDR.user, ...wallet }, crypto: true });
  await s.page.evaluate(() => {
    window.__inv = []; window.__invMode = 'ok';
    sb.functions = { invoke: async (name, opts) => {
      window.__inv.push({ name, body: JSON.parse(JSON.stringify(opts && opts.body)) });
      return window.__invMode === 'ok' ? { data: { ok: true }, error: null } : { data: null, error: new Error('boom') };
    } };
  });
  await s.page.evaluate(() => R.go('chain', { force: true }));
  await s.page.waitForSelector('[data-chain="connect"]');
  await s.page.click('[data-chain="connect"]');
  await s.page.waitForSelector('.ch-big');
  return { node, s };
}
const calls = page => page.evaluate(() => window.__inv.filter(c => c.name === 'chain-notice').map(c => c.body));
const waitCalls = (page, n) => page.waitForFunction(k => window.__inv.filter(c => c.name === 'chain-notice').length >= k, n);
async function send(page, to = ADDR.deployer, amount = '1.5') {
  await page.fill('#ch-to', to);
  await page.fill('#ch-amount', amount);
  await page.click('[data-chain="review"]');
  await page.waitForSelector('[data-chain="confirm"]');
  await page.click('[data-chain="confirm"]');
  await page.waitForFunction(() => /Sent to the network/.test(document.querySelector('#chain').innerText));
}

test('« c\'est parti » : l\'e-mail est demandé dès la diffusion, sans attendre la chaîne ; « confirmé » seulement sur preuve, une seule fois', { skip }, async () => {
  const { node, s } = await setup();
  await send(s.page);
  await waitCalls(s.page, 1);
  const txid = node.calls.find(c => c.path === '/wallet/broadcasttransaction').body.txID;
  assert.deepEqual(await calls(s.page), [{ txid, event: 'sent', lang: 'en', from: ADDR.user, to: ADDR.deployer, amount: '1500000' }]);

  /* nœud complet seul = « Confirming » : toujours PAS d'e-mail « confirmé » */
  node.state.infoFull[txid] = transferInfo({ txid });
  await s.page.click('[data-chain="check"]');
  await s.page.waitForFunction(() => document.querySelectorAll('.ch-steps li.on').length === 2);
  await s.page.waitForTimeout(300);
  assert.equal((await calls(s.page)).filter(b => b.event === 'confirmed').length, 0, 'jamais « confirmé » avant la preuve');

  /* preuve complète (solidity + SUCCESS + événement Transfer) */
  node.state.infoSol[txid] = transferInfo({ txid });
  await s.page.click('[data-chain="check"]');
  await s.page.waitForFunction(() => document.querySelector('.ch-state.ok') !== null);
  await waitCalls(s.page, 2);
  assert.deepEqual((await calls(s.page)).map(b => b.event), ['sent', 'confirmed']);
  assert.deepEqual((await calls(s.page))[1], { txid, event: 'confirmed', lang: 'en' }, 'le détail du transfert n\'est pas renvoyé pour « confirmé » : le serveur le relit sur la chaîne');

  await s.page.waitForTimeout(600);                              /* état final : plus de bouton « vérifier », plus aucun appel */
  assert.equal((await calls(s.page)).length, 2, 'aucun doublon');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('adresse de destination quelconque (valide) : l\'e-mail « c\'est parti » est demandé aussi pour une adresse jamais vue', { skip }, async () => {
  const { s } = await setup();
  await send(s.page, ADDR.stranger || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', '2');
  await waitCalls(s.page, 1);
  const [b] = await calls(s.page);
  assert.equal(b.event, 'sent'); assert.equal(b.to, ADDR.stranger || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'); assert.equal(b.amount, '2000000');
  await s.ctx.close();
});

test('signature refusée dans TronLink : rien n\'est diffusé, AUCUN e-mail', { skip }, async () => {
  const { node, s } = await setup({ signMode: 'reject' });
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '2');
  await s.page.click('[data-chain="review"]');
  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /You refused the signature in TronLink/.test(document.querySelector('#chain').innerText));
  await s.page.waitForTimeout(400);
  assert.equal(node.calls.broadcasts, undefined);
  assert.deepEqual(await calls(s.page), []);
  await s.ctx.close();
});

test('serveur d\'e-mail en panne : le transfert n\'en dépend pas ; nouvel essai au prochain changement d\'état', { skip }, async () => {
  const { node, s } = await setup();
  await s.page.evaluate(() => { window.__invMode = 'fail'; });
  await send(s.page);
  await waitCalls(s.page, 1);
  assert.match(await s.page.innerText('#chain'), /Sent to the network/, 'le transfert est affiché normalement');
  assert.equal((await calls(s.page))[0].event, 'sent');
  const txid = node.calls.find(c => c.path === '/wallet/broadcasttransaction').body.txID;
  await s.page.evaluate(() => { window.__invMode = 'ok'; });
  node.state.infoFull[txid] = transferInfo({ txid });           /* changement d'état -> nouvel essai */
  await s.page.click('[data-chain="check"]');
  await waitCalls(s.page, 2);
  assert.deepEqual((await calls(s.page)).map(b => b.event), ['sent', 'sent']);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('règles de décision : états, âge, txid invalide, e-mail « confirmé » seulement pour un envoi annoncé ou récent, jamais bloquant', { skip }, async () => {
  const { s } = await setup();
  const r = await s.page.evaluate(async () => {
    const out = {}; const id = n => n.repeat(64);
    const rec = (n, over) => Object.assign({ txid: id(n), state: 'broadcasted', createdAt: Date.now() - 60e3, from: 'TA', to: 'TB', amountRaw: '5' }, over);
    const run = async (label, rc) => { window.__inv.length = 0; ChainNotice.handle(rc); await new Promise(r => setTimeout(r, 120)); out[label] = window.__inv.filter(c => c.name === 'chain-notice').map(c => c.body.event); };
    await run('recent_broadcasted', rec('a'));
    await run('failed', rec('b', { state: 'failed' }));
    await run('cancelled', rec('c', { state: 'cancelled' }));
    await run('draft', rec('d', { state: 'draft' }));
    await run('bad_txid', rec('e', { txid: 'zz' }));
    await run('no_createdAt', rec('f', { createdAt: undefined }));
    await run('old_broadcasted', rec('1', { createdAt: Date.now() - 3 * 3600e3 }));
    await run('old_confirmed_never_announced', rec('2', { state: 'confirmed', createdAt: Date.now() - 3 * 3600e3 }));
    await run('recent_confirmed', rec('3', { state: 'confirmed' }));
    ChainNotice.handle(rec('4'));                                  /* annoncé « c'est parti » ... */
    await new Promise(r => setTimeout(r, 120));
    await run('confirmed_after_announced_but_old', rec('4', { state: 'confirmed', createdAt: Date.now() - 3 * 3600e3 }));
    await run('too_old_even_if_announced', rec('4', { state: 'confirmed', createdAt: Date.now() - 30 * 3600e3 }));
    window.__invMode = 'fail'; window.__inv.length = 0;               /* serveur en panne : jamais plus de 3 essais pour le même e-mail */
    for (let i = 0; i < 6; i++) { ChainNotice.handle(rec('6')); await new Promise(r => setTimeout(r, 60)); }
    out.fail_cap = window.__inv.filter(c => c.name === 'chain-notice').length; window.__invMode = 'ok';
    const saved = sb; sb = null;                                  /* pas de Supabase : ne jette jamais */
    let threw = false; try { ChainNotice.handle(rec('5')); ChainNotice.handle(null); ChainNotice.attach(null); } catch (e) { threw = true; }
    sb = saved; out.threw = threw;
    return out;
  });
  assert.deepEqual(r, {
    recent_broadcasted: ['sent'], failed: [], cancelled: [], draft: [], bad_txid: [], no_createdAt: [],
    old_broadcasted: [], old_confirmed_never_announced: [], recent_confirmed: ['sent', 'confirmed'],
    confirmed_after_announced_but_old: ['confirmed'], too_old_even_if_announced: [], fail_cap: 3, threw: false,
  });
  await s.ctx.close();
});

test('aucun secret : ce que l\'app envoie ne contient ni clé, ni signature, ni e-mail ; la CSP n\'est pas violée', { skip }, async () => {
  const { s } = await setup();
  await s.page.evaluate(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.blockedURI)); });
  await send(s.page);
  await waitCalls(s.page, 1);
  const blob = JSON.stringify(await calls(s.page));
  assert.ok(!/signature|private|secret|key|@/i.test(blob), blob);
  assert.deepEqual(Object.keys((await calls(s.page))[0]).sort(), ['amount', 'event', 'from', 'lang', 'to', 'txid']);
  assert.deepEqual(await s.page.evaluate(() => window.__csp), []);
  await s.ctx.close();
});
