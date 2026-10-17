'use strict';

/* ============================================================
   WIRE
   ============================================================ */
/* Opens the receipt of a transaction from the list. The receipt is built from the REAL transaction row (status included). */
async function openTxReceipt(txId){
  if (!txId) return;
  const tx = Runtime.transactions.find(x => x.id === txId);
  if (tx){
    const rc = { id: ID.receipt(), transactionId: tx.id, status: tx.status, direction: tx.direction, kind: tx.kind, amount: tx.amount, currency: tx.currency || 'OMR', fee: tx.fee || 0, total: tx.total || tx.amount, network: tx.network || null, country: tx.beneficiary && tx.beneficiary.country, reference: tx.reference, createdAt: tx.createdAt, asset: tx.asset || null, beneficiary: tx.beneficiary || null };
    /* recordLocalReceipt saves the receipt and adds it to Runtime.receipts; if saving fails the receipt is still shown from memory */
    let saved = null;
    try { saved = await recordLocalReceipt(rc); } catch(err){}
    if (!saved) Runtime.receipts.push(rc);
  }
  R.go('receipt');
}

/* 12.6.0 — Settings controls.
   settingsSwitch: flips the switch immediately, saves, and on failure restores the previous position with an error message. One write at a time per switch.
   settingsChoice: same for a group of chips (theme, currency) — the pressed chip changes at once, a failure restores the previous one.
   rerenderKeepScroll: when a whole screen must be drawn again (language), the scroll position is put back instead of jumping to the top. */
async function settingsSwitch(el, getCur, persist){
  if (el.__busy) return;
  el.__busy = true;
  const cur = !!getCur(), next = !cur;
  el.setAttribute('aria-checked', next ? 'true' : 'false');
  el.classList.add('is-pending');
  try { await persist(next); }
  catch(err){ el.setAttribute('aria-checked', cur ? 'true' : 'false'); toast(t('errors.UNKNOWN_ERROR'), 'error'); }
  finally { el.__busy = false; el.classList.remove('is-pending'); }
}
async function settingsChoice(btn, attr, prev, persist, onChange){
  const group = btn.parentElement;
  if (!group || btn.getAttribute('aria-pressed') === 'true' || group.__busy) return;
  group.__busy = true;
  const set = (val) => { group.querySelectorAll('[' + attr + ']').forEach(c => c.setAttribute('aria-pressed', c.getAttribute(attr) === val ? 'true' : 'false')); };
  const val = btn.getAttribute(attr);
  set(val); onChange(val);
  try { await persist(val); }
  catch(err){ set(prev); onChange(prev); toast(t('errors.UNKNOWN_ERROR'), 'error'); }
  finally { group.__busy = false; }
}
function rerenderKeepScroll(id, top0){
  const box = document.getElementById(id), top = top0 != null ? top0 : (box ? box.scrollTop : 0);   /* top0: position read BEFORE anything else redraws the screen */
  R.go(id, { force:true });
  const restore = () => { const n = document.getElementById(id); if (n) n.scrollTop = top; };
  restore(); requestAnimationFrame(restore); setTimeout(restore, 150);
}

