// Faux @supabase/supabase-js pour le banc d'essai de chain-notice : table `chain_notices` en mémoire + jetons de connexion fictifs.
// Les tests posent globalThis.__chainSim = { users: { '<jwt>': { id, email } }, rows: [] /* chain_notices */, tables: { <table>: [] }, rpc: { <nom>: (args) => data } } avant d'importer index.ts.
// Ne prouve PAS le comportement de PostgREST ni des RLS (vérifiés en réel sur le projet).
let seq = 0;
const cmp = (a, b) => (typeof a === 'number' && !Number.isNaN(Number(b)) ? a - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
class Q {
  constructor(rows) { this.rows = rows; this.op = 'select'; this.f = []; this.ret = false; this.count = false; this.head = false; this.single = false; }
  select(_cols, opts) { if (this.op === 'update') this.ret = true; if (opts && opts.count) { this.count = true; this.head = !!opts.head; } return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  eq(k, v) { this.f.push((r) => r[k] === v); return this; }
  in(k, arr) { this.f.push((r) => arr.includes(r[k])); return this; }
  gte(k, v) { this.f.push((r) => r[k] != null && cmp(r[k], v) >= 0); return this; }
  lte(k, v) { this.f.push((r) => r[k] != null && cmp(r[k], v) <= 0); return this; }
  lt(k, v) { this.f.push((r) => r[k] != null && cmp(r[k], v) < 0); return this; }
  gt(k, v) { this.f.push((r) => r[k] != null && cmp(r[k], v) > 0); return this; }
  /* .not('col', 'is', null) seulement (le seul usage du code testé) */
  not(k, op, v) { if (op === 'is' && v === null) this.f.push((r) => r[k] != null); else throw new Error('stub: not(' + op + ') non géré'); return this; }
  /* .or('col.is.null,col.lt.valeur') : disjonction de col.op.valeur (is.null, lt, lte, gt, gte, eq) */
  or(expr) {
    const parts = String(expr).split(',').map((p) => { const [k, op, ...rest] = p.split('.'); return { k, op, v: rest.join('.') }; });
    this.f.push((r) => parts.some(({ k, op, v }) => (op === 'is' && v === 'null' ? r[k] == null : r[k] != null && (op === 'lt' ? cmp(r[k], v) < 0 : op === 'lte' ? cmp(r[k], v) <= 0 : op === 'gt' ? cmp(r[k], v) > 0 : op === 'gte' ? cmp(r[k], v) >= 0 : op === 'eq' ? String(r[k]) === v : false))));
    return this;
  }
  order(k, opts) { this.ord = { k, asc: !(opts && opts.ascending === false) }; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.single = true; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const match = () => this.rows.filter((r) => this.f.every((fn) => fn(r)));
    if (this.op === 'insert') {
      const d = this.row;
      if (this.rows.some((r) => r.user_id === d.user_id && r.txid === d.txid && r.event === d.event)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
      this.rows.push({ id: 'row-' + (++seq), created_at: new Date().toISOString(), sent_at: null, provider_message_id: null, error_message: null, ...d });
      return { data: null, error: null };
    }
    if (this.op === 'update') {
      const m = match(); m.forEach((r) => Object.assign(r, this.patch));
      return { data: this.ret ? m.map((r) => ({ id: r.id })) : null, error: null };
    }
    let m = match();
    if (this.ord) { const { k, asc } = this.ord; m = [...m].sort((x, y) => (asc ? 1 : -1) * cmp(x[k], y[k])); }
    if (this.lim != null) m = m.slice(0, this.lim);
    if (this.count) return { count: m.length, data: this.head ? null : m, error: null };
    return { data: this.single ? (m[0] ?? null) : m, error: null };
  }
}
export function createClient() {
  const sim = () => globalThis.__chainSim;
  return {
    auth: { getUser: async (jwt) => { const u = sim().users[jwt]; return u ? { data: { user: u }, error: null } : { data: { user: null }, error: new Error('invalid jwt') }; } },
    from: (table) => new Q(table === 'chain_notices' ? sim().rows : ((sim().tables ??= {})[table] ??= [])),
    rpc: async (name, args) => { const f = sim().rpc && sim().rpc[name]; if (!f) throw new Error('rpc inattendue: ' + name); return { data: f(args), error: null }; },
  };
}
