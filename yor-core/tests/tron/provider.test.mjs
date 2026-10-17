import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TronProvider, TronError, classifyTransactionInfo, API_KEY_HEADER } from '../../src/services/blockchain/provider.mjs';
import { loadConfig } from '../../src/services/blockchain/config.mjs';
import { addressToAbiWord } from '../../src/services/blockchain/address.mjs';
import { encodeUint256, hexToText } from '../../src/services/blockchain/abi.mjs';
import { hasConfirmationEvidence } from '../../src/services/blockchain/transfer-state.mjs';
import { mockFetch, uintResult, stringResult, ADDR_A, ADDR_B, CONTRACT, TXID } from './helpers.mjs';

const cfg = (extra = {}) => loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: CONTRACT, ...extra });
const codeOf = async p => { try { await p; } catch (e){ return e instanceof TronError ? e.code : 'OTHER:' + e.message; } return null; };

test('contrat non déployé : TOKEN_NOT_DEPLOYED, et AUCUN appel réseau, aucun solde inventé', async () => {
  const f = mockFetch(() => ({ json: uintResult(1870000000000n) }));
  const p = new TronProvider(loadConfig({}), { fetch: f });
  assert.equal(await codeOf(p.balanceOf(ADDR_A)), 'TOKEN_NOT_DEPLOYED');
  assert.equal(await codeOf(p.availableBalanceOf(ADDR_A)), 'TOKEN_NOT_DEPLOYED');
  assert.equal(await codeOf(p.totalSupply()), 'TOKEN_NOT_DEPLOYED');
  assert.equal(await codeOf(p.tokenInfo()), 'TOKEN_NOT_DEPLOYED');
  assert.equal(await codeOf(p.buildTransferTx({ from: ADDR_A, to: ADDR_B, amountRaw: 1n })), 'TOKEN_NOT_DEPLOYED');
  assert.equal(f.calls.length, 0);
});

test('balanceOf : forme exacte de la requête et décodage du solde lu sur la chaîne', async () => {
  const f = mockFetch(() => ({ json: uintResult(1869950000000n) }));
  const p = new TronProvider(cfg(), { fetch: f });
  assert.equal(await p.balanceOf(ADDR_A), 1869950000000n);
  const c = f.calls[0];
  assert.equal(c.url, 'https://api.shasta.trongrid.io/wallet/triggerconstantcontract');
  assert.equal(c.method, 'POST');
  assert.deepEqual(c.body, { owner_address: ADDR_A, contract_address: CONTRACT, function_selector: 'balanceOf(address)', parameter: addressToAbiWord(ADDR_A), visible: true });
  assert.equal(c.headers[API_KEY_HEADER], undefined);
});

test('en-tête de clé API envoyé seulement quand elle est configurée', async () => {
  const f = mockFetch(() => ({ json: uintResult(0n) }));
  await new TronProvider(cfg({ TRONGRID_API_KEY: 'k-123' }), { fetch: f }).balanceOf(ADDR_A);
  assert.equal(f.calls[0].headers['TRON-PRO-API-KEY'], 'k-123');
});

test('réseau nile : bonne URL de base', async () => {
  const f = mockFetch(() => ({ json: uintResult(0n) }));
  await new TronProvider(cfg({ TRON_NETWORK: 'nile' }), { fetch: f }).balanceOf(ADDR_A);
  assert.ok(f.calls[0].url.startsWith('https://nile.trongrid.io/wallet/'));
});

test('availableBalanceOf, expiredBalanceOf, totalSupply : bons sélecteurs', async () => {
  const f = mockFetch(() => ({ json: uintResult(5n) }));
  const p = new TronProvider(cfg(), { fetch: f });
  assert.equal(await p.availableBalanceOf(ADDR_A), 5n);
  assert.equal(await p.expiredBalanceOf(ADDR_A), 5n);
  assert.equal(await p.totalSupply(), 5n);
  assert.deepEqual(f.calls.map(c => c.body.function_selector), ['availableBalanceOf(address)', 'expiredBalanceOf(address)', 'totalSupply()']);
  assert.equal(f.calls[2].body.parameter, '');
});

