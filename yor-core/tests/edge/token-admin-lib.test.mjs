import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  hexToBytes, bytesToHex, base58Encode, hex41ToBase58, abiAddressWord, decodeUint, decodeAbiString, decodeHexText,
  scanOpcodes, parseFeeLimitTrx, suggestFeeLimit, checkBuiltTx, classify, parseClaim,
  base58Decode, base58ToHex41, abiUintWord, formatUnits, suggestCallFeeLimitTrx, feeLimitCoversEstimate,
  encodeTriggerRawData, checkTriggerTx
} from '../../supabase/functions/token-admin/lib.ts';

/* Logique PURE de la fonction token-admin (celle qui vérifie une transaction avant de la signer et qui décide « confirmed »).
   La cryptographie (keccak, secp256k1) n'est pas ici : elle est prouvée dans l'environnement réel par l'action `selftest`. */

const sha256 = (b) => new Uint8Array(createHash('sha256').update(b).digest());
const OWNER = '41' + '1'.repeat(40);
const INIT = 'deadbeef'.repeat(8) + abiAddressWord(OWNER);
const FEE = 945_000_000;

function goodTx(over = {}) {
  const raw = '0a02abcd' + OWNER + 'ff' + INIT + '1234';
  const txID = bytesToHex(sha256(hexToBytes(raw)));
  return {
    txID,
    contract_address: '41' + '2'.repeat(40),
    raw_data: {
      contract: [{
        type: 'CreateSmartContract',
        parameter: { value: { owner_address: OWNER, new_contract: { bytecode: INIT, consume_user_resource_percent: 100, origin_energy_limit: 10_000_000 } } }
      }],
      fee_limit: FEE,
      expiration: 1_800_000_000_000
    },
    raw_data_hex: raw,
    ...over
  };
}
const args = (tx) => ({ tx, ownerHex41: OWNER, initWithArgsHex: INIT, feeLimitSun: FEE, consumeUserResourcePercent: 100, originEnergyLimit: 10_000_000 });
const failed = (tx) => checkBuiltTx(args(tx), sha256).filter((c) => !c.ok).map((c) => c.name);

test('hex : aller-retour, entrées invalides refusées', () => {
  assert.equal(bytesToHex(hexToBytes('00ff10')), '00ff10');
  for (const bad of ['0', 'zz', '0x00', 12]) assert.throws(() => hexToBytes(bad), /bad_hex/);
});

