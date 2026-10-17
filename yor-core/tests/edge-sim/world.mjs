// Faux Supabase (app_private en mémoire) + faux nœud TRON, pour exécuter index.ts tel quel (sans réseau).
// Les primitives cryptographiques (secp256k1, keccak, sha256 de noble) sont remplacées par des stubs (voir hooks.mjs) : la vraie
// cryptographie est prouvée dans l'environnement réel (action selftest, déploiement et grant_minter acceptés par Nile).
import { createHash } from 'node:crypto';
import { keccak_256 } from './stubs/keccak.mjs';

export const SUPA = 'https://fake.supabase.co';
export const SECRET = 'test-secret-value';
export const KEY_HEX = '11'.repeat(32);
const hex = (b) => Buffer.from(b).toString('hex');
const sha = (h) => createHash('sha256').update(Buffer.from(h, 'hex')).digest('hex');
const k4 = (sig) => hex(keccak_256(new TextEncoder().encode(sig))).slice(0, 8);
export const MINTER = hex(keccak_256(new TextEncoder().encode('MINTER_ROLE')));
const ZERO = '00'.repeat(32);
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const textHex = (s) => Buffer.from(s).toString('hex');

const varint = (n) => { let v = BigInt(n), o = ''; while (v >= 0x80n) { o += (Number(v & 0x7fn) | 0x80).toString(16).padStart(2, '0'); v >>= 7n; } return o + Number(v).toString(16).padStart(2, '0'); };
const lenf = (tag, h) => tag + varint(h.length / 2) + h;

