/* 12.6.0 — Réglages : interrupteurs et choix (thème, devise, langue) + solde affiché en dollars par défaut.
   Sur la VRAIE application (index.html réel). Supabase est un faux client : l'écriture des préférences est enregistrée ou refusée par le test.
   Ce que ces tests prouvent : l'état ON/OFF se VOIT (couleur du rail, position du bouton), il change au toucher sans recharger l'écran
   (le défilement reste), un échec d'enregistrement remet l'état précédent et le dit, le solde est converti avec le taux écrit et le montant d'origine.
   Ce qu'ils NE prouvent PAS : le toucher sur un vrai téléphone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, openApp } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

async function openSettings(opts = {}) {
  const s = await openApp(browser, Object.assign({ node: null }, opts));
  await s.page.evaluate(() => {
    Runtime.settings = Object.assign({ theme: 'dark' }, Runtime.settings || {}); Runtime.security = Runtime.security || {};
    Runtime.contacts = Runtime.contacts || []; Runtime.bankAccounts = Runtime.bankAccounts || [];
    Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', country: 'OM', phone: '+96890000000' };
    Runtime.ctx = Object.assign({ yorId: 'YORTEST', role: 'user', uid: 'u-1' }, Runtime.ctx || {});
    window.__docs = []; window.__fail = false;
    UserContext.requireCtx = () => ({ uid: 'u-1', role: 'user' });
    UserDataEngine.writeDoc = async (uid, name, data) => { if (window.__fail) throw new Error('write refused'); window.__docs.push({ name, data }); };
    R.go('settings', { force: true });
  });
  await s.page.waitForSelector('#settings .settings-row');
  return s;
}
const scrollTo = (page, y) => page.evaluate(v => { document.querySelector('#settings').scrollTop = v; return document.querySelector('#settings').scrollTop; }, y);
const scrollNow = (page) => page.evaluate(() => document.querySelector('#settings').scrollTop);
const track = (page, action) => page.evaluate(a => {
  const row = document.querySelector('button.settings-row[data-action="' + a + '"]'), sw = row.querySelector('.switch');
  return { checked: row.getAttribute('aria-checked'), bg: getComputedStyle(sw).backgroundColor, knob: getComputedStyle(sw, '::after').transform };
}, action);

test('interrupteurs : l\'état ON / OFF se voit (rail coloré + bouton décalé) et suit aria-checked', { skip }, async () => {
  const s = await openSettings();
  const on = await track(s.page, 'settings-toggle-vibration');
  assert.equal(on.checked, 'true');
  await s.page.click('[data-action="settings-toggle-vibration"]');
  await s.page.waitForFunction(() => document.querySelector('[data-action="settings-toggle-vibration"]').getAttribute('aria-checked') === 'false');
  await s.page.waitForTimeout(400);                                /* fin de la transition */
  const off = await track(s.page, 'settings-toggle-vibration');
  assert.notEqual(on.bg, off.bg, 'le rail change de couleur entre ON et OFF');
  assert.notEqual(on.knob, off.knob, 'le bouton change de position');
  assert.match(on.knob, /matrix\(1, 0, 0, 1, 20, 0\)/, 'ON : bouton décalé de 20 px');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('interrupteurs : le toucher change l\'état tout de suite, SANS redessiner l\'écran (le défilement et l\'élément restent), puis enregistre', { skip }, async () => {
  const s = await openSettings();
  await scrollTo(s.page, 500);
  await s.page.evaluate(() => document.querySelector('[data-action="settings-toggle-notifs"]').scrollIntoView({ block: 'center' }));   /* déjà visible : le robot n'a pas à défiler */
  await s.page.waitForTimeout(900);
  const y = await scrollNow(s.page);
  assert.ok(y > 300, 'l\'écran des réglages défile');
  await s.page.evaluate(() => { document.querySelector('[data-action="settings-toggle-notifs"]').__marker = 'same-node'; });
  await s.page.click('[data-action="settings-toggle-notifs"]');
  assert.equal(await s.page.getAttribute('[data-action="settings-toggle-notifs"]', 'aria-checked'), 'false', 'état changé immédiatement');
  await s.page.waitForFunction(() => window.__docs.length > 0);
  assert.equal(await scrollNow(s.page), y, 'le défilement n\'a pas bougé');
  assert.equal(await s.page.evaluate(() => document.querySelector('[data-action="settings-toggle-notifs"]').__marker), 'same-node', 'même élément : pas de nouveau dessin');
  const doc = await s.page.evaluate(() => window.__docs[0]);
  assert.equal(doc.name, 'preferences'); assert.equal(doc.data.notifications, false);
  assert.equal(await s.page.evaluate(() => Runtime.settings.notifications), false);
  /* second toucher (après la garde anti-double-appui) : revient à ON */
  await s.page.waitForTimeout(700);
  await s.page.click('[data-action="settings-toggle-notifs"]');
  await s.page.waitForFunction(() => window.__docs.length > 1);
  assert.equal(await s.page.getAttribute('[data-action="settings-toggle-notifs"]', 'aria-checked'), 'true');
  assert.equal(await s.page.evaluate(() => window.__docs[1].data.notifications), true);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('interrupteurs : si l\'enregistrement échoue, l\'état précédent revient et l\'erreur est annoncée (rien n\'est présenté comme enregistré)', { skip }, async () => {
  const s = await openSettings();
  for (const [action, read] of [['settings-toggle-vibration', () => Runtime.settings.vibration !== false], ['settings-toggle-txconfirm', () => Runtime.security.transactionConfirmationRequired !== false], ['settings-toggle-notifs', () => Runtime.settings.notifications !== false]]) {
    await s.page.evaluate(() => { window.__fail = true; window.__docs = []; });
    const before = await s.page.getAttribute('[data-action="' + action + '"]', 'aria-checked');
    await s.page.click('[data-action="' + action + '"]');
    await s.page.waitForFunction(a => !document.querySelector('[data-action="' + a + '"]').classList.contains('is-pending'), action);
    assert.equal(await s.page.getAttribute('[data-action="' + action + '"]', 'aria-checked'), before, action + ' : état restauré');
    assert.equal(await s.page.evaluate(() => window.__docs.length), 0);
    assert.ok(await s.page.locator('#toasts .toast').count() > 0, action + ' : message d\'erreur');
    await s.page.waitForTimeout(600);
  }
  await s.ctx.close();
});

test('choix (thème, devise) : la puce appuyée change tout de suite, sans redessiner ; échec = retour à la précédente ; la devise par défaut est le dollar', { skip }, async () => {
  const s = await openSettings();
  assert.equal(await s.page.getAttribute('[data-currency="USD"]', 'aria-pressed'), 'true', 'dollar US choisi par défaut');
  assert.equal(await s.page.getAttribute('[data-currency="OMR"]', 'aria-pressed'), 'false');
  await s.page.evaluate(() => document.querySelector('[data-currency="EUR"]').scrollIntoView({ block: 'center' }));   /* la puce est déjà visible : le robot n'a plus à faire défiler */
  await s.page.waitForTimeout(900);                                   /* le défilement doux est terminé */
  const y = await scrollNow(s.page);
  assert.ok(y > 300, 'l\'écran des réglages défile');
  await s.page.click('[data-currency="EUR"]');
  assert.equal(await s.page.getAttribute('[data-currency="EUR"]', 'aria-pressed'), 'true');
  assert.equal(await s.page.getAttribute('[data-currency="USD"]', 'aria-pressed'), 'false');
  assert.equal(await s.page.innerText('#set-cur-value'), 'EUR');
  await s.page.waitForFunction(() => window.__docs.length > 0);
  assert.equal(await scrollNow(s.page), y, 'défilement conservé');
  assert.equal(await s.page.evaluate(() => window.__docs[0].data.primaryCurrency), 'EUR');
  /* échec */
  await s.page.evaluate(() => { window.__fail = true; });
  await s.page.waitForTimeout(500);
  await s.page.click('[data-currency="AED"]');
  await s.page.waitForFunction(() => document.querySelector('[data-currency="EUR"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await s.page.getAttribute('[data-currency="AED"]', 'aria-pressed'), 'false');
  assert.equal(await s.page.innerText('#set-cur-value'), 'EUR');
  /* thème */
  await s.page.evaluate(() => { window.__fail = false; });
  await s.page.waitForTimeout(500);
  await s.page.click('.chip[data-theme="light"]');
  assert.equal(await s.page.getAttribute('.chip[data-theme="light"]', 'aria-pressed'), 'true');
  assert.equal(await s.page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  assert.match(await s.page.innerText('#set-theme-sub'), /Light/i);
  await s.page.evaluate(() => { window.__fail = true; });
  await s.page.waitForTimeout(500);
  await s.page.click('.chip[data-theme="dark"]');
  await s.page.waitForFunction(() => document.querySelector('.chip[data-theme="light"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await s.page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light', 'le thème précédent est remis');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('langue : changer de langue redessine l\'écran mais garde la position de défilement', { skip }, async () => {
  const s = await openSettings();
  await s.page.evaluate(() => document.querySelector('[data-lang="fr"]').scrollIntoView({ block: 'center' }));
  await s.page.waitForTimeout(900);                                   /* le défilement doux est terminé */
  const y = await scrollNow(s.page);
  assert.ok(y > 100, 'l\'écran des réglages défile');
  await s.page.click('[data-lang="fr"]');
  await s.page.waitForFunction(() => /Réglages|Paramètres/i.test(document.querySelector('#settings').innerText));
  await s.page.waitForTimeout(400);
  const y2 = await scrollNow(s.page);
  assert.ok(Math.abs(y2 - y) <= 2, `défilement conservé (${y} → ${y2})`);
  await s.ctx.close();
});

test('solde : affiché en dollars par défaut, taux écrit, montant d\'origine toujours visible ; en OMR si la personne le choisit ; masqué = masqué', { skip }, async () => {
  const s = await openApp(browser, { node: null });
  await s.page.evaluate(() => {
    Runtime.settings = Object.assign({ theme: 'dark' }, Runtime.settings || {}); Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM' };
    Runtime.accounts = [
      { id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 1000, availableBalance: 1000, status: 'ACTIVE' },
      { id: 'a2', type: 'WEST_AFRICA', name: 'West Africa XOF', currency: 'XOF', balance: 149200, availableBalance: 149200, status: 'ACTIVE' }];
    Runtime.transactions = []; Runtime.cards = []; Runtime.notifications = [];
    R.go('home', { force: true });
  });
  await s.page.waitForSelector('.ds-bal-amt');
  let txt = await s.page.innerText('.ds-balance');
  assert.match(txt, /USD\s?2,600\.80/, 'mille rials = 2 600,80 dollars (taux fixe 2,6008)');
  assert.match(txt, /OMR\s?1,000\.000 · 1 OMR = 2\.6008 USD/, 'montant d\'origine et taux écrits');
  const tiles = await s.page.innerText('.rv-grid2');
  assert.match(tiles, /USD\s?260\.08/, '149 200 XOF = 100 OMR = 260,08 USD (tableau indicatif intégré)');
  assert.match(tiles, /XOF\s?149,200/, 'le montant d\'origine reste visible');
  /* choix OMR : plus de conversion */
  await s.page.evaluate(() => { Runtime.settings.primaryCurrency = 'OMR'; R.go('home', { force: true }); });
  await s.page.waitForSelector('.ds-bal-amt');
  txt = await s.page.innerText('.ds-balance');
  assert.match(txt, /OMR\s?1,000\.000/); assert.doesNotMatch(txt, /USD|1 OMR =/);
  /* solde masqué : ni dollars ni montant d'origine */
  await s.page.evaluate(() => { Runtime.settings.primaryCurrency = 'USD'; Runtime.hideBalance = true; R.go('home', { force: true }); });
  await s.page.waitForSelector('.ds-bal-amt');
  txt = await s.page.innerText('.ds-balance');
  assert.doesNotMatch(txt, /2,600|1,000\.000|USD|OMR/);
  /* une devise sans taux n'est jamais « convertie » au hasard */
  const v = await s.page.evaluate(() => [balanceView(5, 'ZZZ'), balanceView(5, 'USDT'), balanceView('abc', 'OMR'), balanceView(5, 'USD')].map(x => [x.converted, x.currency, x.amount]));
  assert.deepEqual(v, [[false, 'ZZZ', 5], [false, 'USDT', 5], [false, 'OMR', 0], [false, 'USD', 5]]);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
