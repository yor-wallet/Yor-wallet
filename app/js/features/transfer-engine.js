'use strict';

const TransferEngine = (() => {
  const inflight = new Set();
  /* find_user_by_yor_id() : returns only YOR ID / display name / country / photo */
  async function resolveYorId(yorId){
    if (!supabaseReady) return null;
    const key = normId(yorId);          /* FRD-… / FRIENDLY-… / YOR-… all find the same account */
    if (!key) return null;
    const { data, error } = await sb.rpc('find_user_by_yor_id', { p_yor_id: key });
    const r = Array.isArray(data) ? data[0] : data;
    if (error || !r) return null;
    return { uid: null, userId: '', yorId: r.yor_id, name: r.display_name || dispId(r.yor_id),
             phone: '', country: r.country || 'OM', role: 'user', photo: r.photo || null };
  }
  /* 12.3.3 : the two SMS (sender + recipient) of a transfer leave AUTOMATICALLY and IMMEDIATELY. The database itself calls the
     send-notice function the moment the transfer is recorded (same transaction, no button, no confirmation, no delay), and a
     per-minute sweep retries a failed send. This call is the BACKUP path: it runs right after the server answered (before the
     balances are reloaded), and once more 3 s later if the first attempt could not reach the server. A duplicate is harmless:
     the server claims every message once. The transfer is ALREADY recorded when this runs, so it can never make the transfer
     fail: every error is swallowed and the state of the message stays readable on the receipt. The call carries the signed-in
     user's own token; the server only accepts the sender of that transaction. The same transaction is never flushed twice at
     the same time. */
  const flushing = new Map();
  function flushNotices(txId){
    try {
      if (!supabaseReady || !txId || !sb || !sb.functions || typeof sb.functions.invoke !== 'function') return Promise.resolve(false);
      const key = String(txId);
      if (flushing.has(key)) return flushing.get(key);
      const attempt = () => Promise.resolve()
        .then(() => sb.functions.invoke('send-notice', { body: { tx_id: key } }))
        .then(r => !(r && r.error), () => false);
      const p = attempt()
        .then(ok => ok ? true : new Promise(res => setTimeout(res, 3000)).then(attempt))
        .then(ok => { flushing.delete(key); return ok; }, () => { flushing.delete(key); return false; });
      flushing.set(key, p);
      return p;
    } catch(e){ return Promise.resolve(false); }
  }
  /* idemKey is generated ONCE per review screen, so a double tap / retry replays the same request */
  async function sendFiat({ toYorId, amount, currency, idemKey, note, pinGrant }){
    if (!supabaseReady) return { ok:false, error:'errors.UNKNOWN_ERROR' };
    const idem = idemKey || uuid();
    const lock = idem;
    if (inflight.has(lock)) return { ok:false, error:'errors.DUPLICATE' };
    inflight.add(lock);
    try {
      const { data, error } = await sb.rpc('transfer_fiat', {
        p_to_yor_id: toYorId, p_amount: Number(amount), p_currency: currency || 'OMR',
        p_note: note || null, p_idempotency_key: idem, p_pin_grant: pinGrant || null
      });
      if (error){
        const m = String(error.message || '').toLowerCase();
        if (m.includes('pin_required')) return { ok:false, error:'errors.PIN_REQUIRED' };
        if (m.includes('insufficient')) return { ok:false, error:'errors.INSUFFICIENT_BALANCE' };
        if (m.includes('recipient_not_found') || m.includes('recipient not found')) return { ok:false, error:'errors.RECIPIENT_NOT_FOUND' };
        if (m.includes('self')) return { ok:false, error:'errors.SELF_TRANSFER' };
        if (m.includes('sender_account_missing')) return { ok:false, error:'errors.INSUFFICIENT_BALANCE' };
        console.error('transfer_fiat', error);
        return { ok:false, error:'errors.UNKNOWN_ERROR' };
      }
      if (!data || !data.transaction_id) return { ok:false, error:'errors.DUPLICATE' };
      flushNotices(data.transaction_id);                         /* immediately, not awaited: the confirmation never waits for a message */
      try { await AuthEngine.hydrateRuntime(); } catch(e){}      /* fresh balances + history */
      return { ok:true, data:{ ok:true, transactionId: data.transaction_id, transferId: data.reference,
               reference: data.reference, balanceAfter: data.balance_after } };
    } catch(e){
      console.error(e);
      return { ok:false, error:'errors.UNKNOWN_ERROR' };
    } finally { setTimeout(() => inflight.delete(lock), 1500); }
  }
  /* 12.14.0 — a failure is CERTAIN only when the database answered with an error (it then rolled the whole operation back).
     A request that never got an answer (network cut, timeout, gateway error) is UNCERTAIN: the server may have recorded the
     transfer. Such a request is never sent again automatically; the person checks its status (checkExternal) first. */
  function isUncertain(error, status){
    if (!error) return false;
    const code = String(error.code == null ? '' : error.code);
    if (/^[0-9A-Z]{5}$/.test(code)) return false;                                   /* SQLSTATE: the database refused and rolled back */
    if (status >= 500 || status === 0) return true;                                 /* gateway / no HTTP answer */
    return /fetch|network|load failed|timed? ?out|abort|connection|offline/i.test(String(error.message || ''));
  }
  /* Reads the outcome of an earlier request WITHOUT any risk of creating a transfer: the server replays a stored idempotency key
     BEFORE it consumes a PIN grant, and this call carries no grant, so an unknown key always ends in "pin_required".
     -> { state:'confirmed', data } | { state:'not_found' } | { state:'unknown' } */
  async function checkExternal({ amount, destCurrency, provider, beneficiary, idemKey }){
    if (!supabaseReady || !idemKey) return { state:'unknown' };
    try {
      const { data, error } = await sb.rpc('fiat_send_external', {
        p_amount: Number(amount), p_dest_currency: destCurrency, p_provider: provider,
        p_beneficiary: beneficiary, p_idempotency_key: idemKey, p_pin_grant: null
      });
      if (error) return /pin_required/i.test(String(error.message || '')) ? { state:'not_found' } : { state:'unknown' };
      if (!data || !data.transaction_id) return { state:'unknown' };
      try { await AuthEngine.hydrateRuntime(); } catch(e){}
      return { state:'confirmed', data:{ transactionId: data.transaction_id, reference: data.reference, status: data.status,
        amount: data.amount, fee: data.fee, vat: data.vat, total: data.total,
        exchangeRate: data.exchange_rate, destinationAmount: data.destination_amount, destinationCurrency: data.destination_currency } };
    } catch(e){ return { state:'unknown' }; }
  }
  /* International transfer: validated and recorded SERVER-SIDE (fiat_send_external). Nothing is created locally. */
  async function sendExternal({ amount, destCurrency, provider, beneficiary, idemKey, pinGrant }){
    if (!supabaseReady) return { ok:false, error:'errors.UNKNOWN_ERROR' };
    const idem = idemKey || uuid();
    if (inflight.has(idem)) return { ok:false, error:'errors.DUPLICATE' };
    inflight.add(idem);
    try {
      const res0 = await sb.rpc('fiat_send_external', {
        p_amount: Number(amount), p_dest_currency: destCurrency, p_provider: provider,
        p_beneficiary: beneficiary, p_idempotency_key: idem, p_pin_grant: pinGrant || null
      });
      const data = res0 && res0.data, error = res0 && res0.error;
      if (error && isUncertain(error, res0.status)) return { ok:false, uncertain:true, error:'errors.UNCERTAIN' };
      if (error){
        const m = String(error.message || '').toLowerCase();
        if (m.includes('pin_required')) return { ok:false, error:'errors.PIN_REQUIRED' };
        if (m.includes('insufficient')) return { ok:false, error:'errors.INSUFFICIENT_BALANCE' };
        if (m.includes('missing_field')) return { ok:false, error:'errors.MISSING_FIELD' };
        if (m.includes('limit_')) return { ok:false, error:'errors.LIMIT' };
        console.error('fiat_send_external', error);
        return { ok:false, error:'errors.UNKNOWN_ERROR' };
      }
      if (!data || !data.transaction_id) return { ok:false, error:'errors.DUPLICATE' };
      flushNotices(data.transaction_id);                         /* immediately, not awaited: the confirmation never waits for a message */
      try { await AuthEngine.hydrateRuntime(); } catch(e){}
      return { ok:true, data:{ transactionId: data.transaction_id, reference: data.reference, status: data.status,
        amount: data.amount, fee: data.fee, vat: data.vat, total: data.total,
        exchangeRate: data.exchange_rate, destinationAmount: data.destination_amount, destinationCurrency: data.destination_currency } };
    } catch(e){
      console.error(e);
      return { ok:false, uncertain:true, error:'errors.UNCERTAIN' };     /* no answer read: the server may have recorded it */
    } finally { setTimeout(() => inflight.delete(idem), 1500); }
  }
  return { resolveYorId, sendFiat, sendExternal, checkExternal, flushNotices, isUncertain };
})();

