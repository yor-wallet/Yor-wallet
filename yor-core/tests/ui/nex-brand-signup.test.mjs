/* 12.6.0 → 12.11.0 — Friendly Pay : nom, palette teal / blanc, téléphone obligatoire à l'inscription, carte plus réaliste, reçu animé.
   Sur la VRAIE application (index.html réel). Supabase est un faux client.
   Ce que ces tests prouvent : le formulaire refuse un numéro absent ou invalide et n'appelle PAS la création de compte, il envoie « +indicatif… » et le pays
   quand il est valide ; plus aucun « YOR WALLET » ni violet dans le code de l'app ; les boutons teal ont un texte lisible ; la carte garde son statut « Aperçu »
   (aucun logo de réseau, aucune puce, aucun CVV) avec le nouveau rendu ; le reçu joue ses animations seulement quand l'état est réel et les coupe en « mouvement réduit ».
   Ce qu'ils NE prouvent PAS : le rendu sur un vrai téléphone, ni l'envoi réel d'un compte vers Supabase (la base est vérifiée à part). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { available, launch, openApp, WEB } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const sources = () => {
  const out = [];
  const walk = d => { for (const f of readdirSync(d)) { const p = resolve(d, f); const st = statSync(p); if (st.isDirectory()) { if (!/node_modules|\.git$|\.shots$/.test(f)) walk(p); } else if (/\.(js|css|html|svg|webmanifest)$/.test(f)) out.push([p.slice(WEB.length + 1), readFileSync(p, 'utf8')]); } };
  walk(WEB);
  return out;
};

async function openSignup(opts = {}) {
  const s = await openApp(browser, Object.assign({ node: null }, opts));
  await s.page.evaluate(() => {
    AuthEngine.hasValidContext = () => false;
    window.__signups = [];
    AuthEngine.signUp = async (...a) => { window.__signups.push(a); return { ok: true, needsConfirm: true }; };
    R.go('signup', { force: true });
  });
  await s.page.waitForSelector('#su-phone');
  return s;
}
const fill = async (page, v) => { for (const [k, val] of Object.entries(v)) await page.fill(k, val); };

/* ---------- téléphone obligatoire ---------- */
test('inscription : le téléphone est affiché, obligatoire (*), avec indicatif ; Oman par défaut', { skip }, async () => {
  const s = await openSignup();
  assert.equal(await s.page.locator('#su-phone').getAttribute('required'), '');
  assert.match(await s.page.innerText('label[for="su-phone"]'), /Phone number \*/);
  assert.equal(await s.page.inputValue('#su-dial'), 'OM');
  assert.equal(await s.page.evaluate(() => { const o = document.querySelector('#su-dial').selectedOptions[0]; return o.dataset.dial; }), '+968');
  assert.ok(await s.page.locator('#su-dial option').count() >= 10);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('inscription : sans numéro ou avec un numéro invalide, le compte N\'est PAS créé et l\'erreur le dit', { skip }, async () => {
  const s = await openSignup();
  await fill(s.page, { '#su-first': 'Sajad', '#su-last': 'Ajmi', '#su-email': 'a@b.co', '#su-pass': 'Password1' });
  await s.page.click('#su-submit');
  assert.match(await s.page.innerText('#signup-err'), /valid phone number/i);
  assert.equal(await s.page.evaluate(() => window.__signups.length), 0, 'aucun appel de création sans téléphone');
  for (const bad of ['123', 'abc', '+33612345678' /* autre pays que l'indicatif choisi */, '77986533123456789']) {
    await s.page.fill('#su-phone', bad);
    await s.page.click('#su-submit');
    assert.match(await s.page.innerText('#signup-err'), /valid phone number/i, 'refusé : ' + bad);
  }
  assert.equal(await s.page.evaluate(() => window.__signups.length), 0);
  await s.ctx.close();
});

test('inscription : un numéro valide part avec « +indicatif… » et le pays ; le zéro national est retiré', { skip }, async () => {
  const s = await openSignup();
  await fill(s.page, { '#su-first': 'Sajad', '#su-last': 'Ajmi', '#su-email': 'a@b.co', '#su-pass': 'Password1', '#su-phone': '7798 6533' });
  await s.page.click('#su-submit');
  await s.page.waitForFunction(() => window.__signups.length === 1);
  assert.deepEqual(await s.page.evaluate(() => window.__signups[0]), ['a@b.co', 'Password1', 'Sajad', 'Ajmi', '+96877986533', 'OM']);
  await s.page.evaluate(() => R.go('signup', { force: true })); await s.page.waitForSelector('#su-phone');
  await fill(s.page, { '#su-email': 'a@b.co', '#su-pass': 'Password1' });
  await s.page.selectOption('#su-dial', 'FR');
  await s.page.fill('#su-phone', '06 12 34 56 78');
  await s.page.click('#su-submit');
  await s.page.waitForFunction(() => window.__signups.length === 2);
  const last = await s.page.evaluate(() => window.__signups[1]);
  assert.equal(last[4], '+33612345678'); assert.equal(last[5], 'FR');
  await s.ctx.close();
});

test('inscription : messages en français et en arabe, champ visible en RTL', { skip }, async () => {
  for (const lang of ['fr', 'ar']) {
    const s = await openSignup({ lang });
    await s.page.evaluate(l => { DeviceLang.set(l); LANG = l; applyI18n(); R.go('signup', { force: true }); }, lang);
    await s.page.waitForSelector('#su-phone');
    await fill(s.page, { '#su-email': 'a@b.co', '#su-pass': 'Password1' });
    await s.page.click('#su-submit');
    const err = await s.page.innerText('#signup-err');
    assert.match(err, lang === 'fr' ? /numéro de téléphone valide/ : /رقم هاتف صحيحاً/);
    assert.equal(await s.page.evaluate(() => window.__signups.length), 0);
    const box = await s.page.evaluate(() => { const r = document.querySelector('.su-phone').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    assert.ok(box.l >= 0 && box.r <= box.w, 'le champ tient dans l\'écran');
    await s.ctx.close();
  }
});

test('helper signupPhone : cas limites', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  const r = await s.page.evaluate(() => [
    signupPhone('+968', '7798 6533'), signupPhone('+968', '+968 7798 6533'), signupPhone('+968', '0096877986533'), signupPhone('+33', '06 12 34 56 78'),
    signupPhone('+968', ''), signupPhone('+968', '123'), signupPhone('+968', 'abc'), signupPhone('+968', '+33612345678'), signupPhone('', '7798')
  ]);
  assert.deepEqual(r, ['+96877986533', '+96877986533', '+96877986533', '+33612345678', null, null, null, null, null]);
  await s.ctx.close();
});

/* ---------- nom Friendly Pay ---------- */
test('nom : aucun « YOR WALLET » / « NEX WALLET » dans l\'app (hors client chaîne généré et enveloppe WalletConnect) ; titre, manifest, logo = Friendly Pay', { skip }, async () => {
  const hits = sources().filter(([f, t]) => !/yor-chain\.js$/.test(f) && !/^walletconnect[\\/]/.test(f) && /YOR WALLET|NEX WALLET/.test(t)).map(([f]) => f);
  assert.deepEqual(hits, [], 'ancien nom encore présent dans : ' + hits.join(', '));
  const manifest = JSON.parse(readFileSync(resolve(WEB, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Friendly Pay'); assert.equal(manifest.short_name, 'Friendly Pay');
  const mark = readFileSync(resolve(WEB, 'assets/brand/logo-mark.svg'), 'utf8');
  assert.match(mark, /M180 388V196/, 'le logo dessine le F'); assert.match(mark, /#0B7F75/i, 'logo teal'); assert.doesNotMatch(mark, /NEX|YOR/);
  const s = await openApp(browser, { node: null });
  assert.equal(await s.page.title(), 'Friendly Pay');
  assert.equal(await s.page.evaluate(() => document.querySelector('meta[name="apple-mobile-web-app-title"]').content), 'Friendly Pay');
  assert.equal(await s.page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = logoLockup(40); return [...d.querySelectorAll('.logo-name,.logo-sub')].map(x => x.textContent).join(' '); }), 'Friendly PAY');
  await s.ctx.close();
});

test('nom : en arabe le mot-symbole est « فرندي باي » (jamais en lettres espacées)', { skip }, async () => {
  const s = await openApp(browser, { node: null, lang: 'ar' });
  const r = await s.page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = logoLockup(40); return { txt: [...d.querySelectorAll('.logo-name,.logo-sub')].map(x => x.textContent).join(' '), hasLatin: /Friendly|PAY/.test(d.textContent) }; });
  assert.equal(r.txt, 'فرندي باي'); assert.equal(r.hasLatin, false);
  await s.ctx.close();
});

test('nom : l\'écran de connexion / d\'inscription affiche Friendly Pay (pas YOR / NEX)', { skip }, async () => {
  const s = await openSignup();
  const txt = await s.page.innerText('#signup');
  assert.match(txt, /Friendly/); assert.doesNotMatch(txt, /YOR WALLET|NEX WALLET/);
  await s.page.evaluate(() => R.go('login', { force: true }));
  await s.page.waitForSelector('#login');
  const login = await s.page.innerText('#login');
  assert.match(login, /Friendly/); assert.doesNotMatch(login, /YOR WALLET|NEX WALLET/);
  await s.ctx.close();
});

/* ---------- palette teal / blanc ---------- */
test('palette : plus de violet ni de bleu de marque ; accent teal en sombre et en clair ; texte lisible sur les boutons principaux', { skip }, async () => {
  const violet = /#(6D28D9|7C3AED|8B5CF6|A78BFA|5B21B6|4C1D95|6366F1|4338CA|7E22CE|9333EA|A855F7|C4B5FD|DDD6FE|EDE9FE|2E1065|3B1F8C|5B3FD0)\b/i;
  const hits = sources().filter(([f, t]) => !/yor-chain\.js$/.test(f) && violet.test(t)).map(([f, t]) => f + ':' + t.match(violet)[0]);
  assert.deepEqual(hits, [], 'violet restant : ' + hits.join(', '));
  const s = await openApp(browser, { node: null });
  const nums = h => h.match(/\d+/g).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  for (const theme of ['dark', 'light']) {
    await s.page.evaluate(th => document.documentElement.setAttribute('data-theme', th), theme);
    const v = await s.page.evaluate(() => {
      const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = 'x'; document.body.appendChild(b);
      const cs = getComputedStyle(b), root = getComputedStyle(document.documentElement);
      const out = { accent: root.getPropertyValue('--accent').trim(), color: cs.color, bg: cs.backgroundImage }; b.remove(); return out;
    });
    assert.match(v.accent.toUpperCase(), theme === 'dark' ? /^#2DD4BF$/ : /^#0B7F75$/);
    const stops = v.bg.match(/rgb\(\d+,\s*\d+,\s*\d+\)/g).map(nums);
    for (const st of stops) assert.ok(ratio(nums(v.color), st) >= 4.5, 'texte du bouton lisible (' + theme + ') : ' + v.color + ' sur rgb(' + st + ')');
    assert.ok(stops.every(([r, g, b]) => g > r && g >= b - 30), 'dégradé teal : ' + v.bg);
  }
  await s.ctx.close();
});

test('palette : le thème de carte « violet » (id conservé pour les données) s\'appelle Orange et est orange', { skip }, async () => {
  const src = readFileSync(resolve(WEB, 'js/features/v12.js'), 'utf8');
  assert.match(src, /th_violet:'Orange'/); assert.match(src, /th_violet:'برتقالي'/); assert.doesNotMatch(src, /th_violet:'(Violet|بنفسجي)'/);
});

/* ---------- carte virtuelle ---------- */
const seedCards = () => {
  const now = Date.now();
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000', photo: null };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 1, availableBalance: 1, reservedBalance: 0, status: 'ACTIVE', country: 'OM' }];
  Runtime.transactions = []; Runtime.receipts = []; Runtime.notifications = [];
  Runtime.cards = [{ id: 'c1', type: 'VIRTUAL', brand: 'FRD', theme: 'obsidian', holderName: 'SAJAD AJMI', number: '9701123412341234', currency: 'OMR', frozen: false, label: 'Obsidian', createdAt: now }];
};
test('carte : nouveau rendu (grain, bande holographique, relief, numéro en 4 groupes, titulaire) SANS logo de réseau, SANS puce, SANS CVV, SANS numéro complet', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(seedCards);
  await s.page.evaluate(() => R.go('cards', { force: true }));
  await s.page.waitForSelector('.rv-card .rv-grain');
  const info = await s.page.evaluate(() => {
    const f = document.querySelector('.rv-card .rv-front');
    return { html: document.getElementById('cards').innerHTML, groups: [...f.querySelectorAll('.rv-num span')].map(x => x.textContent), holder: f.querySelector('.rv-holder').textContent,
      foil: !!f.querySelector('.rv-foil'), shadow: getComputedStyle(f.querySelector('.rv-num')).textShadow, wm: f.querySelector('.rv-wm').getAttribute('src') };
  });
  assert.deepEqual(info.groups, ['••••', '••••', '••••', '1234']);
  assert.equal(info.holder, 'SAJAD AJMI'); assert.ok(info.foil); assert.notEqual(info.shadow, 'none');
  assert.equal(info.wm, 'assets/brand/friendly-letters-white.svg');
  assert.doesNotMatch(info.html, /visa|mastercard|network-mark|rv-chip|rv-nfc|cvv/i);
  assert.doesNotMatch(info.html, /9701123412341234|9701 1234 1234 1234/);
  assert.equal(await s.page.locator('.rv-net-slot').count(), 0);
  assert.equal(await s.page.locator('.rv-state.s-preview').count(), 0, 'aucune étiquette « Aperçu / non émise » sur la carte (12.9.0)');
  assert.equal(await s.page.locator('.rv-card[data-state="preview"]').count(), 1, 'l\'état reste interne : la carte n\'est pas présentée comme émise');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('carte : la lumière suit le doigt (--mx/--my) et le reflet disparaît en « mouvement réduit »', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(seedCards);
  await s.page.evaluate(() => R.go('cards', { force: true }));
  await s.page.waitForSelector('.rv-card .rv-foil');
  const box = await s.page.locator('.rv-card').boundingBox();
  await s.page.mouse.move(box.x + box.width * .8, box.y + box.height * .3);
  await s.page.mouse.down();
  await s.page.mouse.move(box.x + box.width * .82, box.y + box.height * .32);
  await s.page.waitForTimeout(120);
  const moved = await s.page.evaluate(() => { const c = document.querySelector('.rv-card'); return { mx: c.style.getPropertyValue('--mx'), my: c.style.getPropertyValue('--my') }; });
  assert.ok(parseInt(moved.mx) > 60 && parseInt(moved.my) > 0, JSON.stringify(moved));
  await s.page.mouse.up();
  await s.ctx.close();
  const r = await openApp(browser, { node: null });
  await r.page.emulateMedia({ reducedMotion: 'reduce' });
  await r.page.evaluate(seedCards);
  await r.page.evaluate(() => R.go('cards', { force: true }));
  await r.page.waitForSelector('.rv-card .rv-foil');
  const anim = await r.page.evaluate(() => getComputedStyle(document.querySelector('.rv-foil'), '::before').animationName);
  assert.equal(anim, 'none');
  await r.ctx.close();
});

/* ---------- carte de solde (accueil) ---------- */
test('accueil : carte de solde teal, texte blanc lisible (AA) sur tout le dégradé', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(seedCards);
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('.ds-balance');
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  for (const theme of ['light', 'dark']) {
    await s.page.evaluate(th => document.documentElement.setAttribute('data-theme', th), theme);
    const v = await s.page.evaluate(() => { const c = getComputedStyle(document.querySelector('.ds-balance')); return { bg: c.backgroundImage, color: c.color }; });
    assert.equal(v.color, 'rgb(255, 255, 255)');
    const lin = v.bg.slice(v.bg.indexOf('linear-gradient'));
    const stops = (lin.match(/rgb\(\d+,\s*\d+,\s*\d+\)/g) || []).map(x => x.match(/\d+/g).map(Number));
    assert.ok(stops.length >= 2, 'dégradé linéaire : ' + v.bg);
    for (const st of stops) { assert.ok(st[1] > st[0] && st[1] >= st[2] - 10, 'teal : ' + st); assert.ok(1.05 / (lum(st) + .05) >= 4.5, 'contraste blanc/teal insuffisant sur rgb(' + st + ')'); }
  }
  await s.ctx.close();
});

/* ---------- reçu animé ---------- */
const seedReceipt = (status) => {
  const now = Date.now();
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000' };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 1250.5, availableBalance: 1250.5, reservedBalance: 0, status: 'ACTIVE', country: 'OM' }];
  Runtime.transactions = [{ id: 't1', reference: 'YOR-TX-0001', kind: 'FIAT_TRANSFER', type: 'TRANSFER', direction: 'OUT', status, currency: 'OMR', amount: 20, fee: .5, vat: 0, total: 20.5, createdAt: now - 3600e3, beneficiary: { name: 'Aisha Said', phone: '+96891234567' } }];
  Runtime.receipts = [{ id: 'r-t1', transactionId: 't1', status, createdAt: now - 3600e3, amount: 20, currency: 'OMR', fee: .5, vat: 0, total: 20.5, reference: 'YOR-TX-0001', beneficiary: { name: 'Aisha Said', phone: '+96891234567' } }];
  return R.go('receipt', { force: true });
};
const anims = (page) => page.evaluate(() => {
  const nm = (sel, pe) => getComputedStyle(document.querySelector(sel), pe || null).animationName;
  return { sheet: nm('.rc-sheet'), row: nm('.rc-rows .receipt-row'), badge: nm('.rc-badge'), burst: nm('.rc-badge', '::after'), ring: nm('.rc-badge', '::before') };
});
test('reçu : réussi = impression du ticket + lignes en cascade + anneau et éclats ; en cours = pas d\'éclats ; échoué = secousse', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(seedReceipt, 'SUCCESS'); await s.page.waitForSelector('#receipt .rc-badge');
  assert.deepEqual(await anims(s.page), { sheet: 'rcPrint', row: 'rcRow', badge: 'rcGlow', burst: 'rcBurst', ring: 'rcRing' });
  await s.page.evaluate(seedReceipt, 'PENDING'); await s.page.waitForSelector('#receipt .rc-badge.st-pending');
  const p = await anims(s.page);
  assert.notEqual(p.burst, 'rcBurst'); assert.notEqual(p.ring, 'rcRing'); assert.notEqual(p.badge, 'rcGlow'); assert.equal(p.sheet, 'rcPrint');
  await s.page.evaluate(seedReceipt, 'FAILED'); await s.page.waitForSelector('#receipt .rc-badge.st-failed');
  const f = await anims(s.page);
  assert.equal(f.badge, 'rcShake'); assert.notEqual(f.burst, 'rcBurst');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('reçu : en « mouvement réduit » plus aucune animation ; le contenu final est complet et lisible tout de suite', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await s.page.evaluate(seedReceipt, 'SUCCESS'); await s.page.waitForSelector('#receipt .rc-badge');
  const a = await anims(s.page);
  assert.deepEqual(a, { sheet: 'none', row: 'none', badge: 'none', burst: 'none', ring: 'none' });
  const txt = await s.page.innerText('#receipt');
  assert.match(txt, /OMR 20\.000/); assert.match(txt, /Total debited/);
  await s.ctx.close();
});

test('reçu : à l\'impression, aucune animation ni éclat', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(seedReceipt, 'SUCCESS'); await s.page.waitForSelector('#receipt .rc-badge');
  await s.page.emulateMedia({ media: 'print' });
  const a = await anims(s.page);
  assert.equal(a.sheet, 'none'); assert.equal(a.badge, 'none');
  assert.equal(await s.page.evaluate(() => getComputedStyle(document.querySelector('.rc-badge'), '::after').display), 'none');
  await s.ctx.close();
});
