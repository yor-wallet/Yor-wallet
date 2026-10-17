import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationSms, smsSegments, outcomeOfStatus, statusMatchesOutcome, validBalance, noticeSmsLang,
  buildDeliveryRequest, classifyDelivery, localStamp, tzMinutes, fmtPhoneSms,
} from '../../supabase/functions/send-notice/lib.ts';

/* 12.5.0 — modèles « Dear Customer » / « عزيزي العميل » : logique PURE (aucun réseau, aucune base).
   Ce que ces tests ne prouvent pas : la remise d'un SMS par un opérateur, ni le format réel des rapports Infobip (voir tests/edge-sim/sms-delivery). */

const strip = (t) => t.replace(/[‪-‮⁦-⁩]/g, '');                     // marques de sens d'écriture (invisibles)
const BASE = { audience: 'SENDER', amount: 20, currency: 'OMR', dest: null, from: 'Said A.', ref: 'YOR-TX-20261012-69AAAA', createdAt: '2026-10-12T07:08:00Z', tzCountry: 'OM', service: '', total: 20, to: '+96891234567', toName: 'Aisha Said', rate: null, balance: { amount: 1229.5, currency: 'OMR' } };
const INT = { ...BASE, audience: 'INTERNAL', fromPhone: '+96877986533', account: '+96891234567', international: false, balance: { amount: 80.25, currency: 'OMR' } };
const EXT = { ...INT, audience: 'EXTERNAL', balance: undefined };
const OM = { ...BASE, service: 'Orange Money', dest: { amount: 22450.5, currency: 'XOF' }, to: '+2250700000000', toName: '' };

test('EXPÉDITEUR, anglais : modèle du propriétaire (« Dear Customer » … « was successful » … Reference / Date & Time / Recipient / Available Balance)', () => {
  assert.equal(buildNotificationSms('en', BASE),
    'Dear Customer,\n\nYour transfer of OMR 20.000 to Aisha Said (+968 9123 4567) was successful.\n\nAvailable Balance: OMR 1,229.500\nReference: FRD-TX-20261012-69AAAA\nDate & Time: 12 Oct 2026, 11:08');
});

test('EXPÉDITEUR, arabe : modèle du propriétaire (« عزيزي العميل،» … « بنجاح » … رقم المرجع / التاريخ والوقت / المستفيد / الرصيد المتاح)', () => {
  assert.equal(strip(buildNotificationSms('ar', BASE)),
    'عزيزي العميل،\n\nتم تحويل مبلغ OMR 20.000 إلى Aisha Said (+968 9123 4567) بنجاح.\n\nالرصيد المتاح: OMR 1,229.500\nرقم المرجع: FRD-TX-20261012-69AAAA\nالتاريخ والوقت: 12/10/2026 11:08');
});

test('chiffres, références et numéros restent lisibles de gauche à droite dans le SMS arabe (isolés)', () => {
  const t = buildNotificationSms('ar', BASE);
  assert.match(t, /‪OMR 20\.000‬/);
  assert.match(t, /رقم المرجع: ‪FRD-TX-20261012-69AAAA‬/);
  assert.match(t, /الرصيد المتاح: ‪OMR 1,229\.500‬/);
  assert.match(t, /التاريخ والوقت: ‪12\/10\/2026 11:08‬$/);
});

