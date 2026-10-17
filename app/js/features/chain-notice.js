'use strict';

/* ===== CHAIN NOTICE — e-mail « c'est parti » puis « confirmé » pour les envois YOR-USDT (12.3.6) =====
   Le serveur (fonction chain-notice) envoie l'e-mail à l'adresse du COMPTE connecté, jamais à une adresse fournie ici.
   - « sent »      : dès que TronLink a signé et que le réseau a accepté la diffusion (état « broadcasted »). On n'attend pas la chaîne :
                     l'e-mail dit clairement « pas encore confirmé ».
   - « confirmed » : seulement quand le moteur a prouvé la confirmation (nœud solidity, bloc, receipt SUCCESS, événement Transfer). Le serveur
                     la re-vérifie lui-même ; sans preuve il refuse (409) et AUCUN e-mail « confirmé » ne part.
   Jamais bloquant : une erreur est avalée, le transfert n'en dépend pas. Doublon sans effet (le serveur n'envoie qu'un e-mail par événement).
   Pas de clé privée, pas de signature : ce module n'envoie que l'identifiant de la transaction, les deux adresses publiques et le montant. */
const ChainNotice = (() => {
  const KEY = 'yor.chainNotice.v1';
  const SENT_MAX_AGE = 30 * 60 * 1000;          // un envoi plus vieux n'est plus annoncé « c'est parti »
  const CONFIRMED_MAX_AGE = 24 * 3600 * 1000;
  const MAX_TRIES = 3;
  const TXID = /^[0-9a-fA-F]{64}$/;
  const busy = new Set();
  let mem = null;

  function read(){
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e){ mem = {}; }
    return mem;
  }
  function write(){
    try {
      const m = read(), ks = Object.keys(m);
      if (ks.length > 60) ks.sort((a, b) => (m[a].t || 0) - (m[b].t || 0)).slice(0, ks.length - 60).forEach(k => { delete m[k]; });
      localStorage.setItem(KEY, JSON.stringify(m));
    } catch (e){ /* stockage indisponible : le serveur dédoublonne de toute façon */ }
  }
  function lang(){ try { return (typeof LANG === 'string' && LANG) || 'en'; } catch (e){ return 'en'; } }

  function invoke(body){
    try {
      if (typeof supabaseReady === 'undefined' || !supabaseReady || typeof sb === 'undefined' || !sb || !sb.functions || typeof sb.functions.invoke !== 'function') return Promise.resolve(false);
      return Promise.resolve().then(() => sb.functions.invoke('chain-notice', { body })).then(r => !(r && r.error), () => false);
    } catch (e){ return Promise.resolve(false); }
  }

  function attempt(rec, event){
    const id = rec.txid.toLowerCase(), slot = event === 'sent' ? 's' : 'c';
    const m = read(), e = m[id] || (m[id] = { t: Date.now() });
    if (e[slot] === 1 || (e[slot + 'n'] || 0) >= MAX_TRIES) return;
    const k = id + ':' + event;
    if (busy.has(k)) return;
    busy.add(k);
    const body = { txid: id, event, lang: lang() };
    if (event === 'sent'){ body.from = rec.from; body.to = rec.to; body.amount = String(rec.amountRaw); }
    e[slot + 'n'] = (e[slot + 'n'] || 0) + 1; write();
    invoke(body).then(ok => { if (ok){ e[slot] = 1; write(); } }).then(() => { busy.delete(k); }, () => { busy.delete(k); });
  }

  /* Un enregistrement du moteur : décide quels e-mails sont dus. Appelé à chaque changement d'état et une fois au démarrage. */
  function handle(rec){
    try {
      if (!rec || typeof rec.txid !== 'string' || !TXID.test(rec.txid)) return;
      const age = Date.now() - Number(rec.createdAt);
      if (!Number.isFinite(age)) return;
      const st = rec.state;
      if ((st === 'broadcasted' || st === 'confirming' || st === 'confirmed') && age <= SENT_MAX_AGE) attempt(rec, 'sent');
      /* « confirmé » : seulement pour un envoi dont on a annoncé le départ (ou tout récent) — pas de e-mail surprise pour un vieil envoi */
      const e = read()[rec.txid.toLowerCase()];
      if (st === 'confirmed' && age <= CONFIRMED_MAX_AGE && ((e && e.s === 1) || age <= SENT_MAX_AGE)) attempt(rec, 'confirmed');
    } catch (e){ /* jamais bloquant */ }
  }

  let attached = null;
  function attach(client){
    try {
      if (!client || attached === client || typeof client.subscribe !== 'function') return;
      attached = client;
      const all = list => { try { (list || []).forEach(handle); } catch (e){ /* ignoré */ } };
      client.subscribe(all);
      if (typeof client.records === 'function') all(client.records());
    } catch (e){ /* jamais bloquant */ }
  }

  return { attach, handle };
})();
