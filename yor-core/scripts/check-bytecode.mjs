/* Vérifie le bytecode produit par `forge build` pour la machine virtuelle TRON (TVM) :
   - aucun opcode récent absent de la TVM visée (PUSH0, MCOPY, TLOAD, TSTORE, BLOBHASH, BLOBBASEFEE) ;
   - taille du code déployé <= 24 576 octets.
   Balayage linéaire : les octets de données PUSH sont sautés. Un faux positif reste théoriquement possible
   (données incorporées après le code) : en cas d'alerte, on examine avant de conclure.
   Ce script NE prouve PAS la compatibilité TVM : seul un déploiement réel sur Nile le fera. */
import { readFileSync, existsSync } from 'node:fs';

const path = new URL('../out/YORExperimentalUSDT.sol/YORExperimentalUSDT.json', import.meta.url);
if (!existsSync(path)) { console.error('artefact introuvable : lancez `forge build` d\'abord'); process.exit(2); }

const art = JSON.parse(readFileSync(path, 'utf8'));
const runtime = Buffer.from(art.deployedBytecode.object.replace(/^0x/, ''), 'hex');
const init = Buffer.from(art.bytecode.object.replace(/^0x/, ''), 'hex');

function stripMetadata(code){
  if (code.length < 4) return code;
  const n = code.readUInt16BE(code.length - 2);
  const start = code.length - 2 - n;
  return start > 0 && code[start] >= 0xa1 && code[start] <= 0xa5 ? code.subarray(0, start) : code;
}

const FORBIDDEN = { 0x49: 'BLOBHASH', 0x4a: 'BLOBBASEFEE', 0x5c: 'TLOAD', 0x5d: 'TSTORE', 0x5e: 'MCOPY', 0x5f: 'PUSH0' };

function scan(code){
  const hits = [];
  for (let i = 0; i < code.length;){
    const op = code[i];
    if (FORBIDDEN[op]) hits.push({ pc: i, op: FORBIDDEN[op] });
    i += op >= 0x60 && op <= 0x7f ? 1 + (op - 0x5f) : 1;
  }
  return hits;
}

const rt = stripMetadata(runtime);
const it = stripMetadata(init);
const hits = [...scan(rt).map(h => ({ ...h, where: 'runtime' })), ...scan(it).map(h => ({ ...h, where: 'init' }))];

console.log(`code déployé : ${runtime.length} octets (limite 24576)`);
console.log(`code d'initialisation : ${init.length} octets`);
console.log(`opcodes interdits trouvés : ${hits.length}`);
for (const h of hits) console.log(`  ${h.where} pc=${h.pc} ${h.op}`);

let failed = false;
if (runtime.length > 24576) { console.error('ÉCHEC : code déployé trop grand'); failed = true; }
if (hits.length) { console.error('ÉCHEC : opcodes non supportés par la TVM visée'); failed = true; }
process.exit(failed ? 1 : 0);
