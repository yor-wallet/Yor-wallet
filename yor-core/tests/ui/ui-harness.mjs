/* Banc d'essai navigateur (Chromium sans tête) pour l'écran YOR-USDT.
   - la page est l'écran RÉEL (HTML/CSS/JS de yor-wallet/) dans une coquille minimale (sans Supabase ni connexion) ;
   - TronLink est un FAUX portefeuille injecté avant le chargement (aucune clé, signature factice) ;
   - le réseau Nile est un faux nœud dont les réponses sont des réponses réelles enregistrées (tests/web/fixtures.mjs).
   Ce que ce banc NE prouve PAS : le comportement du vrai TronLink, ni celui de la vraie chaîne en direct. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB = process.env.YOR_WEB ? resolve(process.env.YOR_WEB) : resolve(HERE, '../../../yor-wallet');
export const CHROME = process.env.YOR_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const PW = process.env.YOR_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright/index.mjs';

export const available = () => existsSync(WEB + '/js/screens/chain-wallet.js') && existsSync(CHROME) && existsSync(PW);

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.png': 'image/png' };
const CSS = ['base', 'buttons', 'layout', 'motion', 'home', 'redesign', 'v12', 'chain', 'yor-ds'].map(n => `<link rel="stylesheet" href="css/${n}.css">`).join('');
const SHELL = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${CSS}</head>
<body><div id="app"><div id="main"><div id="toasts"></div><div id="screens"></div></div></div>
<script>const R={onLeave(){},back(){window.__back=true}};const Runtime={ctx:{role:new URLSearchParams(location.search).get('role')||'admin'}};</script>
<script src="js/i18n/translations.js"></script><script src="js/core/utils-lang.js"></script><script src="js/ui/icons.js"></script><script src="js/screens/home.js"></script>
<script src="js/features/yor-chain.js"></script><script src="js/screens/chain-wallet.js"></script>
<script>
const q=new URLSearchParams(location.search);
LANG=q.get('lang')||'en';document.documentElement.lang=LANG;document.documentElement.dir=LANG==='ar'?'rtl':'ltr';
if(q.get('theme')==='light')document.documentElement.setAttribute('data-theme','light');
document.documentElement.style.setProperty('--ui','1.1');
const sec=document.createElement('section');sec.id='chain';sec.className='screen active';document.getElementById('screens').appendChild(sec);
sec.innerHTML=renderChain();wireChain(sec);window.__ready=true;
</script></body></html>`;

/* Faux TronLink injecté avant tout script de la page. */
export function tronLinkScript(opts) {
  return `(() => {
    const o = ${JSON.stringify(opts)};
    const state = { signCalls: [], requests: [], mode: o.signMode || 'approve' };
    window.__tl = state;
    const tw = { defaultAddress: { base58: o.address }, fullNode: { host: o.host || 'https://nile.trongrid.io' },
      trx: { sign: async (tx) => { state.signCalls.push(JSON.parse(JSON.stringify(tx)));
        if (state.mode === 'reject') throw 'Confirmation declined by user';
        if (state.mode === 'hang') return new Promise(() => {});
        if (state.mode === 'garble') return Object.assign({}, tx, { txID: '11'.repeat(32), signature: ['ab'.repeat(65)] });
        return Object.assign({}, tx, { signature: ['ab'.repeat(65)] }); } } };
    const request = async ({ method }) => { state.requests.push(method);
      if (method === 'eth_requestAccounts') return [o.address];
      if (method === 'eth_chainId') return o.chainId || '0xcd8690dc';
      const e = new Error('unsupported'); e.code = 4200; throw e; };
    window.tron = { request, tronWeb: tw, on() {} };
  })();`;
}

export async function launch() {
  const { chromium } = await import(PW);
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

/** Ouvre l'écran. `node` = faux nœud (makeNode) ; `wallet` = options de faux TronLink ou null. */
export async function openScreen(browser, { node, wallet = null, lang = 'en', theme = 'dark', viewport = { width: 390, height: 844 } }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en-GB' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  const external = [];
  await page.route('http://yor.test/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: SHELL });
    const p = resolve(WEB, '.' + u.pathname);
    if (existsSync(p)) return route.fulfill({ status: 200, contentType: MIME[extname(p)] || 'application/octet-stream', body: readFileSync(p) });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.route(/^https?:\/\/(?!yor\.test)/, async route => {
    const req = route.request();
    const u = new URL(req.url());
    external.push(req.method() + ' ' + u.host + u.pathname);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (u.host !== 'nile.trongrid.io') return route.fulfill({ status: 403, body: 'blocked by test' });
    try {
      const res = await node.fetch(req.url(), { method: req.method(), body: req.postData() || undefined });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(await res.json()) });
    } catch (e) { return route.abort('failed'); }
  });
  if (wallet) await page.addInitScript(tronLinkScript(wallet));
  await page.goto('http://yor.test/?lang=' + lang + '&theme=' + theme);
  await page.waitForFunction(() => window.__ready === true);
  return { page, ctx, errors, external };
}

