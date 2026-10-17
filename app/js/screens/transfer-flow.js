'use strict';

function quickItem(nav, iconName, labelKey){
  return '<button class="quick-item" data-nav="' + nav + '"><span class="quick-icon">' + icon(iconName, 22) + '</span><span>' + t(labelKey) + '</span></button>';
}
function accountRow(a, hide){
  const name = a.type === 'MAIN' ? t('accounts.main') : a.type === 'WEST_AFRICA' ? t('accounts.west_africa') : t('accounts.crypto');
  const tileIcon = a.type === 'CRYPTO' ? 'crypto' : a.type === 'WEST_AFRICA' ? 'globe' : 'wallet';
  const bal = hide ? '••••' : CurrencyEngine.format(a.balance, a.currency);
  return '<div class="item" style="cursor:default"><div class="tile">' + icon(tileIcon, 20) + '</div>' +
    '<div class="item-body"><div class="item-title">' + escapeHtml(name) + '</div><div class="item-sub">' + a.currency + '</div></div>' +
    '<div class="item-right"><div class="item-amount">' + escapeHtml(bal) + '</div></div></div>';
}
function txRow(tx, mask){
  const credit = tx.direction === 'IN';
  const iconName = tx.type === 'CRYPTO_BUY' ? 'arrowDownRight' : tx.type === 'CRYPTO_SELL' ? 'arrowUpRight' : tx.type === 'CRYPTO_SWAP' ? 'swap' : tx.type === 'CRYPTO_SEND' ? 'send' : tx.type === 'DEPOSIT' ? 'receive' : (credit ? 'receive' : 'send');
  const op = opLabel(tx);
  const b0 = tx.beneficiary || null;
  const party = b0 && b0.name ? ((typeof receiptBenName === 'function' && b0.phone && !receiptBenName(b0)) ? formatPhoneIntl(b0.phone) : b0.name) : '';
  const name = party || (op ? op + (tx.asset ? ' · ' + tx.asset : '') : (tx.asset || tx.type));
  const sign = credit ? '+' : '−';
  const amt = tx.asset ? CurrencyEngine.formatCrypto(tx.amount, tx.asset) : CurrencyEngine.format(tx.amount, tx.currency || 'OMR');
  /* the REAL status: a completed operation shows no badge (normal case); in progress / failed are always visible and translated */
  const state = txState(tx.status);
  const sub = '<span class="tx-when">' + escapeHtml(timeAgo(tx.createdAt)) + '</span>' + (party && op ? ' · ' + escapeHtml(op) : '');
  return '<div class="item tx-row tx-' + (credit ? 'in' : 'out') + ' st-' + state + '" role="button" tabindex="0" data-action="view-tx" data-tx="' + tx.id + '"><div class="tile">' + icon(state === 'failed' ? 'close' : iconName, 20) + '</div>' +
    '<div class="item-body"><div class="item-title">' + escapeHtml(name) + '</div><div class="item-sub">' + sub + (state !== 'success' ? ' ' + statusPill(state, true) : '') + '</div></div>' +
    '<div class="item-right"><div class="item-amount ltr ' + (credit && state === 'success' ? 'credit' : '') + (state === 'failed' ? ' failed' : '') + '"' + (mask ? ' aria-label="' + escapeHtml(t('ds.hidden_amt')) + '"' : '') + '>' + (mask ? '••••' : sign + escapeHtml(amt)) + '</div></div></div>';
}
/* ============================================================
   12.12.0 — SEND MONEY: one screen asks for ONE thing, the recipient's mobile number.
   The country, the service and the Friendly ID steps are gone: the app sends to Omani mobile numbers.
   How Oman does it (Central Bank of Oman, mobile-number payments): the sender types the recipient's mobile number, the app shows who the
   number belongs to when it knows, then the amount in rials with three decimals (baisa), then a confirmation protected by the personal code.
   Numbers: +968 then 8 digits; mobile numbers start with 7 or 9. The id "country-select" is kept for links, shortcuts and the dock.
   ============================================================ */
