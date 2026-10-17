/* YOR WALLET — client blockchain (navigateur). TESTNET NILE UNIQUEMENT.
   Ce fichier est la SEULE partie écrite à la main du bundle `yor-wallet/js/features/yor-chain.js`
   (scripts/build-web.mjs l'assemble avec supabase/functions/token-admin/lib.ts et transfer-state.mjs).
   Il s'exécute dans un contexte où `L` (lib.ts : adresses, ABI, contrôle de transaction, classification)
   et `S` (machine d'états d'un transfert) sont déjà définis. Aucune dépendance externe.

   Règles V2 appliquées ici :
   - AUCUNE clé privée, phrase de récupération ou seed : la signature est faite par TronLink (portefeuille de l'utilisateur) ;
   - la blockchain est la source de vérité (balanceOf lu sur le nœud solidity, repli sur le nœud complet ÉTIQUETÉ) ;
   - une transaction renvoyée par le nœud n'est JAMAIS signée sans contrôle (L.checkTriggerTx : 17 vérifications,
     dont le ré-encodage protobuf de raw_data qui doit redonner EXACTEMENT raw_data_hex) ;
   - « confirmed » exige : nœud solidity + bloc > 0 + receipt SUCCESS + événement Transfer correspondant ;
   - jamais de mainnet : la configuration est refusée au démarrage si elle pointe vers le mainnet ;
   - aucune adresse, aucun frais inventé : les frais viennent de la simulation et des paramètres de chaîne lus sur le nœud. */

/* ------------------------------------------------------------------ configuration (valeurs vérifiées sur le nœud Nile réel, 2026-10-09) */
const CONFIG = Object.freeze({
  env: 'testnet',
  network: Object.freeze({
    id: 'nile',
    name: 'Nile Testnet',
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io/walletsolidity',
    /* identifiant du bloc 0 lu sur nile.trongrid.io ; les 4 derniers octets (cd8690dc) sont l'identifiant de chaîne de TronLink */
    genesisBlockId: '0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc', // public-hash : identifiant public du bloc 0 de Nile
    chainIdHex: '0xcd8690dc',
    explorerTx: 'https://nile.tronscan.org/#/transaction/',
    explorerAddress: 'https://nile.tronscan.org/#/address/',
    faucet: 'https://nileex.io/join/getJoinPage',
    isMainnet: false
  }),
  token: Object.freeze({
    name: 'YOR Experimental USDT',
    symbol: 'YOR-USDT',
    decimals: 6,
    address: 'TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf',   /* déploiement réel sur Nile (docs/TOKEN.md) */
    experimental: true,
    isTether: false
  }),
  limits: Object.freeze({
    maxFeeLimitTrx: 100,          /* plafond de sécurité : une simulation qui demanderait plus est refusée */
    requestTimeoutMs: 15000,
    pollIntervalMs: 2000,
    pollMaxMs: 10 * 60 * 1000,
    signSafetyMs: 4000,           /* une transaction qui expire dans moins de 4 s n'est plus diffusée */
    txExpirationMs: 5 * 60 * 1000,   /* validité visée de la transaction à signer (le nœud en propose 60 s, trop court sur téléphone) ; 0 = ne pas étendre */
    maxTxExpirationMs: 10 * 60 * 1000
  })
});

const TRANSFER_SELECTOR = 'transfer(address,uint256)';
const TRANSFER_SELECTOR_HEX = 'a9059cbb';   /* vérifié : data renvoyée par le nœud Nile pour ce sélecteur */
/* longueur (en caractères hex) de raw_data_hex d'un transfert relevé sur Nile : 211 octets ; sert à estimer la bande passante */
const TRANSFER_RAW_HEX_LEN = 422;
const TRANSFER_EVENT_TOPIC = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';   // public-hash : sujet de l'événement Transfer(address,address,uint256), constante ERC-20/TRC-20 publique
const STORAGE_KEY = 'yor_chain_tx_v1_nile';
const KNOWN_CHAIN_IDS = Object.freeze({ '0x2b6653dc': 'mainnet', '0x94a9059e': 'shasta', '0xcd8690dc': 'nile' });

