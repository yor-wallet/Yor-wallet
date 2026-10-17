import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createPublicKey, createVerify, hkdfSync, generateKeyPairSync, createECDH, webcrypto } from 'node:crypto';
import {
  b64uEncode, b64uDecode, generateVapidKeys, vapidAuthorization, audienceOf, encryptPayload, sendPush, buildPushMessage, buildTestMessage,
  fmtAmount, maskPhone, validSub, safeEqual, PUSH_TYPES, isPushServiceHost, validateSubscription,
} from '../../supabase/functions/push-send/lib.ts';

/* Logique PURE de la fonction push-send (notifications push de Friendly Pay).
   Le déchiffrement ci-dessous est écrit ICI avec node:crypto (autre chemin de code que la fonction, qui utilise WebCrypto) : si le test passe,
   un appareil qui suit la RFC 8291 pourra lire ce que la fonction envoie. */

const dec = new TextDecoder();
const enc = new TextEncoder();

/* Côté appareil (navigateur) : une paire ECDH P-256 + un secret « auth » de 16 octets = ce que PushManager.subscribe() produit. */
function makeDevice() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const auth = webcrypto.getRandomValues(new Uint8Array(16));
  return { ecdh, pub: new Uint8Array(ecdh.getPublicKey()), auth };
}

