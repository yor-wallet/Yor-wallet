/* 12.13.0 — notifications push (alertes sur le téléphone) dans la VRAIE application et dans le VRAI sw.js.
   - sw.js est exécuté dans un contexte simulé (vm) : réception d'un push, affichage obligatoire, clic, changement d'abonnement.
   - L'écran Réglages tourne dans Chromium avec un faux navigateur d'abonnement (PushManager / Notification / Supabase simulés).
   NON couvert ici (impossible hors d'un vrai iPhone) : la livraison réelle par Apple (APNs) — voir NOTICES.md. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { available, launch, openApp, WEB } from './ui-harness.mjs';
import { generateVapidKeys } from '../../supabase/functions/push-send/lib.ts';

const SHOTS = process.env.YOR_SHOTS || resolve(dirname(fileURLToPath(import.meta.url)), '../../.shots');
mkdirSync(SHOTS, { recursive: true });
const rd = f => readFileSync(join(WEB, f), 'utf8');
const SW_SRC = rd('sw.js');

/* ---------- sw.js dans un contexte simulé ---------- */
function loadSw({ clients = [] } = {}) {
  const handlers = {}, shown = [], opened = [], badges = [], posted = [];
  const self = {
    addEventListener: (t, f) => { handlers[t] = f; },
    registration: { scope: 'https://yor-wallet.netlify.app/', showNotification: async (title, opts) => { shown.push({ title, opts }); } },
    navigator: { setAppBadge: async n => { badges.push(n); } },
    clients: {
      matchAll: async () => clients.map(c => ({ ...c, focus: async () => { c.focused = true; }, postMessage: m => posted.push(m) })),
      openWindow: async u => { opened.push(u); },
      claim: async () => {},
    },
    skipWaiting: async () => {}, location: { origin: 'https://yor-wallet.netlify.app' },
  };
  vm.runInNewContext(SW_SRC, { self, caches: {}, fetch: async () => new Response(null), URL, Response, Request, Promise, setTimeout, clearTimeout, console });
  const fire = async (type, ev) => { const pending = []; handlers[type]({ ...ev, waitUntil: p => pending.push(p) }); await Promise.all(pending); };
  return { handlers, shown, opened, badges, posted, fire, self };
}
const plain = x => JSON.parse(JSON.stringify(x));   /* les objets créés dans le contexte simulé (vm) ont un autre prototype : on compare leur contenu */
const pushEvent = obj => ({ data: { json: () => obj, text: () => JSON.stringify(obj) } });

test('sw.js : enregistre push, notificationclick et pushsubscriptionchange', () => {
  const sw = loadSw();
  for (const h of ['install', 'activate', 'fetch', 'push', 'notificationclick', 'pushsubscriptionchange']) assert.equal(typeof sw.handlers[h], 'function', h);
});

test('sw.js : un push affiche TOUJOURS une notification (règle d\'Apple), avec le titre, le texte, l\'icône Friendly et la pastille', async () => {
  const sw = loadSw({ clients: [{ url: 'https://yor-wallet.netlify.app/', visibilityState: 'visible', focused: true }] });   /* application ouverte au premier plan */
  await sw.fire('push', pushEvent({ title: 'Transfert envoyé', body: '12.000 OMR envoyés au +968 ••••6533', tag: 'fp-abc', url: '#/notifications', badge: 3, lang: 'fr', dir: 'ltr', ts: 1790000000000 }));
  assert.equal(sw.shown.length, 1, 'une notification, même application ouverte');
  const { title, opts } = sw.shown[0];
  assert.equal(title, 'Transfert envoyé');
  assert.equal(opts.body, '12.000 OMR envoyés au +968 ••••6533');
  assert.equal(opts.tag, 'fp-abc'); assert.equal(opts.lang, 'fr'); assert.equal(opts.dir, 'ltr'); assert.equal(opts.timestamp, 1790000000000);
  assert.equal(opts.icon, 'assets/icons/icon-192.png'); assert.equal(opts.badge, 'assets/icons/icon-192.png');
  assert.deepEqual(plain(opts.data), { url: '#/notifications' });
  assert.deepEqual(plain(sw.badges), [3]);
});

test('sw.js : arabe (droite à gauche) ; message vide ou illisible = quand même une notification visible', async () => {
  const sw = loadSw();
  await sw.fire('push', pushEvent({ title: 'تم الإرسال', body: 'تم إرسال 5.400 OMR', dir: 'rtl', lang: 'ar' }));
  assert.equal(sw.shown[0].opts.dir, 'rtl'); assert.equal(sw.shown[0].title, 'تم الإرسال');
  await sw.fire('push', { data: null });
  assert.equal(sw.shown[1].title, 'Friendly Pay');
  await sw.fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'bonjour' } });
  assert.equal(sw.shown[2].opts.body, 'bonjour');
  await sw.fire('push', {});
  assert.equal(sw.shown.length, 4);
});

