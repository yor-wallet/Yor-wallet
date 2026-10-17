/* Tests du client navigateur (web/chain-client.js assemblé avec lib.ts et transfer-state.mjs).
   Le « réseau » est un faux nœud dont les réponses sont des réponses RÉELLES de Nile (voir fixtures.mjs).
   Aucun appel réseau, aucune signature réelle : la signature est un faux fournisseur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { ADDR, HEX, BUILD_REQUEST, BUILD_RESPONSE, MINT_INFO, HISTORY, transferInfo, GENESIS } from './fixtures.mjs';
import { loadChain, makeClock, memoryStorage, makeNode, fakeSigner, fakeTronLink, sha256hex } from './harness.mjs';
import { parseUnits } from '../../src/services/blockchain/units.mjs';

const Y = loadChain();
const hexMsg = t => Buffer.from(t).toString('hex');

function setup(init = {}, extra = {}) {
  const clock = makeClock();
  const node = makeNode(Y, clock, init);
  const storage = extra.storage || memoryStorage();
  const client = Y.createClient({ fetch: node.fetch, now: clock.now, mono: clock.mono, sleep: async ms => { clock.advance(ms); }, storage, window: extra.window || null });
  return { clock, node, storage, client };
}
const send = (ctx, over = {}) => ctx.client.sendTransfer(Object.assign({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n, signer: fakeSigner() }, over));
const rejects = async (p, code) => { await assert.rejects(p, e => { assert.equal(e.code, code, 'code reçu : ' + e.code + ' / ' + e.message); return true; }); };

/* ------------------------------------------------------------------ SHA-256 */
test('sha256 : vecteurs connus', () => {
  const h = t => Buffer.from(Y.sha256(Buffer.from(t))).toString('hex');
  assert.equal(h(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(h('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(h('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('sha256 : identique à node:crypto pour toutes les longueurs de 0 à 300 octets', () => {
  for (let n = 0; n <= 300; n++) {
    const b = randomBytes(n);
    assert.equal(Buffer.from(Y.sha256(new Uint8Array(b))).toString('hex'), createHash('sha256').update(b).digest('hex'), 'longueur ' + n);
  }
});

/* ------------------------------------------------------------------ adresses et montants */
test('adresses : somme de contrôle vérifiée, adresses réelles acceptées', () => {
  for (const a of Object.values(ADDR)) assert.equal(Y.isAddress(a), true, a);
  assert.equal(Y.isAddress('TWoXF3efc2EVQj2Fif5kMBNRFAJzRrfaX8'), false);   /* dernier caractère modifié */
  assert.equal(Y.isAddress('0x' + '11'.repeat(20)), false);
  assert.equal(Y.isAddress(''), false);
  assert.equal(Y.isAddress(null), false);
  assert.equal(Y.addrToHex(ADDR.user), HEX.user);
  assert.equal(Y.hexToAddr(HEX.token), ADDR.token);
});

test('montants : parseAmount strict, identique à units.mjs sur les entrées valides', () => {
  for (const s of ['1', '0.000001', '1.5', '1870000', '1870000.000001', '000.5', '12.340000']) {
    assert.equal(Y.parseAmount(s), parseUnits(s, 6), s);
  }
  assert.equal(Y.parseAmount('1,5'), 1500000n);               /* virgule décimale (FR) */
  assert.equal(Y.parseAmount('٣٫٥'), 3500000n);               /* chiffres arabo-indiques + séparateur arabe */
  assert.equal(Y.parseAmount(' 2 '), 2000000n);
  for (const bad of ['', '0', '0.0', '-1', '+1', '1e3', '1.1234567', '1.2.3', '1,000.50', 'abc', '1 000', '.5', '5.']) {
    assert.throws(() => Y.parseAmount(bad), e => e.name === 'ChainError', 'devrait refuser : ' + JSON.stringify(bad));
  }
});

test('montants : affichage exact (pas de flottants), TEST BALANCE = 1 870 000', () => {
  assert.equal(Y.formatAmount(1870000000000n), '1,870,000.00');
  assert.equal(Y.formatAmount(1n), '0.000001');
  assert.equal(Y.formatAmount(1500000n), '1.50');
  assert.equal(Y.formatAmount(123456789n), '123.456789');
  assert.equal(Y.formatTrx(18618200n), '18.6182');
  assert.equal(Y.formatAmount(0n), '0.00');
});

/* ------------------------------------------------------------------ garde-fous de configuration */
test('configuration : mainnet, Tether et adresse invalide sont refusés au démarrage', () => {
  const base = Y.CONFIG;
  const mk = patch => Object.freeze({ ...base, ...patch });
  assert.throws(() => Y.createClient({ config: mk({ network: { ...base.network, isMainnet: true } }), fetch: async () => {} }), e => e.code === 'MAINNET_FORBIDDEN');
  assert.throws(() => Y.createClient({ config: mk({ network: { ...base.network, fullNode: 'https://api.trongrid.io' } }), fetch: async () => {} }), e => e.code === 'MAINNET_FORBIDDEN');
  assert.throws(() => Y.createClient({ config: mk({ network: { ...base.network, fullNode: 'http://nile.trongrid.io' } }), fetch: async () => {} }), e => e.code === 'BAD_CONFIG');
  assert.throws(() => Y.createClient({ config: mk({ token: { ...base.token, isTether: true } }), fetch: async () => {} }), e => e.code === 'BAD_CONFIG');
  assert.throws(() => Y.createClient({ config: mk({ token: { ...base.token, address: 'TYnzmpqeUWtXWjymVtdj4SADzW45adnzde' } }), fetch: async () => {} }), e => e.code === 'BAD_CONFIG');
  assert.equal(Y.CONFIG.network.isMainnet, false);
  assert.equal(Y.CONFIG.token.isTether, false);
  assert.equal(Y.CONFIG.token.address, ADDR.token);
  assert.equal(Y.CONFIG.network.genesisBlockId.slice(-8), Y.CONFIG.network.chainIdHex.slice(2));   /* chainId = 4 derniers octets du bloc 0 */
  assert.throws(() => { Y.CONFIG.network.isMainnet = true; }, TypeError);
});

/* ------------------------------------------------------------------ vérification du nœud et du jeton */
test('verifyChain : nœud = Nile (bloc 0) et jeton = YOR Experimental USDT / YOR-USDT / 6', async () => {
  const { client } = setup();
  const v = await client.verifyChain();
  assert.deepEqual(v, { network: 'nile', name: 'YOR Experimental USDT', symbol: 'YOR-USDT', decimals: 6, contract: ADDR.token });
});

test('verifyChain : refuse un nœud dont le bloc 0 n\'est pas celui de Nile', async () => {
  const { client } = setup({ genesis: { blockID: '0000000000000000' + '11'.repeat(24) } });
  await rejects(client.verifyChain(), 'WRONG_NETWORK_NODE');
  await rejects(client.readBalances(ADDR.user), 'WRONG_NETWORK_NODE');
});

test('verifyChain : refuse une adresse de contrat qui n\'est pas le jeton attendu (ex. vrai Tether)', async () => {
  const { client } = setup({ nameHex: Buffer.concat([Buffer.alloc(31), Buffer.from([32]), Buffer.alloc(31), Buffer.from([10]), Buffer.from('Tether USD'), Buffer.alloc(22)]).toString('hex') });
  await rejects(client.verifyChain(), 'TOKEN_METADATA_MISMATCH');
});

/* ------------------------------------------------------------------ soldes (source de vérité : la chaîne) */
test('readBalances : valeurs lues sur le nœud solidity, étiquetées', async () => {
  const { client, node } = setup();
  const b = await client.readBalances(ADDR.user);
  assert.equal(b.total, 1870000000000n);
  assert.equal(b.available, 1870000000000n);
  assert.equal(b.expired, 0n);
  assert.equal(b.source, 'solidity');
  assert.equal(b.trx.exists, true);
  assert.equal(b.trx.balanceSun, 1000000000n);
  assert.ok(node.calls.some(c => c.path === '/walletsolidity/triggerconstantcontract'));
});

test('readBalances : solde 0 et compte non activé pour une adresse inconnue (aucune valeur inventée)', async () => {
  const { client } = setup({ accounts: {}, balances: {} });
  const b = await client.readBalances(ADDR.user);
  assert.equal(b.total, 0n);
  assert.equal(b.trx.exists, false);
  assert.equal(b.trx.balanceSun, 0n);
});

test('readBalances : repli sur le nœud complet ÉTIQUETÉ « fullnode » quand le nœud solidity ne répond pas', async () => {
  const { client } = setup({ failSolidRead: true });
  const b = await client.readBalances(ADDR.user);
  assert.equal(b.total, 1870000000000n);
  assert.equal(b.source, 'fullnode');
});

test('readBalances : adresse invalide refusée sans appel réseau', async () => {
  const { client, node } = setup();
  await rejects(client.readBalances('TWoXF3efc2EVQj2Fif5kMBNRFAJzRrfaX8'), 'INVALID_ADDRESS');
  assert.equal(node.calls.length, 0);
});

/* ------------------------------------------------------------------ estimation (simulation) */
test('estimateTransfer : énergie simulée 186 182 × 100 sun, plafond 28 TRX, frais lus sur la chaîne', async () => {
  const { client } = setup();
  const e = await client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n });
  assert.equal(e.energyUsed, 186182);
  assert.equal(e.energyFeeSun, 100);
  assert.equal(e.feeLimitTrx, 28);                    /* ceil(186182 × 100 × 1,5 / 1e6) */
  assert.equal(e.feeLimitSun, 28_000_000);
  assert.equal(e.expectedBurnSun, 18_618_200n);       /* aucune énergie gelée ; bande passante gratuite suffisante */
  assert.equal(e.burnBandwidthSun, 0n);
  assert.equal(e.accountActivated, true);
  assert.equal(e.hasEnoughTrx, true);
  assert.equal(e.source, 'solidity');
});

test('estimateTransfer : énergie gelée disponible => moins de TRX brûlés', async () => {
  const { client } = setup({ resources: { [ADDR.user]: { freeNetLimit: 600, freeNetUsed: 0, EnergyLimit: 100000, EnergyUsed: 0 } } });
  const e = await client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n });
  assert.equal(e.expectedBurnSun, BigInt(186182 - 100000) * 100n);
});

test('estimateTransfer : bande passante gratuite épuisée => octets × prix de chaîne ajoutés', async () => {
  const { client } = setup({ resources: { [ADDR.user]: { freeNetLimit: 600, freeNetUsed: 600 } } });
  const e = await client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n });
  assert.equal(e.burnBandwidthSun, BigInt(e.bandwidthBytes) * 1000n);
  assert.ok(e.bandwidthBytes > 250 && e.bandwidthBytes < 400, 'octets ' + e.bandwidthBytes);
});

