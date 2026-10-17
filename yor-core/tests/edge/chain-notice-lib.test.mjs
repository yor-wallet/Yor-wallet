import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  TOKEN_ADDRESS, TRANSFER_SELECTOR, TRANSFER_TOPIC, base58ToHex41, hex41ToBase58, formatAmount, isTxid, normalizeEvent, normalizeLang,
  parseSentClaim, parseTransferTx, verifyConfirmation, buildChainEmail, explorerUrl
} from '../../supabase/functions/chain-notice/lib.ts';

/* Logique PURE de la fonction chain-notice (e-mail d'un envoi YOR-USDT : « sent » sans attendre la chaîne, « confirmed » seulement avec preuve). */

const sha256 = (b) => new Uint8Array(createHash('sha256').update(b).digest());
const TOKEN = base58ToHex41(TOKEN_ADDRESS, sha256);
const A = 'TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad';     // adresses valides des vecteurs du dépôt
const B = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TXID = 'ab'.repeat(32);
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const addrWord = (hex41) => '0'.repeat(24) + hex41.slice(2);

function goodTx(over = {}, value = {}) {
  return {
    txID: TXID,
    raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value: Object.assign({
      owner_address: base58ToHex41(A, sha256), contract_address: TOKEN, call_value: 0,
      data: TRANSFER_SELECTOR + addrWord(base58ToHex41(B, sha256)) + word(1_500_000)
    }, value) } }] },
    ...over
  };
}
function goodInfo(over = {}) {
  return {
    id: TXID, blockNumber: 123, receipt: { result: 'SUCCESS' },
    log: [{ address: TOKEN.slice(2), topics: [TRANSFER_TOPIC, addrWord(base58ToHex41(A, sha256)), addrWord(base58ToHex41(B, sha256))], data: word(1_500_000) }],
    ...over
  };
}

test('base58check : aller-retour sur des adresses valides, somme de contrôle fausse refusée', () => {
  assert.equal(hex41ToBase58(base58ToHex41(A, sha256), sha256), A);
  assert.equal(hex41ToBase58(base58ToHex41(B, sha256), sha256), B);
  const bad = A.slice(0, -1) + (A.endsWith('d') ? 'e' : 'd');
  assert.throws(() => base58ToHex41(bad, sha256), /bad_checksum|bad_address/);
  for (const x of ['', 'T', '0x' + '1'.repeat(40), 'A' + A.slice(1)]) assert.throws(() => base58ToHex41(x, sha256));
});

test('montant : 6 décimales et séparateur de milliers', () => {
  assert.equal(formatAmount(1_000_000_000n), '1,000.000000');
  assert.equal(formatAmount(1n), '0.000001');
  assert.equal(formatAmount(0n), '0.000000');
  assert.throws(() => formatAmount(-1n), /bad_amount/);
  assert.throws(() => formatAmount(5), /bad_amount/);
});

test('entrées : txid, événement, langue', () => {
  assert.equal(isTxid(TXID), true);
  for (const x of ['', 'zz'.repeat(32), TXID.slice(1), TXID + 'a', null, 12]) assert.equal(isTxid(x), false);
  assert.equal(normalizeEvent('sent'), 'sent');
  assert.equal(normalizeEvent('confirmed'), 'confirmed');
  for (const x of ['SENT', 'received', '', null, undefined]) assert.equal(normalizeEvent(x), null);
  assert.equal(normalizeLang('fr-FR'), 'fr'); assert.equal(normalizeLang('AR'), 'ar'); assert.equal(normalizeLang('de'), 'en'); assert.equal(normalizeLang(undefined), 'en');
});

