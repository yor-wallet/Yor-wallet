import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TOKEN_ADDRESS, TRANSFER_SELECTOR, TRANSFER_TOPIC, base58ToHex41 } from '../../supabase/functions/chain-notice/lib.ts';

/* Exécute supabase/functions/chain-notice/index.ts TEL QUEL contre un faux Supabase (table chain_notices en mémoire, jetons fictifs),
   un faux nœud TRON Nile et un faux Brevo. Aucun réseau. Ne prouve PAS PostgREST/RLS ni la livraison réelle d'un e-mail (voir docs/NOTICES.md). */

const sha256 = (b) => new Uint8Array(createHash('sha256').update(b).digest());
const TOKEN = base58ToHex41(TOKEN_ADDRESS, sha256);
const A = 'TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad';
const B = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const C = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC';
const hexOf = (a) => base58ToHex41(a, sha256);
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const aw = (hex41) => '0'.repeat(24) + hex41.slice(2);
const TX = 'ab'.repeat(32);

const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'brevo-test-key' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__handler = h; } };
globalThis.__chainSim = { users: { 'jwt-alice': { id: 'u-alice', email: 'alice@example.test' }, 'jwt-bob': { id: 'u-bob', email: 'bob@example.test' } }, rows: [] };
await import('../../supabase/functions/chain-notice/index.ts');
const handler = globalThis.__handler;

const world = { nodeDown: false, tx: {}, info: {}, brevo: [], brevoStatus: 201, nodeCalls: [] };
const chainTx = (over = {}, value = {}) => ({
  txID: TX,
  raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value: Object.assign({
    owner_address: hexOf(A), contract_address: TOKEN, call_value: 0, data: TRANSFER_SELECTOR + aw(hexOf(B)) + word(1_500_000) }, value) } }] },
  ...over
});
const chainInfo = (over = {}) => ({
  id: TX, blockNumber: 4242, receipt: { result: 'SUCCESS' },
  log: [{ address: TOKEN.slice(2), topics: [TRANSFER_TOPIC, aw(hexOf(A)), aw(hexOf(B))], data: word(1_500_000) }], ...over
});

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('https://nile.trongrid.io')) {
    world.nodeCalls.push(u);
    if (world.nodeDown) throw new Error('node down');
    const path = new URL(u).pathname;
    return new Response(JSON.stringify(path === '/wallet/gettransactionbyid' ? world.tx : world.info), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u === 'https://api.brevo.com/v3/smtp/email') {
    const body = JSON.parse(init.body);
    world.brevo.push({ body, key: init.headers['api-key'] });
    return new Response(JSON.stringify(world.brevoStatus === 201 ? { messageId: '<m' + world.brevo.length + '@brevo>' } : { code: 'invalid_parameter', message: 'boom' }), { status: world.brevoStatus });
  }
  throw new Error('appel réseau inattendu: ' + u);
};

const call = async (body, { jwt = 'jwt-alice', method = 'POST' } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (jwt) headers.authorization = 'Bearer ' + jwt;
  const r = await handler(new Request('https://fn.test/chain-notice', { method, headers, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined }));
  let b = null; try { b = await r.json(); } catch { /* 204 */ }
  return { status: r.status, body: b };
};
const sentBody = (over = {}) => ({ txid: TX, event: 'sent', lang: 'en', from: A, to: B, amount: '1500000', ...over });

beforeEach(() => {
  globalThis.__chainSim.rows.length = 0;
  Object.assign(world, { nodeDown: false, tx: {}, info: {}, brevo: [], brevoStatus: 201, nodeCalls: [] });
});

test('accès : méthode, jeton de connexion, entrées', async () => {
  assert.equal((await call(null, { method: 'OPTIONS' })).status, 204);
  assert.equal((await call(null, { method: 'GET' })).status, 405);
  assert.equal((await call(sentBody(), { jwt: null })).status, 401);
  assert.equal((await call(sentBody(), { jwt: 'jwt-inconnu' })).status, 401);
  assert.equal((await call(sentBody({ txid: 'xyz' }))).body.error, 'invalid_txid');
  assert.equal((await call(sentBody({ event: 'received' }))).body.error, 'invalid_event');
  assert.equal(world.brevo.length, 0);
});