test('estimateTransfer : la taille estimée correspond à la vraie transaction de transfert relevée sur Nile', () => {
  const rawHexLen = BUILD_RESPONSE.transaction.raw_data_hex.length;
  assert.equal(rawHexLen, 422, 'le client suppose 422 caractères hex (211 octets) pour un transfert : raw_data_hex de la fixture réelle');
});

test('estimateTransfer : solde insuffisant => INSUFFICIENT_TOKEN avant toute signature', async () => {
  const { client } = setup();
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1870000000001n }), 'INSUFFICIENT_TOKEN');
});

test('estimateTransfer : révocation du contrat (result.result = true mais ret FAILED) est détectée et la raison décodée', async () => {
  /* Forme réelle : le nœud répond result:true même quand le contrat révoque ; seuls ret[0].ret = FAILED et Error(string) le disent. */
  const { client } = setup({ simRevert: true });
  await assert.rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n }),
    e => { assert.equal(e.code, 'INSUFFICIENT_TOKEN'); assert.equal(e.reason, 'YORUSDT: insufficient available balance'); return true; });
  const other = { transaction: { ret: [{ ret: 'FAILED' }] }, constant_result: [], result: { result: true, message: 'REVERT opcode executed' }, energy_used: 100 };
  const c2 = setup({ simRevert: other }).client;
  await rejects(c2.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n }), 'SIMULATION_REVERTED');
});

