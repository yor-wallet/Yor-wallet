import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* 12.5.0 — configuration des SMS par secrets, sans changer le code :
   1) SMS_TEMPLATE=compact  → retour aux anciens gabarits d'une ligne (retour arrière immédiat si les nouveaux modèles ne conviennent pas) ;
   2) SMS_PROVIDER=brevo    → aucun suivi de livraison interrogé (UNSUPPORTED), aucun appel de rapport.
   Les deux cas sont exécutés dans ce fichier avec deux copies indépendantes de index.ts (chaque copie lit ses secrets au chargement). */

const UUID = '33333333-3333-4333-8333-333333333333';
const sim = { users: { 'jwt-s1': { id: 's1', email: 's1@example.test' } }, rows: [], tables: {}, rpc: {} };
globalThis.__chainSim = sim;
sim.rpc.claim_recipient_notices = ({ p_id }) => {
  const r = (sim.tables.recipient_notices || []).find((x) => x.id === p_id && ['PENDING', 'FAILED'].includes(x.status));
  if (!r) return [];
  r.status = 'SENDING'; return [{ ...r }];
};

async function load(envOver, tag) {
  const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', ...envOver };
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__handler = h; } };
  await import('../../supabase/functions/send-notice/index.ts?' + tag);
  return globalThis.__handler;
}

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, method: init.method || 'GET', body: init.body });
  if (u === 'https://api.infobip.com/sms/3/messages') return new Response(JSON.stringify({ messages: [{ messageId: 'MSGCOMPACT1', status: { groupId: 1, name: 'PENDING_ACCEPTED' } }] }), { status: 200 });
  if (u === 'https://api.brevo.com/v3/transactionalSMS/send') return new Response(JSON.stringify({ messageId: 987654 }), { status: 201 });
  throw new Error('appel réseau inattendu: ' + u);
};

const T = () => sim.tables;
function seed() {
  T().transactions = [{ id: UUID, status: 'CONFIRMED', amount: 30, asset: 'OMR', reference: 'YOR-TX-20261011-ABC123', created_at: '2026-10-11T11:22:27Z', sender_id: 's1', receiver_id: null, kind: 'FIAT_EXTERNAL', total: 30.1, meta: { provider: 'Mobile', beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+96891234567' } } }];
  T().profiles = [{ id: 's1', first_name: 'Said', last_name: 'Ahmed', country: 'OM' }];
  T().user_docs = [];
  T().ledger_entries = [{ id: 1, transaction_id: UUID, user_id: 's1', asset: 'OMR', balance_after: 1229.5 }];
  T().recipient_notices = [
    { id: 'n-ext', transaction_id: UUID, audience: 'EXTERNAL', channel: 'SMS', to_phone: '96891234567', status: 'PENDING', attempts: 0, country: 'OM', user_id: null, next_attempt_at: null },
    { id: 'n-snd', transaction_id: UUID, audience: 'SENDER', channel: 'SMS', to_phone: '96877986533', status: 'PENDING', attempts: 0, country: 'OM', user_id: 's1', next_attempt_at: null },
  ];
}
const run = async (handler) => handler(new Request('https://fn.test/send-notice', { method: 'POST', headers: { authorization: 'Bearer jwt-s1', 'content-type': 'application/json' }, body: JSON.stringify({ tx_id: UUID }) }));
beforeEach(() => { calls.length = 0; for (const k of Object.keys(T())) delete T()[k]; });

test('SMS_TEMPLATE=compact : anciens gabarits (Debit Alert / modèle arabe d\'une ligne), AUCUN solde, retour arrière sans toucher au code', async () => {
  const handler = await load({ SMS_PROVIDER: 'infobip', INFOBIP_API_KEY: 'AbCdEf0123456789AbCdEf0123456789', SMS_TEMPLATE: 'compact' }, 'compact');
  seed();
  await run(handler);
  const texts = calls.filter((c) => c.url.endsWith('/sms/3/messages')).map((c) => JSON.parse(c.body).messages[0].content.text);
  assert.equal(texts.length, 2);
  const snd = texts.find((t) => t.startsWith('Debit Alert'));
  assert.ok(snd, 'confirmation de débit ancienne forme : ' + JSON.stringify(texts));
  assert.match(snd, /^Debit Alert: OMR 30\.100 debited from your account/);
  const ext = texts.find((t) => t.startsWith('عزيزي العميل،\nتم تأكيد تحويل مبلغ'));
  assert.ok(ext, 'modèle arabe du bénéficiaire inchangé');
  assert.ok(texts.every((t) => !/Dear Customer|Available Balance|الرصيد المتاح/.test(t)));
});

test('SMS_TEMPLATE absent ou inconnu : modèle structuré par défaut (12.5.0), solde du registre sur la confirmation à l\'expéditeur', async () => {
  for (const [tag, over] of [['def', {}], ['bad', { SMS_TEMPLATE: 'fantaisie' }]]) {
    calls.length = 0; seed();
    const handler = await load({ SMS_PROVIDER: 'infobip', INFOBIP_API_KEY: 'AbCdEf0123456789AbCdEf0123456789', ...over }, tag);
    await run(handler);
    const texts = calls.filter((c) => c.url.endsWith('/sms/3/messages')).map((c) => JSON.parse(c.body).messages[0].content.text);
    const snd = texts.find((t) => t.startsWith('Dear Customer,'));
    assert.ok(snd, tag + ' : ' + JSON.stringify(texts));
    assert.match(snd, /\nFees \(incl\. VAT\): OMR 0\.100\nTotal debited: OMR 30\.100\nAvailable Balance: OMR 1,229\.500\nReference: FRD-TX-20261011-ABC123\nDate & Time: 11 Oct 2026, 15:22$/, snd);   // 12.12.0 : ce jeu de données porte un total > montant → les frais réels sont écrits
    for (const c of calls.filter((x) => x.url.endsWith('/sms/3/messages'))) assert.equal(JSON.parse(c.body).messages[0].sender, 'FriendlyPay', 'nom d\'expéditeur du SMS : plus « ServiceSMS »');
  }
});

test('Brevo : SMS envoyé, livraison « UNSUPPORTED » (aucun rapport interrogé), aucun doublon au second appel', async () => {
  const handler = await load({ SMS_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-' + 'a'.repeat(40) }, 'brevo');
  seed();
  await run(handler); await run(handler);
  assert.equal(calls.filter((c) => c.url.includes('transactionalSMS')).length, 2, 'un SMS par message, pas de doublon');
  const sms = T().recipient_notices;
  assert.ok(sms.every((n) => n.status === 'SENT' && n.delivery_status === 'UNSUPPORTED'), JSON.stringify(sms.map((n) => [n.status, n.delivery_status])));
  assert.ok(calls.every((c) => c.method === 'POST'), 'aucun appel de lecture de rapport');
});
