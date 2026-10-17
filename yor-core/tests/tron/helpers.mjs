/* Outils de test — AUCUN appel réseau réel. Le fetch simulé enregistre les requêtes pour vérifier leur forme. */
import { hex41ToBase58 } from '../../src/services/blockchain/address.mjs';
import { encodeUint256 } from '../../src/services/blockchain/abi.mjs';

export function mockFetch(handler){
  const calls = [];
  const f = async (url, init = {}) => {
    const call = { url, method: init.method, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    const r = await handler(call);
    if (r instanceof Error) throw r;
    const status = r.status === undefined ? 200 : r.status;
    return { ok: status >= 200 && status < 300, status, json: async () => { if (r.badJson) throw new Error('bad json'); return r.json; } };
  };
  f.calls = calls;
  return f;
}

/* Adresses SYNTHÉTIQUES pour les tests (octet répété) : ce ne sont ni des contrats ni des comptes réels. */
export const synthetic = byteHex => hex41ToBase58('41' + byteHex.repeat(20));
export const ADDR_A = synthetic('11');
export const ADDR_B = synthetic('22');
export const CONTRACT = synthetic('33');

export const uintResult = n => ({ result: { result: true }, constant_result: [encodeUint256(n)] });

export function stringResult(s){
  const data = Buffer.from(s, 'utf8').toString('hex');
  const padded = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
  return { result: { result: true }, constant_result: [encodeUint256(32) + encodeUint256(s.length) + padded] };
}

export const TXID = 'ab'.repeat(32);
