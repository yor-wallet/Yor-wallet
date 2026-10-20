/* Browser test harness: serves the static export (out/) and replaces Supabase with an in-page request mock.
   Nothing reaches a real database. Build first with `npm run build:e2e` (Supabase URL = https://sulfa-e2e.supabase.co). */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../out/', import.meta.url));
const PW = process.env.SULFA_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs';
export const SB = 'https://sulfa-e2e.supabase.co';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.txt': 'text/plain' };

export function available() {
  return existsSync(join(OUT, 'index.html')) && (existsSync(PW) || PW === 'playwright');
}

export async function serve() {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let f = join(OUT, p);
    try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { f = join(OUT, '404.html'); res.statusCode = 404; }
    try { const b = await readFile(f); res.setHeader('content-type', TYPES[extname(f)] ?? 'application/octet-stream'); res.end(b); } catch { res.statusCode = 404; res.end('not found'); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) };
}

export async function launch() {
  const { chromium } = await import(PW);
  return chromium.launch();
}

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email: user.email })}.sig`, token_type: 'bearer', expires_in: 86400, expires_at: exp,
    refresh_token: 'e2e-refresh', user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
}

/**
 * handlers: { 'rpc:sulfa_x': (body) => data | {status, body} | 'abort', 'GET:sulfa_table': (url) => rows }
 * Every call is recorded in `calls` for assertions.
 */
export async function open(browser, { path = '/', lang, user, handlers = {}, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = []; const calls = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route(`${SB}/**`, async route => {
    const req = route.request(); const u = new URL(req.url());
    const rpc = /\/rest\/v1\/rpc\/(\w+)/.exec(u.pathname); const table = /\/rest\/v1\/(\w+)/.exec(u.pathname);
    const key = rpc ? `rpc:${rpc[1]}` : table ? `${req.method()}:${table[1]}` : `${req.method()}:${u.pathname}`;
    let body = null; try { body = req.postDataJSON(); } catch {}
    calls.push({ key, body, url: u.toString() });
    const h = handlers[key];
    let out = h ? await h(body, u, calls.filter(c => c.key === key).length) : (table && !rpc ? [] : null);
    if (out === 'abort') return route.abort('failed');
    let status = 200;
    if (out && typeof out === 'object' && 'status' in out && 'body' in out) { status = out.status; out = out.body; }
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (single && Array.isArray(out)) out = out[0] ?? null;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const srv = open.server;
  await page.addInitScript(({ lang, sess }) => {
    try {
      if (lang) localStorage.setItem('sulfa_lang', lang);
      if (sess) localStorage.setItem('sb-sulfa-e2e-auth-token', JSON.stringify(sess));
    } catch {}
  }, { lang: lang ?? null, sess: user ? session(user) : null });
  await page.goto(srv.url + path);
  if (lang) await page.waitForFunction(l => document.documentElement.lang === l, lang);   // saved language applied after hydration
  return { ctx, page, errors, calls };
}

export const PROFILE = (o = {}) => ({ user_id: 'c1000000-0000-0000-0000-0000000000c1', first_name: 'Aisha', last_name: 'Al Balushi', nationality: 'OM', gender: 'F', date_of_birth: '1995-04-02',
  email: 'aisha@example.test', phone: '+96890012345', preferred_language: 'fr', account_status: 'ACTIVE', identity_status: 'VERIFIED', terms_accepted_at: '2026-10-01T08:00:00Z',
  created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z', ...o });
export const SETTINGS = { min_amount: 500, max_amount: 10000, min_term: 3, max_term: 9, fee_fixed: 0, fee_percent: 2, monthly_rate_percent: 1, currency: 'OMR', default_language: 'ar' };
export const QUOTE = { amount: 2000, term: 6, fee: 40, interest: 120, total: 2160, monthly: 360, last: 360, fee_fixed: 0, fee_percent: 2, monthly_rate_percent: 1, currency: 'OMR' };