test('base58check : vecteurs connus (USDT mainnet, clé privée 1) et refus des adresses invalides', () => {
  assert.equal(hex41ToBase58('41a614f803b6fd780986a42c78ec9c7f77e6ded13c', sha256), 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(hex41ToBase58('417e5f4552091a69125d5dfcb7b8c2659029395bdf', sha256), 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC');
  assert.equal(base58Encode(new Uint8Array([0, 0, 1])), '112');
  for (const bad of ['', '41', '42' + '0'.repeat(40), '41' + 'g'.repeat(40)]) assert.throws(() => hex41ToBase58(bad, sha256), /bad_address/);
});

test('mot ABI d\'adresse : 12 octets nuls + 20 octets, sans le préfixe 41', () => {
  assert.equal(abiAddressWord('41A614F803B6FD780986A42C78EC9C7F77E6DED13C'), '000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.throws(() => abiAddressWord('a614f803b6fd780986a42c78ec9c7f77e6ded13c'), /bad_address/);
});

test('lecture ABI : chaîne, entier, et refus des réponses mal formées', () => {
  const text = 'YOR Experimental USDT';
  const data = Buffer.from(text).toString('hex').padEnd(64, '0');
  const enc = '20'.padStart(64, '0') + text.length.toString(16).padStart(64, '0') + data;
  assert.equal(decodeAbiString(enc), text);
  assert.throws(() => decodeAbiString('00'.repeat(10)), /abi_short/);
  assert.throws(() => decodeAbiString('ff'.padStart(64, '0') + '00'.repeat(32)), /abi_bad_offset/);
  assert.throws(() => decodeAbiString('20'.padStart(64, '0') + '64'.padStart(64, '0') + '00'.repeat(32)), /abi_bad_length/);
  assert.equal(decodeUint('6'.padStart(64, '0')), 6n);
  for (const bad of ['', 'xyz', '0'.repeat(65)]) assert.throws(() => decodeUint(bad), /bad_uint/);
  assert.equal(decodeHexText(Buffer.from('SIGERROR').toString('hex')), 'SIGERROR');
  assert.equal(decodeHexText('pas de l\'hexa'), 'pas de l\'hexa');
  assert.equal(decodeHexText(undefined), '');
});

test('opcodes interdits : détectés, mais pas dans les données d\'un PUSH', () => {
  assert.deepEqual(scanOpcodes(new Uint8Array([0x5f])), [{ pc: 0, op: 'PUSH0' }]);
  assert.deepEqual(scanOpcodes(new Uint8Array([0x5e, 0x5c, 0x5d, 0x49, 0x4a])).map((h) => h.op), ['MCOPY', 'TLOAD', 'TSTORE', 'BLOBHASH', 'BLOBBASEFEE']);
  assert.deepEqual(scanOpcodes(new Uint8Array([0x61, 0x5f, 0x5f, 0x00])), [], 'PUSH2 dont les octets de données valent 0x5f');
  const push32 = new Uint8Array(34); push32[0] = 0x7f; push32.fill(0x5f, 1, 33); push32[33] = 0x5f;
  assert.deepEqual(scanOpcodes(push32), [{ pc: 33, op: 'PUSH0' }], 'seul l\'opcode après les 32 octets de données compte');
});

test('plafond de frais : aucune valeur par défaut, entier strict, borné', () => {
  for (const bad of [null, '', '0', '01', '1.5', '-1', '1e3', ' 5', '5 ', '5001', '9999999', 'abc']) assert.equal(parseFeeLimitTrx(bad, 5000), null, String(bad));
  assert.equal(parseFeeLimitTrx('1', 5000), 1);
  assert.equal(parseFeeLimitTrx('5000', 5000), 5000);
});

test('borne basse de coût : 200 énergie/octet x prix de la chaîne, plafond suggéré = borne x 1,5 arrondi au TRX supérieur', () => {
  const r = suggestFeeLimit(7496, 420);
  assert.equal(r.codeDepositEnergy, 1_499_200);
  assert.equal(r.lowerBoundSun, 629_664_000);
  assert.equal(r.suggestedTrx, 945);
  assert.equal(suggestFeeLimit(1000, 100).suggestedTrx, 30);
  for (const [b, f] of [[0, 420], [100, 0], [1.5, 420], [100, -1], [100, NaN]]) assert.throws(() => suggestFeeLimit(b, f));
});

test('transaction construite par le nœud : conforme => toutes les vérifications passent', () => {
  const checks = checkBuiltTx(args(goodTx()), sha256);
  assert.ok(checks.length >= 15);
  assert.deepEqual(checks.filter((c) => !c.ok), []);
});

test('transaction construite par le nœud : chaque altération est détectée (jamais signée)', () => {
  const cases = {
    'txID altéré': goodTx({ txID: '0'.repeat(64) }),
    'txID absent': goodTx({ txID: undefined }),
    'raw_data_hex altéré (txID inchangé)': goodTx({ raw_data_hex: '0a02abce' + OWNER + 'ff' + INIT + '1234' }),
    'propriétaire différent': (() => { const t = goodTx(); t.raw_data.contract[0].parameter.value.owner_address = '41' + '9'.repeat(40); return t; })(),
    'plafond de frais différent': (() => { const t = goodTx(); t.raw_data.fee_limit = FEE * 10; return t; })(),
    'type de contrat différent': (() => { const t = goodTx(); t.raw_data.contract[0].type = 'TransferContract'; return t; })(),
    'deux contrats': (() => { const t = goodTx(); t.raw_data.contract.push(t.raw_data.contract[0]); return t; })(),
    'consume_user_resource_percent différent': (() => { const t = goodTx(); t.raw_data.contract[0].parameter.value.new_contract.consume_user_resource_percent = 0; return t; })(),
    'origin_energy_limit différent': (() => { const t = goodTx(); t.raw_data.contract[0].parameter.value.new_contract.origin_energy_limit = 1; return t; })(),
    'call_value non nul': (() => { const t = goodTx(); t.raw_data.contract[0].parameter.value.new_contract.call_value = 5; return t; })(),
    'expiration absente': (() => { const t = goodTx(); delete t.raw_data.expiration; return t; })(),
    'adresse de contrat invalide': goodTx({ contract_address: 'T123' })
  };
  for (const [name, tx] of Object.entries(cases)) assert.ok(failed(tx).length > 0, `non détecté : ${name}`);
});

test('substitution de bytecode cohérente (txID recalculé par l\'attaquant) : détectée par le contrôle du contenu', () => {
  const evilInit = 'badc0de0'.repeat(8) + abiAddressWord(OWNER);
  const raw = '0a02abcd' + OWNER + 'ff' + evilInit + '1234';
  const tx = goodTx({ raw_data_hex: raw, txID: bytesToHex(sha256(hexToBytes(raw))) });
  const f = failed(tx);
  assert.ok(f.includes('raw_data_hex_contains_init_code_and_constructor_args'), f.join(','));
  assert.ok(!f.includes('txid_is_sha256_of_raw_data_hex'), 'le txID est cohérent : seul le contenu trahit la substitution');
});

test('états : introuvable => broadcasted, puis expired seulement après expiration + 60 s', () => {
  const exp = 1_000_000;
  assert.equal(classify({}, {}, exp, exp).state, 'broadcasted');
  assert.equal(classify({}, {}, exp, exp + 60_000).state, 'broadcasted');
  assert.equal(classify({}, {}, exp, exp + 60_001).state, 'expired');
  assert.equal(classify(undefined, undefined, null, 9e15).state, 'broadcasted', 'sans expiration connue, jamais expiré');
});

test('états : vu sur le nœud complet seulement => confirming, jamais confirmed', () => {
  const ok = { blockNumber: 10, receipt: { result: 'SUCCESS' }, contract_address: '41' + 'a'.repeat(40) };
  const r = classify(ok, {}, 1, 0);
  assert.equal(r.state, 'confirming'); assert.equal(r.solidified, false); assert.equal(r.provisionalFailure, false);
  const bad = classify({ blockNumber: 10, receipt: { result: 'OUT_OF_ENERGY' } }, {}, 1, 0);
  assert.equal(bad.state, 'confirming'); assert.equal(bad.provisionalFailure, true, 'un échec non solidifié reste provisoire');
});

test('états : confirmed exige solidification + SUCCESS + bloc > 0 + adresse de contrat', () => {
  const addr = '41' + 'AbCdEf0123'.repeat(4);
  const sol = { blockNumber: 12, receipt: { result: 'SUCCESS', energy_usage_total: 1500000, energy_fee: 600000000, net_usage: 8000 }, fee: 601000000, contract_address: addr };
  const r = classify({}, sol, 1, 0);
  assert.equal(r.state, 'confirmed'); assert.equal(r.solidified, true); assert.equal(r.contractHex41, addr.toLowerCase());
  assert.deepEqual(r.cost, { energyUsageTotal: 1500000, energyFee: 600000000, netUsage: 8000, netFee: null, feeSun: 601000000 });
  assert.equal(classify({}, { ...sol, receipt: { result: 'REVERT' } }, 1, 0).state, 'failed');
  assert.equal(classify({}, { ...sol, receipt: {} }, 1, 0).state, 'failed');
  assert.equal(classify({}, { ...sol, blockNumber: 0 }, 1, 0).state, 'broadcasted', 'bloc 0 = pas de bloc');
  assert.equal(classify({}, { ...sol, blockNumber: '12' }, 1, 0).state, 'broadcasted', 'bloc non entier = pas de bloc');
  const noAddr = classify({}, { blockNumber: 12, receipt: { result: 'SUCCESS' } }, 1, 0);
  assert.equal(noAddr.state, 'confirming'); assert.equal(noAddr.anomaly, 'success_without_contract_address');
  assert.equal(classify({}, { ...sol, contract_address: 'T123' }, 1, 0).state, 'confirming', 'adresse invalide = pas confirmé');
});

test('réservation : lecture stricte', () => {
  const claim = {
    v: 1, network: 'nile', txid: 'a'.repeat(64), deployer: 'T123', deployerHex41: '41' + 'b'.repeat(40),
    expectedContractHex41: '41' + 'c'.repeat(40), feeLimitSun: FEE, expiration: 1_800_000_000_000, status: 'claimed', contractHex41: null, at: '2026-10-08T00:00:00Z'
  };
  assert.deepEqual(parseClaim(JSON.stringify(claim)), claim);
  const mutate = (patch) => parseClaim(JSON.stringify({ ...claim, ...patch }));
  for (const patch of [{ v: 2 }, { network: 'NILE' }, { network: 3 }, { txid: 'xyz' }, { deployerHex41: 'T123' }, { feeLimitSun: 0 }, { feeLimitSun: 1.5 }, { expiration: -1 }, { status: 'done' }, { deployer: 5 }]) {
    assert.equal(mutate(patch), null, JSON.stringify(patch));
  }
  assert.equal(parseClaim('pas du json'), null);
  assert.equal(parseClaim('null'), null);
});

test('artefact compilé (cache) : lecture stricte', async () => {
  const { parseArtifact } = await import('../../supabase/functions/token-admin/lib.ts');
  const art = {
    v: 1, sourceSha256: 'a'.repeat(64), initHex: '6080', runtimeHex: '6080', abi: [{ type: 'function', name: 'name' }, { type: 'event', name: 'Transfer' }],
    abiSha256: 'b'.repeat(64), warnings: 0, warningSamples: []
  };
  assert.deepEqual(parseArtifact(JSON.stringify(art)), art);
  const mutate = (patch) => parseArtifact(JSON.stringify({ ...art, ...patch }));
  const bad = [
    { v: 2 }, { sourceSha256: 'xyz' }, { abiSha256: 'B'.repeat(64) }, { initHex: '' }, { initHex: '608' }, { initHex: '60GG' }, { runtimeHex: '0x6080' },
    { abi: [] }, { abi: 'x' }, { abi: [{ name: 'x' }] }, { abi: [null] }, { warnings: -1 }, { warnings: 1.5 }, { warningSamples: [1] }, { warningSamples: 'x' }
  ];
  for (const patch of bad) assert.equal(mutate(patch), null, JSON.stringify(patch));
  assert.equal(parseArtifact('pas du json'), null);
  assert.equal(parseArtifact('null'), null);
});

/* ------------------------------------------------------------------ appels de contrat (grant_minter, testmint) */

test('adresse publique : décodage base58check, aller-retour, refus des adresses invalides', () => {
  assert.equal(base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', sha256), '41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.equal(base58ToHex41('TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad', sha256), '419f10b9a51361d13b1b0e6ac8f2d05bd95d65393e');
  for (const hex of ['41' + '00'.repeat(20), '41' + 'ff'.repeat(20), '417e5f4552091a69125d5dfcb7b8c2659029395bdf']) {
    assert.equal(base58ToHex41(hex41ToBase58(hex, sha256), sha256), hex);
  }
  assert.deepEqual([...base58Decode('112')], [0, 0, 1]);
  assert.throws(() => base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u', sha256), /bad_checksum/, 'dernier caractère modifié');
  assert.throws(() => base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6', sha256), /bad_address/, 'trop court');
  assert.throws(() => base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tt', sha256), /bad_address/, 'trop long');
  assert.throws(() => base58ToHex41('AR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', sha256), /bad_address|bad_checksum/, 'ne commence pas par T');
  assert.throws(() => base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj0t', sha256), /bad_address/, 'caractère hors alphabet (0)');
  assert.throws(() => base58ToHex41('0x' + 'a'.repeat(40), sha256), /bad_address/, 'adresse EVM refusée');
  assert.throws(() => base58ToHex41(12345, sha256), /bad_address/);
  assert.throws(() => base58Decode(''), /bad_base58/);
});

test('entiers ABI et montants : exacts, bornés', () => {
  assert.equal(abiUintWord(0n), '0'.repeat(64));
  assert.equal(1_870_000_000_000n, 1_870_000n * 10n ** 6n, '1 870 000 jetons à 6 décimales');
  assert.equal(abiUintWord(1_870_000_000_000n), '0'.repeat(53) + '1b364af8c00', '0x1b364af8c00 = 1 870 000 000 000, calculé à la main');
  assert.equal(abiUintWord((1n << 256n) - 1n), 'f'.repeat(64));
  for (const bad of [-1n, 1n << 256n, 5, '5']) assert.throws(() => abiUintWord(bad), /bad_uint/);
  assert.equal(formatUnits(1_870_000_000_000n, 6), '1870000.000000');
  assert.equal(formatUnits(1n, 6), '0.000001');
  assert.equal(formatUnits(0n, 6), '0.000000');
  assert.equal(formatUnits(12n, 0), '12');
  assert.throws(() => formatUnits(-1n, 6), /bad_amount/);
  assert.throws(() => formatUnits(1, 6), /bad_amount/);
  assert.throws(() => formatUnits(1n, 37), /bad_decimals/);
});

test('plafond de frais d\'un appel : calculé sur l\'énergie SIMULÉE, jamais inventé', () => {
  assert.equal(suggestCallFeeLimitTrx(280_000, 100), 42, 'ceil(1,5 x 280000 x 100 / 1e6)');
  assert.equal(suggestCallFeeLimitTrx(1, 1), 1, 'minimum 1 TRX');
  for (const bad of [0, -1, 1.5, '5']) assert.throws(() => suggestCallFeeLimitTrx(bad, 100), /bad_energy$/);
  assert.throws(() => suggestCallFeeLimitTrx(10, 0), /bad_energy_fee/);
  assert.deepEqual(feeLimitCoversEstimate(34_000_000, 280_000, 100), { ok: true, minSun: 33_600_000 });
  assert.equal(feeLimitCoversEstimate(33_599_999, 280_000, 100).ok, false, 'sous 1,2 x le coût simulé');
  assert.throws(() => feeLimitCoversEstimate(0, 10, 10), /bad_fee_limit/);
  assert.throws(() => feeLimitCoversEstimate(10, 0, 10), /bad_energy/);
});

/* Vecteur protobuf assemblé À LA MAIN d'après la spécification (champs ascendants, varints), indépendamment du code testé. */
const T_OWNER = '41' + '11'.repeat(20);
const T_CONTRACT = '41' + '22'.repeat(20);
const T_DATA = 'deadbeef';
const T_URL = Buffer.from('type.googleapis.com/protocol.TriggerSmartContract').toString('hex');
const T_VALUE = '0a15' + T_OWNER + '1215' + T_CONTRACT + '2204' + T_DATA; // owner(1), contract(2), data(4)
const T_ANY = '0a31' + T_URL + '1234' + T_VALUE; // type_url (49 octets), value (52 octets)
const T_CTR = '081f' + '1269' + T_ANY; // type = 31, parameter (105 octets)
const T_RAW_HEX = '0a02abcd' + '2208' + '0102030405060708' + '40ac02' + '5a6d' + T_CTR + '70c801' + '9001e807';
const T_FEE = 1000;

function triggerRawData(over = {}, valueOver = {}) {
  return {
    ref_block_bytes: 'abcd',
    ref_block_hash: '0102030405060708',
    expiration: 300,
    timestamp: 200,
    fee_limit: T_FEE,
    contract: [{
      type: 'TriggerSmartContract',
      parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract', value: { owner_address: T_OWNER, contract_address: T_CONTRACT, data: T_DATA, ...valueOver } }
    }],
    ...over
  };
}
const triggerTx = (over = {}, valueOver = {}, rawHex = T_RAW_HEX) => ({ txID: bytesToHex(sha256(hexToBytes(rawHex))), raw_data: triggerRawData(over, valueOver), raw_data_hex: rawHex });
const triggerArgs = (tx, patch = {}) => ({ tx, ownerHex41: T_OWNER, contractHex41: T_CONTRACT, dataHex: T_DATA, feeLimitSun: T_FEE, ...patch });
const triggerFailed = (tx, patch = {}) => checkTriggerTx(triggerArgs(tx, patch), sha256).filter((c) => !c.ok).map((c) => c.name);

test('protobuf : le vecteur assemblé à la main a bien les longueurs annoncées', () => {
  assert.equal(T_VALUE.length / 2, 0x34);
  assert.equal(T_ANY.length / 2, 0x69);
  assert.equal(T_CTR.length / 2, 0x6d);
  assert.equal(Buffer.from('type.googleapis.com/protocol.TriggerSmartContract').length, 0x31);
});

test('re-encodage de raw_data : identique au vecteur de référence, et refus de toute forme inconnue', () => {
  assert.equal(encodeTriggerRawData(triggerRawData()), T_RAW_HEX);
  assert.equal(encodeTriggerRawData(triggerRawData({ extra: 1 })), null, 'champ inconnu');
  assert.equal(encodeTriggerRawData(triggerRawData({ data: '6d656d6f' })), null, 'mémo (champ data de la transaction) non géré => refus');
  assert.equal(encodeTriggerRawData(triggerRawData({ ref_block_num: 5 })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ contract: [] })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ contract: [triggerRawData().contract[0], triggerRawData().contract[0]] })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ contract: [{ ...triggerRawData().contract[0], type: 'TransferContract' }] })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ contract: [{ ...triggerRawData().contract[0], Permission_id: 2 }] })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ fee_limit: -1 })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({ expiration: 1.5 })), null);
  assert.equal(encodeTriggerRawData(triggerRawData({}, { call_token_value: 7 })) === T_RAW_HEX, false, 'un jeton attaché change les octets');
  assert.equal(encodeTriggerRawData(null), null);
  assert.equal(encodeTriggerRawData('x'), null);
});