test('ÉCHEC : « was unsuccessful » / « لم يتم تحويل », jamais « successful » ni solde ; EN PROCESSUS : « is being processed » / « قيد المعالجة »', () => {
  const f = { ...BASE, outcome: 'FAILED', balance: undefined }, p = { ...BASE, outcome: 'PENDING', balance: undefined };
  assert.match(buildNotificationSms('en', f), /^Dear Customer,\n\nYour transfer of OMR 20\.000 to Aisha Said \(\+968 9123 4567\) was unsuccessful\.\n\nReference:/);
  assert.match(strip(buildNotificationSms('ar', f)), /^عزيزي العميل،\n\nلم يتم تحويل مبلغ OMR 20\.000 إلى Aisha Said \(\+968 9123 4567\)\.\n\nرقم المرجع:/);
  assert.match(buildNotificationSms('en', p), /is being processed\./);
  assert.match(strip(buildNotificationSms('ar', p)), /قيد المعالجة\./);
  for (const t of [f, p].flatMap((d) => [buildNotificationSms('en', d), buildNotificationSms('ar', d)])) {
    assert.doesNotMatch(t, /\bsuccessful\b|بنجاح|Available Balance|الرصيد المتاح/, t);
  }
  /* même si un solde est fourni, un échec ou une opération en cours n'affiche pas de solde « après » un transfert qui n'a pas abouti */
  for (const d of [f, p]) for (const lang of ['en', 'ar']) assert.doesNotMatch(buildNotificationSms(lang, { ...d, balance: { amount: 10, currency: 'OMR' } }), /Available Balance|الرصيد المتاح/);
});

test('SERVICE FCFA (Orange Money) : débit en OMR, montant à recevoir en FCFA sur sa propre ligne, solde en OMR — jamais mélangés', () => {
  assert.equal(buildNotificationSms('en', OM),
    'Dear Customer,\n\nYour transfer of OMR 20.000 to +2250700000000 was successful.\n\nService: Orange Money\nAmount to receive: approx. FCFA 22,451\nAvailable Balance: OMR 1,229.500\nReference: FRD-TX-20261012-69AAAA\nDate & Time: 12 Oct 2026, 11:08');
  const ar = strip(buildNotificationSms('ar', OM));
  assert.match(ar, /\nالخدمة: Orange Money\nالمبلغ التقديري للاستلام: حوالي FCFA 22,451\nالرصيد المتاح: OMR 1,229\.500\nرقم المرجع: FRD-TX/);
  for (const t of [buildNotificationSms('en', OM), ar]) assert.doesNotMatch(t, /XOF|FCFA 1,229|OMR 22,451/);
});

test('ENTRANT (compte de l\'application) : « You have received » + solde du destinataire ; arabe « تم استلام … بنجاح » + الرصيد المتاح', () => {
  assert.equal(buildNotificationSms('en', INT),
    'Dear Customer,\n\nYou have received OMR 20.000 from +968 7798 6533.\n\nAvailable Balance: OMR 80.250\nReference: TX-20261012-69AAAA\nDate & Time: 12 Oct 2026, 11:08');
  const ar = strip(buildNotificationSms('ar', INT));
  assert.ok(ar.startsWith('عزيزي العميل،\nتم استلام مبلغ OMR 20.000 بنجاح.\n'), ar);
  assert.ok(ar.endsWith('\nالرصيد المتاح: OMR 80.250'), ar);
});

test('ENTRANT (bénéficiaire EXTERNE, sans compte) : « confirmed », jamais « received », jamais de solde ; référence sans « YOR »', () => {
  const en = buildNotificationSms('en', EXT), ar = strip(buildNotificationSms('ar', EXT));
  assert.match(en, /^Dear Customer,\n\nA transfer of OMR 20\.000 from \+968 7798 6533 has been confirmed\./);
  assert.doesNotMatch(en, /received|Available Balance/i);
  assert.ok(ar.includes('تم تأكيد تحويل مبلغ OMR 20.000.'));
  assert.doesNotMatch(ar, /استلام|الرصيد/);
  assert.doesNotMatch(en + ar, /YOR/);
});

test('un solde fourni pour un bénéficiaire EXTERNE est ignoré (il n\'a pas de compte)', () => {
  const t = buildNotificationSms('en', { ...EXT, balance: { amount: 99, currency: 'OMR' } });
  assert.doesNotMatch(t, /Available Balance|99/);
});

