'use strict';

/* ============================================================
   BOOT
   ============================================================ */
/* Démarrage impossible : écran traduit avec « Réessayer » ; le détail technique va dans la console, jamais à l'écran. */
function showFatal(msg){
  try { Resilience.fatal(msg); } catch(e){ console.error('[boot]', msg, e); }
}
const BOOT_FAILS_KEY = 'fp.loadfail';
function bootFails(delta){
  try {
    if (delta === 0) { sessionStorage.removeItem(BOOT_FAILS_KEY); return 0; }
    const n = (parseInt(sessionStorage.getItem(BOOT_FAILS_KEY) || '0', 10) || 0) + (delta || 0);
    if (delta) sessionStorage.setItem(BOOT_FAILS_KEY, String(n));
    return n;
  } catch(e){ return 0; }
}

/* Raccourcis de l'icône (« Envoyer », « Cartes », « Historique ») : le lien d'ouverture est lu AVANT que le routeur ne réécrive l'adresse ;
   l'écran demandé s'ouvre une fois le compte ouvert (et le code saisi), par-dessus l'accueil. Liste blanche : jamais d'écran sensible ou d'étape au milieu d'un parcours. */
const LAUNCH_HASH = (() => { try { return location.hash || ''; } catch(e){ return ''; } })();
const DEEP_OK = ['cards', 'country-select', 'history', 'notifications', 'profile', 'settings', 'services'].concat(FEATURES.crypto ? ['crypto'] : []);
let _deepUsed = false;
function openHome(){
  R.go('home', { reset:true, force:true });
  if (_deepUsed || !LAUNCH_HASH) return;
  _deepUsed = true;
  try {
    const id = R.resolve(LAUNCH_HASH);
    if (id && id !== 'home' && DEEP_OK.indexOf(id) !== -1) R.go(id);
  } catch(e){ console.error('[deeplink]', e); }
}

function healServiceWorker(){
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return false;
    if (sessionStorage.getItem('fp.swheal')) return false;
    sessionStorage.setItem('fp.swheal', '1');
    const reload = () => { try { location.reload(); } catch(e){ /* rien */ } };
    const regs = navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())));
    const caches2 = window.caches ? caches.keys().then(ks => Promise.all(ks.filter(k => /^(yor|fp)-shell-/.test(k)).map(k => caches.delete(k)))) : Promise.resolve();
    Promise.all([regs, caches2]).then(reload, reload);
    return true;
  } catch(e){ return false; }
}

