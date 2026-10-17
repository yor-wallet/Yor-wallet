/* Carrousel de publicités de l'accueil (12.10.0) sur la VRAIE application : 4 cartes illustrées, étiquette « Publicité » dans les 3 langues,
   aucun logo ni nom de marque tiers, images réelles présentes, points synchronisés avec le défilement, « Masquer » valable pour la session,
   défilement automatique arrêté par le toucher, droite-gauche en arabe. Supabase est remplacé par un faux client sans session (harnais). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { available, launch, openApp, WEB } from './ui-harness.mjs';

const skip = (available() && existsSync(WEB + '/js/features/promos.js')) ? false : 'Chromium / Playwright / promos.js absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const FAKE = () => {
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', country: 'OM' };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main', currency: 'OMR', balance: 1250.5, availableBalance: 1250.5, status: 'ACTIVE' }];
  Runtime.transactions = []; Runtime.cards = []; Runtime.notifications = [];
};
async function home(lang = 'en', opts = {}) {
  const s = await openApp(browser, { node: null, lang, ...opts });
  await s.page.evaluate(FAKE);
  if (lang === 'ar') await s.page.evaluate(() => { DeviceLang.set('ar'); LANG = 'ar'; applyI18n(); });   // le paramètre ?lang= du harnais ne couvre que en / fr
  await s.page.evaluate(() => { try { sessionStorage.removeItem('yor.promos.dismissed'); } catch (e) { /* rien */ } });
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('[data-promo-slide]');
  return s;
}
const activeDot = (page) => page.evaluate(() => [...document.querySelectorAll('.rv-promo-dot')].findIndex(d => d.classList.contains('on')));

test('accueil : 4 cartes « Publicité » (EN / FR / AR), chaque carte a son titre, son texte, son bouton et son image', { skip }, async () => {
  const tags = { en: 'Ad', fr: 'Publicité', ar: 'إعلان' };
  for (const lang of ['en', 'fr', 'ar']) {
    const s = await home(lang);
    const cards = await s.page.$$eval('[data-promo-slide]', els => els.map(e => ({
      tag: e.querySelector('.rv-promo-tag')?.textContent.trim(), h: e.querySelector('h3')?.textContent.trim(), p: e.querySelector('p')?.textContent.trim(),
      cta: e.querySelector('.rv-promo-cta')?.textContent.trim(), nav: e.querySelector('.rv-promo-cta')?.getAttribute('data-nav'), img: e.querySelector('img')?.getAttribute('src'),
    })));
    assert.equal(cards.length, 4, lang + ' : 4 cartes (12.12.0 : la carte « identifiant Friendly » est retirée, l\'envoi se fait par numéro de mobile)');
    for (const c of cards) {
      assert.equal(c.tag, tags[lang], lang + ' : étiquette');
      assert.ok(c.h && c.p && c.cta, lang + ' : titre, texte et bouton présents');
      assert.ok(/^assets\/ads\/ad-[a-z]+\.svg$/.test(c.img), 'image locale : ' + c.img);
      assert.ok(existsSync(WEB + '/' + c.img), 'fichier présent : ' + c.img);
    }
    assert.deepEqual(cards.map(c => c.nav), ['country-select', 'cards', 'settings', 'settings']);
    assert.equal(await s.page.evaluate(() => document.documentElement.dir), lang === 'ar' ? 'rtl' : 'ltr');
    assert.deepEqual(s.errors, [], lang + ' : aucune erreur console');
    await s.ctx.close();
  }
});

test('accueil : aucun logo ni nom de marque tiers dans les textes et les images des publicités ; aucune promesse chiffrée', { skip }, async () => {
  const BRANDS = /visa|mastercard|tether|bank\s*muscat|bmct|orange\s*money|max\s*it|binance|revolut|paypal|western\s*union|apple\s*pay|google\s*pay/i;
  const js = readFileSync(WEB + '/js/features/promos.js', 'utf8');
  assert.ok(!BRANDS.test(js), 'promos.js sans marque tierce');
  for (const id of ['send', 'card', 'secure', 'lang']) {
    const svg = readFileSync(WEB + '/assets/ads/ad-' + id + '.svg', 'utf8');
    assert.ok(svg.startsWith('<svg') || svg.startsWith('<?xml'), id + ' : SVG');
    assert.ok(!BRANDS.test(svg), id + ' : aucune marque tierce dans l\'image');
    assert.ok(!/<script|onload=|href="http|xlink:href="http/i.test(svg), id + ' : image inerte (ni script ni lien externe)');
    assert.ok(!/FRD-\d|YOR-\d/i.test(svg), id + ' : aucun identifiant réel dans l\'image');
  }
  const copy = js.slice(js.indexOf('const ITEMS'), js.indexOf('const UI'));
  assert.ok(!/\d+\s*%|\bfrais\b.*\b0\b|zero fees|free of charge|gratuit|مجان/i.test(copy), 'aucun taux, frais ou délai annoncé');
});

