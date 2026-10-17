/* YOR WALLET — TronProvider : lecture de la chaîne (source de vérité) et préparation/diffusion de transactions.
   Les noms de points d'accès viennent de la documentation TRON (FullNode HTTP) :
     POST /wallet/getnowblock, /wallet/triggerconstantcontract, /wallet/triggersmartcontract,
          /wallet/broadcasttransaction, /wallet/gettransactioninfobyid, /walletsolidity/gettransactioninfobyid
   Statut d'exécution : ces appels n'ont PAS été exécutés contre un nœud réel depuis cet environnement
   (le réseau sortant du bac à sable n'atteint pas TronGrid). Les tests utilisent un fetch simulé qui vérifie
   la FORME des requêtes, pas le comportement du réseau TRON. */
import { addressToAbiWord, isValidTronAddress } from './address.mjs';
import { encodeUint256, decodeUint256, decodeString, hexToText } from './abi.mjs';
import { TOKEN } from './config.mjs';

export const API_KEY_HEADER = 'TRON-PRO-API-KEY';

export class TronError extends Error {
  constructor(code, message, extra = {}){ super(message); this.name = 'TronError'; this.code = code; Object.assign(this, extra); }
}

/** Classe l'état d'une transaction à partir des réponses gettransactioninfobyid (nœud complet) et solidity.
    Pure : pas d'appel réseau. « confirmed » exige la transaction SOLIDIFIÉE ET un receipt SUCCESS. */
export function classifyTransactionInfo(txid, info, solidInfo){
  const has = i => !!i && typeof i === 'object' && Object.keys(i).length > 0 && (i.id !== undefined || i.blockNumber !== undefined);
  const inBlock = has(info) || has(solidInfo);
  if (!inBlock) return { state: 'broadcasted', evidence: null };

  const src = has(solidInfo) ? solidInfo : info;
  const solidified = has(solidInfo);
  const result = src.receipt && src.receipt.result;
  const blockNumber = Number.isInteger(src.blockNumber) ? src.blockNumber : null;
  const failedByTop = src.result === 'FAILED';

  if ((result && result !== 'SUCCESS') || failedByTop){
    const reason = hexToText(src.resMessage || '') || result || 'FAILED';
    /* Un échec dans un bloc non solidifié reste provisoire : on ne l'annonce « failed » qu'une fois solidifié. */
    if (solidified) return { state: 'failed', reason, evidence: { txid, blockNumber, receiptResult: result || 'FAILED', solidified: true } };
    return { state: 'confirming', provisional: 'failed', reason, evidence: null };
  }
  if (result === 'SUCCESS' && solidified && blockNumber){
    return { state: 'confirmed', evidence: { txid, blockNumber, receiptResult: 'SUCCESS', solidified: true } };
  }
  return { state: 'confirming', evidence: null };
}

export class TronProvider {
  #cfg; #fetch; #timeoutMs;

  constructor(cfg, { fetch: f = globalThis.fetch, timeoutMs = 10000 } = {}){
    if (!cfg || !cfg.network) throw new TronError('BAD_CONFIG', 'a configuration from loadConfig() is required');
    if (typeof f !== 'function') throw new TronError('NO_FETCH', 'no fetch implementation available');
    this.#cfg = cfg; this.#fetch = f; this.#timeoutMs = timeoutMs;
  }