test('estimateTransfer : entrées refusées (soi-même, adresse nulle, contrat du jeton, montant nul, adresse invalide)', async () => {
  const { client } = setup();
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.user, amountRaw: 1n }), 'SELF_TRANSFER');
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.zero, amountRaw: 1n }), 'TO_ZERO_ADDRESS');
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.token, amountRaw: 1n }), 'TO_CONTRACT');
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 0n }), 'INVALID_AMOUNT');
  await rejects(client.estimateTransfer({ from: ADDR.user, to: 'T' + 'x'.repeat(33), amountRaw: 1n }), 'INVALID_ADDRESS');
});

test('estimateTransfer : énergie anormale (coût > plafond de sécurité) => FEE_TOO_HIGH', async () => {
  const { client } = setup({ energy: 10_000_000 });
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n }), 'FEE_TOO_HIGH');
});

test('estimateTransfer : compte jamais activé (0 TRX) => signalé, hasEnoughTrx = false', async () => {
  const { client } = setup({ accounts: {} });
  const e = await client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n });
  assert.equal(e.accountActivated, false);
  assert.equal(e.hasEnoughTrx, false);
  assert.equal(e.trxBalanceSun, 0n);
});

test('estimateTransfer : paramètres de chaîne absents => erreur, jamais de frais par défaut inventé', async () => {
  const { client } = setup({ chainParams: { chainParameter: [] } });
  await rejects(client.estimateTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n }), 'BAD_RESPONSE');
});

/* ------------------------------------------------------------------ construction + contrôle de la transaction */
test('buildTransfer : la transaction RÉELLE renvoyée par Nile passe les 17 contrôles (ré-encodage protobuf compris)', async () => {
  const { client } = setup({ builtTx: BUILD_RESPONSE.transaction });
  const r = await client.buildTransfer({ ...BUILD_REQUEST, extend: false });
  assert.equal(r.extended, false);
  assert.equal(r.tx.txID, BUILD_RESPONSE.transaction.txID);
  const checks = Y.L.checkTriggerTx({ tx: r.tx, ownerHex41: HEX.user, contractHex41: HEX.token, dataHex: BUILD_RESPONSE.transaction.raw_data.contract[0].parameter.value.data, feeLimitSun: 30000000 }, Y.sha256);
  assert.equal(checks.length, 17);
  assert.deepEqual(checks.filter(c => !c.ok), []);
});

test('buildTransfer : expiration allongée à 5 min sur la transaction RÉELLE ; tout le reste est identique et les 17 contrôles passent sur la version modifiée', async () => {
  const orig = BUILD_RESPONSE.transaction;
  const { client } = setup({ builtTx: orig });
  const r = await client.buildTransfer(BUILD_REQUEST);
  assert.equal(r.extended, true);
  assert.equal(r.tx.raw_data.expiration, orig.raw_data.timestamp + 300_000);
  assert.ok(r.tx.raw_data.expiration > orig.raw_data.expiration);
  assert.notEqual(r.tx.txID, orig.txID, 'l\'expiration fait partie du hash signé : le txID change');
  assert.equal(r.tx.txID, sha256hex(r.tx.raw_data_hex), 'txID = sha256(raw_data_hex)');
  assert.equal(Y.L.encodeTriggerRawData(r.tx.raw_data), r.tx.raw_data_hex, 're-encodage exact');
  const strip = tx => { const x = JSON.parse(JSON.stringify(tx)); delete x.txID; delete x.raw_data_hex; delete x.raw_data.expiration; return x; };
  assert.deepEqual(strip(r.tx), strip(orig), 'seuls expiration, raw_data_hex et txID diffèrent (contrat, destinataire, montant, bloc de référence, fee_limit, timestamp)');
  const checks = Y.L.checkTriggerTx({ tx: r.tx, ownerHex41: HEX.user, contractHex41: HEX.token, dataHex: orig.raw_data.contract[0].parameter.value.data, feeLimitSun: 30000000 }, Y.sha256);
  assert.equal(checks.length, 17);
  assert.deepEqual(checks.filter(c => !c.ok), []);
  /* la signature porte sur CE txID : le nœud ne la rejettera pas pour un octet différent */
  assert.equal(r.tx.raw_data_hex.length, orig.raw_data_hex.length, 'même longueur : expiration encodée sur le même nombre d\'octets');
});

test('buildTransfer : l\'allongement est désactivable (extend:false, txExpirationMs:0), borné, et ne raccourcit jamais une expiration du nœud', async () => {
  const orig = BUILD_RESPONSE.transaction;
  const a = await setup({ builtTx: orig }).client.buildTransfer({ ...BUILD_REQUEST, extend: false });
  assert.equal(a.extended, false); assert.equal(a.tx.raw_data.expiration, orig.raw_data.expiration);
  const clock = makeClock(), node = makeNode(Y, clock, { builtTx: orig });
  const off = Y.createClient({ fetch: node.fetch, now: clock.now, mono: clock.mono, storage: memoryStorage(), window: null, config: { ...Y.CONFIG, limits: { ...Y.CONFIG.limits, txExpirationMs: 0 } } });
  const b = await off.buildTransfer(BUILD_REQUEST);
  assert.equal(b.extended, false); assert.equal(b.tx.txID, orig.txID);
  const small = Y.createClient({ fetch: node.fetch, now: clock.now, mono: clock.mono, storage: memoryStorage(), window: null, config: { ...Y.CONFIG, limits: { ...Y.CONFIG.limits, txExpirationMs: 10_000 } } });
  const c = await small.buildTransfer(BUILD_REQUEST);
  assert.equal(c.extended, false, 'une valeur plus courte que celle du nœud ne la raccourcit pas');
  assert.equal(c.tx.raw_data.expiration, orig.raw_data.expiration);
  for (const bad of [-1, 600_001, 1.5]) {
    assert.throws(() => Y.createClient({ fetch: node.fetch, storage: memoryStorage(), window: null, config: { ...Y.CONFIG, limits: { ...Y.CONFIG.limits, txExpirationMs: bad } } }), e => e.code === 'BAD_CONFIG', String(bad));
  }
  assert.throws(() => Y.createClient({ fetch: node.fetch, storage: memoryStorage(), window: null, config: { ...Y.CONFIG, limits: { ...Y.CONFIG.limits, maxTxExpirationMs: 3_600_000, txExpirationMs: 3_600_000 } } }), e => e.code === 'BAD_CONFIG');
});