test('tokenInfo : accepte le bon jeton, refuse un autre contrat (ex. un vrai Tether)', async () => {
  const mk = (name, symbol, dec) => mockFetch(({ body }) => {
    if (body.function_selector === 'name()') return { json: stringResult(name) };
    if (body.function_selector === 'symbol()') return { json: stringResult(symbol) };
    return { json: uintResult(dec) };
  });
  assert.deepEqual(await new TronProvider(cfg(), { fetch: mk('YOR Experimental USDT', 'YOR-USDT', 6) }).tokenInfo(),
    { name: 'YOR Experimental USDT', symbol: 'YOR-USDT', decimals: 6 });
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mk('Tether USD', 'USDT', 6) }).tokenInfo()), 'TOKEN_METADATA_MISMATCH');
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mk('YOR Experimental USDT', 'YOR-USDT', 18) }).tokenInfo()), 'TOKEN_METADATA_MISMATCH');
});

test('adresse invalide : refusée avant tout appel réseau', async () => {
  const f = mockFetch(() => ({ json: uintResult(1n) }));
  const p = new TronProvider(cfg(), { fetch: f });
  assert.equal(await codeOf(p.balanceOf('TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')), 'INVALID_ADDRESS');
  assert.equal(f.calls.length, 0);
});

test('erreurs réseau : HTTP, hors-ligne, JSON invalide, appel refusé, délai dépassé', async () => {
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mockFetch(() => ({ status: 500, json: {} })) }).balanceOf(ADDR_A)), 'HTTP_ERROR');
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mockFetch(() => new Error('ECONNREFUSED')) }).balanceOf(ADDR_A)), 'NETWORK_UNREACHABLE');
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mockFetch(() => ({ badJson: true })) }).balanceOf(ADDR_A)), 'BAD_RESPONSE');
  const refused = { json: { result: { result: false, message: Buffer.from('REVERT opcode executed').toString('hex') } } };
  const p = new TronProvider(cfg(), { fetch: mockFetch(() => refused) });
  try { await p.balanceOf(ADDR_A); assert.fail('should throw'); }
  catch (e){ assert.equal(e.code, 'CALL_FAILED'); assert.match(e.message, /REVERT opcode executed/); }
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: mockFetch(() => ({ json: { result: { result: true } } })) }).balanceOf(ADDR_A)), 'BAD_RESPONSE');
  const hang = mockFetch(({ signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))));
  assert.equal(await codeOf(new TronProvider(cfg(), { fetch: hang, timeoutMs: 20 }).balanceOf(ADDR_A)), 'TIMEOUT');
});

/* Réponses CAPTURÉES sur Nile et Shasta le 2026-10-08 via la fonction tron-status ?probe=1 (rejouées ici, pas inventées). */
const REAL_CONTRACT_MISSING = { result: { code: 'CONTRACT_VALIDATE_ERROR', message: 'Smart contract is not exist.' } };

test('forme RÉELLE observée : adresse sans contrat => CONTRACT_NOT_FOUND (message en texte clair)', async () => {
  const p = new TronProvider(cfg(), { fetch: mockFetch(() => ({ json: REAL_CONTRACT_MISSING })) });
  assert.equal(await codeOf(p.balanceOf(ADDR_A)), 'CONTRACT_NOT_FOUND');
  assert.equal(await codeOf(p.tokenInfo()), 'CONTRACT_NOT_FOUND');
});

test('forme RÉELLE observée : transaction inconnue => {} sur les deux nœuds => broadcasted (pas de confirmation)', async () => {
  const p = new TronProvider(cfg(), { fetch: mockFetch(() => ({ json: {} })) });
  assert.equal((await p.transactionStatus(TXID)).state, 'broadcasted');
});

