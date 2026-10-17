'use strict';

/* 12.3.0 : état du message envoyé au destinataire (SMS / e-mail), lu côté serveur (get_recipient_notice_status). */
Object.assign(TR.en, {
  'notice.title':'Message to the recipient','notice.title.sender':'Confirmation sent to you','notice.sms':'SMS','notice.email':'E-mail',
  'notice.st.SENT':'Passed to the provider','notice.st.PENDING':'Waiting to be sent','notice.st.SENDING':'Sending','notice.st.FAILED':'Failed','notice.st.SKIPPED':'Not sent',
  'notice.note':'When the provider gives no delivery report, "passed to the provider" does not prove the message arrived.',
  'notice.why.sms_credits_missing':'no SMS credit on the provider account yet','notice.why.provider_not_configured':'the message service is not configured',
  'notice.why.country_not_enabled':'SMS is not enabled for this country','notice.why.rate_limited_recipient':'daily limit for this number reached',
  'notice.why.rate_limited_sender':'your daily message limit is reached','notice.why.expired':'too old to send','notice.why.invalid_phone':'invalid phone number','notice.why.no_sender_phone':'add your number in Settings › SMS confirmation number','notice.why.provider_error':'the message service refused it'
});
Object.assign(TR.fr, {
  'notice.title':'Message au destinataire','notice.title.sender':'Confirmation qui vous est envoyée','notice.sms':'SMS','notice.email':'E-mail',
  'notice.st.SENT':'Transmis au fournisseur','notice.st.PENDING':'En attente d\'envoi','notice.st.SENDING':'Envoi en cours','notice.st.FAILED':'Échec','notice.st.SKIPPED':'Non envoyé',
  'notice.note':'Sans rapport de remise du fournisseur, « transmis au fournisseur » ne prouve pas que le message est arrivé.',
  'notice.why.sms_credits_missing':'pas encore de crédit SMS chez le fournisseur','notice.why.provider_not_configured':'le service de messages n\'est pas configuré',
  'notice.why.country_not_enabled':'les SMS ne sont pas activés pour ce pays','notice.why.rate_limited_recipient':'limite quotidienne atteinte pour ce numéro',
  'notice.why.rate_limited_sender':'votre limite quotidienne de messages est atteinte','notice.why.expired':'trop ancien pour être envoyé','notice.why.invalid_phone':'numéro de téléphone invalide','notice.why.no_sender_phone':'ajoutez votre numéro dans Réglages › Numéro pour les confirmations SMS','notice.why.provider_error':'le service de messages l\'a refusé'
});
Object.assign(TR.ar, {
  'notice.title':'رسالة إلى المستلم','notice.title.sender':'تأكيد يُرسل إليك','notice.sms':'رسالة نصية','notice.email':'البريد الإلكتروني',
  'notice.st.SENT':'سُلّمت إلى المزوّد','notice.st.PENDING':'بانتظار الإرسال','notice.st.SENDING':'جارٍ الإرسال','notice.st.FAILED':'فشل','notice.st.SKIPPED':'لم تُرسل',
  'notice.note':'عندما لا يوفّر المزوّد تقرير تسليم، فإن عبارة «سُلّمت إلى المزوّد» لا تثبت وصول الرسالة.',
  'notice.why.sms_credits_missing':'لا يوجد رصيد رسائل لدى المزوّد بعد','notice.why.provider_not_configured':'خدمة الرسائل غير مُعدّة',
  'notice.why.country_not_enabled':'الرسائل النصية غير مفعّلة لهذا البلد','notice.why.rate_limited_recipient':'تم بلوغ الحد اليومي لهذا الرقم',
  'notice.why.rate_limited_sender':'تم بلوغ حدك اليومي للرسائل','notice.why.expired':'قديمة جداً للإرسال','notice.why.invalid_phone':'رقم هاتف غير صالح','notice.why.no_sender_phone':'أضف رقمك في الإعدادات › رقم رسائل التأكيد','notice.why.provider_error':'رفضت خدمة الرسائل الإرسال'
});

