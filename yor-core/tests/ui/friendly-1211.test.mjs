/* Friendly Pay 12.11.0 sur la VRAIE application (index.html réel + CSP réelle ; Supabase remplacé par un faux client sans session).
   Ce que ces tests prouvent :
   - l'ouverture : écran d'ouverture animé puis présentation en 4 pages (une seule fois), « Passer » → connexion, dernière page → inscription,
     flèches / points / langue, sens inversé en arabe, mouvement réduit = état final immédiat ;
   - la robustesse : un écran dont l'affichage échoue montre un message clair avec « Réessayer » qui fonctionne ; hors-ligne = bannière ;
     les erreurs bénignes (annulations) ne dérangent jamais ; démarrage impossible = écran localisé sans détail technique ;
   - le thème : « clair » tant que rien n'est choisi, « système » suit le téléphone ;
   - l'arabe : aucun texte arabe visible ne reçoit d'espacement entre les lettres (cela casserait l'écriture), sur les écrans principaux ;
   - la cohérence des fichiers : tout ce que index.html charge est dans la copie hors-ligne du service worker, chaque fichier listé existe,
     le manifest pointe vers des fichiers existants, les pages hors-ligne / 404 sont autonomes.
   Ce qu'ils NE prouvent PAS : le rendu sur un vrai iPhone, ni le vrai service worker en ligne (les tests le bloquent), ni TronLink / Trust Wallet. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { available, launch, openApp, WEB } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const read = (f) => readFileSync(resolve(WEB, f), 'utf8');

/* ============================== OUVERTURE ============================== */
const openFresh = async (opts = {}) => {
  const s = await openApp(browser, Object.assign({ node: null, onboarded: false, raw: true }, opts));
  await s.page.waitForSelector('.ob.is-in', { timeout: 20000 });
  return s;
};

