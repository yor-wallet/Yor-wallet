import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  langForCountry, fmtNumber, fmtMoney, fmtDateUtc, senderLabel, buildSms, buildEmail, smsSegments,
  classifySmsResponse, smsSenderName, brevoRecipient, retryDelayMin,
  smsProviderName, buildSmsRequest, classifySms, cleanService, cleanTo, feesOf, knownLangForCountry, recipientNumber, recipientRef, senderNoticeLang,
  fmtDateEn, smsCurrency, serviceLabelEn, safeEqual, SMS_LANG, fromLabel,
  buildRecipientSmsAr, buildNoticeSms, isInternational, recipientSmsLang, fmtDateTimeUtc, AR_INTERNATIONAL_NOTE
} from '../../supabase/functions/send-notice/lib.ts';

/* Logique PURE du message au destinataire. Le réseau (Brevo) et la base ne sont pas ici :
   ils sont NON EXÉCUTÉS en test automatique et vérifiés séparément (voir docs/NOTICES.md). */

const EXT = {
  audience: 'EXTERNAL', amount: 20, currency: 'OMR', dest: { amount: 22450.5, currency: 'XOF' },
  from: 'Adam K.', ref: 'TXN-ABC123', createdAt: '2026-10-09T11:03:37.817Z'
};
const INT = { ...EXT, audience: 'INTERNAL', dest: null };

test('langue choisie selon le pays du destinataire : arabe pour Oman et le monde arabe, français pour l\'Afrique francophone', () => {
  for (const c of ['OM', 'om', 'AE', 'SA', 'KW', 'QA', 'BH', 'EG', 'SD', 'YE', 'IQ', 'JO', 'LB', 'LY']) assert.equal(langForCountry(c), 'ar', c);
  for (const c of ['ML', 'ci', 'BF', 'GN', 'SN', 'NE', 'TG', 'BJ', 'CM']) assert.equal(langForCountry(c), 'fr', c);
  assert.equal(langForCountry('US'), 'en');
  assert.equal(langForCountry(''), 'en');
  assert.equal(langForCountry(undefined), 'en');
});

test('formats de montants : OMR à 3 décimales, XOF sans décimale, séparateurs par langue', () => {
  assert.equal(fmtMoney(20, 'OMR', 'en'), '20.000 OMR');
  assert.equal(fmtMoney(20, 'OMR', 'fr'), '20,000 OMR');
  assert.equal(fmtMoney(22450.5, 'XOF', 'fr'), '22 451 XOF');
  assert.equal(fmtMoney(1234567.891, 'USD', 'en'), '1,234,567.89 USD');
  assert.equal(fmtNumber(Number.NaN, 2, 'en'), '');
});

test('date en UTC, jamais en heure locale', () => {
  assert.deepEqual(fmtDateUtc('2026-10-09T11:03:37.817Z'), { date: '09/10/2026', time: '11:03 UTC', both: '09/10/2026 11:03 UTC' });
  assert.equal(fmtDateUtc('pas une date').both, '');
});

test('libellé expéditeur : lettres seulement, pas de lien, pas de chiffre, court', () => {
  assert.equal(senderLabel('Adam', 'Khalil'), 'Adam K.');
  assert.equal(senderLabel('Élodie', 'dupont'), 'Élodie D.');
  assert.equal(senderLabel('Click http://evil.example now 123', 'x'), 'Click X.');
  assert.equal(senderLabel('http://evil.example/win', ''), 'httpevilexamplewin');       // « : » et « / » supprimés : plus un lien
  assert.ok(!/[0-9:/@]/.test(senderLabel('A1:B2/C@D3', 'Z9')));
  assert.equal(senderLabel('', ''), '');
  assert.equal(senderLabel(null, undefined), '');
  assert.ok(senderLabel('a'.repeat(100), 'b').length <= 24);
});

for (const lang of ['fr', 'en', 'ar']) {
  test(`SMS externe (${lang}) : détails présents, « confirmé », jamais « reçu », aucun YOR`, () => {
    const s = buildSms(lang, EXT);
    const date = { fr: '09/10/2026 11:03 UTC', en: '9 Oct 2026 11:03 UTC', ar: '09/10/2026 11:03 UTC' }[lang];
    assert.ok(s.includes('TXN-ABC123'), 'référence');
    assert.ok(s.includes(date), 'date ET heure');
    assert.ok(s.includes('Adam K.'), 'expéditeur');
    assert.ok({ fr: /20,000 OMR/, en: /OMR 20\.000/, ar: /20\.000 OMR/ }[lang].test(s), 'montant envoyé et devise');
    assert.ok(lang === 'en' ? /FCFA 22,451/.test(s) : /XOF/.test(s), 'montant estimé');
    assert.ok(!/yor/i.test(s), 'ni nom ni YOR ID');
    assert.ok(!/re[cç]u|received|استلمت/i.test(s), 'ne dit jamais que l\'argent est reçu');
    const status = { fr: /Transfert confirme :/, en: /Transfer Confirmed:/, ar: /تم تأكيد تحويل/ }[lang];
    assert.ok(status.test(s), 'transfert confirmé (argent sorti du compte de l\'expéditeur)');
    assert.ok(!/en cours|processing|pending|in progress|test|قيد المعالجة/i.test(s), 'jamais « en cours », jamais « test »');
  });
  test(`SMS interne (${lang}) : l'argent est réellement arrivé, donc « reçu » est vrai`, () => {
    const s = buildSms(lang, INT);
    assert.ok({ fr: /Vous avez recu/, en: /Transfer Confirmed: You received/, ar: /لقد استلمت/ }[lang].test(s));
    assert.ok(s.includes('TXN-ABC123'));
    assert.ok(!/yor/i.test(s));
  });
}

test('SMS français et anglais : alphabet GSM (1 SMS), SMS arabe : unicode', () => {
  const fr = buildSms('fr', EXT), en = buildSms('en', EXT), ar = buildSms('ar', EXT);
  assert.equal(smsSegments(fr).unicode, false);
  assert.equal(smsSegments(fr).segments, 1);
  assert.equal(smsSegments(en).unicode, false);
  assert.equal(smsSegments(en).segments, 1);
  assert.equal(smsSegments(ar).unicode, true);
  assert.ok(!/[^\x20-\x7E]/.test(fr), 'aucun accent restant');
});

test('SMS sans expéditeur ni montant estimé : phrase propre', () => {
  const s = buildSms('en', { ...EXT, from: '', dest: null });
  assert.ok(!/from|approx|\(\s*\)/.test(s));
  assert.ok(s.startsWith('Transfer Confirmed: OMR 20.000.'), s);
});

/* ---------- confirmation du débit pour l'EXPÉDITEUR (audience SENDER) ----------
   Valeurs réelles d'une transaction : 1 OMR + frais 0.100 + TVA 0.005 = 1.105 OMR débités. */
