import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, transition, canTransition, isTerminal, hasConfirmationEvidence, StateError } from '../../src/services/blockchain/transfer-state.mjs';
import { TransferService, TransferError } from '../../src/services/blockchain/transfer-service.mjs';
import { NullSigningProvider, SigningProviderNotConfigured, SignatureRejected, SIGNING_NOT_CONFIGURED_MESSAGE } from '../../src/services/blockchain/signing.mjs';
import { TronProvider, TronError } from '../../src/services/blockchain/provider.mjs';
import { loadConfig } from '../../src/services/blockchain/config.mjs';
import { mockFetch, ADDR_A, ADDR_B, CONTRACT, TXID } from './helpers.mjs';

const EVIDENCE = { txid: TXID, blockNumber: 100, receiptResult: 'SUCCESS', solidified: true };

/* ---------- machine d'états ---------- */
test('chemin nominal et états attendus', () => {
  assert.deepEqual([...STATES], ['draft', 'pending_signature', 'broadcasted', 'confirming', 'confirmed', 'failed', 'expired', 'cancelled']);
  let s = 'draft';
  for (const next of ['pending_signature', 'broadcasted', 'confirming']) s = transition(s, next);
  assert.equal(transition(s, 'confirmed', EVIDENCE), 'confirmed');
});

test('transitions interdites', () => {
  for (const [a, b] of [['draft', 'confirmed'], ['draft', 'broadcasted'], ['pending_signature', 'confirming'], ['confirming', 'broadcasted'], ['confirmed', 'failed'], ['failed', 'confirmed'], ['expired', 'broadcasted'], ['cancelled', 'draft']])
    assert.throws(() => transition(a, b, EVIDENCE), StateError, `${a}->${b}`);
  assert.throws(() => transition('draft', 'inconnu'), StateError);
});

test('« confirmed » impossible sans preuve vérifiée complète', () => {
  const bad = [undefined, null, {}, { ...EVIDENCE, solidified: false }, { ...EVIDENCE, receiptResult: 'REVERT' }, { ...EVIDENCE, txid: 'abc' },
    { ...EVIDENCE, blockNumber: 0 }, { ...EVIDENCE, blockNumber: '100' }, { ...EVIDENCE, txid: undefined }];
  for (const ev of bad){
    assert.equal(hasConfirmationEvidence(ev), false);
    assert.throws(() => transition('confirming', 'confirmed', ev), e => e instanceof StateError && e.code === 'CONFIRMATION_NOT_VERIFIED');
    assert.throws(() => transition('broadcasted', 'confirmed', ev), StateError);
  }
});

test('états terminaux', () => {
  for (const s of ['confirmed', 'failed', 'expired', 'cancelled']) assert.ok(isTerminal(s));
  for (const s of ['draft', 'pending_signature', 'broadcasted', 'confirming']) assert.ok(!isTerminal(s));
  assert.ok(canTransition('draft', 'cancelled'));
});

/* ---------- signature ---------- */
test('fournisseur absent : message exact et jamais de signature factice', async () => {
  assert.equal(SIGNING_NOT_CONFIGURED_MESSAGE, 'Wallet signing provider not configured');
  await assert.rejects(NullSigningProvider.signTransaction({}), e => e instanceof SigningProviderNotConfigured && e.message === 'Wallet signing provider not configured');
  await assert.rejects(NullSigningProvider.getAddress(), SigningProviderNotConfigured);
  assert.equal(NullSigningProvider.configured, false);
});

/* ---------- service de transfert (fournisseur factice) ---------- */
/* TEST ONLY : signature factice, aucune clé, aucune valeur cryptographique réelle. */
const testSigner = (over = {}) => ({ id: 'test-only', configured: true, getAddress: async () => ADDR_A,
  signTransaction: async tx => ({ ...tx, signature: ['00'.repeat(65)] }), ...over });

function fakeProvider(over = {}){
  const calls = [];
  const p = {
    calls, status: { state: 'broadcasted', evidence: null },
    async buildTransferTx(a){ calls.push('build'); return { txID: TXID, raw_data: { expiration: 5000 }, raw_data_hex: 'aabb' }; },
    async broadcast(s){ calls.push('broadcast'); return { txid: s.txID }; },
    async transactionStatus(){ calls.push('status'); return p.status; },
    ...over
  };
  return p;
}
const recorder = () => { const log = []; return { log, onState: async e => { log.push(e); } }; };