test('appel de contrat construit par le nœud : conforme => les 17 vérifications passent', () => {
  const checks = checkTriggerTx(triggerArgs(triggerTx()), sha256);
  assert.equal(checks.length, 17);
  assert.deepEqual(checks.filter((c) => !c.ok), []);
});

test('appel de contrat : chaque altération est détectée (jamais signée)', () => {
  assert.deepEqual(triggerFailed({ ...triggerTx(), txID: 'a'.repeat(64) }), ['txid_is_sha256_of_raw_data_hex']);
  assert.ok(triggerFailed({ ...triggerTx(), txID: 'zz' }).includes('txid_format'));
  assert.ok(triggerFailed({ ...triggerTx(), raw_data_hex: '' }).includes('raw_data_hex_format'));
  assert.ok(triggerFailed(triggerTx(), { ownerHex41: '41' + '33'.repeat(20) }).includes('owner_matches'));
  assert.ok(triggerFailed(triggerTx(), { contractHex41: '41' + '33'.repeat(20) }).includes('contract_address_matches'));
  assert.ok(triggerFailed(triggerTx(), { feeLimitSun: T_FEE + 1 }).includes('fee_limit_matches'));
  assert.ok(triggerFailed(triggerTx(), { dataHex: 'cafebabe' }).includes('data_matches_selector_and_arguments'));
  assert.ok(triggerFailed(triggerTx({}, { call_value: 5 })).includes('call_value_is_zero'));
  assert.ok(triggerFailed(triggerTx({}, { call_token_value: 5 })).includes('call_token_value_is_zero'));
  assert.ok(triggerFailed(triggerTx({}, { token_id: 1000001 })).includes('token_id_is_zero'));
  assert.ok(triggerFailed(triggerTx({ expiration: 0 })).includes('expiration_present'));
  assert.ok(triggerFailed(triggerTx({ contract: [triggerRawData().contract[0], triggerRawData().contract[0]] })).includes('single_contract'));
  assert.ok(triggerFailed(triggerTx({ contract: [{ ...triggerRawData().contract[0], type: 'TransferContract' }] })).includes('type_is_trigger_smart_contract'));
  assert.ok(triggerFailed(null).length > 5, 'transaction absente');
});

