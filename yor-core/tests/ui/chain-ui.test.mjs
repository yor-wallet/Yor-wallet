/* Test de bout en bout dans Chromium : l'écran YOR-USDT réel, un FAUX TronLink, un FAUX nœud Nile (réponses réelles enregistrées).
   Lancer : npm run test:ui   (ignoré automatiquement si Chromium / Playwright / le dossier yor-wallet sont absents). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { available, launch, openScreen } from './ui-harness.mjs';
import { loadChain, makeClock, makeNode } from '../web/harness.mjs';
import { ADDR, transferInfo } from '../web/fixtures.mjs';

const SHOTS = process.env.YOR_SHOTS || resolve(dirname(fileURLToPath(import.meta.url)), '../../.shots');
mkdirSync(SHOTS, { recursive: true });
const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';

const Y = loadChain();
const newNode = (init = {}) => makeNode(Y, makeClock(Date.now()), init);
const WALLET = { address: ADDR.user };
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const text = page => page.innerText('#chain');
const shot = (page, name) => page.screenshot({ path: SHOTS + '/' + name + '.png' });
async function connect(page) {
  await page.click('[data-chain="connect"]');
  await page.waitForSelector('.ch-big');
}

test('sans TronLink : message clair, aucune requête vers un autre hôte que Nile', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node });
  const txt = await text(s.page);
  assert.match(txt, /TronLink was not detected/);
  assert.match(txt, /DApp browser/);
  assert.equal(await s.page.locator('[data-chain="connect"]').count(), 0);
  assert.equal(await s.page.locator('#ch-to').count(), 0, 'pas de formulaire d\'envoi sans portefeuille');
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.external, []);
  await shot(s.page, '01-no-wallet');
  await s.ctx.close();
});

test('connexion : adresse, réseau Nile ✓, solde lu sur la chaîne avec l\'étiquette TEST BALANCE', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  const txt = await text(s.page);
  assert.match(txt, /TWoXF3…rfaX9/);
  assert.match(txt, /Nile Testnet/);
  assert.match(txt, /1,870,000\.00/);
  assert.match(txt, /TEST BALANCE/);
  assert.match(txt, /Read on the blockchain \(confirmed\)/);
  assert.match(txt, /1,000\.00 TRX/);
  assert.equal(await s.page.locator('.ch-chip.ok').count(), 1);
  assert.deepEqual(await s.page.evaluate(() => window.__tl.requests.slice(0, 2)), ['eth_requestAccounts', 'eth_chainId']);
  assert.ok(node.calls.every(c => c.host === 'nile.trongrid.io'), 'seuls les nœuds Nile sont appelés');
  assert.ok(node.calls.some(c => c.path === '/walletsolidity/triggerconstantcontract'), 'le solde vient du nœud solidity');
  assert.deepEqual(s.errors, []);
  await shot(s.page, '02-connected');
  await s.ctx.close();
});

test('transfert complet : vérification → signature TronLink → envoyé → confirmé seulement sur preuve', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '1.5');
  await s.page.click('[data-chain="review"]');
  await s.page.waitForSelector('[data-chain="confirm"]');
  let txt = await text(s.page);
  assert.match(txt, /Review transfer/i);   /* innerText applique text-transform:uppercase du titre */
  assert.match(txt, /1\.50/);
  assert.match(txt, /TEST BALANCE/);
  assert.match(txt, /186182/);
  assert.match(txt, /≈ 18\.6182 TRX/);       /* frais estimés = énergie simulée × 100 sun */
  assert.match(txt, /28 TRX/);                /* plafond maximum */
  assert.match(txt, new RegExp(ADDR.deployer));
  await shot(s.page, '03-review');

  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /Sent to the network/.test(document.querySelector('#chain').innerText));
  const sign = await s.page.evaluate(() => window.__tl.signCalls);
  assert.equal(sign.length, 1, 'TronLink est appelé une seule fois');
  assert.equal(sign[0].raw_data.fee_limit, 28_000_000, 'le plafond signé est celui affiché');
  assert.equal(sign[0].raw_data.contract[0].type, 'TriggerSmartContract');
  assert.equal(node.calls.broadcasts, 1);
  const txid = node.calls.find(c => c.path === '/wallet/broadcasttransaction').body.txID;
  txt = await text(s.page);
  /* « Confirmé » figure dans la liste des étapes mais doit être grisé : seul le dernier cran allumé compte */
  const lit = () => s.page.$$eval('.ch-steps li.on', els => els.map(e => e.textContent.trim()));
  assert.deepEqual(await lit(), ['Sent to the network'], 'jamais « confirmé » avant la preuve');
  assert.equal(await s.page.locator('.ch-state.ok').count(), 0, 'pas d\'icône de succès avant la preuve');
  assert.match(txt, new RegExp(txid));
  assert.equal(await s.page.locator('a[href="https://nile.tronscan.org/#/transaction/' + txid + '"]').count(), 1);
  await shot(s.page, '04-broadcasted');

  /* nœud complet seul : « Confirming » mais PAS « Confirmed » */
  node.state.infoFull[txid] = transferInfo({ txid });
  await s.page.click('[data-chain="check"]');
  await s.page.waitForFunction(() => document.querySelectorAll('.ch-steps li.on').length === 2);
  assert.deepEqual(await lit(), ['Sent to the network', 'Confirming…']);
  assert.equal(await s.page.locator('.ch-state.ok').count(), 0);

  /* nœud solidity + SUCCESS + événement Transfer : « Confirmed » */
  node.state.infoSol[txid] = transferInfo({ txid });
  await s.page.click('[data-chain="check"]');
  await s.page.waitForFunction(() => document.querySelector('.ch-state.ok') !== null);
  assert.equal((await lit()).length, 3);
  txt = await text(s.page);
  assert.match(txt, /Finalised: the receipt is SUCCESS and the Transfer event matches/);
  assert.match(txt, /71670000/);
  assert.match(txt, /18\.6182 TRX/);        /* frais réellement payés, lus dans le reçu */
  await shot(s.page, '05-confirmed');
  assert.deepEqual(s.errors, []);

  /* retour : l'activité affiche le transfert */
  await s.page.click('[data-chain="cancel"]');
  await s.page.waitForSelector('.ch-act');
  assert.match(await text(s.page), /Sent[\s\S]*Confirmed on the blockchain/);
  await shot(s.page, '06-activity');
  await s.ctx.close();
});