test('sans fournisseur de signature : erreur claire, rien construit, rien persisté', async () => {
  for (const signer of [undefined, null, NullSigningProvider, { configured: true }]){
    const prov = fakeProvider(); const r = recorder();
    const svc = new TransferService({ provider: prov, signer, onState: r.onState });
    await assert.rejects(svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 50000000n }), e => e instanceof SigningProviderNotConfigured && e.message === 'Wallet signing provider not configured');
    assert.deepEqual(prov.calls, []);
    assert.deepEqual(r.log, []);
  }
});

test('entrées invalides refusées avant tout', async () => {
  const prov = fakeProvider();
  const svc = new TransferService({ provider: prov, signer: testSigner() });
  await assert.rejects(svc.execute({ from: 'x', to: ADDR_B, amountRaw: 1n }), e => e.code === 'INVALID_ADDRESS');
  await assert.rejects(svc.execute({ from: ADDR_A, to: ADDR_A, amountRaw: 1n }), e => e.code === 'SELF_TRANSFER');
  for (const amountRaw of [0n, -3n, 50, '50']) await assert.rejects(svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw }), e => e.code === 'INVALID_AMOUNT');
  assert.deepEqual(prov.calls, []);
});

test('flux complet : confirmed seulement quand le suivi apporte la preuve solidifiée', async () => {
  const prov = fakeProvider(); const r = recorder(); let now = 1000;
  const svc = new TransferService({ provider: prov, signer: testSigner(), onState: r.onState, now: () => now });
  const out = await svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 50000000n });
  assert.deepEqual(out, { state: 'broadcasted', txid: TXID, expiresAt: 5000 });
  assert.deepEqual(r.log.map(e => e.state), ['draft', 'pending_signature', 'broadcasted']);
  assert.ok(!r.log.some(e => e.state === 'confirmed'), 'jamais confirmé à la diffusion');

  prov.status = { state: 'broadcasted', evidence: null };
  assert.equal(await svc.refresh({ txid: TXID, state: 'broadcasted', expiresAt: 5000 }), 'broadcasted');
  prov.status = { state: 'confirming', evidence: null };
  assert.equal(await svc.refresh({ txid: TXID, state: 'broadcasted', expiresAt: 5000 }), 'confirming');
  assert.equal(await svc.refresh({ txid: TXID, state: 'confirming' }), 'confirming');
  prov.status = { state: 'confirmed', evidence: EVIDENCE };
  assert.equal(await svc.refresh({ txid: TXID, state: 'confirming' }), 'confirmed');
  const n = prov.calls.length;
  assert.equal(await svc.refresh({ txid: TXID, state: 'confirmed' }), 'confirmed');
  assert.equal(prov.calls.length, n, 'état terminal : aucun nouvel appel');
  assert.equal(r.log.at(-1).state, 'confirmed');
  assert.deepEqual(r.log.at(-1).evidence, EVIDENCE);
});

test('preuve insuffisante : le service refuse de confirmer et n\'émet jamais « confirmed »', async () => {
  const prov = fakeProvider(); const r = recorder();
  const svc = new TransferService({ provider: prov, signer: testSigner(), onState: r.onState });
  await svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n });
  prov.status = { state: 'confirmed', evidence: { ...EVIDENCE, solidified: false } };
  await assert.rejects(svc.refresh({ txid: TXID, state: 'broadcasted' }), e => e instanceof StateError && e.code === 'CONFIRMATION_NOT_VERIFIED');
  assert.ok(!r.log.some(e => e.state === 'confirmed'));
});

test('transaction jamais vue après expiration => expired', async () => {
  const prov = fakeProvider(); const r = recorder(); let now = 1000;
  const svc = new TransferService({ provider: prov, signer: testSigner(), onState: r.onState, now: () => now });
  await svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n });
  now = 4999; assert.equal(await svc.refresh({ txid: TXID, state: 'broadcasted', expiresAt: 5000 }), 'broadcasted');
  now = 5001; assert.equal(await svc.refresh({ txid: TXID, state: 'broadcasted', expiresAt: 5000 }), 'expired');
});

test('échec solidifié => failed avec raison', async () => {
  const prov = fakeProvider(); const r = recorder();
  const svc = new TransferService({ provider: prov, signer: testSigner(), onState: r.onState });
  await svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n });
  prov.status = { state: 'failed', reason: 'REVERT opcode executed', evidence: { txid: TXID, blockNumber: 9, receiptResult: 'REVERT', solidified: true } };
  assert.equal(await svc.refresh({ txid: TXID, state: 'broadcasted' }), 'failed');
  assert.equal(r.log.at(-1).reason, 'REVERT opcode executed');
});