class ChainError extends Error {
  constructor(code, message, extra) {
    super(message || code);
    this.name = 'ChainError';
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

/* ------------------------------------------------------------------ SHA-256 synchrone (vérifié contre node:crypto par les tests) */
const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function sha256(data) {
  const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(len / 0x20000000), false);
  dv.setUint32(total - 4, (len << 3) >>> 0, false);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
  return out;
}

/* ------------------------------------------------------------------ adresses et montants */
function isAddress(addr) {
  try { L.base58ToHex41(addr, sha256); return true; } catch (_e) { return false; }
}
function addrToHex(addr) {
  try { return L.base58ToHex41(addr, sha256); } catch (_e) { throw new ChainError('INVALID_ADDRESS', 'invalid TRON address'); }
}
function hexToAddr(hex41) { return L.hex41ToBase58(hex41, sha256); }

/** 12.3.7 : nettoie une adresse collée AVANT validation. Ne devine jamais une adresse : on retire seulement ce qui n'en fait pas partie
    (espaces, retours à la ligne, caractères invisibles ou de sens d'écriture, guillemets/parenthèses autour, « tron: », « ?paramètres »),
    on extrait l'adresse d'un lien d'explorateur, et on convertit la forme hexadécimale TRON « 41… » (42 caractères) en forme « T… ».
    Si le résultat n'est pas une adresse TRON à somme de contrôle valide, isAddress() la refusera comme avant.
    Même nettoyage de base que AddressEngine.clean (core/domain.js) ; tests/ui/address-any.test.mjs vérifie l'accord des deux. */
function cleanAddressInput(text) {
  let a = String(text == null ? '' : text).replace(/[­​-‏‪-‮⁠-⁩﻿]/g, '').replace(/\s+/g, '');
  if (/^https?:\/\//i.test(a) || a.indexOf('/address/') >= 0) {
    const cands = a.match(/T[1-9A-HJ-NP-Za-km-z]{33}(?![1-9A-HJ-NP-Za-km-z])/g) || [];
    for (const c of cands) { if (isAddress(c)) return c; }
  }
  a = a.replace(/^[("'<\[]+/, '').replace(/[)"'>\],;.]+$/, '').replace(/^tron:/i, '');
  const q = a.indexOf('?'); if (q >= 0) a = a.slice(0, q);
  if (/^41[0-9a-fA-F]{40}$/.test(a)) { try { return hexToAddr(a.toLowerCase()); } catch (_e) { /* on garde le texte tel quel */ } }
  return a;
}

/* Chiffres arabo-indiques et persans -> ASCII ; « , » et « ٫ » -> « . » (un seul séparateur décimal accepté). */
function normalizeAmountText(text) {
  return String(text == null ? '' : text)
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫٬,]/g, '.');
}

/** "1.5" -> 1500000n. Refuse signes, exposants, plusieurs séparateurs, zéro, et plus de décimales que le jeton. */
function parseAmount(text, decimals) {
  const dec = decimals === undefined ? CONFIG.token.decimals : decimals;
  const s = normalizeAmountText(text);
  if (!/^\d+(\.\d+)?$/.test(s)) throw new ChainError('INVALID_AMOUNT', 'invalid amount format');
  const parts = s.split('.');
  const frac = parts[1] || '';
  if (frac.length > dec) throw new ChainError('TOO_MANY_DECIMALS', 'too many decimals');
  const raw = BigInt(parts[0]) * 10n ** BigInt(dec) + BigInt(frac.padEnd(dec, '0') || '0');
  if (raw <= 0n) throw new ChainError('INVALID_AMOUNT', 'amount must be positive');
  return raw;
}

/** Affichage exact : zéros de fin retirés (2 décimales minimum), milliers séparés. */
function formatAmount(raw, decimals) {
  const dec = decimals === undefined ? CONFIG.token.decimals : decimals;
  const txt = L.formatUnits(BigInt(raw), dec);
  const parts = txt.split('.');
  let frac = (parts[1] || '').replace(/0+$/, '');
  if (dec > 0 && frac.length < 2) frac = frac.padEnd(2, '0');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? whole + '.' + frac : whole;
}

/** TRX : sun -> texte exact (6 décimales, zéros de fin retirés, 2 minimum). */
function formatTrx(sun) { return formatAmount(BigInt(sun), 6); }

/* ------------------------------------------------------------------ garde-fous de configuration */
function assertTestnetConfig(cfg) {
  if (!cfg || !cfg.network || cfg.network.isMainnet === true) throw new ChainError('MAINNET_FORBIDDEN', 'mainnet is forbidden');
  const hosts = [cfg.network.fullNode, cfg.network.solidityNode];
  for (const h of hosts) {
    let u;
    try { u = new URL(h); } catch (_e) { throw new ChainError('BAD_CONFIG', 'invalid node URL'); }
    if (u.protocol !== 'https:') throw new ChainError('BAD_CONFIG', 'nodes must use https');
    if (u.hostname === 'api.trongrid.io' || u.hostname === 'api.tronstack.io') throw new ChainError('MAINNET_FORBIDDEN', 'node URL points to mainnet');
  }
  if (cfg.token.isTether !== false || cfg.token.experimental !== true) throw new ChainError('BAD_CONFIG', 'the token must be the experimental token, never Tether');
  if (!isAddress(cfg.token.address)) throw new ChainError('BAD_CONFIG', 'invalid token address');
  const l = cfg.limits || {};
  if (!Number.isInteger(l.maxTxExpirationMs) || l.maxTxExpirationMs < 0 || l.maxTxExpirationMs > 10 * 60 * 1000) throw new ChainError('BAD_CONFIG', 'maxTxExpirationMs must be between 0 and 10 minutes');
  if (!Number.isInteger(l.txExpirationMs) || l.txExpirationMs < 0 || l.txExpirationMs > l.maxTxExpirationMs) throw new ChainError('BAD_CONFIG', 'txExpirationMs must be between 0 and maxTxExpirationMs');
}

function mapRevertReason(hex) {
  /* Error(string) : 08c379a0 + ABI. Renvoie le texte, ou null si ce n'est pas une révocation standard. */
  if (typeof hex !== 'string' || !hex.toLowerCase().startsWith('08c379a0')) return null;
  try { return L.decodeAbiString(hex.slice(8)); } catch (_e) { return null; }
}

function selectorToCode(reason) {
  const r = String(reason || '');
  if (/insufficient available balance/i.test(r)) return 'INSUFFICIENT_TOKEN';
  if (/transfer to zero/i.test(r)) return 'TO_ZERO_ADDRESS';
  if (/too many lots/i.test(r)) return 'TOO_MANY_LOTS';
  return 'SIMULATION_REVERTED';
}

/* ------------------------------------------------------------------ client */
function createClient(opts) {
  opts = opts || {};
  const cfg = opts.config || CONFIG;
  assertTestnetConfig(cfg);
  const fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const now = opts.now || (() => Date.now());
  const mono = opts.mono || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const win = opts.window !== undefined ? opts.window : (typeof window !== 'undefined' ? window : null);
  let storage = opts.storage;
  if (storage === undefined) {
    try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch (_e) { storage = null; }
  }
  const lim = cfg.limits;
  const tokenAddr = cfg.token.address;
  const tokenHex = addrToHex(tokenAddr);

  /* ---------------- HTTP vers le nœud ---------------- */
  async function http(url, body) {
    if (!fetchFn) throw new ChainError('NO_FETCH', 'no fetch implementation available');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), lim.requestTimeoutMs) : null;
    let res;
    try {
      const init = body === undefined
        ? { method: 'GET', headers: { accept: 'application/json' } }
        : { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) };
      if (ctrl) init.signal = ctrl.signal;
      res = await fetchFn(url, init);
    } catch (_e) {
      throw new ChainError(ctrl && ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK_UNREACHABLE', 'TRON node unreachable');
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res || !res.ok) throw new ChainError('HTTP_ERROR', 'TRON node answered HTTP ' + (res && res.status), { status: res && res.status });
    try { return await res.json(); } catch (_e) { throw new ChainError('BAD_RESPONSE', 'TRON node returned a non-JSON body'); }
  }
  const full = (path, body) => http(cfg.network.fullNode + path, body);
  const solid = (path, body) => http(cfg.network.solidityNode + path, body);