test('buildTransfer : un nœud malveillant ne peut pas faire signer autre chose (chaque altération est refusée)', async () => {
  const tamper = {
    'destinataire modifié': tx => { tx.raw_data.contract[0].parameter.value.data = tx.raw_data.contract[0].parameter.value.data.replace('9f10b9a5', 'aaaaaaaa'); return tx; },
    'montant modifié': tx => { tx.raw_data.contract[0].parameter.value.data = tx.raw_data.contract[0].parameter.value.data.slice(0, -2) + 'ff'; return tx; },
    'contrat modifié': tx => { tx.raw_data.contract[0].parameter.value.contract_address = HEX.deployer; return tx; },
    'expéditeur modifié': tx => { tx.raw_data.contract[0].parameter.value.owner_address = HEX.deployer; return tx; },
    'fee_limit modifié': tx => { tx.raw_data.fee_limit = 99_000_000; return tx; },
    'txID modifié': tx => { tx.txID = '00'.repeat(32); return tx; },
    'call_value ajouté': tx => { tx.raw_data.contract[0].parameter.value.call_value = 1000000; return tx; },
    'champ inconnu ajouté': tx => { tx.raw_data.contract[0].parameter.value.token_id = 1; tx.raw_data.extra = 1; return tx; },
    'raw_data_hex remplacé (JSON ≠ octets)': tx => { tx.raw_data_hex = tx.raw_data_hex.replace('16e360', 'ffffff'); return tx; }
  };
  for (const [name, fn] of Object.entries(tamper)) {
    const { client } = setup({ builtTx: BUILD_RESPONSE.transaction, buildMutate: fn });
    await assert.rejects(client.buildTransfer(BUILD_REQUEST), e => { assert.equal(e.code, 'TX_CHECK_FAILED', name); assert.ok(e.failed.length > 0, name); return true; }, name);
  }
});

test('buildTransfer : plafond de frais hors bornes refusé', async () => {
  const { client } = setup({ builtTx: BUILD_RESPONSE.transaction });
  await rejects(client.buildTransfer({ ...BUILD_REQUEST, feeLimitSun: 101_000_000 }), 'FEE_TOO_HIGH');
  await rejects(client.buildTransfer({ ...BUILD_REQUEST, feeLimitSun: 0 }), 'FEE_TOO_HIGH');
  await rejects(client.buildTransfer({ ...BUILD_REQUEST, feeLimitSun: 1.5 }), 'FEE_TOO_HIGH');
});

/* ------------------------------------------------------------------ transfert complet */
test('sendTransfer : sans fournisseur de signature => « Wallet signing provider not configured », rien n\'est construit', async () => {
  const ctx = setup();
  await assert.rejects(ctx.client.sendTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1n, signer: null }), e => e.code === 'SIGNING_PROVIDER_NOT_CONFIGURED' && e.message === 'Wallet signing provider not configured');
  await assert.rejects(ctx.client.sendTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1n, signer: { configured: false, signTransaction() {} } }), e => e.code === 'SIGNING_PROVIDER_NOT_CONFIGURED');
  assert.equal(ctx.node.calls.length, 0);
  assert.equal(ctx.client.records().length, 0);
});

test('sendTransfer : parcours nominal draft → pending_signature → broadcasted, puis confirming → confirmed seulement sur preuve', async () => {
  const ctx = setup();
  const signer = fakeSigner();
  const rec = await send(ctx, { signer });
  assert.equal(rec.state, 'broadcasted');
  assert.match(rec.txid, /^[0-9a-f]{64}$/);
  assert.equal(rec.id, rec.txid);
  assert.equal(signer.signed, 1);
  assert.equal(ctx.node.calls.broadcasts, 1);
  const sent = ctx.node.calls.find(c => c.path === '/wallet/broadcasttransaction').body;
  assert.equal(sent.txID, rec.txid);
  assert.equal(sent.signature.length, 1);
  assert.equal(ctx.client.records().length, 1);                      /* l'identifiant local a bien été remplacé par le txid */

  /* 1) introuvable : reste « broadcasted » */
  let r = await ctx.client.refreshRecord(rec);
  assert.equal(r.state, 'broadcasted');

  /* 2) vu seulement sur le nœud complet : « confirming », JAMAIS « confirmed » */
  ctx.node.state.infoFull[rec.txid] = transferInfo({ txid: rec.txid });
  r = await ctx.client.refreshRecord(r);
  assert.equal(r.state, 'confirming');
  assert.equal(r.blockNumber, 71670000);

  /* 3) solidifié + SUCCESS + événement Transfer => « confirmed » avec les frais réels */
  ctx.node.state.infoSol[rec.txid] = transferInfo({ txid: rec.txid });
  r = await ctx.client.refreshRecord(r);
  assert.equal(r.state, 'confirmed');
  assert.equal(r.feeSun, 18618200);
  assert.equal(r.energyUsed, 186182);
  assert.equal(r.receiptResult, 'SUCCESS');

  /* 4) état final : plus aucun changement */
  const again = await ctx.client.refreshRecord(r);
  assert.equal(again.state, 'confirmed');
});

test('sendTransfer : SUCCESS solidifié MAIS événement Transfer absent/différent => jamais « confirmed » (anomalie signalée)', async () => {
  for (const [name, info] of [
    ['événement absent', txid => transferInfo({ txid, withEvent: false })],
    ['montant différent', txid => transferInfo({ txid, amount: 1500001n })],
    ['destinataire différent', txid => transferInfo({ txid, to: HEX.token })],
    ['expéditeur différent', txid => transferInfo({ txid, from: HEX.deployer })]
  ]) {
    const ctx = setup();
    const rec = await send(ctx);
    ctx.node.state.infoSol[rec.txid] = info(rec.txid);
    const r = await ctx.client.refreshRecord(rec);
    assert.equal(r.state, 'confirming', name);
    assert.equal(r.anomaly, 'transfer_event_not_found', name);
  }
});

