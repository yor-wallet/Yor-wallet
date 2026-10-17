import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* Exécute supabase/functions/send-notice/index.ts TEL QUEL (chargement de la transaction, du profil, des lignes de file, choix de la langue, texte,
   requête au fournisseur SMS) contre un faux Supabase en mémoire et un faux Infobip. Aucun réseau.
   Ce banc prouve le CÂBLAGE du modèle arabe du 12 octobre 2026 (compte du bénéficiaire, « international », langue) ; il ne prouve pas la
   livraison d'un SMS par un opérateur ni le comportement réel de PostgREST / RLS. */

const UUID = '11111111-1111-4111-8111-111111111111';
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

const sent = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === 'https://api.infobip.com/sms/3/messages') {
    const m = JSON.parse(init.body).messages[0];
    sent.push({ to: m.destinations[0].to, text: m.content.text });
    return new Response(JSON.stringify({ messages: [{ messageId: 'm' + sent.length, status: { groupId: 1, name: 'PENDING_ACCEPTED' } }] }), { status: 200 });
  }
  throw new Error('appel réseau inattendu: ' + u);
};

const T = () => sim.tables;
function seed({ txOver = {}, metaOver = {}, senderCountry = 'OM', notice = {}, senderPhone = '96877986533', receiver = null, userLang = null } = {}) {
  T().transactions = [{
    id: UUID, status: 'CONFIRMED', amount: 30, asset: 'OMR', reference: 'YOR-TX-20261011-ABC123', created_at: '2026-10-11T11:22:27Z', sender_id: 's1',
    receiver_id: receiver ? 'r1' : null, kind: receiver ? 'FIAT_TRANSFER' : 'FIAT_EXTERNAL', total: 30,
    meta: { provider: 'Mobile', beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+96891234567' }, ...metaOver }, ...txOver,
  }];
  T().profiles = [{ id: 's1', first_name: 'Said', last_name: 'Ahmed', country: senderCountry }, ...(receiver ? [{ id: 'r1', first_name: 'Rami', last_name: 'K', country: receiver }] : [])];
  T().user_docs = userLang ? [{ user_id: 'u-rec', doc_name: 'preferences', data: { language: userLang } }] : [];
  T().recipient_notices = [
    { id: 'n-ext', transaction_id: UUID, audience: 'EXTERNAL', channel: 'SMS', to_phone: '96891234567', status: 'PENDING', attempts: 0, country: 'OM', user_id: null, next_attempt_at: null, ...notice },
    ...(senderPhone ? [{ id: 'n-snd', transaction_id: UUID, audience: 'SENDER', channel: 'SMS', to_phone: senderPhone, status: 'SENT', attempts: 1, country: 'OM', user_id: 's1' }] : []),
  ];
}
const run = async () => {
  const r = await handler(new Request('https://fn.test/send-notice', { method: 'POST', headers: { authorization: 'Bearer jwt-s1', 'content-type': 'application/json' }, body: JSON.stringify({ tx_id: UUID }) }));
  return { status: r.status, body: await r.json() };
};
const noteCount = (t) => (t.match(/حوالة دولية/g) || []).length;
const label = (t, l) => t.split('\n').find((x) => x.startsWith(l + ':'));

beforeEach(() => { sent.length = 0; for (const k of Object.keys(T())) delete T()[k]; });

test('transfert NATIONAL vers Oman : modèle arabe, champs remplis, SANS avertissement international', async () => {
  seed({});
  const r = await run();
  assert.equal(r.status, 200); assert.deepEqual(r.body, { processed: 1, results: [{ status: 'SENT' }] });
  assert.equal(sent.length, 1);
  const t = sent[0].text;
  assert.equal(sent[0].to, '96891234567');
  assert.ok(t.startsWith('عزيزي العميل،\nتم تأكيد تحويل مبلغ '), t);
  assert.match(t, /OMR 30\.000/);
  assert.match(label(t, 'رقم المرجع'), /TX-20261011-ABC123/);
  assert.match(label(t, 'التاريخ والوقت').replace(/[‪-‮]/g, ''), /11\/10\/2026 15:22$/, 'heure d\'Oman (UTC+4), sans secondes');
  assert.match(label(t, 'من الحساب'), /\+968 7798 6533/, 'le numéro de l\'expéditeur, comme décidé en 12.3.4');
  assert.match(label(t, 'إلى الحساب'), /\+968 9123 4567/, 'le compte du bénéficiaire, jamais vide');
  assert.equal(noteCount(t), 0, 'national : pas d\'avertissement');
  assert.doesNotMatch(t, /YOR|BMCT|bank/i);
  assert.equal(T().recipient_notices[0].language, 'ar');
});

test('transfert INTERNATIONAL (Oman → Émirats) : l\'avertissement « حوالة دولية » est ajouté UNE fois, avec le texte du modèle', async () => {
  seed({ notice: { country: 'AE', to_phone: '971501234567' }, metaOver: { beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+971501234567' } } });
  await run();
  const t = sent[0].text;
  assert.ok(t.startsWith('عزيزي العميل،'), t);
  assert.equal(noteCount(t), 1);
  assert.ok(t.endsWith('يرجى العلم بأنه نظرًا لأن هذه حوالة دولية، فقد يستغرق وصول المبلغ إلى حسابك بعض الوقت. شكرًا لتفهمكم.'));
  assert.match(label(t, 'إلى الحساب'), /\+971501234567/);
});

test('bénéficiaire hors pays arabophone (Côte d\'Ivoire, Orange Money) : le SMS reste en anglais, comme avant', async () => {
  seed({ notice: { country: 'CI', to_phone: '2250700000000' }, metaOver: { provider: 'Orange Money', destinationAmount: 4800, destinationCurrency: 'XOF', beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+2250700000000' } } });
  await run();
  const t = sent[0].text;
  assert.equal(t, 'Dear Customer,\n\nAn Orange Money transfer of approx. FCFA 4,800 (OMR 30.000) from +968 7798 6533 has been confirmed.\n\nTo: +2250700000000\nReference: TX-20261011-ABC123\nDate & Time: 11 Oct 2026, 11:22 UTC');
  assert.doesNotMatch(t, /[؀-ۿ]/);
  assert.equal(T().recipient_notices[0].language, 'en');
});

test('pays du bénéficiaire inconnu : pas de supposition (anglais, aucun avertissement international)', async () => {
  seed({ notice: { country: null } });
  await run();
  assert.doesNotMatch(sent[0].text, /[؀-ۿ]/);
});

test('compte du bénéficiaire inconnu : la ligne « إلى الحساب » est OMISE (jamais une ligne vide), le SMS part quand même', async () => {
  seed({ notice: { to_phone: '' }, metaOver: { beneficiary: { identifierType: 'MOBILE_MONEY', phone: '' } } });
  await run();
  /* to_phone vide : la file refuse l'envoi sans numéro (comportement existant « no_phone ») ; on vérifie alors qu'aucun SMS bancal n'est parti */
  assert.equal(sent.length, 0);
  assert.equal(T().recipient_notices[0].status, 'FAILED');
  /* numéro SMS présent mais compte illisible : ligne omise */
  seed({ metaOver: { beneficiary: { identifierType: 'IBAN', phone: '' } } });
  await run();
  assert.equal(sent.length, 1);
  const t = sent[0].text;
  assert.equal(label(t, 'إلى الحساب'), undefined);
  assert.ok(!/[:：]\s*$/m.test(t), 'aucune ligne ne se termine par un libellé vide : ' + JSON.stringify(t));
  assert.ok(!t.includes('undefined') && !t.includes('null') && !t.includes('NaN'));
});

test('sans numéro d\'expéditeur : « من الحساب » affiche son nom, jamais un numéro inventé', async () => {
  seed({ senderPhone: '' });
  await run();
  const t = sent[0].text;
  assert.match(label(t, 'من الحساب'), /^من الحساب: Said A\.$/);
  assert.ok(!/\+968\d/.test(label(t, 'من الحساب')));
});

test('transfert INTERNE : « تم استلام مبلغ … بنجاح » (l\'argent est réellement arrivé) si le compte du destinataire est réglé en arabe, sinon anglais', async () => {
  seed({ receiver: 'AE', notice: { id: 'n-int', audience: 'INTERNAL', country: null, user_id: 'u-rec', to_phone: '971501234567' }, userLang: 'ar' });
  T().recipient_notices = T().recipient_notices.filter((x) => x.id !== 'n-ext');
  await run();
  let t = sent[0].text;
  assert.ok(t.startsWith('عزيزي العميل،\nتم استلام مبلغ '), t);
  assert.match(t, / بنجاح\./);
  assert.equal(noteCount(t), 1, 'Oman → Émirats : international');
  assert.match(label(t, 'إلى الحساب'), /\+971501234567/);

  sent.length = 0;
  seed({ receiver: 'OM', notice: { id: 'n-int', audience: 'INTERNAL', country: null, user_id: 'u-rec', to_phone: '96891234567' }, userLang: 'en' });
  T().recipient_notices = T().recipient_notices.filter((x) => x.id !== 'n-ext');
  await run();
  t = sent[0].text;
  assert.match(t, /^Dear Customer,\n\nYou have received OMR 30\.000 from \+968 7798 6533\.\n\nReference: TX-20261011-ABC123/, t);
  assert.doesNotMatch(t, /Available Balance/, 'aucun solde si le registre n\'en fournit pas');
});

test('la confirmation à l\'EXPÉDITEUR (modèle 12.5.0) : « Your transfer of … was successful » + référence, date, bénéficiaire ; sans solde si le registre n\'en a pas', async () => {
  seed({});
  T().recipient_notices = T().recipient_notices.map((x) => (x.id === 'n-snd' ? { ...x, status: 'PENDING', attempts: 0 } : { ...x, status: 'SENT' }));
  await run();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, '96877986533');
  assert.equal(sent[0].text, 'Dear Customer,\n\nYour transfer of OMR 30.000 to +968 9123 4567 was successful.\n\nReference: FRD-TX-20261011-ABC123\nDate & Time: 11 Oct 2026, 15:22');
  assert.doesNotMatch(sent[0].text, /[؀-ۿ]/);
});

test('transaction non confirmée : aucun SMS (comportement existant conservé)', async () => {
  seed({ txOver: { status: 'FAILED' } });
  await run();
  assert.equal(sent.length, 0);
  assert.equal(T().recipient_notices[0].status, 'SKIPPED');
  assert.equal(T().recipient_notices[0].error_message, 'status_FAILED');
});

test('un second appel ne renvoie pas le même SMS (un seul envoi par message)', async () => {
  seed({});
  await run(); await run();
  assert.equal(sent.length, 1);
  assert.equal(T().recipient_notices[0].status, 'SENT');
});

/* ---------------------------------------------------------------------------------------------------------------
   12.5.0 : solde disponible (valeur du REGISTRE ledger_entries.balance_after, jamais calculée), langue de l'expéditeur, jamais de mélange de devises */
const plain = (t) => t.replace(/[‪-‮⁦-⁩]/g, '');
const senderOnly = () => { T().recipient_notices = T().recipient_notices.map((x) => (x.id === 'n-snd' ? { ...x, status: 'PENDING', attempts: 0 } : { ...x, status: 'SENT' })); };
const ledger = (rows) => { T().ledger_entries = rows; };
const LE = (o) => ({ transaction_id: UUID, asset: 'OMR', ...o });

test('SOLDE : l\'expéditeur voit « Available Balance » = dernier mouvement de SON registre pour cette transaction (jamais celui d\'un autre)', async () => {
  seed({}); senderOnly();
  ledger([LE({ id: 1, user_id: 's1', balance_after: 1229.6 }), LE({ id: 2, user_id: 's1', balance_after: 1229.5 }), LE({ id: 3, user_id: 'r1', balance_after: 80.25 }),
    { id: 4, transaction_id: 'autre-transaction', user_id: 's1', asset: 'OMR', balance_after: 5 }]);
  await run();
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /\nAvailable Balance: OMR 1,229\.500\nReference: FRD-TX-20261011-ABC123\nDate & Time: 11 Oct 2026, 15:22$/);
  assert.doesNotMatch(sent[0].text, /80\.250|5\.000/);
});

test('SOLDE en arabe : l\'expéditeur dont le compte est réglé en arabe reçoit le modèle « عزيزي العميل » avec « الرصيد المتاح »', async () => {
  seed({}); senderOnly();
  T().user_docs = [{ user_id: 's1', doc_name: 'preferences', data: { language: 'ar' } }];
  T().recipient_notices = T().recipient_notices.map((x) => (x.id === 'n-snd' ? { ...x, user_id: 's1' } : x));
  ledger([LE({ id: 1, user_id: 's1', balance_after: 1229.5 })]);
  await run();
  const t = plain(sent[0].text);
  assert.ok(t.startsWith('عزيزي العميل،\n\nتم تحويل مبلغ OMR 30.000 إلى +968 9123 4567 بنجاح.\n\n'), t);
  assert.ok(t.endsWith('\nالرصيد المتاح: OMR 1,229.500\nرقم المرجع: FRD-TX-20261011-ABC123\nالتاريخ والوقت: 11/10/2026 15:22'), t);
  assert.doesNotMatch(t, /المستفيد/, 'le bénéficiaire n\'est écrit qu\'une fois (dans la phrase d\'ouverture)');
  assert.equal(T().recipient_notices.find((x) => x.id === 'n-snd').language, 'ar');
});

test('SOLDE : le bénéficiaire EXTERNE n\'a pas de compte, donc aucun solde — même si l\'expéditeur en a un', async () => {
  seed({});
  ledger([LE({ id: 1, user_id: 's1', balance_after: 1229.5 })]);
  await run();
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /Available Balance|الرصيد المتاح|1,229/);
});

test('SOLDE : le bénéficiaire INTERNE voit SON solde (son crédit), jamais celui de l\'expéditeur', async () => {
  seed({ receiver: 'OM', notice: { id: 'n-int', audience: 'INTERNAL', country: null, user_id: 'u-rec', to_phone: '96891234567' }, userLang: 'en' });
  T().recipient_notices = T().recipient_notices.filter((x) => x.id !== 'n-ext');
  T().transactions[0].receiver_id = 'u-rec';
  ledger([LE({ id: 1, user_id: 's1', balance_after: 1229.5 }), LE({ id: 2, user_id: 'u-rec', balance_after: 80.25 })]);
  await run();
  const t = sent[0].text;
  assert.match(t, /^Dear Customer,\n\nYou have received OMR 30\.000 from \+968 7798 6533\./);
  assert.match(t, /\nAvailable Balance: OMR 80\.250\n/);
  assert.doesNotMatch(t, /1,229/);
});

test('DEVISES : Orange Money — débit et solde en OMR, montant à recevoir en FCFA (« approx. »), jamais mélangés', async () => {
  seed({ metaOver: { provider: 'Orange Money', destinationAmount: 4800, destinationCurrency: 'XOF', beneficiary: { identifierType: 'MOBILE_MONEY', phone: '+2250700000000', name: 'Aya Kone' } }, notice: { country: 'CI', to_phone: '2250700000000' } });
  senderOnly();
  ledger([LE({ id: 1, user_id: 's1', balance_after: 1229.5 })]);
  await run();
  const t = sent[0].text;
  assert.match(t, /^Dear Customer,\n\nYour transfer of OMR 30\.000 to Aya Kone \(\+2250700000000\) was successful\./, t);
  assert.match(t, /\nService: Orange Money\n/);
  assert.match(t, /\nAmount to receive: approx\. FCFA 4,800\n/);
  assert.match(t, /\nAvailable Balance: OMR 1,229\.500\n/);
  assert.doesNotMatch(t, /XOF|CFA(?!\b)|FCFA 1,229|OMR 4,800/);
});

test('SOLDE : une ligne de registre illisible (négative, absente) n\'affiche AUCUN solde plutôt qu\'un faux chiffre', async () => {
  for (const bad of [[], [LE({ id: 1, user_id: 's1', balance_after: -3 })], [LE({ id: 1, user_id: 's1', balance_after: 'abc' })]]) {
    sent.length = 0; seed({}); senderOnly(); ledger(bad);
    await run();
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].text, /Available Balance/, JSON.stringify(bad));
  }
});