  /* ---------------- appels de contrat en lecture / simulation ---------------- */
  async function constantCall(base, ownerHex, selector, parameter) {
    const j = await http(base + '/triggerconstantcontract', {
      owner_address: ownerHex, contract_address: tokenHex, function_selector: selector, parameter: parameter || '', visible: false
    });
    if (!j || !j.result || j.result.result !== true) {
      const detail = L.decodeHexText(j && j.result && j.result.message) || 'no detail';
      if (j && j.result && j.result.code === 'CONTRACT_VALIDATE_ERROR' && /not exist/i.test(detail)) {
        throw new ChainError('CONTRACT_NOT_FOUND', 'no contract at ' + tokenAddr + ' on ' + cfg.network.id);
      }
      throw new ChainError('CALL_FAILED', selector + ' failed: ' + detail);
    }
    const out = Array.isArray(j.constant_result) ? j.constant_result[0] : undefined;
    const ret0 = j.transaction && Array.isArray(j.transaction.ret) ? j.transaction.ret[0] : null;
    /* Forme réelle d'une révocation (Nile, 2026-10-09) : result.result reste TRUE ; seuls transaction.ret[0].ret === "FAILED"
       et result.message ("REVERT opcode executed") la signalent, et constant_result[0] porte Error(string). */
    const retStatus = ret0 && typeof ret0.ret === 'string' ? ret0.ret : null;
    const reverted = (retStatus !== null && retStatus !== 'SUCESS' && retStatus !== 'SUCCESS') ||
      (typeof j.result.message === 'string' && j.result.message !== '') ||
      (ret0 && typeof ret0.contractRet === 'string' && ret0.contractRet !== 'SUCCESS' && ret0.contractRet !== '');
    const reason = reverted ? (mapRevertReason(out) || L.decodeHexText(j.result.message) || 'reverted') : null;
    return { out: typeof out === 'string' ? out : null, energyUsed: Number.isInteger(j.energy_used) ? j.energy_used : null, reverted: !!reverted, reason };
  }

  /* Le nœud solidity expose /walletsolidity/triggerconstantcontract ; le nœud complet /wallet/triggerconstantcontract.
     On lit d'abord le nœud solidity (état confirmé) ; le repli sur le nœud complet est toujours ÉTIQUETÉ dans `source`. */
  const solidBase = cfg.network.solidityNode;
  const fullBase = cfg.network.fullNode + '/wallet';
  async function readConstant(selector, ownerAddr, parameter) {
    const ownerHex = addrToHex(ownerAddr || tokenAddr);
    let lastErr = null;
    for (const pair of [['solidity', solidBase], ['fullnode', fullBase]]) {
      try {
        const r = await constantCall(pair[1], ownerHex, selector, parameter);
        if (r.reverted || r.out === null) throw new ChainError('CALL_FAILED', selector + ' reverted: ' + r.reason);
        return { out: r.out, source: pair[0] };
      } catch (e) {
        lastErr = e;
        if (e && e.code === 'CONTRACT_NOT_FOUND') throw e;
      }
    }
    throw lastErr;
  }
  async function readUint(selector, ownerAddr, parameter) {
    const r = await readConstant(selector, ownerAddr, parameter);
    return { value: L.decodeUint(r.out), source: r.source };
  }
  const addrParam = (addr) => L.abiAddressWord(addrToHex(addr));

  /* ---------------- vérification du nœud et du jeton (une fois, mise en cache) ---------------- */
  let verified = null;
  async function verifyChain() {
    if (verified) return verified;
    const p = (async () => {
      const g = await full('/wallet/getblockbynum', { num: 0 });
      if (!g || typeof g.blockID !== 'string' || g.blockID.toLowerCase() !== cfg.network.genesisBlockId) {
        throw new ChainError('WRONG_NETWORK_NODE', 'the node is not ' + cfg.network.name);
      }
      const name = L.decodeAbiString((await readConstant('name()')).out);
      const symbol = L.decodeAbiString((await readConstant('symbol()')).out);
      const decimals = Number(L.decodeUint((await readConstant('decimals()')).out));
      if (name !== cfg.token.name || symbol !== cfg.token.symbol || decimals !== cfg.token.decimals) {
        throw new ChainError('TOKEN_METADATA_MISMATCH', 'contract is "' + name + '" / "' + symbol + '" / ' + decimals);
      }
      return { network: cfg.network.id, name, symbol, decimals, contract: tokenAddr };
    })();
    p.catch(() => { if (verified === p) verified = null; });
    verified = p;
    return p;
  }

  /* ---------------- lecture : comptes, ressources, soldes ---------------- */
  async function getAccount(addr) {
    const j = await full('/wallet/getaccount', { address: addr, visible: true });
    const exists = !!j && typeof j === 'object' && Object.keys(j).length > 0;
    const bal = exists && Number.isFinite(j.balance) ? j.balance : 0;
    return { exists, balanceSun: BigInt(bal) };
  }
  async function getResources(addr) {
    const j = (await full('/wallet/getaccountresource', { address: addr, visible: true })) || {};
    const n = (x) => (Number.isFinite(x) && x > 0 ? x : 0);
    return {
      bandwidth: Math.max(0, n(j.freeNetLimit) - n(j.freeNetUsed)) + Math.max(0, n(j.NetLimit) - n(j.NetUsed)),
      energy: Math.max(0, n(j.EnergyLimit) - n(j.EnergyUsed))
    };
  }
  async function getChainParams() {
    const j = await full('/wallet/getchainparameters', {});
    const list = j && Array.isArray(j.chainParameter) ? j.chainParameter : [];
    const get = (key) => { const e = list.find((x) => x && x.key === key); return e && Number.isInteger(e.value) && e.value > 0 ? e.value : null; };
    const energyFee = get('getEnergyFee'), txFee = get('getTransactionFee');
    if (energyFee === null || txFee === null) throw new ChainError('BAD_RESPONSE', 'chain parameters missing getEnergyFee / getTransactionFee');
    return { energyFeeSun: energyFee, bandwidthFeeSun: txFee };
  }

