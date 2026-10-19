/* Friendly Pay 12.14.0 sur la VRAIE application (index.html réel + CSP réelle). Supabase est un faux client qui enregistre les appels :
   aucun transfert, aucun SMS, aucune écriture réelle. Les données ci-dessous sont des données de TEST injectées par ce fichier.
   Ce que ces tests prouvent : un transfert sans réponse du serveur est « à vérifier » (jamais confirmé, jamais renvoyé tout seul) ; la
   vérification ne peut que LIRE (même clé d'idempotence, aucune autorisation PIN) ; l'accueil, Recevoir, la recherche, l'historique filtré,
   le profil (numéro masqué, statut KYC réel, modification du nom), le changement de code et les réglages par catégories ; aucun débordement
   à 320 px ; le carrousel ne décale plus les écrans ; polices locales et nouveaux fichiers dans le service worker.
   Ce qu'ils NE prouvent PAS : le comportement sur un vrai iPhone / Safari, ni le vrai serveur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { available, launch, openApp, WEB } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

const seed = () => {
  const now = Date.now();
  Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890012345', email: 'sajad@example.com', kyc: { status: 'UNVERIFIED' } };
  Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 500, availableBalance: 500, status: 'ACTIVE' }];
  Runtime.transactions = [
    { id: 't1', reference: 'YOR-TX-20261017-AAAAAA', kind: 'FIAT_EXTERNAL', type: 'TRANSFER', direction: 'OUT', status: 'SUCCESS', currency: 'OMR', amount: 20, fee: 0, total: 20, createdAt: now - 3600e3, beneficiary: { name: '+96891234567', phone: '+96891234567', country: 'OM' } },
    { id: 't2', reference: 'YOR-TX-20261017-BBBBBB', kind: 'ADMIN_DEPOSIT', type: 'TRANSFER', direction: 'IN', status: 'SUCCESS', currency: 'OMR', amount: 45.25, fee: 0, total: 45.25, createdAt: now - 40 * 864e5 }
  ];
  Runtime.notifications = [{ id: 'n1', title: 'x', message: 'y', read: false, createdAt: now }];
  Runtime.receipts = []; Runtime.cards = [];
};
async function boot(lang = 'en', opts = {}) {
  const s = await openApp(browser, { node: null, lang, role: 'user', ...opts });
  await s.page.evaluate(seed);
  await s.page.evaluate(() => {
    window.__rpc = []; window.__from = [];
    sb.rpc = async (name, args) => {
      window.__rpc.push({ name, args });
      if (name === 'fiat_send_external') {
        const mode = window.__mode || 'ok';
        if (mode === 'network' && args.p_pin_grant) return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 };
        if (mode === 'hang' && args.p_pin_grant) return new Promise(() => {});
        if (!args.p_pin_grant) {
          if (window.__replay) return { data: { ok: true, transaction_id: 'tx-9', reference: 'YOR-TX-20261017-REPLAY', status: 'CONFIRMED', amount: args.p_amount, fee: 0, vat: 0, total: args.p_amount, exchange_rate: 1, destination_amount: args.p_amount, destination_currency: 'OMR' }, error: null };
          return { data: null, error: { message: 'pin_required', code: '42501' } };
        }
        if (mode === 'refuse') return { data: null, error: { message: 'insufficient_balance', code: 'P0001' } };
        return { data: { ok: true, transaction_id: 'tx-1', reference: 'YOR-TX-20261017-OKOKOK', status: 'CONFIRMED', amount: args.p_amount, fee: 0, vat: 0, total: args.p_amount, exchange_rate: 1, destination_amount: args.p_amount, destination_currency: 'OMR' }, error: null };
      }
      if (name === 'pin_status') return { data: { has_pin: true }, error: null };
      if (name === 'verify_pin') return { data: args.p_pin === '135790' ? { ok: true, grant: 'g-1' } : { ok: false, error: 'wrong_pin', remaining: 4 }, error: null };
      if (name === 'change_pin') return { data: { ok: true }, error: null };
      return { data: null, error: null };
    };
    const q = (table) => { const call = { table, ops: [] }; window.__from.push(call); const p = new Proxy({}, { get: (_t, k) => k === 'then' ? (res) => res({ data: null, error: null }) : (...a) => { call.ops.push([k, a]); return p; } }); return p; };
    sb.from = q;
    sb.functions = { invoke: async () => ({ data: null, error: null }) };
  });
  return s;
}
async function goToReview(s) {
  await s.page.evaluate(() => { txReset(); R.go('country-select', { force: true }); });
  await s.page.fill('#sp-num', '9123 4567');
  await s.page.waitForFunction(() => !document.getElementById('sp-next').disabled);
  await s.page.click('#sp-next');
  await s.page.waitForFunction(() => R.current() === 'tx-amount');
  await s.page.fill('#amt-input', '10');
  await s.page.waitForFunction(() => !document.getElementById('amt-next').disabled);
  await s.page.click('#amt-next');
  await s.page.waitForFunction(() => R.current() === 'tx-review');
  await s.page.evaluate(() => { PinEngine.authorize = async () => ({ ok: true, grant: 'grant-1' }); });
}
const sends = (page) => page.evaluate(() => window.__rpc.filter(c => c.name === 'fiat_send_external'));

test('isUncertain : seule une erreur SANS réponse de la base est incertaine ; une erreur SQL (annulée) est un refus certain', { skip }, async () => {
  const s = await boot();
  const r = await s.page.evaluate(() => [
    TransferEngine.isUncertain({ message: 'TypeError: Failed to fetch', code: '' }, 0),
    TransferEngine.isUncertain({ message: 'Load failed' }, undefined),
    TransferEngine.isUncertain({ message: 'upstream timeout' }, 504),
    TransferEngine.isUncertain({ message: 'insufficient_balance', code: 'P0001' }, 400),
    TransferEngine.isUncertain({ message: 'boom' }, 400),
    TransferEngine.isUncertain(null, 200)
  ]);
  assert.deepEqual(r, [true, true, true, false, false, false]);
  await s.ctx.close();
});

test('transfert sans réponse (réseau) : « statut à vérifier », jamais « confirmé », UN SEUL envoi ; la vérification lit sans autorisation', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => { window.__mode = 'network'; });
  await goToReview(s);
  await s.page.evaluate(() => { window.__phases = []; new MutationObserver(() => { const v = document.querySelector('.proc-view'); if (v && window.__phases[window.__phases.length - 1] !== v.dataset.phase) window.__phases.push(v.dataset.phase); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-phase'] }); });
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'tx-result', null, { timeout: 12000 });
  const phases = await s.page.evaluate(() => window.__phases);
  assert.ok(phases.includes('uncertain') && !phases.includes('success'), 'phases : ' + phases.join(' > '));
  const txt = await s.page.innerText('#tx-result');
  assert.match(txt, /Statut à vérifier/); assert.match(txt, /jamais envoyé deux fois automatiquement/);
  assert.doesNotMatch(txt, /Transfert réussi|confirmé/i);
  assert.equal((await sends(s.page)).length, 1, 'aucun nouvel essai automatique');
  /* retour arrière : on ne revient jamais à l'écran de confirmation (pas de second glissement par erreur) */
  await s.page.evaluate(() => R.back());
  await s.page.waitForFunction(() => R.current() === 'home');
  await s.page.evaluate(() => R.go('tx-result'));
  /* vérification : rien d'enregistré → la requête relue n'a AUCUNE autorisation PIN et garde la MÊME clé */
  await s.page.click('[data-px="txr-check"]');
  await s.page.waitForSelector('#txr-note:not([hidden])');
  assert.match(await s.page.innerText('#txr-note'), /Aucun transfert n’a été enregistré/);
  const calls = await sends(s.page);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].args.p_pin_grant, null, 'la vérification ne porte aucune autorisation : elle ne peut rien créer');
  assert.equal(calls[1].args.p_idempotency_key, calls[0].args.p_idempotency_key, 'même clé d\'idempotence');
  assert.equal(await s.page.locator('[data-px="txr-retry"]').count(), 1, 'réessayer n\'est proposé qu\'après la vérification');
  assert.deepEqual(s.errors.filter(e => !/Failed to fetch|fiat_send_external/.test(e)), []);
  await s.ctx.close();
});

