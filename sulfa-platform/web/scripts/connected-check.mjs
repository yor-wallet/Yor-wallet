#!/usr/bin/env node
/* Vérification connectée, en LECTURE SEULE, d'un vrai projet Supabase après application de la migration SULFA.
   Utilise uniquement la clé publique (anon) : aucune écriture ne peut aboutir, et le script le vérifie.
   Usage : NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/connected-check.mjs */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis'); process.exit(2); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
let failed = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
const rpc = (fn, body = {}) => fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });

const s = await rpc('sulfa_public_settings');
const settings = s.ok ? await s.json() : null;
check(s.ok && settings?.currency === 'OMR', 'paramètres publics lisibles par un visiteur', settings ? `${settings.min_amount}–${settings.max_amount} OMR, ${settings.min_term}–${settings.max_term} mois` : `HTTP ${s.status}`);

const q = await rpc('sulfa_quote', { p_amount: 2000, p_term: 6 });
const quote = q.ok ? await q.json() : null;
check(q.ok && quote?.total >= 2000, 'calcul du serveur (2000 OMR / 6 mois)', quote ? `total ${quote.total}, mensualité ${quote.monthly}` : `HTTP ${q.status}`);

const out = await rpc('sulfa_quote', { p_amount: 1, p_term: 6 });
check(!out.ok && /sulfa_amount_out_of_range/.test(await out.text()), 'montant hors limites refusé par le serveur');

for (const t of ['sulfa_settings', 'sulfa_profiles', 'sulfa_applications', 'sulfa_transactions', 'sulfa_ledger_entries', 'sulfa_audit_logs', 'sulfa_documents']) {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  const body = await r.text();
  check(!r.ok || body === '[]', `visiteur : aucune ligne lisible dans ${t}`, `HTTP ${r.status}`);
}

const w = await fetch(`${URL_}/rest/v1/sulfa_transactions`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ reference: 'X', transaction_type: 'CAPITAL_DEPOSIT', amount: 1, source: 'ADMIN', validated_by: '00000000-0000-0000-0000-000000000000', idempotency_key: 'connected-check' }) });
check(!w.ok, 'visiteur : écriture directe dans le registre refusée', `HTTP ${w.status}`);

for (const fn of ['sulfa_admin_overview', 'sulfa_my_summary', 'sulfa_admin_record_capital']) {
  const r = await rpc(fn, fn === 'sulfa_admin_record_capital' ? { p_amount: 1, p_internal_ref: 'x', p_note: null, p_idempotency_key: 'connected-check' } : {});
  check(!r.ok, `visiteur : ${fn} refusé`, `HTTP ${r.status}`);
}

console.log(failed ? `\n${failed} vérification(s) en échec` : '\nToutes les vérifications connectées sont passées (lecture seule).');
process.exit(failed ? 1 : 0);
