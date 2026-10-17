/* Outils de test du bundle navigateur : chargement, faux nœud TRON (réponses = fixtures.mjs), fausse horloge, faux TronLink. */
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { buildBundle } from '../../scripts/build-web.mjs';
import { ADDR, HEX, GENESIS, CHAIN_PARAMS, NAME_HEX, SYMBOL_HEX, DECIMALS_HEX, BALANCE_USER_HEX, constantOk, balanceResponse, SIM_OK, SIM_REVERT_BALANCE, HISTORY, word } from './fixtures.mjs';

let bundleCache = null;
/** Charge le bundle dans un `window` neuf et renvoie YorChain. */
export function loadChain(win = {}) {
  bundleCache = bundleCache || buildBundle();
  const saved = globalThis.window;
  globalThis.window = win;
  try { vm.runInThisContext(bundleCache, { filename: 'yor-chain.js' }); } finally { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; }
  return win.YorChain;
}

export const sha256hex = hex => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');

export function makeClock(start = 1791530408961) {
  const c = { t: start, m: 1000, now: () => c.t, mono: () => c.m, advance(ms) { c.t += ms; c.m += ms; } };
  return c;
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _m: m };
}

const ok = body => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))) });
const sel2 = s => s;

/** Faux nœud Nile. `state` est modifiable pendant le test. Chaque appel est enregistré dans `calls`. */
export function makeNode(Y, clock, init = {}) {
  const L = Y.L;
  const state = Object.assign({
    genesis: GENESIS,
    accounts: { [ADDR.user]: { address: ADDR.user, balance: 1_000_000_000 } },   /* 1000 TRX */
    resources: { [ADDR.user]: { freeNetLimit: 600, freeNetUsed: 0 } },
    balances: { [HEX.user]: 1_870_000_000_000n },
    available: null,                      /* null = identique à balances */
    energy: 186182,
    failSolid: false, failFull: false, failSolidRead: false,
    infoFull: {}, infoSol: {},
    broadcastResponse: null,
    builtTx: null,                        /* force la transaction renvoyée par triggersmartcontract */
    buildMutate: null,                    /* (tx) => tx modifié, pour simuler un nœud malveillant */
    history: HISTORY,
    chainParams: CHAIN_PARAMS
  }, init);
  const calls = [];
  const hexOfOwner = addr => (addr && /^T/.test(addr) ? Y.addrToHex(addr) : addr);

  function buildTx(body) {
    const raw = {
      ref_block_bytes: '8c7d', ref_block_hash: 'fbe0c95bdf22356f', expiration: clock.t + 57500,
      contract: [{ parameter: { value: { owner_address: body.owner_address, contract_address: body.contract_address, data: 'a9059cbb' + body.parameter }, type_url: 'type.googleapis.com/protocol.TriggerSmartContract' }, type: 'TriggerSmartContract' }],
      timestamp: clock.t, fee_limit: body.fee_limit
    };
    const rawHex = L.encodeTriggerRawData(raw);
    return { raw_data: raw, raw_data_hex: rawHex, txID: sha256hex(rawHex), visible: false };
  }

  async function fetchImpl(url, init2) {
    const u = new URL(url);
    const path = u.pathname;
    const body = init2 && init2.body ? JSON.parse(init2.body) : null;
    calls.push({ path, host: u.host, method: init2 && init2.method, body });
    const solid = path.startsWith('/walletsolidity/');
    if (state.failFull && !solid) throw new Error('network down');
    if (state.failSolid && solid) throw new Error('network down');
    if (path === '/wallet/getblockbynum') return ok(state.genesis);
    if (path === '/wallet/getchainparameters') return ok(state.chainParams);
    if (path === '/wallet/getaccount') return ok(state.accounts[body.address] || {});
    if (path === '/wallet/getaccountresource') return ok(state.resources[body.address] || {});
    if (path.endsWith('/triggerconstantcontract')) {
      if (solid && state.failSolidRead) return ok({ result: { result: false, code: 'OTHER_ERROR', message: 'solidity not ready' } });
      const s = body.function_selector;
      const owner = hexOfOwner(body.owner_address);
      const bal = h => state.balances[h] ?? 0n;
      const avail = h => (state.available ? (state.available[h] ?? 0n) : bal(h));
      if (s === 'name()') return ok(constantOk(state.nameHex || NAME_HEX));
      if (s === 'symbol()') return ok(constantOk(SYMBOL_HEX));
      if (s === 'decimals()') return ok(constantOk(DECIMALS_HEX));
      if (s === 'totalSupply()') return ok(balanceResponse(word(1_870_000_000_000n)));
      if (s === 'balanceOf(address)') return ok(balanceResponse(word(bal('41' + body.parameter.slice(24)))));
      if (s === 'availableBalanceOf(address)') return ok(balanceResponse(word(avail('41' + body.parameter.slice(24)))));
      if (s === 'expiredBalanceOf(address)') return ok(balanceResponse(word(0n)));
      if (s === 'transfer(address,uint256)') {
        const amount = BigInt('0x' + body.parameter.slice(64));
        if (state.simRevert || amount > avail(owner)) return ok(state.simRevert && state.simRevert !== true ? state.simRevert : SIM_REVERT_BALANCE);
        return ok(Object.assign({}, SIM_OK, { energy_used: state.energy }));
      }
      throw new Error('unexpected selector ' + s);
    }
    if (path === '/wallet/triggersmartcontract') {
      let tx = state.builtTx ? JSON.parse(JSON.stringify(state.builtTx)) : buildTx(body);
      if (state.buildMutate) tx = state.buildMutate(tx);
      return ok({ transaction: tx, result: { result: true } });
    }
    if (path === '/wallet/broadcasttransaction') {
      calls.broadcasts = (calls.broadcasts || 0) + 1;
      return ok(state.broadcastResponse || { result: true, txid: body.txID });
    }
    if (path === '/wallet/gettransactioninfobyid') return ok(state.infoFull[body.value] || {});
    if (path === '/walletsolidity/gettransactioninfobyid') return ok(state.infoSol[body.value] || {});
    if (path.startsWith('/v1/accounts/')) return ok(state.history);
    throw new Error('unexpected request ' + path);
  }
  return { state, calls, fetch: fetchImpl, sel2 };
}

