'use strict';

/* ============================================================================================================
   FACE ID — confirmation biométrique OBLIGATOIRE (12.9.0)
   Utilise WebAuthn avec l'authentificateur de la PLATEFORME (Face ID / Touch ID sur iPhone, Windows Hello, empreinte
   Android) et la vérification de l'utilisateur exigée (userVerification:'required').
   - Exigé : à la confirmation de connexion, à l'ouverture / au retour dans l'application, et avant chaque confirmation
     de transfert (PinEngine.authorize).
   - Une clé est créée une seule fois par appareil et par compte. Elle reste dans le trousseau de l'appareil : aucun
     secret ne passe par ce code ; seul l'identifiant public de la clé et sa clé publique sont gardés localement.
   - Chaque confirmation est contrôlée localement : défi aléatoire, origine, hash du domaine, drapeaux « présence » +
     « vérification de l'utilisateur », et signature vérifiée avec la clé publique enregistrée.
   - IMPORTANT : cette vérification est faite dans l'appareil. Le serveur ne la voit pas : le code PIN à 6 chiffres reste
     le contrôle serveur (verify_pin) et la clé du transfert. Face ID s'ajoute devant, il ne remplace pas le PIN.
   - Appareil sans biométrie / sans WebAuthn : l'étape est ignorée (on ne peut pas exiger ce que l'appareil n'a pas) ;
     le PIN seul s'applique alors.
   ============================================================================================================ */
