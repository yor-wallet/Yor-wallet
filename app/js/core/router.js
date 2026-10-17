'use strict';

/* ============================================================
   ROUTER
   ============================================================ */
const R = (() => {
  let current = null, curHash = '', token = 0, started = false, bound = false, cleanups = [];
  const stack = [], overlays = [], SCREENS = {};
  const LOCKED = ['processing','tx-network-validation','tx-confirmation','boot'];
  const PUBLIC_SCREENS = ['login','signup','reset'];
  const ADMIN_SCREENS = ['chain'];     /* écrans réservés au rôle admin (masquage d'interface) */
  const PARENT = {
    'services':'home', 'chain':'services', 'settings':'home', 'banks':'home', 'banks-add':'banks', 'contact-add':'settings',
    'cards':'home', 'cards-add':'cards', 'card-settings':'cards', 'notifications':'home', 'profile':'home',
    'crypto-market':'crypto', 'crypto-networks':'crypto', 'crypto-spot':'crypto',
    'crypto-buy':'crypto', 'crypto-buy-amount':'crypto-buy',
    'crypto-sell':'crypto', 'crypto-sell-amount':'crypto-sell',
    'crypto-swap':'crypto', 'crypto-swap-to':'crypto-swap', 'crypto-swap-amount':'crypto-swap-to',
    'crypto-send':'crypto', 'crypto-send-network':'crypto-send', 'crypto-send-address':'crypto-send-network', 'crypto-send-amount':'crypto-send-address',
    'crypto-review':'crypto', 'crypto-receive':'crypto', 'crypto-receive-address':'crypto-receive',
    'crypto-to-bank':'crypto', 'crypto-to-bank-account':'crypto-to-bank',
    'crypto-to-bank-amount':'crypto-to-bank-account', 'crypto-bank-review':'crypto-to-bank-amount',
    'country-select':'home',
    'tx-amount':'country-select', 'tx-review':'tx-amount', 'receipt':'home',
    'devices':'settings', 'sessions':'settings', 'privacy':'settings', 'help':'settings', 'about':'settings', 'history':'home'
  };
  const NAV_KEYS = {
    'home':'home','services':'services','chain':'services','history':'history','cards':'cards','cards-add':'cards','card-settings':'cards','country-select':'country-select','service-select':'country-select','identifier-input':'country-select','tx-amount':'country-select','tx-review':'country-select','profile':'profile','settings':'settings','banks':'services','banks-add':'services','privacy':'settings','help':'settings','about':'settings',
    'notifications':'notifications','crypto':'crypto','crypto-market':'crypto-market','crypto-networks':'crypto-market','crypto-spot':'crypto-market',
    'crypto-buy':'crypto','crypto-buy-amount':'crypto','crypto-sell':'crypto','crypto-sell-amount':'crypto',
    'crypto-swap':'crypto','crypto-swap-to':'crypto','crypto-swap-amount':'crypto',
    'crypto-send':'crypto','crypto-send-network':'crypto','crypto-send-address':'crypto','crypto-send-amount':'crypto',
    'crypto-review':'crypto','crypto-receive':'crypto','crypto-receive-address':'crypto',
    'crypto-to-bank':'crypto','crypto-to-bank-account':'crypto','crypto-to-bank-amount':'crypto','crypto-bank-review':'crypto'
  };
  function register(map){ Object.assign(SCREENS, map); }
  function onLeave(fn){ if (typeof fn === 'function') cleanups.push(fn); }
  function runCleanups(){ const l = cleanups; cleanups = []; l.forEach(fn => { try { fn(); } catch(e){} }); }
  function pathOf(id){ return '#/' + id.split('-').join('/'); }
  function parse(h){
    const p = String(h || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    for (let k = p.length; k > 0; k--){ const id = p.slice(0, k).join('-'); if (SCREENS[id]) return { id, rest: p.slice(k) }; }
    return null;
  }
  /* Écran désigné par un lien (« #/cards », « #/country/select »…) ; null si inconnu. Sert aux raccourcis de l'icône. */
  function resolve(h){ const c = parse(h); return c ? c.id : null; }
  function setHash(h){ try { if (location.hash !== h) history.replaceState(history.state, '', h); } catch(e){} }
  function syncHash(id){ const c = parse(location.hash); if (!c || c.id !== id) setHash(pathOf(id)); }
  function sync(id){ syncHash(id); curHash = location.hash; }
  function arm(){ try { if (!(history.state && history.state.yorTop)) history.pushState({ yorTop:true }, '', location.href); } catch(e){} }
  function chrome(id){
    const nav = document.getElementById('bottom-nav');
    const hideNav = /^settings|^banks-add|^contact-add|^cards-add|^login|^signup|^reset|^devices|^sessions|^processing/.test(id);   /* 12.12.0: the send animation is full-screen, nothing else to tap */
    if (nav) nav.hidden = hideNav;
    const m = document.getElementById('main'); if (m) m.classList.toggle('no-nav', hideNav);
    const key = NAV_KEYS[id];
    document.querySelectorAll('.nav-item,.side-item').forEach(a => {
      const on = !!key && a.getAttribute('data-nav') === key;
      if (a.classList.contains('side-item')) a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function go(id, opts){
    opts = opts || {};
    if (current === id && !opts.force){ sync(id); return; }
    const fn = SCREENS[id];
    if (!fn){ console.warn('[R] no screen for', id); return; }
    /* Auth guard */
    if (PUBLIC_SCREENS.indexOf(id) === -1 && !AuthEngine.hasValidContext() && id !== 'boot'){
      return go('login', { reset:true, force:true });
    }
    if (PUBLIC_SCREENS.indexOf(id) !== -1 && AuthEngine.hasValidContext()){
      return go('home', { reset:true, force:true });
    }
    if (ADMIN_SCREENS.indexOf(id) !== -1 && !(typeof canUseChain === 'function' && canUseChain())){
      return go('home', { reset:true, force:true });
    }
    if (!FEATURES.crypto && CRYPTO_SCREEN_RE.test(id)){
      return go('home', { reset:true, force:true });     /* crypto section hidden: an old link or a saved screen lands on the home screen */
    }
    if (opts.hash) setHash(opts.hash);
    const my = ++token;
    runCleanups(); closeAll(true);
    let html, failed = false;
    try { html = fn(); } catch(e){ console.error('[R] render', id, e); failed = true; }
    if (my !== token) return;
    if (failed || !html){
      /* un écran qui ne s'affiche pas ne doit jamais laisser la personne devant un écran figé : message clair + réessayer */
      if (!failed) return;
      if (typeof Resilience === 'undefined') return;
      try { html = Resilience.errorScreen(id); } catch(e2){ return; }
      if (!html) return;
    }
    const from = current;
    if (opts.reset){ stack.length = 0; }
    else if (from && from !== id && !opts.back && !opts.replace){ stack.push(from); if (stack.length > 40) stack.shift(); }
    const container = document.getElementById('screens');
    let el = document.getElementById(id);
    if (!el){ el = document.createElement('section'); el.id = id; el.className = 'screen'; container.appendChild(el); }
    el.innerHTML = html;
    document.querySelectorAll('.screen').forEach(s => { if (s !== el) s.classList.remove('active'); });
    el.classList.toggle('from-back', !!opts.back);
    el.classList.add('active');
    el.scrollTop = 0;
    current = id;
    if (id === 'receipt'){ stack.length = 0; stack.push('home'); }
    sync(id);
    if (stack.length) arm();
    try { chrome(id); } catch(e){ console.error('[R] chrome', id, e); }
    if (!failed){
      try { wire(id); } catch(e){ console.error('[R] wire', id, e); }
    }
    try { UIKit.enhanceSync(el); } catch(e){ console.error('[R] enhance', id, e); }
  }
  function back(){
    if (overlays.length){ closeTop(); return; }
    if (LOCKED.includes(current)) return;
    if (stack.length){ go(stack.pop(), { back:true }); return; }
    if (PARENT[current]){ go(PARENT[current], { back:true }); return; }
    if (current !== 'home') go('home', { back:true });
  }
  function home(){ stack.length = 0; go('home', { reset:true }); }
  function open(html, o){
    o = o || {};
    let root = document.getElementById('ov-root');
    if (!root){ root = document.createElement('div'); root.id = 'ov-root'; root.className = 'ov-root'; document.body.appendChild(root); }
    const wrap = document.createElement('div');
    wrap.className = 'ov' + (o.kind === 'modal' ? ' is-modal' : '');
    wrap.innerHTML = '<div class="ov-backdrop"></div><div class="ov-panel" role="dialog" aria-modal="true" tabindex="-1">' + html + '</div>';
    const rec = { wrap, panel: wrap.querySelector('.ov-panel'), prev: document.activeElement, onClose: o.onClose, dismissible: o.dismissible !== false, closed:false };
    root.appendChild(wrap); overlays.push(rec);
    wrap.querySelector('.ov-backdrop').addEventListener('click', () => { if (rec.dismissible) closeRec(rec); });
    requestAnimationFrame(() => { wrap.classList.add('is-open'); try { rec.panel.focus({ preventScroll:true }); } catch(e){} });
    arm();
    return () => closeRec(rec);
  }
  function closeRec(rec, instant){
    if (rec.closed) return; rec.closed = true;
    const i = overlays.indexOf(rec); if (i >= 0) overlays.splice(i, 1);
    rec.wrap.classList.remove('is-open');
    const done = () => { if (rec.wrap.parentNode) rec.wrap.parentNode.removeChild(rec.wrap); };
    if (instant) done(); else setTimeout(done, 340);
    if (typeof rec.onClose === 'function'){ try { rec.onClose(); } catch(e){} }
  }
  function closeTop(){ const r = overlays[overlays.length - 1]; if (r && r.dismissible) closeRec(r); }
  function closeAll(instant){ overlays.slice().forEach(r => closeRec(r, instant)); }
  function bind(){
    if (bound) return; bound = true;
    try { history.replaceState({ yorBase:true }, '', location.href); history.pushState({ yorTop:true }, '', location.href); } catch(e){}
    window.addEventListener('popstate', e => {
      if (!started || !(e.state && e.state.yorBase)) return;
      if (current) setHash(curHash);
      if (overlays.length){ arm(); closeTop(); return; }
      if (LOCKED.includes(current)){ arm(); return; }
      if (stack.length || (current && current !== 'home')){ arm(); back(); }
    });
    window.addEventListener('hashchange', () => {
      if (!started) return;
      const st = history.state;
      if (!st || (!st.yorBase && !st.yorTop)){ try { history.replaceState({ yorBase:true }, '', location.href); } catch(e){} }
      const r = parse(location.hash);
      if (!r){ if (current) setHash(curHash); return; }
      if (r.id === current){ if (location.hash !== curHash){ curHash = location.hash; go(r.id, { force:true }); } return; }
      go(r.id, { fromHash:true });
    });
    document.addEventListener('keydown', e => {
      if (!overlays.length) return;
      if (e.key === 'Escape'){ e.preventDefault(); closeTop(); return; }
      if (e.key !== 'Tab') return;
      const p = overlays[overlays.length - 1].panel;
      const f = p.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length){ e.preventDefault(); p.focus(); return; }
      const first = f[0], last = f[f.length - 1], ae = document.activeElement;
      if (e.shiftKey && (ae === first || ae === p)){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && ae === last){ e.preventDefault(); first.focus(); }
    });
  }
  function start(){
    if (started) return; started = true;
    if (AuthEngine.hasValidContext()) R.go('home', { reset:true });
    else R.go('login', { reset:true });
  }
  return { go, back, home, start, bind, current: () => current, register, resolve, onLeave, overlay:{ open, close:closeTop, isOpen:() => overlays.length > 0 } };
})();