const ORANGE = { audience: 'SENDER', amount: 1, currency: 'OMR', dest: { amount: 1980, currency: 'XOF' }, from: 'Sajad A.',
  ref: 'TXN-REAL01', createdAt: '2026-10-09T13:50:00Z', total: 1.105, service: 'Orange Money', to: '+22370123456', rate: 1980 };
const OMAN = { ...ORANGE, dest: { amount: 1, currency: 'OMR' }, service: 'Bank Muscat', to: '***9988', rate: 1 };

test('frais = total débité − montant envoyé (jamais inventés), 0 si l\'information manque', () => {
  assert.equal(feesOf(ORANGE), 0.105);
  for (const total of [null, undefined, 1, 0.5, Number.NaN]) assert.equal(feesOf({ ...ORANGE, total }), 0);
});

test('Orange Money (français) : montant débité en OMR et montant en FCFA (XOF), frais, service, numéro complet du bénéficiaire, statut honnête', () => {
  const s = buildSms('fr', ORANGE);
  assert.equal(s, 'Confirmation de transfert : 1,105 OMR debites de votre compte (envoi 1,000 OMR + frais 0,105 OMR). Montant estime a verser : 1 980 XOF via Orange Money (+22370123456). Ref. TXN-REAL01. 09/10/2026 13:50 UTC. Statut : Confirme.');
  assert.ok(!/[^\x20-\x7E]/.test(s), 'alphabet GSM');
  assert.ok(!/yor/i.test(s) && !/\brecu\b/i.test(s));
  assert.equal(smsSegments(s).segments, 2);
});

test('Oman (arabe) : tout en OMR, aucune conversion affichée, service et compte bancaire masqué', () => {
  const s = buildSms('ar', OMAN);
  assert.equal(s, 'تأكيد التحويل: تم خصم 1.105 OMR من حسابك (المبلغ 1.000 OMR + الرسوم 0.105 OMR). الخدمة: Bank Muscat \u202A(***9988)\u202C. المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: مؤكد.');
  assert.ok(!/XOF|AED|عبر/.test(s));
  assert.ok(!/استلمت/.test(s));
});

test('Orange Money en arabe et en anglais : même détail', () => {
  assert.equal(buildSms('ar', ORANGE), 'تأكيد التحويل: تم خصم 1.105 OMR من حسابك (المبلغ 1.000 OMR + الرسوم 0.105 OMR). المبلغ التقديري للصرف: 1,980 XOF عبر Orange Money \u202A(+22370123456)\u202C. المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: مؤكد.');
  assert.equal(buildSms('en', ORANGE), 'Debit Alert: OMR 1.105 debited from your account (transfer OMR 1.000 + fees OMR 0.105) for a transfer of approx. FCFA 1,980 via Orange Money to +22370123456. Ref TXN-REAL01. 9 Oct 2026 13:50 UTC. Status: Confirmed.');
});

test('confirmation sans total connu : aucun frais, aucun montant deviné', () => {
  for (const lang of ['fr', 'en', 'ar']) {
    const s = buildSms(lang, { ...ORANGE, total: null });
    assert.ok(!/frais|fees|الرسوم|\+ /.test(s), `${lang}: ${s}`);
    assert.ok(/1[.,]000 OMR|OMR 1\.000/.test(s));
  }
});

test('confirmation sans service ni bénéficiaire : phrase propre', () => {
  const s = buildSms('en', { ...OMAN, service: '', to: '' });
  assert.equal(s, 'Debit Alert: OMR 1.105 debited from your account (transfer OMR 1.000 + fees OMR 0.105) for a transfer. Ref TXN-REAL01. 9 Oct 2026 13:50 UTC. Status: Confirmed.');
});

test('le message du bénéficiaire reste neutre : ni frais, ni total débité, ni service', () => {
  for (const lang of ['fr', 'en', 'ar']) {
    const s = buildSms(lang, { ...ORANGE, audience: 'EXTERNAL' });
    assert.ok(!/frais|fees|الرسوم|debite|debited|خصم|\*\*\*|22370123456/.test(s), `${lang}: ${s}`);
    assert.ok(s.includes('TXN-REAL01'));
  }
});

test('langue de la confirmation = langue du service ; pays inconnu → null (la langue de la personne s\'applique)', () => {
  assert.equal(knownLangForCountry('OM'), 'ar');
  assert.equal(knownLangForCountry('ML'), 'fr');
  assert.equal(knownLangForCountry('CI'), 'fr');
  assert.equal(knownLangForCountry('BF'), 'fr');
  assert.equal(knownLangForCountry('US'), null);
  assert.equal(knownLangForCountry(''), null);
  assert.equal(knownLangForCountry(undefined), null);
});