function wire(id){
  const _wireRoot = document.getElementById(id) || document;
  try { V12.onScreen(id); } catch(e){ console.error(e); }
  if (id === 'chain' && typeof wireChain === 'function'){ try { wireChain(_wireRoot); } catch(e){ console.error(e); } }

  _wireRoot.querySelectorAll('[data-action]').forEach(el => {
    el.onclick = async (e) => {
      const a = el.getAttribute('data-action');
      if (a === 'back') R.back();
      else if (a === 'layout-toggle') LayoutMode.toggle();
      else if (a === 'notifications') R.go('notifications');
      else if (a === 'toggle-balance'){
        const next = !Runtime.hideBalance;
        Runtime.hideBalance = next;
        try {
          const uid = UserContext.requireCtx().uid;
          await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { hideBalances: next }));
          Runtime.settings.hideBalances = next;
        } catch(err){}
        R.go('home', { force:true });
      }
      else if (a === 'copy'){ const v = el.getAttribute('data-copy'); if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {}); toast(t('action.copy')); }
      else if (a === 'share') toast(t('action.share'));
      else if (a === 'done'){ txReset(); resetCryptoFlow(); resetCardState(); R.go('home'); }
      else if (a === 'mark-notifs'){ await NotificationEngine.markAllRead(); Push.syncBadge(); R.go('notifications', { force:true }); }
      else if (a === 'contact-remove'){ await ContactsEngine.remove(el.getAttribute('data-id')); R.go(R.current(), { force:true }); }
      else if (a === 'view-tx') await openTxReceipt(el.getAttribute('data-tx'));
      /* 12.6.0 — Settings switches: the switch moves AT ONCE, the write follows, a failure puts it back and says so (no full re-render: the screen keeps its scroll position) */
      else if (a === 'settings-toggle-notifs') await settingsSwitch(el, () => Runtime.settings.notifications !== false, async (next) => {
        const uid = UserContext.requireCtx().uid;
        await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { notifications: next }));
        Runtime.settings.notifications = next;
      });
      else if (a === 'settings-toggle-vibration') await settingsSwitch(el, () => Runtime.settings.vibration !== false, async (next) => {
        const uid = UserContext.requireCtx().uid;
        await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { vibration: next }));
        Runtime.settings.vibration = next;
      });
      else if (a === 'settings-faceid'){
        /* 12.9.0: Face ID is mandatory where the device has it. This row shows the state; it can turn it ON, never OFF. */
        const fi = FaceId.info();
        if (fi.supported === false || fi.supported === null) toast(faceIdText('unsup'));
        else if (fi.enrolled) toast(faceIdText('req'));
        else {
          const r = await FaceId.reenroll({ purpose:'generic', cancel:true });
          if (r && r.ok) R.go('settings', { force:true });
        }
      }
      else if (a === 'settings-toggle-txconfirm') await settingsSwitch(el, () => Runtime.security.transactionConfirmationRequired !== false, async (next) => {
        const uid = UserContext.requireCtx().uid;
        await UserDataEngine.writeDoc(uid, 'security', Object.assign({}, Runtime.security, { transactionConfirmationRequired: next }));
        Runtime.security.transactionConfirmationRequired = next;
      });
      else if (a === 'sign-out'){
        await AuthEngine.signOut();
        toast(t('profile.logout'), 'success');
        R.go('login', { reset:true, force:true });
      }
    };
  });

  _wireRoot.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const n = el.getAttribute('data-nav');
      if (n === 'home') R.go('home');
      else if (n === 'history') R.go('history');
      else if (n === 'cards') R.go('cards');
      else if (n === 'profile') R.go('profile');
      else if (n === 'settings') R.go('settings');
      else if (n === 'devices') R.go('devices');
      else if (n === 'sessions') R.go('sessions');
      else if (n === 'privacy') R.go('privacy');
      else if (n === 'help') R.go('help');
      else if (n === 'about') R.go('about');
      else if (n === 'country-select'){ txReset(); R.go('country-select'); }
      else if (n === 'crypto') R.go('crypto');
      else if (n === 'crypto-market') R.go('crypto-market');
      else if (n === 'crypto-networks') R.go('crypto-networks');
      else if (n === 'crypto-buy'){ CRYPTO_FLOW.fromMain = { asset:null, fiatAmount:0, cryptoAmount:0, rate:0, fee:0 }; R.go('crypto-buy'); }
      else if (n === 'crypto-sell'){ CRYPTO_FLOW.sell = { asset:null, amount:0 }; R.go('crypto-sell'); }
      else if (n === 'crypto-swap'){ CRYPTO_FLOW.swap = { fromAsset:null, toAsset:null, amount:0 }; R.go('crypto-swap'); }
      else if (n === 'crypto-send'){ CRYPTO_FLOW.send = { asset:null, network:null, address:null, memo:null, amount:0 }; R.go('crypto-send'); }
      else if (n === 'crypto-receive'){ CRYPTO_FLOW.receive = { asset:null, network:null }; R.go('crypto-receive'); }
      else if (n === 'crypto-to-bank'){ CRYPTO_FLOW.toBank = { asset:null, network:null, amount:0, accountId:null, bankId:null, bankName:null, currency:null, fiatEquiv:0, fee:0, days:0 }; R.go('crypto-to-bank'); }
      else if (n === 'crypto-spot'){ const aid = el.getAttribute('data-asset') || 'btc'; R.go('crypto-spot', { hash:'#/crypto/spot/' + aid }); }
      else if (n === 'chain') R.go('chain');
      else if (n === 'services') R.go('services');   /* the "More" quick action on the dashboard (it had no branch here) */
      else if (n === 'banks') R.go('banks');
      else if (n === 'banks-add') R.go('banks-add');
      else if (n === 'cards-add') R.go('cards-add');
      else if (n === 'contact-add') R.go('contact-add');
    };
  });

  if (id === 'login'){ wireLogin(); return; }
  if (id === 'signup'){ wireSignup(); return; }
  if (id === 'reset'){ wireReset(); return; }

  if (id === 'country-select'){
    /* 12.12.0 — the one question of the send flow: the recipient's mobile number (Oman, +968, 8 digits starting with 7 or 9) */
    const input = document.getElementById('sp-num'), next = document.getElementById('sp-next'), err = document.getElementById('sp-err'), known = document.getElementById('sp-known');
    const own = ownOmDigits();
    const findContact = d => { try { return ContactsEngine.all().find(c => omLocalDigits(c.digits || c.number) === d) || null; } catch(e){ return null; } };
    function check(final){
      const d = omLocalDigits(input.value);
      err.textContent = ''; known.innerHTML = ''; next.disabled = true;
      if (!d) return null;
      if (!/^[79]/.test(d)){ err.textContent = t('sp.err_prefix'); return null; }
      if (d.length < 8){ if (final) err.textContent = t('sp.err_short'); return null; }
      if (own && d === own){ err.textContent = t('sp.err_self'); return null; }
      const c = findContact(d);
      if (c) known.innerHTML = '<div class="sp-known glass-subtle">' + icon('check', 18) + '<span>' + escapeHtml(t('sp.known')) + '</span><b>' + escapeHtml(c.fullName || c.name || '') + '</b></div>';
      next.disabled = false;
      return { d, contact: c };
    }
    input.oninput = () => { const f = omFormatLocal(omLocalDigits(input.value)); if (input.value !== f) input.value = f; check(false); };
    input.onblur = () => { check(true); };
    input.onkeydown = e => { if (e.key === 'Enter' && !next.disabled){ e.preventDefault(); next.click(); } };
    next.onclick = () => {
      const r = check(true); if (!r) return;
      const svc = CountryTransferEngine.getService('OM', 'local_phone');
      TX_STATE.country = CountryTransferEngine.getConfig('OM');
      TX_STATE.serviceId = 'local_phone';
      TX_STATE.provider = { id: svc.id, name: svc.name[LANG] || svc.name.en, kind:'local' };
      TX_STATE.beneficiary = { uid:null, name: r.contact ? (r.contact.fullName || r.contact.name || null) : null, phone: omIntl(r.d), identifierType:'PHONE', identifierValue: r.d, country:'OM' };
      TX_STATE.amount = 0; TX_STATE.fx = null;
      R.go('tx-amount');
    };
    setTimeout(() => { try { input.focus({ preventScroll:true }); } catch(e){ /* the keyboard opens on the first tap */ } }, 150);
  }
  if (id === 'contact-add'){
    const num = document.getElementById('ct-number');
    const nm = document.getElementById('ct-name');
    const fn = document.getElementById('ct-fullname');
    const prev = document.getElementById('ct-preview');
    const upd = () => {
      const masked = nm.value.trim() ? ContactsEngine.mask(nm.value.trim()) : '—';
      prev.innerHTML = '<span class="recog-mask">' + escapeHtml(masked) + '</span>' + (num.value.trim() ? '<div class="caption" style="margin-top:calc(6px*var(--ui));font-family:var(--font-mono)">' + escapeHtml(num.value.trim()) + '</div>' : '');
    };
    num.oninput = upd; nm.oninput = upd; fn.oninput = upd;
    const ctSave = document.getElementById('ct-save');
    ctSave.onclick = async () => {
      const err = document.getElementById('ct-err');
      UIKit.loading(ctSave, true);
      try {
        await ContactsEngine.add({ number: num.value.trim(), name: nm.value.trim(), fullName: fn.value.trim() || nm.value.trim(), country: 'OM' });
        toast(t('contact.added'), 'success');
        R.back();
      } catch(e){ UIKit.loading(ctSave, false); err.textContent = e.message || 'Error'; }
    };
  }
  if (id === 'tx-amount'){
    const input = document.getElementById('amt-input'); const next = document.getElementById('amt-next'); const err = document.getElementById('amt-err');
    const acc = mainAccount();
    /* rials have three decimals (baisa): only digits and one separator are kept, at most three decimals, "," and Arabic-Indic digits accepted */
    const sanitize = raw => {
      let s = String(raw == null ? '' : raw).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6F0)).replace(/[,٫]/g, '.').replace(/[^\d.]/g, '');
      const p = s.split('.');
      return p.length > 1 ? (p[0] + '.' + p.slice(1).join('').slice(0, 3)) : p[0];
    };
    function update(){
      const clean = sanitize(input.value); if (clean !== input.value) input.value = clean;
      const v = Math.round((parseFloat(clean) || 0) * 1000) / 1000;
      const bd = FeeEngine.compute(v, true);                 /* 12.12.0 : no fees, total = amount (the server debits the amount alone) */
      err.textContent = ''; next.disabled = true;
      if (v <= 0) return;
      if (v < CONFIG.LIMITS.minOMR){ err.textContent = tf('sp.err_min', { n: CurrencyEngine.format(CONFIG.LIMITS.minOMR, 'OMR') }); return; }
      if (v > CONFIG.LIMITS.perTxOMR){ err.textContent = tf('sp.err_max', { n: CurrencyEngine.format(CONFIG.LIMITS.perTxOMR, 'OMR') }); return; }
      if (bd.total > acc.availableBalance){ err.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      next.disabled = false;
    }
    input.oninput = update; update();
    input.onkeydown = e => { if (e.key === 'Enter' && !next.disabled){ e.preventDefault(); next.click(); } };
    next.onclick = () => {
      const v = Math.round((parseFloat(sanitize(input.value)) || 0) * 1000) / 1000; if (v <= 0) return;
      TX_STATE.amount = v;
      TX_STATE.breakdown = FeeEngine.compute(v, true);
      TX_STATE.fx = null;
      R.go('tx-review');
    };
    setTimeout(() => { try { input.focus({ preventScroll:true }); } catch(e){ /* rien */ } }, 150);
  }
  if (id === 'tx-review'){
    const track = document.getElementById('swipe'); const thumb = document.getElementById('swipe-thumb'); const fill = track.querySelector('.swipe-fill'); const label = document.getElementById('swipe-label');
    const kbBtn = document.getElementById('swipe-kb-confirm');
    let dragging = false, startX = 0, dx = 0, maxX = 0, midHapticDone = false;
    let _txConfirmed = false; const _idemKey = uuid();
    function resetSwipe(){
      dx = 0; const rtl = document.documentElement.dir === 'rtl';
      if (rtl){ thumb.style.right = '5px'; } else { thumb.style.left = '5px'; }
      fill.style.width = '0'; label.style.opacity = '1'; thumb.classList.remove('success');
    }
    let _pinBusy = false;
    async function confirmAndProceed(){
      if (_txConfirmed || _pinBusy) return;
      _pinBusy = true;
      const _pin = await PinEngine.authorize();
      _pinBusy = false;
      if (!_pin.ok){ resetSwipe(); if (_pin.error) toast(t(_pin.error), 'error'); return; }
      if (!ProcessingEngine.acquireLock()) return;
      _txConfirmed = true;
      UIKit.loading(kbBtn, true);
      thumb.classList.add('success');
      UIKit.haptic('tap');
      const b = TX_STATE.beneficiary, bd = TX_STATE.breakdown, provider = TX_STATE.provider;
      R.go('processing');
      /* The request starts AT ONCE; the animation shows what really happens (secured -> sending -> confirmed / not completed). */
      const out = await ProcessingEngine.run(async () => {
        const res = await TransferEngine.sendExternal({
          amount: bd.amount, destCurrency: 'OMR', provider: provider ? provider.name : '',
          beneficiary: { firstName: '', lastName: '', phone: b.phone, country: 'OM', identifierType: 'PHONE' },
          idemKey: _idemKey, pinGrant: _pin.grant
        });
        if (!res.ok) return { ok:false, error: res.error };
        const sv = res.data;
        const receipt = {
          id: ID.receipt(), transactionId: sv.transactionId, status: 'SUCCESS',
          amount: sv.amount, currency: 'OMR', fee: sv.fee, vat: sv.vat, total: sv.total,
          destinationAmount: sv.destinationAmount, destinationCurrency: sv.destinationCurrency, exchangeRate: sv.exchangeRate,
          beneficiary: { name: b.name, phone: b.phone, country: 'OM', networkName: provider ? provider.name : null },
          network: provider ? provider.name : null, reference: sv.reference, createdAt: Date.now()
        };
        try { await recordLocalReceipt(receipt); } catch(e){ console.error(e); }
        return { ok:true, receipt };
      });
      if (!out.ok){ toast(t(out.error || 'errors.UNKNOWN_ERROR'), 'error'); R.go('home'); return; }
      InAppNotif.showCall({
        title: t('notif.fiat_sent'),
        message: (b.name || formatPhoneIntl(b.phone)),
        amount: CurrencyEngine.format(bd.amount, 'OMR'),
        status: 'success'
      });
      R.go('receipt');
    }
    if (kbBtn) kbBtn.onclick = confirmAndProceed;
    function computeMax(){ maxX = track.offsetWidth - thumb.offsetWidth - 10; }
    function updateVisual(x){
      const isRTL = document.documentElement.dir === 'rtl';
      const raw = isRTL ? startX - x : x - startX;
      dx = Math.max(0, Math.min(maxX, raw));
      if (isRTL){ thumb.style.right = (dx + 5) + 'px'; fill.style.width = (dx + thumb.offsetWidth + 10) + 'px'; }
      else { thumb.style.left = (dx + 5) + 'px'; fill.style.width = (dx + thumb.offsetWidth + 10) + 'px'; }
      label.style.opacity = String(Math.max(0, 1 - (dx / maxX) * 1.8));
      const pct = maxX > 0 ? dx / maxX : 0;
      if (!midHapticDone && pct >= 0.5){ midHapticDone = true; UIKit.haptic('tap'); }
      if (pct < 0.5) midHapticDone = false;
    }
    function start(e){ dragging = true; midHapticDone = false; computeMax(); startX = e.touches ? e.touches[0].clientX : e.clientX; }
    function move(e){ if (!dragging) return; updateVisual(e.touches ? e.touches[0].clientX : e.clientX); if (e.cancelable) e.preventDefault(); }
    function end(){
      if (!dragging) return; dragging = false;
      if (dx / maxX > 0.9){ confirmAndProceed(); }
      else {
        dx = 0; const isRTL = document.documentElement.dir === 'rtl';
        if (isRTL){ thumb.style.right = '5px'; fill.style.width = '0'; } else { thumb.style.left = '5px'; fill.style.width = '0'; }
        label.style.opacity = '1';
        UIKit.haptic('error');
      }
    }
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); confirmAndProceed(); } });
    thumb.addEventListener('mousedown', start); thumb.addEventListener('touchstart', start, { passive:true });
    document.addEventListener('mousemove', move); document.addEventListener('touchmove', move, { passive:false });
    document.addEventListener('mouseup', end); document.addEventListener('touchend', end);
    R.onLeave(() => {
      document.removeEventListener('mousemove', move); document.removeEventListener('touchmove', move);
      document.removeEventListener('mouseup', end); document.removeEventListener('touchend', end);
    });
  }
  if (id === 'crypto-buy'){
    _wireRoot.querySelectorAll('[data-crypto-buy-asset]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.fromMain.asset = el.getAttribute('data-crypto-buy-asset'); R.go('crypto-buy-amount'); }; });
  }
  if (id === 'crypto-buy-amount'){
    const aid = CRYPTO_FLOW.fromMain.asset;
    const asset = CRYPTO_ASSETS.find(a => a.id === aid);
    const priceUSD = asset ? CryptoMarketEngine.price(asset.symbol) : 1;
    const priceOMR = priceUSD / (FX_RATES.USD || 2.6008);   /* OMR per 1 crypto unit */
    const main = mainAccount();
    const input = document.getElementById('buy-fiat');
    const preview = document.getElementById('buy-preview');
    const err = document.getElementById('buy-err');
    const next = document.getElementById('buy-next');
    function updateBuy(){
      const v = parseFloat(String(input.value).replace(',', '.')) || 0;
      err.textContent = ''; next.disabled = true;
      if (v <= 0){ preview.innerHTML = ''; return; }
      if (v < 0.1){ err.textContent = t('errors.MINIMUM_AMOUNT'); return; }
      if (v > main.availableBalance){ err.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      /* fee is a % of the OMR spent; crypto received = (spend - fee) / price. Server result is authoritative. */
      const fee = Math.round(v * CONFIG.FEES.CRYPTO_TRADE_PCT * 1000) / 1000;
      const cryptoNet = priceOMR > 0 ? Math.max(0, (v - fee) / priceOMR) : 0;
      preview.innerHTML = '<div class="glass-subtle" style="padding:var(--sp-3) var(--sp-4);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center">' +
        '<div><div class="caption">' + t('crypto.youGet') + '</div><div style="font-weight:700;margin-top:calc(4px*var(--ui))">' + CurrencyEngine.formatCrypto(cryptoNet, asset.symbol) + '</div></div>' +
        '<div style="text-align:end"><div class="caption">' + t('crypto.fee') + '</div><div style="font-size:calc(13px*var(--ui));margin-top:calc(4px*var(--ui))">' + CurrencyEngine.format(fee, 'OMR') + '</div></div></div>';
      CRYPTO_FLOW.fromMain = { asset: aid, fiatAmount: v, cryptoAmount: cryptoNet, rate: priceOMR, fee };
      next.disabled = false;
    }
    input.oninput = updateBuy;
    next.onclick = () => {
      const d = CRYPTO_FLOW.fromMain;
      CRYPTO_FLOW.pending = { kind:'BUY', data:{ asset, assetId: aid, symbol: asset.symbol, fiatAmount: d.fiatAmount, amount: d.cryptoAmount, rate: d.rate, fee: d.fee, total: d.cryptoAmount } };
      R.go('crypto-review');
    };
  }
  if (id === 'crypto-sell'){
    _wireRoot.querySelectorAll('[data-crypto-sell-asset]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.sell.asset = el.getAttribute('data-crypto-sell-asset'); R.go('crypto-sell-amount'); }; });
  }
  if (id === 'crypto-sell-amount'){
    const aid = CRYPTO_FLOW.sell.asset;
    const asset = CRYPTO_ASSETS.find(a => a.id === aid);
    const wallet = Runtime.wallets.find(w => w.assetId === aid || w.symbol === asset.symbol);
    const priceUSD = asset ? CryptoMarketEngine.price(asset.symbol) : 1;
    const priceOMR = priceUSD / (FX_RATES.USD || 2.6008);
    const input = document.getElementById('sell-amt');
    const preview = document.getElementById('sell-preview');
    const err = document.getElementById('sell-err');
    const next = document.getElementById('sell-next');
    function updateSell(){
      const v = parseFloat(String(input.value).replace(',', '.')) || 0;
      err.textContent = ''; next.disabled = true;
      if (v <= 0){ preview.innerHTML = ''; return; }
      const avail = wallet ? Number(wallet.balance) : 0;
      if (v > avail){ err.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      const grossOMR = v * priceOMR;
      const feeOMR = Math.round(grossOMR * CONFIG.FEES.CRYPTO_TRADE_PCT * 1000) / 1000;
      const netOMR = Math.max(0, grossOMR - feeOMR);
      preview.innerHTML = '<div class="glass-subtle" style="padding:var(--sp-3) var(--sp-4);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center">' +
        '<div><div class="caption">' + t('crypto.fiatReceive') + '</div><div style="font-weight:700;margin-top:calc(4px*var(--ui))">' + CurrencyEngine.format(netOMR, 'OMR') + '</div></div>' +
        '<div style="text-align:end"><div class="caption">' + t('crypto.fee') + '</div><div style="font-size:calc(13px*var(--ui));margin-top:calc(4px*var(--ui))">' + CurrencyEngine.format(feeOMR, 'OMR') + '</div></div></div>';
      CRYPTO_FLOW.sell = { asset: aid, amount: v, fiatReceived: netOMR, fee: feeOMR };
      next.disabled = false;
    }
    input.oninput = updateSell;
    next.onclick = () => {
      const d = CRYPTO_FLOW.sell;
      CRYPTO_FLOW.pending = { kind:'SELL', data:{ asset, assetId: aid, symbol: asset.symbol, amount: d.amount, fiatReceived: d.fiatReceived, fee: d.fee, total: d.amount } };
      R.go('crypto-review');
    };
  }
  if (id === 'crypto-swap'){
    _wireRoot.querySelectorAll('[data-swap-from]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.swap.fromAsset = el.getAttribute('data-swap-from'); CRYPTO_FLOW.swap.toAsset = null; R.go('crypto-swap-to'); }; });
  }
  if (id === 'crypto-swap-to'){
    _wireRoot.querySelectorAll('[data-swap-to]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.swap.toAsset = el.getAttribute('data-swap-to'); R.go('crypto-swap-amount'); }; });
  }
  if (id === 'crypto-swap-amount'){
    const fromId = CRYPTO_FLOW.swap.fromAsset;
    const toId = CRYPTO_FLOW.swap.toAsset;
    const fromAsset = CRYPTO_ASSETS.find(a => a.id === fromId);
    const toAsset = CRYPTO_ASSETS.find(a => a.id === toId);
    const fromWallet = Runtime.wallets.find(w => w.assetId === fromId || w.symbol === fromAsset.symbol);
    const fromPrice = fromAsset ? CryptoMarketEngine.price(fromAsset.symbol) : 1;
    const toPrice = toAsset ? CryptoMarketEngine.price(toAsset.symbol) : 1;
    const rate = toPrice > 0 ? fromPrice / toPrice : 0;
    const input = document.getElementById('swap-amt');
    const preview = document.getElementById('swap-preview');
    const err = document.getElementById('swap-err');
    const next = document.getElementById('swap-next');
    function updateSwap(){
      const v = parseFloat(String(input.value).replace(',', '.')) || 0;
      err.textContent = ''; next.disabled = true;
      if (v <= 0){ preview.innerHTML = ''; return; }
      const avail = fromWallet ? Number(fromWallet.balance) : 0;
      if (v > avail){ err.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      const gross = v * rate;
      const feeUSD = FeeEngine.cryptoSwap(v * fromPrice);
      const feeFrom = fromPrice > 0 ? feeUSD / fromPrice : 0;
      const net = Math.max(0, gross * (1 - CONFIG.FEES.CRYPTO_SWAP_PCT));
      preview.innerHTML = '<div class="glass-subtle" style="padding:var(--sp-3) var(--sp-4);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center">' +
        '<div><div class="caption">' + t('crypto.youGet') + '</div><div style="font-weight:700;margin-top:calc(4px*var(--ui))">' + CurrencyEngine.formatCrypto(net, toAsset.symbol) + '</div></div>' +
        '<div style="text-align:end"><div class="caption">' + t('crypto.fee') + '</div><div style="font-size:calc(13px*var(--ui));margin-top:calc(4px*var(--ui))">' + CurrencyEngine.formatCrypto(feeFrom, fromAsset.symbol) + '</div></div></div>';
      CRYPTO_FLOW.swap = { fromAsset: fromId, toAsset: toId, amount: v, destinationAmount: net, fee: feeFrom };
      next.disabled = false;
    }
    input.oninput = updateSwap;
    next.onclick = () => {
      const d = CRYPTO_FLOW.swap;
      CRYPTO_FLOW.pending = { kind:'SWAP', data:{ asset: fromAsset, assetId: fromId, toAsset: toId, toAssetObj: toAsset, amount: d.amount, destinationAmount: d.destinationAmount, fee: d.fee, total: d.amount } };
      R.go('crypto-review');
    };
  }
  if (id === 'crypto-send'){
    _wireRoot.querySelectorAll('[data-send-asset]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.send.asset = el.getAttribute('data-send-asset'); CRYPTO_FLOW.send.network = null; CRYPTO_FLOW.send.address = null; R.go('crypto-send-network'); }; });
  }
  if (id === 'crypto-send-network'){
    _wireRoot.querySelectorAll('[data-send-net]').forEach(el => { el.onclick = () => { CRYPTO_FLOW.send.network = el.getAttribute('data-send-net'); CRYPTO_FLOW.send.address = null; R.go('crypto-send-address'); }; });
  }
  if (id === 'crypto-send-address'){
    const nid = CRYPTO_FLOW.send.network;
    const addrInput = document.getElementById('send-addr');
    const addrStatus = document.getElementById('addr-status');
    const addrNext = document.getElementById('addr-next');
    let addrTimer = null;
    function validateAddr(){
      clearTimeout(addrTimer);
      const v = (addrInput.value || '').trim();
      addrNext.disabled = true; addrStatus.innerHTML = '';
      if (!v) return;
      addrTimer = setTimeout(() => {
        const res = AddressEngine.validate(nid, v);
        if (res.ok && res.strict){
          addrStatus.innerHTML = '<div class="recog recog-found"><div class="recog-icon" style="background:var(--success)">' + icon('check', 20) + '</div><div class="recog-body"><div class="recog-label" style="color:var(--success)">' + t('recog.recognized') + '</div><div class="recog-name ltr" style="font-size:calc(13px*var(--ui))">' + escapeHtml(AddressEngine.short(res.address)) + '</div></div></div>';
          addrNext.disabled = false;
        } else if (res.ok){
          /* 12.3.7 : n'importe quelle adresse acceptée par le serveur peut recevoir ; un format inhabituel est un AVERTISSEMENT, pas un blocage */
          const net = NetworkEngine.get(nid), other = res.looksLike ? NetworkEngine.get(res.looksLike) : null;
          const msg = tf('crypto.addressUnusual', { net: net ? net.name : nid }) + (other ? ' ' + tf('crypto.addressLooksLike', { other: other.name }) : '');
          addrStatus.innerHTML = '<div class="recog" style="background:var(--warning-bg);border-color:var(--warning)"><div class="recog-icon" style="background:var(--warning)">' + icon('warn', 20) + '</div><div class="recog-body"><div class="recog-label" style="color:var(--warning)">' + escapeHtml(msg) + '</div><div class="recog-name ltr" style="font-size:calc(13px*var(--ui));word-break:break-all">' + escapeHtml(AddressEngine.short(res.address)) + '</div></div></div>';
          addrNext.disabled = false;
        } else {
          addrStatus.innerHTML = '<div class="recog" style="background:var(--danger-bg);border-color:var(--danger)"><div class="recog-icon" style="background:var(--danger)">' + icon('warn', 20) + '</div><div class="recog-body"><div class="recog-label" style="color:var(--danger)">' + t('crypto.addressInvalid') + '</div></div></div>';
        }
      }, 350);
    }
    addrInput.oninput = validateAddr;
    addrNext.onclick = () => {
      CRYPTO_FLOW.send.address = AddressEngine.clean(addrInput.value);
      const memoEl = document.getElementById('send-memo');
      CRYPTO_FLOW.send.memo = memoEl ? memoEl.value.trim() || null : null;
      R.go('crypto-send-amount');
    };
  }
  if (id === 'crypto-send-amount'){
    const aid = CRYPTO_FLOW.send.asset;
    const nid = CRYPTO_FLOW.send.network;
    const asset = CRYPTO_ASSETS.find(a => a.id === aid);
    const wallet = Runtime.wallets.find(w => w.assetId === aid || w.symbol === asset.symbol);
    const gas = asset && nid ? GasFeeEngine.estimate(nid, asset.symbol) : { amount: 0 };
    const input = document.getElementById('sendamt-input');
    const preview = document.getElementById('sendamt-preview');
    const err = document.getElementById('sendamt-err');
    const next = document.getElementById('sendamt-next');
    function updateSendAmt(){
      const v = parseFloat(String(input.value).replace(',', '.')) || 0;
      err.textContent = ''; next.disabled = true;
      if (v <= 0){ preview.innerHTML = ''; return; }
      const avail = wallet ? Number(wallet.balance) : 0;
      const total = v + gas.amount;
      if (total > avail){ err.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      preview.innerHTML = '<div class="glass-subtle" style="padding:var(--sp-3) var(--sp-4);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center">' +
        '<div><div class="caption">' + t('crypto.youPay') + '</div><div style="font-weight:700;margin-top:calc(4px*var(--ui))">' + CurrencyEngine.formatCrypto(v, asset.symbol) + '</div></div>' +
        '<div style="text-align:end"><div class="caption">' + t('crypto.networkFee') + '</div><div style="font-size:calc(13px*var(--ui));margin-top:calc(4px*var(--ui))">≈ ' + CurrencyEngine.formatCrypto(gas.amount, asset.symbol) + '</div></div></div>';
      CRYPTO_FLOW.send.amount = v;
      next.disabled = false;
    }
    input.oninput = updateSendAmt;
    next.onclick = () => {
      const net = NetworkEngine.get(nid);
      CRYPTO_FLOW.pending = { kind:'SEND', data:{
        asset, assetId: aid, symbol: asset.symbol, amount: CRYPTO_FLOW.send.amount,
        networkFee: gas.amount, fee: 0, total: CRYPTO_FLOW.send.amount + gas.amount,
        network: net ? net.name : nid, networkId: nid,
        toAddress: CRYPTO_FLOW.send.address, memo: CRYPTO_FLOW.send.memo || null,
        walletId: wallet ? wallet.id : null
      }};
      R.go('crypto-review');
    };
  }
  if (id === 'crypto-review'){
    const track = document.getElementById('swipe'); const thumb = document.getElementById('swipe-thumb'); const fill = track.querySelector('.swipe-fill'); const label = document.getElementById('swipe-label');
    const kbBtn = document.getElementById('swipe-kb-confirm');
    let dragging = false, startX = 0, dx = 0, maxX = 0, midHapticDone = false;
    let _cryptoConfirmed = false;
    function resetSwipe(){
      dx = 0; const rtl = document.documentElement.dir === 'rtl';
      if (rtl){ thumb.style.right = '5px'; } else { thumb.style.left = '5px'; }
      fill.style.width = '0'; label.style.opacity = '1'; thumb.classList.remove('success');
    }
    let _pinBusy = false;
    async function cryptoConfirm(){
      if (!CRYPTO_FLOW.pending || ['BUY','SELL','SWAP','SEND'].indexOf(CRYPTO_FLOW.pending.kind) === -1){ blockUnsupported(); return; }
      if (_cryptoConfirmed || _pinBusy) return;
      _pinBusy = true;
      const _pin = await PinEngine.authorize();
      _pinBusy = false;
      if (!_pin.ok){ resetSwipe(); if (_pin.error) toast(t(_pin.error), 'error'); return; }
      if (!ProcessingEngine.acquireLock()) return;
      _cryptoConfirmed = true;
      UIKit.loading(kbBtn, true);
      thumb.classList.add('success');
      UIKit.haptic('success');
      const p = CRYPTO_FLOW.pending;
      const buyIdem = p.idemKey || (p.idemKey = uuid());   /* one key per review: retries replay the same request */
      R.go('processing');
      ProcessingEngine.start(async () => {
        try {
          const d = p.data;
          const sym = d.symbol || (d.asset && d.asset.symbol);
          let res;
          if (p.kind === 'BUY') res = await CryptoBuyEngine.buy({ symbol: sym, amountOMR: d.fiatAmount, idemKey: buyIdem , pinGrant: _pin.grant });
          else if (p.kind === 'SELL') res = await CryptoBuyEngine.sell({ symbol: sym, amount: d.amount, idemKey: buyIdem , pinGrant: _pin.grant });
          else if (p.kind === 'SEND') res = await CryptoBuyEngine.sendExternal({ symbol: sym, network: d.networkId, address: d.toAddress, memo: d.memo, amount: d.amount, idemKey: buyIdem, pinGrant: _pin.grant });
          else res = await CryptoBuyEngine.swap({ from: sym, to: d.toAssetObj && d.toAssetObj.symbol, amount: d.amount, idemKey: buyIdem , pinGrant: _pin.grant });
          if (!res.ok){
            toast(t(res.error || 'errors.UNKNOWN_ERROR'), 'error');
            R.go('crypto');
            return;
          }
          const row = res.data || {};
          const ref = row.reference || ID.reference();
          const txId = row.transaction_id || ID.transaction();
          const name = d.asset ? d.asset.name : sym;
          let receipt, shown;
          if (p.kind === 'BUY'){
            const got = Number(row.amount != null ? row.amount : d.amount);
            shown = CurrencyEngine.formatCrypto(got, sym);
            receipt = { id: ID.receipt(), transactionId: txId, status:'SUCCESS', amount: got, currency:'OMR', asset: sym,
              fee: Number(row.fee != null ? row.fee : d.fee), total: Number(d.fiatAmount), costOMR: true,
              beneficiary: { name, networkName:'Friendly Pay' }, network:'Friendly Pay', reference: ref, createdAt: Date.now() };
          } else if (p.kind === 'SEND'){
            /* server result is authoritative: CONFIRMED = internal YOR transfer, PENDING = awaiting blockchain validation */
            const internal = !!row.internal; const pending = row.status === 'PENDING';
            const amt = Number(row.amount != null ? row.amount : d.amount);
            const fee = Number(row.fee != null ? row.fee : 0);
            shown = CurrencyEngine.formatCrypto(amt, sym);
            const rcv = row.receiver || null;
            receipt = { id: ID.receipt(), transactionId: txId, status: pending ? 'PENDING' : 'SUCCESS', amount: amt, currency: sym, asset: sym,
              fee: fee, total: amt + fee, internal: internal,
              beneficiary: { name: rcv ? rcv.name : AddressEngine.short(d.toAddress || ''), phone: rcv ? dispId(rcv.yor_id) : null, networkName: d.network || '' },
              network: d.network || '', address: d.toAddress, reference: ref, createdAt: Date.now() };
          } else if (p.kind === 'SELL'){
            const got = Number(row.fiat_received != null ? row.fiat_received : d.fiatReceived);
            shown = CurrencyEngine.format(got, 'OMR');
            receipt = { id: ID.receipt(), transactionId: txId, status:'SUCCESS', amount: Number(row.amount != null ? row.amount : d.amount), currency:'OMR', asset: sym,
              fee: Number(row.fee != null ? row.fee : d.fee), total: got, costOMR: true,
              beneficiary: { name, networkName:'Friendly Pay' }, network:'Friendly Pay', reference: ref, createdAt: Date.now() };
          } else {
            const to = d.toAssetObj ? d.toAssetObj.symbol : '';
            const got = Number(row.destination_amount != null ? row.destination_amount : d.destinationAmount);
            const amt = Number(row.amount != null ? row.amount : d.amount);
            shown = CurrencyEngine.formatCrypto(got, to);
            receipt = { id: ID.receipt(), transactionId: txId, status:'SUCCESS', amount: amt, currency: sym, asset: sym,
              fee: Number(row.fee != null ? row.fee : d.fee), total: amt,
              destinationAmount: got, destinationCurrency: to, exchangeRate: amt > 0 ? got / amt : null,
              beneficiary: { name: d.toAssetObj ? d.toAssetObj.name : to, networkName:'Friendly Pay' }, network:'Friendly Pay', reference: ref, createdAt: Date.now() };
          }
          try { await recordLocalReceipt(receipt); } catch(e){ console.error(e); }
          resetCryptoFlow();
          InAppNotif.showCall({ title: t(p.kind === 'BUY' ? 'crypto.reviewBuy' : p.kind === 'SELL' ? 'crypto.reviewSell' : p.kind === 'SEND' ? 'crypto.reviewSend' : 'crypto.reviewSwap'), message: name, amount: shown, status: (receipt.status === 'PENDING' ? 'pending' : 'success') });
          R.go('receipt');
          return;
        } catch(e){ console.error(e); toast(t('errors.UNKNOWN_ERROR'), 'error'); R.go('crypto'); return; }
      });
    }
    if (kbBtn) kbBtn.onclick = cryptoConfirm;
    function computeMax(){ maxX = track.offsetWidth - thumb.offsetWidth - 10; }
    function updateVisual(x){
      const isRTL = document.documentElement.dir === 'rtl';
      const raw = isRTL ? startX - x : x - startX;
      dx = Math.max(0, Math.min(maxX, raw));
      if (isRTL){ thumb.style.right = (dx + 5) + 'px'; fill.style.width = (dx + thumb.offsetWidth + 10) + 'px'; }
      else { thumb.style.left = (dx + 5) + 'px'; fill.style.width = (dx + thumb.offsetWidth + 10) + 'px'; }
      label.style.opacity = String(Math.max(0, 1 - (dx / maxX) * 1.8));
      const pct = maxX > 0 ? dx / maxX : 0;
      if (!midHapticDone && pct >= 0.5){ midHapticDone = true; UIKit.haptic('tap'); }
      if (pct < 0.5) midHapticDone = false;
    }
    function start(e){ dragging = true; midHapticDone = false; computeMax(); startX = e.touches ? e.touches[0].clientX : e.clientX; }
    function move(e){ if (!dragging) return; updateVisual(e.touches ? e.touches[0].clientX : e.clientX); if (e.cancelable) e.preventDefault(); }
    function end(){
      if (!dragging) return; dragging = false;
      if (dx / maxX > 0.9){ cryptoConfirm(); }
      else { dx = 0; const isRTL = document.documentElement.dir === 'rtl';
        if (isRTL){ thumb.style.right = '5px'; fill.style.width = '0'; } else { thumb.style.left = '5px'; fill.style.width = '0'; }
        label.style.opacity = '1'; UIKit.haptic('error'); }
    }
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); cryptoConfirm(); } });
    thumb.addEventListener('mousedown', start); thumb.addEventListener('touchstart', start, { passive:true });
    document.addEventListener('mousemove', move); document.addEventListener('touchmove', move, { passive:false });
    document.addEventListener('mouseup', end); document.addEventListener('touchend', end);
    R.onLeave(() => { document.removeEventListener('mousemove', move); document.removeEventListener('touchmove', move); document.removeEventListener('mouseup', end); document.removeEventListener('touchend', end); });
  }
  if (id === 'crypto-receive'){ _wireRoot.querySelectorAll('[data-receive]').forEach(el => { el.onclick = async () => { const parts = el.getAttribute('data-receive').split('|'); CRYPTO_FLOW.receive.asset = parts[0]; CRYPTO_FLOW.receive.network = parts[1];
      const a = CRYPTO_ASSETS.find(x => x.id === parts[0]); if (a) await CryptoBuyEngine.receiveAddress(a.symbol, parts[1]);
      R.go('crypto-receive-address'); }; }); }
  if (id === 'banks'){
    _wireRoot.querySelectorAll('[data-bank-select]').forEach(el => { el.onclick = () => { R.go('banks-add'); setTimeout(() => { const sel = document.getElementById('bank-select'); if (sel){ sel.value = el.getAttribute('data-bank-select'); sel.dispatchEvent(new Event('change')); } }, 50); }; });
    _wireRoot.querySelectorAll('[data-bank-remove]').forEach(el => {
      el.onclick = async () => {
        const uid = UserContext.requireCtx().uid;
        const id = el.getAttribute('data-bank-remove');
        try {
          await UserDataEngine.deleteSub(uid, 'bankAccounts', id);
          Runtime.bankAccounts = Runtime.bankAccounts.filter(a => a.id !== id);
          toast(t('banks.removed'), 'success');
          R.go('banks', { force:true });
        } catch(e){ toast(t('errors.UNKNOWN_ERROR'), 'error'); }
      };
    });
  }
  if (id === 'banks-add'){
    const sel = document.getElementById('bank-select');
    const ibanInput = document.getElementById('bank-iban');
    const etaEl = document.getElementById('bank-eta');
    function updateBankAddMeta(){
      if (!sel || !ibanInput || !etaEl) return;
      const opt = sel.options[sel.selectedIndex];
      const country = opt ? opt.getAttribute('data-country') : 'OM';
      const days = opt ? (parseInt(opt.getAttribute('data-days')) || 5) : 5;
      ibanInput.placeholder = IBANEngine.placeholder(country);
      etaEl.innerHTML = icon('clock', 13) + ' ' + t('banks.choose_eta').replace('{days}', days);
    }
    if (sel) sel.addEventListener('change', updateBankAddMeta);
    const bankSave = document.getElementById('bank-save');
    bankSave.onclick = async () => {
      const bankId = sel ? sel.value : '';
      const holder = document.getElementById('bank-holder').value.trim();
      const iban = ibanInput ? ibanInput.value.trim() : '';
      const err = document.getElementById('bank-err');
      const bank = BANKS.find(b => b.id === bankId);
      err.textContent = '';
      if (!holder || holder.length < 3){ err.textContent = t('banks.err_holder'); return; }
      const vc = IBANEngine.validate(iban, bank ? bank.country : 'OM');
      if (!vc.ok){ err.textContent = t('banks.err_iban'); return; }
      UIKit.loading(bankSave, true);
      try {
        const uid = UserContext.requireCtx().uid;
        const acc = {
          id: ID.bankAccount(), bankId, bankName: bank.name, country: bank.country,
          currency: bank.currency, holder, iban, verified: true, days: bank.days,
          createdAt: Date.now()
        };
        await UserDataEngine.writeSub(uid, 'bankAccounts', acc.id, acc);
        Runtime.bankAccounts.push(acc);
        toast(t('banks.added'), 'success');
        R.go('banks');
      } catch(e){ UIKit.loading(bankSave, false); err.textContent = t('errors.UNKNOWN_ERROR'); }
    };
  }
  if (id === 'crypto-to-bank'){
    _wireRoot.querySelectorAll('[data-tobank-asset]').forEach(el => { el.onclick = () => {
      const parts = el.getAttribute('data-tobank-asset').split('|');
      CRYPTO_FLOW.toBank.asset = parts[0]; CRYPTO_FLOW.toBank.network = parts[1] || null;
      R.go('crypto-to-bank-account');
    }; });
  }
  if (id === 'crypto-to-bank-account'){
    _wireRoot.querySelectorAll('[data-tobank-account]').forEach(el => { el.onclick = () => {
      const accId = el.getAttribute('data-tobank-account');
      CRYPTO_FLOW.toBank.accountId = accId;
      const acc = Runtime.bankAccounts.find(a => a.id === accId);
      if (acc){ CRYPTO_FLOW.toBank.bankId = acc.bankId; CRYPTO_FLOW.toBank.bankName = acc.bankName; CRYPTO_FLOW.toBank.currency = acc.currency; CRYPTO_FLOW.toBank.days = acc.days || 5; }
      R.go('crypto-to-bank-amount');
    }; });
  }
  if (id === 'crypto-to-bank-amount'){
    const f = CRYPTO_FLOW.toBank;
    const asset = CRYPTO_ASSETS.find(a => a.id === f.asset);
    const acc = Runtime.bankAccounts.find(a => a.id === f.accountId);
    if (!asset || !acc){ R.go('crypto-to-bank'); return; }
    const priceUSD = CryptoMarketEngine.price(asset.symbol);
    const FX = FX_RATES[acc.currency] || 1;
    const priceInCurr = (priceUSD / (FX_RATES.USD || 2.6008)) * FX;
    const wallet = Runtime.wallets.find(w => (w.assetId === f.asset || w.symbol === asset.symbol) && w.network === f.network);
    const avail = wallet ? Number(wallet.balance) : 0;
    const amtInput = document.getElementById('tobank-amount');
    const feeEl = document.getElementById('tobank-fee');
    const recvEl = document.getElementById('tobank-receive');
    const errEl = document.getElementById('tobank-err');
    const nextBtn = document.getElementById('tobank-next');
    let _toBankCalc = { v:0, fee:0, fiatRecv:0 };
    function updateToBankCalc(){
      const v = parseFloat(String(amtInput ? amtInput.value : '').replace(',', '.')) || 0;
      if (errEl) errEl.textContent = '';
      if (nextBtn) nextBtn.disabled = true;
      if (feeEl) feeEl.textContent = '—';
      if (recvEl) recvEl.textContent = '—';
      _toBankCalc = { v:0, fee:0, fiatRecv:0 };
      if (v <= 0) return;
      if (v < 0.0001){ if (errEl) errEl.textContent = t('errors.MINIMUM_AMOUNT'); return; }
      if (v > avail){ if (errEl) errEl.textContent = t('errors.INSUFFICIENT_BALANCE'); return; }
      const fee = FeeEngine.cryptoToBank(v);
      const net = v - fee;
      const fiatRecv = net * priceInCurr;
      if (feeEl) feeEl.textContent = CurrencyEngine.formatCrypto(fee, asset.symbol);
      if (recvEl) recvEl.textContent = CurrencyEngine.format(fiatRecv, acc.currency);
      if (nextBtn) nextBtn.disabled = false;
      _toBankCalc = { v, fee, fiatRecv };
    }
    if (nextBtn) nextBtn.onclick = () => {
      const { v, fee, fiatRecv } = _toBankCalc;
      if (!v) return;
      f.amount = v; f.fee = fee; f.fiatEquiv = fiatRecv;
      CRYPTO_FLOW.pending = { kind:'CRYPTO_TO_BANK', data:{ asset, assetId: f.asset, networkId: f.network, walletId: wallet ? wallet.id : null, amount: v, fee, total: v, bankId: f.bankId, bankName: f.bankName, fiatEquiv: fiatRecv, currency: acc.currency, days: f.days, beneficiary: acc.bankName } };
      R.go('crypto-bank-review');
    };
    if (amtInput) amtInput.addEventListener('input', updateToBankCalc);
  }
  if (id === 'crypto-bank-review'){
    const f = CRYPTO_FLOW.toBank;
    if (!f.asset || !f.accountId || !f.amount){ R.go('crypto-to-bank'); return; }
    const asset = CRYPTO_ASSETS.find(a => a.id === f.asset);
    const acc = Runtime.bankAccounts.find(a => a.id === f.accountId);
    let _bankConfirmed = false;
    let _pinBusyB = false;
    const bankIdem = (CRYPTO_FLOW.pending && CRYPTO_FLOW.pending.idemKey) || (CRYPTO_FLOW.pending ? (CRYPTO_FLOW.pending.idemKey = uuid()) : uuid());
    function resetBankSwipe(){
      const th = document.getElementById('swipe-thumb'), fl = document.querySelector('#swipe .swipe-fill'), lb = document.getElementById('swipe-label');
      const rtl = document.documentElement.dir === 'rtl';
      if (th){ if (rtl) th.style.right = '5px'; else th.style.left = '5px'; }
      if (fl) fl.style.width = '0';
      if (lb) lb.style.opacity = '1';
    }
    async function confirmAndProceed(){
      if (_bankConfirmed || _pinBusyB) return;
      if (!CRYPTO_FLOW.pending || CRYPTO_FLOW.pending.kind !== 'CRYPTO_TO_BANK'){ R.go('crypto-to-bank'); return; }
      _pinBusyB = true;
      const _pin = await PinEngine.authorize();
      _pinBusyB = false;
      if (!_pin.ok){ resetBankSwipe(); if (_pin.error) toast(t(_pin.error), 'error'); return; }
      if (!ProcessingEngine.acquireLock()) return;
      _bankConfirmed = true;
      const kbBtn = document.getElementById('swipe-kb-confirm');
      if (kbBtn) UIKit.loading(kbBtn, true);
      UIKit.haptic('success');
      R.go('processing');
      ProcessingEngine.start(async () => {
        try {
          const res = await CryptoBuyEngine.toBank({ symbol: asset.symbol, network: f.network, amount: f.amount,
            bankId: f.bankId, bankName: f.bankName, currency: acc.currency, idemKey: bankIdem, pinGrant: _pin.grant });
          if (!res.ok){
            toast(t(res.error || 'errors.UNKNOWN_ERROR'), 'error');
            R.go('crypto');
            return;
          }
          const row = res.data || {};
          const amt = Number(row.amount != null ? row.amount : f.amount);
          const fee = Number(row.fee != null ? row.fee : (f.fee || 0));
          const fiat = Number(row.fiat_equiv != null ? row.fiat_equiv : f.fiatEquiv);
          const reference = row.reference || ID.reference();
          const receipt = {
            id: ID.receipt(), transactionId: row.transaction_id || ID.transaction(), status: 'PENDING',
            amount: amt, currency: asset.symbol, asset: asset.symbol,
            fee: fee, total: amt,
            beneficiary: { name: acc.bankName, phone: null, networkName: t('crypto.bank_withdrawal') },
            network: 'Bank', reference,
            destinationAmount: fiat, destinationCurrency: acc.currency,
            createdAt: Date.now()
          };
          try { await recordLocalReceipt(receipt); } catch(e){ console.error(e); }
          resetCryptoFlow();
          InAppNotif.showCall({ title: t('notif.bank_pending'), message: asset.symbol + ' → ' + acc.bankName, amount: CurrencyEngine.formatCrypto(amt, asset.symbol), status: 'pending' });
          R.go('receipt');
        } catch(e){
          console.error(e);
          toast(t('errors.UNKNOWN_ERROR'), 'error');
          R.go('crypto');
        }
      });
    }
    const kbBtn = document.getElementById('swipe-kb-confirm');
    if (kbBtn) kbBtn.onclick = confirmAndProceed;
    const thumb = document.getElementById('swipe-thumb');
    const track = document.getElementById('swipe');
    if (thumb && track){
      thumb.setAttribute('tabindex', '0'); thumb.setAttribute('role', 'button');
      thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); confirmAndProceed(); } });
      let startX = 0, currentX = 0, dragging = false, midHapticDone = false;
      const fill = track.querySelector('.swipe-fill');
      const lbl = document.getElementById('swipe-label');
      const maxX = track.offsetWidth - thumb.offsetWidth - 8;
      const isRTL = () => document.documentElement.dir === 'rtl';
      function move(e){
        if (!dragging) return;
        e.preventDefault();
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const raw = isRTL() ? startX - x : x - startX;
        currentX = Math.max(0, Math.min(maxX, raw));
        const pct = maxX > 0 ? currentX / maxX : 0;
        if (fill) fill.style.width = (currentX + thumb.offsetWidth + 10) + 'px';
        if (thumb){ if (isRTL()) thumb.style.right = (currentX + 5) + 'px'; else thumb.style.left = (currentX + 5) + 'px'; }
        if (lbl) lbl.style.opacity = String(Math.max(0, 1 - pct * 2));
        if (!midHapticDone && pct >= 0.5){ midHapticDone = true; UIKit.haptic('tap'); }
        if (pct < 0.5) midHapticDone = false;
        if (pct >= 0.98) confirmAndProceed();
      }
      function end(){
        if (!dragging) return; dragging = false;
        const pct = maxX > 0 ? currentX / maxX : 0;
        if (pct < 0.9){ UIKit.haptic('error'); currentX = 0; if (fill) fill.style.width = '0'; if (thumb){ if (isRTL()) thumb.style.right = '5px'; else thumb.style.left = '5px'; } if (lbl) lbl.style.opacity = '1'; }
      }
      function start(e){ dragging = true; const cx = (e.touches ? e.touches[0].clientX : e.clientX); startX = isRTL() ? cx + currentX : cx - currentX; }
      thumb.addEventListener('mousedown', start); thumb.addEventListener('touchstart', start, { passive:true });
      document.addEventListener('mousemove', move); document.addEventListener('touchmove', move, { passive:false });
      document.addEventListener('mouseup', end); document.addEventListener('touchend', end);
      R.onLeave(() => { document.removeEventListener('mousemove', move); document.removeEventListener('touchmove', move); document.removeEventListener('mouseup', end); document.removeEventListener('touchend', end); });
    }
  }
  if (id === 'settings'){
    Push.mountRow();                                      /* 12.13.0 : état et boutons des alertes sur le téléphone */
    const cpSave = document.getElementById('confirm-phone-save');
    if (cpSave){
      cpSave.onclick = async () => {
        const inp = document.getElementById('confirm-phone'), err = document.getElementById('confirm-phone-err');
        const v = normalizeConfirmPhone(inp ? inp.value : '');
        if (v === null){ if (err) err.textContent = t('confirm.invalid'); return; }
        if (err) err.textContent = '';
        UIKit.loading(cpSave, true);
        try {
          const uid = UserContext.requireCtx().uid;
          await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { confirmPhone: v }));
          Runtime.settings.confirmPhone = v;
          toast(t(v ? 'confirm.saved' : 'confirm.removed'), 'success');
          rerenderKeepScroll('settings');
        } catch(e){ UIKit.loading(cpSave, false); if (err) err.textContent = t('errors.UNKNOWN_ERROR'); }
      };
    }
    _wireRoot.querySelectorAll('[data-lang]').forEach(btn => {
      btn.onclick = async () => {
        const top = (document.getElementById('settings') || {}).scrollTop || 0;
        LANG = btn.getAttribute('data-lang');
        DeviceLang.set(LANG);
        try {
          const uid = UserContext.requireCtx().uid;
          await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { language: LANG }));
          Runtime.settings.language = LANG;
        } catch(e){}
        applyI18n();
        rerenderKeepScroll('settings', top);
      };
    });
    _wireRoot.querySelectorAll('[data-theme]').forEach(btn => {
      btn.onclick = () => {
        const prev = savedThemeMode();
        settingsChoice(btn, 'data-theme', prev, async (th) => {
          const uid = UserContext.requireCtx().uid;
          await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { theme: th }));
          Runtime.settings.theme = th;
        }, (th) => {
          applyTheme(th);
          const sub = document.getElementById('set-theme-sub'); if (sub) sub.textContent = t('theme.' + th);
        });
      };
    });
    _wireRoot.querySelectorAll('[data-currency]').forEach(btn => {
      btn.onclick = () => {
        const prev = displayCurrency();
        settingsChoice(btn, 'data-currency', prev, async (cur) => {
          const uid = UserContext.requireCtx().uid;
          await UserDataEngine.writeDoc(uid, 'preferences', Object.assign({}, Runtime.settings, { primaryCurrency: cur }));
          Runtime.settings.primaryCurrency = cur;
          toast(cur, 'success');
        }, (cur) => {
          const v = document.getElementById('set-cur-value'); if (v) v.textContent = cur;
        });
      };
    });
  }
  if (id === 'history'){
    _wireRoot.querySelectorAll('[data-filter]').forEach(chip => {
      chip.onclick = () => {
        const f = chip.getAttribute('data-filter');
        _wireRoot.querySelectorAll('[data-filter]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        const list = document.getElementById('history-list');
        if (list) list.innerHTML = historyListHtml(f);
      };
    });
    /* rows are drawn again after each filter: one delegated listener keeps them all tappable */
    const hl = document.getElementById('history-list');
    if (hl) hl.addEventListener('click', e => { const row = e.target.closest && e.target.closest('[data-action="view-tx"]'); if (row && !row.onclick) openTxReceipt(row.getAttribute('data-tx')); });   /* rows from the first draw already have their own handler */
  }
  if (id === 'crypto-market'){
    const search = document.getElementById('crypto-market-search');
    const sortWrap = document.getElementById('crypto-market-sort');
    const list = document.getElementById('crypto-market-list');
    const all = CryptoMarketEngine.list();
    let sortBy = 'rank';
    function refreshMarket(){
      const q = (search.value || '').trim().toLowerCase();
      const filtered = all.filter(a => !q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q));
      list.innerHTML = renderMarketRows(filtered, sortBy);
      list.querySelectorAll('[data-nav="crypto-spot"]').forEach(el => {
        el.onclick = () => R.go('crypto-spot', { hash:'#/crypto/spot/' + el.getAttribute('data-asset') });
      });
    }
    if (search) search.oninput = refreshMarket;
    if (sortWrap) sortWrap.querySelectorAll('[data-sort]').forEach(chip => {
      chip.onclick = () => {
        sortWrap.querySelectorAll('[data-sort]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        sortBy = chip.getAttribute('data-sort');
        refreshMarket();
      };
    });
  }
  _wireRoot.querySelectorAll('[data-spot-action]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.getAttribute('data-spot-action');
      const aid = btn.getAttribute('data-asset');
      if (kind === 'buy'){ CRYPTO_FLOW.fromMain = { asset: aid, fiatAmount:0, cryptoAmount:0, rate:0, fee:0 }; R.go('crypto-buy-amount'); }
      else if (kind === 'sell'){ CRYPTO_FLOW.sell = { asset: aid, amount:0 }; R.go('crypto-sell-amount'); }
      else if (kind === 'swap'){ CRYPTO_FLOW.swap = { fromAsset: aid, toAsset:null, amount:0 }; R.go('crypto-swap-to'); }
    };
  });
  _wireRoot.querySelectorAll('.crypto-quick-amounts').forEach(wrap => {
    const targetId = wrap.getAttribute('data-quick-target');
    const input = document.getElementById(targetId);
    if (!input) return;
    const base = (() => {
      try {
        if (targetId === 'buy-fiat'){
          const main = mainAccount();
          return main ? Number(main.availableBalance) : 0;
        }
        if (targetId === 'sell-amt' || targetId === 'swap-amt' || targetId === 'sendamt-input'){
          const aid = (targetId === 'sell-amt') ? CRYPTO_FLOW.sell.asset
                    : (targetId === 'swap-amt') ? CRYPTO_FLOW.swap.fromAsset
                    : CRYPTO_FLOW.send.asset;
          const asset = CRYPTO_ASSETS.find(a => a.id === aid);
          const w = Runtime.wallets.find(x => x.assetId === aid || x.symbol === (asset && asset.symbol));
          return w ? Number(w.balance) : 0;
        }
      } catch(e){}
      return 0;
    })();
    wrap.querySelectorAll('[data-quick-pct]').forEach(btn => {
      btn.onclick = () => {
        const pct = parseInt(btn.getAttribute('data-quick-pct'), 10) / 100;
        const v = base * pct;
        if (!isFinite(v) || v <= 0) return;
        const decimals = (targetId === 'sell-amt' || targetId === 'swap-amt' || targetId === 'sendamt-input') ? 8 : 3;
        input.value = v.toFixed(decimals);
        input.dispatchEvent(new Event('input', { bubbles:true }));
      };
    });
  });
  if (id === 'receipt'){
    const r = window.__YOR_LAST_RECEIPT__;
    _wireRoot.querySelectorAll('[data-action="share-receipt"]').forEach(btn => { btn.onclick = () => ReceiptExport.run('share'); });
    _wireRoot.querySelectorAll('[data-action="download-receipt"]').forEach(btn => { btn.onclick = () => ReceiptExport.run('png'); });
    _wireRoot.querySelectorAll('[data-action="download-pdf"]').forEach(btn => { btn.onclick = () => ReceiptExport.run('pdf'); });
    /* 12.4.0 : copy a reference / id (real clipboard result, never a fake "copied"), and print the receipt (print stylesheet in css/yor-ds.css) */
    _wireRoot.querySelectorAll('[data-action="copy-ref"]').forEach(btn => { btn.onclick = () => copyText(btn.getAttribute('data-copy'), t('receipt.copied')); });
    _wireRoot.querySelectorAll('[data-action="print-receipt"]').forEach(btn => { btn.onclick = () => { try { window.print(); } catch(e){ toast(t('errors.UNKNOWN_ERROR'), 'error'); } }; });
    wireReceiptNotice(r);
  }
  if (id === 'crypto'){
    const orb = document.querySelector('.screen.active .crypto-orb');
    const scr = document.querySelector('.screen.active');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (orb && scr && !reduced){
      let raf = 0, sy = 0, px = 0, py = 0;
      const apply = () => { raf = 0; orb.style.setProperty('--oy', (px * 18 + sy * 0.06).toFixed(1) + 'deg'); orb.style.setProperty('--ox', (py * -14).toFixed(1) + 'deg'); orb.style.setProperty('--oty', (-sy * 0.12).toFixed(1) + 'px'); };
      const onScroll = () => { sy = scr.scrollTop || 0; if (!raf) raf = requestAnimationFrame(apply); };
      const onPtr = (e) => { px = (e.clientX / innerWidth - 0.5) * 2; py = (e.clientY / innerHeight - 0.5) * 2; if (!raf) raf = requestAnimationFrame(apply); };
      scr.addEventListener('scroll', onScroll, { passive:true });
      window.addEventListener('pointermove', onPtr, { passive:true });
      R.onLeave(() => { scr.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onPtr); if (raf) cancelAnimationFrame(raf); });
    }
  }
}