test('transfert incertain puis vérification : le serveur l\'avait enregistré → reçu RÉEL (référence du serveur)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__mode = 'network'; });
  await goToReview(s);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => R.current() === 'tx-result', null, { timeout: 12000 });
  await s.page.evaluate(() => { window.__replay = true; });
  await s.page.click('[data-px="txr-check"]');
  await s.page.waitForFunction(() => R.current() === 'receipt', null, { timeout: 6000 });
  assert.match(await s.page.innerText('#receipt-ref'), /FRD-TX-20261017-REPLAY/);
  assert.equal((await sends(s.page)).length, 2);
  await s.ctx.close();
});

test('transfert sans réponse au-delà du délai : incertain (la requête n\'est ni annulée ni renvoyée)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { window.__mode = 'hang'; const run0 = ProcessingEngine.run; ProcessingEngine.run = (w, o) => run0(w, Object.assign({}, o, { timeoutMs: 3500 })); });
  await goToReview(s);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForFunction(() => document.querySelector('.proc-view') && document.querySelector('.proc-view').hasAttribute('data-wait'), null, { timeout: 5000 });
  assert.match(await s.page.innerText('.proc-view'), /Waiting for the server/);
  await s.page.waitForFunction(() => R.current() === 'tx-result', null, { timeout: 12000 });
  assert.match(await s.page.innerText('#tx-result'), /Status to be checked/);
  assert.equal((await sends(s.page)).length, 1);
  await s.ctx.close();
});

