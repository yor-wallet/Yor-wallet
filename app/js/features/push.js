'use strict';

/* ============================================================
   PUSH — alertes sur le téléphone (12.13.0)
   Web Push standard (RFC 8030 / 8291 / 8292) : le serveur (fonction push-send) envoie le message à Apple (APNs) ou Google, qui le livre à l'appareil
   MÊME QUAND L'APPLICATION EST FERMÉE ; le service worker (sw.js) l'affiche. Rien ne tourne « en arrière-plan » dans la page elle-même : sur iPhone,
   une application web ne peut pas s'exécuter fermée, seule la livraison par Apple le permet.
   Conditions iPhone (Apple) : iOS 16.4 ou plus ; l'application doit être AJOUTÉE À L'ÉCRAN D'ACCUEIL et ouverte depuis son icône ; l'autorisation
   n'est demandée que sur un geste de la personne (le bouton « Activer »). Dans un onglet Safari ordinaire, rien de tout cela n'existe.
   La clé publique VAPID (CONFIG.PUSH.vapidPublicKey) est publique ; la clé privée n'existe que sur le serveur.
   ============================================================ */
const Push = (() => {
  const FIAT_TYPES = ['TRANSFER_SENT', 'TRANSFER_RECEIVED', 'DEPOSIT'];     /* la crypto est masquée : jamais de pastille ni d'alerte pour elle */
  const keyB64 = () => (typeof CONFIG !== 'undefined' && CONFIG.PUSH && CONFIG.PUSH.vapidPublicKey) || '';
  const ua = () => (navigator.userAgent || '');
  const isIos = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function isStandalone(){
    try { return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
    catch(e){ return false; }
  }
  const capable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function b64uToBytes(s){
    const p = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /* « ready » ne se résout jamais si le service worker n'est pas enregistré : on n'attend pas sans fin */
  function swReady(ms){
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('sw_timeout')), ms || 8000))]);
  }
  async function current(){
    if (!capable()) return null;
    try { const reg = await swReady(4000); return await reg.pushManager.getSubscription(); } catch(e){ return null; }
  }

  /* 'unsupported' | 'install' (iPhone, pas encore sur l'écran d'accueil) | 'denied' | 'off' | 'on' */
  async function state(){
    if (!keyB64()) return 'unsupported';
    if (isIos() && !isStandalone()) return 'install';
    if (!capable()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') return 'off';
    return (await current()) ? 'on' : 'off';
  }

  async function save(sub){
    const j = typeof sub.toJSON === 'function' ? sub.toJSON() : {};
    const k = j.keys || {};
    if (!j.endpoint || !k.p256dh || !k.auth) throw new Error('bad_subscription');
    /* l'enregistrement passe par la fonction push-send : elle contrôle l'adresse (Apple, Google, Firefox, Edge seulement) puis écrit dans la table privée */
    const r = await sb.functions.invoke('push-send', { body: { action: 'subscribe', subscription: { endpoint: j.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }, user_agent: ua().slice(0, 300) } });
    if (r && r.error) throw r.error;
  }

  /* À appeler DIRECTEMENT depuis le geste (toucher) : la demande d'autorisation doit être le premier « await » du geste. */
  async function enable(){
    if (!capable() || !keyB64()) return { ok: false, reason: 'unsupported' };
    let perm;
    try { perm = await Notification.requestPermission(); } catch(e){ return { ok: false, reason: 'error' }; }
    if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
    try {
      const reg = await swReady(10000);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(keyB64()) });
      await save(sub);
      return { ok: true };
    } catch(e){ return { ok: false, reason: 'error', detail: String((e && e.message) || e).slice(0, 120) }; }
  }

  async function disable(){
    const sub = await current();
    if (sub){
      try { await sb.functions.invoke('push-send', { body: { action: 'unsubscribe', endpoint: sub.endpoint } }); } catch(e){ /* l'appareil retiré sera supprimé du serveur dès qu'Apple répond « disparu » */ }
      try { await sub.unsubscribe(); } catch(e){}
    }
    return { ok: true };
  }

  /* À chaque ouverture (connexion faite) : l'adresse de livraison peut changer (iOS la renouvelle parfois) ou l'appareil peut passer à une autre personne. */
  async function sync(){
    try {
      if ((await state()) !== 'on') return;
      const sub = await current();
      if (sub) await save(sub);
    } catch(e){ /* tentative silencieuse : réessayée à la prochaine ouverture */ }
  }

  /* Déconnexion : cet appareil ne doit plus recevoir les alertes de la personne qui part, et la suivante doit choisir elle-même. Ne bloque jamais plus de 2 s. */
  async function forget(){
    try { await Promise.race([disable(), new Promise(r => setTimeout(r, 2000))]); } catch(e){}
  }

  /* Bouton « Envoyer un test » : le serveur envoie une vraie alerte, par le même chemin que les transferts. */
  async function test(){
    try {
      const r = await sb.functions.invoke('push-send', { body: { action: 'test' } });
      if (r && r.error){
        const st = r.error.context && r.error.context.status;
        return { ok: false, reason: st === 429 ? 'too_fast' : 'error' };
      }
      const d = (r && r.data) || {};
      if (!d.devices) return { ok: false, reason: 'none' };
      return d.sent > 0 ? { ok: true, sent: d.sent } : { ok: false, reason: 'failed' };
    } catch(e){ return { ok: false, reason: 'error' }; }
  }

  /* Pastille sur l'icône = nombre d'alertes non lues (même règle que le serveur). Effacée quand tout est lu. */
  function unreadCount(){
    return ((typeof Runtime !== 'undefined' && Runtime.notifications) || []).filter(n => n && n.read === false && FIAT_TYPES.indexOf(n.type) !== -1).length;
  }
  function syncBadge(){
    try {
      const n = unreadCount();
      if (n > 0 && navigator.setAppBadge) Promise.resolve(navigator.setAppBadge(n)).catch(() => {});
      else if (navigator.clearAppBadge) Promise.resolve(navigator.clearAppBadge()).catch(() => {});
    } catch(e){}
  }

  /* Messages du service worker : toucher une alerte ouvre l'écran voulu ; un changement d'abonnement relance l'enregistrement. */
  function openFromPush(url){
    try {
      if (!AuthEngine.hasValidContext()) return;
      R.go(/^#\/settings/.test(String(url || '')) ? 'settings' : 'notifications');
    } catch(e){}
  }
  function listen(){
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.addEventListener) return;
    navigator.serviceWorker.addEventListener('message', ev => {
      const d = ev && ev.data;
      if (!d) return;
      if (d.type === 'fp-push-click') openFromPush(d.url);
      else if (d.type === 'fp-push-resync') sync();
    });
  }

  /* ---------- ligne des Réglages ---------- */
  const SUB_KEY = { off: 'push.sub.off', on: 'push.sub.on', denied: 'push.sub.denied', install: 'push.sub.install', unsupported: 'push.sub.unsupported' };
  function rowHtml(){
    return '<div class="settings-row push-row" id="push-row" data-push-state="loading" style="cursor:default">' +
        '<div class="tile">' + icon_('bell', 20) + '</div>' +
        '<div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(t('push.title')) + '</div>' +
        '<div class="settings-row-sub" id="push-sub">&nbsp;</div></div>' +
      '</div>' +
      '<div class="push-actions" id="push-actions" hidden></div>';
  }
  function actionsHtml(st){
    const b = (act, key, cls) => '<button class="btn ' + cls + ' push-btn" type="button" data-push="' + act + '">' + escapeHtml(t(key)) + '</button>';
    if (st === 'off') return b('enable', 'push.enable', 'btn-primary');
    if (st === 'on') return b('test', 'push.test', 'btn-secondary') + b('disable', 'push.disable', 'btn-secondary');
    return '';
  }
  async function paintRow(){
    const row = document.getElementById('push-row');
    if (!row) return;
    const st = await state();
    const row2 = document.getElementById('push-row');            /* l'écran a pu être redessiné pendant l'attente */
    if (!row2) return;
    row2.setAttribute('data-push-state', st);
    const sub = document.getElementById('push-sub'); if (sub) sub.textContent = t(SUB_KEY[st] || SUB_KEY.unsupported);
    const box = document.getElementById('push-actions');
    if (box){ const html = actionsHtml(st); box.innerHTML = html; box.hidden = !html; }
  }
  function mountRow(){
    paintRow();
    const box = document.getElementById('push-actions');
    if (!box || box.__wired) return;
    box.__wired = true;
    box.addEventListener('click', async (ev) => {
      const btn = ev.target.closest && ev.target.closest('[data-push]');
      if (!btn || btn.disabled) return;
      const act = btn.getAttribute('data-push');
      btn.disabled = true;
      try {
        if (act === 'enable'){
          const r = await enable();                                  /* premier « await » du geste */
          if (r.ok) toast(t('push.toast.on'), 'success');
          else toast(t(r.reason === 'denied' ? 'push.toast.denied' : r.reason === 'dismissed' ? 'push.toast.dismissed' : 'push.toast.error'), 'error');
        } else if (act === 'disable'){
          await disable(); toast(t('push.toast.off'), 'success');
        } else if (act === 'test'){
          const r = await test();
          if (r.ok) toast(t('push.toast.testSent'), 'success');
          else toast(t(r.reason === 'too_fast' ? 'push.toast.tooFast' : r.reason === 'none' ? 'push.toast.testNone' : 'push.toast.testFail'), 'error');
        }
      } finally { btn.disabled = false; }
      paintRow();
    });
  }

  return { state, enable, disable, sync, forget, test, syncBadge, unreadCount, listen, mountRow, rowHtml, isIos, isStandalone, FIAT_TYPES };
})();