function wireLogin(){
  const $ = x => document.getElementById(x);
  let busy = false;
  document.querySelectorAll('[data-auth-toggle]').forEach(btn => {
    btn.onclick = () => {
      const inp = $(btn.getAttribute('data-auth-toggle'));
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', t(show ? 'auth.hide' : 'auth.show'));
    };
  });
  function clearErr(){ document.querySelectorAll('#login .field-err').forEach(e => e.textContent = ''); }
  async function submit(){
    if (busy) return;
    clearErr();
    const email = $('au-email').value.trim();
    const pass = $('au-pass').value;
    if (!email || !pass){ $('login-err').textContent = t('auth.err.empty'); return; }
    busy = true;
    const btn = $('au-submit'); UIKit.loading(btn, true);
    const res = await AuthEngine.signIn(email, pass);
    if (!res.ok){
      busy = false;
      UIKit.loading(btn, false);
      $('login-err').textContent = t(res.error);
      try { if (navigator.vibrate) navigator.vibrate([40, 40, 40]); } catch(e){}
      return;
    }
    /* onAuthStateChanged will hydrate and route home */
  }
  const btn = $('au-submit'); if (btn) btn.onclick = submit;
  document.querySelectorAll('#login input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } }));
  const toSignup = $('au-to-signup'); if (toSignup) toSignup.onclick = () => R.go('signup');
  const toReset = $('au-to-reset'); if (toReset) toReset.onclick = () => R.go('reset');
}

function wireSignup(){
  const $ = x => document.getElementById(x);
  let busy = false;
  document.querySelectorAll('[data-auth-toggle]').forEach(btn => {
    btn.onclick = () => {
      const inp = $(btn.getAttribute('data-auth-toggle'));
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', t(show ? 'auth.hide' : 'auth.show'));
    };
  });
  async function submit(){
    if (busy) return;
    const err = $('signup-err'); err.textContent = '';
    const first = $('su-first').value.trim();
    const last = $('su-last').value.trim();
    const email = $('su-email').value.trim();
    const pass = $('su-pass').value;
    if (!email || !pass){ err.textContent = t('auth.err.empty'); return; }
    /* the phone number is mandatory to open an account (12.6.0) */
    const dialSel = $('su-dial'), phoneInp = $('su-phone');
    const dialOpt = dialSel && dialSel.options[dialSel.selectedIndex];
    const phone = signupPhone(dialOpt ? dialOpt.getAttribute('data-dial') : '', phoneInp ? phoneInp.value : '');
    if (!phone){ err.textContent = t('auth.err.phone'); if (phoneInp) phoneInp.focus(); return; }
    if (pass.length < 8){ err.textContent = t('auth.err.weak'); return; }
    busy = true;
    const btn = $('su-submit'); UIKit.loading(btn, true);
    const res = await AuthEngine.signUp(email, pass, first, last, phone, dialSel ? dialSel.value : 'OM');
    if (!res.ok){
      busy = false;
      UIKit.loading(btn, false);
      err.textContent = t(res.error);
      return;
    }
    if (res.needsConfirm){ busy = false; UIKit.loading(btn, false); toast(t('auth.err.confirmEmail'), 'success'); R.go('login'); }
    /* otherwise the auth listener routes home */
  }
  const btn = $('su-submit'); if (btn) btn.onclick = submit;
  document.querySelectorAll('#signup input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } }));
  const toLogin = $('su-to-login'); if (toLogin) toLogin.onclick = () => R.go('login');
}

function wireReset(){
  const $ = x => document.getElementById(x);
  let busy = false;
  async function submit(){
    if (busy) return;
    const err = $('reset-err'); err.textContent = '';
    const email = $('rs-email').value.trim();
    if (!email){ err.textContent = t('auth.err.empty'); return; }
    busy = true;
    const btn = $('rs-submit'); UIKit.loading(btn, true);
    const res = await AuthEngine.sendReset(email);
    busy = false;
    UIKit.loading(btn, false);
    if (res.ok){ toast(t('auth.resetSent'), 'success'); R.go('login'); }
    else { err.textContent = t(res.error); }
  }
  const btn = $('rs-submit'); if (btn) btn.onclick = submit;
  document.querySelectorAll('#reset input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } }));
}

