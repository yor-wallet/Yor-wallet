import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, KEY_HEX, SECRET } from './world.mjs';

const w = await makeWorld().setup();
const TO = 'TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad'; // adresse valide (vecteur du dépôt) servant ici de « portefeuille utilisateur »
const grantKey = 'yor_op_nile_grant_minter', mintKey = 'yor_op_nile_testmint';

test('accès : sans secret => 401 ; réseau principal => refusé ; action inconnue => 400', async () => {
  assert.equal((await w.call('GET', 'action=callplan', { secret: null })).status, 401);
  assert.equal((await w.call('GET', 'action=callplan', { secret: 'faux' })).status, 401);
  assert.equal((await w.call('GET', 'action=callplan&network=mainnet')).body.error, 'mainnet_refused');
  assert.equal((await w.call('POST', 'action=testmint&network=mainnet&to=' + TO + '&fee_limit_trx=60')).body.error, 'mainnet_refused');
  assert.equal((await w.call('POST', 'action=grant_minter&network=mainnet&fee_limit_trx=5')).body.error, 'mainnet_refused');
  assert.equal((await w.call('GET', 'action=nimporte')).status, 400);
  assert.equal((await w.call('GET', 'action=testmint')).status, 405, 'une écriture exige POST');
  assert.equal((await w.call('POST', 'action=callplan')).status, 405, 'une lecture exige GET');
});

test('ping v5', async () => {
  const r = await w.call('GET', 'action=ping');
  // ping a besoin des sources du contrat : absentes du faux dépôt => erreur attendue et propre, pas de plantage
  assert.ok([200, 500].includes(r.status));
});

test('callplan avant tout : grant simulé et construit à blanc (17 contrôles), mint non simulable', async () => {
  const r = await w.call('GET', 'action=callplan&network=nile&to=' + TO);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.roles.deployerIsAdmin, true);
  assert.equal(r.body.roles.deployerHasMinterRoleFullnode, false);
  assert.equal(r.body.totalSupplyRaw, '0');
  assert.equal(r.body.testBalance.unitsRaw, '1870000000000');
  const g = r.body.steps.grant_minter;
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(g.simulatedEnergy, 30000);
  assert.equal(g.simulatedCostTrx, 3);
  assert.equal(g.suggestedFeeLimitTrx, 5, 'ceil(1,5 x 3 TRX)');
  assert.deepEqual(g.buildChecks, { count: 17, allPassed: true });
  assert.equal(g.signed, false); assert.equal(g.broadcast, false);
  assert.match(String(r.body.steps.testmint.skipped), /minter_role_missing/);
  assert.equal(w.broadcasts.length, 0, 'rien n\'a été diffusé');
  assert.equal(r.body.claims.grant_minter, null);
});

test('grant_minter : plafond obligatoire, borné, et couvrant le coût simulé', async () => {
  const base = 'action=grant_minter&network=nile';
  assert.equal((await w.call('POST', base)).body.error, 'fee_limit_trx_required');
  assert.equal((await w.call('POST', base + '&fee_limit_trx=0')).body.error, 'fee_limit_trx_required');
  assert.equal((await w.call('POST', base + '&fee_limit_trx=501')).body.error, 'fee_limit_trx_required', 'au-dessus du plafond de sécurité');
  assert.equal((await w.call('POST', base + '&fee_limit_trx=abc')).body.error, 'fee_limit_trx_required');
  const low = await w.call('POST', base + '&fee_limit_trx=3');
  assert.equal(low.status, 400); assert.equal(low.body.error, 'fee_limit_too_low'); assert.equal(low.body.minimumTrx, 4, '1,2 x 3 TRX = 3,6 => 4');
  assert.equal(w.broadcasts.length, 0); assert.equal(w.db.has(grantKey), false, 'aucune réservation sur un refus');
});

