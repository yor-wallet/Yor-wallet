import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* 12.5.0 — envoi automatique, doublons, erreurs du fournisseur et SUIVI DE LA LIVRAISON des SMS.
   Exécute supabase/functions/send-notice/index.ts TEL QUEL contre un faux Supabase en mémoire et un faux Infobip. Aucun réseau.
   Prouve : un seul envoi par message (même en appels simultanés), reprise après erreur temporaire, arrêt après 5 tentatives, statut de livraison
   (DELIVERED / UNDELIVERABLE / PENDING / UNKNOWN) lu uniquement dans un rapport positif du fournisseur.
   NE prouve PAS : le format réel des rapports Infobip (endpoint /sms/1/logs, NON vérifié avec un vrai compte), ni la remise par un opérateur. */

const UUID = '22222222-2222-4222-8222-222222222222';
const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', SMS_PROVIDER: 'infobip', INFOBIP_API_KEY: 'AbCdEf0123456789AbCdEf0123456789' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__handler = h; } };
const sim = { users: { 'jwt-s1': { id: 's1', email: 's1@example.test' } }, rows: [], tables: {}, rpc: {} };
globalThis.__chainSim = sim;
sim.rpc.claim_recipient_notices = ({ p_id }) => {
  const r = (sim.tables.recipient_notices || []).find((x) => x.id === p_id && ['PENDING', 'FAILED'].includes(x.status));
  if (!r) return [];
  r.status = 'SENDING'; return [{ ...r }];
};
await import('../../supabase/functions/send-notice/index.ts');
const handler = globalThis.__handler;

const T = () => sim.tables;
let posts, gets, postReply, getReply;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === 'https://api.infobip.com/sms/3/messages') {
    posts.push(JSON.parse(init.body).messages[0]);
    return postReply(posts.length);
  }
  if (u.startsWith('https://api.infobip.com/sms/1/logs?')) {
    gets.push({ url: u, auth: init.headers && init.headers.Authorization });
    return getReply(new URL(u).searchParams.get('messageId'));
  }
  throw new Error('appel réseau inattendu: ' + u);
};
const accepted = (n) => new Response(JSON.stringify({ messages: [{ messageId: 'MSG' + n + '-abcdef', status: { groupId: 1, name: 'PENDING_ACCEPTED' } }] }), { status: 200 });
const report = (groupId, name) => new Response(JSON.stringify({ results: [{ messageId: 'x', status: { groupId, name } }] }), { status: 200 });