test('appel de contrat : un JSON qui ne correspond pas aux octets signés est détecté', () => {
  // Le JSON annonce le bon appel, mais les octets (donc le txID, donc ce que la signature engage) portent un autre destinataire.
  const evilData = 'deadbeee';
  const evilHex = T_RAW_HEX.replace(T_DATA, evilData);
  const t1 = triggerTx({}, {}, evilHex);
  assert.ok(triggerFailed(t1).includes('raw_data_hex_equals_reencoded_raw_data'));
  assert.ok(triggerFailed(t1).includes('raw_data_hex_contains_data'));
  // Substitution cohérente (JSON, octets et txID recalculé) : détectée parce que les arguments ne sont pas ceux demandés.
  const t2 = triggerTx({}, { data: evilData }, evilHex);
  assert.deepEqual(triggerFailed(t2), ['data_matches_selector_and_arguments', 'raw_data_hex_contains_data']);
  // Même contrôle, côté contrat appelé.
  const otherContract = '41' + '99'.repeat(20);
  const hex3 = T_RAW_HEX.replace(T_CONTRACT, otherContract);
  assert.ok(triggerFailed(triggerTx({}, { contract_address: otherContract }, hex3)).includes('contract_address_matches'));
  assert.ok(triggerFailed(triggerTx({}, {}, hex3)).includes('raw_data_hex_contains_contract'));
});