test('testmint avant grant : refusé (rôle non confirmé), rien de diffusé', async () => {
  const r = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(r.status, 409); assert.equal(r.body.error, 'minter_role_not_confirmed');
  assert.equal(w.broadcasts.length, 0);
});

test('grant_minter : transaction altérée par le nœud (autre destinataire du rôle) => refusée avant signature', async () => {
  const evil = '41' + 'ee'.repeat(20);
  w.tamper = (resp, b) => { // le nœud « remplace » l'argument ET recalcule tout de façon cohérente
    const v = resp.transaction.raw_data.contract[0].parameter.value;
    const bad = v.data.slice(0, 96) + evil.slice(2);
    const hexOld = resp.transaction.raw_data_hex;
    resp.transaction.raw_data_hex = hexOld.replace(v.data, bad); v.data = bad;
    resp.transaction.txID = require_sha(resp.transaction.raw_data_hex);
    return resp;
  };
  const r = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(r.status, 502); assert.equal(r.body.error, 'built_tx_mismatch'); assert.ok(r.body.failed.includes('data_matches_selector_and_arguments'), JSON.stringify(r.body.failed));
  assert.equal(w.broadcasts.length, 0); assert.equal(w.db.has(grantKey), false);
  w.tamper = null;
});
import { createHash } from 'node:crypto';
function require_sha(h) { return createHash('sha256').update(Buffer.from(h, 'hex')).digest('hex'); }

test('grant_minter : JSON honnête mais octets signés différents => refusé', async () => {
  w.tamper = (resp) => { resp.transaction.raw_data_hex = resp.transaction.raw_data_hex.replace('abcd', 'abce'); resp.transaction.txID = require_sha(resp.transaction.raw_data_hex); return resp; };
  const r = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(r.status, 502); assert.ok(r.body.failed.includes('raw_data_hex_equals_reencoded_raw_data'), JSON.stringify(r.body));
  assert.equal(w.broadcasts.length, 0);
  w.tamper = null;
});

test('grant_minter : rejet de diffusion par le nœud => réservation libérée', async () => {
  w.rejectBroadcast = true;
  const r = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(r.status, 502); assert.equal(r.body.error, 'broadcast_rejected'); assert.equal(r.body.message, 'validate signature error');
  assert.equal(w.db.has(grantKey), false, 'réservation supprimée');
  assert.equal(w.broadcasts.length, 1, 'une tentative refusée par le nœud');
  w.broadcasts.length = 0; // le faux nœud journalise aussi les tentatives refusées
  w.rejectBroadcast = false;
});

let grantTx;
test('grant_minter : diffusé => « broadcasted » (jamais confirmed), réservation écrite', async () => {
  const r = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state, 'broadcasted'); assert.match(r.body.note, /PAS confirme/);
  grantTx = r.body.txid;
  const claim = JSON.parse(w.db.get(grantKey));
  assert.equal(claim.status, 'broadcasted'); assert.equal(claim.op, 'grant_minter'); assert.equal(claim.txid, grantTx);
  assert.equal(w.broadcasts.length, 1);
  assert.equal(w.broadcasts[0].signature.length, 1);
  assert.equal((await w.call('GET', 'action=opstatus&network=nile&op=grant_minter')).body.state, 'broadcasted', 'introuvable sur la chaîne = broadcasted');
});

test('grant_minter : second appel pendant l\'attente => refusé (pas de double diffusion)', async () => {
  const r = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(r.status, 409); assert.equal(r.body.error, 'operation_in_progress'); assert.equal(w.broadcasts.length, 1);
});

test('testmint : tant que le rôle n\'est pas SOLIDIFIÉ, refus même si le nœud complet l\'a vu', async () => {
  w.mine(grantTx);
  const st = await w.call('GET', 'action=opstatus&network=nile&op=grant_minter');
  assert.equal(st.body.state, 'confirming', 'vu sur le nœud complet seulement');
  const r = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(r.status, 409); assert.equal(r.body.error, 'minter_role_not_confirmed'); assert.equal(r.body.source, 'solidity');
});