  /** Soldes lus sur la chaîne. `source` dit d'où vient chaque valeur (jamais de solde inventé). */
  async function readBalances(addr) {
    if (!isAddress(addr)) throw new ChainError('INVALID_ADDRESS', 'invalid TRON address');
    await verifyChain();
    const param = addrParam(addr);
    const [total, available, expired, supply, acct] = await Promise.allSettled([
      readUint('balanceOf(address)', addr, param),
      readUint('availableBalanceOf(address)', addr, param),
      readUint('expiredBalanceOf(address)', addr, param),
      readUint('totalSupply()', addr, ''),
      getAccount(addr)
    ]);
    if (total.status !== 'fulfilled') throw total.reason;
    if (available.status !== 'fulfilled') throw available.reason;
    return {
      address: addr,
      total: total.value.value,
      available: available.value.value,
      expired: expired.status === 'fulfilled' ? expired.value.value : null,
      totalSupply: supply.status === 'fulfilled' ? supply.value.value : null,
      source: total.value.source === 'solidity' && available.value.source === 'solidity' ? 'solidity' : 'fullnode',
      trx: acct.status === 'fulfilled' ? acct.value : null
    };
  }

  /* ---------------- estimation d'un transfert (simulation sur le nœud, rien n'est signé) ---------------- */
  function estimateTxBytes(rawHexLen) {
    const n = rawHexLen / 2;
    return 1 + (n < 128 ? 1 : 2) + n + 67 + 64;   /* raw_data + signature (65) + MAX_RESULT_SIZE (64), comme le nœud */
  }
  function checkTransferInput(from, to, amountRaw) {
    if (!isAddress(from)) throw new ChainError('INVALID_ADDRESS', 'invalid sender address');
    if (!isAddress(to)) throw new ChainError('INVALID_ADDRESS', 'invalid recipient address');
    if (from === to) throw new ChainError('SELF_TRANSFER', 'sender and recipient are the same');
    if (to === hexToAddr('41' + '00'.repeat(20))) throw new ChainError('TO_ZERO_ADDRESS', 'recipient is the zero address');
    if (to === tokenAddr) throw new ChainError('TO_CONTRACT', 'recipient is the token contract itself');
    if (typeof amountRaw !== 'bigint' || amountRaw <= 0n) throw new ChainError('INVALID_AMOUNT', 'amount must be a positive bigint');
  }
  function transferParameter(to, amountRaw) { return L.abiAddressWord(addrToHex(to)) + L.abiUintWord(amountRaw); }

  async function estimateTransfer(args) {
    const from = args.from, to = args.to, amountRaw = args.amountRaw;
    checkTransferInput(from, to, amountRaw);
    await verifyChain();
    const parameter = transferParameter(to, amountRaw);
    const [params, acct, res, avail] = await Promise.all([
      getChainParams(), getAccount(from), getResources(from), readUint('availableBalanceOf(address)', from, addrParam(from))
    ]);
    if (amountRaw > avail.value) throw new ChainError('INSUFFICIENT_TOKEN', 'amount exceeds the available balance', { available: avail.value });
    const sim = await constantCall(fullBase, addrToHex(from), TRANSFER_SELECTOR, parameter);
    if (sim.reverted) throw new ChainError(selectorToCode(sim.reason), 'simulation reverted: ' + sim.reason, { reason: sim.reason });
    if (!Number.isInteger(sim.energyUsed) || sim.energyUsed <= 0) throw new ChainError('BAD_RESPONSE', 'simulation returned no energy figure');
    const feeLimitTrx = L.suggestCallFeeLimitTrx(sim.energyUsed, params.energyFeeSun);
    if (feeLimitTrx > lim.maxFeeLimitTrx) throw new ChainError('FEE_TOO_HIGH', 'simulated cost exceeds the safety cap', { feeLimitTrx });
    const feeLimitSun = feeLimitTrx * 1000000;
    const cover = L.feeLimitCoversEstimate(feeLimitSun, sim.energyUsed, params.energyFeeSun);
    if (!cover.ok) throw new ChainError('FEE_LIMIT_TOO_LOW', 'fee limit does not cover the simulated cost');
    const burnEnergySun = BigInt(Math.max(0, sim.energyUsed - res.energy)) * BigInt(params.energyFeeSun);
    const bytes = estimateTxBytes(TRANSFER_RAW_HEX_LEN);
    const burnBandwidthSun = res.bandwidth >= bytes ? 0n : BigInt(Math.ceil(bytes)) * BigInt(params.bandwidthFeeSun);
    const expectedBurnSun = burnEnergySun + burnBandwidthSun;
    const needSun = (expectedBurnSun * 12n) / 10n;
    return {
      from, to, amountRaw,
      energyUsed: sim.energyUsed,
      energyFeeSun: params.energyFeeSun,
      feeLimitTrx, feeLimitSun,
      accountActivated: acct.exists,
      trxBalanceSun: acct.balanceSun,
      expectedBurnSun, burnEnergySun, burnBandwidthSun,
      bandwidthBytes: Math.ceil(bytes),
      hasEnoughTrx: acct.exists && acct.balanceSun >= needSun,
      availableToken: avail.value,
      source: avail.source,
      at: now()
    };
  }

