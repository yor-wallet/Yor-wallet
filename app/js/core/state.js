'use strict';

/* ============================================================
   STATE (flow drafts, not user data)
   ============================================================ */
const TX_STATE = { country:null, provider:null, beneficiary:null, amount:0, breakdown:{amount:0,fee:0,vat:0,total:0}, fx:null, serviceId:null };
function txReset(){ Object.assign(TX_STATE, { country:null, provider:null, beneficiary:null, amount:0, breakdown:{amount:0,fee:0,vat:0,total:0}, fx:null, serviceId:null }); }

const CRYPTO_FLOW = { send:{}, fromMain:{}, sell:{}, swap:{}, toBank:{}, receive:{}, pending:null };
function resetCryptoFlow(){
  CRYPTO_FLOW.send = { asset:null, network:null, address:null, memo:null, amount:0 };
  CRYPTO_FLOW.fromMain = { asset:null, fiatAmount:0, cryptoAmount:0, rate:0, fee:0 };
  CRYPTO_FLOW.sell = { asset:null, amount:0 };
  CRYPTO_FLOW.swap = { fromAsset:null, toAsset:null, amount:0 };
  CRYPTO_FLOW.toBank = { asset:null, network:null, amount:0, accountId:null, bankId:null, bankName:null, currency:null, fiatEquiv:0, fee:0, days:0 };
  CRYPTO_FLOW.receive = { asset:null, network:null };
  CRYPTO_FLOW.pending = null;
}
resetCryptoFlow();

const CARD_STATE = { numberVisible:false, cvvVisible:false, numberTimer:null, cvvTimer:null };
function resetCardState(){
  CARD_STATE.numberVisible = false; CARD_STATE.cvvVisible = false;
  if (CARD_STATE.numberTimer) clearTimeout(CARD_STATE.numberTimer);
  if (CARD_STATE.cvvTimer) clearTimeout(CARD_STATE.cvvTimer);
  CARD_STATE.numberTimer = null; CARD_STATE.cvvTimer = null;
}
function maskCardNumber(num){ const s = String(num || ''); return '•••• •••• •••• ' + s.slice(-4); }
function formatCardNumber(num){ return String(num || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim(); }

const ProcessingEngine = (() => {
  let state = null, _globalLock = false;
  function acquireLock(){ if (_globalLock) return false; _globalLock = true; return true; }
  function releaseLock(){ _globalLock = false; }
  function setPhase(p){ if (typeof SendAnim !== 'undefined') return SendAnim.setPhase(p); const v = document.querySelector('.proc-view'); if (v) v.setAttribute('data-phase', p); return Promise.resolve(); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* 12.12.0 — the work starts AT ONCE and the screen follows what really happens: "secure" (first second), "send" (until the server answers,
     at least ~2.4 s in total so the three states can be read), then "success" only if the work answered { ok:true }, otherwise "fail".
     work() returns { ok, error?, ... }; the lock is released at the end and the result is returned to the caller, who then leaves the screen. */
  async function run(work, opts){
    opts = opts || {};
    const minMs = opts.minMs != null ? opts.minMs : 2400;
    const t0 = Date.now();
    const job = Promise.resolve().then(work).then(r => r, e => { console.error(e); return { ok:false, error:'errors.UNKNOWN_ERROR' }; });
    setPhase('secure');
    await sleep(900);
    setPhase('send');
    const out = (await job) || { ok:false, error:'errors.UNKNOWN_ERROR' };
    const spent = Date.now() - t0;
    if (spent < minMs) await sleep(minMs - spent);
    if (out.ok){
      await setPhase('success');
      try { UIKit.haptic('success'); } catch(e){}
      await sleep(opts.holdMs != null ? opts.holdMs : 1300);
    } else {
      await setPhase('fail');
      try { UIKit.haptic('error'); } catch(e){}
      await sleep(opts.failMs != null ? opts.failMs : 1500);
    }
    releaseLock();
    return out;
  }
  function start(onDone, opts){
    opts = opts || {};
    const duration = opts.duration || CONFIG.PROCESSING.durationMs;
    state = { active:true, startTime: Date.now(), duration };
    setPhase('secure');
    setTimeout(() => { if (state && state.active) setPhase('process'); }, 1100);
    setTimeout(() => { if (state && state.active) setPhase('success'); }, Math.max(1500, duration - 900));
    setTimeout(() => {
      if (!state) return;
      state.active = false;
      setTimeout(() => { releaseLock(); onDone && onDone(); }, 520);
    }, duration);
  }
  return { start, run, acquireLock, releaseLock };
})();