test('défilement : un point change la carte, le point actif suit ; le dernier point mène à la 4e carte', { skip }, async () => {
  const s = await home('en');
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await activeDot(s.page), 0);
  await s.page.locator('[data-promo-dot="2"]').click({ force: true });
  await s.page.waitForTimeout(500);
  assert.equal(await activeDot(s.page), 2);
  const vis = await s.page.evaluate(() => { const t = document.querySelector('[data-promo-track]').getBoundingClientRect(); const r = document.querySelectorAll('[data-promo-slide]')[2].getBoundingClientRect(); return Math.abs(r.left - t.left) < 3; });
  assert.ok(vis, 'la 3e carte est alignée dans le carrousel');
  await s.page.locator('[data-promo-dot="3"]').click({ force: true });
  await s.page.waitForTimeout(500);
  assert.equal(await activeDot(s.page), 3);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('points : cible tactile ≥ 24 px (zone de toucher) et jamais le gros bouton global de 44 px visible', { skip }, async () => {
  const s = await home('en');
  const m = await s.page.evaluate(() => [...document.querySelectorAll('.rv-promo-dot')].map(d => { const r = d.getBoundingClientRect(), b = getComputedStyle(d, '::before'); return { w: r.width, h: r.height, hit: parseFloat(b.height) }; }));
  for (const d of m) { assert.ok(d.w <= 22 && d.h <= 10, 'point discret : ' + JSON.stringify(d)); assert.ok(d.hit >= 24 + 7 - 1, 'zone de toucher étendue : ' + JSON.stringify(d)); }
  await s.ctx.close();
});

test('bouton d\'une carte : ouvre l\'écran annoncé (cartes), sans erreur', { skip }, async () => {
  const s = await home('en');
  await s.page.evaluate(() => document.querySelectorAll('[data-promo-slide]')[1].scrollIntoView({ inline: 'start', block: 'nearest' }));
  await s.page.waitForTimeout(500);
  await s.page.locator('[data-promo-slide]').nth(1).locator('.rv-promo-cta').click();
  await s.page.waitForTimeout(600);
  const cur = await s.page.evaluate(() => (R.current && (typeof R.current === 'function' ? R.current() : R.current)) || location.hash);
  assert.ok(/cards/.test(typeof cur === 'string' ? cur : JSON.stringify(cur)), 'écran cartes ouvert : ' + JSON.stringify(cur));
  await s.ctx.close();
});

test('« Masquer » : le carrousel disparaît, ne revient pas à la réouverture de l\'accueil (même session), rien de durable n\'est stocké', { skip }, async () => {
  const s = await home('en');
  await s.page.locator('[data-promo-hide]').click();
  assert.equal(await s.page.locator('[data-promos]').count(), 0);
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForTimeout(600);
  assert.equal(await s.page.locator('[data-promos]').count(), 0, 'toujours masqué dans la session');
  const st = await s.page.evaluate(() => ({ s: sessionStorage.getItem('yor.promos.dismissed'), l: localStorage.getItem('yor.promos.dismissed') }));
  assert.equal(st.s, '1'); assert.equal(st.l, null, 'rien en stockage durable');
  await s.ctx.close();
});

test('défilement automatique : avance seul après ~6,5 s, s\'arrête dès que la personne touche le carrousel', { skip }, async () => {
  const s = await home('en');
  assert.equal(await activeDot(s.page), 0);
  await s.page.waitForTimeout(7600);
  assert.equal(await activeDot(s.page), 1, 'a avancé d\'une carte seul');
  await s.page.evaluate(() => document.querySelector('[data-promo-track]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await s.page.waitForTimeout(7600);
  assert.equal(await activeDot(s.page), 1, 'arrêté après le toucher');
  await s.ctx.close();
});

test('« réduire les animations » : aucun défilement automatique', { skip }, async () => {
  const s = await home('en');
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await s.page.waitForTimeout(7600);
  assert.equal(await activeDot(s.page), 0);
  await s.ctx.close();
});

test('mise en page : sur 320 px et 390 px le texte ne recouvre pas l\'image, le titre et le bouton restent dans la carte', { skip }, async () => {
  for (const width of [320, 390]) {
    const s = await home('fr', { viewport: { width, height: 800 } });
    await s.page.emulateMedia({ reducedMotion: 'reduce' });
    const bad = await s.page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-promo-slide]').forEach((sl, i) => {
        sl.scrollIntoView({ inline: 'start', block: 'nearest' });
        const c = sl.getBoundingClientRect(), t = sl.querySelector('.rv-promo-txt').getBoundingClientRect(), a = sl.querySelector('.rv-promo-art').getBoundingClientRect();
        if (t.bottom > c.bottom + 1 || t.top < c.top - 1) out.push(i + ' : texte hors carte');
        const cta = sl.querySelector('.rv-promo-cta').getBoundingClientRect();
        if (cta.height < 43.5) out.push(i + ' : bouton trop petit ' + cta.height);
        // l'image ne doit pas recouvrir le titre ni le bouton (zone transparente à gauche tolérée : 12 % de la largeur de l'image)
        const artSolidLeft = a.left + a.width * 0.12;
        for (const el of [sl.querySelector('h3'), sl.querySelector('p'), sl.querySelector('.rv-promo-cta')]) { const rg = document.createRange(); rg.selectNodeContents(el); const r = el.tagName === 'BUTTON' ? el.getBoundingClientRect() : rg.getBoundingClientRect(); if (r.right > artSolidLeft + 4) out.push(i + ' : ' + el.tagName + ' recouvert (' + Math.round(r.right) + ' > ' + Math.round(artSolidLeft) + ')'); }
      });
      return out;
    });
    assert.deepEqual(bad, [], width + ' px');
    await s.ctx.close();
  }
});