function boot(){
  if (boot._done) return; boot._done = true;
  try { Resilience.init(); } catch(e){ console.error(e); }
  ViewportEngine.init();
  V12.init();
  LANG = DeviceLang.get(); applyI18n();   /* first paint already in the phone's language */

  /* Supabase must be configured before anything else. */
  if (!initSupabase()){
    /* Le client Supabase n'a pas pu être chargé alors qu'un service worker contrôle la page : on le retire et on recharge UNE fois
       (aide les téléphones restés sur l'ancien service worker 12.11.0). Sinon : écran « Connexion impossible » avec « Réessayer ». */
    if (healServiceWorker()) return;
    showFatal('Supabase client unavailable (script not loaded or not configured).');
    return;
  }

  /* Sidebar placeholder is empty until first user hydration. */
  renderSidebar();

  (function bindBottomNavOnce(){
    const nav = document.getElementById('bottom-nav');
    if (!nav || nav.__bound) return;
    nav.__bound = true;
    nav.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const n = el.getAttribute('data-nav');
        if (n === 'home') R.go('home');
        else if (n === 'history') R.go('history');
        else if (n === 'cards') R.go('cards');
        else if (n === 'profile') R.go('profile');
        else if (n === 'crypto') R.go('crypto');
      });
    });
  })();

  const splashEl = document.getElementById('splash');
  if (splashEl) splashEl.innerHTML = OpeningArt.splash(LANG);
  R.bind();
  UIKit.init();
  AppLock.init();
  YorDrawer.init();
  OfferSlot.init();
  try { Promos.init(); } catch(e){ console.error(e); }
  if (FEATURES.crypto){ try { NexWC.init(); } catch(e){ console.error(e); } }

  /* Subscribe to auth state. On ready we route the app. */
  let firstAuthEvent = true;
  /* L'écran d'ouverture reste au moins SPLASH_MIN ms depuis le chargement de la page (pas depuis l'événement d'authentification) */
  const reduced = (() => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; } })();
  const SPLASH_MIN = typeof window.__FP_SPLASH_MIN === 'number' ? window.__FP_SPLASH_MIN : (reduced ? 600 : 1900);   /* __FP_SPLASH_MIN : crochet de test */
  const splashT0 = Date.now();
  const splashWait = () => Math.max(250, SPLASH_MIN - (Date.now() - splashT0));
  AuthEngine.subscribe((signedIn, authEvent) => {
    if (signedIn && authEvent === 'PASSWORD_RECOVERY') setTimeout(openRecovery, 1600);
    if (!signedIn && authEvent === 'LOAD_FAILED'){
      /* session présente mais données illisibles (réseau / service) : on propose de réessayer au lieu d'afficher la connexion.
         Après 2 échecs de suite, on retombe sur l'écran de connexion pour ne jamais enfermer la personne. */
      AppLock.setSignedIn(false);
      if (firstAuthEvent && bootFails(1) <= 2){ firstAuthEvent = false; showFatal('profile load failed'); return; }
      if (!firstAuthEvent){ try { toast(t('res.toast'), 'error'); } catch(e){ /* rien */ } return; }
    } else if (signedIn) bootFails(0);
    if (firstAuthEvent){
      firstAuthEvent = false;
      setTimeout(() => {
        const sp = document.getElementById('splash');
        if (sp){ sp.classList.add('is-hidden'); setTimeout(() => { sp.style.display = 'none'; }, 600); }
        LANG = (Runtime.settings && Runtime.settings.language) || DeviceLang.get();
        applyI18n();
        applyTheme(savedThemeMode());
        renderSidebar();
        if (signedIn){
          /* existing session: the 6-digit code is asked BEFORE the dashboard is reachable */
          AppLock.setSignedIn(true);
          AppLock.gate(() => openHome());
        } else {
          AppLock.setSignedIn(false);
          const toLogin = () => R.go('login', { reset:true, force:true });
          const toSignup = () => R.go('signup', { reset:true, force:true });
          /* la présentation (une seule fois) mène directement à « créer mon compte » ou à « se connecter » */
          const afterLang = () => { if (!Onboarding.seen()) Onboarding.show((to) => { if (to === 'signup') toSignup(); else toLogin(); }); else toLogin(); };
          afterLang();        /* the app opens in the device language; it can be changed from the login screen or Settings */
        }
      }, splashWait());
      return;
    }
    if (signedIn){
      LANG = (Runtime.settings && Runtime.settings.language) || DeviceLang.get();
      applyI18n();
      applyTheme(savedThemeMode());
      renderSidebar();
      AppLock.setSignedIn(true);
      openHome();
      AppLock.ensurePin();                          /* first sign-in: the code must be created */
    } else {
      AppLock.setSignedIn(false);
      resetRuntime();
      LANG = DeviceLang.get();                 /* the previous user's language does not survive; the device language is used */
      applyI18n();
      applyTheme('light');
      renderSidebar();
      R.go('login', { reset:true, force:true });
    }
  });

  /* garde-fou : si le service d'identification ne répond pas du tout, on ne reste pas sur un logo fixe */
  setTimeout(() => { if (firstAuthEvent) showFatal('no auth event within 12 s'); }, 12000);

  document.addEventListener('visibilitychange', () => {
    /* nothing persisted to localStorage other than device id */
  });
  Push.listen();      /* 12.13.0 : toucher une alerte ouvre l'écran voulu ; renouvellement d'abonnement */

  document.addEventListener('click', function once(){ requestFullscreen(); document.removeEventListener('click', once); }, { once: true });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){ window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); }); }

  window.YOR = {
    get context(){ return UserContext.get(); },
    get runtime(){ return Runtime; },
    version: CONFIG.APP.version
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