test('nom du service et bénéficiaire masqué : jamais de lien ni de symbole', () => {
  assert.equal(cleanService('Orange Money'), 'Orange Money');
  assert.ok(!/[:/.@]/.test(cleanService('Orange http://evil.example/win?x=1')));
  assert.ok(cleanService('x'.repeat(100)).length <= 24);
  assert.equal(cleanService(null), '');
  assert.equal(cleanService('<script>'), 'script');
  assert.equal(cleanTo('***6533'), '***6533');
  assert.equal(cleanTo('http://x.y/1'), '1');
  const s = buildSms('en', { ...ORANGE, service: 'Pay now http://evil.example/x', to: 'http://evil' });
  assert.ok(!/:\/\//.test(s), s);
});

test('numéro du bénéficiaire : complet pour un service par téléphone, masqué pour un compte bancaire, jamais inventé', () => {
  // numéro normalisé par la base (chiffres seuls) → « + » + chiffres
  assert.equal(recipientNumber('MOBILE_MONEY', '22370123456', '+223 70123456'), '+22370123456');
  assert.equal(recipientNumber('PHONE', '96891234567', '+968 91234567'), '+96891234567');
  // base indisponible : on garde la saisie seulement si elle porte déjà l'indicatif (« + »)
  assert.equal(recipientNumber('MOBILE_MONEY', null, '+223 70123456'), '+22370123456');
  assert.equal(recipientNumber('PHONE', undefined, '91234567'), '***4567');
  // IBAN, compte, identifiant de service : jamais en clair
  assert.equal(recipientNumber('IBAN', null, 'OM81 0180 0000 1299 1234'), '***1234');
  assert.equal(recipientNumber('ROUTING_ACCOUNT', null, '123456789 / 000123456789'), '***6789');
  assert.equal(recipientNumber('SERVICE_ID', '97150123456', '0501234567'), '***4567');
  // une valeur trop courte ou absente : rien (le message omet le numéro)
  assert.equal(recipientNumber('PHONE', null, '123'), '');
  assert.equal(recipientNumber(undefined, null, null), '');
  // longueur E.164 invalide ou lettres : on ne l'affiche pas en entier
  assert.equal(recipientNumber('PHONE', '1234567', '+1234567'), '***4567');
  assert.equal(recipientNumber('MOBILE_MONEY', null, '+22370ABC456'), '***0456');
});

test('confirmation à l\'expéditeur : numéro complet visible en français, anglais, arabe (isolé gauche-à-droite) et e-mail', () => {
  const OM_PHONE = { ...OMAN, service: 'Mobile', to: '+96891234567' };
  assert.ok(buildSms('fr', OM_PHONE).includes('Service : Mobile (+96891234567).'));
  assert.ok(buildSms('en', OM_PHONE).includes('for a transfer to +96891234567. Ref'), buildSms('en', OM_PHONE));
  const ar = buildSms('ar', OM_PHONE);
  assert.ok(ar.includes('\u202A(+96891234567)\u202C'), ar);
  assert.ok(buildSms('ar', { ...OM_PHONE, service: '' }).includes('المستفيد: \u202A+96891234567\u202C.'));
  assert.ok(buildEmail('ar', OM_PHONE).html.includes('+96891234567'));
  assert.ok(!/\*\*\*/.test(ar));
});

test('nombre de SMS de la confirmation avec numéro complet (coût)', () => {
  assert.ok(smsSegments(buildSms('ar', ORANGE)).segments <= 4, 'arabe Orange Money');
  assert.ok(smsSegments(buildSms('ar', { ...OMAN, service: 'Mobile', to: '+96891234567' })).segments <= 3, 'arabe Oman');
  assert.ok(smsSegments(buildSms('fr', ORANGE)).segments <= 2, 'français Orange Money');
});

test('SMS au bénéficiaire : jamais « YOR » (la référence YOR-TX-… devient TX-…), dans les trois langues ; la confirmation à l\'expéditeur affiche la référence complète FRD-TX-… (jamais YOR)', () => {
  assert.equal(recipientRef('YOR-TX-20261010-F627B7'), 'TX-20261010-F627B7');
  assert.equal(recipientRef('TXN-REAL01'), 'TXN-REAL01');
  assert.equal(recipientRef(null), '');
  const REAL = { audience: 'EXTERNAL', amount: 110, currency: 'OMR', dest: { amount: 110, currency: 'OMR' }, from: 'Damys T.', ref: 'YOR-TX-20261010-F627B7', createdAt: '2026-10-10T08:02:12Z' };
  for (const lang of ['fr', 'en', 'ar']) {
    for (const audience of ['EXTERNAL', 'INTERNAL']) {
      const s = buildSms(lang, { ...REAL, audience });
      assert.ok(!/yor/i.test(s), `${lang}/${audience}: ${s}`);
      assert.ok(s.includes('TX-20261010-F627B7'), s);
    }
  }
  assert.ok(buildSms('en', { ...REAL, audience: 'SENDER', total: 111.05, service: 'Local transfer', to: '+96899650018' }).includes('FRD-TX-20261010-F627B7'));
  assert.doesNotMatch(buildSms('en', { ...REAL, audience: 'SENDER', total: 111.05, service: 'Local transfer', to: '+96899650018' }), /YOR/);
});

test('transfert entre comptes de l\'application : « Transfer Confirmed », et « reçu » reste vrai', () => {
  const s = buildSms('en', { ...INT, total: 1.105, service: 'Orange Money' });
  assert.match(s, /^Transfer Confirmed: You received OMR 20\.000 from Adam K\. Ref TXN-ABC123\./);
  assert.ok(!/fees|Orange/.test(s));
});

test('e-mail de confirmation à l\'expéditeur : total débité, frais, montant en XOF, taux, service, numéro complet du bénéficiaire', () => {
  const fr = buildEmail('fr', ORANGE);
  assert.ok(fr.subject.startsWith('Confirmation de votre transfert : 1,105 OMR'), fr.subject);
  for (const x of ['Frais (TVA incluse)', '0,105 OMR', 'Total débité', '1,105 OMR', '1 980 XOF', 'Taux (configuré)', '1 OMR = 1980.0000 XOF', 'Orange Money', '+22370123456', 'ne confirme pas']) assert.ok(fr.html.includes(x), x);
  const ar = buildEmail('ar', ORANGE);
  assert.ok(ar.html.includes('dir="rtl"') && ar.html.includes('إجمالي المبلغ المخصوم') && ar.subject.startsWith('تأكيد تحويلك'));
  const om = buildEmail('ar', OMAN).html;
  assert.ok(!/XOF/.test(om) && !om.includes('السعر (مُعدّ)'), 'Oman : pas de conversion');
  assert.ok(!/yor/i.test(fr.subject + fr.html));
  const none = buildEmail('en', { ...ORANGE, total: null, service: '', to: '', dest: null }).html;
  assert.ok(!/Fees|Total debited|Service|Beneficiary/.test(none));
});

test('e-mail du bénéficiaire : inchangé (aucun frais)', () => {
  const m = buildEmail('fr', { ...EXT, audience: 'EXTERNAL', total: 21, service: 'Orange Money' }).html;
  assert.ok(!/Frais|Total débité|Orange/.test(m));
});

test('e-mail : détails + avertissement « fonds non confirmés », aucun YOR, HTML échappé', () => {
  for (const lang of ['fr', 'en', 'ar']) {
    const m = buildEmail(lang, { ...EXT, from: '<b>Eve</b>' });
    assert.ok(!/yor/i.test(m.subject + m.html), 'ni nom ni YOR ID');
    assert.ok(m.html.includes('TXN-ABC123'));
    assert.ok(!m.html.includes('<b>Eve</b>') && m.html.includes('&lt;b&gt;Eve&lt;/b&gt;'));
    assert.equal(m.html.includes('dir="rtl"'), lang === 'ar');
  }
  assert.ok(!/re[cç]u/i.test(buildEmail('fr', EXT).subject));
});

test('e-mail au bénéficiaire : « confirmé » (débit effectué), jamais « reçu » ; l\'e-mail de l\'expéditeur garde « en cours de traitement »', () => {
  const fr = buildEmail('fr', EXT), en = buildEmail('en', EXT), ar = buildEmail('ar', EXT);
  assert.ok(/confirmé/.test(fr.subject) && /Confirmé/.test(fr.html) && /débité du compte de l(?:'|&#39;)expéditeur/.test(fr.html));
  assert.ok(/confirmed/.test(en.subject) && /Confirmed/.test(en.html) && /debited from the sender/.test(en.html));
  assert.ok(/تم تأكيد/.test(ar.subject) && /مؤكد/.test(ar.html));
  for (const m of [fr, en, ar]) assert.ok(!/ne confirme pas|does not confirm|لا تؤكد|En cours de traitement|Processing|قيد المعالجة/.test(m.html));
  assert.ok(!/re[cç]u|received|استلم/i.test(fr.html + en.html + ar.html), 'ne dit jamais « reçu »');
  assert.ok(/ne confirme pas/.test(buildEmail('fr', ORANGE).html) && /En cours de traitement/.test(buildEmail('fr', ORANGE).html));
  assert.ok(/does not confirm/.test(buildEmail('en', ORANGE).html) && /Processing/.test(buildEmail('en', ORANGE).html));
});

test('réponses Brevo : envoyé / crédits / authentification / refus / temporaire', () => {
  assert.deepEqual(classifySmsResponse(201, '{"messageId":1511882900176220}'), { kind: 'sent', messageId: '1511882900176220' });
  assert.equal(classifySmsResponse(400, '{"code":"duplicate_request","message":"Request already processed"}').kind, 'sent');
  const credits = classifySmsResponse(400, '{"code":"not_enough_credits","message":"Insufficient credits"}');
  assert.equal(credits.kind, 'defer'); assert.match(credits.reason, /sms_credits_missing/); assert.equal(credits.minutes, 30);
  assert.equal(classifySmsResponse(401, '{"code":"unauthorized","message":"Key not found"}').kind, 'defer');
  assert.equal(classifySmsResponse(400, '{"code":"invalid_parameter","message":"recipient"}').kind, 'terminal');
  assert.equal(classifySmsResponse(500, 'oops').kind, 'retry');
  assert.equal(classifySmsResponse(400, 'not json at all').kind, 'retry');
});

test('nom d\'expéditeur SMS : 11 caractères alphanumériques maximum, sinon valeur sûre', () => {
  assert.equal(smsSenderName('FriendlyPay'), 'FriendlyPay');
  assert.equal(smsSenderName('Trop long nom!'), 'FriendlyPay');
  assert.equal(smsSenderName(undefined), 'FriendlyPay');
  for (const legacy of ['ServiceSMS', 'YORWALLET', 'servicesms']) assert.equal(smsSenderName(legacy), 'FriendlyPay', legacy);   // 12.12.0 : un ancien secret SMS_SENDER n'affiche plus l'ancien nom
  assert.equal(brevoRecipient('22507000000'), '+22507000000');
  assert.equal(brevoRecipient('+968 7798 6533'), '+96877986533');
});

test('délai de relance : exponentiel, plafonné à 60 minutes', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelayMin), [2, 4, 8, 16, 32, 60]);
});

