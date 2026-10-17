import { pathToFileURL } from 'node:url';
import { resolve as r } from 'node:path';
const D = r(import.meta.dirname, 'stubs');
const MAP = {
  'npm:@noble/curves@1.4.2/secp256k1': 'secp.mjs',
  'npm:@noble/hashes@1.4.0/sha3': 'keccak.mjs',
  'npm:@noble/hashes@1.4.0/sha256': 'sha256.mjs',
  'jsr:@supabase/functions-js/edge-runtime.d.ts': 'empty.mjs',
  'npm:solc@0.8.19': 'solc.mjs',
  'npm:@supabase/supabase-js@2': 'supabase-js.mjs'
};
export async function resolve(spec, ctx, next) {
  if (MAP[spec]) return { url: pathToFileURL(r(D, MAP[spec])).href, shortCircuit: true };
  return next(spec, ctx);
}
