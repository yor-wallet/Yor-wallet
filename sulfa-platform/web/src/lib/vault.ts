/* SULFA "vault": the app's local data engine.
   - keeps the last good copy of each screen's data on the device, so the app opens instantly and then refreshes
     from the server (stale-while-revalidate). The server stays the only source of truth: a cached value is shown
     with the refresh running, never used to decide anything;
   - entries are tied to the signed-in user, expire, and fit in a fixed budget (oldest evicted first);
   - a sweep at start-up removes expired, foreign, corrupt and old-version entries; sign-out wipes everything. */

const NS = 'sulfa:v2:';
const OLD = ['sulfa:v1:'];                         // previous formats, removed by the sweep
const MAX_AGE = 24 * 3600_000;                     // never show data older than a day
const BUDGET = 1_500_000;                          // characters kept at most (well under the browser quota)

type Entry<T = unknown> = { t: number; u: string; d: T };
let user: string | null = null;

const store = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
const keys = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k);

export const vault = {
  /** the signed-in user; data of anybody else is invisible and swept */
  setUser(uid: string | null) { user = uid; },

  get<T>(key: string): { data: T; age: number } | null {
    const s = store(); if (!s || !user) return null;
    const raw = s.getItem(NS + key); if (!raw) return null;
    try {
      const e = JSON.parse(raw) as Entry<T>;
      const age = Date.now() - e.t;
      if (e.u !== user || age > MAX_AGE || age < -60_000) { s.removeItem(NS + key); return null; }
      return { data: e.d, age };
    } catch { s.removeItem(NS + key); return null; }                                   // corrupt: drop it
  },

  set(key: string, data: unknown) {
    const s = store(); if (!s || !user) return;
    let raw: string;
    try { raw = JSON.stringify({ t: Date.now(), u: user, d: data } satisfies Entry); } catch { return; }
    if (raw.length > BUDGET / 4) return;                                               // one screen never takes the whole budget
    for (let attempt = 0; attempt < 2; attempt++) {
      try { vault.trim(raw.length); s.setItem(NS + key, raw); return; }
      catch { vault.trim(raw.length, true); }                                          // quota hit: evict harder, retry once
    }
  },

  /** keep the total under budget, oldest first */
  trim(incoming = 0, hard = false) {
    const s = store(); if (!s) return;
    const mine = keys(s).filter(k => k.startsWith(NS)).map(k => {
      const v = s.getItem(k) ?? ''; let t = 0; try { t = (JSON.parse(v) as Entry).t; } catch { /* corrupt → oldest */ }
      return { k, n: v.length, t };
    }).sort((a, b) => a.t - b.t);
    let total = mine.reduce((a, x) => a + x.n, 0) + incoming;
    const limit = hard ? BUDGET / 2 : BUDGET;
    for (const x of mine) { if (total <= limit) break; s.removeItem(x.k); total -= x.n; }
  },

  /** start-up cleaning: expired / foreign / corrupt / old-format entries and legacy keys */
  sweep(): number {
    const s = store(); if (!s) return 0;
    let removed = 0;
    for (const k of keys(s)) {
      if (OLD.some(p => k.startsWith(p))) { s.removeItem(k); removed++; continue; }
      if (!k.startsWith(NS)) continue;
      try {
        const e = JSON.parse(s.getItem(k) ?? '') as Entry;
        if (Date.now() - e.t > MAX_AGE || (user && e.u !== user)) { s.removeItem(k); removed++; }
      } catch { s.removeItem(k); removed++; }
    }
    vault.trim();
    return removed;
  },

  /** sign-out, or a crash the app could not recover from: nothing of the session stays on the device */
  wipe() {
    const s = store(); if (s) for (const k of keys(s)) if (k.startsWith(NS) || OLD.some(p => k.startsWith(p))) s.removeItem(k);
    try { sessionStorage.removeItem('sulfa_reloaded'); } catch { /* private mode */ }
  },

  stats() {
    const s = store(); if (!s) return { entries: 0, size: 0 };
    const mine = keys(s).filter(k => k.startsWith(NS));
    return { entries: mine.length, size: mine.reduce((a, k) => a + (s.getItem(k)?.length ?? 0), 0) };
  },
};