const FaceId = (() => {
  const KEY = 'friendly_faceid_v1';
  const L = {
    en: { verifyTitle:'Confirm with {N}', verifySub:'Look at your phone to confirm it is you.', unlock:'Unlock Friendly Pay', login:'Confirm your sign-in', transfer:'Confirm this transfer', generic:'Confirm to continue',
      enrollTitle:'Turn on {N}', enrollSub:'{N} is required to sign in and to confirm transfers on this device.', go:'Use {N}', retry:'Try again', cancel:'Cancel', logout:'Log out',
      recover:'{N} not working? Use your PIN', skip:'Continue with PIN only', errCancelled:'{N} was cancelled.', errInvalid:'{N} could not be verified. Try again.', errGeneric:'{N} is not available right now. Try again.', ok:'Confirmed', generic_n:'Biometrics' },
    fr: { verifyTitle:'Confirmez avec {N}', verifySub:'Regardez votre téléphone pour confirmer que c\'est bien vous.', unlock:'Déverrouiller Friendly Pay', login:'Confirmez votre connexion', transfer:'Confirmez ce transfert', generic:'Confirmez pour continuer',
      enrollTitle:'Activez {N}', enrollSub:'{N} est obligatoire pour vous connecter et confirmer les transferts sur cet appareil.', go:'Utiliser {N}', retry:'Réessayer', cancel:'Annuler', logout:'Se déconnecter',
      recover:'{N} ne marche pas ? Utilisez votre code', skip:'Continuer avec le code seulement', errCancelled:'{N} a été annulé.', errInvalid:'{N} n\'a pas pu être vérifié. Réessayez.', errGeneric:'{N} n\'est pas disponible pour le moment. Réessayez.', ok:'Confirmé', generic_n:'Biométrie' },
    ar: { verifyTitle:'أكّد باستخدام {N}', verifySub:'انظر إلى هاتفك لتأكيد أنك أنت.', unlock:'فتح فرندي باي', login:'أكّد تسجيل دخولك', transfer:'أكّد هذا التحويل', generic:'أكّد للمتابعة',
      enrollTitle:'فعّل {N}', enrollSub:'{N} مطلوب لتسجيل الدخول وتأكيد التحويلات على هذا الجهاز.', go:'استخدم {N}', retry:'أعد المحاولة', cancel:'إلغاء', logout:'تسجيل الخروج',
      recover:'{N} لا يعمل؟ استخدم رمزك', skip:'المتابعة بالرمز فقط', errCancelled:'تم إلغاء {N}.', errInvalid:'تعذّر التحقق عبر {N}. حاول مجدداً.', errGeneric:'{N} غير متاح الآن. حاول مجدداً.', ok:'تم التأكيد', generic_n:'البصمة' }
  };
  const apple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || '');
  const nm = () => apple() ? 'Face ID' : (L[LANG] || L.en).generic_n;
  const tx = (k) => String(((L[LANG] || L.en)[k] || L.en[k] || '')).replace(/\{N\}/g, nm());
  let supportedP = null, supportedV = null, el = null;

  const b64u = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const store = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };

  async function uid(){
    try { const c = (typeof UserContext !== 'undefined' && UserContext.get) ? UserContext.get() : null; if (c && c.uid) return c.uid; } catch (e) {}
    try { const r = await sb.auth.getSession(); const u = r && r.data && r.data.session && r.data.session.user; return u ? u.id : null; } catch (e) { return null; }
  }
  function supported(){
    if (supportedP) return supportedP;
    supportedP = (async () => {
      try {
        if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials || !crypto || !crypto.subtle) return false;
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
        return !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
      } catch (e) { return false; }
    })().then(v => { supportedV = v; return v; });
    return supportedP;
  }
  /* état synchrone pour l'écran Paramètres : supported = null tant que la détection n'est pas finie */
  function info(){
    let enrolled = false;
    try { const c = (typeof UserContext !== 'undefined' && UserContext.get) ? UserContext.get() : null; enrolled = !!(c && c.uid && store()[c.uid]); } catch (e) {}
    return { supported: supportedV, enrolled, name: nm() };
  }

  /* --- création de la clé (une fois par appareil et par compte) --- */
  async function enroll(){
    const u = await uid(); if (!u) return { ok: false, reason: 'error' };
    let label = u, display = 'Friendly Pay';
    try { const c = UserContext.get(); if (c && c.email) label = c.email; const p = Runtime.profile || {}; display = ((p.firstName || '') + ' ' + (p.lastName || '')).trim() || display; } catch (e) {}
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: rand(32), rp: { name: 'Friendly Pay', id: location.hostname },
        user: { id: new TextEncoder().encode(String(u)).slice(0, 64), name: label, displayName: display },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged', requireResidentKey: false },
        timeout: 60000, attestation: 'none', extensions: { prf: {} }
      } });
      if (!cred) return { ok: false, reason: 'error' };
      const r = cred.response;
      const pk = typeof r.getPublicKey === 'function' ? r.getPublicKey() : null;
      const alg = typeof r.getPublicKeyAlgorithm === 'function' ? r.getPublicKeyAlgorithm() : -7;
      let prf = false; try { const x = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}; prf = !!(x && x.prf && x.prf.enabled); } catch (e) {}
      const s = store(); s[u] = { id: b64u(cred.rawId), pk: pk ? b64u(pk) : null, alg: alg, at: Date.now(), prf: prf }; save(s);
      return { ok: true };
    } catch (e) { return { ok: false, reason: (e && e.name === 'NotAllowedError') ? 'cancelled' : 'error' }; }
  }

  /* --- vérification d'une confirmation --- */
  function derToRaw(sig){
    let i = 2; if (sig[1] & 0x80) i += sig[1] & 0x7f;
    if (sig[i] !== 2) throw new Error('der');
    const rl = sig[i + 1]; const r = sig.slice(i + 2, i + 2 + rl); i += 2 + rl;
    if (sig[i] !== 2) throw new Error('der');
    const sl = sig[i + 1]; const s = sig.slice(i + 2, i + 2 + sl);
    const fix = (x) => { while (x.length > 32 && x[0] === 0) x = x.slice(1); const o = new Uint8Array(32); o.set(x, 32 - x.length); return o; };
    const out = new Uint8Array(64); out.set(fix(r), 0); out.set(fix(s), 32); return out;
  }
  async function check(a, challenge, rec){
    try {
      if (b64u(a.rawId) !== rec.id) return false;
      const r = a.response;
      const cd = JSON.parse(new TextDecoder().decode(r.clientDataJSON));
      if (cd.type !== 'webauthn.get' || cd.challenge !== b64u(challenge) || cd.origin !== location.origin) return false;
      const ad = new Uint8Array(r.authenticatorData);
      const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(location.hostname)));
      for (let i = 0; i < 32; i++) if (ad[i] !== rpHash[i]) return false;
      if ((ad[32] & 0x05) !== 0x05) return false;               /* présence (UP) + vérification de l'utilisateur (UV) */
      if (!rec.pk) return true;
      const cdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', r.clientDataJSON));
      const data = new Uint8Array(ad.length + 32); data.set(ad, 0); data.set(cdHash, ad.length);
      const sig = new Uint8Array(r.signature);
      if (rec.alg === -7){
        const key = await crypto.subtle.importKey('spki', unb64u(rec.pk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig), data);
      }
      if (rec.alg === -257){
        const key = await crypto.subtle.importKey('spki', unb64u(rec.pk), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
      }
      return false;
    } catch (e) { return false; }
  }
  async function assert(prfSalt){
    const u = await uid(); const rec = u ? store()[u] : null;
    if (!rec) return { ok: false, reason: 'error' };
    const challenge = rand(32);
    let a;
    try {
      const pk = { challenge, rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64u(rec.id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 };
      if (prfSalt) pk.extensions = { prf: { eval: { first: prfSalt } } };
      a = await navigator.credentials.get({ publicKey: pk });
    } catch (e) { return { ok: false, reason: (e && e.name === 'NotAllowedError') ? 'cancelled' : 'error' }; }
    if (!a) return { ok: false, reason: 'error' };
    if (!(await check(a, challenge, rec))) return { ok: false, reason: 'invalid' };
    /* 12.15.0 — PRF secret (WebAuthn extension, Safari iOS 18+): released by the authenticator only after Face ID; null when unsupported */
    let prf = null;
    try { const x = a.getClientExtensionResults ? a.getClientExtensionResults() : {}; const f = x && x.prf && x.prf.results && x.prf.results.first; if (f && f.byteLength >= 32) prf = new Uint8Array(f); } catch (e) {}
    return { ok: true, prf: prf, cid: rec.id };
  }

  /* --- feuille plein écran : orbe « Face ID » animée, un toucher pour lancer la lecture --- */
  const FACE = '<svg class="fid-face" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<g class="fc"><path d="M10 22v-6a6 6 0 0 1 6-6h6"/><path d="M42 10h6a6 6 0 0 1 6 6v6"/><path d="M54 42v6a6 6 0 0 1-6 6h-6"/><path d="M22 54h-6a6 6 0 0 1-6-6v-6"/></g>' +
    '<g class="ff"><path d="M23 25v4"/><path d="M41 25v4"/><path d="M32 25v9a2 2 0 0 1-2 2h-1"/><path d="M23 42c2.5 3 5.5 4.5 9 4.5s6.5-1.5 9-4.5"/></g>' +
    '<path class="fk" d="M19 33.5l9.5 9.5L46 22"/></svg>';
  function css(){
    if (document.getElementById('fid-css')) return;
    const s = document.createElement('style'); s.id = 'fid-css';
    s.textContent =
      '.fid{position:fixed;inset:0;z-index:1200;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:calc(18px + env(safe-area-inset-top,0px)) 24px calc(18px + env(safe-area-inset-bottom,0px));' +
        'background:radial-gradient(70% 50% at 50% 38%,color-mix(in srgb,var(--accent,#0B7F75) 18%,var(--bg,#fff)),var(--bg,#fff) 72%);color:var(--text,#0B1F1D);overflow-y:auto;animation:fidIn .34s cubic-bezier(.2,.9,.2,1) both}' +
      '.fid.out{opacity:0;transform:scale(1.03);transition:opacity .24s ease,transform .24s ease}' +
      '@keyframes fidIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}' +
      '.fid-chip{margin:18px 0 6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em;background:var(--accent-soft,rgba(20,184,166,.16));color:var(--accent,#0B7F75)}' +
      '.fid-orb{position:relative;width:148px;height:148px;margin:8px 0 18px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;cursor:pointer;color:var(--on-accent,#fff);background:var(--btn-grad,linear-gradient(180deg,#0C8579,#09665E));box-shadow:0 22px 50px -14px var(--btn-glow,rgba(11,127,117,.5)),inset 0 2px 0 rgba(255,255,255,.35);-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform .2s cubic-bezier(.34,1.56,.64,1)}' +
      '.fid-orb:active{transform:scale(.94)}' +
      '.fid-ring{position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent,#0B7F75);opacity:0;animation:fidRing 2.6s ease-out infinite;pointer-events:none}' +
      '.fid-ring.r2{animation-delay:.85s}.fid-ring.r3{animation-delay:1.7s}' +
      '@keyframes fidRing{0%{opacity:.5;transform:scale(1)}100%{opacity:0;transform:scale(1.75)}}' +
      '.fid-face{width:78px;height:78px;position:relative;z-index:1;overflow:visible}' +
      '.fid-face .fc path{animation:fidCorner 2.2s ease-in-out infinite;transform-origin:32px 32px}' +
      '@keyframes fidCorner{0%,100%{transform:scale(1)}50%{transform:scale(.9)}}' +
      '.fid-orb::after{content:"";position:absolute;left:30px;right:30px;top:36px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);box-shadow:0 0 14px rgba(255,255,255,.8);animation:fidScan 2.2s ease-in-out infinite;pointer-events:none}' +
      '@keyframes fidScan{0%,100%{transform:translateY(0);opacity:0}15%{opacity:1}50%{transform:translateY(74px);opacity:1}85%{opacity:0}}' +
      '.fid-face .fk{stroke-dasharray:60;stroke-dashoffset:60;opacity:0}' +
      '.fid.busy .fid-orb{animation:fidPulse 1s ease-in-out infinite}' +
      '@keyframes fidPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}' +
      '.fid.ok .fid-orb::after,.fid.ok .fid-ring{display:none}' +
      '.fid.ok .fid-face .fc,.fid.ok .fid-face .ff{opacity:0;transition:opacity .15s}' +
      '.fid.ok .fid-face .fk{opacity:1;animation:fidDraw .5s .1s ease-out forwards}' +
      '@keyframes fidDraw{to{stroke-dashoffset:0}}' +
      '.fid.ok .fid-orb{animation:fidBurst .6s cubic-bezier(.34,1.56,.64,1) both}' +
      '@keyframes fidBurst{0%{transform:scale(1)}50%{transform:scale(1.14)}100%{transform:scale(1)}}' +
      '.fid-title{font-size:23px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em}' +
      '.fid-sub{font-size:14.5px;line-height:1.5;color:var(--text-2,#4B6360);max-width:310px;margin:0 0 14px}' +
      '.fid-err{min-height:22px;font-size:13.5px;color:var(--danger,#ef4444);max-width:310px;margin:0 0 10px}' +
      '.fid-btn{min-width:230px;margin:0}' +
      '.fid-link{margin-top:6px;background:none;border:0;color:var(--accent,#0B7F75);font-size:14.5px;font-weight:700;padding:12px 16px;min-height:44px;cursor:pointer}' +
      '.fid-link.muted{color:var(--text-2,#4B6360);font-weight:600}' +
      '@media (prefers-reduced-motion:reduce){.fid,.fid-ring,.fid-face .fc path,.fid-orb::after,.fid.busy .fid-orb,.fid.ok .fid-orb{animation:none!important}.fid-ring,.fid-orb::after{display:none}.fid.ok .fid-face .fk{stroke-dashoffset:0;animation:none}}';
    document.head.appendChild(s);
  }
  function close(){ if (el){ try { el.remove(); } catch (e) {} el = null; } }

  function sheet(mode, o){
    o = o || {};
    css(); close();
    return new Promise(resolve => {
      const root = document.createElement('div'); el = root;
      root.className = 'fid'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      const purpose = tx(o.purpose || 'generic');
      root.innerHTML = '<div class="fid-logo">' + logoLockup(46) + '</div>' +
        '<div class="fid-chip">' + escapeHtml(purpose) + '</div>' +
        '<button type="button" class="fid-orb" id="fid-orb" aria-label="' + escapeHtml(tx('go')) + '"><i class="fid-ring r1"></i><i class="fid-ring r2"></i><i class="fid-ring r3"></i>' + FACE + '</button>' +
        '<h2 class="fid-title">' + escapeHtml(tx(mode === 'enroll' ? 'enrollTitle' : 'verifyTitle')) + '</h2>' +
        '<p class="fid-sub">' + escapeHtml(tx(mode === 'enroll' ? 'enrollSub' : 'verifySub')) + '</p>' +
        '<div class="fid-err" id="fid-err" role="alert"></div>' +
        '<button type="button" class="btn btn-primary fid-btn" id="fid-go">' + escapeHtml(tx('go')) + '</button>' +
        (mode === 'verify' && o.recover ? '<button type="button" class="fid-link" id="fid-rec">' + escapeHtml(tx('recover')) + '</button>' : '') +
        (o.cancel ? '<button type="button" class="fid-link muted" id="fid-cancel">' + escapeHtml(tx('cancel')) + '</button>' : '') +
        (o.logout ? '<button type="button" class="fid-link muted" id="fid-out">' + escapeHtml(tx('logout')) + '</button>' : '');
      document.body.appendChild(root);
      const $ = (id) => root.querySelector('#' + id);
      let busy = false, done = false, fails = 0;
      const finish = (v) => { if (done) return; done = true; root.classList.add('out'); setTimeout(() => { try { root.remove(); } catch (e) {} if (el === root) el = null; }, 260); resolve(v); };
      async function run(){
        if (busy || done || root.classList.contains('ok')) return;     /* a second tap during the success animation must not create a second key */
        busy = true; root.classList.add('busy'); $('fid-err').textContent = ''; $('fid-go').disabled = true;
        const r = mode === 'enroll' ? await enroll() : await assert(o.prfSalt || null);
        busy = false; root.classList.remove('busy'); $('fid-go').disabled = false;
        if (r.ok){ root.classList.add('ok'); try { UIKit.haptic('success'); } catch (e) {} setTimeout(() => finish({ ok: true, prf: r.prf || null, cid: r.cid || null }), 700); return; }
        $('fid-err').textContent = tx(r.reason === 'cancelled' ? 'errCancelled' : r.reason === 'invalid' ? 'errInvalid' : 'errGeneric');
        $('fid-go').textContent = tx('retry');
        /* Safety valve: the device says it supports biometrics but the key cannot be created after 3 tries -> do not lock the user out */
        fails++;
        if (mode === 'enroll' && fails >= 3 && !$('fid-skip')){
          const b = document.createElement('button'); b.type = 'button'; b.className = 'fid-link muted'; b.id = 'fid-skip'; b.textContent = tx('skip');
          b.onclick = () => finish({ ok: true, skipped: 'enroll_failed' });
          $('fid-go').insertAdjacentElement('afterend', b);
        }
        try { UIKit.haptic('error'); } catch (e) {}
      }
      $('fid-orb').onclick = run; $('fid-go').onclick = run;
      if ($('fid-rec')) $('fid-rec').onclick = () => finish({ ok: false, recover: true });
      if ($('fid-cancel')) $('fid-cancel').onclick = () => finish({ ok: false, cancelled: true });
      if ($('fid-out')) $('fid-out').onclick = () => { finish({ ok: false, loggedOut: true }); try { o.logout(); } catch (e) {} };
      /* un toucher vient d'avoir lieu (ex. « Confirmer » le transfert) : on lance tout de suite, sinon on attend le toucher sur l'orbe */
      try { if (navigator.userActivation && navigator.userActivation.isActive) run(); } catch (e) {}
    });
  }

  /* Porte de confirmation : résout { ok:true } (confirmé ou ignoré), { ok:false, cancelled } ou { ok:false, recover } */
  async function gate(o){
    o = o || {};
    if (!(await supported())) return { ok: true, skipped: 'unsupported' };
    const u = await uid(); if (!u) return { ok: true, skipped: 'no_user' };
    const rec = store()[u];
    if (!rec) return sheet('enroll', o);
    return sheet('verify', Object.assign({ recover: true }, o));
  }
  /* Nouvelle clé (après vérification du PIN) */
  async function reenroll(o){
    if (!(await supported())) return { ok: true, skipped: 'unsupported' };
    return sheet('enroll', o || {});
  }
  function warm(){ supported(); }
  /* the stored key of this account on this device: { id, prf } or null */
  async function record(){ const u = await uid(); const r = u ? store()[u] : null; return r ? { id: r.id, prf: r.prf === true } : null; }
  return { gate, reenroll, supported, info, warm, record, name: nm, _check: check };
})();