  /* ---------------- construction + contrôle d'une transaction ---------------- */
  async function buildTransfer(args) {
    const from = args.from, to = args.to, amountRaw = args.amountRaw, feeLimitSun = args.feeLimitSun;
    checkTransferInput(from, to, amountRaw);
    if (!Number.isInteger(feeLimitSun) || feeLimitSun <= 0 || feeLimitSun > lim.maxFeeLimitTrx * 1000000) throw new ChainError('FEE_TOO_HIGH', 'fee limit outside the safety bounds');
    const ownerHex = addrToHex(from);
    const parameter = transferParameter(to, amountRaw);
    const j = await full('/wallet/triggersmartcontract', {
      owner_address: ownerHex, contract_address: tokenHex, function_selector: TRANSFER_SELECTOR,
      parameter, fee_limit: feeLimitSun, call_value: 0, visible: false
    });
    if (!j || !j.result || j.result.result !== true || !j.transaction || typeof j.transaction.txID !== 'string') {
      throw new ChainError('BUILD_FAILED', 'could not build the transfer: ' + (L.decodeHexText(j && j.result && j.result.message) || 'no detail'));
    }
    const checks = L.checkTriggerTx({ tx: j.transaction, ownerHex41: ownerHex, contractHex41: tokenHex, dataHex: TRANSFER_SELECTOR_HEX + parameter, feeLimitSun }, sha256);
    const failed = checks.filter((c) => !c.ok).map((c) => c.name);
    if (failed.length) throw new ChainError('TX_CHECK_FAILED', 'the node returned a transaction that does not match the request', { failed });
    /* Fenêtre de signature : le nœud met 60 s, souvent trop court sur téléphone. On allonge l'expiration (comme TronWeb `extendExpiration`) puis on RE-CONTRÔLE
       la transaction modifiée avec les mêmes 17 vérifications (re-encodage protobuf exact, txID = sha256(raw_data_hex)). Au moindre doute : transaction du nœud inchangée. */
    let tx = j.transaction, extended = false;
    const wantMs = args.extend === false ? 0 : Math.min(lim.txExpirationMs, lim.maxTxExpirationMs);
    const raw = j.transaction.raw_data;
    if (wantMs > 0 && Number.isInteger(raw.timestamp) && raw.timestamp + wantMs > raw.expiration) {
      try {
        const raw2 = Object.assign({}, raw, { expiration: raw.timestamp + wantMs });
        const hex2 = L.encodeTriggerRawData(raw2);
        if (typeof hex2 === 'string' && hex2 !== j.transaction.raw_data_hex) {
          const tx2 = Object.assign({}, j.transaction, { raw_data: raw2, raw_data_hex: hex2, txID: L.bytesToHex(sha256(L.hexToBytes(hex2))) });
          const bad = L.checkTriggerTx({ tx: tx2, ownerHex41: ownerHex, contractHex41: tokenHex, dataHex: TRANSFER_SELECTOR_HEX + parameter, feeLimitSun }, sha256).filter((c) => !c.ok);
          if (!bad.length) { tx = tx2; extended = true; }
        }
      } catch (_e) { /* on garde la transaction du nœud */ }
    }
    return { tx, builtAtNodeMs: tx.raw_data.timestamp, builtAtMono: mono(), extended };
  }

  /* ---------------- diffusion et suivi ---------------- */
  async function broadcast(signed) {
    const j = await full('/wallet/broadcasttransaction', signed);
    if (j && j.result === true) return { txid: signed.txID, duplicate: false };
    const code = j && typeof j.code === 'string' ? j.code : 'UNKNOWN';
    const message = L.decodeHexText(j && j.message) || 'no detail';
    if (code === 'DUP_TRANSACTION_ERROR') return { txid: signed.txID, duplicate: true };
    if (code === 'TRANSACTION_EXPIRATION_ERROR') throw new ChainError('TX_EXPIRED', message, { nodeCode: code });
    throw new ChainError('BROADCAST_REJECTED', code + ': ' + message, { nodeCode: code });
  }

  /** Le reçu doit contenir l'événement Transfer(from, to, amount) émis PAR LE CONTRAT du jeton. */
  function hasTransferEvent(info, fromAddr, toAddr, amountRaw) {
    const logs = info && Array.isArray(info.log) ? info.log : [];
    const contract20 = tokenHex.slice(2).toLowerCase();
    const fromWord = L.abiAddressWord(addrToHex(fromAddr)), toWord = L.abiAddressWord(addrToHex(toAddr));
    const amountWord = L.abiUintWord(BigInt(amountRaw));
    return logs.some((e) => e && typeof e.address === 'string' && e.address.toLowerCase().replace(/^41/, '') === contract20 &&
      Array.isArray(e.topics) && e.topics.length === 3 && String(e.topics[0]).toLowerCase() === TRANSFER_EVENT_TOPIC &&
      String(e.topics[1]).toLowerCase() === fromWord && String(e.topics[2]).toLowerCase() === toWord &&
      String(e.data || '').toLowerCase() === amountWord);
  }

  async function fetchTxInfo(txid) {
    const [a, b] = await Promise.allSettled([full('/wallet/gettransactioninfobyid', { value: txid }), solid('/gettransactioninfobyid', { value: txid })]);
    if (a.status !== 'fulfilled' && b.status !== 'fulfilled') throw a.reason;
    return { info: a.status === 'fulfilled' ? a.value : null, sol: b.status === 'fulfilled' ? b.value : null };
  }

