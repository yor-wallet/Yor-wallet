// Renders the SULFA app icons and iOS launch screens from brand.html into web/public.
// Usage: node render.mjs   (needs Playwright + Chromium and web/node_modules for the font)
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '../../web/public');
const out = path.join(pub, 'brand');
fs.mkdirSync(out, { recursive: true });

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs')); }

// iPhone launch screens: [css width, css height, pixel ratio]
export const LAUNCH = [
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await page.goto(pathToFileURL(path.join(here, 'brand.html')).href);

const shotIcon = async (rounded, size, file) => {
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.evaluate(r => window.renderIcon(r), rounded);
  await page.waitForTimeout(150);
  const buf = await page.locator('.icon').screenshot({ omitBackground: true });
  const tmp = path.join(out, '.tmp.png'); fs.writeFileSync(tmp, buf);
  const { execFileSync } = await import('node:child_process');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `scale=${size}:${size}:flags=lanczos`, file]);
  fs.unlinkSync(tmp);
};

await shotIcon(false, 1024, path.join(out, 'icon-1024.png'));
await shotIcon(false, 180, path.join(pub, 'apple-touch-icon.png'));
await shotIcon(false, 192, path.join(pub, 'icon-192.png'));
await shotIcon(false, 512, path.join(pub, 'icon-512.png'));
await shotIcon(true, 512, path.join(out, 'icon-rounded-512.png'));
await shotIcon(true, 64, path.join(pub, 'favicon-64.png'));

for (const [w, h, r] of LAUNCH) {
  const W = w * r, H = h * r;
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(([a, c]) => window.renderLaunch(a, c), [W, H]);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `launch-${W}x${H}.jpg`), type: 'jpeg', quality: 88 });
}
await b.close();
console.log('ok', fs.readdirSync(out).length, 'files in', out);