test('opstatus grant_minter : confirmed seulement après solidification + SUCCESS + lecture on-chain', async () => {
  w.solidify(grantTx);
  const st = await w.call('GET', 'action=opstatus&network=nile&op=grant_minter');
  assert.equal(st.body.state, 'confirmed'); assert.equal(st.body.verification.ok, true); assert.equal(st.body.verification.source, 'solidity');
  assert.equal(st.body.costReal.feeSun, 25_000_000);
  assert.equal(JSON.parse(w.db.get(grantKey)).status, 'confirmed');
  const again = await w.call('POST', 'action=grant_minter&network=nile&fee_limit_trx=5');
  assert.equal(again.status, 409); assert.equal(again.body.error, 'already_done');
});

test('callplan après grant : mint simulé (250 000 énergie = 25 TRX), contrôles OK', async () => {
  const r = await w.call('GET', 'action=callplan&network=nile&to=' + TO);
  assert.equal(r.body.roles.deployerHasMinterRoleConfirmed, true);
  const m = r.body.steps.testmint;
  assert.equal(m.ok, true, JSON.stringify(m)); assert.equal(m.simulatedCostTrx, 25); assert.equal(m.suggestedFeeLimitTrx, 38);
  assert.deepEqual(m.buildChecks, { count: 17, allPassed: true });
});

test('testmint : destinataires invalides refusés avant toute diffusion', async () => {
  const q = (to) => 'action=testmint&network=nile&fee_limit_trx=60&to=' + encodeURIComponent(to);
  assert.equal((await w.call('POST', 'action=testmint&network=nile&fee_limit_trx=60')).body.error, 'to_required');
  assert.equal((await w.call('POST', q('TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyae'))).body.error, 'bad_to_address', 'mauvais contrôle');
  assert.equal((await w.call('POST', q('0x' + 'a'.repeat(40)))).body.error, 'bad_to_address');
  assert.equal((await w.call('POST', q('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'))).body.error, 'to_is_zero_address');
  assert.equal(w.broadcasts.length, 1, 'seul le grant a été diffusé');
});

test('testmint : plafond trop bas refusé ; adresse du contrat refusée', async () => {
  const low = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=29');
  assert.equal(low.body.error, 'fee_limit_too_low'); assert.equal(low.body.minimumTrx, 30, '1,2 x 25 TRX');
  const tokenB58 = (await w.call('GET', 'action=callplan&network=nile')).body.token.address;
  const toToken = await w.call('POST', 'action=testmint&network=nile&fee_limit_trx=60&to=' + tokenB58);
  assert.equal(toToken.body.error, 'to_is_token_contract');
  assert.equal(w.broadcasts.length, 1);
});

let mintTx;
test('testmint : diffusé => broadcasted ; le solde n\'existe pas encore tant que rien n\'est confirmé', async () => {
  const r = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.state, 'broadcasted'); assert.equal(r.body.to, TO);
  mintTx = r.body.txid;
  const claim = JSON.parse(w.db.get(mintKey));
  assert.equal(claim.units, '1870000000000'); assert.equal(claim.to.length, 42); assert.equal(claim.op, 'testmint');
  const st = await w.call('GET', 'action=opstatus&network=nile&op=testmint');
  assert.equal(st.body.state, 'broadcasted'); assert.equal(st.body.verification, null); assert.equal(st.body.testBalance, undefined);
  const dup = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(dup.body.error, 'operation_in_progress'); assert.equal(w.broadcasts.length, 2);
});