  /* ---------------- enregistrements locaux (cache de l'appareil ; la chaîne reste la source de vérité) ---------------- */
  let records = [];
  const listeners = new Set();
  function loadRecords() {
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      records = (Array.isArray(arr) ? arr : []).filter((r) => r && typeof r === 'object' && S.STATES.includes(r.state) && typeof r.id === 'string').slice(0, 50);
    } catch (_e) { records = []; }
  }
  function saveRecords() {
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 50))); } catch (_e) { /* stockage indisponible : le suivi reste en mémoire */ }
  }
  function notify() { for (const fn of Array.from(listeners)) { try { fn(records.slice()); } catch (_e) { /* un écouteur ne doit pas casser le suivi */ } } }
  function upsert(rec) {
    const i = records.findIndex((r) => r.id === rec.id);
    if (i >= 0) records[i] = rec; else records.unshift(rec);
    saveRecords();
    notify();
    return rec;
  }
  loadRecords();

  function setState(rec, next, extra) {
    const evidence = extra && extra.evidence;
    const to = S.transition(rec.state, next, evidence);
    const out = Object.assign({}, rec, extra || {}, { state: to, updatedAt: now() });
    delete out.evidence;
    if (out.id !== rec.id) records = records.filter((r) => r.id !== rec.id);   /* l'identifiant local devient le txid */
    return upsert(out);
  }

  /** Un pas de suivi d'un enregistrement diffusé. Renvoie l'enregistrement mis à jour. */
  async function refreshRecord(rec) {
    if (!rec || !rec.txid || S.isTerminal(rec.state)) return rec;
    const got = await fetchTxInfo(rec.txid);
    const c = L.classify(got.info, got.sol, rec.expiresAt || null, now(), false);
    if (c.state === 'broadcasted') return rec;
    if (c.state === 'expired') return setState(rec, 'expired', { reason: 'TX_EXPIRED_NOT_FOUND' });
    if (c.state === 'confirming') {
      const patch = { blockNumber: c.blockNumber, reason: c.provisionalFailure ? 'PROVISIONAL_FAILURE' : null };
      return rec.state === 'confirming' ? upsert(Object.assign({}, rec, patch, { updatedAt: now() })) : setState(rec, 'confirming', patch);
    }
    if (c.state === 'failed') {
      const reason = L.decodeHexText(got.sol && got.sol.resMessage) || c.receiptResult || 'FAILED';
      return setState(rec, 'failed', { blockNumber: c.blockNumber, receiptResult: c.receiptResult, reason, feeSun: c.cost ? c.cost.feeSun : null });
    }
    /* c.state === 'confirmed' : receipt SUCCESS sur le nœud solidity. On exige AUSSI l'événement Transfer attendu. */
    const eventOk = hasTransferEvent(got.sol, rec.from, rec.to, rec.amountRaw);
    if (!eventOk) {
      const patch = { blockNumber: c.blockNumber, receiptResult: c.receiptResult, reason: null, anomaly: 'transfer_event_not_found' };
      return rec.state === 'confirming' ? upsert(Object.assign({}, rec, patch, { updatedAt: now() })) : setState(rec, 'confirming', patch);
    }
    return setState(rec, 'confirmed', {
      blockNumber: c.blockNumber, receiptResult: 'SUCCESS', reason: null, anomaly: null,
      feeSun: c.cost ? c.cost.feeSun : null, energyUsed: c.cost ? c.cost.energyUsageTotal : null,
      evidence: { txid: rec.txid, blockNumber: c.blockNumber, receiptResult: 'SUCCESS', solidified: true }
    });
  }

  const trackers = new Map();
  /** Suit un enregistrement jusqu'à un état final ou jusqu'à pollMaxMs. Un seul suiveur par transaction. */
  function track(rec) {
    if (!rec || !rec.txid || S.isTerminal(rec.state)) return Promise.resolve(rec);
    if (trackers.has(rec.id)) return trackers.get(rec.id);
    const p = (async () => {
      const started = mono();
      let cur = rec;
      while (!S.isTerminal(cur.state) && mono() - started < lim.pollMaxMs) {
        try { cur = (await refreshRecord(cur)) || cur; } catch (_e) { /* nœud injoignable : on réessaie au prochain tour */ }
        if (S.isTerminal(cur.state)) break;
        await sleep(lim.pollIntervalMs);
      }
      return cur;
    })();
    trackers.set(rec.id, p);
    const done = () => trackers.delete(rec.id);
    p.then(done, done);
    return p;
  }
  function resumeAll() {
    records.filter((r) => r.txid && !S.isTerminal(r.state) && r.network === cfg.network.id).forEach((r) => { track(r); });
  }

  /* ---------------- transfert complet : estimation -> construction -> signature -> diffusion ---------------- */
  let sending = false;
  async function sendTransfer(args) {
    const from = args.from, to = args.to, amountRaw = args.amountRaw, signer = args.signer, reviewed = args.reviewed;
    if (!signer || signer.configured !== true || typeof signer.signTransaction !== 'function') throw new ChainError('SIGNING_PROVIDER_NOT_CONFIGURED', 'Wallet signing provider not configured');
    if (sending) throw new ChainError('BUSY', 'a transfer is already in progress');
    sending = true;
    let rec = null;
    try {
      checkTransferInput(from, to, amountRaw);
      if (signer.address && signer.address !== from) throw new ChainError('SIGNER_ADDRESS_MISMATCH', 'the connected wallet is not the sender');
      const est = await estimateTransfer({ from, to, amountRaw });
      if (!est.accountActivated) throw new ChainError('ACCOUNT_NOT_ACTIVATED', 'the sender account has no TRX on ' + cfg.network.name);
      if (!est.hasEnoughTrx) throw new ChainError('INSUFFICIENT_TRX', 'not enough TRX for the network fee', { expectedBurnSun: est.expectedBurnSun, trxBalanceSun: est.trxBalanceSun });
      if (reviewed && est.feeLimitSun > reviewed.feeLimitSun) throw new ChainError('ESTIMATE_CHANGED', 'the fee estimate changed since the review', { estimate: est });

      rec = upsert({
        id: 'local-' + now() + '-' + Math.floor(mono() * 1000), txid: null, network: cfg.network.id, contract: tokenAddr,
        from, to, amountRaw: amountRaw.toString(), state: 'draft', reason: null, createdAt: now(), updatedAt: now(),
        expiresAt: null, blockNumber: null, receiptResult: null, feeSun: null, energyUsed: null, anomaly: null
      });
      const built = await buildTransfer({ from, to, amountRaw, feeLimitSun: est.feeLimitSun, extend: args.extendExpiration !== false }).catch((e) => {
        rec = setState(rec, 'failed', { reason: e.code || 'BUILD_FAILED' });
        throw e;
      });
      const expiration = built.tx.raw_data.expiration;
      rec = setState(rec, 'pending_signature', { txid: built.tx.txID, id: built.tx.txID, expiresAt: expiration, extended: built.extended === true });

      let signed;
      try { signed = await signer.signTransaction(built.tx); }
      catch (e) {
        const rejected = e && (e.code === 'SIGNATURE_REJECTED' || e.code === 4001);
        rec = setState(rec, rejected ? 'cancelled' : 'failed', { reason: rejected ? 'SIGNATURE_REJECTED' : ((e && e.code) || 'SIGNING_FAILED') });
        throw rejected ? new ChainError('SIGNATURE_REJECTED', 'Signature rejected by the user') : e;
      }
      const sigOk = signed && Array.isArray(signed.signature) && signed.signature.length === 1 && /^[0-9a-fA-F]{130}$/.test(String(signed.signature[0]));
      const sameTx = signed && signed.txID === built.tx.txID && signed.raw_data_hex === built.tx.raw_data_hex;
      let recheck = [];
      if (sigOk && sameTx) {
        recheck = L.checkTriggerTx({ tx: signed, ownerHex41: addrToHex(from), contractHex41: tokenHex, dataHex: TRANSFER_SELECTOR_HEX + transferParameter(to, amountRaw), feeLimitSun: est.feeLimitSun }, sha256).filter((c) => !c.ok);
      }
      if (!sigOk || !sameTx || recheck.length) {
        rec = setState(rec, 'failed', { reason: 'SIGNED_TX_MISMATCH' });
        throw new ChainError('SIGNED_TX_MISMATCH', 'the signed transaction differs from the one that was built', { failed: recheck.map((c) => c.name) });
      }
      /* délai restant mesuré avec l'horloge de l'appareil sur la DURÉE écoulée seulement (pas de dérive d'horloge) */
      const remaining = expiration - (built.builtAtNodeMs + (mono() - built.builtAtMono));
      if (remaining < lim.signSafetyMs) {
        rec = setState(rec, 'expired', { reason: 'SIGNED_TOO_LATE' });
        throw new ChainError('TX_EXPIRED', 'the transaction expired before it was signed');
      }
      try { await broadcast(signed); }
      catch (e) {
        rec = setState(rec, e && e.code === 'TX_EXPIRED' ? 'expired' : 'failed', { reason: (e && e.nodeCode) || (e && e.code) || 'BROADCAST_FAILED' });
        throw e;
      }
      rec = setState(rec, 'broadcasted', { reason: null, energyUsed: est.energyUsed });
      return rec;
    } finally {
      sending = false;
    }
  }

  /* ---------------- historique sur la chaîne (API TronGrid) ---------------- */
  async function chainHistory(addr, limit) {
    if (!isAddress(addr)) throw new ChainError('INVALID_ADDRESS', 'invalid TRON address');
    const n = Math.max(1, Math.min(50, limit || 20));
    const j = await http(cfg.network.fullNode + '/v1/accounts/' + addr + '/transactions/trc20?contract_address=' + tokenAddr + '&limit=' + n + '&only_confirmed=true');
    const rows = j && j.success === true && Array.isArray(j.data) ? j.data : [];
    return rows.filter((r) => r && r.type === 'Transfer' && r.token_info && r.token_info.address === tokenAddr &&
      typeof r.transaction_id === 'string' && /^[0-9a-fA-F]{64}$/.test(r.transaction_id) && /^\d+$/.test(String(r.value)) &&
      isAddress(r.from) && isAddress(r.to)).map((r) => ({
      txid: r.transaction_id.toLowerCase(), from: r.from, to: r.to, amountRaw: BigInt(r.value), ts: Number(r.block_timestamp) || null,
      direction: r.to === addr ? 'in' : 'out'
    }));
  }

  return {
    config: cfg,
    verifyChain, readBalances, estimateTransfer, buildTransfer, sendTransfer, broadcast,
    refreshRecord, track, resumeAll, chainHistory, hasTransferEvent,
    records: () => records.slice(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    clearFinished: () => { records = records.filter((r) => !S.isTerminal(r.state)); saveRecords(); notify(); },
    wallet: createWallet({ win, sleep, cfg })
  };
}