/* Déchiffrement RFC 8291 §3.4 (aes128gcm, un seul bloc). */
function decryptAsDevice(body, dev) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65); assert.equal(asPub[0], 4);
  const secret = dev.ecdh.computeSecret(Buffer.from(asPub));
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), Buffer.from(dev.pub), Buffer.from(asPub)]);
  const ikm = Buffer.from(hkdfSync('sha256', secret, Buffer.from(dev.auth), keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, Buffer.from(salt), Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, Buffer.from(salt), Buffer.from('Content-Encoding: nonce\0'), 12));
  const tag = cipher.slice(cipher.length - 16), ct = cipher.slice(0, cipher.length - 16);
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(Buffer.from(tag));
  const plain = Buffer.concat([d.update(Buffer.from(ct)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'dernier bloc : délimiteur 0x02');
  return plain.subarray(0, plain.length - 1);
}

test('base64url : aller-retour, sans « + / = »', () => {
  const bytes = new Uint8Array([251, 255, 254, 0, 1, 2, 3, 250]);
  const s = b64uEncode(bytes);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual([...b64uDecode(s)], [...bytes]);
});

test('chiffrement : un appareil conforme à la RFC 8291 relit exactement le message', async () => {
  const dev = makeDevice();
  const msg = { title: 'Transfert envoyé', body: '12.000 OMR envoyés au +968 ••••6533', tag: 'fp-1' };
  const body = await encryptPayload(enc.encode(JSON.stringify(msg)), dev.pub, dev.auth);
  assert.equal(body[20], 65);                       /* longueur de la clé publique du serveur */
  assert.deepEqual(JSON.parse(dec.decode(decryptAsDevice(body, dev))), msg);
});

test('chiffrement : vecteur officiel de la RFC 8291 (annexe A / section 5) reproduit à l\'octet près', async () => {
  const ua = b64uDecode('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
  const auth = b64uDecode('BTBZMqHH6r4Tts7J_aSIgg');
  const asPub = b64uDecode('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const asPrivJwk = { kty: 'EC', crv: 'P-256', x: b64uEncode(asPub.slice(1, 33)), y: b64uEncode(asPub.slice(33, 65)), d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' };
  const salt = b64uDecode('DGv6ra1nlYgDCS1FRnbzlw');
  const plain = b64uDecode('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24');
  assert.equal(dec.decode(plain), 'When I grow up, I want to be a watermelon');
  const body = await encryptPayload(plain, ua, auth, { salt, asPrivateJwk: asPrivJwk, asPublicRaw: asPub });
  const expected = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  assert.equal(b64uEncode(body), expected);
  /* et l'appareil de l'exemple (clé privée de la RFC) relit le texte d'origine */
  const dev = { ecdh: createECDH('prime256v1'), pub: ua, auth };
  dev.ecdh.setPrivateKey(Buffer.from(b64uDecode('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94')));
  assert.equal(dec.decode(decryptAsDevice(body, dev)), 'When I grow up, I want to be a watermelon');
});

test('chiffrement : chaque envoi a son sel et sa clé éphémère (jamais deux fois le même contenu chiffré)', async () => {
  const dev = makeDevice();
  const a = await encryptPayload(enc.encode('x'), dev.pub, dev.auth), b = await encryptPayload(enc.encode('x'), dev.pub, dev.auth);
  assert.notDeepEqual([...a.slice(0, 16)], [...b.slice(0, 16)]);
  assert.notDeepEqual([...a.slice(21, 86)], [...b.slice(21, 86)]);
});

test('chiffrement : un autre appareil ne peut pas lire le message', async () => {
  const dev = makeDevice(), other = makeDevice();
  const body = await encryptPayload(enc.encode('secret'), dev.pub, dev.auth);
  assert.throws(() => decryptAsDevice(body, other));
});

test('chiffrement : arabe et émojis passent intacts (UTF-8)', async () => {
  const dev = makeDevice();
  const text = JSON.stringify({ t: 'تم الإرسال', b: 'تم إرسال 5.400 OMR ✓' });
  assert.equal(dec.decode(decryptAsDevice(await encryptPayload(enc.encode(text), dev.pub, dev.auth), dev)), text);
});

test('chiffrement : clés invalides ou contenu trop gros refusés', async () => {
  const dev = makeDevice();
  await assert.rejects(encryptPayload(enc.encode('x'), new Uint8Array(64), dev.auth), /bad_p256dh/);
  await assert.rejects(encryptPayload(enc.encode('x'), dev.pub, new Uint8Array(8)), /bad_auth/);
  await assert.rejects(encryptPayload(new Uint8Array(4000), dev.pub, dev.auth), /payload_too_large/);
  const max = new Uint8Array(3993).fill(97);
  assert.equal(decryptAsDevice(await encryptPayload(max, dev.pub, dev.auth), dev).length, 3993);   /* la limite exacte passe */
});

test('VAPID : clé publique de 65 octets ; JWT ES256 vérifiable avec cette clé ; audience = origine du service de push', async () => {
  const keys = await generateVapidKeys();
  assert.equal(b64uDecode(keys.publicKey).length, 65);
  assert.equal(keys.privateJwk.crv, 'P-256');
  const now = 1_800_000_000;
  const h = await vapidAuthorization('https://web.push.apple.com/abcDEF123/xyz?x=1', keys, 'https://yor-wallet.netlify.app', now);
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  assert.ok(m, h);
  assert.equal(m[4], keys.publicKey);
  assert.deepEqual(JSON.parse(dec.decode(b64uDecode(m[1]))), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(dec.decode(b64uDecode(m[2])));
  assert.deepEqual(claims, { aud: 'https://web.push.apple.com', exp: now + 43200, sub: 'https://yor-wallet.netlify.app' });
  assert.ok(claims.exp - now < 86400, 'la norme impose moins de 24 h');
  /* vérification de la signature avec node:crypto (format r||s) */
  const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.privateJwk.x, y: keys.privateJwk.y }, format: 'jwk' });
  const v = createVerify('SHA256'); v.update(m[1] + '.' + m[2]);
  assert.equal(v.verify({ key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64uDecode(m[3]))), true);
  const bad = createVerify('SHA256'); bad.update(m[1] + '.' + m[2] + 'x');
  assert.equal(bad.verify({ key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64uDecode(m[3]))), false);
  assert.equal(b64uDecode(m[3]).length, 64);
});

test('VAPID : un service de push en http (non sécurisé) est refusé', async () => {
  assert.throws(() => audienceOf('http://push.example/abc'), /endpoint_not_https/);
  assert.equal(audienceOf('https://fcm.googleapis.com/fcm/send/abc'), 'https://fcm.googleapis.com');
});

test('sendPush : en-têtes exacts (VAPID, aes128gcm, TTL, Urgency) et corps déchiffrable', async () => {
  const dev = makeDevice(), keys = await generateVapidKeys();
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
  const sub = { endpoint: 'https://web.push.apple.com/AbC123', p256dh: b64uEncode(dev.pub), auth: b64uEncode(dev.auth) };
  const r = await sendPush(sub, { title: 'Hello', n: 1 }, keys, 'https://yor-wallet.netlify.app', { fetchFn });
  assert.deepEqual({ ok: r.ok, gone: r.gone, status: r.status }, { ok: true, gone: false, status: 201 });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, sub.endpoint); assert.equal(init.method, 'POST');
  assert.match(init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(init.headers.TTL, '86400'); assert.equal(init.headers.Urgency, 'high');
  assert.deepEqual(JSON.parse(dec.decode(decryptAsDevice(init.body, dev))), { title: 'Hello', n: 1 });
});