test('un autre code d\'erreur du nœud reste CALL_FAILED et inclut le code', async () => {
  const other = { result: { code: 'OTHER_ERROR', message: Buffer.from('boom').toString('hex') } };
  const p = new TronProvider(cfg(), { fetch: mockFetch(() => ({ json: other })) });
  try { await p.balanceOf(ADDR_A); assert.fail('should throw'); }
  catch (e){ assert.equal(e.code, 'CALL_FAILED'); assert.match(e.message, /OTHER_ERROR boom/); }
});

test('getNowBlock', async () => {
  const f = mockFetch(() => ({ json: { block_header: { raw_data: { number: 123456, timestamp: 1700000000000 } } } }));
  assert.deepEqual(await new TronProvider(loadConfig({}), { fetch: f }).getNowBlock(), { number: 123456, timestamp: 1700000000000 });
  assert.equal(f.calls[0].url, 'https://api.shasta.trongrid.io/wallet/getnowblock');
  assert.equal(await codeOf(new TronProvider(loadConfig({}), { fetch: mockFetch(() => ({ json: {} })) }).getNowBlock()), 'BAD_RESPONSE');
});

test('buildTransferTx : refuse sans plafond de frais configuré (aucune valeur inventée), sans appel réseau', async () => {
  const f = mockFetch(() => ({ json: {} }));
  const p = new TronProvider(cfg(), { fetch: f });
  assert.equal(await codeOf(p.buildTransferTx({ from: ADDR_A, to: ADDR_B, amountRaw: 50000000n })), 'FEE_LIMIT_NOT_CONFIGURED');
  assert.equal(f.calls.length, 0);
});

test('buildTransferTx : forme de la requête transfer(address,uint256)', async () => {
  const tx = { txID: TXID, raw_data: { expiration: 1 }, raw_data_hex: 'aa' };
  const f = mockFetch(() => ({ json: { result: { result: true }, transaction: tx } }));
  const p = new TronProvider(cfg({ YOR_FEE_LIMIT_SUN: '150000000' }), { fetch: f });
  assert.deepEqual(await p.buildTransferTx({ from: ADDR_A, to: ADDR_B, amountRaw: 50000000n }), tx);
  const c = f.calls[0];
  assert.equal(c.url, 'https://api.shasta.trongrid.io/wallet/triggersmartcontract');
  assert.deepEqual(c.body, {
    owner_address: ADDR_A, contract_address: CONTRACT, function_selector: 'transfer(address,uint256)',
    parameter: addressToAbiWord(ADDR_B) + encodeUint256(50000000n), fee_limit: 150000000, call_value: 0, visible: true
  });
  assert.equal(c.body.parameter.length, 128);
});

test('buildTransferTx : montants et adresses invalides refusés', async () => {
  const f = mockFetch(() => ({ json: {} }));
  const p = new TronProvider(cfg({ YOR_FEE_LIMIT_SUN: '1' }), { fetch: f });
  for (const amountRaw of [0n, -1n, 5, '5', 1.5, null]) assert.equal(await codeOf(p.buildTransferTx({ from: ADDR_A, to: ADDR_B, amountRaw })), 'INVALID_AMOUNT');
  assert.equal(await codeOf(p.buildTransferTx({ from: 'nope', to: ADDR_B, amountRaw: 1n })), 'INVALID_ADDRESS');
  assert.equal(f.calls.length, 0);
  const failing = new TronProvider(cfg({ YOR_FEE_LIMIT_SUN: '1' }), { fetch: mockFetch(() => ({ json: { result: { result: false, message: Buffer.from('CONTRACT_VALIDATE_ERROR').toString('hex') } } })) });
  assert.equal(await codeOf(failing.buildTransferTx({ from: ADDR_A, to: ADDR_B, amountRaw: 1n })), 'BUILD_FAILED');
});