/* ------------------------------------------------------------------ TronLink (fournisseur de signature) */
class WalletError extends Error {
  constructor(code, message) { super(message || code); this.name = 'WalletError'; this.code = code; }
}

function classifyHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return 'unknown';
  if (/nile/.test(h)) return 'nile';
  if (/shasta/.test(h)) return 'shasta';
  if (/api\.trongrid\.io|api\.tronstack\.io|api\.tron\.network/.test(h)) return 'mainnet';
  return 'unknown';
}

function isUserRejection(e) {
  if (!e) return false;
  if (e.code === 4001 || e.code === 'ACTION_REJECTED' || e.code === 'SIGNATURE_REJECTED') return true;
  const m = String(e.message || e);
  return /declined|rejected|denied|cancel/i.test(m);
}

/**
 * Fournisseur de signature TronLink. Deux API coexistent :
 *  - récente : window.tron (TIP-6963) + request({method:'eth_requestAccounts'}) + provider.tronWeb ;
 *  - ancienne / navigateur DApp mobile : window.tronLink / window.tronWeb + request({method:'tron_requestAccounts'}).
 * Les deux sont essayées. La clé privée ne quitte jamais TronLink : on lui passe la transaction (déjà contrôlée) et on récupère la signature.
 */
function createWallet(ctx) {
  const win = ctx.win;
  const sleep = ctx.sleep;
  const state = { connected: false, address: null, kind: null, network: 'unknown', host: null, chainId: null };
  const subs = new Set();
  const emit = () => { for (const fn of Array.from(subs)) { try { fn(Object.assign({}, state)); } catch (_e) { /* ignoré */ } } };

  function provider() {
    if (!win) return null;
    if (win.tron && typeof win.tron === 'object') return { kind: 'tron', p: win.tron };
    if (win.tronLink && typeof win.tronLink === 'object') return { kind: 'tronLink', p: win.tronLink };
    if (win.TronLink && typeof win.TronLink === 'object') return { kind: 'tronLink', p: win.TronLink };
    return null;
  }
  function tronWebOf(pv) {
    const cands = [pv && pv.p && pv.p.tronWeb, win && win.tronWeb, win && win.tron && win.tron.tronWeb];
    for (const c of cands) if (c && typeof c === 'object') return c;
    return null;
  }
  function available() { return !!(provider() || (win && win.tronWeb)); }

  function normalizeAccount(x) {
    if (typeof x !== 'string') return null;
    if (isAddress(x)) return x;
    const h = x.replace(/^0x/i, '');
    if (/^41[0-9a-fA-F]{40}$/.test(h)) return hexToAddr(h.toLowerCase());
    if (/^[0-9a-fA-F]{40}$/.test(h)) return hexToAddr('41' + h.toLowerCase());
    return null;
  }

  async function waitFor(fn, ms) {
    const rounds = Math.ceil(ms / 150);
    for (let i = 0; i <= rounds; i++) {
      const v = fn();
      if (v) return v;
      if (i < rounds) await sleep(150);
    }
    return null;
  }

  async function detectNetwork(pv, tw) {
    let chainId = null, host = null;
    if (pv && pv.p && typeof pv.p.request === 'function') {
      try {
        const id = await pv.p.request({ method: 'eth_chainId' });
        if (typeof id === 'string') chainId = id.toLowerCase();
      } catch (_e) { /* méthode non prise en charge par cette version : on passe au nœud */ }
    }
    if (tw && tw.fullNode) host = tw.fullNode.host || tw.fullNode.url || null;
    let net = 'unknown';
    if (chainId) net = KNOWN_CHAIN_IDS[chainId] || 'other';
    if (net === 'unknown') net = classifyHost(host);
    return { network: net, chainId, host };
  }

  async function connect() {
    const pv = provider();
    if (!pv && !(win && win.tronWeb)) throw new WalletError('NO_WALLET', 'TronLink not detected');
    let accounts = null;
    if (pv && typeof pv.p.request === 'function') {
      const methods = pv.kind === 'tron' ? ['eth_requestAccounts', 'tron_requestAccounts'] : ['tron_requestAccounts', 'eth_requestAccounts'];
      let lastErr = null;
      for (const m of methods) {
        try {
          const r = await pv.p.request({ method: m });
          if (r && typeof r === 'object' && !Array.isArray(r) && typeof r.code === 'number' && r.code !== 200) {
            /* ancienne API : { code: 4001, message: 'The user rejected the request.' } renvoyé, non levé */
            if (r.code === 4001) throw new WalletError('USER_REJECTED', 'The user rejected the request');
            lastErr = new WalletError('CONNECT_FAILED', String(r.message || r.code));
            continue;
          }
          accounts = Array.isArray(r) ? r : null;
          lastErr = null;
          break;
        } catch (e) {
          if (e instanceof WalletError) throw e;
          if (isUserRejection(e)) throw new WalletError('USER_REJECTED', 'The user rejected the request');
          lastErr = e;   /* 4200 / méthode inconnue : essai suivant */
        }
      }
      if (lastErr && !(win && win.tronWeb)) throw new WalletError('CONNECT_FAILED', String((lastErr && lastErr.message) || lastErr));
    }
    const tw = await waitFor(() => { const t = tronWebOf(pv); return t && t.defaultAddress && isAddress(t.defaultAddress.base58) ? t : null; }, 4000) || tronWebOf(pv);
    let address = null;
    if (accounts && accounts.length) address = normalizeAccount(accounts[0]);
    if (!address && tw && tw.defaultAddress) address = normalizeAccount(tw.defaultAddress.base58);
    if (!address) throw new WalletError('NO_ACCOUNT', 'TronLink returned no valid TRON address (unlock TronLink and retry)');
    const net = await detectNetwork(pv, tw);
    Object.assign(state, { connected: true, address, kind: pv ? pv.kind : 'tronWeb', network: net.network, host: net.host, chainId: net.chainId });
    attachEvents(pv);
    emit();
    return Object.assign({}, state);
  }

  let attached = false;
  function attachEvents(pv) {
    if (attached) return;
    attached = true;
    const refresh = async () => {
      const p2 = provider(), tw = tronWebOf(p2);
      const net = await detectNetwork(p2, tw);
      const cur = tw && tw.defaultAddress ? normalizeAccount(tw.defaultAddress.base58) : null;
      Object.assign(state, { network: net.network, host: net.host, chainId: net.chainId });
      if (cur) state.address = cur;
      emit();
    };
    if (pv && typeof pv.p.on === 'function') {
      try { pv.p.on('accountsChanged', (a) => { const x = Array.isArray(a) ? normalizeAccount(a[0]) : null; if (x) { state.address = x; emit(); } else refresh(); }); } catch (_e) { /* ignoré */ }
      try { pv.p.on('chainChanged', () => { refresh(); }); } catch (_e) { /* ignoré */ }
    }
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('message', (e) => {
        const m = e && e.data && e.data.message;
        if (e && e.data && e.data.isTronLink && m && (m.action === 'setAccount' || m.action === 'setNode' || m.action === 'accountsChanged')) refresh();
      });
    }
  }

  /* Interface SigningProvider (même contrat que src/services/blockchain/signing.mjs). */
  const signer = {
    id: 'tronlink',
    get configured() { return state.connected === true; },
    get address() { return state.address; },
    async getAddress() { if (!state.connected) throw new WalletError('NOT_CONNECTED', 'connect TronLink first'); return state.address; },
    async signTransaction(tx) {
      if (!state.connected) throw new WalletError('NOT_CONNECTED', 'connect TronLink first');
      const tw = tronWebOf(provider());
      if (!tw || !tw.trx || typeof tw.trx.sign !== 'function') throw new WalletError('NO_SIGNER', 'TronLink does not expose a signing function');
      const cur = tw.defaultAddress && normalizeAccount(tw.defaultAddress.base58);
      if (cur && cur !== state.address) throw new WalletError('ACCOUNT_CHANGED', 'the TronLink account changed: reconnect');
      try {
        return await tw.trx.sign(tx);
      } catch (e) {
        if (isUserRejection(e)) { const r = new WalletError('SIGNATURE_REJECTED', 'Signature rejected by the user'); throw r; }
        throw new WalletError('SIGNING_FAILED', String((e && e.message) || e));
      }
    }
  };

  return {
    state: () => Object.assign({}, state),
    available, connect, signer,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    disconnect: () => { Object.assign(state, { connected: false, address: null }); emit(); },
    refreshNetwork: async () => {
      const pv = provider(), tw = tronWebOf(pv);
      const net = await detectNetwork(pv, tw);
      Object.assign(state, { network: net.network, host: net.host, chainId: net.chainId });
      emit();
      return Object.assign({}, state);
    }
  };
}

/* ------------------------------------------------------------------ exports */
const YorChain = {
  VERSION: '1.0.0',
  CONFIG, ChainError, WalletError,
  sha256, isAddress, cleanAddressInput, addrToHex, hexToAddr,
  parseAmount, formatAmount, formatTrx, normalizeAmountText,
  classifyHost, isUserRejection, mapRevertReason,
  createClient,
  L, S
};