  get config(){ return this.#cfg; }

  async #post(path, body){
    const headers = { 'content-type': 'application/json', accept: 'application/json' };
    if (this.#cfg.apiKey) headers[API_KEY_HEADER] = this.#cfg.apiKey;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    let res;
    try {
      res = await this.#fetch(this.#cfg.baseUrl + path, { method: 'POST', headers, body: JSON.stringify(body ?? {}), signal: ctrl.signal });
    } catch (e){
      throw new TronError(ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK_UNREACHABLE', `TRON node unreachable (${path})`);
    } finally { clearTimeout(timer); }
    if (!res || !res.ok) throw new TronError('HTTP_ERROR', `TRON node answered HTTP ${res && res.status} (${path})`, { status: res && res.status });
    try { return await res.json(); }
    catch (e){ throw new TronError('BAD_RESPONSE', `TRON node returned a non-JSON body (${path})`); }
  }

  #requireToken(){
    if (!this.#cfg.contractAddress){
      throw new TronError('TOKEN_NOT_DEPLOYED', `${TOKEN.symbol} contract is not deployed on ${this.#cfg.network.id}: set YOR_TOKEN_CONTRACT_ADDRESS after a real deployment`);
    }
  }

  async getNowBlock(){
    const j = await this.#post('/wallet/getnowblock', {});
    const raw = j && j.block_header && j.block_header.raw_data;
    if (!raw || !Number.isInteger(raw.number)) throw new TronError('BAD_RESPONSE', 'getnowblock: missing block number');
    return { number: raw.number, timestamp: raw.timestamp };
  }

  /* Appel en lecture seule (aucune signature, aucun frais). */
  async constantCall(selector, parameter = '', owner){
    this.#requireToken();
    const ownerAddr = owner || this.#cfg.contractAddress;
    const j = await this.#post('/wallet/triggerconstantcontract', {
      owner_address: ownerAddr, contract_address: this.#cfg.contractAddress,
      function_selector: selector, parameter, visible: true
    });
    if (!j || !j.result || j.result.result !== true){
      const detail = hexToText(j && j.result && j.result.message) || 'no detail';
      const nodeCode = j && j.result && j.result.code;
      /* Forme réelle observée sur Nile et Shasta (2026-10-08) pour une adresse sans contrat :
         {"result":{"code":"CONTRACT_VALIDATE_ERROR","message":"Smart contract is not exist."}} (message en texte clair). */
      if (nodeCode === 'CONTRACT_VALIDATE_ERROR' && /not exist/i.test(detail)){
        throw new TronError('CONTRACT_NOT_FOUND', `no contract at ${this.#cfg.contractAddress} on ${this.#cfg.network.id}: wrong network or not deployed`);
      }
      throw new TronError('CALL_FAILED', `${selector} failed: ${nodeCode ? nodeCode + ' ' : ''}${detail}`);
    }
    const out = j.constant_result && j.constant_result[0];
    if (typeof out !== 'string') throw new TronError('BAD_RESPONSE', `${selector}: no constant_result`);
    return out;
  }

  async #viewAddr(selector, address){
    if (!isValidTronAddress(address)) throw new TronError('INVALID_ADDRESS', 'invalid TRON address');
    return decodeUint256(await this.constantCall(selector, addressToAbiWord(address), address));
  }

  balanceOf(address){ return this.#viewAddr('balanceOf(address)', address); }
  availableBalanceOf(address){ return this.#viewAddr('availableBalanceOf(address)', address); }
  expiredBalanceOf(address){ return this.#viewAddr('expiredBalanceOf(address)', address); }
  async totalSupply(){ return decodeUint256(await this.constantCall('totalSupply()')); }

  /** Lit name/symbol/decimals ON-CHAIN et refuse une adresse qui n'est pas le jeton attendu
      (protège contre une adresse de contrat mal collée, par exemple un vrai Tether). */
  async tokenInfo(){
    const [name, symbol, decimals] = await Promise.all([
      this.constantCall('name()').then(decodeString),
      this.constantCall('symbol()').then(decodeString),
      this.constantCall('decimals()').then(h => Number(decodeUint256(h)))
    ]);
    if (name !== TOKEN.name || symbol !== TOKEN.symbol || decimals !== TOKEN.decimals){
      throw new TronError('TOKEN_METADATA_MISMATCH', `contract is "${name}" / "${symbol}" / ${decimals}, expected "${TOKEN.name}" / "${TOKEN.symbol}" / ${TOKEN.decimals}`);
    }
    return { name, symbol, decimals };
  }

  /* Construit (sans signer) la transaction transfer(address,uint256). Le plafond de frais vient de la configuration :
     aucune valeur n'est inventée ici. */
  async buildTransferTx({ from, to, amountRaw }){
    this.#requireToken();
    if (this.#cfg.feeLimitSun === null) throw new TronError('FEE_LIMIT_NOT_CONFIGURED', 'YOR_FEE_LIMIT_SUN is not configured: refusing to invent a fee limit');
    if (!isValidTronAddress(from) || !isValidTronAddress(to)) throw new TronError('INVALID_ADDRESS', 'invalid TRON address');
    if (typeof amountRaw !== 'bigint' || amountRaw <= 0n) throw new TronError('INVALID_AMOUNT', 'amountRaw must be a positive bigint');
    const j = await this.#post('/wallet/triggersmartcontract', {
      owner_address: from, contract_address: this.#cfg.contractAddress,
      function_selector: 'transfer(address,uint256)',
      parameter: addressToAbiWord(to) + encodeUint256(amountRaw),
      fee_limit: Number(this.#cfg.feeLimitSun), call_value: 0, visible: true
    });
    if (!j || !j.result || j.result.result !== true || !j.transaction || !j.transaction.txID){
      throw new TronError('BUILD_FAILED', `could not build the transfer: ${hexToText(j && j.result && j.result.message) || 'no detail'}`);
    }
    return j.transaction;
  }

  async broadcast(signedTx){
    if (!signedTx || !Array.isArray(signedTx.signature) || signedTx.signature.length === 0) throw new TronError('NOT_SIGNED', 'refusing to broadcast an unsigned transaction');
    const j = await this.#post('/wallet/broadcasttransaction', signedTx);
    if (!j || j.result !== true){
      throw new TronError('BROADCAST_REJECTED', `broadcast rejected: ${j && j.code ? j.code + ' ' : ''}${hexToText(j && j.message) || 'no detail'}`);
    }
    return { txid: signedTx.txID };
  }

  async transactionStatus(txid){
    if (typeof txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(txid)) throw new TronError('INVALID_TXID', 'invalid transaction id');
    const info = await this.#post('/wallet/gettransactioninfobyid', { value: txid });
    const solid = await this.#post('/walletsolidity/gettransactioninfobyid', { value: txid });
    return classifyTransactionInfo(txid, info, solid);
  }
}
