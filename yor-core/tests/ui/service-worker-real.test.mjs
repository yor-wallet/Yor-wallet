/* Service worker RÉEL (12.11.1) — les autres tests d'interface bloquent les service workers ; celui-ci les autorise.
   L'application est servie en HTTP sur localhost avec la CSP réelle de _headers ; « cdn.jsdelivr.net » est redirigé vers un faux CDN local (HTTPS, certificat
   auto-signé) qui sert un faux client Supabase. Ce que ça prouve :
   - quand le service worker CONTRÔLE la page (2e, 3e ouverture), le client Supabase se charge et l'application arrive à l'écran de connexion
     (en 12.11.0 le service worker rechargeait ce script lui-même, la CSP l'en empêchait : « Connexion impossible » à chaque ouverture) ;
   - un téléphone resté sur un ancien service worker défaillant se répare tout seul (désinscription + rechargement, une seule fois) ;
   - hors ligne, la page n'est jamais blanche (l'application ou un écran localisé).
   Ce que ça NE prouve PAS : le comportement de Safari / iOS (Chromium seulement). */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { WEB, CHROME, PW, available } from './ui-harness.mjs';

let haveSsl = true;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch (e) { haveSsl = false; }
const skip = available() && haveSsl ? false : 'Chromium / Playwright / openssl absents';