test('broadcast : refuse une transaction non signée ; décode le rejet du nœud', async () => {
  const f = mockFetch(() => ({ json: { result: true, txid: TXID } }));
  const p = new TronProvider(cfg(), { fetch: f });
  assert.equal(await codeOf(p.broadcast({ txID: TXID })), 'NOT_SIGNED');
  assert.equal(await codeOf(p.broadcast({ txID: TXID, signature: [] })), 'NOT_SIGNED');
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await p.broadcast({ txID: TXID, signature: ['aa'] }), { txid: TXID });
  assert.equal(f.calls[0].url, 'https://api.shasta.trongrid.io/wallet/broadcasttransaction');
  const rej = new TronProvider(cfg(), { fetch: mockFetch(() => ({ json: { result: false, code: 'SIGERROR', message: Buffer.from('Validate signature error').toString('hex') } })) });
  try { await rej.broadcast({ txID: TXID, signature: ['aa'] }); assert.fail('should throw'); }
  catch (e){ assert.equal(e.code, 'BROADCAST_REJECTED'); assert.match(e.message, /SIGERROR Validate signature error/); }
});

test('transactionStatus : interroge le nœud complet PUIS le nœud solidity, avec {value: txid}', async () => {
  const f = mockFetch(() => ({ json: {} }));
  const p = new TronProvider(cfg(), { fetch: f });
  const st = await p.transactionStatus(TXID);
  assert.equal(st.state, 'broadcasted');
  assert.deepEqual(f.calls.map(c => c.url.replace('https://api.shasta.trongrid.io', '')), ['/wallet/gettransactioninfobyid', '/walletsolidity/gettransactioninfobyid']);
  assert.deepEqual(f.calls[0].body, { value: TXID });
  assert.equal(await codeOf(p.transactionStatus('abc')), 'INVALID_TXID');
});

/* ---------- classification pure ---------- */
const ok = (n = 100) => ({ id: TXID, blockNumber: n, receipt: { result: 'SUCCESS' } });

test('classify : introuvable => broadcasted', () => {
  assert.equal(classifyTransactionInfo(TXID, {}, {}).state, 'broadcasted');
  assert.equal(classifyTransactionInfo(TXID, undefined, null).state, 'broadcasted');
});

test('classify : dans un bloc mais pas solidifié => confirming (jamais confirmed)', () => {
  const r = classifyTransactionInfo(TXID, ok(), {});
  assert.equal(r.state, 'confirming');
  assert.equal(r.evidence, null);
});

test('classify : solidifié + SUCCESS => confirmed avec preuve complète', () => {
  const r = classifyTransactionInfo(TXID, ok(), ok());
  assert.equal(r.state, 'confirmed');
  assert.deepEqual(r.evidence, { txid: TXID, blockNumber: 100, receiptResult: 'SUCCESS', solidified: true });
  assert.ok(hasConfirmationEvidence(r.evidence));
});

test('classify : échec non solidifié = provisoire ; échec solidifié = failed avec raison décodée', () => {
  const rev = { id: TXID, blockNumber: 7, receipt: { result: 'REVERT' }, resMessage: Buffer.from('REVERT opcode executed').toString('hex') };
  const prov = classifyTransactionInfo(TXID, rev, {});
  assert.equal(prov.state, 'confirming');
  assert.equal(prov.provisional, 'failed');
  const fin = classifyTransactionInfo(TXID, rev, rev);
  assert.equal(fin.state, 'failed');
  assert.equal(fin.reason, 'REVERT opcode executed');
  assert.equal(fin.evidence.solidified, true);
  assert.equal(classifyTransactionInfo(TXID, { id: TXID, blockNumber: 3, result: 'FAILED' }, {}).provisional, 'failed');
});

test('classify : sans receipt.result ou sans numéro de bloc, jamais confirmed', () => {
  assert.equal(classifyTransactionInfo(TXID, { id: TXID, blockNumber: 5 }, { id: TXID, blockNumber: 5 }).state, 'confirming');
  assert.equal(classifyTransactionInfo(TXID, ok(), { id: TXID, receipt: { result: 'SUCCESS' } }).state, 'confirming');
});

test('hexToText réutilisé : message non-ASCII conservé en hexadécimal', () => {
  assert.equal(hexToText('ff00fe'), 'ff00fe');
});
