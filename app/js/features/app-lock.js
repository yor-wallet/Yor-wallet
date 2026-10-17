'use strict';

/* ============================================================
   APP LOCK — Friendly Pay 12.9.0
   Ouverture de l'application (démarrage à froid, rechargement, ou retour après plus de GRACE_MS) :
     - appareil compatible, Face ID déjà activé  -> confirmation Face ID (obligatoire), sans saisie du code ;
     - appareil compatible, Face ID pas encore activé -> code à 6 chiffres puis activation de Face ID (obligatoire) ;
     - appareil sans biométrie -> code à 6 chiffres, comme avant.
   Après une nouvelle connexion : le code doit exister (création obligatoire), puis Face ID est demandé (confirmation de connexion).
   « Face ID ne marche pas ? » : le code est demandé (vérifié par le serveur) puis la clé Face ID est recréée.
   Pendant le verrouillage l'application dessous est couverte et rendue inerte. Le code est contrôlé par le serveur
   (verify_pin) et n'est jamais conservé.
   ============================================================ */
const AppLock = (() => {
  const GRACE_MS = 5000;
  const L = {
    en:{ unlockTitle:'Enter your PIN', unlockSub:'Enter your 6-digit code to open Friendly Pay', createTitle:'Create your PIN', createSub:'Choose a 6-digit code. It is needed to confirm your transfers.', confirmTitle:'Confirm your PIN', confirmSub:'Enter the same code again', mismatch:'Codes do not match. Try again.', weak:'This code is too easy to guess. Choose another one.', logout:'Log out', error:'Something went wrong. Try again.', del:'Delete' },
    fr:{ unlockTitle:'Entrez votre code', unlockSub:'Saisissez votre code à 6 chiffres pour ouvrir Friendly Pay', createTitle:'Créez votre code', createSub:'Choisissez un code à 6 chiffres. Il sert à confirmer vos transferts.', confirmTitle:'Confirmez votre code', confirmSub:'Saisissez de nouveau le même code', mismatch:'Les codes ne correspondent pas. Réessayez.', weak:'Ce code est trop facile à deviner. Choisissez-en un autre.', logout:'Se déconnecter', error:'Une erreur est survenue. Réessayez.', del:'Effacer' },
    ar:{ unlockTitle:'أدخل رمز PIN', unlockSub:'أدخل رمزك المكوّن من 6 أرقام لفتح فرندي باي', createTitle:'أنشئ رمز PIN', createSub:'اختر رمزاً من 6 أرقام. يُستخدم لتأكيد تحويلاتك.', confirmTitle:'أكّد رمز PIN', confirmSub:'أدخل الرمز نفسه مرة أخرى', mismatch:'الرمزان غير متطابقين. حاول مرة أخرى.', weak:'هذا الرمز سهل التخمين. اختر رمزاً آخر.', logout:'تسجيل الخروج', error:'حدث خطأ. حاول مرة أخرى.', del:'حذف' }
  };
  const tx = (k) => (L[LANG] || L.en)[k] || L.en[k];
  let signedIn = false, pinKnown = false, hiddenAt = 0, ov = null, cover = null, keyHandler = null, faceBusy = false;

  function css(){
    if (document.getElementById('yl-css')) return;
    const s = document.createElement('style'); s.id = 'yl-css';
    s.textContent =
      '.yl,.yl-cover{position:fixed;inset:0;z-index:1000;box-sizing:border-box;background:var(--bg,#F4FAF9);color:var(--text,#0B1F1D);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(16px + env(safe-area-inset-top,0px)) 20px calc(16px + env(safe-area-inset-bottom,0px));overflow-y:auto}' +
      '.yl-title{font-size:22px;font-weight:700;margin:14px 0 6px;text-align:center}' +
      '.yl-sub{font-size:14px;opacity:.7;text-align:center;max-width:320px;line-height:1.5;margin:0 0 18px}' +
      '.yl-err{min-height:20px;font-size:13px;color:var(--danger,#ef4444);text-align:center;margin-bottom:10px;max-width:320px}' +
      '.yl-out{margin-top:18px;background:none;border:0;color:var(--accent,#0B7F75);font-size:15px;font-weight:600;padding:12px 16px;cursor:pointer;min-height:44px}' +
      '@keyframes ylshake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}' +
      '.yl-shake{animation:ylshake .35s}' +
      '@media (max-height:640px){.yl-title{margin-top:6px}}' +
      '@media (prefers-reduced-motion:reduce){.yl-shake{animation:none}}';
    document.head.appendChild(s);
  }
  function setInert(on){
    const r = document.getElementById('app'); if (!r) return;
    try { r.inert = on; } catch(e){}
    if (on) r.setAttribute('aria-hidden', 'true'); else r.removeAttribute('aria-hidden');
  }
  function removeCover(){ if (cover){ cover.remove(); cover = null; } }
  function close(){
    if (keyHandler){ document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    if (ov){ ov.remove(); ov = null; }
    removeCover(); setInert(false);
  }
  function showCover(){
    if (cover || ov) return; css();
    cover = document.createElement('div'); cover.className = 'yl-cover'; cover.setAttribute('aria-hidden', 'true');
    cover.innerHTML = logoLockup(72);
    document.body.appendChild(cover);
  }
  async function logout(){ close(); pinKnown = false; try { await AuthEngine.signOut(); } catch(e){} }

  /* Pavé du code : mode 'unlock' (vérifier), 'create' (créer + confirmer). onDone() peut renvoyer une promesse :
     la feuille du code reste affichée jusqu'à la fin de la suite (ex. activation de Face ID). */
  function open(mode, onDone){
    css(); close(); setInert(true);
    let entry = '', first = null, step = mode === 'create' ? 1 : 0, busy = false;
    ov = document.createElement('div'); ov.className = 'yl'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div id="yl-logo">' + logoLockup(56) + '</div>' +
      '<div class="yl-title" id="yl-title"></div><p class="yl-sub" id="yl-sub"></p>' +
      '<div class="yl-dots fk-dots" id="yl-dots">' + '<i class="yl-dot"></i>'.repeat(6) + '</div>' +
      '<div class="yl-err" id="yl-err" role="alert"></div>' +
      Keypad.padHtml('yl') +
      '<button type="button" class="yl-out" id="yl-out">' + escapeHtml(tx('logout')) + '</button>';
    document.body.appendChild(ov);
    const me = ov;
    const $ = (id) => me.querySelector('#' + id);
    function paint(){
      $('yl-title').textContent = step === 0 ? tx('unlockTitle') : step === 1 ? tx('createTitle') : tx('confirmTitle');
      $('yl-sub').textContent = step === 0 ? tx('unlockSub') : step === 1 ? tx('createSub') : tx('confirmSub');
      me.querySelectorAll('.yl-dot').forEach((d, i) => d.classList.toggle('on', i < entry.length));
    }
    function fail(msg){
      $('yl-err').textContent = msg || tx('error');
      const d = $('yl-dots'); d.classList.remove('yl-shake'); void d.offsetWidth; d.classList.add('yl-shake');
      try { UIKit.haptic('error'); } catch(e){}
      entry = ''; busy = false; paint();
    }
    async function success(){
      pinKnown = true; try { UIKit.haptic('success'); } catch(e){}
      let r; try { r = onDone ? onDone() : null; } catch(e){ r = null; }
      try { await Promise.resolve(r); } catch(e){}
      if (ov === me) close();
    }
    async function submit(){
      busy = true;
      if (step === 0){
        let r; try { r = await PinEngine.verify(entry); } catch(e){ r = { ok:false, msg:tx('error') }; }
        if (r.ok){ success(); return; }
        fail(r.msg); return;
      }
      if (step === 1){ first = entry; entry = ''; step = 2; busy = false; $('yl-err').textContent = ''; paint(); return; }
      if (entry !== first){ first = null; step = 1; fail(tx('mismatch')); return; }
      const r = await sb.rpc('set_pin', { p_pin: entry });
      if (r.error){
        const m = String(r.error.message || '').toLowerCase();
        if (m.includes('weak_pin')){ first = null; step = 1; fail(tx('weak')); return; }
        if (!m.includes('pin_exists')){ fail(tx('error')); return; }
      }
      success();
    }
    function press(k, btn){
      if (busy) return;
      $('yl-err').textContent = '';
      if (k === 'del'){ entry = entry.slice(0, -1); paint(); return; }
      if (entry.length >= 6) return;
      entry += k; try { UIKit.haptic('tap'); } catch(e){} paint();
      if (btn) Keypad.fly(btn, $('yl-dots'), entry.length - 1);
      if (entry.length === 6){ Keypad.bloom($('yl-dots')); submit(); }
    }
    Keypad.bind(me, press);
    $('yl-out').onclick = logout;
    keyHandler = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
    document.addEventListener('keydown', keyHandler);
    paint();
  }

  async function hasPin(){
    try { const r = await PinEngine.hasPin(); return r; } catch(e){ return null; }
  }
  /* Après le code (vérifié ou créé) : sur un appareil compatible, Face ID doit être activé. */
  async function afterPin(purpose, next){
    let sup = false; try { sup = await FaceId.supported(); } catch(e){}
    if (sup){
      const r = await FaceId.reenroll({ purpose: purpose, logout: logout });
      if (r && r.loggedOut) return;
    }
    close(); if (next) next();
  }
  /* Confirmation Face ID (obligatoire quand l'appareil le permet) à l'ouverture / au retour dans l'application */
  async function unlockFlow(purpose, next){
    css(); setInert(true);
    let sup = false; try { sup = await FaceId.supported(); } catch(e){}
    if (sup && FaceId.info().enrolled){
      if (faceBusy) return; faceBusy = true;
      let r; try { r = await FaceId.gate({ purpose: purpose, logout: logout }); } catch(e){ r = { ok:false, recover:true }; }
      faceBusy = false;
      if (r.ok){ pinKnown = true; close(); if (next) next(); return; }
      if (r.loggedOut) return;
      open('unlock', () => afterPin(purpose, next));            /* Face ID ne marche pas : code, puis nouvelle clé */
      return;
    }
    open('unlock', () => afterPin(purpose, next));
  }
  /* App start with an existing session: Face ID / the code is asked BEFORE anything is shown. */
  async function gate(next){
    if (!signedIn){ next(); return; }
    css(); showCover(); setInert(true);
    const has = await hasPin();
    pinKnown = has !== false;                 /* if the status cannot be read, fail closed: ask for the code */
    if (has === false){ open('create', () => afterPin('unlock', next)); return; }
    unlockFlow('unlock', next);
  }
  /* After a fresh sign-in / sign-up: the code must exist, then Face ID confirms the sign-in. */
  async function ensurePin(){
    if (!signedIn || ov || faceBusy) return;
    const has = await hasPin();
    if (has === false){ pinKnown = false; open('create', () => afterPin('login', null)); return; }
    if (has === true) pinKnown = true;
    let sup = false; try { sup = await FaceId.supported(); } catch(e){}
    if (!sup) return;
    css(); setInert(true); faceBusy = true;
    let r; try { r = await FaceId.gate({ purpose: 'login', logout: logout }); } catch(e){ r = { ok:false, recover:true }; }
    faceBusy = false;
    if (r.ok){ close(); return; }
    if (r.loggedOut) return;
    open('unlock', () => afterPin('login', null));
  }
  function setSignedIn(v){ signedIn = !!v; if (!signedIn){ pinKnown = false; faceBusy = false; close(); } }
  function onHide(){ hiddenAt = Date.now(); if (signedIn && pinKnown) showCover(); }
  function onShow(){
    if (!signedIn || !pinKnown){ removeCover(); return; }
    if (ov || faceBusy){ removeCover(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= GRACE_MS){ showCover(); unlockFlow('unlock', null); }
    else removeCover();
  }
  function init(){
    try { FaceId.warm(); } catch(e){}
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); else onShow(); });
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', (e) => { if (e.persisted) onShow(); });
  }
  return { init, gate, ensurePin, setSignedIn };
})();