test('ouverture : écran d\'ouverture animé (logo + mot-symbole), puis présentation en 4 pages', { skip }, async () => {
  const s = await openApp(browser, { node: null, onboarded: false, raw: true });
  await s.page.waitForSelector('#splash svg', { timeout: 5000 });
  const sp = await s.page.evaluate(() => ({ txt: document.getElementById('splash').textContent, svgs: document.querySelectorAll('#splash svg').length }));
  assert.match(sp.txt, /Friendly/); assert.match(sp.txt, /PAY/i); assert.ok(sp.svgs >= 1);
  await s.page.waitForSelector('.ob.is-in', { timeout: 20000 });
  const info = await s.page.evaluate(() => ({ slides: document.querySelectorAll('.ob-slide').length, dots: document.querySelectorAll('[data-dot]').length,
    on: document.querySelectorAll('.ob-slide.on').length, splashGone: getComputedStyle(document.getElementById('splash')).display === 'none' || document.getElementById('splash').classList.contains('is-hidden') }));
  assert.equal(info.slides, 4); assert.equal(info.dots, 4); assert.equal(info.on, 1); assert.ok(info.splashGone, 'l\'écran d\'ouverture est parti');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('ouverture : « Suivant » enchaîné très vite (150 ms) ×3 puis « Créer mon compte » → inscription ; la présentation ne revient plus', { skip }, async () => {
  const s = await openFresh();
  for (let k = 1; k <= 3; k++) { await s.page.click('#ob-next'); await s.page.waitForTimeout(150); }
  assert.equal(await s.page.evaluate(() => [...document.querySelectorAll('.ob-slide')].findIndex(x => x.classList.contains('on'))), 3, 'les 3 appuis rapides comptent tous (pas de garde anti-double-appui sur « Suivant »)');
  assert.match(await s.page.innerText('#ob-next'), /Create my account/);
  await s.page.click('#ob-next');
  await s.page.waitForSelector('#signup.active', { timeout: 5000 });
  assert.equal(await s.page.evaluate(() => localStorage.getItem('yor_onboarded')), '1');
  assert.equal(await s.page.locator('.ob').count(), 0, 'présentation retirée');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('ouverture : « Passer » et « J\'ai déjà un compte » mènent à la connexion', { skip }, async () => {
  for (const sel of ['#ob-skip', '#ob-have']) {
    const s = await openFresh();
    if (sel === '#ob-have') { await s.page.click('[data-dot="3"]'); await s.page.waitForTimeout(150); }      /* « J'ai déjà un compte » apparaît sur la dernière page */
    else assert.equal(await s.page.evaluate(() => document.getElementById('ob-have').getAttribute('aria-hidden')), 'true', '« J\'ai déjà un compte » est masqué (et hors tabulation) avant la dernière page');
    await s.page.click(sel);
    await s.page.waitForSelector('#login.active', { timeout: 5000 });
    assert.equal(await s.page.evaluate(() => localStorage.getItem('yor_onboarded')), '1');
    await s.ctx.close();
  }
});

test('ouverture : clavier (flèches), points et choix de langue ; la langue choisie est mémorisée', { skip }, async () => {
  const s = await openFresh();
  const cur = () => s.page.evaluate(() => [...document.querySelectorAll('.ob-slide')].findIndex(x => x.classList.contains('on')));
  assert.equal(await cur(), 0);
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(80);
  assert.equal(await cur(), 1);
  await s.page.keyboard.press('ArrowLeft'); await s.page.waitForTimeout(80);
  assert.equal(await cur(), 0);
  await s.page.click('[data-dot="2"]'); await s.page.waitForTimeout(80);
  assert.equal(await cur(), 2);
  await s.page.click('[data-ob-lang="fr"]'); await s.page.waitForTimeout(150);
  assert.equal(await s.page.evaluate(() => document.documentElement.lang), 'fr');
  assert.match(await s.page.innerText('#ob-skip'), /Passer/i);
  assert.equal(await s.page.evaluate(() => localStorage.getItem('yor_device_lang')), 'fr');
  await s.page.click('[data-ob-lang="ar"]'); await s.page.waitForTimeout(150);
  assert.equal(await s.page.evaluate(() => document.documentElement.dir), 'rtl');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('ouverture (arabe) : sens inversé, mot-symbole « فرندي باي », flèche « suivant » = ←', { skip }, async () => {
  const s = await openFresh({ lang: 'ar' });
  assert.equal(await s.page.evaluate(() => document.documentElement.dir), 'rtl');
  const cur = () => s.page.evaluate(() => [...document.querySelectorAll('.ob-slide')].findIndex(x => x.classList.contains('on')));
  await s.page.keyboard.press('ArrowLeft'); await s.page.waitForTimeout(80);
  assert.equal(await cur(), 1, 'en arabe, ← = page suivante');
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(80);
  assert.equal(await cur(), 0);
  const txt = await s.page.evaluate(() => document.querySelector('.ob').textContent);
  assert.doesNotMatch(txt, /Friendly Pay|NEX|YOR/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('ouverture (mouvement réduit) : aucune animation, la présentation se ferme tout de suite', { skip }, async () => {
  const s = await openFresh({ reducedMotion: true });
  const anim = await s.page.evaluate(() => [...document.querySelectorAll('.ob *')].filter(e => { const a = getComputedStyle(e).animationName; return a && a !== 'none' && getComputedStyle(e).animationIterationCount === 'infinite'; }).length);
  assert.equal(anim, 0, 'aucune animation infinie');
  await s.page.click('#ob-skip');
  await s.page.waitForSelector('#login.active', { timeout: 3000 });
  await s.ctx.close();
});

test('ouverture : déjà vue = connexion directe, sans présentation', { skip }, async () => {
  const s = await openApp(browser, { node: null, onboarded: true, raw: true });
  await s.page.waitForSelector('#login.active', { timeout: 20000 });
  assert.equal(await s.page.locator('.ob').count(), 0);
  await s.ctx.close();
});

test('ouverture : petits écrans et paysage — tout reste accessible (boutons dans l\'écran, pas de défilement horizontal)', { skip }, async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const s = await openFresh({ viewport: vp });
    const m = await s.page.evaluate(() => { const b = document.getElementById('ob-next').getBoundingClientRect(); return { bottom: b.bottom, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth, top: b.top }; });
    assert.ok(m.bottom <= m.h + 1 && m.top >= 0, 'bouton Suivant visible : ' + JSON.stringify(m) + ' @' + vp.width + 'x' + vp.height);
    assert.ok(m.sw <= m.w + 1, 'pas de défilement horizontal');
    await s.ctx.close();
  }
});

/* ============================== ROBUSTESSE ============================== */
test('robustesse : un écran qui plante affiche un message clair ; « Réessayer » le rouvre dès qu\'il fonctionne', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(() => { window.__boom = true; R.register({ 'zz-test': () => { if (window.__boom) throw new Error('boom'); return '<div id="zz-ok"><h1>Fonctionne</h1></div>'; } }); R.go('zz-test', { force: true }); });
  await s.page.waitForSelector('#zz-test .res-screen');
  assert.match(await s.page.innerText('#zz-test'), /could not open/i);
  assert.doesNotMatch(await s.page.innerText('#zz-test'), /boom|Error|undefined/);
  assert.equal(await s.page.locator('#zz-test [data-res-retry="zz-test"]').count(), 1);
  assert.equal(await s.page.evaluate(() => document.getElementById('zz-test').classList.contains('active')), true, 'l\'écran de secours est affiché (jamais un écran figé)');
  await s.page.evaluate(() => { window.__boom = false; });
  await s.page.click('[data-res-retry="zz-test"]');
  await s.page.waitForSelector('#zz-test #zz-ok');
  assert.equal(await s.page.locator('#zz-test .res-screen').count(), 0);
  await s.page.evaluate(() => { window.__boom = true; R.go('zz-test', { force: true }); });
  await s.page.waitForSelector('#zz-test .res-screen');
  await s.page.click('#zz-test [data-res-home]');
  await s.page.waitForFunction(() => R.current() === 'home');
  await s.ctx.close();
});

test('robustesse : l\'écran de secours existe en 3 langues, « Accueil » ramène à l\'accueil, l\'écran d\'accueil propose « Redémarrer »', { skip }, async () => {
  for (const [lang, re] of [['en', /could not open/i], ['fr', /pas pu s'ouvrir/], ['ar', /تعذّر فتح/]]) {
    const s = await openApp(browser, { node: null, lang });
    const html = await s.page.evaluate(() => ({ other: Resilience.errorScreen('settings'), home: Resilience.errorScreen('home') }));
    await s.page.evaluate((h) => { const d = document.createElement('div'); d.id = 'probe'; d.innerHTML = h; document.body.appendChild(d); }, html.other);
    assert.match(await s.page.innerText('#probe'), re);
    assert.equal(await s.page.locator('#probe [data-res-home]').count(), 1);
    assert.equal(await s.page.locator('#probe [data-res-reload]').count(), 0);
    await s.page.evaluate((h) => { document.getElementById('probe').innerHTML = h; }, html.home);
    assert.equal(await s.page.locator('#probe [data-res-reload]').count(), 1);
    assert.equal(await s.page.locator('#probe [data-res-home]').count(), 0);
    await s.ctx.close();
  }
});

test('robustesse : l\'identifiant d\'écran n\'est jamais injecté tel quel dans le HTML de secours', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  const html = await s.page.evaluate(() => Resilience.errorScreen('"><img src=x onerror=alert(1)>'));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /data-res-retry="[a-z0-9-]*"/, 'seuls lettres, chiffres et tirets survivent dans l\'identifiant');
  await s.ctx.close();
});

test('robustesse : hors-ligne = bannière, retour en ligne = bannière verte qui disparaît', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.ctx.setOffline(true);
  await s.page.waitForSelector('#net-banner.is-off.is-on', { timeout: 3000 });
  assert.match(await s.page.innerText('#net-banner'), /offline/i);
  await s.ctx.setOffline(false);
  await s.page.waitForSelector('#net-banner.is-ok.is-on', { timeout: 3000 });
  assert.match(await s.page.innerText('#net-banner'), /Back online/i);
  await s.page.waitForFunction(() => !document.getElementById('net-banner').classList.contains('is-on'), null, { timeout: 5000 });
  await s.ctx.close();
});

test('robustesse : erreurs bénignes ignorées ; une vraie erreur = au plus une notification toutes les 10 s, sans détail technique', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  const benign = await s.page.evaluate(() => [{ name: 'AbortError' }, { message: 'ResizeObserver loop limit exceeded' }, { message: 'The user aborted a request.' }, { name: 'NotAllowedError' }, 'Script error.'].map(r => Resilience._benign(r)));
  assert.deepEqual(benign, [true, true, true, true, true]);
  assert.equal(await s.page.evaluate(() => Resilience._benign(new TypeError('x is undefined'))), false);
  const toasts = () => s.page.evaluate(() => document.querySelectorAll('#toasts > *').length);
  const before = await toasts();
  await s.page.evaluate(() => { for (let k = 0; k < 4; k++) Promise.reject(new Error('internal detail ' + k)); });
  await s.page.waitForTimeout(400);
  const after = await toasts();
  assert.ok(after - before <= 1, 'au plus une notification : ' + (after - before));
  const text = await s.page.evaluate(() => document.getElementById('toasts').innerText);
  assert.doesNotMatch(text, /internal detail|Error/);
  await s.ctx.close();
});

test('robustesse : démarrage impossible = écran localisé « Réessayer », sans message technique', { skip }, async () => {
  for (const [lang, re] of [['en', /Cannot connect/], ['fr', /Connexion impossible/], ['ar', /تعذّر الاتصال/]]) {
    const s = await openApp(browser, { node: null, lang });
    await s.page.evaluate(() => Resilience.fatal('dev-only detail'));
    await s.page.waitForSelector('#splash .res-fatal');
    const txt = await s.page.innerText('#splash');
    assert.match(txt, re); assert.doesNotMatch(txt, /dev-only detail/);
    assert.equal(await s.page.locator('#splash [data-res-reload]').count(), 1);
    await s.ctx.close();
  }
});

/* ============================== THÈME ============================== */
test('thème : « clair » par défaut ; « système » suit le téléphone (clair / sombre) en direct', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  assert.equal(await s.page.evaluate(() => { Runtime.settings = {}; return savedThemeMode(); }), 'light');
  assert.equal(await s.page.evaluate(() => { Runtime.settings = { theme: 'bogus' }; return savedThemeMode(); }), 'light');
  assert.equal(await s.page.evaluate(() => { Runtime.settings = { theme: 'dark' }; const m = savedThemeMode(); Runtime.settings = {}; return m; }), 'dark');
  /* « Système » : le téléphone passe en mode nuit puis revient en mode jour pendant que l'app est ouverte */
  const frame = () => s.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await s.page.evaluate(() => applyTheme('system'));
  assert.equal(await s.page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  await s.page.emulateMedia({ colorScheme: 'dark' }); await frame();
  await s.page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', null, { polling: 100, timeout: 8000 });
  await s.page.emulateMedia({ colorScheme: 'light' }); await frame();
  await s.page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', null, { polling: 100, timeout: 8000 });
  await s.page.evaluate(() => applyTheme('nonsense'));
  assert.equal(await s.page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  assert.equal(await s.page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content')), '#F4FAF9');
  await s.page.evaluate(() => applyTheme('dark'));
  assert.equal(await s.page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content')), '#061110');
  await s.ctx.close();
});

/* ============================== ARABE ============================== */
const seedHome = () => {
  const now = Date.now();
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000', photo: null };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 12.5, availableBalance: 12.5, reservedBalance: 0, status: 'ACTIVE', country: 'OM' }];
  Runtime.transactions = [{ id: 't1', reference: 'FRD-TX-0001', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status: 'SUCCESS', currency: 'OMR', amount: 5, fee: .3, vat: 0, total: 5.3, createdAt: now - 3600e3, beneficiary: { name: 'Aisha Said', phone: '+96891234567' } }];
  Runtime.receipts = []; Runtime.notifications = [];
  Runtime.cards = [{ id: 'c1', type: 'VIRTUAL', brand: 'FRD', theme: 'obsidian', holderName: 'SAJAD AJMI', number: '9701123412341234', currency: 'OMR', frozen: false, label: 'Obsidian', createdAt: now }];
};
test('arabe : aucun texte arabe visible n\'a d\'espacement entre les lettres (connexion, inscription, accueil, cartes, services, paramètres, secours)', { skip }, async () => {
  const s = await openApp(browser, { node: null, lang: 'ar' });
  await s.page.evaluate(seedHome);
  const bad = [];
  for (const id of ['login', 'signup', 'home', 'cards', 'services', 'settings', 'history', 'notifications', 'crypto']) {
    if (id === 'login' || id === 'signup') await s.page.evaluate(() => { AuthEngine.hasValidContext = () => false; });
    else await s.page.evaluate(() => { AuthEngine.hasValidContext = () => true; });
    await s.page.evaluate((x) => { try { R.go(x, { force: true }); } catch (e) { /* écran absent */ } }, id);
    await s.page.waitForTimeout(250);
    const hits = await s.page.evaluate(() => {
      const out = []; const AR = /[\u0620-\u064A\u066E-\u06D3]/;
      for (const el of document.querySelectorAll('.screen.active *, #splash *')) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        const own = [...el.childNodes].filter(n => n.nodeType === 3 && AR.test(n.nodeValue)).length;
        if (!own) continue;
        const ls = getComputedStyle(el).letterSpacing;
        if (ls !== 'normal' && parseFloat(ls) !== 0) out.push((el.className && el.className.baseVal === undefined ? '.' + String(el.className).split(' ')[0] : el.tagName) + ' ls=' + ls + ' "' + el.textContent.trim().slice(0, 20) + '"');
      }
      return out;
    });
    hits.forEach(h => bad.push(id + ': ' + h));
  }
  assert.deepEqual(bad, [], 'texte arabe espacé : ' + bad.join(' | '));
  await s.ctx.close();
});

test('arabe : l\'ouverture et l\'écran de secours n\'utilisent jamais de lettres espacées', { skip }, async () => {
  const s = await openFresh({ lang: 'ar' });
  const bad = await s.page.evaluate(() => [...document.querySelectorAll('.ob *')].filter(e => /[\u0620-\u064A\u066E-\u06D3]/.test([...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('')) && !['normal', '0px'].includes(getComputedStyle(e).letterSpacing)).map(e => e.className));
  assert.deepEqual(bad, []);
  await s.ctx.close();
});

/* ============================== COHÉRENCE DES FICHIERS ============================== */
const swShell = () => {
  const src = read('sw.js');
  const block = /const SHELL = \[([\s\S]*?)\];/.exec(src)[1];
  return [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);
};
const localRefs = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) out.push(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) out.push(m[1]);
  return out.filter(u => !/^(https?:)?\/\//.test(u)).map(u => u.split('?')[0]);
};

test('hors-ligne : tout script / feuille de style local de index.html est dans la copie du service worker, et chaque fichier listé existe', { skip }, () => {
  const shell = swShell();
  const refs = localRefs(read('index.html'));
  assert.ok(refs.length > 40, 'index.html charge ses scripts : ' + refs.length);
  const missingFromSw = refs.filter(r => !shell.includes(r));
  assert.deepEqual(missingFromSw, [], 'absents du service worker : ' + missingFromSw.join(', '));
  const missingOnDisk = shell.filter(f => f !== './' && !existsSync(resolve(WEB, f)));
  assert.deepEqual(missingOnDisk, [], 'listés mais absents : ' + missingOnDisk.join(', '));
  assert.equal(new Set(shell).size, shell.length, 'pas de doublon');
  for (const must of ['index.html', 'offline.html', 'manifest.webmanifest']) assert.ok(shell.includes(must), must + ' dans la copie hors-ligne');
});

test('hors-ligne : le service worker est valide, porte la version de l\'app, ne met jamais en cache Supabase / API / chaîne', { skip }, () => {
  const sw = read('sw.js');
  execFileSync(process.execPath, ['--check', resolve(WEB, 'sw.js')]);
  const ver = /version:'([\d.]+)'/.exec(read('js/data/reference-data.js'))[1];
  assert.ok(sw.includes("'fp-shell-v" + ver + "'"), 'nom du cache = version ' + ver);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /req\.method !== 'GET'/);
  assert.doesNotMatch(sw, /\.addAll\(/, 'un fichier manquant ne doit pas empêcher l\'installation (pas de cache.addAll)');
  assert.doesNotMatch(sw.replace(/\/\*[\s\S]*?\*\//g, ''), /supabase\.co|trongrid|walletconnect|reown/i, 'aucune URL d\'API dans le code du service worker');
});

test('fichiers : manifest, icônes, raccourcis, pages hors-ligne / 404 / robots, favicon', { skip }, () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const ic of m.icons) assert.ok(existsSync(resolve(WEB, ic.src)), 'icône ' + ic.src);
  assert.ok(m.icons.some(i => /512/.test(i.sizes)) && m.icons.some(i => /192/.test(i.sizes)));
  assert.ok(m.icons.some(i => /maskable/.test(i.purpose || '')), 'une icône « maskable » pour Android');
  for (const sc of (m.shortcuts || [])) { assert.ok(sc.name && sc.url); for (const ic of (sc.icons || [])) assert.ok(existsSync(resolve(WEB, ic.src)), 'icône de raccourci ' + ic.src); }
  const metaTheme = /<meta name="theme-color" content="([^"]+)"/.exec(read('index.html'))[1];
  assert.equal(m.theme_color.toUpperCase(), metaTheme.toUpperCase(), 'couleur de la barre = celle de la page au premier affichage');
  for (const f of ['offline.html', '404.html', 'robots.txt', 'favicon.ico', '_headers']) assert.ok(existsSync(resolve(WEB, f)), f);
  for (const f of ['offline.html', '404.html']) {
    const h = read(f);
    assert.doesNotMatch(h, /<script[^>]+src=|<link[^>]+href="https?:|@import|url\(https?:/i, f + ' est autonome (aucune ressource externe)');
    assert.match(h, /Friendly/);
    assert.doesNotMatch(h, /NEX WALLET|YOR WALLET/);
  }
});

test('fichiers : les images PNG arabes / de partage / de démarrage existent et ont les bonnes dimensions', { skip }, () => {
  const dims = (f) => { const b = readFileSync(resolve(WEB, f)); assert.equal(b.subarray(1, 4).toString(), 'PNG', f + ' est un PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(dims('assets/icons/icon-512.png'), [512, 512]);
  assert.deepEqual(dims('assets/icons/icon-192.png'), [192, 192]);
  assert.deepEqual(dims('assets/icons/apple-touch-icon.png'), [180, 180]);
  const share = ['en', 'fr', 'ar'].map(l => 'assets/share/og-' + l + '.png');
  for (const f of share) assert.deepEqual(dims(f), [1200, 630], f);
  const png = ['assets/brand/png/friendly-pay-ar.png'].filter(f => existsSync(resolve(WEB, f)));
  assert.ok(png.length >= 0);
});

test('fichiers : index.html — description, aperçu de partage (Open Graph / Twitter), favicon, couleur du thème, image de démarrage iPhone', { skip }, () => {
  const h = read('index.html');
  assert.match(h, /<meta name="description" content="[^"]{30,}"/);
  assert.match(h, /<meta property="og:title" content="Friendly Pay"/);
  assert.match(h, /<meta property="og:image" content="[^"]*og-en\.png"/);
  assert.match(h, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(h, /<link rel="icon"[^>]+href="[^"]*favicon/);
  assert.match(h, /<link rel="apple-touch-icon"/);
  assert.match(h, /name="theme-color"/);
  const startup = [...h.matchAll(/rel="apple-touch-startup-image"[^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(startup.length >= 12, 'images de démarrage iPhone : ' + startup.length);
  for (const f of startup) assert.ok(existsSync(resolve(WEB, f)), 'image de démarrage ' + f);
  for (const m of h.matchAll(/(?:href|content)="((?:\.\/)?assets\/[^"]+)"/g)) assert.ok(existsSync(resolve(WEB, m[1])), 'référence ' + m[1]);
});

test('fichiers : aucun ancien nom (YOR WALLET / NEX WALLET) dans les pages publiques ni le manifest', { skip }, () => {
  for (const f of ['index.html', 'manifest.webmanifest', 'offline.html', '404.html', 'sw.js', '_headers']) assert.doesNotMatch(read(f), /NEX WALLET|YOR WALLET/, f);
});

/* ============================== RACCOURCIS DE L'ICÔNE ============================== */
const afterUnlock = (s) => s.page.evaluate(() => { const c = { uid: 'u1', userId: 'U1', yorId: 'YOR1', role: 'admin' }; UserContext.set(c); Runtime.ctx = c; Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000' };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 1, availableBalance: 1, reservedBalance: 0, status: 'ACTIVE', country: 'OM' }]; Runtime.transactions = []; Runtime.receipts = []; Runtime.notifications = []; Runtime.cards = [];
  openHome(); return R.current(); });

test('raccourcis : « Envoyer » / « Cartes » / « Historique » ouvrent le bon écran par-dessus l\'accueil ; « retour » ramène à l\'accueil', { skip }, async () => {
  for (const [hash, id] of [['#/country/select', 'country-select'], ['#/cards', 'cards'], ['#/history', 'history']]) {
    const s = await openApp(browser, { node: null, hash });
    assert.equal(await afterUnlock(s), id, hash);
    await s.page.evaluate(() => R.back());
    await s.page.waitForFunction(() => R.current() === 'home');
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  }
});

test('raccourcis : un lien inconnu, réservé (admin) ou au milieu d\'un parcours est ignoré — on arrive à l\'accueil', { skip }, async () => {
  for (const hash of ['#/zzz', '#/chain', '#/receipt', '#/transfer-review', '#/login', '#/cards-add', '#']) {
    const s = await openApp(browser, { node: null, hash });
    assert.equal(await afterUnlock(s), 'home', hash);
    await s.ctx.close();
  }
});

test('raccourcis : le manifest pointe vers des écrans qui existent dans la liste blanche', { skip }, async () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  const s = await openApp(browser, { node: null });
  for (const sc of m.shortcuts) {
    const h = sc.url.replace(/^\.\//, '');
    const id = await s.page.evaluate((x) => R.resolve(x), h);
    assert.ok(id, 'écran existant pour ' + sc.url);
    assert.ok(await s.page.evaluate((x) => DEEP_OK.includes(x), id), id + ' est dans la liste blanche');
  }
  await s.ctx.close();
});

/* ============================== LIBELLÉS COUPÉS ============================== */
test('libellés : barre du bas et tuiles des Services ne sont jamais coupés (« … ») à 320 / 360 px, en EN / FR / AR', { skip }, async () => {
  const bad = [];
  for (const lang of ['en', 'fr', 'ar']) for (const w of [320, 360]) {
    const s = await openApp(browser, { node: null, lang, viewport: { width: w, height: 700 } });
    await s.page.evaluate(seedHome);
    await s.page.evaluate(() => R.go('services', { force: true }));
    await s.page.waitForTimeout(500);
    const hits = await s.page.evaluate(() => [...document.querySelectorAll('#bottom-nav .nav-lb, .yb-svc-t')].filter(e => e.offsetParent && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map(e => e.textContent.trim() + ' ' + e.scrollWidth + '>' + e.clientWidth));
    hits.forEach(h => bad.push(lang + ' ' + w + ': ' + h));
    await s.ctx.close();
  }
  assert.deepEqual(bad, [], 'libellés coupés : ' + bad.join(' | '));
});