Object.assign(TR.en, {
  'sx.uncertain':'Status to be checked','sx.wait':'Waiting for the server’s answer…','sx.st1':'Checked','sx.st2':'Sent','sx.st3':'Server answer','sx.st4':'Confirmed',
  'sp.title':'Send money','sp.heading':'Who are you sending to?','sp.sub':'Enter the recipient’s mobile number.','sp.label':'Mobile number',
  'sp.hint':'Oman · 8 digits, starting with 7 or 9','sp.err_prefix':'An Omani mobile number starts with 7 or 9.','sp.err_short':'The number must have 8 digits.',
  'sp.err_self':'You cannot send money to your own number.','sp.known':'Saved contact','sp.step_number':'Number','sp.to':'To',
  'sp.err_min':'Minimum amount: {n}','sp.err_max':'Maximum per transfer: {n}','sp.type':'Mobile number transfer',
  'sx.secure':'Securing your transfer','sx.send':'Sending your money','sx.success':'Transfer confirmed','sx.fail':'The transfer was not completed'
});
Object.assign(TR.fr, {
  'sx.uncertain':'Statut à vérifier','sx.wait':'En attente de la réponse du serveur…','sx.st1':'Vérifié','sx.st2':'Envoyé','sx.st3':'Réponse du serveur','sx.st4':'Confirmé',
  'sp.title':'Envoyer de l’argent','sp.heading':'À qui envoyez-vous ?','sp.sub':'Saisissez le numéro de mobile du destinataire.','sp.label':'Numéro de mobile',
  'sp.hint':'Oman · 8 chiffres, commence par 7 ou 9','sp.err_prefix':'Un numéro de mobile omanais commence par 7 ou 9.','sp.err_short':'Le numéro doit avoir 8 chiffres.',
  'sp.err_self':'Vous ne pouvez pas envoyer de l’argent à votre propre numéro.','sp.known':'Contact enregistré','sp.step_number':'Numéro','sp.to':'À',
  'sp.err_min':'Montant minimum : {n}','sp.err_max':'Maximum par transfert : {n}','sp.type':'Transfert par numéro de mobile',
  'sx.secure':'Sécurisation de votre transfert','sx.send':'Envoi de votre argent','sx.success':'Transfert confirmé','sx.fail':'Le transfert n’a pas abouti'
});
Object.assign(TR.ar, {
  'sx.uncertain':'الحالة بحاجة إلى تحقق','sx.wait':'بانتظار رد الخادم…','sx.st1':'تم التحقق','sx.st2':'تم الإرسال','sx.st3':'رد الخادم','sx.st4':'تم التأكيد',
  'sp.title':'إرسال الأموال','sp.heading':'لمن تريد الإرسال؟','sp.sub':'أدخل رقم هاتف المستلم.','sp.label':'رقم الهاتف',
  'sp.hint':'عُمان · 8 أرقام تبدأ بـ 7 أو 9','sp.err_prefix':'يبدأ رقم الهاتف العُماني بالرقم 7 أو 9.','sp.err_short':'يجب أن يتكون الرقم من 8 أرقام.',
  'sp.err_self':'لا يمكنك إرسال الأموال إلى رقمك.','sp.known':'جهة اتصال محفوظة','sp.step_number':'الرقم','sp.to':'إلى',
  'sp.err_min':'الحد الأدنى: {n}','sp.err_max':'الحد الأقصى للتحويل: {n}','sp.type':'تحويل عبر رقم الهاتف',
  'sx.secure':'جارٍ تأمين التحويل','sx.send':'جارٍ إرسال المبلغ','sx.success':'تم تأكيد التحويل','sx.fail':'لم يكتمل التحويل'
});

/* ---- Oman mobile numbers ---- */
const OM_DIAL = '+968';
/* Everything typed or pasted (+968 9123 4567, 00968…, 9123-4567, Arabic-Indic digits) -> the 8 local digits (at most). */
function omLocalDigits(raw){
  const compact = String(raw == null ? '' : raw)
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6F0))
    .replace(/[\s\-().]/g, '');
  let d = compact.replace(/\D/g, '');
  if (/^(\+|00)968/.test(compact)) d = d.replace(/^(00)?968/, '');            /* explicit international prefix */
  else if (d.length > 8 && d.indexOf('968') === 0) d = d.slice(3);            /* 968 + 8 digits pasted without the "+" */
  return d.slice(0, 8);
}
const omFormatLocal = d => (d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d);
const omIsMobile = d => /^[79]\d{7}$/.test(String(d || ''));
const omIntl = d => OM_DIAL + d;
const omDisplay = d => OM_DIAL + ' ' + omFormatLocal(d);
/* "+96891234567" -> "+968 9123 4567" (receipts, review). Anything else is shown as stored. */
function formatPhoneIntl(p){
  const raw = String(p == null ? '' : p).trim();
  const digits = raw.replace(/\D/g, '');
  return (/^968\d{8}$/.test(digits) && /^(\+|00)?968/.test(raw.replace(/\s/g, ''))) ? omDisplay(digits.slice(3)) : raw;
}
/* The sender's own number (8 local digits) when it is an Omani number, else '' — used to refuse a transfer to oneself. */
function ownOmDigits(){
  try { const p = typeof receiptSenderPhone === 'function' ? receiptSenderPhone() : ''; const d = String(p).replace(/\D/g, ''); return /^968\d{8}$/.test(d) ? d.slice(3) : ''; } catch(e){ return ''; }
}