/* ------------------------------------------------------------------------------------------------
   Vraie application : index.html réel + CSP réelle de _headers, Supabase REMPLACÉ par un faux client (aucune session).
   Sert à prouver que l'app démarre sans erreur avec les nouveaux scripts et que l'écran est joignable depuis Services.
   ------------------------------------------------------------------------------------------------ */
const SUPABASE_STUB = `(() => { const mk = () => new Proxy(function(){}, { get: (_t, k) => k === 'then' ? (res) => res({ data: null, error: null }) : mk(), apply: () => mk() });
  const auth = { onAuthStateChange(cb){ setTimeout(() => cb('INITIAL_SESSION', null), 0); return { data: { subscription: { unsubscribe(){} } } }; }, getSession: async () => ({ data: { session: null }, error: null }) };
  window.supabase = { createClient: () => new Proxy({ auth }, { get: (t, k) => k in t ? t[k] : mk() }) }; })();`;
const APP_MIME = Object.assign({ '.webmanifest': 'application/manifest+json', '.json': 'application/json' }, MIME);

export const appCsp = () => /Content-Security-Policy:\s*(.+)/.exec(readFileSync(WEB + '/_headers', 'utf8'))[1].trim();

export async function openApp(browser, { node, wallet = null, lang = 'en', role = 'admin', viewport = { width: 390, height: 844 }, onboarded = true, hash = '', raw = false, reducedMotion = false, colorScheme = 'light', storage = null, crypto = false }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar-OM' : 'en-GB', serviceWorkers: 'block', colorScheme, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  const csp = appCsp();
  await page.route('http://yor.test/**', route => {
    const u = new URL(route.request().url());
    const p = resolve(WEB, '.' + (u.pathname === '/' ? '/index.html' : u.pathname));
    if (existsSync(p)) {
      let body = readFileSync(p);
      /* 12.12.0 : la section crypto est MASQUÉE par défaut (FEATURES.crypto=false). Les tests du code crypto conservé la réactivent ICI, dans la copie servie au navigateur : */
      if (crypto && /\/js\/data\/reference-data\.js$/.test(u.pathname)) body = Buffer.from(body.toString('utf8').replace('crypto: false', 'crypto: true'));
      return route.fulfill({ status: 200, headers: { 'content-security-policy': csp, 'content-type': APP_MIME[extname(p)] || 'application/octet-stream' }, body });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.route(/^https?:\/\/(?!yor\.test)/, async route => {
    const req = route.request();
    const u = new URL(req.url());
    external.push(req.method() + ' ' + u.host + u.pathname);
    if (u.host === 'cdn.jsdelivr.net' && /supabase/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: SUPABASE_STUB });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (u.host !== 'nile.trongrid.io' || !node) return route.fulfill({ status: 403, body: 'blocked by test' });
    try {
      const res = await node.fetch(req.url(), { method: req.method(), body: req.postData() || undefined });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(await res.json()) });
    } catch (e) { return route.abort('failed'); }
  });
  if (onboarded) await page.addInitScript(() => { try { localStorage.setItem('yor_onboarded', '1'); } catch (e) {} });   /* pas de diaporama de bienvenue */
  if (storage) await page.addInitScript(kv => { try { for (const k in kv) localStorage.setItem(k, kv[k]); } catch (e) {} }, storage);
  if (wallet) await page.addInitScript(tronLinkScript(wallet));
  await page.goto('http://yor.test/?lang=' + lang + hash);
  if (raw) return { page, ctx, errors, external };
  await page.waitForFunction(() => typeof R === 'object' && typeof renderChain === 'function' && !!document.getElementById('splash'));
  await page.waitForTimeout(1800);              /* le démarrage de l'app (écran de garde, ~1,3 s) */
  /* Sur un démarrage lent (premier test, machine chargée), l'app change encore d'écran après ces 1,8 s (écran de garde → connexion) et
     effacerait l'écran que le test vient d'ouvrir : on attend que l'écran de garde soit réellement parti. */
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.style.display === 'none'; }, null, { timeout: 10000 }).catch(() => {});
  /* Session simulée : le garde de session du routeur laisse passer. Aucun appel Supabase réel. */
  await page.evaluate(r => { const c = { uid: 'u1', userId: 'U1', yorId: 'YOR1', role: r }; UserContext.set(c); Runtime.ctx = c; }, role);
  return { page, ctx, errors, external };
}