export function makeWorld() {
  const db = new Map();
  const w = {
    db, token: '41' + 'ab'.repeat(20), deployer: null, block: 100, calls: [], broadcasts: [],
    energyFee: 100, tamper: null, rejectBroadcast: false, solidityDown: false,
    full: { roles: new Set(), balances: new Map(), supply: 0n }, solid: { roles: new Set(), balances: new Map(), supply: 0n },
    accounts: new Map(), info: new Map(), sol: new Map(), txs: new Map(),
  };
  const env = { SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: 'srv' };
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__handler = h; }, readFile: async () => { throw new Error('no fs'); } };

  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

  function rest(method, u, body, headers) {
    const key = u.searchParams.get('key');
    if (method === 'GET') {
      const m = /^in\.\((.*)\)$/.exec(key); const keys = m[1].split(',');
      return json(keys.filter((k) => db.has(k)).map((k) => ({ key: k, value: db.get(k) })));
    }
    if (method === 'POST') {
      const [row] = JSON.parse(body); const prefer = headers.Prefer || '';
      if (prefer.includes('ignore-duplicates')) { if (db.has(row.key)) return json([]); db.set(row.key, row.value); return json([row]); }
      db.set(row.key, row.value); return json([row]);
    }
    const k = key.replace(/^eq\./, ''), v = u.searchParams.get('value')?.replace(/^eq\./, '');
    if (method === 'PATCH') { if (db.get(k) !== v) return json([]); db.set(k, JSON.parse(body).value); return json([{ key: k, value: db.get(k) }]); }
    if (method === 'DELETE') { if (db.get(k) === v) db.delete(k); return json([]); }
    return json({ error: 'x' }, 400);
  }

  const stateOf = (solidity) => (solidity ? w.solid : w.full);
  const bal = (s, a) => s.balances.get(a) ?? 0n;
  function constant(path, b) {
    const solidity = path.startsWith('/walletsolidity');
    if (solidity && w.solidityDown) return json({ Error: 'solidity node does not support' }, 404);
    const s = stateOf(solidity), sel = b.function_selector, p = b.parameter || '', caller = b.owner_address;
    const ok = (hexOut, energy = 1000) => json({ result: { result: true }, energy_used: energy, constant_result: [hexOut], transaction: { ret: [{}] } });
    const revert = (msg) => json({ result: { result: true, code: 'CONTRACT_EXE_ERROR', message: textHex(msg) }, constant_result: [''], transaction: { ret: [{ contractRet: 'REVERT' }] } });
    if (b.contract_address !== w.token) return json({ result: { result: false, code: 'OTHER_ERROR', message: textHex('no contract') } });
    switch (sel) {
      case 'MINTER_ROLE()': return ok(MINTER);
      case 'totalSupply()': return ok(word(s.supply));
      case 'hasRole(bytes32,address)': return ok(word(s.roles.has(p.slice(0, 64) + ':41' + p.slice(88, 128)) ? 1 : 0));
      case 'balanceOf(address)': case 'availableBalanceOf(address)': return ok(word(bal(s, '41' + p.slice(24, 64))));
      case 'lotCount(address)': return ok(word(bal(s, '41' + p.slice(24, 64)) > 0n ? 1 : 0));
      case 'grantRole(bytes32,address)': return s.roles.has(ZERO + ':' + caller) ? ok('', 30000) : revert('YORUSDT: missing role');
      case 'mint(address,uint256,uint64)': return s.roles.has(MINTER + ':' + caller) ? ok(word(1), 250000) : revert('YORUSDT: missing role');
    }
    return json({ result: { result: false, code: 'OTHER_ERROR', message: textHex('unknown ' + sel) } });
  }

  function buildTrigger(b) {
    const data = k4(b.function_selector) + (b.parameter || '');
    const now = Date.now();
    const raw = { ref_block_bytes: 'abcd', ref_block_hash: '0102030405060708', expiration: now + 60000, timestamp: now, fee_limit: b.fee_limit,
      contract: [{ type: 'TriggerSmartContract', parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract', value: { owner_address: b.owner_address, contract_address: b.contract_address, data } } }] };
    const url = textHex('type.googleapis.com/protocol.TriggerSmartContract');
    const value = lenf('0a', b.owner_address) + lenf('12', b.contract_address) + lenf('22', data);
    const ctr = '081f' + lenf('12', lenf('0a', url) + lenf('12', value));
    const rawHex = lenf('0a', 'abcd') + lenf('22', '0102030405060708') + '40' + varint(raw.expiration) + lenf('5a', ctr) + '70' + varint(raw.timestamp) + '9001' + varint(raw.fee_limit);
    const resp = { result: { result: true }, transaction: { visible: false, txID: sha(rawHex), raw_data: raw, raw_data_hex: rawHex } };
    return w.tamper ? w.tamper(resp, b) : resp;
  }

  function apply(s, tx) {
    const v = tx.raw_data.contract[0].parameter.value, d = v.data, sel = d.slice(0, 8);
    if (sel === k4('grantRole(bytes32,address)')) s.roles.add(d.slice(8, 72) + ':41' + d.slice(96, 136));
    if (sel === k4('mint(address,uint256,uint64)')) { const to = '41' + d.slice(32, 72), amt = BigInt('0x' + d.slice(72, 136)); s.balances.set(to, bal(s, to) + amt); s.supply += amt; }
  }
  w.mine = (txid, result = 'SUCCESS') => {
    const tx = w.txs.get(txid); w.block++;
    w.info.set(txid, { blockNumber: w.block, receipt: { result, energy_usage_total: 250000, energy_fee: 25_000_000 }, fee: 25_000_000, contract_address: w.token });
    if (result === 'SUCCESS') apply(w.full, tx);
  };
  w.solidify = (txid, result = 'SUCCESS') => {
    const tx = w.txs.get(txid);
    w.sol.set(txid, { blockNumber: w.info.get(txid).blockNumber, receipt: { result, energy_usage_total: 250000, energy_fee: 25_000_000 }, fee: 25_000_000, contract_address: w.token });
    if (result === 'SUCCESS') apply(w.solid, tx);
  };

  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET';
    if (u.origin === SUPA) return rest(method, u, init.body, init.headers || {});
    if (u.origin !== 'https://nile.trongrid.io') throw new Error('hors réseau de test : ' + u.origin);
    const b = init.body ? JSON.parse(init.body) : {};
    w.calls.push(u.pathname);
    switch (u.pathname) {
      case '/wallet/getchainparameters': return json({ chainParameter: [{ key: 'getEnergyFee', value: w.energyFee }, { key: 'getMaxFeeLimit', value: 15_000_000_000 }, { key: 'getTransactionFee', value: 1000 }] });
      case '/wallet/getaccount': return json(w.accounts.has(b.address) ? { address: b.address, balance: w.accounts.get(b.address) } : {});
      case '/wallet/triggerconstantcontract': case '/walletsolidity/triggerconstantcontract': return constant(u.pathname, b);
      case '/wallet/triggersmartcontract': return json(buildTrigger(b));
      case '/wallet/broadcasttransaction': {
        w.broadcasts.push(b);
        if (w.rejectBroadcast) return json({ result: false, code: 'SIGERROR', message: textHex('validate signature error') });
        if (!Array.isArray(b.signature) || b.signature.length !== 1 || !/^[0-9a-f]{130}$/.test(b.signature[0])) return json({ result: false, code: 'SIGERROR', message: textHex('bad signature') });
        if (sha(b.raw_data_hex) !== b.txID) return json({ result: false, code: 'OTHER_ERROR', message: textHex('txid mismatch') });
        w.txs.set(b.txID, b); return json({ result: true, txid: b.txID });
      }
      case '/wallet/gettransactioninfobyid': return json(w.info.get(b.value) ?? {});
      case '/walletsolidity/gettransactioninfobyid': return json(w.sol.get(b.value) ?? {});
    }
    return json({ Error: 'route inconnue ' + u.pathname }, 404);
  };

  w.call = async (method, qs, { secret = SECRET } = {}) => {
    const res = await globalThis.__handler(new Request('https://x/functions/v1/token-admin?' + qs, { method, headers: secret === null ? {} : { 'x-token-admin-secret': secret } }));
    const text = await res.text();
    w.log = (w.log ?? []).concat(text);
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  };

  w.setup = async () => {
    db.set('token_admin_secret', SECRET);
    db.set('deployer_testnet_key', KEY_HEX);
    await import(process.env.INDEX_URL ?? new URL('../../supabase/functions/token-admin/index.ts', import.meta.url).href);
    const a = await w.call('GET', 'action=address');
    w.deployer = a.body.hex41; w.deployerB58 = a.body.address;
    w.accounts.set(w.deployer, 1_000_000_000);
    w.full.roles.add(ZERO + ':' + w.deployer); w.solid.roles.add(ZERO + ':' + w.deployer);
    const deployTx = 'd'.repeat(64);
    db.set('yor_deploy_nile', JSON.stringify({ v: 1, network: 'nile', txid: deployTx, deployer: w.deployerB58, deployerHex41: w.deployer, expectedContractHex41: w.token, feeLimitSun: 945_000_000, expiration: Date.now() + 1e9, status: 'confirmed', contractHex41: w.token, at: new Date().toISOString() }));
    const sol = { blockNumber: 5, receipt: { result: 'SUCCESS' }, contract_address: w.token };
    w.sol.set(deployTx, sol); w.info.set(deployTx, sol);
    return w;
  };
  return w;
}
