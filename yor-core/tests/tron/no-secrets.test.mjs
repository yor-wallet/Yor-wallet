import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Garde-fou V2 : aucune clé privée / seed / secret en dur dans le code livré (sources du service, contrat, fonctions, application web). */
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WEB = join(ROOT, '..', 'yor-wallet');
const EXT = new Set(['.mjs', '.js', '.ts', '.sol', '.html', '.json', '.md', '.sql']);

function walk(dir, out = []){
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)){
    if (n === 'node_modules' || n === '.git') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (EXT.has(extname(p))) out.push(p);
  }
  return out;
}

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'bloc PEM de clé privée'],
  [/\b(private[_-]?key|privateKey|secret[_-]?key|mnemonic|seed[_-]?phrase)\b\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, 'clé/seed affectée à un littéral'],
  [/\b[0-9a-fA-F]{64}\b/, 'littéral hexadécimal de 64 caractères (taille d\'une clé privée)']
];
const HEX64_PATTERN = PATTERNS[2][0];
const HEX64_PATTERN_LABEL = PATTERNS[2][1];

/* Exception étroite : une ligne portant le marqueur « public-hash » (empreinte publique ou vecteur de test connu) peut contenir un
   littéral de 64 hex, SAUF si cette même ligne parle de clé / secret / seed. Toute autre ligne reste interdite. */
const HEX64 = /\b[0-9a-fA-F]{64}\b/;
const KEYISH = /priv|secret|seed|mnemonic|key/i;
function lineIsAllowedPublicHash(line){
  return line.includes('public-hash') && !KEYISH.test(line.replace(/public-hash/g, ''));
}

function scanText(text){
  const hits = [];
  for (const [re, label] of PATTERNS){
    if (re === HEX64_PATTERN){
      if (text.split('\n').some((line) => HEX64.test(line) && !lineIsAllowedPublicHash(line))) hits.push(label);
    } else if (re.test(text)) hits.push(label);
  }
  return hits;
}

function scan(files){
  const hits = [];
  for (const f of files){
    for (const label of scanText(readFileSync(f, 'utf8'))) hits.push(`${f}: ${label}`);
  }
  return hits;
}

test('garde-fou : l\'exception « public-hash » reste étroite', () => {
  const h = 'a'.repeat(64);
  const label = HEX64_PATTERN_LABEL;
  assert.deepEqual(scanText(`const x = "${h}";`), [label], 'un littéral de 64 hex sans marqueur est refusé');
  assert.deepEqual(scanText(`const x = "${h}"; // public-hash : vecteur`), [], 'avec marqueur, une empreinte publique passe');
  assert.deepEqual(scanText(`const privateKeyHex = "${h}"; // public-hash`), [label], 'un marqueur ne protège pas une ligne qui parle de clé');
  assert.deepEqual(scanText(`const secret = "${h}"; // public-hash`), [label], 'ni de secret');
  assert.equal(scanText('-----BEGIN EC PRIVATE KEY-----').length, 1, 'PEM toujours refusé');
});

test('sources du service blockchain, contrat et fonctions : aucun secret en dur', () => {
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'contracts')), ...walk(join(ROOT, 'supabase')), ...walk(join(ROOT, 'model'))];
  assert.ok(files.length > 5, 'fichiers à analyser trouvés');
  assert.deepEqual(scan(files), []);
});

test('application web (HTML/JS publics) : aucune clé privée, seed ni littéral de 64 hex', { skip: !existsSync(WEB) && 'dossier yor-wallet absent de cet arbre' }, () => {
  const files = walk(WEB);
  assert.ok(files.length > 10);
  assert.deepEqual(scan(files), []);
});