/* 12.5.0 : delivery report of the SMS (read from the provider by the server; shown only when the server has a report) */
Object.assign(TR.en, {
  'notice.dl.DELIVERED':'Delivered to the phone','notice.dl.UNDELIVERABLE':'Not delivered',
  'notice.dl.PENDING':'Passed to the provider · waiting for the delivery report','notice.dl.UNKNOWN':'Passed to the provider · no delivery report received'
});
Object.assign(TR.fr, {
  'notice.dl.DELIVERED':'Remis sur le téléphone','notice.dl.UNDELIVERABLE':'Non remis',
  'notice.dl.PENDING':'Transmis au fournisseur · rapport de remise en attente','notice.dl.UNKNOWN':'Transmis au fournisseur · aucun rapport de remise reçu'
});
Object.assign(TR.ar, {
  'notice.dl.DELIVERED':'سُلّمت إلى الهاتف','notice.dl.UNDELIVERABLE':'لم تُسلَّم',
  'notice.dl.PENDING':'سُلّمت إلى المزوّد · بانتظار تقرير التسليم','notice.dl.UNKNOWN':'سُلّمت إلى المزوّد · لم يصل تقرير تسليم'
});

/* 12.5.0 : "make another transfer" (12.6.0: the receipt no longer carries any balance) */
Object.assign(TR.en, { 'receipt.another':'Make another transfer' });
Object.assign(TR.fr, { 'receipt.another':'Faire un autre transfert' });
Object.assign(TR.ar, { 'receipt.another':'إجراء تحويل آخر' });

/* 12.3.4 : the receipt shows the SENDER'S number ("From"), the same number the recipient sees in the SMS. */
Object.assign(TR.en, { 'receipt.from':'From' });
Object.assign(TR.fr, { 'receipt.from':'De' });
Object.assign(TR.ar, { 'receipt.from':'من' });

/* The sender's number in international form (+968…), taken the way the server takes it for the SMS: the number set in
   Settings › SMS confirmation number, else the profile phone. Returns '' when there is no usable number (nothing is invented). */
function receiptSenderPhone(){
  const prof = Runtime.profile || {};
  const raw = String((Runtime.settings && Runtime.settings.confirmPhone) || prof.phone || '').trim();
  if (!raw) return '';
  let d = raw.replace(/[^\d+]/g, '');
  if (d.indexOf('00') === 0) d = '+' + d.slice(2);
  if (d.charAt(0) !== '+'){
    const c = (typeof COUNTRY_DATA !== 'undefined' && COUNTRY_DATA[prof.country || 'OM']) || null;
    const dial = c && c.dial ? String(c.dial).replace(/\D/g, '') : '';
    const digits = d.replace(/\D/g, '');
    /* already international without the "+": do not add the country code a second time */
    d = (dial && digits.indexOf(dial) === 0 && digits.length >= dial.length + 8) ? digits : dial + digits.replace(/^0+/, '');
  }
  const digits = d.replace(/\D/g, '');
  return (digits.length >= 8 && digits.length <= 15) ? '+' + digits : '';
}

/* A phone transfer has no beneficiary name: the server then stores the number as the name. Do not show it twice. */
function receiptBenName(b){
  if (!b || !b.name) return '';
  const n = String(b.name).trim();
  const nd = n.replace(/\D/g, ''), pd = String(b.phone || '').replace(/\D/g, '');
  return (nd && pd && nd === pd) ? '' : n;
}

/* 12.6.0 : the receipt NEVER shows the remaining balance (no line, no server call, not in the PNG / PDF either). */