function tfTopbar(title){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + escapeHtml(title) + '</span><span style="width:calc(44px*var(--ui))"></span></div>';
}
function progressSteps(current){
  const labels = [ {id:'NUMBER',key:'sp.step_number'}, {id:'AMOUNT',key:'transfer.step_amount'}, {id:'CONFIRMATION',key:'transfer.step_review'} ];
  const curIdx = labels.findIndex(l => l.id === current);
  return '<div class="progress-steps" role="list">' + labels.map((l, i) => {
    const cls = i < curIdx ? 'done' : i === curIdx ? 'current' : '';
    return (i > 0 ? '<span class="progress-line' + (i <= curIdx ? ' done' : '') + '"></span>' : '') +
      '<div class="progress-step ' + cls + '" role="listitem"' + (i === curIdx ? ' aria-current="step"' : '') + '><div class="progress-step-dot">' + (i < curIdx ? icon('check', 14) : '<span>' + (i + 1) + '</span>') + '</div><span>' + t(l.key) + '</span></div>';
  }).join('') + '</div>';
}
/* The recipient, as a compact card (amount and review screens). */
function recipientCard(b){
  const name = b && b.name ? b.name : '';
  return '<div class="sp-to glass-subtle"><span class="sp-to-ic">' + icon('user', 20) + '</span><span class="sp-to-body"><small>' + escapeHtml(t('sp.to')) + '</small>' +
    (name ? '<b>' + escapeHtml(name) + '</b>' : '') + '<span class="ltr sp-to-num" dir="ltr">' + escapeHtml(formatPhoneIntl(b.phone)) + '</span></span>' +
    '<span class="sp-to-flag">' + flag('OM') + '</span></div>';
}

/* Screen 1 — the mobile number, and nothing else. */
function renderCountrySelect(){
  return tfTopbar(t('sp.title')) + progressSteps('NUMBER') +
    '<div class="screen-body sp" style="padding-top:0">' +
      '<div class="sp-hero"><span class="sp-hero-ic">' + icon('mobile', 26) + '</span><h1>' + escapeHtml(t('sp.heading')) + '</h1><p>' + escapeHtml(t('sp.sub')) + '</p></div>' +
      '<div class="field"><label class="field-label" for="sp-num">' + escapeHtml(t('sp.label')) + '</label>' +
        '<div class="field-box sp-box" dir="ltr"><span class="sp-cc"><span class="sp-flag">' + flag('OM') + '</span><b>' + OM_DIAL + '</b></span>' +
        '<input type="tel" id="sp-num" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="18" dir="ltr" lang="en" placeholder="9123 4567" enterkeyhint="done" aria-describedby="sp-hint sp-err"></div>' +
        '<div class="sp-hint" id="sp-hint">' + escapeHtml(t('sp.hint')) + '</div>' +
        '<div class="field-err" id="sp-err" role="alert"></div></div>' +
      '<div id="sp-known" aria-live="polite"></div>' +
      '<button class="btn btn-primary" id="sp-next" disabled style="margin-top:calc(14px*var(--ui))">' + t('action.continue') + '</button>' +
    '</div>';
}

/* Screen 2 — the amount in rials (three decimals). */
function renderTxAmount(){
  const b = TX_STATE.beneficiary;
  if (!b){ R.go('country-select'); return ''; }
  const acc = mainAccount();
  return tfTopbar(t('transfer.amount')) + progressSteps('AMOUNT') +
    '<div class="screen-body" style="padding-top:0">' +
      recipientCard(b) +
      '<div class="amount-wrap" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:var(--sp-6) var(--sp-5) var(--sp-3)"><input type="text" id="amt-input" inputmode="decimal" placeholder="0.000" autocomplete="off" aria-label="' + escapeHtml(t('transfer.amount')) + '" style="width:100%;text-align:center;font-family:var(--font-mono);font-weight:700;font-size:clamp(34px,9vw,46px);letter-spacing:-.03em;background:transparent;color:var(--text);padding:0"><span class="amount-cur" style="font-family:var(--font-mono);font-size:calc(14px*var(--ui));font-weight:600;color:var(--text-2);letter-spacing:.12em">OMR</span>' +
        '<span class="caption" style="margin-top:calc(8px*var(--ui))">' + escapeHtml(t('home.main')) + ' · <span class="ltr" dir="ltr">' + escapeHtml(CurrencyEngine.format(acc.availableBalance, acc.currency)) + '</span></span></div>' +
      '<div class="field-err" id="amt-err" role="alert"></div>' +
      '<button class="btn btn-primary" id="amt-next" disabled style="margin-top:var(--sp-4)">' + t('action.continue') + '</button>' +
    '</div>';
}

