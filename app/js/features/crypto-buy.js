'use strict';

/* ============================================================
   LOCAL TRANSACTION SINK — disabled.
   Ledger rows can only be created by SQL functions that move real money.
   ============================================================ */
function blockUnsupported(){
  toast(t('errors.NOT_AVAILABLE'), 'error');
  return true;
}
async function recordLocalTransaction(){ throw new Error('LEDGER_WRITE_FORBIDDEN'); }

/* ============================================================
   CRYPTO BUY — executed SERVER-SIDE by crypto_buy(): debits OMR, credits the wallet,
   writes transaction + notification atomically. The client only sends (asset, OMR amount, idempotency key).
   Signature verified on the database: crypto_buy(p_asset text, p_fiat_amount numeric, p_idempotency_key text) -> jsonb
   { ok, transaction_id, reference, asset, amount, fee, fiat_amount, rate }.
   ============================================================ */
const CryptoBuyEngine = (() => {
  const inflight = new Set();
  /* Generic server call. Every money movement is done by the SQL function; the client sends only intent + idempotency key. */
  async function call(fn, args, idemKey, pinGrant){
    if (!supabaseReady) return { ok:false, error:'errors.UNKNOWN_ERROR' };
    const idem = idemKey || uuid();
    if (inflight.has(idem)) return { ok:false, error:'errors.DUPLICATE' };
    inflight.add(idem);
    try {
      const { data, error } = await sb.rpc(fn, Object.assign({}, args, { p_idempotency_key: idem, p_pin_grant: pinGrant || null }));
      if (error){
        const m = String(error.message || '').toLowerCase();
        if (m.includes('pin_required')) return { ok:false, error:'errors.PIN_REQUIRED' };
        if (m.includes('insufficient')) return { ok:false, error:'errors.INSUFFICIENT_BALANCE' };
        /* 12.3.7 : refus précis du serveur à l'envoi crypto (au lieu de « Une erreur est survenue ») */
        if (m.includes('invalid_address')) return { ok:false, error:'errors.INVALID_ADDRESS' };
        if (m.includes('self_transfer')) return { ok:false, error:'errors.SELF_TRANSFER' };
        if (m.includes('address_network_mismatch')) return { ok:false, error:'errors.ADDRESS_NETWORK_MISMATCH' };
        if (m.includes('unsupported_asset_network')) return { ok:false, error:'errors.UNSUPPORTED_NETWORK' };
        if (m.includes('invalid_amount')) return { ok:false, error:'errors.INVALID_AMOUNT' };
        console.error(fn, error);
        return { ok:false, error:'errors.UNKNOWN_ERROR' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { ok:false, error:'errors.UNKNOWN_ERROR' };
      try { await AuthEngine.hydrateRuntime(); } catch(e){}
      return { ok:true, data:row };
    } catch(e){
      console.error(e);
      return { ok:false, error:'errors.UNKNOWN_ERROR' };
    } finally { setTimeout(() => inflight.delete(idem), 1500); }
  }
  /* Signatures verified on the database (all return jsonb with ok, transaction_id, reference, ...):
     crypto_buy(p_asset, p_fiat_amount, key)  crypto_sell(p_asset, p_amount, key)  crypto_swap(p_from, p_to, p_amount, key) */
  const buy  = ({ symbol, amountOMR, idemKey, pinGrant }) => call('crypto_buy',  { p_asset: String(symbol).toUpperCase(), p_fiat_amount: Number(amountOMR) }, idemKey, pinGrant);
  const sell = ({ symbol, amount, idemKey, pinGrant })    => call('crypto_sell', { p_asset: String(symbol).toUpperCase(), p_amount: Number(amount) }, idemKey, pinGrant);
  const swap = ({ from, to, amount, idemKey, pinGrant })  => call('crypto_swap', { p_from: String(from).toUpperCase(), p_to: String(to).toUpperCase(), p_amount: Number(amount) }, idemKey, pinGrant);
  /* crypto_send_external(p_asset, p_network, p_address, p_memo, p_amount, key, pin): the SERVER decides.
     - address belongs to a Friendly Pay wallet -> instant internal transfer, recipient credited, status CONFIRMED, fee 0
     - unknown address                 -> debit amount + network fee, status PENDING (blockchain validation) */
  const sendExternal = ({ symbol, network, address, memo, amount, idemKey, pinGrant }) => call('crypto_send_external',
    { p_asset: String(symbol).toUpperCase(), p_network: String(network).toLowerCase(), p_address: AddressEngine.clean(address), p_memo: memo || null, p_amount: Number(amount) }, idemKey, pinGrant);
  /* crypto_to_bank(p_asset, p_network, p_amount, p_bank_id, p_bank_name, p_currency, key, pin): server debits the wallet (fee 1.5%), writes a PENDING CRYPTO_TO_BANK transaction + notification. */
  const toBank = ({ symbol, network, amount, bankId, bankName, currency, idemKey, pinGrant }) => call('crypto_to_bank',
    { p_asset: String(symbol).toUpperCase(), p_network: String(network || '').toLowerCase(), p_amount: Number(amount), p_bank_id: String(bankId || ''), p_bank_name: String(bankName || ''), p_currency: String(currency || '').toUpperCase() }, idemKey, pinGrant);
  /* get_receive_address creates the wallet row if needed and returns the REAL deposit address (the one other Friendly Pay users can send to). */
  async function receiveAddress(symbol, network){
    if (!supabaseReady) return null;
    try {
      const { data, error } = await sb.rpc('get_receive_address', { p_asset: String(symbol).toUpperCase(), p_network: String(network).toLowerCase() });
      if (error){ console.error('get_receive_address', error); return null; }
      try { await AuthEngine.hydrateRuntime(); } catch(e){}
      return data || null;
    } catch(e){ console.error(e); return null; }
  }
  return { buy, sell, swap, sendExternal, toBank, receiveAddress };
})();
async function recordLocalReceipt(rc){
  const uid = UserContext.requireCtx().uid;
  const id = rc.id || ID.receipt();
  const payload = Object.assign({}, rc, { id, createdAt: rc.createdAt || Date.now() });
  await UserDataEngine.writeSub(uid, 'receipts', id, payload);
  Runtime.receipts.push(payload);
  return payload;
}

