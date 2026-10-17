#!/usr/bin/env node
/* YOR WALLET — assemble le bundle navigateur `yor-wallet/js/features/yor-chain.js`.

   Une seule source de vérité pour la logique qui protège l'argent :
     - supabase/functions/token-admin/lib.ts           (adresses, ABI, contrôle de transaction, classification) — types effacés ;
     - src/services/blockchain/transfer-state.mjs      (machine d'états d'un transfert) ;
     - web/chain-client.js                             (client TronLink / Nile, écrit à la main).
   Le résultat est un script classique unique (aucun module, aucun outil de build côté Netlify) qui n'expose que `window.YorChain`.

   Usage :
     node scripts/build-web.mjs                 écrit ../yor-wallet/js/features/yor-chain.js
     node scripts/build-web.mjs --out <fichier> écrit ailleurs
     node scripts/build-web.mjs --check         échoue si le fichier existant n'est pas identique au bundle recalculé */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, '../yor-wallet/js/features/yor-chain.js');

const read = rel => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(text).digest('hex');

/** Source d'un module -> corps de fonction qui renvoie ses exports. */
function wrapModule(name, rel, { ts }) {
  const original = read(rel);
  let code = ts ? stripTypeScriptTypes(original, { mode: 'strip' }) : original;
  const names = [];
  code = code.replace(/^export\s+(async\s+)?(function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/gm, (_m, asyn, kind, id) => {
    names.push(id);
    return (asyn || '') + kind + ' ' + id;
  });
  if (/^\s*(import\s|export\s)/m.test(code)) throw new Error(`${rel}: import/export résiduel : le module n'est pas assemblable`);
  if (!names.length) throw new Error(`${rel}: aucun export trouvé`);
  const body = `const ${name} = (function () {\n'use strict';\n${code.trimEnd()}\nreturn { ${names.join(', ')} };\n})();\n`;
  return { body, hash: sha(original), rel, count: names.length };
}

export function buildBundle() {
  const L = wrapModule('L', 'supabase/functions/token-admin/lib.ts', { ts: true });
  const S = wrapModule('S', 'src/services/blockchain/transfer-state.mjs', { ts: false });
  const client = read('web/chain-client.js');
  const header = [
    '/* ============================================================================================================',
    ' * YOR WALLET — client blockchain (Nile, TronLink).   FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.',
    ' * Régénérer : (dans yor-core)  node scripts/build-web.mjs   — vérifier : node scripts/build-web.mjs --check',
    ' * Sources (sha256) :',
    ` *   ${L.rel}  ${L.hash}  (public-hash)`,
    ` *   ${S.rel}  ${S.hash}  (public-hash)`,
    ` *   web/chain-client.js  ${sha(client)}  (public-hash)`,
    ' * Expose uniquement window.YorChain. Aucune clé privée : la signature est faite par TronLink.',
    ' * ============================================================================================================ */'
  ].join('\n');
  return [
    header,
    '(function (root) {',
    "'use strict';",
    L.body,
    S.body,
    client.trimEnd(),
    'Object.freeze(YorChain);',
    'root.YorChain = YorChain;',
    "})(typeof window !== 'undefined' ? window : globalThis);",
    ''
  ].join('\n');
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const oi = args.indexOf('--out');
  const out = oi >= 0 ? resolve(args[oi + 1]) : DEFAULT_OUT;
  const bundle = buildBundle();
  if (check) {
    if (!existsSync(out)) { console.error(`ABSENT : ${out} (lancer node scripts/build-web.mjs)`); process.exit(1); }
    const cur = readFileSync(out, 'utf8');
    if (cur !== bundle) { console.error(`DÉSYNCHRONISÉ : ${out} diffère du bundle recalculé (lancer node scripts/build-web.mjs)`); process.exit(1); }
    console.log(`OK : ${out} est identique au bundle recalculé (${bundle.length} octets, sha256 ${sha(bundle).slice(0, 16)}…)`);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bundle);
    console.log(`écrit ${out} (${bundle.length} octets, sha256 ${sha(bundle)})`);
  }
}