/* Reads (never invents) the real state of the message that goes to the recipient. Nothing is shown when no message exists. */
let _rcNoticeLoop = 0;
async function wireReceiptNotice(r){
  if (!document.getElementById('receipt-notice') || !r || !r.transactionId || typeof sb === 'undefined' || !supabaseReady) return;
  const token = ++_rcNoticeLoop;                                       /* a newer receipt screen stops this loop */
  const alive = () => token === _rcNoticeLoop && !!document.getElementById('receipt-notice');
  const read = async () => {
    const { data, error } = await sb.rpc('get_recipient_notice_status', { p_tx: r.transactionId });
    return (error || !Array.isArray(data)) ? null : data;
  };
  const draw = data => {
    const host = document.getElementById('receipt-notice');          /* the user may have left the receipt meanwhile */
    if (!host || !data || !data.length) return;
    const rowHtml = n => {
      const ok = n.status === 'SENT';
      const dl = ok && n.delivery && n.delivery !== 'UNSUPPORTED' ? n.delivery : '';   /* delivery report from the provider (SMS only) */
      const why = n.reason ? ' · ' + t('notice.why.' + n.reason) : '';
      const label = dl ? t('notice.dl.' + dl) + (dl === 'UNDELIVERABLE' ? why : '') : t('notice.st.' + n.status) + why;   /* a refused SMS says why (e.g. no SMS credit) */
      const ico = dl === 'UNDELIVERABLE' ? 'close' : (ok && dl !== 'PENDING') ? 'check' : 'clock';
      const color = dl === 'UNDELIVERABLE' ? 'color:var(--danger)' : (dl === 'DELIVERED' || (ok && !dl)) ? 'color:var(--success)' : '';
      return '<div class="receipt-row"><div class="receipt-row-icon">' + icon(ico, 17) + '</div>' +
        '<span class="receipt-row-label">' + escapeHtml(t(n.channel === 'EMAIL' ? 'notice.email' : 'notice.sms')) + '</span>' +
        '<span class="receipt-row-value" style="font-size:calc(12.5px*var(--ui));' + color + '">' + escapeHtml(label) + '</span></div>';
    };
    /* two groups: the confirmation that goes to the sender (SENDER) and the message that goes to the beneficiary */
    const mine = data.filter(n => n.audience === 'SENDER'), theirs = data.filter(n => n.audience !== 'SENDER');
    const block = (title, rows, first) => rows.length
      ? '<div class="receipt-benef-label" style="margin-bottom:calc(8px*var(--ui));' + (first ? '' : 'margin-top:calc(14px*var(--ui))') + '">' + escapeHtml(t(title)) + '</div>' + rows.map(rowHtml).join('')
      : '';
    host.innerHTML = block('notice.title.sender', mine, true) + block('notice.title', theirs, !mine.length) +
      (data.some(n => n.status === 'SENT' && n.delivery !== 'DELIVERED' && n.delivery !== 'UNDELIVERABLE') ? '<div style="font-size:calc(11.5px*var(--ui));opacity:.7;margin-top:calc(6px*var(--ui));line-height:1.45">' + escapeHtml(t('notice.note')) + '</div>' : '');
    host.style.display = '';
  };
  const unfinished = data => data.some(n => n.status === 'PENDING' || n.status === 'FAILED');
  try {
    let data = await read();
    if (!data || !data.length) return;
    draw(data);
    /* A message still waiting (the first request may have been lost, or the provider was down): ask the server to try again.
       The server decides if it is time (it keeps its own retry schedule) and only the sender of the transaction is accepted. */
    if (unfinished(data) && typeof TransferEngine !== 'undefined' && TransferEngine.flushNotices){
      await TransferEngine.flushNotices(r.transactionId);
      data = (await read()) || data;
      draw(data);
    }
    /* another request may be sending right now: look again a couple of times, then stop (never loops forever) */
    for (let i = 0; i < 2 && data.some(n => n.status === 'SENDING'); i++){
      await new Promise(res => setTimeout(res, 2500));
      if (!alive()) return;
      data = (await read()) || data;
      draw(data);
    }
    /* 12.5.0 : an SMS passed to the provider whose delivery report is not known yet. The server reads the report from the provider
       every minute; look again every 30 s for at most 5 minutes, then stop (the state stays "waiting" / "unknown", never invented). */
    for (let i = 0; i < 10 && data.some(n => n.status === 'SENT' && n.delivery === 'PENDING'); i++){
      await new Promise(res => setTimeout(res, 30000));
      if (!alive()) return;
      data = (await read()) || data;
      draw(data);
    }
  } catch (e) { /* the message state is informative only: the receipt never depends on it */ }
}

/* ============================================================
   12.4.0 — Receipt driven by the REAL status of the transaction.
   success -> green check, pending -> clock (amber), failed -> cross (red). A failed or pending operation is never drawn as a success.
   Every value comes from the transaction / receipt snapshot; a line without data is simply not drawn.
   ============================================================ */