const harness = readFileSync(new URL('./ui-harness.mjs', import.meta.url), 'utf8');
const STUB = /const SUPABASE_STUB = `([\s\S]*?)`;/.exec(harness)[1];
const CSP = /Content-Security-Policy:\s*(.+)/.exec(readFileSync(WEB + '/_headers', 'utf8'))[1].trim();
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.json': 'application/json' };
const BROKEN_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (new URL(e.request.url).hostname === 'cdn.jsdelivr.net') e.respondWith(Response.error()); });`;

async function rig() {
  const dir = mkdtempSync(resolve(tmpdir(), 'fp-sw-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', dir + '/k.pem', '-out', dir + '/c.pem', '-days', '2', '-subj', '/CN=cdn.jsdelivr.net', '-addext', 'subjectAltName=DNS:cdn.jsdelivr.net'], { stdio: 'ignore' });
  const state = { brokenSw: false, cdnHits: 0 };
  const cdn = https.createServer({ key: readFileSync(dir + '/k.pem'), cert: readFileSync(dir + '/c.pem') }, (req, res) => {
    state.cdnHits++; res.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000' }); res.end(STUB);
  });
  await new Promise(r => cdn.listen(0, '127.0.0.1', r));
  const app = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/sw.js' && state.brokenSw) { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache', 'service-worker-allowed': '/' }); return res.end(BROKEN_SW); }
    const p = resolve(WEB, '.' + (u.pathname === '/' ? '/index.html' : u.pathname));
    if (!p.startsWith(WEB) || !existsSync(p)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const h = { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'content-security-policy': CSP, 'cache-control': 'no-cache' };
    if (p.endsWith('sw.js')) h['service-worker-allowed'] = '/';
    res.writeHead(200, h); res.end(readFileSync(p));
  });
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:' + cdn.address().port, '--ignore-certificate-errors', '--no-proxy-server'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow', ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('yor_onboarded', '1'); } catch (e) { /* rien */ } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  const url = 'http://localhost:' + app.address().port + '/?lang=en';
  const snap = () => page.evaluate(() => ({ sb: typeof window.supabase, active: [...document.querySelectorAll('.screen.active')].map(x => x.id), fatal: !!document.querySelector('.res-fatal'), ctl: !!(navigator.serviceWorker && navigator.serviceWorker.controller), text: document.body.innerText.trim().length }));
  /* attend (en survivant aux rechargements) que la condition soit vraie */
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); let last = null; while (Date.now() - t0 < ms) { try { last = await snap(); if (fn(last)) return last; } catch (e) { /* page en cours de rechargement */ } await page.waitForTimeout(250); } throw new Error('délai dépassé, dernier état : ' + JSON.stringify(last)); };
  const close = async () => { await browser.close(); app.close(); cdn.close(); };
  return { state, page, ctx, url, snap, until, logs, close };
}

test('service worker réel : ouverture 1, 2 et 3 (la page est contrôlée) — le client Supabase se charge, l\'application arrive à la connexion', { skip }, async () => {
  const r = await rig();
  try {
    await r.page.goto(r.url, { waitUntil: 'domcontentloaded' });
    await r.until(s => s.active.includes('login'));
    await r.page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
    for (const n of [2, 3]) {
      await r.page.reload({ waitUntil: 'domcontentloaded' });
      const s = await r.until(x => x.active.includes('login') || x.fatal);
      assert.equal(s.fatal, false, 'ouverture ' + n + ' : pas d\'écran « Connexion impossible »');
      assert.equal(s.sb, 'object', 'ouverture ' + n + ' : client Supabase chargé');
      assert.equal(s.ctl, true, 'ouverture ' + n + ' : le service worker contrôle bien la page');
    }
    assert.deepEqual(r.logs.filter(l => /Supabase client unavailable|ERR_FAILED/.test(l)), []);
  } finally { await r.close(); }
});

test('service worker réel : un téléphone resté sur un service worker défaillant se répare seul (une seule fois) et arrive à la connexion', { skip }, async () => {
  const r = await rig();
  try {
    r.state.brokenSw = true;                                                  /* « ancien » service worker : bloque le client Supabase */
    await r.page.goto(r.url, { waitUntil: 'domcontentloaded' });
    await r.until(s => s.active.includes('login'));
    await r.until(s => s.ctl);                                                /* le service worker défaillant contrôle la page */
    r.state.brokenSw = false;                                                 /* le site est mis à jour : sw.js corrigé */
    await r.page.reload({ waitUntil: 'domcontentloaded' });
    const s = await r.until(x => x.active.includes('login'), 25000);
    assert.equal(s.fatal, false); assert.equal(s.sb, 'object');
    assert.equal(await r.page.evaluate(() => sessionStorage.getItem('fp.swheal')), '1', 'la réparation automatique a bien eu lieu');
    /* et ensuite le nouveau service worker prend le relais normalement */
    await r.until(x => x.ctl, 15000);
    await r.page.reload({ waitUntil: 'domcontentloaded' });
    const t = await r.until(x => x.active.includes('login') || x.fatal);
    assert.equal(t.fatal, false);
  } finally { await r.close(); }
});

test('service worker réel : hors ligne, la page n\'est jamais blanche (application ou écran localisé)', { skip }, async () => {
  const r = await rig();
  try {
    await r.page.goto(r.url, { waitUntil: 'domcontentloaded' });
    await r.until(s => s.active.includes('login'));
    await r.page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
    await r.page.reload({ waitUntil: 'domcontentloaded' });
    await r.until(s => s.active.includes('login'));
    await r.page.waitForTimeout(1500);                                        /* la copie hors ligne se termine d'installer */
    await r.ctx.setOffline(true);
    await r.page.goto(r.url, { waitUntil: 'domcontentloaded' }).catch(() => { /* hors ligne : la navigation peut être servie par le cache */ });
    await r.page.waitForTimeout(3000);
    const s = await r.snap();
    assert.ok(s.text > 15, 'la page affiche du texte hors ligne : ' + JSON.stringify(s));
  } finally { await r.close(); }
});

test('service worker : il n\'intercepte jamais une ressource d\'un autre site', { skip }, () => {
  const sw = readFileSync(resolve(WEB, 'sw.js'), 'utf8');
  assert.match(sw, /url\.origin !== self\.location\.origin\) return;/);
  assert.doesNotMatch(sw.replace(/\/\*[\s\S]*?\*\//g, ''), /jsdelivr|SB_CDN|https?:\/\//i, 'aucune adresse externe dans le code du service worker');
});
