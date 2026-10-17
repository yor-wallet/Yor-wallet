// Faux secp256k1 : dérive des octets déterministes. La vraie cryptographie est prouvée dans l'environnement réel (selftest + déploiement accepté par Nile).
import { createHash, randomBytes } from 'node:crypto';
const h = (b) => new Uint8Array(createHash('sha256').update(b).digest());
export const secp256k1 = {
  getPublicKey(priv) { const a = h(priv), b = h(a); const out = new Uint8Array(65); out[0] = 4; out.set(a, 1); out.set(b, 33); return out; },
  sign(hash, priv) { const r = BigInt('0x' + Buffer.from(h(hash)).toString('hex')); return { r, s: r + 1n, recovery: 0 }; },
  utils: { randomPrivateKey: () => new Uint8Array(randomBytes(32)), isValidPrivateKey: (p) => p instanceof Uint8Array && p.length === 32 }
};
