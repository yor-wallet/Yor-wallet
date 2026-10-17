'use strict';

/* ============================================================
   TRANSFER ENGINE — Postgres RPC (atomic debit + credit, server-authoritative)
   ============================================================ */
const PinEngine = (() => {
  let busy = false;
  const unwrap = (r) => (Array.isArray(r.data) ? r.data[0] : r.data);
  /* Modal that collects the PIN. submit(pin, pin2) -> { ok, value } | { ok:false, msg }.
     Resolves with the value on success, or null if the user cancels. The PIN is never stored. */
  function prompt(mode, submit){
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
          $('ps-title').textContent = t(step === 0 ? 'pin.enterTitle' : step === 1 ? 'pin.createTitle' : 'pin.confirmLabel');
          $('ps-sub').textContent = step === 0 ? t('pin.enterSub') : step === 1 ? t('pin.createSub') : '';
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
      let f = null;
      try { f = await FaceId.gate({ purpose:'transfer', cancel:true }); } catch(e){ f = { ok:true, skipped:'error' }; }
      if (!f.ok && f.cancelled) return { ok:false, cancelled:true };
      const r = await authorizeCore();
      /* Face ID could not be used (recover): the PIN just verified lets the device create a fresh Face ID key */
      if (r.ok && f && f.recover){ try { await FaceId.reenroll({ purpose:'transfer', cancel:false }); } catch(e){} }
      return r;
    } catch(e){
      console.error(e);
      return { ok:false, error:'errors.UNKNOWN_ERROR' };
    } finally { busy = false; }
  }
  async function authorizeCore(){
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
      return { ok:true, grant:v.value };
    }
    const grant = await prompt('enter', (pin) => (/^[0-9]{6}$/.test(pin || '') ? verify(pin) : { ok:false, msg:t('pin.format') }));
    if (!grant) return { ok:false, cancelled:true };
    return { ok:true, grant };
  }
  /* true / false, or null when the status cannot be read */
  async function hasPin(){
    if (!supabaseReady) return null;
    const st = await sb.rpc('pin_status');
    if (st.error) return null;
    const d = unwrap(st) || {};
    return !!d.has_pin;
  }
  return { authorize, verify, hasPin };
})();