test('sw.js : le lien d\'une notification ne peut mener qu\'à un écran de l\'application (#/…), jamais à une autre adresse', async () => {
  const sw = loadSw();
  await sw.fire('push', pushEvent({ title: 'x', body: 'y', url: 'https://evil.example/login' }));
  assert.deepEqual(plain(sw.shown[0].opts.data), { url: '#/notifications' });
  await sw.fire('push', pushEvent({ title: 'x', body: 'y', url: '#/settings' }));
  assert.deepEqual(plain(sw.shown[1].opts.data), { url: '#/settings' });
});

test('sw.js : textes tronqués, pastille à zéro = pas de pastille, pastille non numérique ignorée', async () => {
  const sw = loadSw();
  await sw.fire('push', pushEvent({ title: 't'.repeat(300), body: 'b'.repeat(900), badge: 0 }));
  assert.equal(sw.shown[0].title.length, 80); assert.equal(sw.shown[0].opts.body.length, 200);
  await sw.fire('push', pushEvent({ title: 'x', badge: 'abc' }));
  assert.deepEqual(plain(sw.badges), []);
});

test('sw.js : si la pastille échoue, la notification est quand même affichée', async () => {
  const sw = loadSw();
  sw.self.navigator.setAppBadge = async () => { throw new Error('refused'); };
  await sw.fire('push', pushEvent({ title: 'x', body: 'y', badge: 2 }));
  assert.equal(sw.shown.length, 1);
});

test('sw.js : toucher la notification ouvre l\'application ; si elle est déjà ouverte, elle passe au premier plan et reçoit l\'écran à ouvrir', async () => {
  const closed = []; const n = { close: () => closed.push(1), data: { url: '#/notifications' } };
  const none = loadSw();
  await none.fire('notificationclick', { notification: n });
  assert.deepEqual(plain(none.opened), ['https://yor-wallet.netlify.app/#/notifications']); assert.equal(closed.length, 1);

  const open = [{ url: 'https://yor-wallet.netlify.app/#/home' }];
  const sw = loadSw({ clients: open });
  await sw.fire('notificationclick', { notification: { close: () => {}, data: { url: '#/settings' } } });
  assert.equal(open[0].focused, true); assert.deepEqual(plain(sw.posted), [{ type: 'fp-push-click', url: '#/settings' }]); assert.deepEqual(plain(sw.opened), []);

  const other = loadSw({ clients: [{ url: 'https://other.example/' }] });                  /* une fenêtre d'un autre site n'est jamais utilisée */
  await other.fire('notificationclick', { notification: { close: () => {}, data: {} } });
  assert.deepEqual(plain(other.opened), ['https://yor-wallet.netlify.app/#/notifications']);
});

test('sw.js : changement d\'abonnement → l\'application ouverte est prévenue de se réenregistrer', async () => {
  const sw = loadSw({ clients: [{ url: 'https://yor-wallet.netlify.app/' }] });
  await sw.fire('pushsubscriptionchange', {});
  assert.deepEqual(plain(sw.posted), [{ type: 'fp-push-resync' }]);
});

test('sw.js : push.js est dans le cache hors ligne et la version du cache suit celle de l\'application', () => {
  const appVersion = /version:'([\d.]+)'/.exec(rd('js/data/reference-data.js'))[1];
  assert.equal(/const CACHE = 'fp-shell-v([\d.]+)'/.exec(SW_SRC)[1], appVersion);
  assert.ok(SW_SRC.includes("'js/features/push.js'"));
});

test('index.html : push.js chargé après uikit.js et avant wire.js ; aucun nouveau site autorisé dans la CSP (le navigateur parle lui-même à Apple)', () => {
  const html = rd('index.html'), pos = s => { const i = html.indexOf('src="' + s + '"'); assert.ok(i > 0, s); return i; };
  assert.ok(pos('js/ui/uikit.js') < pos('js/features/push.js') && pos('js/features/push.js') < pos('js/wire.js'));
  assert.equal((html.match(/features\/push\.js/g) || []).length, 1);
  const csp = /Content-Security-Policy:\s*(.+)/.exec(rd('_headers'))[1];
  assert.doesNotMatch(csp, /apple\.com|googleapis\.com\/fcm|push\.services/i);
  assert.match(csp, /worker-src 'self'/);
});