test('hors ligne : le transfert n\'est pas tenté (rien envoyé) et la personne le sait', { skip }, async () => {
  const s = await boot();
  await goToReview(s);
  await s.ctx.setOffline(true);
  await s.page.evaluate(() => document.getElementById('swipe-kb-confirm').click());
  await s.page.waitForSelector('.toast');
  assert.match(await s.page.innerText('#toasts'), /nothing was sent/);
  assert.equal((await sends(s.page)).length, 0);
  assert.equal(await s.page.evaluate(() => R.current()), 'tx-review');
  await s.ctx.setOffline(false);
  await s.ctx.close();
});

test('accueil : avatar → profil, Recevoir réel, recherche dans les vraies opérations, carte d\'installation absente sur ordinateur', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('.px-bal');
  assert.match(await s.page.innerText('.px-bal'), /Solde disponible/);
  assert.match(await s.page.innerText('.px-bal'), /Compte actif/);
  assert.deepEqual(await s.page.$$eval('.rv-acts [data-nav]', els => els.map(e => e.getAttribute('data-nav'))), ['country-select', 'receive', 'history', 'services']);
  assert.equal(await s.page.locator('[data-pi-card]').count(), 0, 'Chromium ordinateur sans invite : aucune carte d\'installation');
  assert.match(await s.page.getAttribute('[data-action="notifications"]', 'aria-label'), /\(1\)/, 'compteur réel de notifications');
  await s.page.click('.px-me');
  await s.page.waitForFunction(() => R.current() === 'profile');
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.click('.rv-acts [data-nav="receive"]');
  await s.page.waitForFunction(() => R.current() === 'receive');
  const rcv = await s.page.innerText('#receive');
  assert.match(rcv, /\+968 9001 2345/); assert.match(rcv, /ne créditent pas un solde Friendly Pay/); assert.match(rcv, /45,250/);
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.click('[data-px="search"]');
  await s.page.fill('#px-s-in', 'AAAAAA');
  await s.page.waitForSelector('.px-search .tx-row');
  assert.equal(await s.page.locator('.px-search .tx-row').count(), 1);
  await s.page.fill('#px-s-in', 'thème');
  await s.page.waitForSelector('[data-pxs-nav="settings"]');
  await s.page.fill('#px-s-in', 'zzzz-nothing');
  await s.page.waitForFunction(() => /Aucun résultat/.test(document.getElementById('px-s-res').innerText));
  await s.page.click('[data-pxs-close]');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('solde : animation seulement quand le solde RÉEL change ; le texte final est exactement la valeur du serveur', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('.px-bal');
  await s.page.evaluate(() => { Runtime.accounts[0].balance = 510; Runtime.accounts[0].availableBalance = 510; R.go('home', { force: true }); });
  assert.ok(await s.page.evaluate(() => document.querySelector('.px-bal').classList.contains('px-bump')), 'la carte signale le changement');
  await s.page.waitForTimeout(1000);
  assert.match(await s.page.innerText('#px-bal-amt'), /1,326\.41/);
  await s.ctx.close();
});

