/* Contrôles STATIQUES de l'intégration dans l'application web (sans navigateur) : ordre des scripts, cache hors-ligne,
   CSP, enregistrement de l'écran, routage, bundle synchronisé. Ignoré si le dossier yor-wallet est absent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle } from '../../scripts/build-web.mjs';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../yor-wallet');
const skip = existsSync(WEB + '/index.html') ? false : 'dossier yor-wallet absent';
const rd = f => readFileSync(WEB + '/' + f, 'utf8');

test('index.html : feuille de style et scripts présents, dans le bon ordre (bundle avant l\'écran, écran avant register.js)', { skip }, () => {
  const html = rd('index.html');
  assert.match(html, /<link rel="stylesheet" href="css\/chain\.css">/);
  const pos = s => { const i = html.indexOf('src="' + s + '"'); assert.ok(i > 0, s + ' absent'); return i; };
  assert.ok(pos('js/features/yor-chain.js') < pos('js/screens/chain-wallet.js'));
  assert.ok(pos('js/screens/chain-wallet.js') < pos('js/screens/register.js'));
  assert.ok(pos('js/screens/home.js') < pos('js/screens/chain-wallet.js'), 'chain-wallet.js utilise YT / yt de home.js');
  assert.equal((html.match(/yor-chain\.js/g) || []).length, 1);
});

test('hors-ligne : sw.js met en cache les 3 nouveaux fichiers et sa version suit celle de l\'app', { skip }, () => {
  const sw = rd('sw.js');
  for (const f of ['css/chain.css', 'js/features/yor-chain.js', 'js/screens/chain-wallet.js']) assert.ok(sw.includes("'" + f + "'"), f + ' absent du SHELL');
  const appVersion = /version:'([\d.]+)'/.exec(rd('js/data/reference-data.js'))[1];
  assert.equal(/const CACHE = 'yor-shell-v([\d.]+)'/.exec(sw)[1], appVersion);
});

test('chaque fichier local référencé par index.html existe et figure dans le SHELL du service worker', { skip }, () => {
  const html = rd('index.html'), sw = rd('sw.js');
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length > 30);
  for (const f of refs) { assert.ok(existsSync(WEB + '/' + f), f + ' introuvable'); assert.ok(sw.includes("'" + f + "'"), f + ' absent du SHELL'); }
});

test('CSP (_headers et vercel.json) : Nile autorisé, mainnet / Shasta absents, pas de wildcard', { skip }, () => {
  const fromHeaders = /Content-Security-Policy:\s*(.+)/.exec(rd('_headers'))[1];
  const vj = JSON.parse(rd('vercel.json'));
  const entry = vj.headers.flatMap(h => h.headers).find(h => h.key.toLowerCase() === 'content-security-policy');
  assert.ok(entry, 'CSP absente de vercel.json');
  for (const [name, csp] of [['_headers', fromHeaders], ['vercel.json', entry.value]]) {
    const connect = /connect-src ([^;]+)/.exec(csp)[1].split(/\s+/);
    assert.ok(connect.includes('https://nile.trongrid.io'), name + ' : nile.trongrid.io manquant');
    for (const bad of ['https://api.trongrid.io', 'https://api.shasta.trongrid.io', '*', 'https:', 'https://*']) assert.ok(!connect.includes(bad), name + ' : ' + bad + ' ne doit pas être autorisé');
    assert.ok(!/\bshasta\b|api\.trongrid\.io/.test(csp), name + ' : mention mainnet/shasta');
  }
  assert.equal(/connect-src ([^;]+)/.exec(fromHeaders)[1].trim(), /connect-src ([^;]+)/.exec(entry.value)[1].trim(), '_headers et vercel.json doivent rester identiques');
});

test('écran enregistré, routé, câblé et exposé dans Services', { skip }, () => {
  assert.match(rd('js/screens/register.js'), /\bchain:\s*renderChain\b/);
  const router = rd('js/core/router.js');
  assert.match(router, /'chain':'services'/g);
  assert.equal((router.match(/'chain':'services'/g) || []).length, 2, 'PARENT et NAV_KEYS');
  assert.match(rd('js/wire.js'), /id === 'chain' && typeof wireChain === 'function'/);
  assert.match(rd('js/wire.js'), /n === 'chain'\) R\.go\('chain'\)/, 'le clic sur la tuile (data-nav) doit ouvrir l\'écran');
  assert.match(rd('js/screens/crypto-market.js'), /\['gChain', \[\['chain','wallet','chainTile'\]\]\]/);
});

test('YOR-USDT réservé aux administrateurs : tuile conditionnelle, garde du routeur, écran vide sans le rôle', { skip }, () => {
  assert.match(rd('js/screens/chain-wallet.js'), /Runtime\.ctx\.role === 'admin'/);
  assert.match(rd('js/screens/chain-wallet.js'), /function renderChain\(\)\{ return canUseChain\(\) \? ChainUI\.render\(\) : ''; \}/);
  assert.match(rd('js/screens/crypto-market.js'), /canUseChain\(\)\) G\.splice\(1, 0, \['gChain'/);
  assert.match(rd('js/core/router.js'), /ADMIN_SCREENS = \['chain'\]/);
  assert.match(rd('js/core/router.js'), /ADMIN_SCREENS\.indexOf\(id\) !== -1 && !\(typeof canUseChain === 'function' && canUseChain\(\)\)/);
});

test('le bundle servi est exactement celui construit depuis les sources (lib.ts + transfer-state.mjs + chain-client.js)', { skip }, () => {
  assert.equal(rd('js/features/yor-chain.js'), buildBundle(), 'lancer : npm run build:web');
});

test('aucune référence mainnet / Tether (hors gardes de refus) ni secret dans les fichiers livrés avec l\'écran', { skip }, () => {
  for (const f of ['js/features/yor-chain.js', 'js/screens/chain-wallet.js', 'css/chain.css']) {
    const src = rd(f).split('\n').filter(l => !l.includes('MAINNET_FORBIDDEN')).join('\n');   /* les gardes qui REFUSENT le mainnet sont autorisées */
    assert.ok(!/api\.trongrid\.io|api\.shasta|TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/.test(src), f + ' : référence mainnet/Tether interdite');
    assert.ok(!/(?:private[_ ]?key|mnemonic|seed phrase)\s*[:=]\s*['"][^'"]{8,}/i.test(src), f + ' : secret en clair');
  }
});