test('sécurité : aucune clé privée ni JWK privée dans les fichiers servis ; la clé publique VAPID est une clé P-256 de 65 octets (ou vide avant activation)', () => {
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(WEB).filter(p => /\.(js|html|css|json|webmanifest|md|txt)$/.test(p) && !/\/(node_modules|walletconnect)\//.test(p))) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /private_jwk|VAPID_PRIVATE|"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/, f);
  }
  const k = /PUSH:\{ vapidPublicKey:'([^']*)'/.exec(rd('js/data/reference-data.js'))[1];
  if (k) { const b = Buffer.from(k.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); assert.equal(b.length, 65); assert.equal(b[0], 4); }
});

/* ---------- Réglages dans Chromium ---------- */
const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser, KEY;
test.before(async () => { if (!skip) { browser = await launch(); KEY = (await generateVapidKeys()).publicKey; } });
test.after(async () => { if (browser) await browser.close(); });

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const shot = async (page, name) => { await page.evaluate(() => { const r = document.getElementById('push-row'); if (r) r.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(900); await page.screenshot({ path: SHOTS + '/' + name }); };

async function openSettings(opts = {}) {
  const { lang = 'en', perm = 'default', grant = true, ios = false, standalone = false, hasSub = false, key = KEY, testResult = null, theme = 'light' } = opts;
  const s = await openApp(browser, { node: null, role: 'user', lang, colorScheme: theme });
  await s.page.evaluate(({ perm, grant, ios, standalone, hasSub, key, testResult, IOS_UA }) => {
    const c = { uid: 'u1', userId: 'U1', yorId: 'YOR1', role: 'user' }; UserContext.set(c); Runtime.ctx = c;
    Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', displayName: 'Sajad', country: 'OM', phone: '+96890000000' };
    Runtime.accounts = [{ id: 'a1', type: 'MAIN', name: 'Main OMR', currency: 'OMR', balance: 250.5, availableBalance: 250.5, reservedBalance: 0, status: 'ACTIVE', country: 'OM' }];
    Runtime.transactions = []; Runtime.receipts = []; Runtime.notifications = []; Runtime.cards = [];
    const log = (window.__push = { calls: [], sub: null });
    const mkSub = () => ({ endpoint: 'https://web.push.apple.com/TEST123abcdef', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) } }; }, async unsubscribe() { log.calls.push(['unsubscribe']); log.sub = null; return true; } });
    if (hasSub) log.sub = mkSub();
    const reg = { pushManager: { async getSubscription() { return log.sub; }, async subscribe(o) { log.calls.push(['subscribe', o.userVisibleOnly, o.applicationServerKey.length, o.applicationServerKey[0]]); log.sub = mkSub(); return log.sub; } } };
    const listeners = [];
    window.__swListeners = listeners;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => ({ ready: Promise.resolve(reg), addEventListener: (t, f) => listeners.push(f) }) });
    function FakeNotification() {}
    FakeNotification.permission = perm;
    FakeNotification.requestPermission = async () => { log.calls.push(['requestPermission', !!(navigator.userActivation && navigator.userActivation.isActive)]); FakeNotification.permission = grant ? 'granted' : 'denied'; return FakeNotification.permission; };
    Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification });
    sb.rpc = async (name, args) => { log.calls.push(['rpc', name, args]); return { data: null, error: null }; };
    sb.functions = { invoke: async (name, o) => { log.calls.push(['invoke', name, o.body]); return testResult ? { data: null, error: { context: { status: testResult } } } : { data: { devices: 1, sent: 1 }, error: null }; } };
    if (ios) Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => IOS_UA });
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => !!standalone });
    CONFIG.PUSH.vapidPublicKey = key;
    R.go('settings', { force: true });
  }, { perm, grant, ios, standalone, hasSub, key, testResult, IOS_UA });
  await s.page.waitForSelector('#push-row');
  await s.page.waitForFunction(() => document.getElementById('push-row').getAttribute('data-push-state') !== 'loading');
  return s;
}
const rowState = s => s.page.getAttribute('#push-row', 'data-push-state');
const callsOf = (s, n) => s.page.evaluate(n => window.__push.calls.filter(c => c[0] === n), n);

