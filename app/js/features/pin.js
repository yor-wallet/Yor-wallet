'use strict';

/* ============================================================
   TRANSFER ENGINE — Postgres RPC (atomic debit + credit, server-authoritative)
   ============================================================ */
const PinEngine = (() => {
  let busy = false;
  /* ---------- 12.15.0 — Face ID OR the code for transfers ----------
     The server only authorises a transfer with a grant from verify_pin (attempt counter, 15-min lock): that stays the ONLY
     server check. After a transfer confirmed with the code AND Face ID, the code is kept on this device encrypted (AES-GCM)
     with a key the authenticator releases only after Face ID (WebAuthn PRF). Next time, Face ID decrypts it and the app
     calls verify_pin itself: no typing. No PRF (older iOS, other devices), Face ID cancelled or failing -> the code is typed.
     The vault is erased on sign-out, after a code change, and as soon as the server rejects the stored code. */
  const VAULT = 'friendly_pin_vault_v1';
  const SALT_TXT = 'friendly-pay/pin-vault/v1';
  const vRead = () => { try { return JSON.parse(localStorage.getItem(VAULT) || '{}') || {}; } catch(e){ return {}; } };
  const vWrite = (o) => { try { localStorage.setItem(VAULT, JSON.stringify(o)); } catch(e){} };
  const b64 = (u8) => { let x = ''; for (let i = 0; i < u8.length; i++) x += String.fromCharCode(u8[i]); return btoa(x); };
  const unb64 = (str) => { const bin = atob(str), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
  async function prfSalt(){ return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT_TXT))); }
  async function aesKey(prf){
    const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('pin-vault') }, base, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
  }
  function ctxUid(){ try { const c = UserContext.get(); return c && c.uid ? c.uid : null; } catch(e){ return null; } }
  async function vaultSave(pin, prf, cid){
    const u = ctxUid(); if (!u || !prf || !/^[0-9]{6}$/.test(pin)) return false;
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await aesKey(prf), new TextEncoder().encode(pin)));
      const v = vRead(); v[u] = { iv: b64(iv), ct: b64(ct), cid: cid || null, at: Date.now() }; vWrite(v); return true;
    } catch(e){ return false; }
  }
  async function vaultOpen(prf, cid){
    const u = ctxUid(); const rec = u ? vRead()[u] : null;
    if (!rec || !prf || (rec.cid && cid && rec.cid !== cid)) return null;
    try {
      const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: unb64(rec.iv) }, await aesKey(prf), unb64(rec.ct));
      const pin = new TextDecoder().decode(pt);
      return /^[0-9]{6}$/.test(pin) ? pin : null;
    } catch(e){ return null; }
  }
  function forget(uid){ const u = uid || ctxUid(); const v = vRead(); if (u && v[u]){ delete v[u]; vWrite(v); } }
  function hasVault(){ const u = ctxUid(); return !!(u && vRead()[u]); }
  const unwrap = (r) => (Array.isArray(r.data) ? r.data[0] : r.data);
  /* Modal that collects the PIN. submit(pin, pin2) -> { ok, value } | { ok:false, msg }.
     Resolves with the value on success, or null if the user cancels. The PIN is never stored. */
  function prompt(mode, submit, labels){
    labels = labels || {};
    return new Promise(resolve => {
      let done = false, entry = '', first = null, busy = false, keyH = null;
      const finish = (v) => { if (done) return; done = true; resolve(v); };
      const create = mode === 'create';
      let step = create ? 1 : 0;
      const close0 = R.overlay.open(
        '<div class="ps"><div class="ps-title" id="ps-title"></div><p class="ps-sub" id="ps-sub"></p>' +
        '<div class="ps-dots fk-dots" id="ps-dots" aria-hidden="true">' + '<i></i>'.repeat(6) + '</div>' +
        '<div class="ps-err" id="ps-err" role="alert"></div>' +
        Keypad.padHtml('ps') +
        '<button class="ps-cancel" id="ps-cancel" type="button">' + escapeHtml(t('pin.cancel')) + '</button></div>',
        { kind:'sheet', onClose: () => { if (keyH){ document.removeEventListener('keydown', keyH); keyH = null; } finish(null); } });
      const close = () => { if (keyH){ document.removeEventListener('keydown', keyH); keyH = null; } close0(); };
      setTimeout(() => {
        const $ = id => document.getElementById(id);
        if (!$('ps-title')) return;
        const paint = () => {
          $('ps-title').textContent = labels['t' + step] || t(step === 0 ? 'pin.enterTitle' : step === 1 ? 'pin.createTitle' : 'pin.confirmLabel');
          $('ps-sub').textContent = labels['s' + step] != null ? labels['s' + step] : (step === 0 ? t('pin.enterSub') : step === 1 ? t('pin.createSub') : '');
          document.querySelectorAll('#ps-dots i').forEach((d, n) => d.classList.toggle('on', n < entry.length));
        };
        const fail = (msg) => {
          $('ps-err').textContent = msg || t('errors.UNKNOWN_ERROR');
          const d = $('ps-dots'); d.classList.remove('ps-shake'); void d.offsetWidth; d.classList.add('ps-shake');
          try { UIKit.haptic('error'); } catch(e){}
          entry = ''; busy = false; paint();
        };
        const go = async () => {
          busy = true;
          let r;
          try { r = await submit(create ? first : entry, create ? entry : null); } catch(e){ r = { ok:false, msg:t('errors.UNKNOWN_ERROR') }; }
          if (r && r.ok){ finish(r.value); close(); return; }
          if (create) { first = null; step = 1; }
          fail(r && r.msg);
        };
        const press = (k, btn) => {
          if (busy || done) return;
          $('ps-err').textContent = '';
          if (k === 'del'){ entry = entry.slice(0, -1); paint(); return; }
          if (entry.length >= 6) return;
          entry += k; try { UIKit.haptic('tap'); } catch(e){}
          paint();
          if (btn) Keypad.fly(btn, $('ps-dots'), entry.length - 1);
          if (entry.length < 6) return;
          Keypad.bloom($('ps-dots'));
          if (create && step === 1){ first = entry; entry = ''; step = 2; paint(); return; }
          go();
        };
        Keypad.bind(document.querySelector('.ps'), press);
        $('ps-cancel').onclick = () => { finish(null); close(); };
        keyH = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
        document.addEventListener('keydown', keyH);
        paint();
      }, 60);
    });
  }
  async function verify(pin){
    const r = await sb.rpc('verify_pin', { p_pin: pin });
    if (r.error) return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
    const d = unwrap(r) || {};
    if (d.ok && d.grant) return { ok:true, value:d.grant };
    if (d.error === 'wrong_pin') return { ok:false, msg:tf('pin.wrong', { n: d.remaining != null ? d.remaining : 0 }) };
    if (d.error === 'pin_locked'){
      const mins = Math.max(1, Math.ceil((new Date(d.locked_until).getTime() - Date.now()) / 60000));
      return { ok:false, msg:tf('pin.locked', { m: mins }) };
    }
    return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
  }
  /* Transfer / card-secret confirmation (12.9.0): Face ID first (mandatory when the device has biometrics),
     then the 6-digit PIN, which is the server-verified factor that yields the one-time grant.
     Resolves { ok:true, grant } (one-time, valid ~2 min) or { ok:false, cancelled? , error? } */
  async function authorize(){
    if (!supabaseReady) return { ok:false, error:'errors.UNKNOWN_ERROR' };
    if (busy) return { ok:false, cancelled:true };
    busy = true;
    try {
      let f = null, salt = null;
      try { salt = await prfSalt(); } catch(e){}
      try { f = await FaceId.gate({ purpose:'transfer', cancel:true, prfSalt: salt }); } catch(e){ f = { ok:false, skipped:'error' }; }
      /* 1) Face ID confirmed and the code is in the vault: the server checks it (verify_pin), nothing to type */
      if (f && f.ok && f.prf){
        const pin = await vaultOpen(f.prf, f.cid);
        if (pin){
          const v = await verify(pin);
          if (v.ok) return { ok:true, grant: v.value, via:'faceid' };
          forget();                                   /* changed elsewhere or locked: never retried silently; the code is asked below */
        }
      }
      /* 2) otherwise the 6-digit code (Face ID cancelled, failed, not available, or first time on this device) */
      let typed = null;
      const r = await authorizeCore(pin => { typed = pin; });
      if (r.ok && typed && f && f.ok){
        if (f.prf) await vaultSave(typed, f.prf, f.cid);        /* next time Face ID alone is enough */
        else if (f.skipped !== 'unsupported'){
          /* key created before 12.15.0 without PRF: one new Face ID key so the next transfers can use Face ID alone */
          try {
            const rec = await FaceId.record(), u = ctxUid(), k = 'friendly_prf_upgrade_v1';
            let tried = {}; try { tried = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch(e){}
            if (rec && !rec.prf && u && !tried[u]){ tried[u] = Date.now(); try { localStorage.setItem(k, JSON.stringify(tried)); } catch(e){} await FaceId.reenroll({ purpose:'transfer', cancel:true }); }
          } catch(e){}
        }
      }
      typed = null;
      /* Face ID could not be used (recover): the PIN just verified lets the device create a fresh Face ID key */
      if (r.ok && f && f.recover){ try { await FaceId.reenroll({ purpose:'transfer', cancel:false }); } catch(e){} }
      return r;
    } catch(e){
      console.error(e);
      return { ok:false, error:'errors.UNKNOWN_ERROR' };
    } finally { busy = false; }
  }
  async function authorizeCore(onPin){
    const st = await sb.rpc('pin_status');
    if (st.error) return { ok:false, error:'errors.UNKNOWN_ERROR' };
    const s = unwrap(st) || {};
    if (!s.has_pin){
      const created = await prompt('create', async (pin, pin2) => {
        if (!/^[0-9]{6}$/.test(pin || '')) return { ok:false, msg:t('pin.format') };
        if (pin !== pin2) return { ok:false, msg:t('pin.mismatch') };
        const r = await sb.rpc('set_pin', { p_pin: pin });
        if (r.error){
          const m = String(r.error.message || '').toLowerCase();
          if (m.includes('weak_pin')) return { ok:false, msg:t('pin.weak') };
          if (m.includes('invalid_pin_format')) return { ok:false, msg:t('pin.format') };
          if (!m.includes('pin_exists')) return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
        }
        return { ok:true, value:pin };
      });
      if (!created) return { ok:false, cancelled:true };
      const v = await verify(created);
      if (!v.ok) return { ok:false, error:'errors.UNKNOWN_ERROR' };
      if (onPin) onPin(created);
      return { ok:true, grant:v.value };
    }
    const grant = await prompt('enter', async (pin) => {
      if (!/^[0-9]{6}$/.test(pin || '')) return { ok:false, msg:t('pin.format') };
      const v = await verify(pin);
      if (v.ok && onPin) onPin(pin);
      return v;
    });
    if (!grant) return { ok:false, cancelled:true };
    return { ok:true, grant };
  }
  /* 12.14.0 — change the personal code with the server function change_pin(p_old, p_new): the current code is checked first by the
     server (verify_pin: same attempt counter and lock as for a transfer), then the new code is typed twice. Nothing is stored here.
     Resolves { ok:true } | { ok:false, cancelled? , msg? } */
  async function change(){
    if (!supabaseReady) return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
    if (busy) return { ok:false, cancelled:true };
    busy = true;
    try {
      const has = await hasPin();
      if (has === null) return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
      if (!has){
        /* no code yet: the usual creation (same rules as before the first transfer) */
        const created = await prompt('create', async (pin, pin2) => {
          if (!/^[0-9]{6}$/.test(pin || '')) return { ok:false, msg:t('pin.format') };
          if (pin !== pin2) return { ok:false, msg:t('pin.mismatch') };
          const r = await sb.rpc('set_pin', { p_pin: pin });
          if (r.error){ const m = String(r.error.message || '').toLowerCase(); return { ok:false, msg:t(m.includes('weak_pin') ? 'pin.weak' : m.includes('invalid_pin_format') ? 'pin.format' : 'errors.UNKNOWN_ERROR') }; }
          return { ok:true, value:true };
        });
        return created ? { ok:true } : { ok:false, cancelled:true };
      }
      let oldPin = null;
      const okOld = await prompt('enter', async (pin) => {
        if (!/^[0-9]{6}$/.test(pin || '')) return { ok:false, msg:t('pin.format') };
        const v = await verify(pin);
        if (v.ok){ oldPin = pin; return { ok:true, value:true }; }
        return v;
      }, { t0: t('px.pinOldT'), s0: t('px.pinOldS') });
      if (!okOld || !oldPin) return { ok:false, cancelled:true };
      const done = await prompt('create', async (pin, pin2) => {
        if (!/^[0-9]{6}$/.test(pin || '')) return { ok:false, msg:t('pin.format') };
        if (pin !== pin2) return { ok:false, msg:t('pin.mismatch') };
        if (pin === oldPin) return { ok:false, msg:t('px.pinSame') };
        const r = await sb.rpc('change_pin', { p_old: oldPin, p_new: pin });
        if (r.error){ const m = String(r.error.message || '').toLowerCase(); return { ok:false, msg:t(m.includes('weak_pin') ? 'pin.weak' : m.includes('invalid_pin_format') ? 'pin.format' : 'errors.UNKNOWN_ERROR') }; }
        const d = unwrap(r) || {};
        if (d.ok) return { ok:true, value:true };
        if (d.error === 'pin_locked') return { ok:false, msg:tf('pin.locked', { m: 15 }) };
        return { ok:false, msg:t('errors.UNKNOWN_ERROR') };
      }, { t1: t('px.pinNewT'), s1: t('pin.createSub'), t2: t('pin.confirmLabel') });
      oldPin = null;
      if (done) forget();
      return done ? { ok:true } : { ok:false, cancelled:true };
    } catch(e){ console.error(e); return { ok:false, msg:t('errors.UNKNOWN_ERROR') }; }
    finally { busy = false; }
  }
  /* true / false, or null when the status cannot be read */
  async function hasPin(){
    if (!supabaseReady) return null;
    const st = await sb.rpc('pin_status');
    if (st.error) return null;
    const d = unwrap(st) || {};
    return !!d.has_pin;
  }
  return { authorize, verify, hasPin, change, forget, hasVault, _vault: { save: vaultSave, open: vaultOpen } };
})();

