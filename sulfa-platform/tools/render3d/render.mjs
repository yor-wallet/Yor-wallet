/* node render.mjs [size] [obj ...] → ../../web/public/3d/<obj>.png + .webp (transparent background) */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = resolve(import.meta.dirname, '../..'); const OUT = join(ROOT, 'web/public/3d');
const PW = process.env.SULFA_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs';
const size = Number(process.argv[2] || 1536); const objs = process.argv.slice(3).length ? process.argv.slice(3) : ['card', 'coins', 'shield', 'idcard', 'calendar', 'bell'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => { try { const f = join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); r.setHeader('content-type', T[extname(f)] ?? 'application/octet-stream'); r.end(await readFile(f)); } catch { r.statusCode = 404; r.end(); } });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const { chromium } = await import(PW);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await mkdir(OUT, { recursive: true });
for (const o of objs) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://127.0.0.1:${srv.address().port}/tools/render3d/scene.html?obj=${o}&size=${size}`);
  await p.waitForFunction(() => window.__png, null, { timeout: 180000 }).catch(() => {});
  const url = await p.evaluate(() => window.__png);
  if (!url) { console.log('FAIL', o, errs.join(' | ')); continue; }
  const png = join(OUT, `${o}.png`); await writeFile(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '88', '-pix_fmt', 'yuva420p', join(OUT, `${o}.webp`)]);
  console.log('ok', o); await p.close();
}
await b.close(); srv.close();
