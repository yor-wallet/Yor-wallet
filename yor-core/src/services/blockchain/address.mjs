/* YOR WALLET — adresses TRON (base58check <-> hex 41...). Aucune dépendance externe.
   Une adresse TRON = 0x41 + 20 octets, suivie de 4 octets de somme de contrôle
   (sha256(sha256(payload))[0..4]), le tout encodé en base58 (34 caractères, commence par « T »). */
import { createHash } from 'node:crypto';

export class AddressError extends Error {
  constructor(message){ super(message); this.name = 'AddressError'; this.code = 'INVALID_ADDRESS'; }
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map(Array.from(ALPHABET, (c, i) => [c, BigInt(i)]));
const sha256 = bytes => createHash('sha256').update(bytes).digest();

function b58encode(bytes){
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n){ out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes){ if (b !== 0) break; out = '1' + out; }
  return out;
}

function b58decode(str){
  let n = 0n;
  for (const ch of str){
    const v = INDEX.get(ch);
    if (v === undefined) throw new AddressError('invalid base58 character');
    n = n * 58n + v;
  }
  const bytes = [];
  while (n > 0n){ bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  let zeros = 0;
  for (const ch of str){ if (ch !== '1') break; zeros++; }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes]);
}

const HEX41 = /^41[0-9a-fA-F]{40}$/;

/** "41" + 40 hex -> adresse base58check (34 caractères). */
export function hex41ToBase58(hex){
  if (typeof hex !== 'string' || !HEX41.test(hex)) throw new AddressError('expected a 41-prefixed 21-byte hex address');
  const payload = Buffer.from(hex, 'hex');
  const check = sha256(sha256(payload)).subarray(0, 4);
  return b58encode(Buffer.concat([payload, check]));
}

/** Adresse base58check -> "41" + 40 hex (minuscules). Lève AddressError si la somme de contrôle est fausse. */
export function base58ToHex41(address){
  if (typeof address !== 'string' || address.length !== 34 || address[0] !== 'T') throw new AddressError('not a TRON base58 address');
  const raw = b58decode(address);
  if (raw.length !== 25) throw new AddressError('wrong decoded length');
  const payload = Buffer.from(raw.subarray(0, 21));
  const check = Buffer.from(raw.subarray(21));
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!check.equals(expected)) throw new AddressError('checksum mismatch');
  if (payload[0] !== 0x41) throw new AddressError('wrong network prefix');
  return payload.toString('hex');
}

export function isValidTronAddress(address){
  try { base58ToHex41(address); return true; } catch (e){ return false; }
}

/** Mot ABI de 32 octets (64 hex) pour un argument de type address : 12 octets de zéros + 20 octets. */
export function addressToAbiWord(address){
  return '0'.repeat(24) + base58ToHex41(address).slice(2);
}

/** Adresse nulle (burn). Calculée, pas recopiée. */
export const ZERO_ADDRESS = hex41ToBase58('41' + '00'.repeat(20));