/* Screen 3 — review, then confirm with the personal code (swipe, or the button for keyboard / screen-reader users). */
function renderTxReview(){
  if (!TX_STATE.amount || !TX_STATE.beneficiary){ R.go(TX_STATE.beneficiary ? 'tx-amount' : 'country-select'); return ''; }
  const bd = TX_STATE.breakdown, b = TX_STATE.beneficiary;
  return tfTopbar(t('tx.review')) + progressSteps('CONFIRMATION') +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass-elevated receipt-panel">' +
        '<div class="receipt-benef"><div class="receipt-avatar">' + icon('user', 24) + '</div><div class="receipt-benef-body"><div class="receipt-benef-label">' + t('receipt.beneficiary') + '</div>' +
          (b.name ? '<div class="receipt-benef-name">' + escapeHtml(b.name) + '</div>' : '') +
          '<div class="receipt-benef-phone ltr" dir="ltr">' + escapeHtml(formatPhoneIntl(b.phone)) + '</div>' +
          '<div class="receipt-benef-country"><span class="receipt-flag">' + flag('OM') + '</span><span>' + escapeHtml(t('sp.type')) + '</span></div>' +
        '</div></div>' +
      '</div>' +
      '<div class="summary"><div class="summary-row total"><span class="summary-k">' + t('receipt.amountSent') + '</span><span class="summary-v">' + CurrencyEngine.format(bd.amount, 'OMR') + '</span></div></div>' +
      '<div style="margin-top:var(--sp-4)"><div class="swipe-track" id="swipe" role="presentation"><div class="swipe-fill"></div><div class="swipe-label" id="swipe-label">' + t('transfer.swipe') + '</div><div class="swipe-thumb" id="swipe-thumb" tabindex="0" role="button" aria-label="' + t('transfer.swipe') + '">' + icon('send', 24) + '</div></div>' +
      '<button class="btn btn-primary swipe-kb-confirm" id="swipe-kb-confirm" aria-label="' + t('transfer.swipe') + '">' + icon('send', 20) + '<span>' + t('tx.confirm') + '</span></button></div>' +
    '</div>';
}

/* Screen 4 — the send animation. The three states shown here are the REAL ones (see ProcessingEngine.run): the check appears only once the
   server has answered. */
function renderProcessing(){
  const bd = (TX_STATE.breakdown && TX_STATE.breakdown.amount) ? TX_STATE.breakdown : { amount:0 };
  const b = TX_STATE.beneficiary;
  const amtStr = bd.amount ? CurrencyEngine.format(bd.amount, 'OMR') : (CRYPTO_FLOW.pending && CRYPTO_FLOW.pending.data && CRYPTO_FLOW.pending.data.amount ? CurrencyEngine.formatCrypto(CRYPTO_FLOW.pending.data.amount, (CRYPTO_FLOW.pending.data.asset || {}).symbol || 'CRYPTO') : '');
  return '<div class="proc-view sx-view" data-phase="secure">' +
    '<div class="sx-stage" aria-hidden="true">' + SendAnim.svg() + '</div>' +
    (amtStr ? '<div class="proc-amount ltr" dir="ltr">' + escapeHtml(amtStr) + '</div>' : '') +
    (b && b.phone && bd.amount ? '<div class="sx-to"><span>' + escapeHtml(t('sp.to')) + '</span> <b class="ltr" dir="ltr">' + escapeHtml(formatPhoneIntl(b.phone)) + '</b></div>' : '') +
    '<div class="proc-label" role="status" aria-live="polite" id="sx-label">' + escapeHtml(t('sx.secure')) + '</div>' +
    '<div class="sx-wait-note" aria-hidden="true">' + escapeHtml(t('sx.wait')) + '</div>' +
    '<ol class="sx-steps sx4" aria-hidden="true">' + [1, 2, 3, 4].map(n => '<li data-s="' + n + '"><i></i><span>' + escapeHtml(t('sx.st' + n)) + '</span></li>').join('') + '</ol>' +
  '</div>';
}