test('« sent » PART TOUT DE SUITE même si le nœud est injoignable (la chaîne n\'est pas attendue)', async () => {
  world.nodeDown = true;
  const r = await call(sentBody());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, event: 'sent' });
  assert.equal(world.brevo.length, 1);
  const m = world.brevo[0].body;
  assert.equal(world.brevo[0].key, 'brevo-test-key');
  assert.deepEqual(m.to, [{ email: 'alice@example.test' }]);
  assert.match(m.subject, /Transfer sent: 1\.500000 YOR-USDT/);
  assert.match(m.textContent, /NOT confirmed yet/);
  assert.ok(m.htmlContent.includes(A) && m.htmlContent.includes(B) && m.htmlContent.includes(TX));
  assert.doesNotMatch(m.subject, /confirmed/i);
  assert.equal(globalThis.__chainSim.rows[0].status, 'SENT');
});

test('« sent » quand le nœud ne connaît pas encore la transaction : détails annoncés utilisés, adresse de destination quelconque', async () => {
  world.tx = {};   // gettransactionbyid renvoie {} tant que la transaction n'est pas propagée
  const r = await call(sentBody({ to: C, amount: '25000000' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(world.brevo[0].body.subject, /25\.000000 YOR-USDT/);
  assert.ok(world.brevo[0].body.htmlContent.includes(C));
});

test('« sent » : détails absents ou invalides ⇒ 400 et AUCUN e-mail (rien n\'est inventé)', async () => {
  world.nodeDown = true;
  const bad = [
    { from: undefined }, { to: undefined }, { to: 'TTwCMjPHQGJ4fMswfUYvqQ' }, { to: A.slice(0, -1) + (A.endsWith('d') ? 'e' : 'd') },
    { amount: undefined }, { amount: '0' }, { amount: '-1' }, { amount: '1.5' }, { amount: 1500000 }, { amount: '9'.repeat(31) },
  ];
  for (const o of bad) {
    const r = await call(sentBody(o));
    assert.equal(r.status, 400, JSON.stringify(o) + ' ' + JSON.stringify(r.body));
  }
  assert.equal(world.brevo.length, 0);
  assert.equal(globalThis.__chainSim.rows.length, 0, 'aucune ligne réservée pour une entrée refusée');
});

test('« sent » : si le nœud connaît DÉJÀ la transaction, ses valeurs font foi (pas celles annoncées)', async () => {
  world.tx = chainTx();   // A -> B, 1,5
  const r = await call(sentBody({ to: C, amount: '999999999' }));
  assert.equal(r.status, 200);
  const m = world.brevo[0].body;
  assert.match(m.subject, /1\.500000 YOR-USDT/);
  assert.ok(m.htmlContent.includes(B) && !m.htmlContent.includes(C));
});

test('« sent » : transaction connue de la chaîne mais qui n\'est PAS un transfert YOR-USDT ⇒ 422, aucun e-mail', async () => {
  world.tx = chainTx({}, { contract_address: '41' + '22'.repeat(20) });
  const r = await call(sentBody());
  assert.equal(r.status, 422); assert.equal(r.body.error, 'not_the_yor_token');
  assert.equal(world.brevo.length, 0);
});

test('un seul e-mail par (personne, transaction, événement) ; un autre compte a son propre e-mail', async () => {
  world.nodeDown = true;
  assert.equal((await call(sentBody())).status, 200);
  const again = await call(sentBody());
  assert.deepEqual(again.body, { ok: true, already: true });
  assert.equal(world.brevo.length, 1);
  assert.equal((await call(sentBody(), { jwt: 'jwt-bob' })).status, 200);
  assert.equal(world.brevo.length, 2);
  assert.deepEqual(world.brevo[1].body.to, [{ email: 'bob@example.test' }]);
});

test('l\'e-mail part TOUJOURS vers l\'adresse du compte connecté, jamais vers une adresse fournie', async () => {
  world.nodeDown = true;
  await call(sentBody({ email: 'pirate@example.test', to_email: 'pirate@example.test' }));
  assert.deepEqual(world.brevo[0].body.to, [{ email: 'alice@example.test' }]);
});

test('« confirmed » : pas de preuve ⇒ 409 et AUCUN e-mail (nœud solidity muet, pas de bloc, revert, événement absent)', async () => {
  world.tx = chainTx();
  const cases = [
    [{}, 'not_solidified_yet'],
    [chainInfo({ blockNumber: 0 }), 'no_block'],
    [chainInfo({ receipt: { result: 'REVERT' } }), 'receipt_revert'],
    [chainInfo({ log: [] }), 'transfer_event_not_found'],
  ];
  for (const [info, reason] of cases) {
    world.info = info;
    const r = await call({ txid: TX, event: 'confirmed', lang: 'en' });
    assert.equal(r.status, 409, reason);
    assert.equal(r.body.error, 'not_confirmed'); assert.equal(r.body.reason, reason);
  }
  assert.equal(world.brevo.length, 0, 'jamais d\'e-mail « confirmé » sans preuve');
  assert.equal(globalThis.__chainSim.rows.length, 0);
});

test('« confirmed » : nœud injoignable ⇒ 502, transaction inconnue ⇒ 404, aucun e-mail', async () => {
  world.nodeDown = true;
  assert.equal((await call({ txid: TX, event: 'confirmed' })).status, 502);
  world.nodeDown = false; world.tx = {};
  assert.equal((await call({ txid: TX, event: 'confirmed' })).status, 404);
  assert.equal(world.brevo.length, 0);
});

test('« confirmed » avec preuve complète : e-mail avec le bloc ; les détails de l\'appelant sont ignorés ; pas de doublon', async () => {
  world.tx = chainTx(); world.info = chainInfo();
  const r = await call({ txid: TX, event: 'confirmed', lang: 'fr', from: C, to: C, amount: '1' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const m = world.brevo[0].body;
  assert.match(m.subject, /Transfert confirmé : 1\.500000 YOR-USDT/);
  assert.match(m.textContent, /Bloc: 4242/);
  assert.ok(m.htmlContent.includes(B) && !m.htmlContent.includes(C));
  assert.deepEqual((await call({ txid: TX, event: 'confirmed' })).body, { ok: true, already: true });
  assert.equal(world.brevo.length, 1);
});

test('« sent » puis « confirmed » : deux e-mails distincts pour la même transaction', async () => {
  world.nodeDown = true;
  await call(sentBody());
  world.nodeDown = false; world.tx = chainTx(); world.info = chainInfo();
  assert.equal((await call({ txid: TX, event: 'confirmed' })).status, 200);
  assert.equal(world.brevo.length, 2);
  assert.match(world.brevo[0].body.subject, /sent/i); assert.match(world.brevo[1].body.subject, /confirmed/i);
});

test('limite de 30 e-mails crypto par personne et par 24 h', async () => {
  world.nodeDown = true;
  for (let i = 0; i < 30; i++) globalThis.__chainSim.rows.push({ id: 'old' + i, user_id: 'u-alice', txid: String(i).padStart(64, '0'), event: 'sent', status: 'SENT', created_at: new Date().toISOString() });
  const r = await call(sentBody());
  assert.equal(r.status, 429); assert.equal(r.body.error, 'rate_limited');
  assert.equal(world.brevo.length, 0);
  assert.equal((await call(sentBody(), { jwt: 'jwt-bob' })).status, 200, 'la limite est par personne');
});

test('fournisseur e-mail en échec ⇒ 502, ligne FAILED, nouvel essai possible puis envoyé une seule fois', async () => {
  world.nodeDown = true; world.brevoStatus = 400;
  const r1 = await call(sentBody());
  assert.equal(r1.status, 502); assert.equal(r1.body.error, 'email_refused');
  assert.equal(globalThis.__chainSim.rows[0].status, 'FAILED');
  assert.match(globalThis.__chainSim.rows[0].error_message, /brevo 400/);
  world.brevoStatus = 201;
  const r2 = await call(sentBody());
  assert.equal(r2.status, 200);
  assert.equal(globalThis.__chainSim.rows.length, 1);
  assert.equal(globalThis.__chainSim.rows[0].status, 'SENT');
  assert.deepEqual((await call(sentBody())).body, { ok: true, already: true });
});

test('envoi déjà en cours (moins de 2 minutes) : pas de second e-mail', async () => {
  world.nodeDown = true;
  globalThis.__chainSim.rows.push({ id: 'r1', user_id: 'u-alice', txid: TX, event: 'sent', status: 'SENDING', created_at: new Date().toISOString() });
  const r = await call(sentBody());
  assert.deepEqual(r.body, { ok: true, inProgress: true });
  assert.equal(world.brevo.length, 0);
});

test('aucune clé privée ni signature n\'est jamais demandée ou renvoyée', async () => {
  world.nodeDown = true;
  const r = await call(sentBody({ privateKey: '11'.repeat(32), signature: ['aa'] }));
  assert.equal(r.status, 200);
  const blob = JSON.stringify(world.brevo) + JSON.stringify(r.body);
  assert.ok(!blob.includes('11'.repeat(32)));
});