test('sendPush : 410 / 404 = appareil disparu (à supprimer) ; 403 = erreur définitive sans nouvelle tentative', async () => {
  const dev = makeDevice(), keys = await generateVapidKeys();
  const sub = { endpoint: 'https://web.push.apple.com/AbC123', p256dh: b64uEncode(dev.pub), auth: b64uEncode(dev.auth) };
  for (const [status, gone] of [[410, true], [404, true], [403, false], [400, false]]) {
    let n = 0;
    const r = await sendPush(sub, { a: 1 }, keys, 's', { fetchFn: async () => { n++; return new Response(null, { status }); }, sleep: async () => {} });
    assert.deepEqual({ ok: r.ok, gone: r.gone, status: r.status, n }, { ok: false, gone, status, n: 1 }, String(status));
  }
});

test('sendPush : 503 puis 201 = une seule nouvelle tentative, qui réussit ; réseau coupé = status 0', async () => {
  const dev = makeDevice(), keys = await generateVapidKeys();
  const sub = { endpoint: 'https://web.push.apple.com/AbC123', p256dh: b64uEncode(dev.pub), auth: b64uEncode(dev.auth) };
  const seq = [503, 201]; let n = 0;
  const r = await sendPush(sub, { a: 1 }, keys, 's', { fetchFn: async () => new Response(null, { status: seq[n++] }), sleep: async () => {} });
  assert.deepEqual({ ok: r.ok, status: r.status, n }, { ok: true, status: 201, n: 2 });
  let m = 0;
  const down = await sendPush(sub, { a: 1 }, keys, 's', { fetchFn: async () => { m++; throw new Error('network'); }, sleep: async () => {} });
  assert.deepEqual({ ok: down.ok, status: down.status, m }, { ok: false, status: 0, m: 2 });
  const rl = await sendPush(sub, { a: 1 }, keys, 's', { fetchFn: async () => new Response(null, { status: 429, headers: { 'retry-after': '30' } }), sleep: async () => {}, retries: 0 });
  assert.equal(rl.retryAfterSec, 30);
});

test('montants : rial omanais à 3 décimales, autres devises à 2 ; rien d\'inventé si le montant manque', () => {
  assert.equal(fmtAmount(12, 'OMR'), '12.000 OMR');
  assert.equal(fmtAmount(5.4, 'omr'), '5.400 OMR');
  assert.equal(fmtAmount(1400, 'USD'), '1400.00 USD');
  assert.equal(fmtAmount('abc', 'OMR'), '');
  assert.equal(fmtAmount(undefined, 'OMR'), '');
});

test('numéro sur l\'écran verrouillé : indicatif + 4 derniers chiffres seulement', () => {
  const B = '••••';
  assert.equal(maskPhone('+968 77986533'), '+968 ' + B + '6533');
  assert.equal(maskPhone('95350127'), B + '0127');
  assert.equal(maskPhone('+96877986533'), B + '6533');         /* indicatif collé au numéro : jamais deviné */
  assert.equal(maskPhone('123'), '');
  assert.equal(maskPhone(null), '');
  assert.doesNotMatch(maskPhone('+968 77986533'), /7798/);
});

const SENT = { id: 'aaaaaaaa-0000-4000-8000-000000000001', type: 'TRANSFER_SENT', title: 'Transfer sent', message: '1.000 OMR to +968 77986533', data: { to: '+968 77986533', amount: 1, currency: 'OMR', reference: 'YOR-TX-20261017-4CBBF2' } };
const RECV = { id: 'aaaaaaaa-0000-4000-8000-000000000002', type: 'TRANSFER_RECEIVED', title: 'Money received', message: 'You received 20 OMR from Damys Toure', data: { from: 'Damys Toure', amount: 20, currency: 'OMR', reference: 'YOR-TX-20261012-7430B7' } };
const DEP = { id: 'aaaaaaaa-0000-4000-8000-000000000003', type: 'DEPOSIT', title: 'Money received', message: 'You received 10000 OMR from YOR WALLET', data: { from: 'YOR WALLET', amount: 10000, currency: 'OMR', reference: 'YOR-TX-20261013-980FD8' } };