const RC_BADGE_PATH = {
  success: '<path class="rc-k" d="M20 33l9 9 17-19"/>',
  pending: '<path class="rc-k" d="M32 17v16l10 6"/>',
  failed:  '<path class="rc-k" d="M23 23l18 18M41 23L23 41"/>'
};
function rcBadge(state){
  return '<div class="rc-badge st-' + state + '" role="img" aria-label="' + escapeHtml(t('tx.st.' + state)) + '">' +
    '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle class="rc-c" cx="32" cy="32" r="29"/>' + RC_BADGE_PATH[state] + '</svg></div>';
}
function rcRow(label, valueHtml, opts){
  opts = opts || {};
  return '<div class="receipt-row' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
    '<span class="receipt-row-label">' + escapeHtml(label) + '</span>' +
    '<span class="receipt-row-value' + (opts.vcls ? ' ' + opts.vcls : '') + '">' + valueHtml + '</span></div>';
}

function renderReceipt(){
  const snapshot = Runtime.receipts[Runtime.receipts.length - 1];
  if (!snapshot){ R.go('home'); return ''; }
  const tx = snapshot.transactionId ? Runtime.transactions.find(x => x.id === snapshot.transactionId) : null;
  const r = tx ? Object.assign({}, snapshot, {
    reference: tx.reference || snapshot.reference,
    status: tx.status || snapshot.status,
    createdAt: tx.createdAt || snapshot.createdAt,
    amount: tx.amount != null ? tx.amount : snapshot.amount,
    currency: tx.currency || snapshot.currency,
    fee: tx.fee != null ? tx.fee : snapshot.fee,
    vat: tx.vat != null ? tx.vat : snapshot.vat,
    total: tx.total != null ? tx.total : snapshot.total,
    asset: tx.asset || snapshot.asset,
    network: tx.network || snapshot.network,
    destinationAmount: tx.destinationAmount != null ? tx.destinationAmount : snapshot.destinationAmount,
    destinationCurrency: tx.destinationCurrency || snapshot.destinationCurrency,
    exchangeRate: tx.exchangeRate || snapshot.exchangeRate,
    beneficiary: tx.beneficiary || snapshot.beneficiary,
    direction: tx.direction || snapshot.direction,
    kind: tx.kind || snapshot.kind
  }) : snapshot;
  const state = txState(r.status);                 /* the REAL status decides the whole screen */
  const isIn = r.direction === 'IN';
  const isCrypto = !!r.asset;
  const kindStr = String(r.kind || r.type || '').toUpperCase();
  const isTransfer = !isCrypto || /SEND|TRANSFER|TO_BANK/.test(kindStr);
  const country = r.beneficiary && r.beneficiary.country ? COUNTRY_DATA[r.beneficiary.country] : null;
  const cName = country ? (country[LANG] || country.en) : (r.beneficiary && r.beneficiary.networkName) ? r.beneficiary.networkName : (r.network || '—');
  const benName = receiptBenName(r.beneficiary);
  const masked = benName ? ContactsEngine.mask(benName) : '';
  const amtFmt = isCrypto ? CurrencyEngine.formatCrypto(r.amount, r.asset) : CurrencyEngine.format(r.amount, r.currency || 'OMR');
  const costInOMR = !!(r.costOMR && isCrypto);   /* crypto BUY: fee and total are paid in OMR */
  const feeFmt = (isCrypto && !costInOMR) ? CurrencyEngine.formatCrypto(r.fee || 0, r.asset) : CurrencyEngine.format(r.fee || 0, costInOMR ? 'OMR' : (r.currency || 'OMR'));
  const vatFmt = r.vat ? CurrencyEngine.format(r.vat, r.currency || 'OMR') : null;
  const totalFmt = (isCrypto && !costInOMR) ? CurrencyEngine.formatCrypto(r.total, r.asset) : CurrencyEngine.format(r.total, costInOMR ? 'OMR' : (r.currency || 'OMR'));
  /* Oman (OMR → OMR): nothing is converted, so no "recipient receives" line and no rate. Orange Money (OMR → XOF): both amounts are shown. */
  const hasCost = isCrypto || !!r.fee || !!r.vat || (r.total != null && Math.abs(Number(r.total) - Number(r.amount)) > 0.0005);
  const sameCur = !!(r.destinationCurrency && r.destinationCurrency === (r.currency || 'OMR'));
  const destFmt = (r.destinationAmount != null && !sameCur) ? CurrencyEngine.format(r.destinationAmount, r.destinationCurrency || (country ? country.cur : 'OMR')) : null;
  const rateTxt = (r.exchangeRate && r.destinationCurrency && !sameCur) ? ('1 ' + (r.currency || 'OMR') + ' = ' + Number(r.exchangeRate).toFixed(4) + ' ' + r.destinationCurrency) : '';
  const fromPhone = (isCrypto || isIn) ? '' : receiptSenderPhone();
  const title = state === 'failed' ? t('receipt.failed_title') : state === 'pending' ? t('receipt.pending_title2')
    : isIn ? t('receipt.received_title') : isTransfer ? t('success.title') : t('receipt.done_title');
  const sub = state === 'failed' ? t('receipt.failed_sub') : state === 'pending' ? t('receipt.pending_sub2') : '';
  const statusTxt = state === 'success' ? t('receipt.ok') : state === 'failed' ? t('tx.st.failed') : t('receipt.pending_status');
  const eyebrow = opLabel(r);
  const partyLabel = isIn ? t('receipt.sender') : t('receipt.beneficiary');
  const ref = dispId(String(r.reference || r.id || ''));
  const txId = dispId(String(r.transactionId || r.id || ''));
  window.__YOR_LAST_RECEIPT__ = r;
  window.__YOR_LAST_RECEIPT_VIEW__ = { amtFmt, feeFmt, vatFmt, totalFmt, hasCost, destFmt, fromPhone, date: fmtDate(r.createdAt), time: fmtTime(r.createdAt),
    statusTxt, state, title, sub, eyebrow, isIn, partyLabel,
    who: (r.beneficiary && (benName || r.beneficiary.phone || dispId(r.beneficiary.yorId))) || (country ? (country[LANG] || country.en) : (r.network || '')),
    rate: rateTxt };

  /* amounts: a failed operation draws no "total debited" line (it would claim a debit that did not happen) */
  let rows = '';
  if (fromPhone) rows += rcRow(t('receipt.from'), escapeHtml(fromPhone), { id: 'receipt-from', vcls: 'ltr' });
  if (!isIn && !isCrypto) rows += rcRow(t('receipt.paidFrom'), escapeHtml(t('receipt.paidFromVal') + ' · ' + (r.currency || 'OMR')));
  rows += rcRow(t(isIn ? 'receipt.amountReceived' : 'receipt.amountSent'), escapeHtml(amtFmt), { vcls: 'ltr' });
  if (destFmt) rows += rcRow(t('transfer.receiving'), escapeHtml(destFmt), { vcls: 'ltr acc' });
  if (rateTxt) rows += rcRow(t('transfer.rate'), escapeHtml(rateTxt), { vcls: 'ltr sm' });
  if (!isIn && state !== 'failed'){
    if (r.fee) rows += rcRow(t('receipt.fees'), escapeHtml(feeFmt), { vcls: 'ltr' });
    if (vatFmt) rows += rcRow(t('receipt.vat'), escapeHtml(vatFmt), { vcls: 'ltr' });
    /* 12.12.0: no fees on transfers -> "total debited" would repeat the amount; it is drawn only when it differs (older operations, crypto) */
    if (hasCost) rows += rcRow(t('receipt.totalDebit'), escapeHtml(totalFmt), { cls: 'total', vcls: 'ltr' });
  }
  /* "Make another transfer": a fiat transfer goes back to the start of the transfer flow, a crypto send to the crypto send flow; never for an incoming operation */
  const anotherNav = isIn ? '' : !isCrypto ? 'country-select' : /SEND/.test(kindStr) ? 'crypto-send' : '';
  const copyBtn = (val) => '<button type="button" class="rc-copy" data-action="copy-ref" data-copy="' + escapeHtml(val) + '" aria-label="' + escapeHtml(t('receipt.copy_ref')) + '">' + icon('copy', 14) + '</button>';
  const statement =
    '<div class="receipt-statement">' +
      '<div class="receipt-line"><span class="receipt-line-label">' + t('receipt.date') + '</span><span class="receipt-line-value">' + escapeHtml(fmtDate(r.createdAt)) + '</span></div>' +
      '<div class="receipt-line"><span class="receipt-line-label">' + t('receipt.hour') + '</span><span class="receipt-line-value">' + escapeHtml(fmtTime(r.createdAt)) + '</span></div>' +
      '<div class="receipt-line"><span class="receipt-line-label">' + t('receipt.status') + '</span><span class="receipt-line-value">' + statusPill(state, true, statusTxt) + '</span></div>' +
      '<div class="receipt-line"><span class="receipt-line-label">' + t('receipt.reference') + '</span><span class="receipt-line-value ltr mono" id="receipt-ref">' + escapeHtml(ref) + '</span>' + (ref ? copyBtn(ref) : '') + '</div>' +
      (txId && txId !== ref ? '<div class="receipt-line"><span class="receipt-line-label">' + t('receipt.id') + '</span><span class="receipt-line-value ltr mono sm">' + escapeHtml(txId) + '</span>' + copyBtn(txId) + '</div>' : '') +
    '</div>';

  return '<div class="receipt-view rc rc-' + state + '">' +
    '<div class="receipt-head">' + logoLockup(34) +
      '<button class="topbar-action" data-action="share-receipt" aria-label="' + t('ui.share') + '">' + icon('share', 18) + '</button>' +
    '</div>' +
    '<section class="receipt-hero">' + rcBadge(state) +
      '<div class="rc-amt ltr">' + escapeHtml(amtFmt) + '</div>' +
      (destFmt ? '<div class="rc-dest ltr">≈ ' + escapeHtml(destFmt) + '</div>' : '') +
      '<div class="receipt-title">' + escapeHtml(title) + '</div>' +
      (eyebrow ? '<div class="rc-eyebrow">' + escapeHtml(eyebrow) + '</div>' : '') +
      (sub ? '<div class="receipt-sub">' + escapeHtml(sub) + '</div>' : '') +
    '</section>' +
    '<section class="rc-sheet receipt-panel">' +
      '<div class="receipt-benef">' +
        '<div class="receipt-avatar">' + icon(isCrypto ? 'crypto' : 'user', 22) + '</div>' +
        '<div class="receipt-benef-body">' +
          '<div class="receipt-benef-label">' + escapeHtml(partyLabel) + '</div>' +
          (benName ? '<div class="receipt-benef-name">' + escapeHtml(benName) + '</div>' : '') +
          (r.beneficiary && r.beneficiary.phone ? '<div class="receipt-benef-phone ltr" dir="ltr">' + escapeHtml(typeof formatPhoneIntl === 'function' ? formatPhoneIntl(r.beneficiary.phone) : r.beneficiary.phone) + '</div>' : '') +
          (r.beneficiary && r.beneficiary.yorId ? '<div class="receipt-benef-yor ltr">' + escapeHtml(dispId(r.beneficiary.yorId)) + '</div>' : '') +
          (benName ? '<div class="recog-mask">' + escapeHtml(masked) + '</div>' : '') +
          (country ? '<div class="receipt-benef-country"><span class="receipt-flag">' + flag(country.iso) + '</span><span>' + escapeHtml(cName) + '</span></div>' : ((isCrypto || r.network) ? '<div class="receipt-benef-country"><span>' + escapeHtml(cName) + '</span></div>' : '')) +
        '</div>' +
      '</div>' +
      (r.network ? '<div class="receipt-service"><div class="receipt-service-body"><div class="receipt-benef-label">' + t('receipt.service') + '</div><div class="receipt-service-name">' + escapeHtml(r.network) + '</div></div></div>' : '') +
      '<div class="rc-tear" aria-hidden="true"></div>' +
      '<div class="rc-rows">' + rows + '</div>' +
      '<div class="rc-tear" aria-hidden="true"></div>' +
      statement +
    '</section>' +
    '<div class="rc-sheet receipt-panel rc-notice" id="receipt-notice" style="display:none" aria-live="polite"></div>' +
    '<div class="receipt-actions">' +
      '<button class="btn btn-secondary" data-action="share-receipt">' + icon('share', 18) + '<span>' + t('action.share') + '</span></button>' +
      '<button class="btn btn-secondary" data-action="download-pdf">' + icon('doc', 18) + '<span>PDF</span></button>' +
      '<button class="btn btn-secondary" data-action="download-receipt">' + icon('download', 18) + '<span>PNG</span></button>' +
      '<button class="btn btn-secondary" data-action="print-receipt">' + icon('doc', 18) + '<span>' + t('receipt.print') + '</span></button>' +
    '</div>' +
    (anotherNav ? '<button class="btn btn-primary rc-another" data-nav="' + anotherNav + '">' + t('receipt.another') + '</button>' : '') +
    '<button class="btn ' + (anotherNav ? 'btn-secondary' : 'btn-primary') + ' rc-done" data-action="done">' + t('receipt.back_home') + '</button>' +
  '</div>';
}