/* ---------- fournisseurs SMS interchangeables (aucun réseau : on construit la requête et on classe la réponse) ---------- */
const TXT = 'Transfer of 20.000 OMR. Ref TXN-1. Status: processing.';
const SID = 'AC' + 'a1'.repeat(16);

test('SMS_PROVIDER : brevo par défaut, valeurs inconnues ignorées', () => {
  assert.equal(smsProviderName(undefined), 'brevo');
  assert.equal(smsProviderName(''), 'brevo');
  assert.equal(smsProviderName('Infobip'), 'infobip');
  assert.equal(smsProviderName(' TWILIO '), 'twilio');
  assert.equal(smsProviderName('http://evil'), 'brevo');
  // sans secret SMS_PROVIDER : Infobip dès que sa clé est présente, sinon Brevo ; un choix explicite l'emporte toujours
  assert.equal(smsProviderName(undefined, 'abc123'), 'infobip');
  assert.equal(smsProviderName('', 'abc123'), 'infobip');
  assert.equal(smsProviderName(undefined, ''), 'brevo');
  assert.equal(smsProviderName(undefined, '   '), 'brevo');
  assert.equal(smsProviderName('brevo', 'abc123'), 'brevo');
  assert.equal(smsProviderName('twilio', 'abc123'), 'twilio');
  assert.equal(smsProviderName('http://evil', 'abc123'), 'brevo');
});

test('numéro invalide : refus définitif avant tout appel réseau', () => {
  for (const p of ['brevo', 'infobip', 'twilio']) {
    assert.deepEqual(buildSmsRequest(p, { brevoKey: 'k', infobipKey: 'k', twilioSid: SID, twilioToken: 't', twilioFrom: '+15005550006' }, '12', TXT, false), { error: 'invalid_phone', terminal: true });
  }
});

test('Brevo : requête inchangée (clé, expéditeur FriendlyPay par défaut, +chiffres)', () => {
  const r = buildSmsRequest('brevo', { brevoKey: 'KEY' }, '96891234567', TXT, false);
  assert.equal(r.url, 'https://api.brevo.com/v3/transactionalSMS/send');
  assert.equal(r.headers['api-key'], 'KEY');
  const b = JSON.parse(r.body);
  assert.equal(b.sender, 'FriendlyPay'); assert.equal(b.recipient, '+96891234567'); assert.equal(b.type, 'transactional'); assert.equal(b.unicodeEnabled, false);
  assert.match(buildSmsRequest('brevo', {}, '96891234567', TXT, false).error, /not configured.*BREVO_API_KEY/);
});

const IBK = '0123456789abcdef0123456789abcdef-01234567-89ab-cdef-0123-456789abcdef';   // forme d'une vraie clé

test('Infobip : POST /sms/3/messages, en-tête « App clé », chiffres seuls, expéditeur FriendlyPay (plus « ServiceSMS ») tant que SMS_SENDER n\'est pas défini', () => {
  const r = buildSmsRequest('infobip', { infobipKey: IBK }, '+968 9123 4567', TXT, false);
  assert.equal(r.url, 'https://api.infobip.com/sms/3/messages');
  assert.equal(r.headers.Authorization, 'App ' + IBK);
  assert.deepEqual(JSON.parse(r.body), { messages: [{ sender: 'FriendlyPay', destinations: [{ to: '96891234567' }], content: { text: TXT } }] });
  const own = buildSmsRequest('infobip', { infobipKey: IBK, sender: 'MyBrand', infobipBase: 'https://abc12.api.infobip.com/' }, '96891234567', TXT, false);
  assert.equal(own.url, 'https://abc12.api.infobip.com/sms/3/messages');
  assert.equal(JSON.parse(own.body).messages[0].sender, 'MyBrand');
  assert.match(buildSmsRequest('infobip', {}, '96891234567', TXT, false).error, /INFOBIP_API_KEY/);
});

test('Infobip : la clé ne part JAMAIS vers un autre serveur que *.infobip.com en https', () => {
  for (const base of ['http://api.infobip.com', 'https://api.infobip.com.evil.com', 'https://evil.com/?x=.infobip.com', 'https://infobip.com.evil.io', 'ftp://api.infobip.com', 'https://evil-infobip.com']) {
    const r = buildSmsRequest('infobip', { infobipKey: IBK, infobipBase: base }, '96891234567', TXT, false);
    assert.ok('error' in r, base + ' doit être refusé');
  }
  assert.ok(!('error' in buildSmsRequest('infobip', { infobipKey: IBK, infobipBase: 'https://xyz.api.infobip.com' }, '96891234567', TXT, false)));
});