test('états d\'un appel : confirmed sans adresse de contrat si requireContractAddress = false', () => {
  const sol = { blockNumber: 12, receipt: { result: 'SUCCESS', energy_usage_total: 250000 }, fee: 25_000_000 };
  assert.equal(classify({}, sol, 1, 0).state, 'confirming', 'comportement du déploiement inchangé');
  const r = classify({}, sol, 1, 0, false);
  assert.equal(r.state, 'confirmed'); assert.equal(r.solidified, true); assert.equal(r.contractHex41, null);
  assert.equal(classify({}, { ...sol, receipt: { result: 'REVERT' } }, 1, 0, false).state, 'failed');
  assert.equal(classify({}, { ...sol, receipt: { result: 'OUT_OF_ENERGY' } }, 1, 0, false).state, 'failed');
  const full = classify({ blockNumber: 9, receipt: { result: 'SUCCESS' } }, {}, 1, 0, false);
  assert.equal(full.state, 'confirming', 'nœud complet seul : jamais confirmed'); assert.equal(full.solidified, false);
  assert.equal(classify({}, {}, 1_000, 1_000 + 59_999, false).state, 'broadcasted');
  assert.equal(classify({}, {}, 1_000, 1_000 + 60_001, false).state, 'expired');
});

test('réservation d\'opération : champs optionnels op / to / units lus strictement', () => {
  const claim = {
    v: 1, network: 'nile', txid: 'a'.repeat(64), deployer: 'T123', deployerHex41: '41' + 'b'.repeat(40),
    expectedContractHex41: '41' + 'c'.repeat(40), feeLimitSun: FEE, expiration: 1_800_000_000_000, status: 'broadcasted', contractHex41: null, at: '2026-10-09T00:00:00Z',
    op: 'testmint', to: '41' + 'd'.repeat(40), units: '1870000000000'
  };
  assert.deepEqual(parseClaim(JSON.stringify(claim)), claim);
  assert.deepEqual(parseClaim(JSON.stringify({ ...claim, to: null, units: null })), { ...claim, to: null, units: null });
  const mutate = (patch) => parseClaim(JSON.stringify({ ...claim, ...patch }));
  for (const patch of [{ op: 'Mint!' }, { op: 5 }, { op: '' }, { to: 'T123' }, { to: '41' + 'D'.repeat(40) }, { units: '-5' }, { units: 1870000000000 }, { units: '1.5' }, { units: '' }]) {
    assert.equal(mutate(patch), null, JSON.stringify(patch));
  }
  const { op: _o, to: _t, units: _u, ...deployClaim } = claim;
  assert.deepEqual(parseClaim(JSON.stringify(deployClaim)), deployClaim, 'une réservation de déploiement (sans ces champs) reste valide');
});