test('sendTransfer : événement Transfer émis par UN AUTRE contrat n\'est pas accepté', async () => {
  const ctx = setup();
  const rec = await send(ctx);
  const info = transferInfo({ txid: rec.txid });
  info.log[0].address = '9f10b9a51361d13b1b0e6ac8f2d05bd95d65393e';
  ctx.node.state.infoSol[rec.txid] = info;
  const r = await ctx.client.refreshRecord(rec);
  assert.equal(r.state, 'confirming');
  assert.equal(r.anomaly, 'transfer_event_not_found');
});

test('sendTransfer : échec du contrat (REVERT) solidifié => failed avec la raison ; vu seulement sur le nœud complet => reste confirming', async () => {
  const ctx = setup();
  const rec = await send(ctx);
  const bad = transferInfo({ txid: rec.txid, result: 'REVERT', resMessage: hexMsg('YORUSDT: insufficient available balance') });
  ctx.node.state.infoFull[rec.txid] = bad;
  let r = await ctx.client.refreshRecord(rec);
  assert.equal(r.state, 'confirming');
  assert.equal(r.reason, 'PROVISIONAL_FAILURE');
  ctx.node.state.infoSol[rec.txid] = bad;
  r = await ctx.client.refreshRecord(r);
  assert.equal(r.state, 'failed');
  assert.equal(r.reason, 'YORUSDT: insufficient available balance');
});

test('sendTransfer : introuvable après expiration + 60 s => expired', async () => {
  const ctx = setup();
  const rec = await send(ctx);
  ctx.clock.advance(300_000 + 30_000);
  assert.equal((await ctx.client.refreshRecord(rec)).state, 'broadcasted');
  ctx.clock.advance(31_000);
  assert.equal((await ctx.client.refreshRecord(rec)).state, 'expired');
});

test('sendTransfer : refus de l\'utilisateur dans TronLink => cancelled, rien n\'est diffusé', async () => {
  const ctx = setup();
  const signer = fakeSigner();
  signer.signTransaction = async () => { const e = new Error('Signature rejected by the user'); e.code = 'SIGNATURE_REJECTED'; throw e; };
  await rejects(send(ctx, { signer }), 'SIGNATURE_REJECTED');
  assert.equal(ctx.node.calls.broadcasts, undefined);
  const [r] = ctx.client.records();
  assert.equal(r.state, 'cancelled');
});

test('sendTransfer : le portefeuille renvoie une AUTRE transaction => SIGNED_TX_MISMATCH, rien n\'est diffusé', async () => {
  const tweaks = {
    'txID différent': t => ({ ...t, txID: '11'.repeat(32) }),
    'raw_data_hex différent': t => ({ ...t, raw_data_hex: t.raw_data_hex.replace(/.$/, c => (c === '0' ? '1' : '0')) }),
    'JSON ≠ octets': t => { const x = JSON.parse(JSON.stringify(t)); x.raw_data.contract[0].parameter.value.data = x.raw_data.contract[0].parameter.value.data.slice(0, -2) + 'ff'; return x; },
    'sans signature': t => { const x = { ...t }; delete x.signature; return x; },
    'signature trop courte': t => ({ ...t, signature: ['ab'.repeat(64)] }),
    'deux signatures': t => ({ ...t, signature: ['ab'.repeat(65), 'cd'.repeat(65)] }),
    'signature non hexadécimale': t => ({ ...t, signature: ['zz'.repeat(65)] })
  };
  for (const [name, fn] of Object.entries(tweaks)) {
    const ctx = setup();
    await assert.rejects(send(ctx, { signer: fakeSigner(ADDR.user, fn) }), e => { assert.equal(e.code, 'SIGNED_TX_MISMATCH', name); return true; }, name);
    assert.equal(ctx.node.calls.broadcasts, undefined, name);
    assert.equal(ctx.client.records()[0].state, 'failed', name);
  }
});

test('sendTransfer : signature trop tardive (transaction expirée) => expired, rien n\'est diffusé', async () => {
  const ctx = setup();
  const signer = fakeSigner();
  const orig = signer.signTransaction;
  signer.signTransaction = async tx => { ctx.clock.advance(300_000 - 1_000); return orig(tx); };
  await rejects(send(ctx, { signer }), 'TX_EXPIRED');
  assert.equal(ctx.node.calls.broadcasts, undefined);
  assert.equal(ctx.client.records()[0].state, 'expired');
});

test('sendTransfer : signer après 90 s (échec avec l\'ancienne fenêtre de 60 s) fonctionne maintenant ; avec extendExpiration:false l\'ancien comportement subsiste', async () => {
  const ctx = setup();
  const signer = fakeSigner();
  const orig = signer.signTransaction;
  signer.signTransaction = async tx => { ctx.clock.advance(90_000); return orig(tx); };
  const rec = await send(ctx, { signer });
  assert.equal(rec.state, 'broadcasted');
  assert.equal(rec.extended, true);
  assert.equal(ctx.node.calls.broadcasts, 1);
  /* le contrôle de la transaction signée a bien porté sur la version allongée */
  const sent = ctx.node.calls.find(c => c.path === '/wallet/broadcasttransaction').body;
  assert.equal(sent.txID, sha256hex(sent.raw_data_hex));
  assert.equal(sent.raw_data.expiration - sent.raw_data.timestamp, 300_000);

  const ctx2 = setup();
  const signer2 = fakeSigner();
  const orig2 = signer2.signTransaction;
  signer2.signTransaction = async tx => { ctx2.clock.advance(90_000); return orig2(tx); };
  await rejects(send(ctx2, { signer: signer2, extendExpiration: false }), 'TX_EXPIRED');
  assert.equal(ctx2.node.calls.broadcasts, undefined);
});

