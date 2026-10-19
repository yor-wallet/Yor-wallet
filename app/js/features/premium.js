'use strict';

/* ============================================================
   Friendly Pay 12.14.0 — premium layer
   Home, Receive, global search, Profile (+ edit), transfer outcome screen (refused / uncertain), balance change animation.
   Rules kept from earlier versions: every number shown is read from the server data in Runtime; nothing is invented, no balance,
   reference, status or verification state is ever simulated. Loaded after js/screens/register.js (it registers the screens it owns)
   and before js/wire.js. Styles: css/premium.css (last stylesheet).
   ============================================================ */
Object.assign(TR.en, {
  'px.morning':'Good morning','px.afternoon':'Good afternoon','px.evening':'Good evening','px.available':'Available balance',
  'px.acctActive':'Account active','px.acctOther':'Account: {s}','px.send':'Send','px.receive':'Receive','px.history':'History','px.more':'More',
  'px.recent':'Recent activity','px.seeAll':'See all','px.search':'Search','px.searchPh':'Transactions, references, settings…',
  'px.sTx':'Transactions','px.sPeople':'Recipients','px.sScreens':'Screens and settings','px.sNone':'No result for “{q}”','px.sHint':'Search your real transactions by name, number, reference or amount.',
  'px.profile':'Profile','px.openProfile':'Open my profile','px.notifs':'Notifications',
  'px.rcvTitle':'Receive money','px.rcvLead':'Share your account details. Every amount credited to your Friendly Pay balance appears here and in your history, with its real status.',
  'px.rcvId':'Your Friendly ID','px.rcvPhone':'Your mobile number','px.rcvShare':'Share my details','px.rcvCopy':'Copy',
  'px.rcvNote':'Transfers made to a mobile number leave Friendly Pay (the recipient is told by SMS); they do not credit a Friendly Pay balance.',
  'px.rcvRecent':'Money received','px.rcvNone':'Nothing received yet','px.rcvNoneD':'Confirmed credits will be listed here.',
  'px.shareText':'My Friendly Pay details — Friendly ID: {id}',
  'px.edit':'Edit profile','px.personal':'Personal information','px.first':'First name','px.last':'Last name','px.phone':'Mobile number','px.email':'E-mail','px.country':'Country','px.accountId':'Account ID',
  'px.verif':'Account verification','px.kyc.VERIFIED':'Verified','px.kyc.PENDING':'Verification in progress','px.kyc.REJECTED':'Verification refused','px.kyc.UNVERIFIED':'Not verified',
  'px.kycD.VERIFIED':'Your identity has been confirmed by Friendly Pay.','px.kycD.PENDING':'Your documents are being reviewed. Nothing to do for now.',
  'px.kycD.REJECTED':'Your verification was not accepted. Contact support to know what is needed.','px.kycD.UNVERIFIED':'Identity verification is not offered in the app yet. No document is requested for now.',
  'px.security':'Security','px.pinChange':'Change personal code','px.pinChangeD':'6 digits, asked to confirm every transfer','px.pinOldT':'Current code','px.pinOldS':'Enter your current 6-digit code.','px.pinNewT':'New code','px.pinSame':'Choose a code different from the current one.','px.pinDone':'Personal code changed',
  'px.prefs':'Preferences','px.language':'Language','px.theme':'Theme','px.dispCur':'Display currency','px.support':'Help and information','px.version':'Version {v}',
  'px.save':'Save','px.saved':'Profile saved','px.nameErr':'Enter 1 to 60 letters (no digits).','px.readOnly':'Your mobile number identifies your account and your SMS confirmations. To change it, contact support.',
  'px.offlineSend':'No internet connection: nothing was sent. Try again once you are online.',
  'px.failT':'Transfer not completed','px.failD':'The server refused this transfer. No money left your account.',
  'px.uncT':'Status to be checked','px.uncD':'We did not receive the server’s answer (connection lost or too slow). The transfer may or may not have been recorded. Check its status before trying again: it will never be sent twice automatically.',
  'px.check':'Check the status','px.checking':'Checking…','px.notFound':'No transfer was recorded for this request. You can try again.','px.unknownYet':'The status could not be read yet. Check your connection, then try again or look at your history.',
  'px.retry':'Try again','px.editAmount':'Change the amount','px.goHistory':'Open history','px.home':'Back to home','px.amount':'Amount','px.to':'To',
  'px.balUp':'Balance updated','px.legal':'Terms and privacy','px.showBal':'Show balance','px.hideBal':'Hide balance'
});
Object.assign(TR.fr, {
  'px.morning':'Bonjour','px.afternoon':'Bon après-midi','px.evening':'Bonsoir','px.available':'Solde disponible',
  'px.acctActive':'Compte actif','px.acctOther':'Compte : {s}','px.send':'Envoyer','px.receive':'Recevoir','px.history':'Historique','px.more':'Plus',
  'px.recent':'Activité récente','px.seeAll':'Voir tout','px.search':'Rechercher','px.searchPh':'Opérations, références, réglages…',
  'px.sTx':'Opérations','px.sPeople':'Bénéficiaires','px.sScreens':'Écrans et réglages','px.sNone':'Aucun résultat pour « {q} »','px.sHint':'Retrouvez vos vraies opérations par nom, numéro, référence ou montant.',
  'px.profile':'Profil','px.openProfile':'Ouvrir mon profil','px.notifs':'Notifications',
  'px.rcvTitle':'Recevoir de l’argent','px.rcvLead':'Partagez les informations de votre compte. Chaque montant crédité sur votre solde Friendly Pay apparaît ici et dans l’historique, avec son statut réel.',
  'px.rcvId':'Votre Friendly ID','px.rcvPhone':'Votre numéro de mobile','px.rcvShare':'Partager mes informations','px.rcvCopy':'Copier',
  'px.rcvNote':'Les transferts vers un numéro de mobile sortent de Friendly Pay (le destinataire est prévenu par SMS) : ils ne créditent pas un solde Friendly Pay.',
  'px.rcvRecent':'Argent reçu','px.rcvNone':'Rien reçu pour l’instant','px.rcvNoneD':'Les crédits confirmés seront listés ici.',
  'px.shareText':'Mes informations Friendly Pay — Friendly ID : {id}',
  'px.edit':'Modifier le profil','px.personal':'Informations personnelles','px.first':'Prénom','px.last':'Nom','px.phone':'Numéro de mobile','px.email':'E-mail','px.country':'Pays','px.accountId':'Identifiant du compte',
  'px.verif':'Vérification du compte','px.kyc.VERIFIED':'Vérifié','px.kyc.PENDING':'Vérification en cours','px.kyc.REJECTED':'Vérification refusée','px.kyc.UNVERIFIED':'Non vérifié',
  'px.kycD.VERIFIED':'Votre identité a été confirmée par Friendly Pay.','px.kycD.PENDING':'Vos documents sont en cours d’examen. Rien à faire pour le moment.',
  'px.kycD.REJECTED':'Votre vérification n’a pas été acceptée. Contactez l’assistance pour savoir quoi fournir.','px.kycD.UNVERIFIED':'La vérification d’identité n’est pas encore proposée dans l’application. Aucun document n’est demandé pour le moment.',
  'px.security':'Sécurité','px.pinChange':'Modifier le code personnel','px.pinChangeD':'6 chiffres, demandé pour confirmer chaque transfert','px.pinOldT':'Code actuel','px.pinOldS':'Saisissez votre code actuel à 6 chiffres.','px.pinNewT':'Nouveau code','px.pinSame':'Choisissez un code différent du code actuel.','px.pinDone':'Code personnel modifié',
  'px.prefs':'Préférences','px.language':'Langue','px.theme':'Thème','px.dispCur':'Devise d’affichage','px.support':'Aide et informations','px.version':'Version {v}',
  'px.save':'Enregistrer','px.saved':'Profil enregistré','px.nameErr':'Saisissez de 1 à 60 lettres (sans chiffres).','px.readOnly':'Votre numéro identifie votre compte et vos confirmations SMS. Pour le changer, contactez l’assistance.',
  'px.offlineSend':'Pas de connexion Internet : rien n’a été envoyé. Réessayez une fois connecté.',
  'px.failT':'Transfert non abouti','px.failD':'Le serveur a refusé ce transfert. Aucun montant n’a quitté votre compte.',
  'px.uncT':'Statut à vérifier','px.uncD':'La réponse du serveur ne nous est pas parvenue (connexion perdue ou trop lente). Le transfert a pu être enregistré, ou non. Vérifiez son statut avant de recommencer : il ne sera jamais envoyé deux fois automatiquement.',
  'px.check':'Vérifier le statut','px.checking':'Vérification…','px.notFound':'Aucun transfert n’a été enregistré pour cette demande. Vous pouvez réessayer.','px.unknownYet':'Le statut n’a pas encore pu être lu. Vérifiez votre connexion, puis réessayez ou consultez l’historique.',
  'px.retry':'Réessayer','px.editAmount':'Modifier le montant','px.goHistory':'Voir l’historique','px.home':'Retour à l’accueil','px.amount':'Montant','px.to':'À',
  'px.balUp':'Solde mis à jour','px.legal':'Conditions et confidentialité','px.showBal':'Afficher le solde','px.hideBal':'Masquer le solde'
});
Object.assign(TR.ar, {
  'px.morning':'صباح الخير','px.afternoon':'مساء الخير','px.evening':'مساء الخير','px.available':'الرصيد المتاح',
  'px.acctActive':'الحساب نشط','px.acctOther':'الحساب: {s}','px.send':'إرسال','px.receive':'استلام','px.history':'السجل','px.more':'المزيد',
  'px.recent':'آخر العمليات','px.seeAll':'عرض الكل','px.search':'بحث','px.searchPh':'العمليات، المراجع، الإعدادات…',
  'px.sTx':'العمليات','px.sPeople':'المستفيدون','px.sScreens':'الشاشات والإعدادات','px.sNone':'لا نتائج لـ «{q}»','px.sHint':'ابحث في عملياتك الحقيقية بالاسم أو الرقم أو المرجع أو المبلغ.',
  'px.profile':'الملف الشخصي','px.openProfile':'فتح ملفي الشخصي','px.notifs':'الإشعارات',
  'px.rcvTitle':'استلام الأموال','px.rcvLead':'شارك بيانات حسابك. كل مبلغ يُضاف إلى رصيدك في فرندي باي يظهر هنا وفي السجل بحالته الحقيقية.',
  'px.rcvId':'معرّف فرندي الخاص بك','px.rcvPhone':'رقم هاتفك','px.rcvShare':'مشاركة بياناتي','px.rcvCopy':'نسخ',
  'px.rcvNote':'التحويلات إلى رقم هاتف تخرج من فرندي باي (يُبلَّغ المستلم برسالة نصية)، ولا تُضاف إلى رصيد في فرندي باي.',
  'px.rcvRecent':'الأموال المستلمة','px.rcvNone':'لم يصلك شيء بعد','px.rcvNoneD':'ستظهر هنا المبالغ المؤكدة.',
  'px.shareText':'بياناتي في فرندي باي — المعرّف: {id}',
  'px.edit':'تعديل الملف','px.personal':'المعلومات الشخصية','px.first':'الاسم الأول','px.last':'اسم العائلة','px.phone':'رقم الهاتف','px.email':'البريد الإلكتروني','px.country':'الدولة','px.accountId':'معرّف الحساب',
  'px.verif':'التحقق من الحساب','px.kyc.VERIFIED':'تم التحقق','px.kyc.PENDING':'التحقق جارٍ','px.kyc.REJECTED':'رُفض التحقق','px.kyc.UNVERIFIED':'لم يتم التحقق',
  'px.kycD.VERIFIED':'تم تأكيد هويتك من قِبل فرندي باي.','px.kycD.PENDING':'وثائقك قيد المراجعة. لا شيء مطلوب منك الآن.',
  'px.kycD.REJECTED':'لم يُقبل التحقق. تواصل مع الدعم لمعرفة المطلوب.','px.kycD.UNVERIFIED':'التحقق من الهوية غير متاح في التطبيق بعد. لا تُطلب أي وثيقة حالياً.',
  'px.security':'الأمان','px.pinChange':'تغيير الرمز الشخصي','px.pinChangeD':'6 أرقام، يُطلب لتأكيد كل تحويل','px.pinOldT':'الرمز الحالي','px.pinOldS':'أدخل رمزك الحالي المكوّن من 6 أرقام.','px.pinNewT':'الرمز الجديد','px.pinSame':'اختر رمزاً مختلفاً عن الرمز الحالي.','px.pinDone':'تم تغيير الرمز الشخصي',
  'px.prefs':'التفضيلات','px.language':'اللغة','px.theme':'المظهر','px.dispCur':'عملة العرض','px.support':'المساعدة والمعلومات','px.version':'الإصدار {v}',
  'px.save':'حفظ','px.saved':'تم حفظ الملف','px.nameErr':'أدخل من 1 إلى 60 حرفاً (بدون أرقام).','px.readOnly':'رقم هاتفك يعرّف حسابك ورسائل التأكيد. لتغييره تواصل مع الدعم.',
  'px.offlineSend':'لا يوجد اتصال بالإنترنت: لم يُرسل أي شيء. أعد المحاولة بعد الاتصال.',
  'px.failT':'لم يكتمل التحويل','px.failD':'رفض الخادم هذا التحويل. لم يُخصم أي مبلغ من حسابك.',
  'px.uncT':'الحالة بحاجة إلى تحقق','px.uncD':'لم يصلنا رد الخادم (انقطع الاتصال أو كان بطيئاً). ربما سُجّل التحويل وربما لا. تحقّق من حالته قبل إعادة المحاولة: لن يُرسل مرتين تلقائياً أبداً.',
  'px.check':'التحقق من الحالة','px.checking':'جارٍ التحقق…','px.notFound':'لم يُسجَّل أي تحويل لهذا الطلب. يمكنك إعادة المحاولة.','px.unknownYet':'تعذّرت قراءة الحالة بعد. تحقّق من الاتصال ثم أعد المحاولة أو راجع السجل.',
  'px.retry':'إعادة المحاولة','px.editAmount':'تعديل المبلغ','px.goHistory':'فتح السجل','px.home':'العودة إلى الرئيسية','px.amount':'المبلغ','px.to':'إلى',
  'px.balUp':'تم تحديث الرصيد','px.legal':'الشروط والخصوصية','px.showBal':'إظهار الرصيد','px.hideBal':'إخفاء الرصيد'
});