test('refus dans TronLink : message clair, rien n\'est diffusé, l\'écran reste utilisable', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: { ...WALLET, signMode: 'reject' } });
  await connect(s.page);
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '2');
  await s.page.click('[data-chain="review"]');
  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /You refused the signature in TronLink/.test(document.querySelector('#chain').innerText));
  assert.equal(node.calls.broadcasts, undefined);
  await shot(s.page, '07-rejected');
  await s.page.click('[data-chain="cancel"]');
  await s.page.waitForSelector('#ch-to');
  assert.match(await text(s.page), /Cancelled/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('mauvais réseau dans TronLink (mainnet) : alerte rouge et envoi bloqué', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: { ...WALLET, chainId: '0x2b6653dc' } });
  await connect(s.page);
  assert.match(await text(s.page), /TronLink is on TRON mainnet\. Switch TronLink to Nile Testnet to send\./);
  assert.equal(await s.page.locator('.ch-chip.bad').count(), 1);
  assert.equal(await s.page.locator('[data-chain="review"]').isDisabled(), true);
  await shot(s.page, '08-wrong-network');
  await s.ctx.close();
});

test('adresse TronLink jamais activée (0 TRX) : solde 0 lu, bouton du faucet, envoi refusé avec explication', { skip }, async () => {
  const node = newNode({ accounts: {}, balances: {} });
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  const txt = await text(s.page);
  assert.match(txt, /no TRX on Nile yet/);
  assert.equal(await s.page.locator('a[href="https://nileex.io/join/getJoinPage"]').count(), 1);
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]');
  await s.page.waitForSelector('#ch-form-msg:not([hidden])');
  assert.match(await s.page.innerText('#ch-form-msg'), /amount is higher than your available YOR-USDT balance|no TRX on Nile yet/);
  await shot(s.page, '09-no-trx');
  await s.ctx.close();
});

test('validation du formulaire : adresse invalide, soi-même, montant invalide, solde dépassé', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  const attempt = async (to, amount) => {
    await s.page.fill('#ch-to', to); await s.page.fill('#ch-amount', amount);
    await s.page.click('[data-chain="review"]');
    await s.page.waitForSelector('#ch-form-msg:not([hidden])');
    return s.page.innerText('#ch-form-msg');
  };
  assert.match(await attempt('TWoXF3efc2EVQj2Fif5kMBNRFAJzRrfaX8', '1'), /not a valid TRON address/);
  assert.match(await attempt(ADDR.user, '1'), /cannot send to your own address/);
  assert.match(await attempt(ADDR.deployer, '0'), /amount greater than zero/);
  assert.match(await attempt(ADDR.deployer, '1.1234567'), /6 decimals at most/);
  assert.match(await attempt(ADDR.deployer, '1870000.000001'), /higher than your available/);
  assert.match(await attempt(ADDR.zero, '1'), /zero address/);
  assert.equal(node.calls.broadcasts, undefined);
  assert.equal(await s.page.evaluate(() => window.__tl.signCalls.length), 0);
  await s.ctx.close();
});