export function fakeSigner(addr = ADDR.user, tweak) {
  const s = {
    id: 'fake', configured: true, address: addr, signed: 0,
    async getAddress() { return addr; },
    async signTransaction(tx) { s.signed++; const out = Object.assign({}, tx, { signature: ['ab'.repeat(65)] }); return tweak ? tweak(out) : out; }
  };
  return s;
}

/** Faux TronLink. `kind` : 'modern' (window.tron + eth_requestAccounts) ou 'legacy' (window.tronLink + tron_requestAccounts). */
export function fakeTronLink(kind = 'modern', opts = {}) {
  const log = [];
  const handlers = {};
  const tw = {
    defaultAddress: { base58: opts.address || ADDR.user },
    fullNode: { host: opts.host || 'https://nile.trongrid.io' },
    trx: { sign: opts.sign || (async tx => Object.assign({}, tx, { signature: ['ab'.repeat(65)] })) }
  };
  const request = async ({ method }) => {
    log.push(method);
    if (opts.requestHook) { const r = await opts.requestHook(method); if (r !== undefined) return r; }
    if (kind === 'modern') {
      if (method === 'eth_requestAccounts') return [opts.address || ADDR.user];
      if (method === 'eth_chainId') { if (opts.noChainId) throw Object.assign(new Error('unsupported'), { code: 4200 }); return opts.chainId || '0xcd8690dc'; }
      throw Object.assign(new Error('unsupported'), { code: 4200 });
    }
    if (method === 'tron_requestAccounts') return { code: 200, message: 'ok' };
    throw Object.assign(new Error('unsupported'), { code: 4200 });
  };
  const provider = { request, on(ev, fn) { handlers[ev] = fn; } };
  if (kind === 'modern') provider.tronWeb = tw;
  const win = { addEventListener() {} };
  if (kind === 'modern') win.tron = provider; else { win.tronLink = provider; win.tronWeb = tw; }
  return { win, tw, log, handlers, provider };
}
