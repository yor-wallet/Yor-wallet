'use strict';

/* ============================================================
   UTILS
   ============================================================ */
/* ============================================================
   DEVICE LANGUAGE — the app opens in the language of the phone (ar / fr, otherwise en).
   First launch: the person picks a language once (device-level UI preference, not account data).
   A signed-in user's saved language always wins over the device language.
   ============================================================ */
const DeviceLang = (() => {
  const KEY = 'yor_device_lang', CHOSEN = 'yor_lang_chosen', OK = ['en','fr','ar'];
  function read(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function write(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function detect(){
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (const l of list){
      const c = String(l || '').toLowerCase().slice(0, 2);
      if (OK.indexOf(c) >= 0) return c;
    }
    return 'en';
  }
  function get(){ const v = read(KEY); return OK.indexOf(v) >= 0 ? v : detect(); }
  function set(l){ if (OK.indexOf(l) >= 0){ write(KEY, l); write(CHOSEN, '1'); } }
  function hasChosen(){ return read(CHOSEN) === '1'; }
  function showPicker(done){
    const cur = get();
    const ov = document.createElement('div');
    ov.id = 'lang-picker'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;justify-content:center;gap:14px;box-sizing:border-box;padding:calc(24px + env(safe-area-inset-top,0px)) 24px calc(24px + env(safe-area-inset-bottom,0px));background:var(--bg,#0A0A0A);color:var(--text,#fff);overflow-y:auto';
    const names = { en:'English', fr:'Français', ar:'العربية' };
    ov.innerHTML = '<div style="text-align:center;margin-bottom:8px"><div style="display:inline-block">' + logoLockup(72) + '</div></div>' +
      '<div style="text-align:center;font-weight:700;font-size:20px">Choose your language</div>' +
      '<div style="text-align:center;font-size:14px;opacity:.75;margin-top:-6px">Choisissez votre langue · اختر لغتك</div>' +
      OK.map(l => '<button type="button" class="btn ' + (l === cur ? 'btn-primary' : 'btn-secondary') + '" data-pick-lang="' + l + '" style="width:100%;min-height:56px;font-size:17px">' + names[l] + '</button>').join('');
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-pick-lang]').forEach(b => {
      b.onclick = () => {
        const l = b.getAttribute('data-pick-lang');
        set(l); LANG = l; applyI18n();
        ov.remove();
        if (typeof done === 'function') done();
      };
    });
  }
  return { get, set, hasChosen, showPicker, detect };
})();
function applyI18n(){
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });
}
/* Thème enregistré de la personne ; « clair » tant qu'elle n'a rien choisi (c'est ce que l'application affiche au démarrage). */
function savedThemeMode(){
  const s = (typeof Runtime !== 'undefined' && Runtime) ? Runtime.settings : null;
  const m = s && s.theme;
  return (m === 'dark' || m === 'light' || m === 'system') ? m : 'light';
}
let _themeMode = 'light', _themeMq = null;
function applyTheme(mode){
  mode = (mode === 'dark' || mode === 'light' || mode === 'system') ? mode : 'light';
  _themeMode = mode;
  try { localStorage.setItem('fp_theme', mode); } catch(e){ /* rien */ }
  let dark = false;
  try { dark = mode === 'system' ? !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) : mode === 'dark'; } catch(e){ dark = mode === 'dark'; }
  const eff = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', eff);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', eff === 'dark' ? '#061110' : '#F4FAF9');
  /* « Système » suit le téléphone en direct (nuit / jour), sans recharger */
  if (!_themeMq && window.matchMedia){
    try {
      _themeMq = window.matchMedia('(prefers-color-scheme: dark)');
      const follow = () => { if (_themeMode === 'system') applyTheme('system'); };
      if (_themeMq.addEventListener) _themeMq.addEventListener('change', follow); else if (_themeMq.addListener) _themeMq.addListener(follow);
    } catch(e){ _themeMq = null; }
  }
}
function escapeHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function timeAgo(ts){
  const d = Date.now() - ts;
  if (d < 60000) return LANG === 'en' ? 'Just now' : LANG === 'ar' ? 'الآن' : 'À l\'instant';
  const m = Math.floor(d / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' h';
  return new Date(ts).toLocaleDateString(LANG === 'en' ? 'en-GB' : LANG === 'ar' ? 'ar-EG' : 'fr-FR', { day:'2-digit', month:'short' });
}
function fmtDate(ts){ return new Date(ts).toLocaleDateString(LANG === 'en' ? 'en-GB' : LANG === 'ar' ? 'ar-EG' : 'fr-FR', { day:'2-digit', month:'short', year:'numeric' }); }
function fmtTime(ts){ return new Date(ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }); }
function toast(msg, type){
  const c = document.getElementById('toasts');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .28s, transform .28s'; el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 300); }, 2600);
}