test('bouton Max : remplit exactement le solde disponible', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  await s.page.click('[data-chain="max"]');
  assert.equal(await s.page.inputValue('#ch-amount'), '1870000');
  await s.ctx.close();
});

for (const [lang, probe] of [['fr', /Réseau de test/], ['ar', /شبكة تجريبية/]]) {
  test('langue ' + lang + ' : écran complet, sens d\'écriture et aucun débordement horizontal', { skip }, async () => {
    const node = newNode();
    const s = await openScreen(browser, { node, wallet: WALLET, lang });
    assert.match(await text(s.page), probe);
    await connect(s.page);
    await s.page.fill('#ch-to', ADDR.deployer);
    await s.page.fill('#ch-amount', '1,5');
    await s.page.click('[data-chain="review"]');
    await s.page.waitForSelector('[data-chain="confirm"]');
    assert.equal(await s.page.evaluate(() => document.documentElement.dir), lang === 'ar' ? 'rtl' : 'ltr');
    const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, 'débordement horizontal : ' + overflow + 'px');
    assert.doesNotMatch(await text(s.page), /chain\.[a-z]/, 'clé de traduction manquante');
    await shot(s.page, '10-' + lang + '-review');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  });
}

test('thème clair + petit écran 320 px : pas de débordement', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET, theme: 'light', viewport: { width: 320, height: 640 } });
  await connect(s.page);
  const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, 'débordement : ' + overflow + 'px');
  await shot(s.page, '11-light-320');
  await s.ctx.close();
});

test('aucune clé en clair : le DOM et le stockage de la page ne contiennent aucun secret après un transfert', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: WALLET });
  await connect(s.page);
  await s.page.fill('#ch-to', ADDR.deployer); await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]'); await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /Sent to the network/.test(document.querySelector('#chain').innerText));
  const dump = await s.page.evaluate(() => document.documentElement.outerHTML + JSON.stringify(Object.assign({}, localStorage)));
  assert.equal(/privateKey|mnemonic|seed phrase|secret/i.test(dump), false);
  assert.ok(dump.includes('yor_chain_tx_v1_nile'));
  await s.ctx.close();
});

test('signature : 5 minutes pour approuver (transaction à validité allongée) et le message le dit pendant l\'attente', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: { ...WALLET, signMode: 'hang' } });
  await connect(s.page);
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]');
  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /You have about 5 minutes/.test(document.querySelector('#chain').innerText));
  const tx = await s.page.evaluate(() => window.__tl.signCalls[0]);
  assert.equal(tx.raw_data.expiration - tx.raw_data.timestamp, 300_000, 'validité de 5 minutes dans la transaction envoyée à TronLink');
  assert.doesNotMatch(await text(s.page), /about a minute/);
  assert.equal(node.calls.broadcasts, undefined, 'rien n\'est diffusé tant que TronLink n\'a pas signé');
  await shot(s.page, '12-waiting-signature');
  await s.ctx.close();
});

test('si TronLink renvoie une transaction différente de la version allongée : refus, rien diffusé, puis le nouvel essai utilise la transaction standard du nœud (60 s)', { skip }, async () => {
  const node = newNode();
  const s = await openScreen(browser, { node, wallet: { ...WALLET, signMode: 'garble' } });
  await connect(s.page);
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]');
  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /different transaction|Please try again/.test(document.querySelector('#chain').innerText));
  assert.match(await text(s.page), /standard 1-minute validity/);
  assert.equal(node.calls.broadcasts, undefined);
  await s.page.evaluate(() => { window.__tl.mode = 'approve'; });
  await s.page.click('[data-chain="cancel"]');
  await s.page.waitForSelector('[data-chain="review"]');
  await s.page.fill('#ch-to', ADDR.deployer);
  await s.page.fill('#ch-amount', '1');
  await s.page.click('[data-chain="review"]');
  await s.page.click('[data-chain="confirm"]');
  await s.page.waitForFunction(() => /Sent to the network/.test(document.querySelector('#chain').innerText));
  const calls = await s.page.evaluate(() => window.__tl.signCalls.map(t => t.raw_data.expiration - t.raw_data.timestamp));
  assert.equal(calls.length, 2);
  assert.equal(calls[0], 300_000);
  assert.equal(calls[1], 57_500, 'deuxième essai : expiration d\'origine du nœud, non modifiée');
  assert.equal(node.calls.broadcasts, 1);
  await s.ctx.close();
});