test('« sent » sans la chaîne : détails annoncés acceptés seulement s\'ils sont valides (adresse quelconque, montant entier > 0)', () => {
  const ok = parseSentClaim({ from: A, to: B, amount: '1000000000' }, sha256);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amountRaw, 1_000_000_000n);
  assert.equal(hex41ToBase58(ok.value.fromHex41, sha256), A);
  assert.equal(hex41ToBase58(ok.value.toHex41, sha256), B);
  // n'importe quelle adresse TRON valide est acceptée, y compris le jeton lui-même ou la même adresse des deux côtés
  assert.equal(parseSentClaim({ from: A, to: A, amount: '1' }, sha256).ok, true);
  assert.equal(parseSentClaim({ from: A, to: TOKEN_ADDRESS, amount: '1' }, sha256).ok, true);
  const bad = (c) => parseSentClaim(c, sha256);
  assert.equal(bad(null).reason, 'missing_details');
  assert.equal(bad(undefined).reason, 'missing_details');
  assert.equal(bad({ from: A, amount: '1' }).reason, 'invalid_address');
  assert.equal(bad({ from: 'TTwCMjPHQGJ4fMswfUYvqQ', to: B, amount: '1' }).reason, 'invalid_address', 'adresse tronquée');
  assert.equal(bad({ from: A, to: A.slice(0, -1) + (A.endsWith('d') ? 'e' : 'd'), amount: '1' }).reason, 'invalid_address', 'somme de contrôle fausse');
  for (const amount of [undefined, '', '0', '000', '-5', '1.5', '1e6', '0x10', ' 5', '9'.repeat(31), 5, null])
    assert.equal(bad({ from: A, to: B, amount }).reason, 'invalid_amount', 'montant ' + String(amount));
});

test('lecture d\'un transfert : seulement transfer(address,uint256) du jeton YOR, sans valeur native', () => {
  const ok = parseTransferTx(goodTx(), TXID, TOKEN);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amountRaw, 1_500_000n);
  assert.equal(hex41ToBase58(ok.value.fromHex41, sha256), A);
  assert.equal(hex41ToBase58(ok.value.toHex41, sha256), B);
  assert.equal(parseTransferTx({}, TXID, TOKEN).reason, 'tx_not_found');
  assert.equal(parseTransferTx(null, TXID, TOKEN).reason, 'tx_not_found');
  assert.equal(parseTransferTx(goodTx({ txID: 'cd'.repeat(32) }), TXID, TOKEN).reason, 'txid_mismatch');
  assert.equal(parseTransferTx(goodTx({}, { contract_address: '41' + '22'.repeat(20) }), TXID, TOKEN).reason, 'not_the_yor_token');
  assert.equal(parseTransferTx(goodTx({}, { call_value: 1 }), TXID, TOKEN).reason, 'native_value_attached');
  assert.equal(parseTransferTx(goodTx({}, { data: '095ea7b3' + addrWord(TOKEN) + word(1) }), TXID, TOKEN).reason, 'not_a_transfer', 'approve n\'est pas un transfert');
  assert.equal(parseTransferTx(goodTx({}, { data: TRANSFER_SELECTOR + 'ff'.repeat(32) + word(1) }), TXID, TOKEN).reason, 'bad_recipient_word');
  assert.equal(parseTransferTx(goodTx({ raw_data: { contract: [] } }), TXID, TOKEN).reason, 'not_a_single_contract_call');
});

test('« confirmed » : preuve complète exigée (bloc > 0, receipt SUCCESS, événement Transfer exact)', () => {
  const p = parseTransferTx(goodTx(), TXID, TOKEN).value;
  assert.deepEqual(verifyConfirmation(goodInfo(), p, TXID, TOKEN), { ok: true, blockNumber: 123 });
  const no = (info) => verifyConfirmation(info, p, TXID, TOKEN);
  assert.equal(no({}).reason, 'not_solidified_yet');
  assert.equal(no(null).reason, 'not_solidified_yet');
  assert.equal(no(goodInfo({ id: 'cd'.repeat(32) })).reason, 'txid_mismatch');
  assert.equal(no(goodInfo({ blockNumber: 0 })).reason, 'no_block');
  assert.equal(no(goodInfo({ blockNumber: undefined })).reason, 'no_block');
  assert.equal(no(goodInfo({ receipt: { result: 'REVERT' } })).reason, 'receipt_revert');
  assert.equal(no(goodInfo({ receipt: {} })).reason, 'no_receipt');
  assert.equal(no(goodInfo({ log: [] })).reason, 'transfer_event_not_found');
  const wrongAmount = goodInfo(); wrongAmount.log[0].data = word(1);
  assert.equal(no(wrongAmount).reason, 'transfer_event_not_found');
  const otherToken = goodInfo(); otherToken.log[0].address = '22'.repeat(20);
  assert.equal(no(otherToken).reason, 'transfer_event_not_found');
});