test('texte : transfert envoyé en anglais, français et arabe', () => {
  assert.deepEqual(
    (({ title, body }) => ({ title, body }))(buildPushMessage(SENT, 'en', 2)),
    { title: 'Money sent', body: '1.000 OMR sent to +968 ••••6533' });
  assert.deepEqual(
    (({ title, body }) => ({ title, body }))(buildPushMessage(SENT, 'fr', 2)),
    { title: 'Transfert envoyé', body: '1.000 OMR envoyés au +968 ••••6533' });
  const ar = buildPushMessage(SENT, 'ar', 2);
  assert.equal(ar.title, 'تم الإرسال'); assert.equal(ar.dir, 'rtl'); assert.equal(ar.lang, 'ar');
  assert.match(ar.body, /^تم إرسال ⁦\d\.\d{3} OMR⁩ إلى ⁦\+968 •{4}6533⁩$/);
});

test('texte : argent reçu (nom de l\'expéditeur) et dépôt (jamais d\'ancien nom de marque)', () => {
  assert.equal(buildPushMessage(RECV, 'fr').body, '20.000 OMR reçus de Damys Toure');
  assert.equal(buildPushMessage(RECV, 'en').title, 'Money received');
  const d = buildPushMessage(DEP, 'en');
  assert.equal(d.body, '10000.000 OMR added to your account');
  assert.doesNotMatch(JSON.stringify(d), /YOR|NEX/i);
  assert.doesNotMatch(JSON.stringify(buildPushMessage(SENT, 'en')), /YOR/);   /* la référence interne n'est pas affichée */
});

test('texte : marque, étiquette (remplace l\'ancienne), lien, pastille, direction', () => {
  const m = buildPushMessage(SENT, 'en', 150);
  assert.equal(m.tag, 'fp-' + SENT.id); assert.equal(m.url, '#/notifications'); assert.equal(m.badge, 99); assert.equal(m.dir, 'ltr'); assert.equal(m.kind, 'TRANSFER_SENT');
  assert.equal(buildPushMessage(SENT, 'en', -3).badge, 0);
  assert.equal(buildPushMessage(SENT, 'en', 'x').badge, 0);
  assert.ok(Math.abs(m.ts - Date.now()) < 5000);
});

test('texte : sans montant, on retombe sur le texte de la base ; destinataire inconnu = message sans destinataire', () => {
  const noAmt = buildPushMessage({ id: 'x', type: 'TRANSFER_SENT', message: 'Something sent', data: {} }, 'en');
  assert.equal(noAmt.body, 'Something sent');
  const noTo = buildPushMessage({ id: 'x', type: 'TRANSFER_SENT', data: { amount: 3, currency: 'OMR' } }, 'fr');
  assert.equal(noTo.body, '3.000 OMR envoyés');
  assert.equal(buildPushMessage({ id: 'x', type: 'TRANSFER_RECEIVED', data: { amount: 3, currency: 'OMR' } }, 'en').body, '3.000 OMR received');
});

test('seul l\'argent est notifié : la crypto (masquée dans l\'application) n\'est jamais poussée', () => {
  assert.deepEqual([...PUSH_TYPES], ['TRANSFER_SENT', 'TRANSFER_RECEIVED', 'DEPOSIT']);
  for (const type of ['CRYPTO_BUY', 'CRYPTO_SENT', 'CRYPTO_SWAP', 'CRYPTO_SELL', 'WHATEVER', '']) assert.equal(buildPushMessage({ id: 'x', type, data: { amount: 1, currency: 'OMR' } }, 'en'), null, type);
});

test('texte : caractères de contrôle et textes trop longs nettoyés (le nom vient d\'un autre utilisateur)', () => {
  const m = buildPushMessage({ id: 'x', type: 'TRANSFER_RECEIVED', data: { from: 'Eve\n\u0007' + 'z'.repeat(200), amount: 1, currency: 'OMR' } }, 'en');
  assert.doesNotMatch(m.body, /[\u0000-\u001f]/);
  assert.ok(m.body.length <= 160 && m.title.length <= 60);
});

test('message de test : une phrase par langue, lien vers les Réglages', () => {
  assert.equal(buildTestMessage('fr').title, 'Notifications activées');
  assert.equal(buildTestMessage('en').title, 'Notifications are on');
  assert.equal(buildTestMessage('ar').dir, 'rtl');
  assert.equal(buildTestMessage('en').url, '#/settings'); assert.equal(buildTestMessage('en').kind, 'TEST');
});

test('abonnement valide : https, clé de 65 octets, secret d\'au moins 16 octets', () => {
  const dev = makeDevice();
  const ok = { endpoint: 'https://web.push.apple.com/x', p256dh: b64uEncode(dev.pub), auth: b64uEncode(dev.auth) };
  assert.equal(validSub(ok), true);
  assert.equal(validSub({ ...ok, endpoint: 'http://x/y' }), false);
  assert.equal(validSub({ ...ok, p256dh: 'AAAA' }), false);
  assert.equal(validSub({ ...ok, auth: 'AA' }), false);
  assert.equal(validSub(null), false);
});