test('Infobip : clé collée avec espaces / retour à la ligne / marques invisibles du téléphone = nettoyée ; texte « curl … » ou caractère exotique = refusé sans brûler de tentative', () => {
  const dirty = ['  ', IBK, '\n', '\u202D', '\u200F', '\uFEFF'].join('');
  const ok = buildSmsRequest('infobip', { infobipKey: dirty, infobipBase: ' https://x1e883.api.infobip.com/ \u202C' }, '96891234567', TXT, false);
  assert.equal(ok.headers.Authorization, 'App ' + IBK);
  assert.equal(ok.url, 'https://x1e883.api.infobip.com/sms/3/messages');
  for (const bad of ["curl -L -g 'https://x1e883.api.infobip.com/sms/3/messages' -H 'Authorization: App ${INFOBIP_API_KEY}'", IBK + '…', 'short', '${INFOBIP_API_KEY}', 'clé' + IBK]) {
    const r = buildSmsRequest('infobip', { infobipKey: bad }, '96891234567', TXT, false);
    assert.match(r.error, /INFOBIP_API_KEY/); assert.ok(!r.terminal, 'jamais terminal : le message reste en file jusqu\'à correction du secret');
    assert.ok(!('headers' in r));
  }
});

test('Twilio : URL avec le SID, authentification Basic, formulaire To/From/Body, SID invalide refusé', () => {
  const r = buildSmsRequest('twilio', { twilioSid: SID, twilioToken: 'TOK', twilioFrom: '+1 500 555 0006' }, '96891234567', TXT, false);
  assert.equal(r.url, `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
  assert.equal(r.headers.Authorization, 'Basic ' + Buffer.from(`${SID}:TOK`).toString('base64'));
  const f = new URLSearchParams(r.body);
  assert.equal(f.get('To'), '+96891234567'); assert.equal(f.get('From'), '+15005550006'); assert.equal(f.get('Body'), TXT);
  assert.equal(new URLSearchParams(buildSmsRequest('twilio', { twilioSid: SID, twilioToken: 'T', twilioFrom: 'MyBrand' }, '96891234567', TXT, false).body).get('From'), 'MyBrand');
  assert.match(buildSmsRequest('twilio', { twilioSid: 'AC../../x', twilioToken: 'T', twilioFrom: '+15005550006' }, '96891234567', TXT, false).error, /not configured/);
  assert.match(buildSmsRequest('twilio', { twilioSid: SID, twilioToken: 'T' }, '96891234567', TXT, false).error, /TWILIO_FROM/);
});

test('Infobip : réponses classées (accepté / crédit / expéditeur à régler / refus définitif / clé / erreur serveur)', () => {
  const ok = JSON.stringify({ bulkId: 'b', messages: [{ messageId: 'M1', status: { groupId: 1, groupName: 'PENDING', id: 26, name: 'PENDING_ACCEPTED', description: 'Message sent to next instance' }, destination: '96891234567' }] });
  assert.deepEqual(classifySms('infobip', 200, ok), { kind: 'sent', messageId: 'M1' });
  const rej = (name, desc) => JSON.stringify({ messages: [{ messageId: 'M', status: { groupId: 5, groupName: 'REJECTED', name, description: desc } }] });
  assert.equal(classifySms('infobip', 200, rej('REJECTED_NOT_ENOUGH_CREDITS', 'Not enough credits')).kind, 'defer');
  assert.match(classifySms('infobip', 200, rej('REJECTED_NOT_ENOUGH_CREDITS', 'Not enough credits')).reason, /^sms_credits_missing/);
  assert.equal(classifySms('infobip', 200, rej('REJECTED_SENDER', 'Sender not allowed')).kind, 'defer');
  assert.equal(classifySms('infobip', 200, rej('REJECTED_DESTINATION', 'Invalid destination')).kind, 'terminal');
  assert.equal(classifySms('infobip', 401, JSON.stringify({ requestError: { serviceException: { messageId: 'UNAUTHORIZED', text: 'Invalid login details' } } })).kind, 'defer');
  assert.equal(classifySms('infobip', 400, JSON.stringify({ requestError: { serviceException: { messageId: 'BAD_REQUEST', text: 'Bad request' } } })).kind, 'terminal');
  assert.equal(classifySms('infobip', 503, 'down').kind, 'retry');
  assert.equal(classifySms('infobip', 429, '').kind, 'retry');
});

test('Twilio : réponses classées (accepté / compte d\'essai / numéro invalide / authentification / erreur serveur)', () => {
  assert.deepEqual(classifySms('twilio', 201, JSON.stringify({ sid: 'SM1', status: 'queued' })), { kind: 'sent', messageId: 'SM1' });
  assert.equal(classifySms('twilio', 201, '{}').kind, 'retry');
  const err = (code, message, status = 400) => classifySms('twilio', status, JSON.stringify({ code, message, status }));
  assert.equal(err(21608, 'The number is unverified. Trial accounts may only send messages to verified numbers').kind, 'defer');
  assert.equal(err(21408, 'Permission to send an SMS has not been enabled for the region').kind, 'defer');
  assert.equal(err(21211, "Invalid 'To' Phone Number").kind, 'terminal');
  assert.equal(err(21614, "'To' number is not a valid mobile number").kind, 'terminal');
  assert.equal(err(20003, 'Authenticate', 401).kind, 'defer');
  assert.equal(err(20429, 'Too Many Requests', 429).kind, 'retry');
  assert.equal(classifySms('twilio', 500, 'oops').kind, 'retry');
});

test('le fournisseur par défaut classe comme avant (régression Brevo)', () => {
  assert.deepEqual(classifySms('brevo', 201, '{"messageId":"<a@b>"}'), classifySmsResponse(201, '{"messageId":"<a@b>"}'));
  assert.equal(classifySms('brevo', 400, '{"code":"not_enough_credits","message":"x"}').kind, 'defer');
});

test('jamais de double point après l\'initiale de l\'expéditeur (« Adam K.. Ref »), dans les trois langues et tous les cas', () => {
  for (const lang of ['fr', 'en', 'ar']) {
    for (const d of [EXT, INT, { ...EXT, from: 'Adam' }, { ...EXT, from: '' }, ORANGE, OMAN, { ...ORANGE, total: null }, { ...ORANGE, dest: null, service: '', to: '' }, { ...OMAN, service: '' }]) {
      const s = buildSms(lang, d);
      assert.ok(!/\.\./.test(s), `${lang}: double point dans « ${s} »`);
    }
  }
  assert.match(buildSms('en', EXT), /from Adam K\. Ref TXN-ABC123\./);
  assert.match(buildSms('fr', EXT), /de Adam K\. Ref\. TXN-ABC123\./);
  assert.match(buildSms('en', { ...EXT, from: 'Adam' }), /from Adam\. Ref TXN-ABC123\./);
});

test('confirmation à l\'expéditeur : arabe pour un compte d\'un pays arabophone (même pour Orange Money), sinon langue du service, sinon de la personne', () => {
  // compte à Oman : toujours l'arabe
  assert.equal(senderNoticeLang('OM', 'ML', 'fr'), 'ar');     // Orange Money Mali
  assert.equal(senderNoticeLang('OM', 'CI', 'en'), 'ar');     // Orange Money Côte d'Ivoire
  assert.equal(senderNoticeLang('om', 'BF', 'fr'), 'ar');     // minuscules acceptées
  assert.equal(senderNoticeLang('OM', 'OM', 'en'), 'ar');     // service d'Oman
  assert.equal(senderNoticeLang('AE', 'ML', 'en'), 'ar');
  assert.equal(senderNoticeLang('OM', '', 'fr'), 'ar');        // pays du service absent
  // compte hors pays arabophone : la langue du service, puis celle de la personne
  assert.equal(senderNoticeLang('ML', 'CI', 'en'), 'fr');
  assert.equal(senderNoticeLang('US', 'OM', 'en'), 'ar');
  assert.equal(senderNoticeLang('US', 'US', 'fr'), 'fr');
  assert.equal(senderNoticeLang('', '', 'en'), 'en');
  assert.equal(senderNoticeLang(undefined, undefined, 'fr'), 'fr');
});

test('SMS arabe de confirmation pour Orange Money : détails en arabe, montant en XOF et débit en OMR, jamais « reçu »', () => {
  const d = { audience: 'SENDER', amount: 1, currency: 'OMR', total: 1.105, dest: { amount: 1980, currency: 'XOF' }, from: 'Adam K.',
    ref: 'TXN-REAL01', createdAt: '2026-10-09T13:50:00Z', service: 'Orange Money', to: '+22370123456' };
  const sms = buildSms(senderNoticeLang('OM', 'ML', 'fr'), d);
  assert.equal(sms, 'تأكيد التحويل: تم خصم 1.105 OMR من حسابك (المبلغ 1.000 OMR + الرسوم 0.105 OMR). المبلغ التقديري للصرف: 1,980 XOF عبر Orange Money \u202A(+22370123456)\u202C. المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: مؤكد.');
  assert.ok(!/\b(received|reçu|recu)\b/i.test(sms));
  assert.ok(!/YOR/i.test(sms), 'pas de nom de marque dans le texte');
  const mail = buildEmail('ar', d);
  assert.match(mail.html, /dir="rtl"/);
  assert.match(mail.html, /1,980 XOF/);
});

/* ---------- SMS en anglais, style notification bancaire (10 octobre 2026) ---------- */
const WAVE = { audience: 'SENDER', amount: 150, currency: 'OMR', total: 151.05, dest: { amount: 233100, currency: 'XOF' }, from: 'Damys T.',
  ref: 'YOR-TX-20261010-4E753B', createdAt: '2026-10-10T16:02:11.000Z', service: 'Wave', to: '+2250544469457' };
const OM_LOCAL = { audience: 'SENDER', amount: 150, currency: 'OMR', total: 151.05, dest: { amount: 150, currency: 'OMR' }, from: 'Damys T.',
  ref: 'YOR-TX-20261010-4E753B', createdAt: '2026-10-10T16:02:11.000Z', service: 'تحويل محلي', to: '+96875235685' };

test('SMS anglais : tous les SMS de transfert sont en anglais', () => {
  assert.equal(SMS_LANG, 'en');
});

test('Oman : OMR, SMS anglais style banque — alerte de débit pour l\'expéditeur, « Transfer Confirmed » pour le destinataire, date ET heure', () => {
  assert.equal(buildSms('en', OM_LOCAL),
    'Debit Alert: OMR 151.050 debited from your account (transfer OMR 150.000 + fees OMR 1.050) for a transfer to +96875235685. Ref FRD-TX-20261010-4E753B. 10 Oct 2026 16:02 UTC. Status: Confirmed.');
  assert.equal(buildSms('en', { ...OM_LOCAL, audience: 'EXTERNAL' }),
    'Transfer Confirmed: OMR 150.000 from Damys T. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
});

test('Wave : montants en FCFA, SMS adapté au service, expéditeur et destinataire', () => {
  assert.equal(buildSms('en', WAVE),
    'Debit Alert: OMR 151.050 debited from your account (transfer OMR 150.000 + fees OMR 1.050) for a transfer of approx. FCFA 233,100 via Wave to +2250544469457. Ref FRD-TX-20261010-4E753B. 10 Oct 2026 16:02 UTC. Status: Confirmed.');
  assert.equal(buildSms('en', { ...WAVE, audience: 'EXTERNAL' }),
    'Wave Transfer Confirmed: approx. FCFA 233,100 (OMR 150.000) from Damys T. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
});

test('Orange Money : montants en FCFA, SMS adapté au service', () => {
  const o = { ...WAVE, service: 'Orange Money', to: '+22370123456' };
  assert.ok(buildSms('en', o).includes('for a transfer of approx. FCFA 233,100 via Orange Money to +22370123456.'));
  assert.ok(buildSms('en', { ...o, audience: 'EXTERNAL' }).startsWith('Orange Money Transfer Confirmed: approx. FCFA 233,100 (OMR 150.000) from Damys T.'));
});

test('transfert entre deux comptes de l\'application : alerte de débit avec le nom du destinataire, sans frais', () => {
  const s = buildSms('en', { audience: 'SENDER', amount: 5, currency: 'OMR', total: 5, dest: null, from: 'Damys T.', ref: 'YOR-TX-20261010-AAAAAA',
    createdAt: '2026-10-10T16:02:11.000Z', toName: 'Adam K.' });
  assert.equal(s, 'Debit Alert: OMR 5.000 debited from your account for a transfer to Adam K. Ref FRD-TX-20261010-AAAAAA. 10 Oct 2026 16:02 UTC. Status: Confirmed.');
});

test('JAMAIS « Test » ni « en cours / processing / pending » dans un SMS, quelles que soient la langue, l\'audience et le service', () => {
  for (const lang of ['fr', 'en', 'ar']) {
    for (const base of [WAVE, OM_LOCAL, ORANGE, OMAN, EXT, INT]) {
      for (const audience of ['SENDER', 'EXTERNAL', 'INTERNAL']) {
        const s = buildSms(lang, { ...base, audience });
        assert.ok(!/\btest\b|en cours|processing|pending|in progress|قيد المعالجة|جارٍ|جار /i.test(s), `${lang}/${audience}: ${s}`);
        assert.ok(/2026/.test(s) && /\d{2}:\d{2}/.test(s), `date et heure : ${s}`);
      }
    }
  }
});

test('chaque SMS anglais porte montant, devise, référence, date et heure ; alphabet GSM ; 2 SMS au plus', () => {
  for (const base of [WAVE, OM_LOCAL, ORANGE, OMAN, EXT, INT]) {
    for (const audience of ['SENDER', 'EXTERNAL', 'INTERNAL']) {
      const s = buildSms('en', { ...base, audience });
      assert.ok(/(OMR|FCFA) [\d,]+(\.\d+)?/.test(s), `montant et devise : ${s}`);
      assert.ok(/Ref \S+/.test(s), `référence : ${s}`);
      assert.ok(/\d{1,2} [A-Z][a-z]{2} 20\d\d \d{2}:\d{2} UTC/.test(s), `date et heure : ${s}`);
      assert.equal(smsSegments(s).unicode, false, s);
      assert.ok(smsSegments(s).segments <= 2, `${smsSegments(s).segments} SMS : ${s}`);
    }
  }
});

test('le bénéficiaire ne voit ni frais, ni total débité, ni numéro, ni nom de marque ; le mot « received » n\'apparaît que pour un transfert interne', () => {
  for (const base of [WAVE, OM_LOCAL, ORANGE]) {
    const s = buildSms('en', { ...base, audience: 'EXTERNAL' });
    assert.ok(!/fees|debit|\+\d{6,}|yor/i.test(s), s);
    assert.ok(!/received/i.test(s), s);
  }
  assert.ok(/You received/.test(buildSms('en', INT)));
});

test('aides : date anglaise UTC, FCFA, nom de service reconnu seulement, comparaison à durée constante', () => {
  assert.equal(fmtDateEn('2026-10-10T16:02:11Z'), '10 Oct 2026 16:02 UTC');
  assert.equal(fmtDateEn('pas une date'), '');
  assert.equal(smsCurrency('XOF'), 'FCFA');
  assert.equal(smsCurrency('OMR'), 'OMR');
  assert.equal(serviceLabelEn('Wave'), 'Wave');
  assert.equal(serviceLabelEn('Orange Money'), 'Orange Money');
  assert.equal(serviceLabelEn('تحويل محلي'), '');
  assert.equal(serviceLabelEn('Local phone transfer'), '');
  assert.equal(serviceLabelEn('<b>Wave</b> http://x.y'), 'Wave');   // toujours le nom reconnu, jamais le texte saisi
  assert.equal(safeEqual('abc123', 'abc123'), true);
  assert.equal(safeEqual('abc123', 'abc124'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, undefined), false);
  assert.equal(safeEqual('x', null), false);
});

test('12 octobre : le destinataire voit le NUMÉRO de l\'expéditeur (SMS + e-mail), jamais un numéro inventé', () => {
  const oman = { audience: 'EXTERNAL', amount: 150, currency: 'OMR', dest: { amount: 150, currency: 'OMR' }, from: 'Damys T.', fromPhone: '+96877986533',
    ref: 'YOR-TX-20261010-4E753B', createdAt: '2026-10-10T16:02:11Z' };
  assert.equal(buildSms('en', oman), 'Transfer Confirmed: OMR 150.000 from +96877986533. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
  // transfert interne
  assert.equal(buildSms('en', { ...oman, audience: 'INTERNAL', dest: null }), 'Transfer Confirmed: You received OMR 150.000 from +96877986533. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
  // Wave : le nom du service et le montant en FCFA restent, le numéro remplace le nom
  const wave = { ...oman, dest: { amount: 233100, currency: 'XOF' }, service: 'Wave' };
  assert.equal(buildSms('en', wave), 'Wave Transfer Confirmed: approx. FCFA 233,100 (OMR 150.000) from +96877986533. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
  // aucun numéro enregistré : on garde le nom, on n\'invente rien
  assert.equal(buildSms('en', { ...oman, fromPhone: '' }), 'Transfer Confirmed: OMR 150.000 from Damys T.. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.'.replace('T..', 'T.'));
  assert.equal(buildSms('en', { ...oman, fromPhone: undefined, from: '' }), 'Transfer Confirmed: OMR 150.000. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.');
  // le numéro est nettoyé (GSM-safe : chiffres, « + », « * » seulement) et ne porte jamais de lien
  assert.equal(fromLabel({ ...oman, fromPhone: '+968 7798-6533 http://x.y' }), '+96877986533');
  // le SMS reste anglais, sans « Test » ni « en cours », et tient en 1 segment GSM-7
  const sms = buildSms('en', oman);
  assert.doesNotMatch(sms, /test|en cours|processing|pending/i);
  assert.deepEqual(smsSegments(sms), { chars: sms.length, unicode: false, segments: 1 });
  // l\'e-mail du bénéficiaire montre aussi le numéro dans la ligne « Sender »
  const mail = buildEmail('en', oman);
  assert.match(mail.html, /Sender<\/td>[^]*?\+96877986533/);
  assert.doesNotMatch(mail.html, /Damys/);
  // la confirmation de l\'EXPÉDITEUR ne change pas
  assert.match(buildSms('en', { ...oman, audience: 'SENDER', total: 151.05, to: '+96875235685' }), /^Debit Alert: OMR 151\.050 debited/);
});

/* ---------- modèle arabe du SMS au bénéficiaire (12 octobre 2026) ---------- */
const AR_EXT = { audience: 'EXTERNAL', amount: 30, currency: 'OMR', dest: null, from: 'Said A.', fromPhone: '+96877986533', ref: 'YOR-TX-20261011-ABC123',
  createdAt: '2026-10-11T11:22:27Z', account: '+96891234567', international: false, tzCountry: 'OM' };
const L = (s, l) => s.split('\n').find((x) => x.startsWith(l + ':'));
const strip = (s) => s.replace(/[\u202A\u202C]/g, '');

test('modèle arabe : structure du modèle du propriétaire, champs remplis, aucune ligne vide', () => {
  const t = strip(buildRecipientSmsAr(AR_EXT));
  assert.equal(t, [
    'عزيزي العميل،', 'تم تأكيد تحويل مبلغ OMR 30.000.', 'رقم المرجع: TX-20261011-ABC123', 'التاريخ والوقت: 11/10/2026 15:22',
    'من الحساب: +968 7798 6533', 'إلى الحساب: +968 9123 4567'].join('\n'));
  assert.doesNotMatch(t, /YOR|BMCT/i, 'ni marque, ni préfixe bancaire tiers');
  assert.ok(!/:\s*$/m.test(t));
});

test('modèle arabe : international = avertissement du modèle, UNE fois, à la fin ; national = aucun', () => {
  const intl = strip(buildRecipientSmsAr({ ...AR_EXT, international: true }));
  assert.ok(intl.endsWith('\n\n' + AR_INTERNATIONAL_NOTE));
  assert.equal(intl.split('حوالة دولية').length - 1, 1);
  assert.equal(AR_INTERNATIONAL_NOTE, 'يرجى العلم بأنه نظرًا لأن هذه حوالة دولية، فقد يستغرق وصول المبلغ إلى حسابك بعض الوقت. شكرًا لتفهمكم.');
  for (const v of [false, undefined, null, 'true', 1]) assert.ok(!buildRecipientSmsAr({ ...AR_EXT, international: v }).includes('حوالة دولية'), String(v));
});

test('modèle arabe : une valeur absente OMET la ligne (jamais « إلى الحساب: » vide, jamais undefined / null / NaN)', () => {
  for (const account of ['', undefined, null, '   ', '<>']) {
    const t = buildRecipientSmsAr({ ...AR_EXT, account });
    assert.equal(L(t, 'إلى الحساب'), undefined, JSON.stringify(account));
    assert.ok(!/:\s*$/m.test(strip(t)));
  }
  const t = buildRecipientSmsAr({ ...AR_EXT, from: '', fromPhone: undefined, ref: '', createdAt: 'pas une date', account: undefined });
  assert.equal(strip(t), 'عزيزي العميل،\nتم تأكيد تحويل مبلغ OMR 30.000.');
  for (const bad of ['undefined', 'null', 'NaN', '[object']) assert.ok(!t.includes(bad), bad);
});

test('modèle arabe : sans numéro, « من الحساب » garde le nom ; un numéro inventé est impossible', () => {
  const t = buildRecipientSmsAr({ ...AR_EXT, fromPhone: undefined });
  assert.equal(L(t, 'من الحساب'), 'من الحساب: Said A.');
});

test('modèle arabe : externe = « تم تأكيد تحويل » (jamais « استلام »), interne = « تم استلام … بنجاح » ; conversion XOF en FCFA', () => {
  assert.ok(!buildRecipientSmsAr(AR_EXT).includes('استلام'));
  assert.ok(strip(buildRecipientSmsAr({ ...AR_EXT, audience: 'INTERNAL' })).includes('تم استلام مبلغ OMR 30.000 بنجاح.'));
  const conv = strip(buildRecipientSmsAr({ ...AR_EXT, dest: { amount: 4800, currency: 'XOF' } }));
  assert.ok(conv.includes('تم تأكيد تحويل مبلغ حوالي FCFA 4,800 (OMR 30.000).'), conv);
});

test('modèle arabe : les numéros et la référence sont isolés en gauche-à-droite (pas de « +968 » inversé)', () => {
  const t = buildRecipientSmsAr(AR_EXT);
  for (const v of ['+968 9123 4567', '+968 7798 6533', 'TX-20261011-ABC123', 'OMR 30.000', '11/10/2026 15:22']) assert.ok(t.includes('\u202A' + v + '\u202C'), v);
});

test('modèle arabe : le compte du bénéficiaire ne laisse passer que chiffres, « * » et « + » (aucun lien)', () => {
  const t = buildRecipientSmsAr({ ...AR_EXT, account: 'http://evil.example/x?a=+96891234567' });
  assert.ok(!t.includes('://') && !/evil/i.test(t), t);
  assert.match(strip(L(t, 'إلى الحساب')), /^إلى الحساب: [0-9*+ ]+$/);
});

test('pays international : les deux pays connus ET différents ; inconnu ou identique = non', () => {
  assert.equal(isInternational('OM', 'AE'), true);
  assert.equal(isInternational('om', 'ci'), true);
  for (const [a, b] of [['OM', 'OM'], ['OM', ''], ['', 'AE'], [null, undefined], ['OMAN', 'AE'], ['O', 'A'], ['OM', 'A1']]) assert.equal(isInternational(a, b), false, a + '/' + b);
});

test('langue du SMS : arabe pour un bénéficiaire arabophone (externe) ou un compte réglé en arabe (interne) ; expéditeur et autres pays : SMS_LANG', () => {
  for (const c of ['OM', 'AE', 'SA', 'EG', 'om']) assert.equal(recipientSmsLang('EXTERNAL', c, null), 'ar', c);
  for (const c of ['CI', 'ML', 'FR', 'US', '', null, undefined]) assert.equal(recipientSmsLang('EXTERNAL', c, null), SMS_LANG, String(c));
  assert.equal(recipientSmsLang('INTERNAL', null, 'ar'), 'ar');
  for (const l of ['en', 'fr', null]) assert.equal(recipientSmsLang('INTERNAL', 'OM', l), SMS_LANG);
  for (const c of ['OM', 'CI']) assert.equal(recipientSmsLang('SENDER', c, 'ar'), SMS_LANG, 'la confirmation à l\'expéditeur ne change pas');
});

test('buildNoticeSms : modèle arabe seulement pour le bénéficiaire en arabe ; le reste est identique à buildSms', () => {
  assert.equal(buildNoticeSms('ar', AR_EXT), buildRecipientSmsAr(AR_EXT));
  assert.equal(buildNoticeSms('en', AR_EXT), buildSms('en', AR_EXT));
  const snd = { ...AR_EXT, audience: 'SENDER', to: '+96891234567', toName: '', total: 30.1 };
  assert.equal(buildNoticeSms('ar', snd), buildSms('ar', snd), 'la confirmation de l\'expéditeur garde son texte');
});

test('date et heure au format du modèle, en UTC', () => {
  assert.equal(fmtDateTimeUtc('2026-10-11T11:22:27Z'), '2026-10-11 11:22:27 UTC');
  assert.equal(fmtDateTimeUtc('2026-01-02T03:04:05+04:00'), '2026-01-01 23:04:05 UTC');
  assert.equal(fmtDateTimeUtc('nope'), '');
});

test('modèle arabe : coût SMS connu (Unicode = 67 caractères par segment)', () => {
  const info = smsSegments(buildRecipientSmsAr({ ...AR_EXT, international: true }));
  assert.equal(info.unicode, true);
  assert.ok(info.segments >= 4 && info.segments <= 6, JSON.stringify(info));
});

test('12.9.0 : la référence affichée à l\'EXPÉDITEUR (SMS EN / AR / FR, e-mail) est FRD-TX-… ; le BÉNÉFICIAIRE voit TX-… sans préfixe de marque dans ses SMS', () => {
  const D = { audience: 'SENDER', amount: 12, currency: 'OMR', total: 12.1, dest: null, from: 'Said A.', to: '+96891234567', ref: 'YOR-TX-20261016-ABC123', createdAt: '2026-10-16T08:02:12Z' };
  for (const lang of ['en', 'fr', 'ar']) {
    const s = buildSms(lang, D);
    assert.ok(s.includes('FRD-TX-20261016-ABC123'), lang + ' ' + s);
    assert.doesNotMatch(s, /YOR/, lang);
  }
  assert.ok(buildEmail('en', D).html.includes('FRD-TX-20261016-ABC123'));
  assert.doesNotMatch(buildEmail('en', D).html, /YOR/);
  for (const lang of ['en', 'fr', 'ar']) {
    const s = buildSms(lang, { ...D, audience: 'EXTERNAL' });
    assert.ok(s.includes('TX-20261016-ABC123'), lang + ' ' + s);
    assert.doesNotMatch(s, /YOR|FRD/, lang);
  }
});
