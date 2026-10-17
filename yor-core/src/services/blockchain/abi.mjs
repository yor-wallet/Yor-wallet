/* YOR WALLET — décodage/encodage ABI minimal (uint256, string). TronGrid reçoit le sélecteur sous forme
   de texte (« balanceOf(address) »), donc aucun keccak256 n'est nécessaire côté client. */

export class AbiError extends Error {
  constructor(message){ super(message); this.name = 'AbiError'; this.code = 'ABI_ERROR'; }
}

function clean(hex){
  if (typeof hex !== 'string') throw new AbiError('hex string expected');
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) throw new AbiError('invalid hex');
  return h;
}

const MAX_UINT256 = (1n << 256n) - 1n;

export function encodeUint256(value){
  const n = BigInt(value);
  if (n < 0n || n > MAX_UINT256) throw new AbiError('uint256 out of range');
  return n.toString(16).padStart(64, '0');
}

export function decodeUint256(hex, wordIndex = 0){
  const h = clean(hex);
  const start = wordIndex * 64;
  if (h.length < start + 64) throw new AbiError('result too short for a uint256');
  return BigInt('0x' + h.slice(start, start + 64));
}

export function decodeString(hex){
  const h = clean(hex);
  const offset = decodeUint256(h, 0);
  if (offset > 1024n || offset % 32n !== 0n) throw new AbiError('bad string offset');
  const lenStart = Number(offset) * 2;
  if (h.length < lenStart + 64) throw new AbiError('result too short for a string');
  const len = BigInt('0x' + h.slice(lenStart, lenStart + 64));
  if (len > 4096n) throw new AbiError('string too long');
  const dataStart = lenStart + 64;
  const dataEnd = dataStart + Number(len) * 2;
  if (h.length < dataEnd) throw new AbiError('string data truncated');
  return Buffer.from(h.slice(dataStart, dataEnd), 'hex').toString('utf8');
}

/** TronGrid renvoie parfois les messages d'erreur en hexadécimal ASCII. */
export function hexToText(hex){
  if (typeof hex !== 'string' || hex === '') return '';
  if (!/^([0-9a-fA-F]{2})+$/.test(hex)) return hex;
  const text = Buffer.from(hex, 'hex').toString('utf8');
  return /^[\x20-\x7e\s]*$/.test(text) ? text : hex;
}