test('signature refusée par l\'utilisateur => cancelled ; autre erreur de signature => failed ; rien n\'est diffusé', async () => {
  for (const [err, expected] of [[new SignatureRejected(), 'cancelled'], [new Error('boom'), 'failed']]){
    const prov = fakeProvider(); const r = recorder();
    const svc = new TransferService({ provider: prov, signer: testSigner({ signTransaction: async () => { throw err; } }), onState: r.onState });
    await assert.rejects(svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n }), e => e === err);
    assert.equal(r.log.at(-1).state, expected);
    assert.ok(!prov.calls.includes('broadcast'));
  }
});

test('transaction signée différente de celle construite : refusée, non diffusée', async () => {
  for (const tamper of [{ txID: 'cd'.repeat(32) }, { raw_data_hex: 'ffff' }]){
    const prov = fakeProvider(); const r = recorder();
    const svc = new TransferService({ provider: prov, signer: testSigner({ signTransaction: async tx => ({ ...tx, ...tamper, signature: ['00'] }) }), onState: r.onState });
    await assert.rejects(svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n }), e => e instanceof TransferError && e.code === 'SIGNED_TX_MISMATCH');
    assert.equal(r.log.at(-1).state, 'failed');
    assert.ok(!prov.calls.includes('broadcast'));
  }
});

test('diffusion rejetée ou construction impossible => failed', async () => {
  const r1 = recorder();
  await assert.rejects(new TransferService({ provider: fakeProvider({ broadcast: async () => { throw new TronError('BROADCAST_REJECTED', 'no'); } }), signer: testSigner(), onState: r1.onState })
    .execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n }), e => e.code === 'BROADCAST_REJECTED');
  assert.equal(r1.log.at(-1).state, 'failed');
  const r2 = recorder();
  await assert.rejects(new TransferService({ provider: fakeProvider({ buildTransferTx: async () => { throw new TronError('TOKEN_NOT_DEPLOYED', 'no'); } }), signer: testSigner(), onState: r2.onState })
    .execute({ from: ADDR_A, to: ADDR_B, amountRaw: 1n }), e => e.code === 'TOKEN_NOT_DEPLOYED');
  assert.deepEqual(r2.log.map(e => e.state), ['draft', 'failed']);
  assert.equal(r2.log.at(-1).reason, 'TOKEN_NOT_DEPLOYED');
});

/* ---------- intégration avec le vrai TronProvider et un fetch simulé ---------- */
test('intégration TronProvider + fetch simulé : transfert 50 YOR-USDT de bout en bout (réseau SIMULÉ, pas TRON)', async () => {
  const tx = { txID: TXID, raw_data: { expiration: 9_999_999_999_999 }, raw_data_hex: 'c0ffee' };
  const solidAfter = { n: 0 };
  const f = mockFetch(({ url, body }) => {
    const path = url.replace('https://api.shasta.trongrid.io', '');
    if (path === '/wallet/triggersmartcontract') return { json: { result: { result: true }, transaction: tx } };
    if (path === '/wallet/broadcasttransaction') return { json: { result: true, txid: body.txID } };
    if (path === '/wallet/gettransactioninfobyid') return { json: solidAfter.n >= 1 ? { id: TXID, blockNumber: 321, receipt: { result: 'SUCCESS' } } : {} };
    if (path === '/walletsolidity/gettransactioninfobyid') return { json: solidAfter.n >= 2 ? { id: TXID, blockNumber: 321, receipt: { result: 'SUCCESS' } } : {} };
    throw new Error('unexpected ' + path);
  });
  const provider = new TronProvider(loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: CONTRACT, YOR_FEE_LIMIT_SUN: '100000000' }), { fetch: f });
  const r = recorder();
  const svc = new TransferService({ provider, signer: testSigner(), onState: r.onState });
  const out = await svc.execute({ from: ADDR_A, to: ADDR_B, amountRaw: 50_000_000n });
  assert.equal(out.state, 'broadcasted');
  assert.equal(await svc.refresh({ txid: out.txid, state: out.state, expiresAt: out.expiresAt }), 'broadcasted');
  solidAfter.n = 1;
  assert.equal(await svc.refresh({ txid: out.txid, state: 'broadcasted', expiresAt: out.expiresAt }), 'confirming');
  solidAfter.n = 2;
  assert.equal(await svc.refresh({ txid: out.txid, state: 'confirming', expiresAt: out.expiresAt }), 'confirmed');
  assert.deepEqual(r.log.map(e => e.state), ['draft', 'pending_signature', 'broadcasted', 'confirming', 'confirmed']);
  assert.equal(r.log.at(-1).evidence.blockNumber, 321);
  const broadcasted = f.calls.find(c => c.url.endsWith('/wallet/broadcasttransaction'));
  assert.deepEqual(broadcasted.body.signature, ['00'.repeat(65)]);
});
