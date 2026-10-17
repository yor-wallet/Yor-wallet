// Keccak-256 (Keccak original, padding 0x01) en BigInt — SEULEMENT pour le banc d'essai local (noble n'est pas installable ici).
const M = (1n << 64n) - 1n;
const RC = [0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n];
const ROTC = [1,3,6,10,15,21,28,36,45,55,2,14,27,41,56,8,25,43,62,18,39,61,20,44];
const PILN = [10,7,11,17,18,3,5,16,8,21,24,4,15,23,19,13,12,2,20,14,22,9,6,1];
const rotl = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M;
function f(st) {
  const bc = new Array(5);
  for (let r = 0; r < 24; r++) {
    for (let i = 0; i < 5; i++) bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
    for (let i = 0; i < 5; i++) { const t = bc[(i + 4) % 5] ^ rotl(bc[(i + 1) % 5], 1); for (let j = 0; j < 25; j += 5) st[j + i] ^= t; }
    let t = st[1];
    for (let i = 0; i < 24; i++) { const j = PILN[i]; const b = st[j]; st[j] = rotl(t, ROTC[i]); t = b; }
    for (let j = 0; j < 25; j += 5) { for (let i = 0; i < 5; i++) bc[i] = st[j + i]; for (let i = 0; i < 5; i++) st[j + i] ^= (~bc[(i + 1) % 5] & M) & bc[(i + 2) % 5]; }
    st[0] ^= RC[r];
  }
}
export function keccak_256(data) {
  const rate = 136;
  const msg = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  msg.set(data); msg[data.length] ^= 0x01; msg[msg.length - 1] ^= 0x80;
  const st = new Array(25).fill(0n);
  for (let off = 0; off < msg.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) { let w = 0n; for (let b = 7; b >= 0; b--) w = (w << 8n) | BigInt(msg[off + i * 8 + b]); st[i] ^= w; }
    f(st);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((st[i] >> BigInt(8 * b)) & 0xffn);
  return out;
}