test('historique : recherche par référence, filtres période / sens combinés aux statuts', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { HIST.q = ''; HIST.period = 'all'; HIST.dir = 'all'; R.go('history', { force: true }); });
  await s.page.waitForSelector('#history-list .tx-row');
  assert.equal(await s.page.locator('#history-list .tx-row').count(), 2);
  await s.page.click('[data-hp="7d"]');
  assert.equal(await s.page.locator('#history-list .tx-row').count(), 1, 'le dépôt de 40 jours sort de la période');
  await s.page.click('[data-hp="all"]');
  await s.page.click('[data-hd="in"]');
  assert.equal(await s.page.locator('#history-list .tx-row.tx-in').count(), 1);
  await s.page.click('[data-hd="all"]');
  await s.page.fill('#hist-q', 'FRD-TX-20261017-AAAAAA');
  await s.page.waitForFunction(() => document.querySelectorAll('#history-list .tx-row').length === 1);
  await s.page.fill('#hist-q', '+968 9123');
  await s.page.waitForFunction(() => document.querySelectorAll('#history-list .tx-row').length === 1);
  /* le numéro stocké comme nom s'affiche formaté, pas brut */
  assert.match(await s.page.innerText('#history-list'), /\+968 9123 4567/);
  await s.page.fill('#hist-q', '');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('profil : numéro et e-mail masqués, statut KYC réel (jamais « vérifié » sans le serveur), modification du nom envoyée à profiles', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => R.go('profile', { force: true }));
  const txt = await s.page.innerText('#profile');
  assert.match(txt, /\+968 •••• 2345/); assert.doesNotMatch(txt, /90012345/);
  assert.match(txt, /s•••@example\.com/); assert.doesNotMatch(txt, /sajad@example/);
  assert.match(txt, /Non vérifié/); assert.doesNotMatch(txt, /(^|\s)Vérifié(\s|$)/);
  for (const [st, re] of [['VERIFIED', /Vérifié/], ['PENDING', /Vérification en cours/], ['WEIRD', /Non vérifié/]]) {
    await s.page.evaluate(x => { Runtime.profile.kyc = { status: x }; R.go('profile', { force: true }); }, st);
    assert.match(await s.page.innerText('.px-hero'), re, st);
  }
  await s.page.click('[data-nav="profile-edit"]');
  await s.page.waitForFunction(() => R.current() === 'profile-edit');
  await s.page.fill('#pe-first', 'S4jad');
  await s.page.click('#pe-save');
  assert.match(await s.page.innerText('#pe-err'), /lettres/);
  assert.equal(await s.page.evaluate(() => window.__from.length), 0, 'rien n\'est envoyé si la saisie est invalide');
  await s.page.waitForTimeout(1000);          /* garde anti-double-appui des boutons (.btn) */
  await s.page.fill('#pe-first', 'Sajjad');
  await s.page.fill('#pe-last', 'Al Ajmi');
  await s.page.click('#pe-save');
  await s.page.waitForFunction(() => R.current() === 'profile');
  const call = await s.page.evaluate(() => window.__from[0]);
  assert.equal(call.table, 'profiles');
  assert.deepEqual(call.ops[0], ['update', [{ first_name: 'Sajjad', last_name: 'Al Ajmi' }]], 'seuls prénom et nom sont modifiés');
  assert.match(await s.page.innerText('.px-hero'), /Sajjad Al Ajmi/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('code personnel : l\'ancien code est vérifié par le serveur, puis change_pin(ancien, nouveau)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => R.go('settings', { force: true }));
  await s.page.click('#settings [data-px="pin"]');
  const typePin = async (p) => { for (const d of p) { await s.page.keyboard.press(d); await s.page.waitForTimeout(25); } };
  await s.page.waitForSelector('#ps-title');
  assert.match(await s.page.innerText('#ps-title'), /Current code/);
  await typePin('111111');
  await s.page.waitForFunction(() => /Wrong PIN/.test(document.getElementById('ps-err').textContent));
  await typePin('135790');
  await s.page.waitForFunction(() => /New code/.test(document.getElementById('ps-title').textContent));
  await typePin('246813'); await s.page.waitForTimeout(150); await typePin('246813');
  await s.page.waitForSelector('.toast.success');
  const cp = await s.page.evaluate(() => window.__rpc.filter(c => c.name === 'change_pin'));
  assert.deepEqual(cp.map(c => c.args), [{ p_old: '135790', p_new: '246813' }]);
  await s.ctx.close();
});