test('sendTransfer : un portefeuille qui renvoie une transaction ≠ allongée (ex. remet l\'expiration d\'origine) est refusé (SIGNED_TX_MISMATCH), rien n\'est diffusé', async () => {
  const ctx = setup();
  const signer = fakeSigner(ADDR.user, t => {
    const x = JSON.parse(JSON.stringify(t));
    x.raw_data.expiration = x.raw_data.timestamp + 60_000;
    x.raw_data_hex = Y.L.encodeTriggerRawData(x.raw_data);
    x.txID = sha256hex(x.raw_data_hex);
    return x;
  });
  await rejects(send(ctx, { signer }), 'SIGNED_TX_MISMATCH');
  assert.equal(ctx.node.calls.broadcasts, undefined);
});

test('sendTransfer : diffusion refusée par le nœud => failed avec le code ; doublon => considéré comme diffusé ; expiration => expired', async () => {
  let ctx = setup({ broadcastResponse: { code: 'SIGERROR', message: hexMsg('Validate signature error') } });
  await assert.rejects(send(ctx), e => e.code === 'BROADCAST_REJECTED' && /SIGERROR: Validate signature error/.test(e.message));
  assert.equal(ctx.client.records()[0].state, 'failed');
  assert.equal(ctx.client.records()[0].reason, 'SIGERROR');

  ctx = setup({ broadcastResponse: { code: 'DUP_TRANSACTION_ERROR', message: hexMsg('dup') } });
  assert.equal((await send(ctx)).state, 'broadcasted');

  ctx = setup({ broadcastResponse: { code: 'TRANSACTION_EXPIRATION_ERROR', message: hexMsg('expired') } });
  await rejects(send(ctx), 'TX_EXPIRED');
  assert.equal(ctx.client.records()[0].state, 'expired');
});

test('sendTransfer : un transfert à la fois (double appui) et plafond revu à la hausse refusé', async () => {
  const ctx = setup();
  let release;
  const gate = new Promise(r => { release = r; });
  const slow = fakeSigner();
  const orig = slow.signTransaction;
  slow.signTransaction = async tx => { await gate; return orig(tx); };
  const first = send(ctx, { signer: slow });
  await new Promise(r => setImmediate(r));
  await rejects(send(ctx), 'BUSY');
  release();
  assert.equal((await first).state, 'broadcasted');

  const ctx2 = setup();
  await rejects(send(ctx2, { reviewed: { feeLimitSun: 1_000_000 } }), 'ESTIMATE_CHANGED');
  assert.equal(ctx2.node.calls.broadcasts, undefined);
});

test('sendTransfer : compte non activé / TRX insuffisants / solde de jeton insuffisant / mauvais compte connecté', async () => {
  let ctx = setup({ accounts: {} });
  await rejects(send(ctx), 'ACCOUNT_NOT_ACTIVATED');
  ctx = setup({ accounts: { [ADDR.user]: { address: ADDR.user, balance: 1_000_000 } } });   /* 1 TRX : insuffisant pour ~18,6 TRX */
  await rejects(send(ctx), 'INSUFFICIENT_TRX');
  ctx = setup();
  await rejects(send(ctx, { amountRaw: 1870000000001n }), 'INSUFFICIENT_TOKEN');
  ctx = setup();
  await rejects(send(ctx, { signer: fakeSigner(ADDR.deployer) }), 'SIGNER_ADDRESS_MISMATCH');
  for (const c of [ctx]) assert.equal(c.node.calls.broadcasts, undefined);
});

test('sendTransfer : un nœud malveillant qui falsifie la transaction => TX_CHECK_FAILED, la signature n\'est jamais demandée', async () => {
  const ctx = setup({ buildMutate: tx => { tx.raw_data.contract[0].parameter.value.data = tx.raw_data.contract[0].parameter.value.data.replace('9f10b9a5', 'aaaaaaaa'); return tx; } });
  const signer = fakeSigner();
  await rejects(send(ctx, { signer }), 'TX_CHECK_FAILED');
  assert.equal(signer.signed, 0);
  assert.equal(ctx.client.records()[0].state, 'failed');
});

/* ------------------------------------------------------------------ suivi, persistance, reprise */
test('persistance : les enregistrements survivent à un rechargement et la reprise mène la transaction jusqu\'à « confirmed »', async () => {
  const storage = memoryStorage();
  const ctx = setup({}, { storage });
  const rec = await send(ctx);
  assert.ok(storage.getItem('yor_chain_tx_v1_nile'));
  const saved = JSON.parse(storage.getItem('yor_chain_tx_v1_nile'));
  assert.equal(saved[0].txid, rec.txid);
  assert.equal(JSON.stringify(saved).includes('privateKey'), false);

  /* « rechargement » : nouveau client, même stockage et même chaîne */
  const clock2 = makeClock(ctx.clock.t);
  const client2 = Y.createClient({ fetch: ctx.node.fetch, now: clock2.now, mono: clock2.mono, sleep: async ms => { clock2.advance(ms); }, storage, window: null });
  assert.equal(client2.records().length, 1);
  assert.equal(client2.records()[0].state, 'broadcasted');
  ctx.node.state.infoFull[rec.txid] = transferInfo({ txid: rec.txid });
  ctx.node.state.infoSol[rec.txid] = transferInfo({ txid: rec.txid });
  const final = await client2.track(client2.records()[0]);
  assert.equal(final.state, 'confirmed');
  assert.equal(client2.records()[0].state, 'confirmed');
});

test('persistance : stockage corrompu ou indisponible n\'empêche pas le client de démarrer', async () => {
  const bad = memoryStorage();
  bad.setItem('yor_chain_tx_v1_nile', '{not json');
  assert.equal(setup({}, { storage: bad }).client.records().length, 0);
  const junk = memoryStorage();
  junk.setItem('yor_chain_tx_v1_nile', JSON.stringify([{ id: 'x', state: 'banana' }, null, 7, { id: 'ok', state: 'draft' }]));
  assert.deepEqual(setup({}, { storage: junk }).client.records().map(r => r.id), ['ok']);
  const ctx = setup({}, { storage: null });
  assert.equal((await send(ctx)).state, 'broadcasted');
});

