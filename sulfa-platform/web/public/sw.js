/* SULFA service worker: caches the static shell only. Supabase traffic (data, auth, documents) is NEVER cached here,
   so a balance or a status is always the one the server returns, or an error.
   - pages: network first with a 2.5 s limit, then the last cached copy (fast and reliable opening on a weak network);
   - hashed code files: cache first (they never change), the cache is trimmed to a fixed size;
   - activation deletes every older version's cache. */
const VERSION = 'v1.6.0';
const SHELL = 'sulfa-shell-' + VERSION, CODE = 'sulfa-code-' + VERSION;
const PRECACHE = ['/', '/app/', '/login/', '/client/', '/offline.html', '/icon.svg', '/manifest.webmanifest', '/brand/icon-rounded-512.png'];
const MAX_CODE = 220, MAX_PAGES = 60;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== CODE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name); const ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);           // oldest first
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;           // supabase.co and every write: straight to the network
  if (u.pathname.startsWith('/_next/static/') || /^\/(3d|people|brand)\//.test(u.pathname) || /\.(woff2|webp|png|jpg|svg)$/.test(u.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CODE).then(x => x.put(e.request, c)).then(() => trim(CODE, MAX_CODE)); }
      return res;
    })));
    return;
  }
  if (e.request.mode === 'navigate') {
    const net = fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(SHELL).then(x => x.put(e.request, c)).then(() => trim(SHELL, MAX_PAGES)); }
      return res;
    });
    const slow = new Promise(r => setTimeout(r, 2500)).then(() => caches.match(e.request));
    e.respondWith(Promise.race([net, slow.then(r => r || net)]).catch(() => caches.match(e.request).then(r => r || caches.match('/offline.html'))));
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || Response.error())));
});

self.addEventListener('message', e => { if (e.data === 'sulfa:clear') caches.keys().then(ks => ks.forEach(k => caches.delete(k))); });