test('réglages : catégories distinctes, les trois canaux expliqués, toutes les commandes existantes présentes', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => R.go('settings', { force: true }));
  const txt = await s.page.innerText('#settings');
  for (const h of ['Apparence', 'Notifications', 'Sécurité et confidentialité', 'Préférences financières', 'Compte', 'Informations et assistance']) assert.match(txt, new RegExp(h));
  assert.match(txt, /alertes sur le téléphone \(push\)/i); assert.match(txt, /SMS sont des messages texte/);
  for (const sel of ['[data-action="settings-toggle-notifs"]', '[data-action="settings-toggle-vibration"]', '[data-action="settings-toggle-txconfirm"]', '[data-action="settings-faceid"]', '[data-lang="ar"]', '[data-theme="dark"]', '[data-currency="EUR"]', '#confirm-phone', '[data-nav="devices"]', '[data-nav="sessions"]', '[data-action="sign-out"]', '[data-px="pin"]'])
    assert.equal(await s.page.locator('#settings ' + sel).count(), 1, sel);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('320 px : aucun débordement horizontal sur les nouveaux écrans (clair et arabe)', { skip }, async () => {
  for (const lang of ['fr', 'ar']) {
    const s = await boot(lang, { viewport: { width: 320, height: 640 } });
    if (lang === 'ar') await s.page.evaluate(() => { DeviceLang.set('ar'); LANG = 'ar'; applyI18n(); });
    for (const id of ['home', 'receive', 'profile', 'profile-edit', 'settings', 'history']) {
      await s.page.evaluate(i => R.go(i, { force: true }), id);
      const m = await s.page.evaluate(() => { const sc = document.querySelector('.screen.active'); return { sw: sc.scrollWidth, cw: sc.clientWidth }; });
      assert.ok(m.sw <= m.cw + 1, `${lang} ${id} : ${m.sw} > ${m.cw}`);
    }
    assert.deepEqual(s.errors, []);
    await s.ctx.close();
  }
});

test('le carrousel ne fait plus défiler #screens de côté (tous les écrans étaient décalés)', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => R.go('home', { force: true }));
  await s.page.waitForSelector('[data-promo-slide]');
  await s.page.waitForTimeout(6500);
  assert.equal(await s.page.evaluate(() => document.getElementById('screens').scrollLeft), 0);
  await s.ctx.close();
});

test('PWA : polices locales présentes et précachées, nouveaux fichiers dans le service worker, manifeste installable', { skip }, async () => {
  const sw = readFileSync(WEB + '/sw.js', 'utf8');
  for (const f of ['css/premium.css', 'js/features/premium.js', 'assets/fonts/manrope-latin-var.woff2', 'assets/fonts/inter-latin-var.woff2', 'assets/fonts/plex-arabic-400.woff2']) {
    assert.ok(existsSync(WEB + '/' + f), f); assert.ok(sw.includes("'" + f + "'"), 'SHELL : ' + f);
  }
  assert.match(sw, /fp-shell-v13\.0\.0/);
  const m = JSON.parse(readFileSync(WEB + '/manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'standalone'); assert.equal(m.start_url, './'); assert.ok(m.icons.some(i => i.sizes === '512x512'));
  const html = readFileSync(WEB + '/index.html', 'utf8');
  assert.match(html, /apple-touch-icon/); assert.match(html, /apple-mobile-web-app-capable/); assert.match(html, /apple-touch-startup-image/);
  assert.doesNotMatch(readFileSync(WEB + '/css/premium.css', 'utf8'), /fonts\.googleapis|fonts\.gstatic/, 'aucune police externe (CSP font-src self)');
});

test('installation sans App Store : sur iPhone (Safari) la carte montre les vraies étapes ; « Plus tard » la masque ; rien une fois installée', { skip }, async () => {
  const s = await boot('fr');
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  await s.page.evaluate(ua => { Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true }); try { localStorage.removeItem('fp_install_later'); } catch (e) {} R.go('home', { force: true }); }, ios);
  await s.page.waitForSelector('[data-pi-card]');
  const txt = await s.page.innerText('[data-pi-card]');
  assert.match(txt, /Partager/); assert.match(txt, /Sur l’écran d’accueil/); assert.match(txt, /n’est pas une application de l’App Store/);
  assert.equal(await s.page.locator('[data-pi="go"]').count(), 0, 'iPhone : pas de faux bouton « Installer » (Apple n\'en propose pas aux pages web)');
  await s.page.click('[data-pi="later"]');
  assert.equal(await s.page.locator('[data-pi-card]').count(), 0);
  await s.page.evaluate(() => R.go('home', { force: true }));
  assert.equal(await s.page.locator('[data-pi-card]').count(), 0, 'masquée 14 jours sur cet appareil');
  await s.page.evaluate(() => R.go('settings', { force: true }));
  assert.equal(await s.page.locator('#settings [data-pi="sheet"]').count(), 1, 'toujours accessible depuis les Réglages');
  await s.page.evaluate(() => { Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true }); R.go('settings', { force: true }); });
  assert.equal(await s.page.locator('#settings [data-pi="sheet"]').count(), 0, 'déjà installée : plus de proposition');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