const NOW = () => new Date().toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
function seed({ attempts = 0, status = 'PENDING', sentAt = null, deliveryStatus = null, checkedAt = null, extra = {} } = {}) {
  T().transactions = [{ id: UUID, status: 'CONFIRMED', amount: 20, asset: 'OMR', reference: 'YOR-TX-20261012-DDDD11', created_at: '2026-10-12T07:08:00Z', sender_id: 's1', receiver_id: null, kind: 'FIAT_EXTERNAL', total: 20.1, meta: { provider: 'Mobile', beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+96891234567', name: 'Aisha Said' } } }];
  T().profiles = [{ id: 's1', first_name: 'Said', last_name: 'Ahmed', country: 'OM' }];
  T().user_docs = [];
  T().notice_dispatch_cfg = [{ id: true, token: 'internal-token' }];
  T().recipient_notices = [{
    id: 'n-snd', transaction_id: UUID, audience: 'SENDER', channel: 'SMS', to_phone: '96877986533', status, attempts, country: 'OM', user_id: 's1', created_at: NOW(), next_attempt_at: ago(1),
    sent_at: sentAt, provider_message_id: sentAt ? 'MSG1-abcdef' : null, delivery_status: deliveryStatus, delivery_checked_at: checkedAt, delivered_at: null, delivery_error: null, ...extra,
  }];
}
const N = () => T().recipient_notices[0];
const callTx = async () => { const r = await handler(new Request('https://fn.test/send-notice', { method: 'POST', headers: { authorization: 'Bearer jwt-s1', 'content-type': 'application/json' }, body: JSON.stringify({ tx_id: UUID }) })); return { status: r.status, body: await r.json() }; };
const sweep = async (token = 'internal-token') => { const r = await handler(new Request('https://fn.test/send-notice', { method: 'POST', headers: { 'x-notice-token': token, 'content-type': 'application/json' }, body: '{}' })); return { status: r.status, body: await r.json() }; };

beforeEach(() => { posts = []; gets = []; postReply = accepted; getReply = () => report(3, 'DELIVERED_TO_HANDSET'); for (const k of Object.keys(T())) delete T()[k]; });

test('ENVOI : le SMS part dès que le message est en file, le statut passe à SENT avec l\'identifiant du fournisseur et la livraison à PENDING', async () => {
  seed({});
  const r = await callTx();
  assert.equal(r.status, 200);
  assert.equal(posts.length, 1);
  assert.equal(N().status, 'SENT');
  assert.equal(N().provider_message_id, 'MSG1-abcdef');
  assert.equal(N().delivery_status, 'PENDING', 'accepté ≠ remis : la livraison reste à confirmer par un rapport du fournisseur');
  assert.ok(N().sent_at);
  assert.equal(N().error_message, null);
  assert.ok(!JSON.stringify(r.body).includes('96877986533'), 'la réponse ne contient aucun numéro');
});

test('DOUBLONS : deux appels simultanés pour la même transaction n\'envoient qu\'UN SMS', async () => {
  seed({});
  const [a, b] = await Promise.all([callTx(), callTx()]);
  assert.equal(posts.length, 1);
  assert.equal(a.body.processed + b.body.processed, 1);
  await callTx(); await sweep();
  assert.equal(posts.length, 1, 'ni un troisième appel ni le balayage ne renvoient un message déjà SENT');
});

test('ERREUR TEMPORAIRE du fournisseur (503) : le message reste à renvoyer, avec un délai ; la reprise l\'envoie UNE fois', async () => {
  seed({});
  postReply = (n) => (n === 1 ? new Response('down', { status: 503 }) : accepted(n));
  await callTx();
  assert.equal(N().status, 'FAILED');
  assert.equal(N().attempts, 1);
  assert.match(N().error_message, /503|down/);
  assert.ok(new Date(N().next_attempt_at).getTime() > Date.now(), 'nouvelle tentative programmée dans le futur');
  await sweep();                                           // trop tôt : rien ne part
  assert.equal(posts.length, 1);
  N().next_attempt_at = ago(1);                            // l'heure de la reprise est venue
  await sweep();
  assert.equal(posts.length, 2);
  assert.equal(N().status, 'SENT');
  assert.equal(N().attempts, 2);
  assert.equal(N().error_message, null);
  await sweep();
  assert.equal(posts.length, 2, 'une fois envoyé, plus jamais renvoyé');
});

test('ERREUR RÉSEAU : consignée (network:), reprise automatique', async () => {
  seed({});
  let first = true;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (first && String(url).includes('/sms/3/messages')) { first = false; throw new Error('ECONNRESET'); } return real(url, init); };
  try {
    await callTx();
    assert.equal(N().status, 'FAILED');
    assert.match(N().error_message, /^network: .*ECONNRESET/);
    N().next_attempt_at = ago(1);
    await sweep();
    assert.equal(N().status, 'SENT');
  } finally { globalThis.fetch = real; }
});

test('CRÉDITS ÉPUISÉS : le message est mis en attente (PENDING) sans brûler de tentative, motif consigné, aucun suivi de livraison', async () => {
  seed({});
  postReply = () => new Response(JSON.stringify({ messages: [{ messageId: 'M', status: { groupId: 5, name: 'REJECTED_NOT_ENOUGH_CREDITS', description: 'Not enough credits' } }] }), { status: 200 });
  await callTx();
  assert.equal(N().status, 'PENDING');
  assert.equal(N().attempts, 0);
  assert.match(N().error_message, /sms_credits_missing/);
  assert.equal(N().delivery_status, null, 'rien n\'est parti : aucun suivi de livraison');
});

test('NUMÉRO REFUSÉ par le fournisseur : échec définitif, pas de nouvelle tentative', async () => {
  seed({});
  postReply = () => new Response(JSON.stringify({ messages: [{ messageId: 'M', status: { groupId: 5, name: 'REJECTED_DESTINATION', description: 'Invalid destination' } }] }), { status: 200 });
  await callTx();
  assert.equal(N().status, 'FAILED');
  assert.equal(N().attempts, 5);
  N().next_attempt_at = ago(1);
  await sweep();
  assert.equal(posts.length, 1, 'le balayage ne reprend pas un message à 5 tentatives');
});

test('5 erreurs temporaires de suite : le message s\'arrête (jamais de boucle infinie)', async () => {
  seed({});
  postReply = () => new Response('down', { status: 503 });
  await callTx();
  for (let i = 0; i < 8; i++) { N().next_attempt_at = ago(1); await sweep(); }
  assert.equal(N().attempts, 5);
  assert.equal(N().status, 'FAILED');
  assert.equal(posts.length, 5);
});

/* ---------- suivi de la livraison ---------- */

test('LIVRAISON : rapport « delivered » du fournisseur ⇒ DELIVERED avec l\'heure ; relu une seule fois', async () => {
  seed({});
  await callTx();
  const r = await sweep();
  assert.equal(r.status, 200);
  assert.equal(r.body.delivery_checked, 1);
  assert.equal(gets.length, 1);
  assert.match(gets[0].url, /^https:\/\/api\.infobip\.com\/sms\/1\/logs\?messageId=MSG1-abcdef&limit=1$/);
  assert.match(gets[0].auth, /^App /);
  assert.equal(N().delivery_status, 'DELIVERED');
  assert.ok(N().delivered_at);
  assert.equal(N().delivery_error, null);
  assert.equal(N().status, 'SENT');
  await sweep();
  assert.equal(gets.length, 1, 'un SMS remis n\'est plus interrogé');
  assert.equal(posts.length, 1);
});

test('LIVRAISON : rapport « undeliverable / expired / rejected » ⇒ UNDELIVERABLE (sans renvoi automatique : un SMS accepté n\'est jamais doublé)', async () => {
  for (const [g, name] of [[2, 'UNDELIVERABLE_NOT_DELIVERED'], [4, 'EXPIRED_EXPIRED'], [5, 'REJECTED_NETWORK']]) {
    posts.length = 0; seed({});
    await callTx();
    getReply = () => report(g, name);
    await sweep();
    assert.equal(N().delivery_status, 'UNDELIVERABLE', name);
    assert.equal(N().delivery_error, name);
    assert.equal(N().delivered_at, null);
    await sweep();
    assert.equal(posts.length, 1, 'aucun renvoi');
  }
});

test('LIVRAISON : « pending » ou aucun rapport ⇒ reste PENDING ; relu au plus toutes les 90 s', async () => {
  seed({});
  await callTx();
  getReply = () => report(1, 'PENDING_ENROUTE');
  await sweep();
  assert.equal(N().delivery_status, 'PENDING');
  assert.ok(N().delivery_checked_at);
  await sweep();
  assert.equal(gets.length, 1, 'relu trop tôt : pas d\'appel');
  N().delivery_checked_at = ago(2);
  getReply = () => new Response(JSON.stringify({ results: [] }), { status: 200 });
  await sweep();
  assert.equal(gets.length, 2);
  assert.equal(N().delivery_status, 'PENDING');
  assert.equal(N().delivery_error, 'no_report_yet');
});

test('LIVRAISON : erreur du fournisseur (500, 401, réseau) ⇒ JAMAIS « remis » ni « non remis » ; le motif est consigné ; l\'envoi n\'est pas touché', async () => {
  for (const [reply, expected] of [
    [() => new Response('oops', { status: 500 }), 'infobip_500'],
    [() => new Response('{}', { status: 401 }), 'provider_auth'],
    [() => { throw new Error('boom'); }, /^network: .*boom/],
    [() => new Response(JSON.stringify({ results: [{ status: { groupId: 77, name: 'WEIRD' } }] }), { status: 200 }), 'group_77'],
  ]) {
    posts.length = 0; seed({});
    await callTx();
    getReply = reply;
    const r = await sweep();
    assert.equal(r.status, 200, 'le balayage ne plante pas');
    assert.equal(N().delivery_status, 'PENDING');
    if (expected instanceof RegExp) assert.match(N().delivery_error, expected); else assert.equal(N().delivery_error, expected);
    assert.equal(N().status, 'SENT');
    assert.equal(N().delivered_at, null);
    assert.equal(posts.length, 1);
  }
});

test('LIVRAISON : sans aucun rapport au bout de 24 h ⇒ UNKNOWN (jamais supposé remis)', async () => {
  seed({ status: 'SENT', sentAt: ago(25 * 60), deliveryStatus: 'PENDING' });
  await sweep();
  assert.equal(N().delivery_status, 'UNKNOWN');
  assert.equal(N().delivery_error, 'no_report_24h');
  assert.equal(gets.length, 0);
});

test('LIVRAISON : identifiant du fournisseur illisible ⇒ pas d\'appel, motif consigné', async () => {
  seed({ status: 'SENT', sentAt: ago(1), deliveryStatus: 'PENDING', extra: { provider_message_id: 'x y;z' } });
  await sweep();
  assert.equal(gets.length, 0);
  assert.equal(N().delivery_status, 'PENDING');
  assert.equal(N().delivery_error, 'invalid_message_id');
});

test('SÉCURITÉ : le balayage exige le jeton interne (401 sinon) et ne lit rien sans lui', async () => {
  seed({ status: 'SENT', sentAt: ago(1), deliveryStatus: 'PENDING' });
  const r = await sweep('mauvais-jeton');
  assert.equal(r.status, 401);
  assert.equal(gets.length, 0);
  assert.equal(N().delivery_status, 'PENDING');
});

test('SÉCURITÉ : ni la clé du fournisseur ni un numéro ne figurent dans les réponses de la fonction', async () => {
  seed({});
  postReply = () => new Response('Invalid login for App AbCdEf0123456789AbCdEf0123456789 to 96877986533', { status: 503 });
  const r = await callTx();
  const dump = JSON.stringify(r.body);
  assert.ok(!dump.includes('AbCdEf0123456789') && !dump.includes('96877986533'));
});
