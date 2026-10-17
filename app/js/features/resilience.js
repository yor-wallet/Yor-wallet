'use strict';

/* ===== FRIENDLY PAY 12.11.0 — robustesse =====
   - un écran dont l'affichage échoue montre un message clair (réessayer / accueil) au lieu de rester muet ;
   - les erreurs JavaScript et les promesses rejetées sont journalisées ; l'utilisateur voit au plus une petite notification
     toutes les 10 s, jamais le détail technique ;
   - une bannière indique quand l'appareil est hors-ligne et quand la connexion revient ;
   - si le démarrage échoue (service d'identification injoignable, par exemple hors-ligne), un écran localisé propose de réessayer
     (le message technique va dans la console, pas à l'écran). */
Object.assign(TR.en, {
  'res.title':'This screen could not open', 'res.body':'Your money and your data are safe. Please try again.', 'res.retry':'Try again', 'res.home':'Back to home', 'res.reload':'Restart the app',
  'res.toast':'Something went wrong. Please try again.',
  'net.offline':'You are offline. Some features are unavailable.', 'net.online':'Back online',
  'boot.failTitle':'Cannot connect', 'boot.failBody':'Check your internet connection, then try again.', 'boot.failRetry':'Try again'
});
Object.assign(TR.fr, {
  'res.title':'Cet écran n\'a pas pu s\'ouvrir', 'res.body':'Votre argent et vos données sont en sécurité. Veuillez réessayer.', 'res.retry':'Réessayer', 'res.home':'Retour à l\'accueil', 'res.reload':'Redémarrer l\'application',
  'res.toast':'Un problème est survenu. Veuillez réessayer.',
  'net.offline':'Vous êtes hors ligne. Certaines fonctions sont indisponibles.', 'net.online':'De nouveau en ligne',
  'boot.failTitle':'Connexion impossible', 'boot.failBody':'Vérifiez votre connexion internet, puis réessayez.', 'boot.failRetry':'Réessayer'
});
Object.assign(TR.ar, {
  'res.title':'تعذّر فتح هذه الشاشة', 'res.body':'أموالك وبياناتك بأمان. يُرجى المحاولة مرة أخرى.', 'res.retry':'إعادة المحاولة', 'res.home':'العودة إلى الرئيسية', 'res.reload':'إعادة تشغيل التطبيق',
  'res.toast':'حدث خطأ ما. يُرجى المحاولة مرة أخرى.',
  'net.offline':'أنت غير متصل بالإنترنت. بعض الميزات غير متاحة.', 'net.online':'عاد الاتصال',
  'boot.failTitle':'تعذّر الاتصال', 'boot.failBody':'تحقّق من اتصالك بالإنترنت ثم أعد المحاولة.', 'boot.failRetry':'إعادة المحاولة'
});

const Resilience = (() => {
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
  let lastToast = 0, bannerTimer = null, started = false;

  /* Contenu d'un écran de secours. `id` est l'écran qui a échoué (jamais affiché tel quel). */
  function errorScreen(id){
    const safeId = String(id || '').replace(/[^a-z0-9-]/gi, '');
    const isHome = safeId === 'home';
    return '<div class="res-screen" role="alert">' +
      '<div class="res-art" aria-hidden="true"><svg viewBox="0 0 120 120" width="112" height="112"><defs><linearGradient id="resg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0B7F75"/></linearGradient></defs>' +
        '<circle cx="60" cy="60" r="52" fill="url(#resg)" opacity=".14"/><circle cx="60" cy="60" r="38" fill="url(#resg)" opacity=".22"/>' +
        '<g fill="none" stroke="#0B7F75" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M60 38v26"/></g><circle cx="60" cy="82" r="5" fill="#0B7F75"/></svg></div>' +
      '<h1 class="res-title">' + esc(t('res.title')) + '</h1>' +
      '<p class="res-body">' + esc(t('res.body')) + '</p>' +
      '<div class="res-actions">' +
        '<button type="button" class="btn btn-primary" data-res-retry="' + esc(safeId) + '">' + esc(t('res.retry')) + '</button>' +
        (isHome ? '<button type="button" class="btn btn-secondary" data-res-reload>' + esc(t('res.reload')) + '</button>'
                : '<button type="button" class="btn btn-secondary" data-res-home>' + esc(t('res.home')) + '</button>') +
      '</div></div>';
  }

  /* Écran de démarrage impossible (aucun détail technique à l'écran). */
  function fatal(devMessage){
    try { console.error('[boot] ' + devMessage); } catch (e) { /* rien */ }
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.remove('is-hidden'); splash.style.display = '';
    splash.innerHTML = '<div class="res-fatal" role="alert"><div class="res-fatal-logo">' + (typeof logoLockup === 'function' ? logoLockup(64) : '') + '</div>' +
      '<h1 class="res-title">' + esc(t('boot.failTitle')) + '</h1><p class="res-body">' + esc(t('boot.failBody')) + '</p>' +
      '<button type="button" class="btn btn-primary" data-res-reload>' + esc(t('boot.failRetry')) + '</button></div>';
  }

  function toastOnce(){
    const now = Date.now();
    if (now - lastToast < 10000) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;      /* la bannière hors-ligne s'en charge */
    lastToast = now;
    try { toast(t('res.toast'), 'error'); } catch (e) { /* rien */ }
  }

  /* Erreurs sans intérêt pour l'utilisateur : annulation volontaire, bruit du navigateur. */
  function benign(reason){
    const name = reason && reason.name ? String(reason.name) : '';
    const msg = reason && reason.message ? String(reason.message) : String(reason || '');
    if (name === 'AbortError' || name === 'NotAllowedError' || name === 'InvalidStateError') return true;
    if (/ResizeObserver loop|The user aborted|user cancel|cancell?ed|Script error\.?$|Load failed$|NetworkError when attempting|The operation was aborted|play\(\) request|signal is aborted/i.test(msg)) return true;
    return false;
  }

  function banner(){
    let b = document.getElementById('net-banner');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'net-banner'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
    document.body.appendChild(b);
    return b;
  }
  function showOffline(){
    clearTimeout(bannerTimer);
    const b = banner(); b.textContent = t('net.offline'); b.className = 'is-off is-on';
  }
  function showOnline(){
    const b = banner(); b.textContent = t('net.online'); b.className = 'is-ok is-on';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.classList.remove('is-on'); }, 2200);
  }

  function init(){
    if (started) return; started = true;
    window.addEventListener('error', (ev) => {
      if (ev && ev.target && ev.target !== window) return;                           /* image / script qui ne charge pas : pas une erreur de code */
      if (benign(ev && (ev.error || ev.message))) return;
      try { console.error('[error]', ev && (ev.error || ev.message)); } catch (e) { /* rien */ }
      toastOnce();
    });
    window.addEventListener('unhandledrejection', (ev) => {
      if (benign(ev && ev.reason)) return;
      try { console.error('[unhandledrejection]', ev && ev.reason); } catch (e) { /* rien */ }
      toastOnce();
    });
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) showOffline();
    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target : null; if (!el) return;
      const retry = el.closest('[data-res-retry]');
      if (retry){ e.preventDefault(); const id = retry.getAttribute('data-res-retry'); if (id && typeof R !== 'undefined') R.go(id, { force: true }); return; }
      if (el.closest('[data-res-home]')){ e.preventDefault(); if (typeof R !== 'undefined') R.go('home', { reset: true, force: true }); return; }
      if (el.closest('[data-res-reload]')){ e.preventDefault(); location.reload(); }
    }, true);
  }

  return { init, errorScreen, fatal, _benign: benign };
})();
