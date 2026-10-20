/* SULFA service worker: caches the static shell only. Supabase traffic (data, auth, documents) is NEVER cached,
   so a balance or a status is always the one the server returns, or an error. */
const CACHE = 'sulfa-shell-v1.0.0';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/offline.html', '/icon.svg', '/manifest.webmanifest'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;           // supabase.co and every write: straight to the network
  if (u.pathname.startsWith('/_next/static/')) {                                    // immutable hashed files
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
    return;
  }
  e.respondWith(fetch(e.request).then(res => { if (res.ok && e.request.mode === 'navigate') { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('/offline.html') : Response.error()))));
});
