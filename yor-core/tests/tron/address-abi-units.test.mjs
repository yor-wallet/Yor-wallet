import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hex41ToBase58, base58ToHex41, isValidTronAddress, addressToAbiWord, ZERO_ADDRESS } from '../../src/services/blockchain/address.mjs';
import { encodeUint256, decodeUint256, decodeString, hexToText, AbiError } from '../../src/services/blockchain/abi.mjs';
import { formatUnits, parseUnits, groupThousands, UnitsError } from '../../src/services/blockchain/units.mjs';
import { TEST_BALANCE, testBalanceFor } from '../../src/services/blockchain/test-balance.mjs';
import { loadConfig } from '../../src/services/blockchain/config.mjs';

/* ---------- adresses ---------- */
test('vecteurs publics connus : adresse nulle et USDT Tether mainnet (vecteur de codec uniquement)', () => {
  assert.equal(ZERO_ADDRESS, 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');
  assert.equal(base58ToHex41('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'), '41' + '00'.repeat(20));
  assert.equal(base58ToHex41('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'), '41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.equal(hex41ToBase58('41a614f803b6fd780986a42c78ec9c7f77e6ded13c'), 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
});

test('aller-retour sur 300 adresses aléatoires ; 34 caractères commençant par T', () => {
  for (let i = 0; i < 300; i++){
    const hex = '41' + randomBytes(20).toString('hex');
    const b58 = hex41ToBase58(hex);
    assert.equal(b58.length, 34);
    assert.equal(b58[0], 'T');
    assert.equal(base58ToHex41(b58), hex);
    assert.ok(isValidTronAddress(b58));
  }
});

test('toute altération d\'un caractère invalide la somme de contrôle', () => {
  const a = hex41ToBase58('41' + '5a'.repeat(20));
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (let i = 1; i < a.length; i++){
    const alt = ALPHA[(ALPHA.indexOf(a[i]) + 1) % 58];
    assert.equal(isValidTronAddress(a.slice(0, i) + alt + a.slice(i + 1)), false, 'position ' + i);
  }
});

test('entrées invalides refusées', () => {
  for (const bad of ['', null, undefined, 42, 'T', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6', '0x' + 'ab'.repeat(20), 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6O'])
    assert.equal(isValidTronAddress(bad), false, String(bad));
  assert.throws(() => hex41ToBase58('42' + '00'.repeat(20)));
  assert.throws(() => hex41ToBase58('41' + '00'.repeat(19)));
});

test('mot ABI d\'adresse : 24 zéros + 40 hex = 64 caractères', () => {
  const w = addressToAbiWord('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(w, '0'.repeat(24) + 'a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.equal(w.length, 64);
});

/* ---------- ABI ---------- */
test('uint256 : encodage/décodage, bornes', () => {
  assert.equal(encodeUint256(1870000000000n), BigInt(1870000000000n).toString(16).padStart(64, '0'));
  assert.equal(decodeUint256(encodeUint256(1870000000000n)), 1870000000000n);
  assert.equal(decodeUint256('0x' + encodeUint256(7)), 7n);
  assert.equal(decodeUint256(encodeUint256(1) + encodeUint256(2), 1), 2n);
  assert.throws(() => encodeUint256(-1n), AbiError);
  assert.throws(() => encodeUint256(1n << 256n), AbiError);
  assert.equal(decodeUint256(encodeUint256((1n << 256n) - 1n)), (1n << 256n) - 1n);
  assert.throws(() => decodeUint256('abcd'), AbiError);
  assert.throws(() => decodeUint256('zz'), AbiError);
  assert.throws(() => decodeUint256(null), AbiError);
});

test('string ABI : décodage et protections de bornes', () => {
  const s = 'YOR Experimental USDT';
  const data = Buffer.from(s).toString('hex').padEnd(64, '0');
  assert.equal(decodeString(encodeUint256(32) + encodeUint256(s.length) + data), s);
  assert.throws(() => decodeString(encodeUint256(32) + encodeUint256(500)), AbiError);          /* données tronquées */
  assert.throws(() => decodeString(encodeUint256(31) + encodeUint256(1) + '00'.repeat(32)), AbiError); /* offset non aligné */
  assert.throws(() => decodeString(encodeUint256(32) + encodeUint256(10_000_000n)), AbiError);  /* longueur absurde */
});

test('messages d\'erreur hexadécimaux décodés si ASCII', () => {
  assert.equal(hexToText(Buffer.from('REVERT opcode executed').toString('hex')), 'REVERT opcode executed');
  assert.equal(hexToText('zz'), 'zz');
  assert.equal(hexToText(''), '');
});

/* ---------- unités ---------- */
test('formatUnits / parseUnits : aller-retour exact sans flottants', () => {
  assert.equal(formatUnits(1870000000000n, 6), '1870000');
  assert.equal(formatUnits(1869950000000n, 6), '1869950');
  assert.equal(formatUnits(1500000n, 6), '1.5');
  assert.equal(formatUnits(1n, 6), '0.000001');
  assert.equal(formatUnits(0n, 6), '0');
  assert.equal(formatUnits(-2500000n, 6), '-2.5');
  assert.equal(parseUnits('1.5', 6), 1500000n);
  assert.equal(parseUnits('0.000001', 6), 1n);
  assert.equal(parseUnits('50', 6), 50000000n);
  for (const raw of [0n, 1n, 999999n, 1000000n, 123456789012345n]) assert.equal(parseUnits(formatUnits(raw, 6), 6), raw);
});

test('parseUnits refuse signes, exposants, séparateurs et trop de décimales', () => {
  for (const bad of ['', '-1', '+1', '1e6', '1,5', ' 1', '1.', '.5', '1.0000001', 'abc', '0x10'])
    assert.throws(() => parseUnits(bad, 6), UnitsError, bad);
  assert.throws(() => parseUnits(5, 6), UnitsError);
});

test('séparateur de milliers (affichage)', () => {
  assert.equal(groupThousands('1869950'), '1,869,950');
  assert.equal(groupThousands('1870000.5'), '1,870,000.5');
  assert.equal(groupThousands('-1234567'), '-1,234,567');
  assert.equal(groupThousands('12'), '12');
});

/* ---------- TEST BALANCE ---------- */
test('1 870 000 n\'existe que comme « TEST BALANCE » étiqueté, jamais sur mainnet ni en production', () => {
  assert.equal(TEST_BALANCE.label, 'TEST BALANCE');
  assert.equal(TEST_BALANCE.raw, 1_870_000_000_000n);
  assert.equal(testBalanceFor(loadConfig({ YOR_ENV: 'development' })).label, 'TEST BALANCE');
  assert.equal(testBalanceFor(loadConfig({ YOR_ENV: 'testnet', TRON_NETWORK: 'nile' })).raw, 1_870_000_000_000n);
  assert.throws(() => testBalanceFor(loadConfig({ YOR_ENV: 'production', TRON_NETWORK: 'nile' })));
  assert.throws(() => testBalanceFor(null));
});
