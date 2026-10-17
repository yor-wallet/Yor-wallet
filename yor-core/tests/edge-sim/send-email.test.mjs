import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* Exécute supabase/functions/send-email/index.ts TEL QUEL en mode « dry_run » (aucun envoi, aucun réseau) contre un faux Supabase en mémoire.
   Prouve le RENDU des e-mails Friendly Pay (12.9.0) : nom de l'expéditeur, en-tête, libellés, identifiants affichés FRD-…, EN / FR / AR.
   Ne prouve PAS la remise par Brevo ni l'adresse d'expéditeur validée chez Brevo. */

const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', APP_URL: 'https://app.example.test' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__handler = h; } };
const sim = { users: {}, rows: [], tables: {}, rpc: { get_webhook_secret: () => 'whsec' } };
globalThis.__chainSim = sim;
await import('../../supabase/functions/send-email/index.ts');
const handler = globalThis.__handler;
const T = () => sim.tables;
const dry = async (log_id) => {
  const r = await handler(new Request('https://fn.test/send-email', { method: 'POST', headers: { 'x-webhook-secret': 'whsec', 'content-type': 'application/json' }, body: JSON.stringify({ dry_run: true, log_id }) }));
  return { status: r.status, body: await r.json() };
};
/* L'adresse d'expéditeur validée chez Brevo (yordigitalefinance@gmail.com) reste affichée comme contact : elle n'est pas modifiable sans un nouvel expéditeur validé. On la retire avant de chercher « YOR / NEX ». */
const noAddr = (s) => s.replaceAll('yordigitalefinance@gmail.com', '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

beforeEach(() => { for (const k of Object.keys(T())) delete T()[k]; });

function seed(lang, type, extra = {}) {
  T().user_docs = [{ user_id: 'u1', doc_name: 'preferences', data: { language: lang } }];
  T().profiles = [
    { id: 'u1', first_name: 'Said', last_name: 'Ahmed', welcome_email_sent_at: null, yor_id: 'YOR-AB12CD' },
    { id: 'u2', first_name: 'Aisha', last_name: 'K', yor_id: 'YOR-ZZ99YY' },
  ];
  T().transactions = [{ id: 'tx1', status: 'CONFIRMED', amount: 5, asset: 'OMR', fee: 0, kind: 'FIAT_TRANSFER', reference: 'YOR-TX-20261016-ABC123', created_at: '2026-10-16T08:02:12Z',
    sender_id: 'u1', receiver_id: 'u2', meta: {} }];
  T().ledger_entries = [{ id: 1, transaction_id: 'tx1', user_id: 'u1', asset: 'OMR', delta: -5 }, { id: 2, transaction_id: 'tx1', user_id: 'u2', asset: 'OMR', delta: 5 }];
  T().email_logs = [{ id: 'l1', user_id: 'u1', email_type: type, recipient_email: 'u1@example.test', transaction_id: 'tx1', attempts: 0, payload: {}, ...extra }];
}

test('refuse sans secret (401) : l\'authentification est inchangée', async () => {
  const r = await handler(new Request('https://fn.test/send-email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(r.status, 401);
});

for (const [lang, brandWord, idLabel] of [['en', 'Welcome to Friendly Pay', 'Friendly ID'], ['fr', 'Bienvenue sur Friendly Pay', 'Friendly ID'], ['ar', 'مرحباً بك في Friendly Pay', 'Friendly ID']]) {
  test(`${lang} : e-mail de bienvenue — expéditeur « Friendly Pay », en-tête turquoise, aucune trace de NEX / YOR`, async () => {
    seed(lang, 'WELCOME');
    const { status, body } = await dry('l1');
    assert.equal(status, 200);
    assert.equal(body.from.name, 'Friendly Pay');
    assert.equal(body.replyTo.name, 'Friendly Pay');
    assert.ok(body.subject.startsWith(brandWord), body.subject);
    assert.match(body.html, /background:#0B7F75/);
    assert.match(text(body.html), /Friendly\s+Pay/);
    assert.match(text(body.html), /Friendly Pay (est un service de|is a service of|خدمة من) Friendly\./);
    assert.doesNotMatch(noAddr(body.subject + body.html), /\bNEX\b|WALLET|Yor Digital|\bYOR\b|#0b1220|#2563eb/i);
    assert.equal(body.dir ?? null, lang === 'ar' ? 'rtl' : 'ltr');
  });

  test(`${lang} : e-mails de sécurité — « Friendly Pay » dans le texte`, async () => {
    for (const type of ['SEC_PASSWORD_CHANGED', 'SEC_EMAIL_CHANGED', 'SEC_PIN_CHANGED', 'SEC_NEW_DEVICE']) {
      seed(lang, type, { payload: { new_email: 'n@example.test' } });
      const { body } = await dry('l1');
      assert.match(body.html, /Friendly Pay/, type);
      assert.doesNotMatch(noAddr(body.subject + body.html), /\bNEX\b|WALLET|\bYOR\b/i, type);
    }
  });

  test(`${lang} : transaction — identifiants et référence affichés FRD-…, libellé « ${idLabel} », jamais « YOR »`, async () => {
    seed(lang, 'TX_SENDER');
    const s = (await dry('l1')).body, st = text(s.html);
    assert.ok(st.includes('FRD-TX-20261016-ABC123'), st);
    assert.ok(st.includes('FRD-ZZ99YY') || st.includes('Aisha'), st);
    assert.ok(st.includes(idLabel), st);
    assert.doesNotMatch(noAddr(s.subject + s.html), /\bYOR\b|\bNEX\b/i);
    assert.match(s.html, /background:#0B7F75/);
    // côté bénéficiaire
    seed(lang, 'TX_RECEIVER', { user_id: 'u2', recipient_email: 'u2@example.test' });
    T().user_docs = [{ user_id: 'u2', doc_name: 'preferences', data: { language: lang } }];
    const r = (await dry('l1')).body;
    assert.ok(text(r.html).includes('FRD-TX-20261016-ABC123'));
    assert.doesNotMatch(noAddr(r.subject + r.html), /\bYOR\b|\bNEX\b/i);
  });
}

test('un identifiant sans nom reste lisible : « FRD-… » et non « YOR-… »', async () => {
  seed('en', 'TX_SENDER');
  T().profiles[1] = { id: 'u2', first_name: '', last_name: '', yor_id: 'YOR-ZZ99YY' };
  const s = (await dry('l1')).body;
  assert.ok(text(s.html).includes('FRD-ZZ99YY'));
  assert.doesNotMatch(noAddr(s.html), /\bYOR\b/);
});

test('le solde n\'apparaît jamais dans un e-mail de transaction (règle 12.6.1 conservée)', async () => {
  seed('en', 'TX_SENDER');
  const s = (await dry('l1')).body;
  assert.doesNotMatch(text(s.html), /balance|solde|الرصيد/i);
});