test('comparaison du jeton interne à durée constante', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test('services de push : seuls Apple, Google (FCM), Firefox et Edge sont acceptés ; les adresses qui leur ressemblent ou qui visent l\'intérieur sont refusées', () => {
  for (const h of ['web.push.apple.com', 'api.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns2-par02p.notify.windows.com', 'WEB.PUSH.APPLE.COM']) assert.equal(isPushServiceHost(h), true, h);
  for (const h of ['web.push.apple.com.evil.example', 'evilpush.apple.com', 'apple.com', 'googleapis.com', 'x.fcm.googleapis.com', 'fcm.googleapis.com.evil.example',
    'localhost', '127.0.0.1', '169.254.169.254', 'gebjmguoauvutiqvoswl.supabase.co', 'internal', '', 'notify.windows.com.evil.example']) assert.equal(isPushServiceHost(h), false, h);
});

const GOOD = () => { const d = makeDevice(); return { endpoint: 'https://web.push.apple.com/AbC123def', keys: { p256dh: b64uEncode(d.pub), auth: b64uEncode(d.auth) } }; };

test('abonnement envoyé par l\'application : forme toJSON() ou à plat acceptée, valeurs nettoyées', () => {
  const g = GOOD();
  const v = validateSubscription(g, 'Mozilla/5.0 (iPhone)\n\u0007' + 'x'.repeat(400));
  assert.equal(v.endpoint, g.endpoint); assert.equal(v.p256dh, g.keys.p256dh); assert.equal(v.auth, g.keys.auth);
  assert.ok(v.userAgent.length <= 300); assert.doesNotMatch(v.userAgent, /[\u0000-\u001f]/);
  const flat = validateSubscription({ endpoint: g.endpoint, p256dh: g.keys.p256dh, auth: g.keys.auth });
  assert.equal(flat.p256dh, g.keys.p256dh); assert.equal(flat.userAgent, '');
});

test('abonnement refusé : http, hôte inconnu, identifiants/port dans l\'adresse, espaces, trop long, clés de mauvaise taille ou mal formées', () => {
  const g = GOOD();
  const bad = (endpoint, keys, re) => assert.throws(() => validateSubscription({ endpoint: endpoint ?? g.endpoint, keys: { ...g.keys, ...(keys || {}) } }), re);
  bad('http://web.push.apple.com/x', null, /invalid_endpoint/);
  bad('https://evil.example/x', null, /invalid_endpoint_host/);
  bad('https://web.push.apple.com@evil.example/x', null, /invalid_endpoint/);       /* « utilisateur@hôte » : refusé (identifiants dans l'adresse) */
  bad('https://user:pw@web.push.apple.com/x', null, /invalid_endpoint/);
  bad('https://web.push.apple.com:8443/x', null, /invalid_endpoint/);
  bad('https://web.push.apple.com/a b', null, /invalid_endpoint/);
  bad('https://web.push.apple.com/' + 'a'.repeat(1000), null, /invalid_endpoint/);
  bad('not a url', null, /invalid_endpoint/);
  bad(null, { p256dh: 'AAAA' }, /invalid_key/);
  bad(null, { p256dh: b64uEncode(new Uint8Array(65).fill(3)) }, /invalid_key/);          /* 65 octets mais pas une clé non compressée (0x04) */
  bad(null, { p256dh: g.keys.p256dh.slice(0, 80) + '+++++++' }, /invalid_key/);
  bad(null, { auth: 'AA' }, /invalid_auth/);
  bad(null, { auth: 'a'.repeat(22) + '!' }, /invalid_auth/);
  assert.throws(() => validateSubscription(null), /invalid_endpoint/);
});

test('abonnement lu en base : un hôte non autorisé n\'est plus jamais appelé', () => {
  const g = GOOD();
  assert.equal(validSub({ endpoint: g.endpoint, p256dh: g.keys.p256dh, auth: g.keys.auth }), true);
  assert.equal(validSub({ endpoint: 'https://evil.example/x', p256dh: g.keys.p256dh, auth: g.keys.auth }), false);
  assert.equal(validSub({ endpoint: 'https://169.254.169.254/latest', p256dh: g.keys.p256dh, auth: g.keys.auth }), false);
});