/* 13.0.0 — horizontal lock: these containers are never meant to scroll sideways. If anything (focus, keyboard, scrollIntoView,
   an iOS gesture) shifts one of them, it is put back at once, so the page can never stay stuck to the left. */
(function lockSideways(){
  const fix = el => { if (el && el.scrollLeft) el.scrollLeft = 0; };
  const all = () => [document.scrollingElement, document.body, document.getElementById('app'), document.getElementById('main'), document.getElementById('screens')];
  const onScroll = e => { const t = e.target === document ? document.scrollingElement : e.target; if (t && all().indexOf(t) !== -1) fix(t); if (window.scrollX) window.scrollTo(0, window.scrollY); };
  try { document.addEventListener('scroll', onScroll, { capture:true, passive:true }); window.addEventListener('resize', () => all().forEach(fix), { passive:true }); window.addEventListener('focusin', () => setTimeout(() => all().forEach(fix), 60)); } catch(e){}
})();

/* ---------- small shared helpers ---------- */
const pxReduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; } };
/* "+96891234567" -> "+968 •••• 4567" (only the last 4 digits are shown outside the edit screen) */
function maskPhone(p){
  const raw = String(p || '').trim(), d = raw.replace(/\D/g, '');
  if (d.length < 6) return raw ? '••••' : '';
  const om = /^968\d{8}$/.test(d);
  return (om ? '+968 ' : (raw.charAt(0) === '+' ? '+' : '') + d.slice(0, Math.max(1, d.length - 8)) + ' ') + '•••• ' + d.slice(-4);
}
/* "sajad@example.com" -> "s•••@example.com" */
function maskEmail(e){
  const m = /^([^@]+)@(.+)$/.exec(String(e || '').trim());
  return m ? m[1].charAt(0) + '•••@' + m[2] : '';
}
function pxInitials(p){
  p = p || {};
  const a = (p.firstName || p.displayName || '').trim(), b = (p.lastName || '').trim();
  const s = ((a[0] || '') + (b[0] || '')).toUpperCase();
  return s || 'FP';
}
function pxAvatar(p, cls){
  p = p || {};
  return '<span class="px-ava' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + (p.photo ? '<img src="' + escapeHtml(p.photo) + '" alt="">' : escapeHtml(pxInitials(p))) + '</span>';
}
function pxGreeting(){
  const h = new Date().getHours();
  return t(h < 12 ? 'px.morning' : h < 18 ? 'px.afternoon' : 'px.evening');
}
/* lower-case, digits of Arabic-Indic numerals as ASCII, no accents: used to compare a search with stored values */
function pxNorm(s){
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
/* does a transaction match the query? name, phone, reference (FRD- or YOR-), amount, operation label */
function txMatches(tx, q){
  const n = pxNorm(q).trim();
  if (!n) return true;
  const b = tx.beneficiary || {};
  const hay = [b.name, b.phone, formatPhoneIntl(b.phone || ''), b.yorId ? dispId(b.yorId) : '', tx.reference, dispId(String(tx.reference || '')),
    tx.amount != null ? Number(tx.amount).toFixed(3) : '', tx.amount != null ? String(tx.amount) : '', opLabel(tx), tx.note].map(pxNorm).join(' | ');
  const digits = n.replace(/\D/g, '');
  if (hay.indexOf(n) !== -1) return true;
  /* a number typed with spaces or "+" (phone, amount) also matches stored digits; a query with letters never falls back to digits only */
  return /^[\d\s+().,-]+$/.test(n) && digits.length >= 3 && hay.replace(/[^\d|]/g, '').indexOf(digits) !== -1;
}

/* ============================================================
   BALANCE CHANGE — when the REAL balance read from the server differs from the one shown last time in this session, the number counts
   from the old value to the new one (≈0.7 s) and the card glows once. The final text is always the exact formatted server value.
   ============================================================ */
const BalanceFx = (() => {
  let last = null;              /* { key, value } — memory only, never stored */
  function check(main){
    const key = String((Runtime.ctx && Runtime.ctx.uid) || '') + ':' + String(main.currency || '');
    const v = Number(main.balance);
    const prev = last && last.key === key ? last.value : null;
    last = { key, value: v };
    return (prev != null && isFinite(prev) && isFinite(v) && Math.abs(prev - v) > 0.0005) ? prev : null;
  }
  function run(el, from, main){
    if (!el || Runtime.hideBalance) return;
    const card = el.closest('.ds-balance');
    if (card){ card.classList.remove('px-bump'); void card.offsetWidth; card.classList.add('px-bump'); }
    if (pxReduced()) return;
    const finalHtml = el.innerHTML, to = Number(main.balance), t0 = performance.now(), dur = 700;
    const step = now => {
      if (!el.isConnected){ return; }
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      if (k >= 1){ el.innerHTML = finalHtml; return; }
      const dv = balanceView(from + (to - from) * e, main.currency);
      const code = String(dv.currency).toUpperCase();
      el.innerHTML = escapeHtml(CurrencyEngine.format(dv.amount, code)).replace(code, '<span class="rv-cur">' + code + '</span>');
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  return { check, run };
})();

/* ============================================================
   TRANSFER OUTCOME — shown when a transfer was REFUSED (certain: the database rolled back) or is UNCERTAIN (no answer read).
   The uncertain screen never sends the transfer again. "Check the status" asks the server for the outcome of the SAME request
   (same idempotency key, no PIN grant: it can only read, never create). A late answer of the original request is still honoured.
   ============================================================ */
const TxResult = (() => {
  let cur = null, checking = false;
  function show(r){
    cur = Object.assign({ note:'' }, r);
    if (cur.late && typeof cur.late.then === 'function'){
      const mine = cur;
      cur.late.then(out => {
        if (cur !== mine) return;
        if (out && out.ok && out.receipt) confirmed(out.receipt, true);
        else if (out && !out.ok && !out.uncertain){ mine.kind = 'failed'; mine.error = out.error; if (R.current() === 'tx-result') R.go('tx-result', { force:true, reset:true }); }
      }).catch(() => {});
    }
    R.go('tx-result', { reset:true });            /* no way "back" to the confirmation screen: retrying is an explicit choice */
  }
  function current(){ return cur; }
  async function confirmed(receipt, alreadySaved){
    if (!alreadySaved){ try { await recordLocalReceipt(receipt); } catch(e){ Runtime.receipts.push(receipt); } }
    cur = null;
    try { InAppNotif.showCall({ title: t('notif.fiat_sent'), message: receipt.beneficiary && (receipt.beneficiary.name || formatPhoneIntl(receipt.beneficiary.phone)), amount: CurrencyEngine.format(receipt.amount, receipt.currency || 'OMR'), status:'success' }); } catch(e){}
    R.go('receipt');
  }
  async function check(btn){
    if (!cur || checking) return;
    checking = true;
    const note = document.getElementById('txr-note');
    if (btn){ btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.querySelector('span').textContent = t('px.checking'); }
    const r = await TransferEngine.checkExternal(cur.req);
    checking = false;
    if (r.state === 'confirmed'){
      const sv = r.data, q = cur.req;
      return confirmed({ id: ID.receipt(), transactionId: sv.transactionId, status: 'SUCCESS', amount: sv.amount, currency: 'OMR', fee: sv.fee, vat: sv.vat, total: sv.total,
        destinationAmount: sv.destinationAmount, destinationCurrency: sv.destinationCurrency, exchangeRate: sv.exchangeRate,
        beneficiary: { name: cur.name, phone: q.beneficiary.phone, country: 'OM', networkName: q.provider || null }, network: q.provider || null,
        reference: sv.reference, createdAt: Date.now() });
    }
    cur.note = r.state === 'not_found' ? 'notFound' : 'unknownYet';
    if (r.state === 'not_found') cur.checkedEmpty = true;
    R.go('tx-result', { force:true, reset:true });
    if (note) note.focus && note.focus();
  }
  function render(){
    if (!cur){ setTimeout(() => R.go('home', { reset:true }), 0); return ''; }
    const unc = cur.kind === 'uncertain';
    const badge = unc
      ? '<div class="rc-badge st-pending px-q" role="img" aria-label="' + escapeHtml(t('px.uncT')) + '"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle class="rc-c" cx="32" cy="32" r="29"/><path class="rc-k" d="M25 25.5a7 7 0 1 1 9.6 6.5c-1.6.7-2.6 2-2.6 3.8V37M32 44.5v.5"/></svg></div>'
      : rcBadge('failed');
    const reason = !unc && cur.error && cur.error !== 'errors.UNKNOWN_ERROR' ? '<p class="px-reason">' + escapeHtml(t(cur.error)) + '</p>' : '';
    const note = cur.note ? '<p class="px-note" id="txr-note" tabindex="-1" role="status">' + escapeHtml(t('px.' + cur.note)) + '</p>' : '<p class="px-note" id="txr-note" role="status" hidden></p>';
    const q = cur.req || {};
    const acts = unc && !cur.checkedEmpty
      ? '<button class="btn btn-primary" data-px="txr-check">' + icon('search', 18) + '<span>' + escapeHtml(t('px.check')) + '</span></button>' +
        '<button class="btn btn-secondary" data-px="txr-history">' + icon('history', 18) + '<span>' + escapeHtml(t('px.goHistory')) + '</span></button>'
      : '<button class="btn btn-primary" data-px="txr-retry">' + icon('send', 18) + '<span>' + escapeHtml(t('px.retry')) + '</span></button>' +
        '<button class="btn btn-secondary" data-px="txr-amount"><span>' + escapeHtml(t('px.editAmount')) + '</span></button>';
    return '<div class="px-result receipt-view rc rc-' + (unc ? 'pending' : 'failed') + '">' +
      '<section class="receipt-hero">' + badge +
        (q.amount ? '<div class="rc-amt ltr">' + escapeHtml(CurrencyEngine.format(q.amount, 'OMR')) + '</div>' : '') +
        '<h1 class="receipt-title">' + escapeHtml(t(unc ? 'px.uncT' : 'px.failT')) + '</h1>' +
        (cur.phone ? '<div class="px-to">' + escapeHtml(t('px.to')) + ' <b class="ltr" dir="ltr">' + escapeHtml((cur.name ? cur.name + ' · ' : '') + formatPhoneIntl(cur.phone)) + '</b></div>' : '') +
      '</section>' +
      '<section class="rc-sheet receipt-panel px-explain"><p>' + escapeHtml(t(unc ? 'px.uncD' : 'px.failD')) + '</p>' + reason + note + '</section>' +
      '<div class="px-result-acts">' + acts + '<button class="btn btn-ghost" data-px="txr-home">' + escapeHtml(t('px.home')) + '</button></div>' +
    '</div>';
  }
  function wire(root){
    root.onclick = e => {                         /* onclick, not addEventListener: the section stays between renders */
      const b = e.target.closest && e.target.closest('[data-px]'); if (!b) return;
      const a = b.getAttribute('data-px');
      if (a === 'txr-check') check(b);
      else if (a === 'txr-history'){ R.go('history', { reset:true }); }
      else if (a === 'txr-retry'){ cur = null; R.go(TX_STATE.beneficiary && TX_STATE.amount ? 'tx-review' : 'country-select'); }
      else if (a === 'txr-amount'){ cur = null; R.go(TX_STATE.beneficiary ? 'tx-amount' : 'country-select'); }
      else if (a === 'txr-home'){ cur = null; txReset(); R.go('home', { reset:true }); }
    };
  }
  return { show, current, render, wire, check };
})();

/* ============================================================
   SEARCH — one sheet over the data already loaded for this account: transactions, recipients, screens and settings.
   ============================================================ */
const PxSearch = (() => {
  const SCREENS = () => [
    ['country-select', 'send', t('px.send')], ['receive', 'receive', t('px.receive')], ['history', 'history', t('px.history')], ['cards', 'cards', V12.vt('cards')],
    ['profile', 'user', t('px.profile')], ['profile-edit', 'user', t('px.edit')], ['settings', 'settings', t('settings.title')], ['notifications', 'bell', t('px.notifs')],
    ['settings', 'globe', t('px.language')], ['settings', 'sparkle', t('px.theme')], ['settings', 'banknote', t('px.dispCur')], ['settings', 'bell', t('settings.notifs')],
    ['px:pin', 'lock', t('px.pinChange')], ['devices', 'device', t('devices.title')], ['sessions', 'session', t('sessions.title')],
    ['help', 'help', t('settings.help')], ['privacy', 'shield', t('settings.privacy')], ['about', 'info', t('settings.about')]
  ];
  let close = null;
  function people(q){
    const seen = {}, out = [];
    const add = (name, phone) => {
      const k = String(phone || name || '').replace(/\s/g, ''); if (!k || seen[k]) return; seen[k] = 1;
      if (pxNorm([name, phone, formatPhoneIntl(phone || '')].join(' ')).indexOf(pxNorm(q).trim()) === -1 && String(phone || '').replace(/\D/g, '').indexOf(String(q).replace(/\D/g, '') || '§') === -1) return;
      out.push({ name, phone });
    };
    visibleTransactions(Runtime.transactions || []).forEach(x => { if (x.direction !== 'IN' && x.beneficiary && x.beneficiary.phone) add(receiptBenName(x.beneficiary), x.beneficiary.phone); });
    (Runtime.contacts || []).forEach(c => add(c.fullName || c.name, c.number));
    return out.slice(0, 5);
  }
  function results(q){
    const n = pxNorm(q).trim();
    if (!n) return '<p class="px-s-hint">' + escapeHtml(t('px.sHint')) + '</p>';
    const txs = visibleTransactions(Runtime.transactions || []).filter(x => txMatches(x, q)).slice(0, 8);
    const ppl = people(q);
    const scr = SCREENS().filter(s => pxNorm(s[2]).indexOf(n) !== -1).slice(0, 6);
    if (!txs.length && !ppl.length && !scr.length) return '<p class="px-s-hint">' + escapeHtml(tf('px.sNone', { q: q.trim() })) + '</p>';
    let h = '';
    if (txs.length) h += '<h3 class="px-s-h">' + escapeHtml(t('px.sTx')) + '</h3><div class="rv-list ds-list">' + txs.map(x => txRow(x, !!Runtime.hideBalance)).join('') + '</div>';
    if (ppl.length) h += '<h3 class="px-s-h">' + escapeHtml(t('px.sPeople')) + '</h3><div class="settings-group">' + ppl.map(p =>
      '<button class="settings-row" type="button" data-pxs-phone="' + escapeHtml(p.phone) + '" data-pxs-name="' + escapeHtml(p.name || '') + '"><div class="tile">' + icon('user', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(p.name || formatPhoneIntl(p.phone)) + '</div>' + (p.name ? '<div class="settings-row-sub ltr" dir="ltr">' + escapeHtml(formatPhoneIntl(p.phone)) + '</div>' : '') + '</div><span class="settings-row-chev">' + icon('send', 16) + '</span></button>').join('') + '</div>';
    if (scr.length) h += '<h3 class="px-s-h">' + escapeHtml(t('px.sScreens')) + '</h3><div class="settings-group">' + scr.map(s =>
      '<button class="settings-row" type="button" data-pxs-nav="' + s[0] + '"><div class="tile">' + icon(s[1], 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(s[2]) + '</div></div><span class="settings-row-chev">' + icon('chev', 18) + '</span></button>').join('') + '</div>';
    return h;
  }
  function open(){
    if (close){ try { close(); } catch(e){} }
    close = R.overlay.open(
      '<div class="px-search" role="search"><div class="px-s-bar"><span class="px-s-ic">' + icon('search', 18) + '</span>' +
        '<input id="px-s-in" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + escapeHtml(t('px.searchPh')) + '" aria-label="' + escapeHtml(t('px.search')) + '">' +
        '<button type="button" class="px-s-x" data-pxs-close aria-label="' + escapeHtml(t('pin.cancel')) + '">' + escapeHtml(t('pin.cancel')) + '</button></div>' +
        '<div class="px-s-res" id="px-s-res" aria-live="polite">' + results('') + '</div></div>',
      { kind:'sheet', onClose: () => { close = null; } });
    (() => {                                       /* wired at once: the sheet is in the page as soon as open() returns */
      const inp = document.getElementById('px-s-in'), res = document.getElementById('px-s-res');
      if (!inp || !res) return;
      let tm = 0;
      inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { res.innerHTML = results(inp.value); }, 90); });
      try { inp.focus({ preventScroll:true }); } catch(e){}
      const panel = inp.closest('.px-search');
      panel.addEventListener('click', e => {
        const el = e.target.closest && e.target.closest('[data-pxs-close],[data-pxs-nav],[data-pxs-phone],[data-action="view-tx"]'); if (!el) return;
        const c = close; close = null; if (c) c();
        if (el.hasAttribute('data-pxs-close')) return;
        if (el.hasAttribute('data-pxs-nav')){ const n = el.getAttribute('data-pxs-nav'); if (n === 'px:pin') Premium.changePin(); else R.go(n); return; }
        if (el.hasAttribute('data-pxs-phone')){ Premium.sendTo(el.getAttribute('data-pxs-phone'), el.getAttribute('data-pxs-name')); return; }
        openTxReceipt(el.getAttribute('data-tx'));
      });
    })();
  }
  return { open, results };
})();


/* ============================================================
   INSTALL WITHOUT AN APP STORE (12.14.0) — Friendly Pay is a web app (PWA): it is added to the home screen from its HTTPS address.
   iPhone / iPad (Safari): Apple offers no install button to web pages; the card shows the two real steps (Share → Add to Home Screen).
   Android / desktop Chrome / Edge: the browser's own install prompt (beforeinstallprompt) is used when it is offered.
   Nothing is shown once the app runs from its icon (standalone). "Later" hides the card for 14 days on this device.
   ============================================================ */
Object.assign(TR.en, { 'pi.title':'Install Friendly Pay on this phone', 'pi.sub':'Opens full screen from its own icon, like an app. No App Store needed.', 'pi.ios1':'Tap the Share button', 'pi.ios2':'Choose “Add to Home Screen”', 'pi.ios3':'Open Friendly Pay from the new icon', 'pi.iosOther':'On iPhone, open this page in Safari to install it.', 'pi.go':'Install', 'pi.later':'Later', 'pi.row':'Install the app', 'pi.rowD':'Add Friendly Pay to your home screen', 'pi.note':'Friendly Pay is a web app: it is not an App Store app and it uses only what Safari allows.' });
Object.assign(TR.fr, { 'pi.title':'Installer Friendly Pay sur ce téléphone', 'pi.sub':'S’ouvre en plein écran depuis sa propre icône, comme une application. Sans App Store.', 'pi.ios1':'Touchez le bouton Partager', 'pi.ios2':'Choisissez « Sur l’écran d’accueil »', 'pi.ios3':'Ouvrez Friendly Pay depuis la nouvelle icône', 'pi.iosOther':'Sur iPhone, ouvrez cette page dans Safari pour l’installer.', 'pi.go':'Installer', 'pi.later':'Plus tard', 'pi.row':'Installer l’application', 'pi.rowD':'Ajouter Friendly Pay à l’écran d’accueil', 'pi.note':'Friendly Pay est une application web : ce n’est pas une application de l’App Store et elle n’utilise que ce que Safari autorise.' });
Object.assign(TR.ar, { 'pi.title':'ثبّت فرندي باي على هذا الهاتف', 'pi.sub':'يفتح بملء الشاشة من أيقونته مثل التطبيقات. دون متجر App Store.', 'pi.ios1':'المس زر المشاركة', 'pi.ios2':'اختر «إضافة إلى الشاشة الرئيسية»', 'pi.ios3':'افتح فرندي باي من الأيقونة الجديدة', 'pi.iosOther':'على iPhone افتح هذه الصفحة في Safari لتثبيتها.', 'pi.go':'تثبيت', 'pi.later':'لاحقاً', 'pi.row':'تثبيت التطبيق', 'pi.rowD':'أضف فرندي باي إلى الشاشة الرئيسية', 'pi.note':'فرندي باي تطبيق ويب: ليس من متجر App Store ويستخدم فقط ما يسمح به Safari.' });
const PxInstall = (() => {
  let deferred = null;
  const KEY = 'fp_install_later';
  const ua = () => navigator.userAgent || '';
  const isIos = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = () => /Safari\//.test(ua()) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua());
  const standalone = () => { try { return navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch(e){ return false; } };
  try { window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; }); window.addEventListener('appinstalled', () => { deferred = null; }); } catch(e){}
  /* 'installed' | 'ios' (Safari: manual steps) | 'ios-other' (another iOS browser) | 'prompt' (native prompt available) | 'none' */
  function mode(){
    if (standalone()) return 'installed';
    if (isIos()) return isSafari() ? 'ios' : 'ios-other';
    return deferred ? 'prompt' : 'none';
  }
  function snoozed(){ try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch(e){ return false; } }
  const shareIc = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  const addIc = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  function steps(m){
    if (m === 'ios-other') return '<p class="pi-sub">' + escapeHtml(t('pi.iosOther')) + '</p>';
    if (m !== 'ios') return '';
    return '<ol class="pi-steps"><li><span class="pi-n">1</span><span>' + escapeHtml(t('pi.ios1')) + '</span><span class="pi-ic">' + shareIc + '</span></li>' +
      '<li><span class="pi-n">2</span><span>' + escapeHtml(t('pi.ios2')) + '</span><span class="pi-ic">' + addIc + '</span></li>' +
      '<li><span class="pi-n">3</span><span>' + escapeHtml(t('pi.ios3')) + '</span><span class="pi-ic pi-logo">' + logoMark(18) + '</span></li></ol>';
  }
  function card(force){
    const m = mode();
    if (m === 'installed' || m === 'none' || (!force && snoozed())) return '';
    return '<section class="pi-card" data-pi-card>' + '<div class="pi-head">' + logoMark(40) + '<div><b>' + escapeHtml(t('pi.title')) + '</b><p class="pi-sub">' + escapeHtml(t('pi.sub')) + '</p></div></div>' +
      steps(m) +
      '<div class="pi-acts">' + (m === 'prompt' ? '<button class="btn btn-primary" data-pi="go">' + addIc + '<span>' + escapeHtml(t('pi.go')) + '</span></button>' : '') +
        (force ? '' : '<button class="btn btn-ghost" data-pi="later">' + escapeHtml(t('pi.later')) + '</button>') + '</div>' +
      '<p class="pi-note">' + escapeHtml(t('pi.note')) + '</p></section>';
  }
  function settingsRow(){
    const m = mode();
    if (m === 'installed' || m === 'none') return '';
    return '<button class="settings-row" type="button" data-pi="sheet"><div class="tile">' + icon('mobile', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(t('pi.row')) + '</div><div class="settings-row-sub">' + escapeHtml(t('pi.rowD')) + '</div></div><span class="settings-row-chev">' + icon('chev', 18) + '</span></button>';
  }
  async function prompt(){
    if (!deferred) return;
    const d = deferred; deferred = null;
    try { await d.prompt(); await d.userChoice; } catch(e){}
    document.querySelectorAll('[data-pi-card]').forEach(c => c.remove());
  }
  function wire(root){
    root.querySelectorAll('[data-pi]').forEach(b => {
      b.onclick = () => {
        const a = b.getAttribute('data-pi');
        if (a === 'go') prompt();
        else if (a === 'later'){ try { localStorage.setItem(KEY, String(Date.now() + 14 * 864e5)); } catch(e){} const c = b.closest('[data-pi-card]'); if (c) c.remove(); }
        else if (a === 'sheet'){ const close = R.overlay.open('<div class="pi-sheet">' + card(true) + '</div>', { kind:'sheet' }); setTimeout(() => { const sh = document.querySelector('.pi-sheet'); if (sh) wire(sh); }, 30); }
      };
    });
  }
  return { mode, card, settingsRow, wire, standalone };
})();

/* ============================================================
   SCREENS
   ============================================================ */
const Premium = (() => {
  const topbar = (title, back) => '<div class="topbar px-topbar">' + (back !== false ? '<button class="topbar-back" data-action="back" aria-label="' + escapeHtml(t('ui.back')) + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button>' : '<span style="width:calc(44px*var(--ui))"></span>') +
    '<span class="topbar-title">' + escapeHtml(title) + '</span><span style="width:calc(44px*var(--ui))"></span></div>';
  const money = (a, c) => { const code = String(c || 'OMR').toUpperCase(); return escapeHtml(CurrencyEngine.format(a, code)).replace(code, '<span class="rv-cur">' + code + '</span>'); };
  const MASK = '••••••';
  let balFrom = null;

  /* ---------- Home ---------- */
  function renderHome(){
    if (!Runtime.ctx && !Runtime.profile) return skeletonHome();             /* nothing loaded yet: shapes only, no numbers */
    const main = mainAccount(), hide = !!Runtime.hideBalance, p = Runtime.profile || {};
    const unread = (Runtime.notifications || []).filter(n => !n.read).length;
    const txs = visibleTransactions(Runtime.transactions || []).slice(0, 5);
    const dv = balanceView(main.balance, main.currency);
    const showAvail = main.availableBalance != null && Math.abs(Number(main.availableBalance) - Number(main.balance)) > 0.0005;
    const st = String(main.status || '').toUpperCase();
    const acct = !main.id ? '' : st === 'ACTIVE' ? '<span class="px-chip ok"><i></i>' + escapeHtml(t('px.acctActive')) + '</span>'
      : st ? '<span class="px-chip warn"><i></i>' + escapeHtml(tf('px.acctOther', { s: st.toLowerCase() })) + '</span>' : '';
    const yid = Runtime.ctx && Runtime.ctx.yorId ? dispId(Runtime.ctx.yorId) : '';
    balFrom = BalanceFx.check(main);
    let ai = 0;
    const act = (nav, ic, lbl, pr) => '<button class="rv-act px-act' + (pr ? ' p' : '') + '" style="--i:' + (ai++) + '" data-nav="' + nav + '"><i>' + icon(ic, 24) + '</i><span>' + escapeHtml(lbl) + '</span></button>';
    const cardsHtml = (Runtime.cards || []).length ? '<section class="rv-sec px-sec"><div class="rv-h"><h2>' + escapeHtml(V12.vt('cards')) + '</h2><button data-nav="cards">' + escapeHtml(t('px.seeAll')) + '</button></div><div class="rv-strip">' +
      Runtime.cards.map(c => '<button class="rv-mini th-' + escapeHtml(c.theme || 'midnight') + (c.frozen ? ' fz' : '') + '" data-nav="cards" aria-label="' + escapeHtml((c.label || V12.vt('defName')) + ' •••• ' + String(c.number || '').slice(-4)) + '"><span class="ltr">•••• ' + escapeHtml(String(c.number || '0000').slice(-4)) + '</span></button>').join('') +
      '<button class="rv-mini rv-mini-add" data-nav="cards-add">' + icon('plus', 20) + '<span>' + escapeHtml(V12.vt('addCard')) + '</span></button></div></section>' : '';
    /* other money accounts (e.g. XOF): shown in the display currency, original amount always visible (same rules as 12.6.0) */
    const others = (Runtime.accounts || []).filter(a => a.type !== 'CRYPTO' && a.type !== 'MAIN').slice(0, 4);
    const othersHtml = others.length ? '<section class="rv-sec px-sec"><div class="rv-h"><h2>' + escapeHtml(V12.vt('accounts')) + '</h2></div><div class="rv-grid2">' +
      others.map(a => { const v = balanceView(a.balance, a.currency); return '<div class="rv-tile"><small>' + escapeHtml(a.name || a.currency) + '</small><b class="ltr">' + (hide ? escapeHtml(MASK) : money(v.amount, v.currency)) + '</b>' +
        (!hide && v.converted ? '<span class="rv-cap ltr">' + escapeHtml(CurrencyEngine.format(v.orig.amount, v.orig.currency)) + '</span>' : '') + '</div>'; }).join('') + '</div></section>' : '';
    return '<div class="rv-home ds-home px-home">' +
      '<header class="px-top">' +
        '<button class="px-me" data-nav="profile" aria-label="' + escapeHtml(t('px.openProfile')) + '">' + pxAvatar(p) + '</button>' +
        '<div class="px-hello"><span>' + escapeHtml(pxGreeting()) + '</span><b>' + escapeHtml(p.firstName || p.displayName || 'Friendly Pay') + '</b></div>' +
        '<button class="rv-circ px-circ" data-px="search" aria-label="' + escapeHtml(t('px.search')) + '">' + icon('search', 20) + '</button>' +
        '<button class="rv-circ px-circ" data-action="notifications" aria-label="' + escapeHtml(t('px.notifs') + (unread ? ' (' + unread + ')' : '')) + '">' + icon('bell', 20) + (unread ? '<span class="rv-bdg">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>' +
      '</header>' +
      '<section class="ds-balance px-bal" aria-label="' + escapeHtml(t('px.available')) + '">' +
        '<i class="px-bal-light" aria-hidden="true"></i><i class="px-bal-grain" aria-hidden="true"></i>' +
        '<div class="ds-bal-top"><span class="ds-bal-label">' + escapeHtml(t('px.available')) + '</span>' + acct +
          '<button class="ds-eye" data-action="toggle-balance" aria-pressed="' + (hide ? 'true' : 'false') + '" aria-label="' + escapeHtml(t(hide ? 'px.showBal' : 'px.hideBal')) + '">' + icon(hide ? 'eyeOff' : 'eye', 20) + '</button></div>' +
        '<div class="ds-bal-amt ltr' + (hide ? ' is-hidden' : '') + '" id="px-bal-amt">' + (hide ? escapeHtml(MASK) : money(dv.amount, dv.currency)) + '</div>' +
        (dv.converted && !hide ? '<div class="ds-bal-orig ltr">' + escapeHtml(CurrencyEngine.format(main.balance, main.currency)) + ' · 1 ' + escapeHtml(main.currency) + ' = ' + dv.rate.toFixed(4) + ' ' + escapeHtml(dv.currency) + '</div>' : '') +
        (showAvail && !hide ? '<div class="ds-bal-sub">' + escapeHtml(t('ds.available')) + ' <b class="ltr">' + money(balanceView(main.availableBalance, main.currency).amount, balanceView(main.availableBalance, main.currency).currency) + '</b></div>' : '') +
        '<div class="px-bal-foot">' + (yid ? '<span class="px-bal-id ltr" dir="ltr">' + escapeHtml(yid) + '</span>' : '<span></span>') +
          '<button class="px-bal-link" data-nav="history"><span>' + escapeHtml(t('px.history')) + '</span>' + '<span class="dir-flip" style="display:inline-flex">' + icon('chev', 16) + '</span></button></div>' +
      '</section>' +
      '<nav class="rv-acts px-acts" aria-label="' + escapeHtml(t('px.more')) + '">' + act('country-select', 'send', t('px.send'), true) + act('receive', 'receive', t('px.receive')) + act('history', 'history', t('px.history')) + act('services', 'apps', t('px.more')) + '</nav>' +
      PxInstall.card() +
      '<section class="rv-sec px-sec"><div class="rv-h"><h2>' + escapeHtml(t('px.recent')) + '</h2><button data-nav="history">' + escapeHtml(t('px.seeAll')) + '</button></div>' +
        (txs.length ? txGroupedHtml(txs, hide) : '<div class="rv-list">' + emptyState('history', V12.vt('noTx'), t('ds.nohist_body')) + '</div>') + '</section>' +
      othersHtml +
      (typeof Promos !== 'undefined' ? Promos.html() : '') +
      cardsHtml +
      '<div style="height:calc(20px + var(--safe-b))"></div></div>';
  }

  /* ---------- Receive ---------- */
  function renderReceive(){
    const p = Runtime.profile || {}, yid = Runtime.ctx && Runtime.ctx.yorId ? dispId(Runtime.ctx.yorId) : '';
    const phone = p.phone ? formatPhoneIntl(p.phone) : '';
    const ins = visibleTransactions(Runtime.transactions || []).filter(x => x.direction === 'IN').slice(0, 10);
    const row = (lbl, val, copy) => '<div class="px-kv"><small>' + escapeHtml(lbl) + '</small><b class="ltr" dir="ltr">' + escapeHtml(val) + '</b>' +
      '<button class="px-copy" data-action="copy" data-copy="' + escapeHtml(copy) + '" aria-label="' + escapeHtml(t('px.rcvCopy') + ' ' + lbl) + '">' + icon('copy', 16) + '</button></div>';
    return topbar(t('px.rcvTitle')) +
      '<div class="screen-body px-rcv" style="padding-top:0">' +
        '<section class="px-rcv-card">' + pxAvatar(p, 'lg') + '<h2>' + escapeHtml(((p.firstName || '') + ' ' + (p.lastName || '')).trim() || '—') + '</h2>' +
          (yid ? row(t('px.rcvId'), yid, yid) : '') + (phone ? row(t('px.rcvPhone'), phone, phone) : '') +
          (yid ? '<button class="btn btn-primary" data-px="rcv-share">' + icon('share', 18) + '<span>' + escapeHtml(t('px.rcvShare')) + '</span></button>' : '') +
        '</section>' +
        '<p class="px-lead">' + escapeHtml(t('px.rcvLead')) + '</p>' +
        '<p class="px-info">' + icon('info', 16) + '<span>' + escapeHtml(t('px.rcvNote')) + '</span></p>' +
        '<section class="rv-sec px-sec"><div class="rv-h"><h2>' + escapeHtml(t('px.rcvRecent')) + '</h2></div>' +
          (ins.length ? txGroupedHtml(ins, !!Runtime.hideBalance) : '<div class="rv-list">' + emptyState('receive', t('px.rcvNone'), t('px.rcvNoneD')) + '</div>') + '</section>' +
      '</div>';
  }

  /* ---------- Profile ---------- */
  function kycOf(p){
    const s = String(((p || {}).kyc || {}).status || 'UNVERIFIED').toUpperCase();
    return ['VERIFIED', 'PENDING', 'REJECTED'].indexOf(s) !== -1 ? s : 'UNVERIFIED';       /* anything else is NOT shown as verified */
  }
  const row = (ic, title, sub, attrs, value, danger) => '<button class="settings-row" type="button" ' + attrs + '><div class="tile"' + (danger ? ' style="background:var(--danger-bg);color:var(--danger)"' : '') + '>' + icon(ic, 20) + '</div>' +
    '<div class="settings-row-body"><div class="settings-row-title"' + (danger ? ' style="color:var(--danger)"' : '') + '>' + escapeHtml(title) + '</div>' + (sub ? '<div class="settings-row-sub">' + escapeHtml(sub) + '</div>' : '') + '</div>' +
    (value ? '<span class="settings-value">' + escapeHtml(value) + '</span>' : '') + (danger ? '' : '<span class="settings-row-chev">' + icon('chev', 18) + '</span>') + '</button>';
  const info = (ic, title, value, ltr) => '<div class="settings-row px-static"><div class="tile">' + icon(ic, 20) + '</div><div class="settings-row-body"><div class="settings-row-sub">' + escapeHtml(title) + '</div><div class="settings-row-title' + (ltr ? ' ltr" dir="ltr' : '') + '">' + value + '</div></div></div>';
  function renderProfile(){
    const p = Runtime.profile || {}, ctx = Runtime.ctx || {};
    const name = ((p.firstName || '') + ' ' + (p.lastName || '')).trim() || '—';
    const yid = ctx.yorId ? dispId(ctx.yorId) : '';
    const kyc = kycOf(p), c = COUNTRY_DATA[p.country || ''] || null;
    const langName = LANG === 'fr' ? 'Français' : LANG === 'ar' ? 'العربية' : 'English';
    return topbar(t('px.profile')) +
      '<div class="screen-body px-prof" style="padding-top:0">' +
        '<section class="px-hero">' + pxAvatar(p, 'xl') +
          '<div class="px-hero-body"><h1>' + escapeHtml(name) + '</h1>' +
            (p.phone ? '<span class="px-hero-sub ltr" dir="ltr">' + escapeHtml(maskPhone(p.phone)) + '</span>' : '') +
            '<div class="px-hero-chips">' + (yid ? '<button class="px-chip id" data-action="copy" data-copy="' + escapeHtml(yid) + '" aria-label="' + escapeHtml(t('px.rcvCopy') + ' ' + yid) + '">' + icon('copy', 12) + '<span class="ltr">' + escapeHtml(yid) + '</span></button>' : '') +
              '<span class="px-chip ' + (kyc === 'VERIFIED' ? 'ok' : kyc === 'REJECTED' ? 'bad' : kyc === 'PENDING' ? 'warn' : 'muted') + '"><i></i>' + escapeHtml(t('px.kyc.' + kyc)) + '</span>' +
              (ctx.role === 'admin' ? '<span class="px-chip muted">ADMIN</span>' : '') + '</div></div>' +
          '<button class="btn btn-secondary px-hero-edit" data-nav="profile-edit">' + icon('user', 16) + '<span>' + escapeHtml(t('px.edit')) + '</span></button>' +
        '</section>' +
        settingsSection(t('px.personal')) + '<div class="settings-group">' +
          info('user', t('px.first'), escapeHtml(p.firstName || '—')) + info('user', t('px.last'), escapeHtml(p.lastName || '—')) +
          (p.phone ? info('mobile', t('px.phone'), escapeHtml(maskPhone(p.phone)), true) : '') +
          (p.email ? info('mail', t('px.email'), escapeHtml(maskEmail(p.email)), true) : '') +
          (c ? info('globe', t('px.country'), '<span class="px-flag">' + flag(c.iso) + '</span> ' + escapeHtml(c[LANG] || c.en)) : '') +
          (yid ? info('wallet', t('px.accountId'), escapeHtml(yid), true) : '') +
        '</div>' +
        settingsSection(t('px.verif')) + '<div class="settings-group"><div class="settings-row px-static"><div class="tile">' + icon('shield', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(t('px.kyc.' + kyc)) + '</div><div class="settings-row-sub">' + escapeHtml(t('px.kycD.' + kyc)) + '</div></div></div></div>' +
        settingsSection(t('px.security')) + '<div class="settings-group">' +
          row('lock', t('px.pinChange'), t('px.pinChangeD'), 'data-px="pin"') +
          (typeof faceIdRow === 'function' ? faceIdRow() : '') +
          row('device', t('devices.title'), t('devices.current'), 'data-nav="devices"') +
          row('session', t('sessions.title'), t('sessions.current'), 'data-nav="sessions"') +
        '</div>' +
        settingsSection(t('px.prefs')) + '<div class="settings-group">' +
          row('globe', t('px.language'), '', 'data-nav="settings"', langName) +
          row('sparkle', t('px.theme'), '', 'data-nav="settings"', t('theme.' + savedThemeMode())) +
          row('banknote', t('px.dispCur'), '', 'data-nav="settings"', displayCurrency()) +
          row('bell', t('px.notifs'), t('settings.notifsDesc'), 'data-nav="settings"') +
        '</div>' +
        settingsSection(t('px.support')) + '<div class="settings-group">' +
          row('help', t('settings.help'), t('settings.helpDesc'), 'data-nav="help"') +
          row('shield', t('px.legal'), t('settings.privacyDesc'), 'data-nav="privacy"') +
          row('info', t('settings.about'), tf('px.version', { v: CONFIG.APP.version }), 'data-nav="about"') +
        '</div>' +
        '<div class="settings-group" style="margin-top:var(--sp-5)">' + row('logout', t('profile.logout'), '', 'data-action="sign-out"', '', true) + '</div>' +
        '<p class="px-ver ltr">Friendly Pay ' + escapeHtml(CONFIG.APP.version) + '</p>' +
      '</div>';
  }
  /* first / last name: the only profile fields the server lets the person change here (column grants on public.profiles) */
  const NAME_RE = /^[\p{L}][\p{L}\p{M}' .-]{0,59}$/u;
  function renderProfileEdit(){
    const p = Runtime.profile || {}, c = COUNTRY_DATA[p.country || ''] || null;
    const field = (id, lbl, val, ac) => '<div class="field"><label class="field-label" for="' + id + '">' + escapeHtml(lbl) + '</label><div class="field-box"><input id="' + id + '" type="text" maxlength="60" autocomplete="' + ac + '" value="' + escapeHtml(val || '') + '"></div></div>';
    return topbar(t('px.edit')) +
      '<div class="screen-body px-edit" style="padding-top:0">' +
        '<div class="px-edit-ava">' + pxAvatar(p, 'xl') + '</div>' +
        field('pe-first', t('px.first'), p.firstName, 'given-name') + field('pe-last', t('px.last'), p.lastName, 'family-name') +
        '<div class="field-err" id="pe-err" role="alert"></div>' +
        '<div class="settings-group">' +
          (p.phone ? info('mobile', t('px.phone'), escapeHtml(formatPhoneIntl(p.phone)), true) : '') +
          (c ? info('globe', t('px.country'), '<span class="px-flag">' + flag(c.iso) + '</span> ' + escapeHtml(c[LANG] || c.en)) : '') +
        '</div>' +
        '<p class="px-info">' + icon('info', 16) + '<span>' + escapeHtml(t('px.readOnly')) + '</span></p>' +
        '<button class="btn btn-primary" id="pe-save" type="button">' + escapeHtml(t('px.save')) + '</button>' +
      '</div>';
  }
  async function saveProfile(btn){
    const f = document.getElementById('pe-first'), l = document.getElementById('pe-last'), err = document.getElementById('pe-err');
    const first = f.value.trim().replace(/\s+/g, ' '), last = l.value.trim().replace(/\s+/g, ' ');
    [f, l].forEach(x => x.closest('.field-box').classList.remove('has-err'));
    const bad = [[f, first], [l, last]].filter(x => !NAME_RE.test(x[1]));
    if (bad.length){ bad.forEach(x => x[0].closest('.field-box').classList.add('has-err')); err.textContent = t('px.nameErr'); bad[0][0].focus(); return; }
    err.textContent = '';
    UIKit.loading(btn, true);
    try {
      const uid = UserContext.requireCtx().uid;
      const { error } = await sb.from('profiles').update({ first_name: first, last_name: last }).eq('id', uid);
      if (error) throw error;
      Runtime.profile.firstName = first; Runtime.profile.lastName = last;
      toast(t('px.saved'), 'success');
      R.go('profile', { replace:true });
    } catch(e){ console.error(e); err.textContent = t('errors.UNKNOWN_ERROR'); }
    finally { UIKit.loading(btn, false); }
  }
  async function changePin(){
    const r = await PinEngine.change();
    if (r.ok) toast(t('px.pinDone'), 'success');
    else if (!r.cancelled && r.msg) toast(r.msg, 'error');
  }
  /* search → recipient: open the transfer with the number already typed (the person still checks it and continues) */
  function sendTo(phone, name){
    txReset();
    R.go('country-select');
    setTimeout(() => {
      const inp = document.getElementById('sp-num'); if (!inp) return;
      inp.value = omFormatLocal(omLocalDigits(phone));
      inp.dispatchEvent(new Event('input', { bubbles:true }));
    }, 60);
  }
  async function share(){
    const yid = Runtime.ctx && Runtime.ctx.yorId ? dispId(Runtime.ctx.yorId) : ''; if (!yid) return;
    const text = tf('px.shareText', { id: yid });
    if (navigator.share){ try { await navigator.share({ title: 'Friendly Pay', text }); return; } catch(e){ if (e && e.name === 'AbortError') return; } }
    copyText(text);
  }

  /* ---------- wiring (called by wire() for every screen) ---------- */
  function onScreen(id, root){
    if (!root || root === document) return;
    if (id === 'home'){
      root.querySelectorAll('[data-px="search"]').forEach(b => { b.onclick = () => PxSearch.open(); });
      const el = document.getElementById('px-bal-amt');
      if (balFrom != null && el){ const from = balFrom; balFrom = null; BalanceFx.run(el, from, mainAccount()); }
    }
    if (id === 'receive') root.querySelectorAll('[data-px="rcv-share"]').forEach(b => { b.onclick = share; });
    if (id === 'profile' || id === 'settings') root.querySelectorAll('[data-px="pin"]').forEach(b => { b.onclick = changePin; });
    if (id === 'profile-edit'){
      const b = document.getElementById('pe-save'); if (b) b.onclick = () => saveProfile(b);
      root.querySelectorAll('#pe-first,#pe-last').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); b.click(); } }; });
    }
    if (id === 'tx-result') TxResult.wire(root);
    if (id === 'home' || id === 'settings') PxInstall.wire(root);
    if (id === 'history') wireHistory(root);
    /* a scrolled screen gets a solid top bar (the bar stays readable over the content) */
    if (!root.__pxScroll){ root.__pxScroll = true; root.addEventListener('scroll', () => { root.classList.toggle('px-scrolled', root.scrollTop > 6); }, { passive:true }); }
    root.classList.remove('px-scrolled');
  }
  function wireHistory(root){
    const list = document.getElementById('history-list'); if (!list) return;
    const redraw = () => { const on = root.querySelector('[data-filter][aria-pressed="true"]'); list.innerHTML = historyListHtml(on ? on.getAttribute('data-filter') : 'all'); };
    const q = document.getElementById('hist-q');
    if (q){ let tm = 0; q.value = HIST.q; q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { HIST.q = q.value; redraw(); }, 120); }); }
    root.querySelectorAll('[data-hp],[data-hd]').forEach(ch => {
      ch.onclick = () => {
        const k = ch.hasAttribute('data-hp') ? 'data-hp' : 'data-hd';
        root.querySelectorAll('[' + k + ']').forEach(c => c.setAttribute('aria-pressed', c === ch ? 'true' : 'false'));
        if (k === 'data-hp') HIST.period = ch.getAttribute('data-hp'); else HIST.dir = ch.getAttribute('data-hd');
        redraw();
      };
    });
  }
  return { renderHome, renderReceive, renderProfile, renderProfileEdit, onScreen, changePin, sendTo, share };
})();

R.register({ home: Premium.renderHome, receive: Premium.renderReceive, profile: Premium.renderProfile, 'profile-edit': Premium.renderProfileEdit, 'tx-result': TxResult.render });