test('SOLDE : ligne omise si le registre ne fournit rien de valable (absent, négatif, NaN, devise invalide) — jamais « undefined », « null » ni « NaN »', () => {
  for (const balance of [undefined, null, { amount: -1, currency: 'OMR' }, { amount: NaN, currency: 'OMR' }, { amount: 5, currency: '' }, { amount: 5, currency: 'omr' }, { amount: true, currency: 'OMR' }]) {
    assert.equal(validBalance({ ...BASE, balance }), false, JSON.stringify(balance));
    for (const lang of ['en', 'ar']) {
      const t = buildNotificationSms(lang, { ...BASE, balance });
      assert.doesNotMatch(t, /Available Balance|الرصيد المتاح|undefined|null|NaN/, JSON.stringify(balance));
    }
  }
  assert.equal(validBalance({ ...BASE, balance: { amount: 0, currency: 'OMR' } }), true, 'un solde de zéro est un vrai solde');
  assert.match(buildNotificationSms('en', { ...BASE, balance: { amount: 0, currency: 'OMR' } }), /Available Balance: OMR 0\.000\n/);
});

test('aucune valeur vide ne produit une ligne « libellé: » sans valeur, quelle que soit l\'audience, la langue et l\'issue', () => {
  const sparse = { ...BASE, to: '', toName: '', service: '', balance: undefined, ref: '' };
  for (const d of [BASE, OM, INT, EXT, sparse, { ...sparse, audience: 'INTERNAL' }, { ...sparse, audience: 'EXTERNAL' }]) {
    for (const outcome of ['SUCCESS', 'FAILED', 'PENDING']) for (const lang of ['en', 'ar']) {
      const t = strip(buildNotificationSms(lang, { ...d, outcome }));
      assert.ok(!/[:：]\s*$/m.test(t), JSON.stringify(t));
      assert.doesNotMatch(t, /undefined|null|NaN|\[object/);
      assert.ok(t.startsWith(lang === 'ar' ? 'عزيزي العميل،' : 'Dear Customer,'));
    }
  }
});

test('IDENTITÉ : aucun SMS ne se présente comme une banque tierce ; seul le texte « Dear Customer » est neutre, sans marque', () => {
  for (const d of [BASE, OM, INT, EXT]) for (const lang of ['en', 'ar']) {
    const t = buildNotificationSms(lang, d);
    assert.doesNotMatch(t, /muscat|bmct|bank/i);
  }
});

test('ALPHABET ET COÛT : l\'anglais reste en alphabet GSM (2 SMS au plus) ; l\'arabe est en Unicode (≤ 5 SMS) ; jamais de lien', () => {
  for (const d of [BASE, OM, INT, EXT]) {
    const en = smsSegments(buildNotificationSms('en', d)), ar = smsSegments(buildNotificationSms('ar', d));
    assert.equal(en.unicode, false); assert.ok(en.segments <= 2, JSON.stringify(en));
    assert.equal(ar.unicode, true); assert.ok(ar.segments <= 5, JSON.stringify(ar));
    assert.doesNotMatch(buildNotificationSms('en', d) + buildNotificationSms('ar', d), /https?:|www\./i);
  }
});

test('ISSUE : la transaction décide (REFUNDED / REVERSED / REJECTED ⇒ non abouti ; CONFIRMED ⇒ réussi ; PENDING ⇒ en cours ; inconnu ⇒ aucun SMS)', () => {
  for (const s of ['CONFIRMED', 'SUCCESS', 'COMPLETED', 'confirmed']) assert.equal(outcomeOfStatus(s), 'SUCCESS', s);
  for (const s of ['REJECTED', 'REFUNDED', 'FAILED', 'CANCELLED', 'CANCELED', 'DECLINED', 'EXPIRED', 'ERROR']) assert.equal(outcomeOfStatus(s), 'FAILED', s);
  for (const s of ['PENDING', 'PROCESSING', 'UNDER_REVIEW']) assert.equal(outcomeOfStatus(s), 'PENDING', s);
  for (const s of ['', null, undefined, 'WHATEVER', 'SENT']) assert.equal(outcomeOfStatus(s), null, String(s));
  assert.equal(statusMatchesOutcome('CONFIRMED', 'SUCCESS'), true);
  assert.equal(statusMatchesOutcome('CONFIRMED', 'PENDING'), false, 'un SMS « en cours » n\'est pas envoyé pour une transaction déjà confirmée');
  assert.equal(statusMatchesOutcome('REFUNDED', 'SUCCESS'), false, 'jamais « réussi » pour une transaction remboursée');
});

test('LANGUE : expéditeur = arabe seulement si son application est en arabe, sinon anglais (le français retombe sur l\'anglais) ; bénéficiaire inchangé', () => {
  assert.equal(noticeSmsLang('SENDER', 'OM', 'ar'), 'ar');
  assert.equal(noticeSmsLang('SENDER', 'OM', 'en'), 'en');
  assert.equal(noticeSmsLang('SENDER', 'CI', 'fr'), 'en');
  assert.equal(noticeSmsLang('SENDER', 'OM', null), 'en');
  assert.equal(noticeSmsLang('EXTERNAL', 'OM', null), 'ar', 'bénéficiaire d\'un pays arabophone : modèle arabe (règle du 12 octobre)');
  assert.equal(noticeSmsLang('EXTERNAL', 'CI', null), 'en');
});

/* ---------- suivi de livraison ---------- */
const INFOBIP = { infobipKey: 'AbCdEf0123456789AbCdEf0123456789' };
const TWILIO = { twilioSid: 'AC' + 'a'.repeat(32), twilioToken: 'tok' };

test('Infobip : requête de rapport = GET /sms/1/logs?messageId=…&limit=1 sur *.infobip.com uniquement, identifiant encodé', () => {
  const r = buildDeliveryRequest('infobip', INFOBIP, 'MSG-12345.abc');
  assert.equal(r.url, 'https://api.infobip.com/sms/1/logs?messageId=MSG-12345.abc&limit=1');
  assert.match(r.headers.Authorization, /^App AbCdEf/);
  assert.match(buildDeliveryRequest('infobip', { ...INFOBIP, infobipBase: 'https://evil.example.com' }, 'MSG-12345').error, /INFOBIP_BASE_URL/);
  assert.equal(buildDeliveryRequest('infobip', { ...INFOBIP, infobipBase: 'https://xyz12.api.infobip.com/' }, 'MSG-12345').url, 'https://xyz12.api.infobip.com/sms/1/logs?messageId=MSG-12345&limit=1');
  assert.equal(buildDeliveryRequest('infobip', INFOBIP, 'a b&c=d').error, 'invalid_message_id');
  assert.equal(buildDeliveryRequest('infobip', INFOBIP, '../x').error, 'invalid_message_id');
  assert.match(buildDeliveryRequest('infobip', {}, 'MSG-12345').error, /INFOBIP_API_KEY/);
});

test('Twilio : GET …/Messages/SM….json en Basic ; identifiant invalide refusé ; Brevo : rapport non pris en charge (UNSUPPORTED, aucun appel)', () => {
  const sid = 'SM' + 'b'.repeat(32);
  const r = buildDeliveryRequest('twilio', TWILIO, sid);
  assert.equal(r.url, `https://api.twilio.com/2010-04-01/Accounts/${TWILIO.twilioSid}/Messages/${sid}.json`);
  assert.match(r.headers.Authorization, /^Basic /);
  assert.equal(buildDeliveryRequest('twilio', TWILIO, 'SM123').error, 'invalid_message_id');
  const b = buildDeliveryRequest('brevo', {}, '12345');
  assert.equal(b.unsupported, true);
});

test('Infobip : classement des rapports (3 ⇒ remis ; 2/4/5 ⇒ non remis ; 0/1 ⇒ en attente ; autre ⇒ inconnu ; erreur HTTP ⇒ jamais remis)', () => {
  const rep = (groupId, name) => JSON.stringify({ results: [{ status: { groupId, name } }] });
  assert.deepEqual(classifyDelivery('infobip', 200, rep(3, 'DELIVERED_TO_HANDSET')), { state: 'DELIVERED', detail: 'DELIVERED_TO_HANDSET' });
  for (const g of [2, 4, 5]) assert.equal(classifyDelivery('infobip', 200, rep(g, 'X')).state, 'UNDELIVERABLE', 'groupe ' + g);
  for (const g of [0, 1]) assert.equal(classifyDelivery('infobip', 200, rep(g, 'X')).state, 'PENDING', 'groupe ' + g);
  assert.equal(classifyDelivery('infobip', 200, rep(9, 'X')).state, 'UNKNOWN');
  assert.deepEqual(classifyDelivery('infobip', 200, '{"results":[]}'), { state: 'PENDING', detail: 'no_report_yet' });
  assert.equal(classifyDelivery('infobip', 200, 'pas du json').state, 'PENDING');
  for (const st of [400, 404, 429, 500, 503]) assert.equal(classifyDelivery('infobip', st, rep(3, 'DELIVERED')).state, 'UNKNOWN', 'HTTP ' + st + ' : un corps « remis » ne compte pas');
  assert.equal(classifyDelivery('infobip', 401, '{}').detail, 'provider_auth');
});

test('Twilio : classement (delivered ⇒ remis ; undelivered/failed/canceled ⇒ non remis ; queued/sent ⇒ en attente ; autre ⇒ inconnu)', () => {
  const rep = (status, code) => JSON.stringify({ status, ...(code ? { error_code: code } : {}) });
  assert.equal(classifyDelivery('twilio', 200, rep('delivered')).state, 'DELIVERED');
  assert.deepEqual(classifyDelivery('twilio', 200, rep('undelivered', 30003)), { state: 'UNDELIVERABLE', detail: 'undelivered 30003' });
  assert.equal(classifyDelivery('twilio', 200, rep('failed')).state, 'UNDELIVERABLE');
  for (const s of ['queued', 'accepted', 'sending', 'sent']) assert.equal(classifyDelivery('twilio', 200, rep(s)).state, 'PENDING', s);
  assert.equal(classifyDelivery('twilio', 200, rep('mystery')).state, 'UNKNOWN');
  assert.equal(classifyDelivery('twilio', 500, rep('delivered')).state, 'UNKNOWN');
  assert.equal(classifyDelivery('brevo', 200, '{}').state, 'UNSUPPORTED');
});

/* ---------- 12.12.0 : messages corrigés (17 octobre 2026) ---------- */
test('12.12.0 · AUCUN FRAIS : un transfert sans frais n\'écrit ni « Fees » ni « Total debited » ni le mot TVA (EN et AR)', () => {
  for (const lang of ['en', 'ar']) {
    const t = strip(buildNotificationSms(lang, BASE));
    assert.doesNotMatch(t, /Fees|Total debited|VAT|الرسوم|إجمالي|الضريبة/, t);
  }
});

test('12.12.0 · une ancienne transaction AVEC frais (total > montant) les affiche telle qu\'elle les contient — jamais inventés', () => {
  const en = buildNotificationSms('en', { ...BASE, total: 21.05 });
  assert.match(en, /\nFees \(incl\. VAT\): OMR 1\.050\nTotal debited: OMR 21\.050\n/);
  const ar = strip(buildNotificationSms('ar', { ...BASE, total: 21.05 }));
  assert.match(ar, /\nالرسوم \(شاملة الضريبة\): OMR 1\.050\nإجمالي المبلغ المخصوم: OMR 21\.050\n/);
  /* total absent, égal au montant ou plus petit : rien */
  for (const total of [undefined, null, 20, 19, NaN]) assert.doesNotMatch(buildNotificationSms('en', { ...BASE, total }), /Fees|Total debited/, String(total));
  /* un échec ne parle pas de frais */
  assert.doesNotMatch(buildNotificationSms('en', { ...BASE, total: 21.05, outcome: 'FAILED' }), /Fees|Total debited/);
});

test('12.12.0 · le bénéficiaire n\'apparaît qu\'UNE fois dans la confirmation de l\'expéditeur, l\'expéditeur qu\'UNE fois dans le message du bénéficiaire', () => {
  const s = buildNotificationSms('en', BASE);
  assert.equal(s.split('9123 4567').length - 1, 1, s);
  assert.doesNotMatch(s, /Recipient:/);
  const e = buildNotificationSms('en', EXT);
  assert.equal(e.split('7798 6533').length - 1, 1, e);
  assert.doesNotMatch(e, /Sender:|From:/);
  const i = buildNotificationSms('en', INT);
  assert.equal(i.split('7798 6533').length - 1, 1, i);
});

test('12.12.0 · HEURE LOCALE : Oman = UTC+4 (sans « UTC », sans secondes) ; pays inconnu ou absent = UTC écrit « UTC »', () => {
  assert.equal(tzMinutes('OM'), 240); assert.equal(tzMinutes('om'), 240); assert.equal(tzMinutes('SA'), 180); assert.equal(tzMinutes('CI'), null); assert.equal(tzMinutes(undefined), null);
  assert.equal(localStamp('2026-10-12T07:08:59Z', 'OM', 'en'), '12 Oct 2026, 11:08');
  assert.equal(localStamp('2026-10-12T07:08:59Z', 'OM', 'ar'), '12/10/2026 11:08');
  assert.equal(localStamp('2026-10-12T07:08:00Z', '', 'en'), '12 Oct 2026, 07:08 UTC');
  assert.equal(localStamp('2026-10-12T07:08:00Z', 'CI', 'ar'), '12/10/2026 07:08 UTC');
  /* passage de minuit : 21 h 30 UTC → 01 h 30 le lendemain à Oman, y compris changement de mois et d'année */
  assert.equal(localStamp('2026-12-31T21:30:00Z', 'OM', 'en'), '1 Jan 2027, 01:30');
  assert.equal(localStamp('not a date', 'OM', 'en'), '');
  const noCountry = buildNotificationSms('en', { ...BASE, tzCountry: undefined });
  assert.match(noCountry, /Date & Time: 12 Oct 2026, 07:08 UTC$/);
});

test('12.12.0 · NUMÉROS : « +968 9123 4567 » pour Oman ; autres pays et numéros masqués inchangés ; jamais de lien', () => {
  assert.equal(fmtPhoneSms('+96891234567'), '+968 9123 4567');
  assert.equal(fmtPhoneSms('+2250700000000'), '+2250700000000');
  assert.equal(fmtPhoneSms('***1234'), '***1234');
  assert.equal(fmtPhoneSms('http://evil.example/x?a=+96891234567'), '+968 9123 4567', 'seuls chiffres, « + » et « * » survivent : aucun lien');
  assert.doesNotMatch(fmtPhoneSms('http://evil.example/x'), /[a-z]/i);
  assert.equal(fmtPhoneSms(''), '');
});

test('12.12.0 · MESSAGE DU BÉNÉFICIAIRE : aucune marque, aucun « YOR », aucun « FRD », référence « TX-… » ; confirmation de l\'expéditeur : référence « FRD-TX-… »', () => {
  for (const d of [EXT, INT]) for (const lang of ['en', 'ar']) {
    const t = strip(buildNotificationSms(lang, { ...d, ref: 'YOR-TX-20261017-ABCDEF' }));
    assert.doesNotMatch(t, /YOR|FRD|Friendly|Pay\b|NEX/i, t);
    assert.match(t, /TX-20261017-ABCDEF/);
  }
  for (const lang of ['en', 'ar']) {
    const t = strip(buildNotificationSms(lang, { ...BASE, ref: 'YOR-TX-20261017-ABCDEF' }));
    assert.match(t, /FRD-TX-20261017-ABCDEF/); assert.doesNotMatch(t, /YOR/);
  }
});
