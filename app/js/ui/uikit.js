'use strict';

/* ============================================================
   UIKIT
   ============================================================ */
const UIKit = (() => {
  const LABELS = { back:'ui.back', notifications:'ui.notifications', 'mark-notifs':'ui.markRead', 'toggle-balance':'ui.toggleBalance', share:'ui.share', 'share-receipt':'ui.share', download:'action.download', 'download-receipt':'action.download', 'contact-remove':'ui.remove', 'crypto-market':'ui.market', 'banks-add':'ui.addBank', 'card-toggle-number':'cards.showNumber', 'card-toggle-cvv':'cards.showCvv', 'settings-toggle-notifs':'settings.notifs', 'settings-toggle-biometric':'settings.biometric', 'settings-toggle-txconfirm':'settings.txConfirm', 'settings-toggle-vibration':'settings.vibration', 'copy':'action.copy', 'sign-out':'profile.logout' };
  const NATIVE = { BUTTON:1, A:1, INPUT:1, SELECT:1, TEXTAREA:1, SUMMARY:1 };
  const GUARD_MS = 450;
  let started = false, raf = 0, timer = 0, _lastEnhance = 0;
  function haptic(kind){
    try {
      if (Runtime.settings && Runtime.settings.vibration === false) return;
      if (!navigator.vibrate) return;
      navigator.vibrate(kind === 'success' ? [12, 40, 12] : kind === 'error' ? [40, 30, 40] : 8);
    } catch(e){}
  }
  function loading(btn, on){
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
    if (on){ btn.setAttribute('aria-busy', 'true'); btn.disabled = true; }
    else { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  }
  function labelFor(el){
    const k = el.getAttribute('data-action') || el.getAttribute('data-nav') || '';
    if (LABELS[k]) return t(LABELS[k]);
    if (el.classList.contains('topbar-back')) return t('ui.back');
    return '';
  }
  function enhance(root){
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('button,[role="button"],a[data-nav]').forEach(el => {
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      if ((el.textContent || '').trim()) return;
      const l = labelFor(el); if (l) el.setAttribute('aria-label', l);
    });
    root.querySelectorAll('[data-action="toggle-balance"]').forEach(el => { el.setAttribute('aria-pressed', Runtime.hideBalance ? 'true' : 'false'); });
    root.querySelectorAll('.item,.select-item,.country-row,.service-pill,.contact-card,[data-action],[data-nav]').forEach(el => {
      if (NATIVE[el.tagName]) return;
      if (el.onclick){ if (!el.hasAttribute('role')) el.setAttribute('role', 'button'); if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); }
    });
    root.querySelectorAll('button.select-item').forEach(el => { el.setAttribute('aria-pressed', el.classList.contains('selected') ? 'true' : 'false'); });
    root.querySelectorAll('.field').forEach(f => {
      const lab = f.querySelector('label.field-label'), inp = f.querySelector('input,select,textarea');
      if (!lab || !inp) return;
      if (!inp.id) inp.id = 'f-' + Math.random().toString(36).slice(2, 8);
      if (!lab.getAttribute('for')) lab.setAttribute('for', inp.id);
    });
    root.querySelectorAll('.field-err').forEach(e => { if (!e.hasAttribute('role')) e.setAttribute('role', 'alert'); });
    root.querySelectorAll('input.ltr:not([lang])').forEach(inp => inp.setAttribute('lang', 'en'));
  }
  function enhanceAll(){
    raf = 0; timer = 0; _lastEnhance = Date.now();
    enhance(document.querySelector('.screen.active'));
    enhance(document.getElementById('bottom-nav'));
    enhance(document.getElementById('side-nav'));
    const tc = document.getElementById('toasts'); if (tc && !tc.getAttribute('role')) tc.setAttribute('role', 'status');
  }
  function schedule(){
    if (raf || timer) return;
    const since = Date.now() - _lastEnhance;
    const delay = since >= 30 ? 0 : (30 - since);
    if (delay === 0) raf = requestAnimationFrame(enhanceAll);
    else timer = setTimeout(enhanceAll, delay);
  }
  function enhanceSync(root){ enhance(root); _lastEnhance = Date.now(); }
  function init(){
    if (started) return; started = true;
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('.btn') : null;
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-fast')){ haptic('tap'); return; }      /* boutons de navigation (ex. « Suivant ») : jamais de garde anti-double-appui, on peut les enchaîner */
      const now = Date.now();
      if (b.__until && b.__until > now){ e.stopImmediatePropagation(); e.preventDefault(); return; }
      b.__until = now + GUARD_MS;
      haptic('tap');
    }, true);
    document.addEventListener('keydown', e => {
      const el = e.target;
      if (!el || !el.getAttribute) return;
      if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute('role') === 'button' && !NATIVE[el.tagName]){ e.preventDefault(); el.click(); return; }
      if (e.key === 'Enter' && el.tagName === 'INPUT' && !el.isComposing){
        const scr = el.closest('.screen.active'); if (!scr) return;
        const prim = scr.querySelectorAll('.btn-primary[id]');
        if (prim.length === 1 && !prim[0].disabled){ e.preventDefault(); prim[0].click(); }
      }
    });
    const host = document.getElementById('app');
    if (host && window.MutationObserver) new MutationObserver(schedule).observe(host, { childList:true, subtree:true });
    schedule();
  }
  return { init, enhance, enhanceSync, enhanceAll, schedule, haptic, loading };
})();

