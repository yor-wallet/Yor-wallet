/* Génère les PNG (et SVG) de marque, de partage et de lancement iPhone de Friendly Pay 12.11.0.
   Polices disponibles dans ce poste : Inter (latin), DejaVu Sans (arabe). Sur l'appareil, l'application affiche l'arabe avec la police du système ; ces PNG sont figés. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const OUT = process.argv[2]; const W = (p) => { mkdirSync(OUT + '/' + p.split('/').slice(0, -1).join('/'), { recursive: true }); return OUT + '/' + p; };
const APP = process.argv[3];                         // dossier de l'app (pour opening-art.js)
const artJs = readFileSync(APP + '/js/ui/opening-art.js', 'utf8');

const GRAD = '<linearGradient id="fp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0B7F75"/></linearGradient>';
const F_MARK = (tile = 'url(#fp)', ink = '#fff') => `<rect width="512" height="512" rx="120" fill="${tile}"/><g transform="translate(-20 -9)"><g fill="none" stroke="${ink}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"><path d="M180 388V196a54 54 0 0 1 54-54H372"/><path d="M180 266H326"/></g><circle cx="338" cy="378" r="31" fill="${ink}"/></g>`;
const FA_MARK = (tile = 'url(#fp)', ink = '#fff') => `<rect width="512" height="512" rx="120" fill="${tile}"/><g fill="none" stroke="${ink}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="318" cy="288" rx="46" ry="42"/><path d="M364 300Q364 380 290 380H150"/></g><circle cx="318" cy="150" r="31" fill="${ink}"/>`;
const svgMark = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${GRAD}</defs>${inner}</svg>`;
const LATIN = "Inter,'SF Pro Display',Helvetica,Arial,sans-serif", ARABIC = "'SF Arabic','Geeza Pro','Noto Sans Arabic','DejaVu Sans','Segoe UI',Tahoma,Arial,sans-serif";

const b = await chromium.launch();
async function png(file, w, h, html, { transparent = false, scale = 1 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const p = await ctx.newPage(); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(150);
  await p.screenshot({ path: W(file), omitBackground: transparent }); await ctx.close();
}
const page = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0}${css}</style></head><body>${body}</body></html>`;

const ONLY = process.env.ONLY || 'all'; const on = (k) => ONLY === 'all' || ONLY === k;
/* ---------- SVG ---------- */
if (on('brand')) writeFileSync(W('assets/brand/logo-mark-ar.svg'), svgMark(FA_MARK()));
const wordAr = (ink, accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" direction="rtl"><defs>${GRAD}</defs><g transform="translate(400 0) scale(.2)">${F_MARK()}</g><text x="380" y="82" text-anchor="end" font-family="${ARABIC}" font-weight="800" font-size="62" fill="${ink}">فرندي<tspan font-weight="600" fill="${accent}" dx="-14"> باي</tspan></text></svg>`;
if (on('brand')) writeFileSync(W('assets/brand/logo-wordmark-ar-dark.svg'), wordAr('#0B1F1D', '#0B7F75'));
if (on('brand')) writeFileSync(W('assets/brand/logo-wordmark-ar-white.svg'), wordAr('#FFFFFF', '#BFF5EC'));

/* ---------- PNG de marque (fond transparent) ---------- */
const wm = (lang, ink, accent, mark) => {
  const ar = lang === 'ar';
  const text = ar ? `<span style="font-family:${ARABIC};font-weight:800;font-size:70px;color:${ink}">فرندي</span><span style="font-family:${ARABIC};font-weight:600;font-size:70px;color:${accent};margin-inline-start:16px">باي</span>`
                  : `<span style="font-family:${LATIN};font-weight:800;font-size:64px;letter-spacing:-.02em;color:${ink}">Friendly</span><span style="font-family:${LATIN};font-weight:500;font-size:64px;color:${accent};margin-inline-start:12px">Pay</span>`;
  return page(`<div dir="${ar ? 'rtl' : 'ltr'}" style="display:flex;align-items:center;gap:26px;height:120px;width:520px;padding:0 0"><svg width="100" height="100" viewBox="0 0 512 512"><defs>${GRAD}</defs>${mark}</svg><div style="display:flex;align-items:baseline;white-space:nowrap">${text}</div></div>`, 'html,body{background:transparent}');
};
for (const lang of (on('brand') ? ['en', 'ar'] : [])) {
  await png(`assets/brand/png/logo-wordmark-${lang}-dark.png`, 520, 120, wm(lang, '#0B1F1D', '#0B7F75', F_MARK()), { transparent: true, scale: 3 });
  await png(`assets/brand/png/logo-wordmark-${lang}-white.png`, 520, 120, wm(lang, '#FFFFFF', '#BFF5EC', F_MARK('#FFFFFF', '#0B7F75')), { transparent: true, scale: 3 });
}
for (const [n, m] of (on('brand') ? [['logo-mark', F_MARK()], ['logo-mark-ar', FA_MARK()]] : [])) await png(`assets/brand/png/${n}-512.png`, 512, 512, page(`<svg width="512" height="512" viewBox="0 0 512 512"><defs>${GRAD}</defs>${m}</svg>`, 'html,body{background:transparent}'), { transparent: true });

/* ---------- icônes ---------- */
const icon = (m, s) => page(`<svg width="${s}" height="${s}" viewBox="0 0 512 512"><defs>${GRAD}</defs>${m}</svg>`, 'html,body{background:transparent}');
for (const s of (on('icons') ? [16, 32, 48] : [])) await png(`assets/icons/favicon-${s}.png`, s, s, icon(F_MARK(), s), { transparent: true });
for (const [s, f] of (on('icons') ? [[180, 'apple-touch-icon'], [192, 'icon-192'], [512, 'icon-512']] : [])) {
  /* pleine page (iOS arrondit lui-même) : carré plein, la lettre un peu plus petite que le gabarit */
  const full = `<rect width="512" height="512" fill="url(#fp)"/><g transform="translate(256 256) scale(.78) translate(-256 -256)">${FA_MARK('none')}</g>`;
  await png(`assets/icons/ar/${f}.png`, s, s, page(`<svg width="${s}" height="${s}" viewBox="0 0 512 512"><defs>${GRAD}</defs>${full}</svg>`));
}

/* ---------- images de partage 1200×630 (EN / FR / AR) ---------- */
const OG = {
  en: { tag: 'Your money, simple and secure.', chips: ['Send money', 'Crypto', 'Cards'] },
  fr: { tag: 'Votre argent, simple et sécurisé.', chips: ['Envoyer', 'Crypto', 'Cartes'] },
  ar: { tag: 'أموالك، بسيطة وآمنة.', chips: ['إرسال الأموال', 'عملات رقمية', 'بطاقات'] }
};
for (const lang of (on('og') ? ['en', 'fr', 'ar'] : [])) {
  const ar = lang === 'ar', f = ar ? ARABIC : LATIN, T = OG[lang];
  const html = page(`
  <div dir="${ar ? 'rtl' : 'ltr'}" style="position:relative;width:1200px;height:630px;overflow:hidden;background:linear-gradient(125deg,#08655D 0%,#0B7F75 45%,#19B9A8 100%);font-family:${f};color:#fff">
    <div style="position:absolute;width:760px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgba(94,234,212,.55),transparent 70%);${ar ? 'left' : 'right'}:-160px;top:-130px"></div>
    <div style="position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.14),transparent 70%);${ar ? 'right' : 'left'}:-180px;bottom:-240px"></div>
    <div style="position:absolute;${ar ? 'right' : 'left'}:80px;top:66px;width:660px">
      <div style="display:flex;align-items:center;gap:26px"><svg width="112" height="112" viewBox="0 0 512 512">${F_MARK('#FFFFFF', '#0B7F75')}</svg></div>
      <div style="margin-top:28px;font-size:${ar ? 96 : 92}px;font-weight:800;line-height:1.12;letter-spacing:${ar ? 0 : '-.02em'}">${ar ? 'فرندي <span style="font-weight:600;opacity:.82">باي</span>' : 'Friendly <span style="font-weight:500;opacity:.82">Pay</span>'}</div>
      <div style="margin-top:14px;font-size:36px;line-height:1.35;opacity:.92;font-weight:500">${T.tag}</div>
      <div style="margin-top:34px;display:flex;gap:12px;flex-wrap:nowrap">${T.chips.map(c => `<span style="padding:10px 22px;border-radius:999px;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.28);white-space:nowrap;font-size:25px;font-weight:600">${c}</span>`).join('')}</div>
    </div>
    <div id="art" style="position:absolute;${ar ? 'left' : 'right'}:30px;top:86px;width:520px;height:460px"></div>
  </div>
  <script>const escapeHtml=s=>String(s);${artJs.replace(/^'use strict';/, '')}
  document.body.insertAdjacentHTML('afterbegin', OpeningArt.DEFS); document.getElementById('art').innerHTML = OpeningArt.hero(0);
  document.querySelectorAll('.oa-spark').forEach(e=>e.setAttribute('fill','#fff'));</script>`, '.oa-svg{width:100%;height:100%;overflow:visible}.oa-pulse{display:none}');
  await png(`assets/share/og-${lang}.png`, 1200, 630, html);
}

/* ---------- écrans de lancement iPhone (portrait) ---------- */
const DEV = [[1320, 2868, 440, 956, 3], [1206, 2622, 402, 874, 3], [1290, 2796, 430, 932, 3], [1179, 2556, 393, 852, 3], [1284, 2778, 428, 926, 3], [1170, 2532, 390, 844, 3], [1125, 2436, 375, 812, 3], [1242, 2688, 414, 896, 3], [828, 1792, 414, 896, 2], [1242, 2208, 414, 736, 3], [750, 1334, 375, 667, 2], [640, 1136, 320, 568, 2]];
for (const [pw, ph] of (on('splash') ? DEV : [])) for (const mode of ['light', 'dark']) {
  const bg = mode === 'light' ? 'radial-gradient(72% 56% at 50% 44%,#DDF6F2 0%,#FFFFFF 76%)' : 'radial-gradient(72% 56% at 50% 44%,#0E2E2A 0%,#061110 74%)';
  const s = Math.round(pw * 0.2);
  await png(`assets/splash/ios-${pw}x${ph}-${mode}.png`, pw, ph, page(`<div style="width:${pw}px;height:${ph}px;background:${bg};display:flex;align-items:center;justify-content:center"><svg width="${s}" height="${s}" viewBox="0 0 512 512" style="filter:drop-shadow(0 ${s * .12}px ${s * .2}px rgba(11,127,117,.38))"><defs>${GRAD}</defs>${F_MARK()}</svg></div>`));
}
await b.close();
console.log('ok');