test('suivi : un nœud injoignable pendant le suivi n\'invente jamais un état', async () => {
  const ctx = setup();
  const rec = await send(ctx);
  ctx.node.state.failFull = true; ctx.node.state.failSolid = true;
  await assert.rejects(ctx.client.refreshRecord(rec), e => e.code === 'NETWORK_UNREACHABLE');
  const tracked = await ctx.client.track(rec);       /* s'arrête à pollMaxMs sans rien conclure */
  assert.equal(tracked.state, 'broadcasted');
});

/* ------------------------------------------------------------------ événement Transfer (réel) et historique (réel) */
test('hasTransferEvent : fonctionne sur le reçu RÉEL du mint (Transfer 0 → utilisateur, 1 870 000)', () => {
  const { client } = setup();
  assert.equal(client.hasTransferEvent(MINT_INFO, ADDR.zero, ADDR.user, 1870000000000n), true);
  assert.equal(client.hasTransferEvent(MINT_INFO, ADDR.zero, ADDR.user, 1870000000001n), false);
  assert.equal(client.hasTransferEvent(MINT_INFO, ADDR.deployer, ADDR.user, 1870000000000n), false);
  assert.equal(client.hasTransferEvent({}, ADDR.zero, ADDR.user, 1n), false);
});

test('classify (lib partagée) sur le reçu RÉEL du mint : confirmed uniquement avec le nœud solidity', () => {
  const L = Y.L;
  assert.equal(L.classify(MINT_INFO, MINT_INFO, null, 0, false).state, 'confirmed');
  assert.equal(L.classify(MINT_INFO, {}, null, 0, false).state, 'confirming');
  assert.equal(L.classify({}, {}, null, 0, false).state, 'broadcasted');
  assert.equal(L.classify(MINT_INFO, MINT_INFO, null, 0, false).cost.feeSun, 19732300);
});

test('chainHistory : lit la forme réelle de TronGrid, ignore les lignes d\'un autre jeton ou mal formées', async () => {
  const dirty = JSON.parse(JSON.stringify(HISTORY));
  dirty.data.push({ ...HISTORY.data[0], transaction_id: 'aa'.repeat(32), token_info: { ...HISTORY.data[0].token_info, address: ADDR.deployer } });
  dirty.data.push({ ...HISTORY.data[0], transaction_id: 'zz', value: '5' });
  dirty.data.push({ ...HISTORY.data[0], transaction_id: 'bb'.repeat(32), value: '1.5' });
  dirty.data.push({ ...HISTORY.data[0], transaction_id: 'cc'.repeat(32), type: 'Approval' });
  const { client, node } = setup({ history: dirty });
  const rows = await client.chainHistory(ADDR.user, 20);
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { txid: HISTORY.data[0].transaction_id, from: ADDR.zero, to: ADDR.user, amountRaw: 1870000000000n, ts: 1791529626000, direction: 'in' });
  const req = node.calls.find(c => c.path.startsWith('/v1/accounts/'));
  assert.equal(req.method, 'GET');
  await rejects(client.chainHistory('nope', 5), 'INVALID_ADDRESS');
});

/* ------------------------------------------------------------------ TronLink */
test('TronLink (API récente window.tron) : connexion, adresse validée, réseau Nile reconnu', async () => {
  const fk = fakeTronLink('modern');
  const { client } = setup({}, { window: fk.win });
  assert.equal(client.wallet.available(), true);
  const st = await client.wallet.connect();
  assert.equal(st.connected, true);
  assert.equal(st.address, ADDR.user);
  assert.equal(st.network, 'nile');
  assert.equal(st.chainId, '0xcd8690dc');
  assert.deepEqual(fk.log.slice(0, 2), ['eth_requestAccounts', 'eth_chainId']);
  assert.equal(client.wallet.signer.configured, true);
  assert.equal(await client.wallet.signer.getAddress(), ADDR.user);
});

test('TronLink (ancienne API, navigateur DApp mobile) : tron_requestAccounts + window.tronWeb', async () => {
  const fk = fakeTronLink('legacy');
  const { client } = setup({}, { window: fk.win });
  const st = await client.wallet.connect();
  assert.equal(st.address, ADDR.user);
  assert.equal(st.network, 'nile');      /* identifié par l'hôte du nœud de TronLink */
  assert.equal(st.kind, 'tronLink');
  assert.equal(fk.log[0], 'tron_requestAccounts');
});

test('TronLink : mauvais réseau reconnu (mainnet / Shasta), jamais confondu avec Nile', async () => {
  for (const [opts, expected] of [
    [{ chainId: '0x2b6653dc' }, 'mainnet'], [{ chainId: '0x94a9059e' }, 'shasta'], [{ chainId: '0x1234' }, 'other'],
    [{ noChainId: true, host: 'https://api.trongrid.io' }, 'mainnet'], [{ noChainId: true, host: 'https://api.shasta.trongrid.io' }, 'shasta'],
    [{ noChainId: true, host: 'https://api.nileex.io' }, 'nile'], [{ noChainId: true, host: 'https://exemple.test' }, 'unknown']
  ]) {
    const { client } = setup({}, { window: fakeTronLink('modern', opts).win });
    assert.equal((await client.wallet.connect()).network, expected, JSON.stringify(opts));
  }
});

test('TronLink : refus de connexion (erreur levée ou code 4001 renvoyé), absence de portefeuille, compte verrouillé', async () => {
  let client = setup({}, { window: fakeTronLink('modern', { requestHook: async () => { throw Object.assign(new Error('The user rejected the request.'), { code: 4001 }); } }).win }).client;
  await assert.rejects(client.wallet.connect(), e => e.code === 'USER_REJECTED');
  client = setup({}, { window: fakeTronLink('legacy', { requestHook: async () => ({ code: 4001, message: 'The user rejected the request.' }) }).win }).client;
  await assert.rejects(client.wallet.connect(), e => e.code === 'USER_REJECTED');
  client = setup({}, { window: {} }).client;
  assert.equal(client.wallet.available(), false);
  await assert.rejects(client.wallet.connect(), e => e.code === 'NO_WALLET');
  client = setup({}, { window: fakeTronLink('modern', { address: 'pas une adresse', requestHook: async m => (m === 'eth_requestAccounts' ? [] : undefined) }).win }).client;
  await assert.rejects(client.wallet.connect(), e => e.code === 'NO_ACCOUNT');
});