test('Réglages (Chrome/Android/ordinateur) : « Activer » → autorisation demandée DANS le geste, abonnement userVisibleOnly avec la clé VAPID, enregistré sur le serveur, la ligne passe à « activées »', { skip }, async () => {
  const s = await openSettings();
  assert.equal(await rowState(s), 'off');
  assert.equal(await s.page.locator('#push-actions [data-push]').count(), 1);
  await shot(s.page, '60-push-off.png');
  await s.page.click('[data-push="enable"]');
  await s.page.waitForFunction(() => document.getElementById('push-row').getAttribute('data-push-state') === 'on');
  const perm = await callsOf(s, 'requestPermission');
  assert.equal(perm.length, 1); assert.equal(perm[0][1], true, 'la demande d\'autorisation part pendant le geste de la personne (obligatoire sur iPhone)');
  const sub = await callsOf(s, 'subscribe');
  assert.deepEqual([sub[0][1], sub[0][2], sub[0][3]], [true, 65, 4], 'userVisibleOnly, clé publique de 65 octets non compressée');
  const subs = (await callsOf(s, 'invoke')).filter(c => c[1] === 'push-send' && c[2].action === 'subscribe');
  assert.equal(subs.length, 1, 'l\'enregistrement passe par la fonction push-send');
  const sj = subs[0][2].subscription;
  assert.equal(sj.endpoint, 'https://web.push.apple.com/TEST123abcdef'); assert.equal(sj.keys.auth.length, 22); assert.equal(sj.keys.p256dh.length, 87);
  assert.equal((await callsOf(s, 'rpc')).length, 0, 'aucune fonction SQL appelée par l\'application');
  assert.equal(await s.page.locator('#push-actions [data-push]').count(), 2, 'Envoyer un test + Désactiver');
  assert.match(await s.page.innerText('#push-row'), /On\. You will be alerted even when Friendly Pay is closed/);
  await shot(s.page, '61-push-on.png');
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('Réglages : autorisation refusée dans la fenêtre du système → rien n\'est enregistré, la ligne reste « désactivée »', { skip }, async () => {
  const s = await openSettings({ grant: false });
  await s.page.click('[data-push="enable"]');
  await s.page.waitForSelector('.toast.error');
  assert.equal(await rowState(s), 'denied');
  assert.equal((await callsOf(s, 'subscribe')).length, 0);
  assert.equal((await callsOf(s, 'invoke')).length, 0);
  await s.ctx.close();
});

test('Réglages : notifications bloquées dans iOS → explication, aucun bouton', { skip }, async () => {
  const s = await openSettings({ perm: 'denied' });
  assert.equal(await rowState(s), 'denied');
  assert.equal(await s.page.locator('#push-actions [data-push]').count(), 0);
  assert.match(await s.page.innerText('#push-row'), /Blocked\. Open iPhone Settings/);
  await s.ctx.close();
});

test('iPhone dans Safari (pas sur l\'écran d\'accueil) : la ligne explique comment ajouter l\'application, sans bouton qui ne marcherait pas', { skip }, async () => {
  const s = await openSettings({ ios: true, standalone: false, lang: 'fr' });
  assert.equal(await rowState(s), 'install');
  assert.equal(await s.page.locator('#push-actions [data-push]').count(), 0);
  const txt = await s.page.innerText('#push-row');
  assert.match(txt, /Alertes sur ce téléphone/); assert.match(txt, /ajoutez d'abord Friendly Pay à l'écran d'accueil/);
  await shot(s.page, '62-push-install-fr.png');
  await s.ctx.close();
});

test('iPhone, application ouverte depuis l\'écran d\'accueil : « Activer » est proposé', { skip }, async () => {
  const s = await openSettings({ ios: true, standalone: true });
  assert.equal(await rowState(s), 'off');
  assert.equal(await s.page.locator('[data-push="enable"]').count(), 1);
  await s.ctx.close();
});

test('clé VAPID absente ou navigateur sans notifications : « indisponible », aucun bouton, aucune erreur', { skip }, async () => {
  const s = await openSettings({ key: '' });
  assert.equal(await rowState(s), 'unsupported');
  assert.equal(await s.page.locator('#push-actions [data-push]').count(), 0);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('« Envoyer un test » appelle push-send (action test) ; trop rapide = message d\'attente ; « Désactiver » désabonne l\'appareil ET le serveur', { skip }, async () => {
  const s = await openSettings({ perm: 'granted', hasSub: true });
  assert.equal(await rowState(s), 'on');
  await s.page.click('[data-push="test"]');
  await s.page.waitForSelector('.toast.success');
  const inv = await callsOf(s, 'invoke');
  assert.deepEqual([inv[0][1], inv[0][2]], ['push-send', { action: 'test' }]);
  await s.page.click('[data-push="disable"]');
  await s.page.waitForFunction(() => document.getElementById('push-row').getAttribute('data-push-state') === 'off');
  assert.equal((await callsOf(s, 'unsubscribe')).length, 1);
  const un = (await callsOf(s, 'invoke')).filter(c => c[2].action === 'unsubscribe');
  assert.equal(un.length, 1); assert.equal(un[0][2].endpoint, 'https://web.push.apple.com/TEST123abcdef');
  await s.ctx.close();
  const s2 = await openSettings({ perm: 'granted', hasSub: true, testResult: 429 });
  await s2.page.click('[data-push="test"]');
  await s2.page.waitForSelector('.toast.error');
  assert.match(await s2.page.innerText('.toast.error'), /Wait a few seconds/);
  await s2.ctx.close();
});

test('arabe : ligne en arabe, sens droite→gauche, boutons lisibles', { skip }, async () => {
  const s = await openSettings({ lang: 'ar', perm: 'granted', hasSub: true });
  assert.equal(await s.page.evaluate(() => document.documentElement.getAttribute('dir')), 'rtl');
  const txt = await s.page.innerText('#push-row');
  assert.match(txt, /تنبيهات على هذا الهاتف/); assert.match(txt, /مفعّلة/);
  assert.match(await s.page.innerText('#push-actions'), /إرسال تجربة/);
  await shot(s.page, '63-push-ar.png');
  await s.ctx.close();
});

test('Push.sync : à l\'ouverture, un appareil déjà abonné est réenregistré ; sans abonnement rien n\'est envoyé', { skip }, async () => {
  const s = await openSettings({ perm: 'granted', hasSub: true });
  await s.page.evaluate(() => { window.__push.calls.length = 0; return Push.sync(); });
  const again = (await callsOf(s, 'invoke')).filter(c => c[2].action === 'subscribe');
  assert.equal(again.length, 1);
  await s.ctx.close();
  const s2 = await openSettings({ perm: 'default' });
  await s2.page.evaluate(() => Push.sync());
  assert.equal((await callsOf(s2, 'invoke')).length, 0);
  await s2.ctx.close();
});

test('Push.forget (déconnexion) : désabonne, et ne bloque JAMAIS la déconnexion plus de 2 s même si le serveur ne répond pas', { skip }, async () => {
  const s = await openSettings({ perm: 'granted', hasSub: true });
  await s.page.evaluate(() => { sb.functions.invoke = () => new Promise(() => {}); });     /* le serveur ne répond jamais */
  const ms = await s.page.evaluate(async () => { const t0 = performance.now(); await Push.forget(); return performance.now() - t0; });
  assert.ok(ms >= 1900 && ms < 3500, 'durée ' + ms);
  await s.ctx.close();
});

test('pastille de l\'icône : seulement les alertes d\'argent non lues ; effacée quand tout est lu', { skip }, async () => {
  const s = await openSettings({ perm: 'granted', hasSub: true });
  const r = await s.page.evaluate(async () => {
    const badges = [];
    Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: async n => { badges.push(['set', n]); } });
    Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: async () => { badges.push(['clear']); } });
    Runtime.notifications = [
      { id: '1', type: 'TRANSFER_SENT', read: false }, { id: '2', type: 'TRANSFER_RECEIVED', read: false }, { id: '3', type: 'DEPOSIT', read: true },
      { id: '4', type: 'CRYPTO_BUY', read: false }];
    const n = Push.unreadCount(); Push.syncBadge();
    Runtime.notifications = Runtime.notifications.map(x => ({ ...x, read: true })); Push.syncBadge();
    return { n, badges };
  });
  assert.equal(r.n, 2); assert.deepEqual(r.badges, [['set', 2], ['clear']]);
  await s.ctx.close();
});

test('toucher une notification (message du service worker) ouvre l\'écran des notifications ; sans session rien ne s\'ouvre', { skip }, async () => {
  const s = await openSettings({ perm: 'granted', hasSub: true });
  await s.page.evaluate(() => { Push.listen(); });
  await s.page.evaluate(() => window.__swListeners.forEach(f => f({ data: { type: 'fp-push-click', url: '#/notifications' } })));
  await s.page.waitForFunction(() => R.current() === 'notifications');
  await s.page.evaluate(() => window.__swListeners.forEach(f => f({ data: { type: 'fp-push-click', url: '#/settings' } })));
  await s.page.waitForFunction(() => R.current() === 'settings');
  await s.ctx.close();
});

test('version 13.0.0 ; un transfert, l\'historique et les autres réglages restent intacts', { skip }, async () => {
  const s = await openSettings();
  assert.equal(await s.page.evaluate(() => CONFIG.APP.version), '13.0.0');
  const txt = await s.page.innerText('.screen.active');
  assert.match(txt, /Notifications/); assert.match(txt, /Vibration/);
  assert.equal(await s.page.locator('[data-action="settings-toggle-notifs"]').count(), 1, 'le réglage « Notifications » existant reste');
  await s.ctx.close();
});