test('testmint : échec solidifié (REVERT) => failed, aucune offre créée, nouvel essai permis', async () => {
  w.mine(mintTx, 'REVERT'); w.solidify(mintTx, 'REVERT');
  const st = await w.call('GET', 'action=opstatus&network=nile&op=testmint');
  assert.equal(st.body.state, 'failed'); assert.equal(st.body.receiptResult, 'REVERT'); assert.equal(st.body.testBalance, undefined);
  assert.equal(w.solid.supply, 0n);
  // nouvel essai (état failed) : accepté, remplace la réservation
  const r = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(r.status, 200, JSON.stringify(r.body)); mintTx = r.body.txid;
  assert.equal(w.broadcasts.length, 3);
});

test('testmint : confirmed + TEST BALANCE lu on-chain = 1 870 000,000000', async () => {
  w.mine(mintTx);
  assert.equal((await w.call('GET', 'action=opstatus&network=nile&op=testmint')).body.state, 'confirming');
  w.solidify(mintTx);
  const st = await w.call('GET', 'action=opstatus&network=nile&op=testmint');
  assert.equal(st.body.state, 'confirmed', JSON.stringify(st.body));
  assert.equal(st.body.verification.ok, true); assert.equal(st.body.verification.source, 'solidity');
  assert.equal(st.body.verification.balanceOfRaw, '1870000000000'); assert.equal(st.body.verification.totalSupplyRaw, '1870000000000');
  assert.equal(st.body.testBalance.label, 'TEST BALANCE'); assert.equal(st.body.testBalance.balance, '1870000.000000');
  assert.equal(st.body.testBalance.holder, TO); assert.match(st.body.testBalance.note, /pas declare/);
  assert.equal(JSON.parse(w.db.get(mintKey)).status, 'confirmed');
});

test('double mint impossible : réservation confirmée ET verrou totalSupply', async () => {
  const again = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(again.status, 409); assert.equal(again.body.error, 'already_done');
  w.db.delete(mintKey); // même si la réservation était perdue : l'offre n'est plus nulle
  const lost = await w.call('POST', 'action=testmint&network=nile&to=' + TO + '&fee_limit_trx=60');
  assert.equal(lost.status, 409); assert.equal(lost.body.error, 'supply_not_zero'); assert.equal(lost.body.totalSupplyRaw, '1870000000000');
  assert.equal(w.broadcasts.length, 3, 'aucune diffusion supplémentaire');
});

test('anomalie : SUCCESS mais solde on-chain différent => pas de « TEST BALANCE »', async () => {
  const claim = JSON.parse(w.db.get(grantKey));
  // réservation de mint fabriquée : montant attendu différent de l'état de la chaîne
  w.db.set(mintKey, JSON.stringify({ ...claim, op: 'testmint', txid: mintTx, to: w.deployer, units: '1870000000000', status: 'broadcasted' }));
  const st = await w.call('GET', 'action=opstatus&network=nile&op=testmint');
  assert.equal(st.body.state, 'confirmed'); assert.equal(st.body.verification.ok, false); assert.equal(st.body.testBalance, undefined); assert.match(st.body.note, /ANOMALIE/);
  assert.equal(JSON.parse(w.db.get(mintKey)).status, 'broadcasted', 'pas marqué confirmed');
});

test('repli : noeud solidity indisponible => lecture signalée « fullnode_fallback », jamais présentée comme solidifiée', async () => {
  const claim = JSON.parse(w.db.get(grantKey));
  w.db.set(mintKey, JSON.stringify({ ...claim, op: 'testmint', txid: mintTx, to: '41' + Buffer.from(TO).toString('hex').slice(0, 40).replace(/[^0-9a-f]/g, '0'), units: '1870000000000', status: 'broadcasted' }));
  w.solidityDown = true;
  const st = await w.call('GET', 'action=opstatus&network=nile&op=testmint');
  assert.equal(st.body.verification.source, 'fullnode_fallback');
  w.solidityDown = false;
});

test('la clé privée n\'apparaît dans AUCUNE réponse', () => {
  assert.ok(w.log.length > 20);
  for (const t of w.log) { assert.equal(t.includes(KEY_HEX), false); assert.equal(t.includes(SECRET), false); }
});