test('TronLink : la signature passe par tronWeb.trx.sign ; refus utilisateur (chaîne ou code 4001) => SIGNATURE_REJECTED', async () => {
  const seen = [];
  const fk = fakeTronLink('modern', { sign: async tx => { seen.push(tx); return { ...tx, signature: ['ab'.repeat(65)] }; } });
  const ctx = setup({}, { window: fk.win });
  await ctx.client.wallet.connect();
  const rec = await ctx.client.sendTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n, signer: ctx.client.wallet.signer });
  assert.equal(rec.state, 'broadcasted');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].raw_data.fee_limit, 28_000_000);       /* le plafond affiché à l'utilisateur est celui qui est signé */

  for (const err of ['Confirmation declined by user', Object.assign(new Error('x'), { code: 4001 }), new Error('User rejected the request')]) {
    const fk2 = fakeTronLink('modern', { sign: async () => { throw err; } });
    const c2 = setup({}, { window: fk2.win });
    await c2.client.wallet.connect();
    await assert.rejects(c2.client.sendTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n, signer: c2.client.wallet.signer }), e => e.code === 'SIGNATURE_REJECTED');
    assert.equal(c2.client.records()[0].state, 'cancelled');
  }
  const fk3 = fakeTronLink('modern', { sign: async () => { throw new Error('boom'); } });
  const c3 = setup({}, { window: fk3.win });
  await c3.client.wallet.connect();
  await assert.rejects(c3.client.sendTransfer({ from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n, signer: c3.client.wallet.signer }), e => e.code === 'SIGNING_FAILED' && /boom/.test(e.message));
  assert.equal(c3.client.records()[0].state, 'failed');
});

test('TronLink : compte changé dans le portefeuille après la connexion => signature refusée (ACCOUNT_CHANGED)', async () => {
  const fk = fakeTronLink('modern');
  const ctx = setup({}, { window: fk.win });
  await ctx.client.wallet.connect();
  fk.tw.defaultAddress.base58 = ADDR.deployer;
  await assert.rejects(ctx.client.wallet.signer.signTransaction({}), e => e.code === 'ACCOUNT_CHANGED');
});

test('TronLink : le fournisseur n\'est « configuré » qu\'une fois connecté', async () => {
  const { client } = setup({}, { window: fakeTronLink('modern').win });
  assert.equal(client.wallet.signer.configured, false);
  await assert.rejects(client.wallet.signer.getAddress(), e => e.code === 'NOT_CONNECTED');
  await client.wallet.connect();
  assert.equal(client.wallet.signer.configured, true);
  client.wallet.disconnect();
  assert.equal(client.wallet.signer.configured, false);
});

test('classifyHost / isUserRejection', () => {
  assert.equal(Y.classifyHost('https://nile.trongrid.io'), 'nile');
  assert.equal(Y.classifyHost('https://api.trongrid.io'), 'mainnet');
  assert.equal(Y.classifyHost(''), 'unknown');
  assert.equal(Y.isUserRejection('Confirmation declined by user'), true);
  assert.equal(Y.isUserRejection({ code: 4001 }), true);
  assert.equal(Y.isUserRejection(new Error('network error')), false);
  assert.equal(Y.isUserRejection(null), false);
});

/* ------------------------------------------------------------------ révocations lisibles */
test('mapRevertReason : décode Error(string) du contrat', () => {
  const h = '08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000027594f52555344543a20696e73756666696369656e7420617661696c61626c652062616c616e636500000000000000000000000000000000000000000000000000';
  assert.equal(Y.mapRevertReason(h), 'YORUSDT: insufficient available balance');
  assert.equal(Y.mapRevertReason('deadbeef'), null);
  assert.equal(Y.mapRevertReason(null), null);
});

/* ------------------------------------------------------------------ hygiène du bundle */
test('bundle : aucun secret, aucune adresse de mainnet, un seul global (YorChain)', async () => {
  const { buildBundle } = await import('../../scripts/build-web.mjs');
  const code = buildBundle();
  assert.equal(/privateKey|private_key|mnemonic|seedPhrase|apiKey|api_key|TRON-PRO-API-KEY|service_role|x-token-admin-secret|defaultPrivateKey/i.test(code), false, 'identifiant sensible dans le bundle');
  assert.equal(/api\.trongrid\.io|api\.tronstack\.io/.test(code.replace(/api\\\.trongrid\\\.io\|api\\\.tronstack\\\.io/g, '')), true, 'les garde-fous mainnet doivent nommer les hôtes interdits');
  const win = {};
  const before = Object.keys(globalThis);
  loadChain(win);
  assert.deepEqual(Object.keys(win), ['YorChain']);
  assert.deepEqual(Object.keys(globalThis).filter(k => !before.includes(k)), []);
  assert.equal(Object.isFrozen(win.YorChain), true);
});

test('bundle : le fichier servi par l\'app (si présent) est identique au bundle recalculé', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { buildBundle } = await import('../../scripts/build-web.mjs');
  const served = resolve(dirname(fileURLToPath(import.meta.url)), '../../../yor-wallet/js/features/yor-chain.js');
  if (!existsSync(served)) return;   /* le dépôt yor-core seul n'embarque pas l'app web */
  assert.equal(readFileSync(served, 'utf8'), buildBundle(), 'régénérer avec : node scripts/build-web.mjs');
});

/* garde : le fichier de fixtures reste cohérent avec la config pinée */
test('fixtures : bloc 0 de Nile = identifiant pinné dans la configuration', () => {
  assert.equal(GENESIS.blockID, Y.CONFIG.network.genesisBlockId);
  assert.equal(sha256hex('00'), '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d');
});