test('e-mail « sent » : dit « pas encore confirmé », jamais « confirmé » (EN / FR / AR)', () => {
  for (const lang of ['en', 'fr', 'ar']) {
    const m = buildChainEmail({ event: 'sent', lang, amountRaw: 1_000_000_000n, from: A, to: B, txid: TXID });
    assert.match(m.subject, /1,000\.000000 YOR-USDT/);
    assert.ok(m.html.includes(A) && m.html.includes(B) && m.html.includes(TXID), lang);
    assert.ok(m.text.includes(explorerUrl(TXID)), lang);
  }
  const en = buildChainEmail({ event: 'sent', lang: 'en', amountRaw: 5n, from: A, to: B, txid: TXID });
  assert.match(en.text, /NOT confirmed yet/);
  assert.doesNotMatch(en.subject, /confirmed/i);
  assert.doesNotMatch(en.text, /Block/);
  const fr = buildChainEmail({ event: 'sent', lang: 'fr', amountRaw: 5n, from: A, to: B, txid: TXID });
  assert.match(fr.text, /PAS encore confirmé/);
  assert.doesNotMatch(fr.subject, /confirmé/i);
  const ar = buildChainEmail({ event: 'sent', lang: 'ar', amountRaw: 5n, from: A, to: B, txid: TXID });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.text, /لم يتم تأكيده بعد/);
});

test('e-mail « confirmed » : bloc affiché, mention « jeton de test, pas Tether » dans les trois langues', () => {
  const en = buildChainEmail({ event: 'confirmed', lang: 'en', amountRaw: 2_000_000n, from: A, to: B, txid: TXID, blockNumber: 777 });
  assert.match(en.subject, /Transfer confirmed: 2\.000000 YOR-USDT/);
  assert.match(en.text, /Block: 777/);
  for (const lang of ['en', 'fr', 'ar']) {
    const m = buildChainEmail({ event: 'sent', lang, amountRaw: 1n, from: A, to: B, txid: TXID });
    assert.match(m.text, /Tether/);
    assert.match(m.html, /https:\/\/nile\.tronscan\.org\/#\/transaction\//);
  }
});

test('e-mail : aucune injection HTML par une valeur', () => {
  const m = buildChainEmail({ event: 'sent', lang: 'en', amountRaw: 1n, from: '<script>x</script>', to: B, txid: TXID });
  assert.ok(!m.html.includes('<script>x'));
  assert.ok(m.html.includes('&lt;script&gt;'));
});

test('12.9.0 : e-mail crypto à l\'enseigne Friendly Pay (en-tête turquoise) ; le jeton de TEST garde son vrai nom YOR-USDT et reste « pas Tether »', () => {
  for (const lang of ['en', 'fr', 'ar']) for (const event of ['sent', 'confirmed']) {
    const m = buildChainEmail({ event, lang, amountRaw: 5_000_000n, from: A, to: B, txid: TXID, blockNumber: 7 });
    assert.match(m.html, />Friendly Pay</, lang + event);
    assert.match(m.html, /background:#0B7F75/, lang + event);
    assert.doesNotMatch(m.html + m.subject + m.text, /NEX WALLET|YOR WALLET|#4c2fd1/i, lang + event);
    assert.match(m.subject, /YOR-USDT/, lang + event);
    assert.match(m.text, /YOR Experimental USDT/, lang + event);
    assert.match(m.text, /Tether/, lang + event);
  }
});
