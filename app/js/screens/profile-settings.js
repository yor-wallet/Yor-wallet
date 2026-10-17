'use strict';

/* 12.3.2 : the number that receives the SMS confirmation of each international transfer (saved in the user's own preferences). */
Object.assign(TR.en, {
  'confirm.title':'SMS confirmation number','confirm.desc':'After each transfer you get an SMS and an e-mail with the amount sent and your available balance. Enter your number with the country code.',
  'confirm.saved':'Number saved','confirm.removed':'Number removed','confirm.invalid':'Enter the number with the country code, for example +968 7798 6533'
});
Object.assign(TR.fr, {
  'confirm.title':'Numéro pour les confirmations SMS','confirm.desc':'Après chaque transfert, vous recevez un SMS et un e-mail avec le montant envoyé et votre solde disponible. Saisissez votre numéro avec l\'indicatif du pays.',
  'confirm.saved':'Numéro enregistré','confirm.removed':'Numéro supprimé','confirm.invalid':'Saisissez le numéro avec l\'indicatif, par exemple +968 7798 6533'
});
Object.assign(TR.ar, {
  'confirm.title':'رقم رسائل التأكيد','confirm.desc':'بعد كل تحويل تصلك رسالة نصية وبريد إلكتروني بالمبلغ المرسل ورصيدك المتاح. أدخل رقمك مع رمز الدولة.',
  'confirm.saved':'تم حفظ الرقم','confirm.removed':'تم حذف الرقم','confirm.invalid':'أدخل الرقم مع رمز الدولة، مثال +968 7798 6533'
});
/* '' = remove, null = invalid, otherwise "+" and 8 to 15 digits (a leading 00 becomes +) */
function normalizeConfirmPhone(raw){
  const v = String(raw == null ? '' : raw).trim();
  if (!v) return '';
  if (/[^\d+\s().-]/.test(v)) return null;
  let d = v.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (!/^\+\d{8,15}$/.test(d)) return null;
  return d;
}

function renderProfile(){
  const firstName = (Runtime.profile && Runtime.profile.firstName) || '';
  const lastName = (Runtime.profile && Runtime.profile.lastName) || '';
  const initials = ((firstName[0] || 'U') + (lastName[0] || 'S')).toUpperCase();
  const isAdmin = (Runtime.ctx && Runtime.ctx.role === 'admin');
  const yorId = (Runtime.ctx && Runtime.ctx.yorId) || '';
  const phone = (Runtime.profile && Runtime.profile.phone) || '';
  return '<div class="topbar"><span class="topbar-title">' + t('nav.profile') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div style="display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-4) 0">' +
        '<div style="width:calc(64px*var(--ui));height:calc(64px*var(--ui));border-radius:50%;background:linear-gradient(180deg,var(--accent),var(--accent-600));color:#fff;display:flex;align-items:center;justify-content:center;font-size:calc(22px*var(--ui));font-weight:700">' + initials + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:calc(18px*var(--ui));font-weight:700">' + escapeHtml((firstName + ' ' + lastName).trim() || '—') + '</div>' +
          (phone ? '<div class="ltr" style="font-family:var(--font-mono);font-size:calc(13px*var(--ui));color:var(--text-2);margin-top:calc(4px*var(--ui))">' + escapeHtml(phone) + '</div>' : '') +
          '<div style="display:inline-flex;align-items:center;gap:calc(6px*var(--ui));margin-top:calc(8px*var(--ui));padding:calc(4px*var(--ui)) calc(10px*var(--ui));border-radius:calc(999px*var(--ui));background:var(--accent-soft);color:var(--accent);font-family:var(--font-mono);font-size:calc(12px*var(--ui));font-weight:700;cursor:pointer" data-action="copy" data-copy="' + escapeHtml(dispId(yorId)) + '">' + icon('copy', 12) + ' <span class="ltr">' + escapeHtml(dispId(yorId)) + '</span></div>' +
          (isAdmin ? '<div class="badge badge-accent" style="margin-top:calc(8px*var(--ui));display:inline-block">ADMIN</div>' : '') +
        '</div></div>' +
      '<div class="glass">' +
        '<button class="item" data-nav="settings"><div class="tile">' + icon('settings', 20) + '</div><div class="item-body"><div class="item-title">' + t('profile.settings') + '</div></div><div class="item-chev">' + icon('chev', 18) + '</div></button>' +
        '<button class="item" data-nav="banks"><div class="tile">' + icon('bank', 20) + '</div><div class="item-body"><div class="item-title">' + t('settings.banks') + '</div></div><div class="item-chev">' + icon('chev', 18) + '</div></button>' +
        '<button class="item" data-nav="devices"><div class="tile">' + icon('device', 20) + '</div><div class="item-body"><div class="item-title">' + t('devices.title') + '</div></div><div class="item-chev">' + icon('chev', 18) + '</div></button>' +
        '<button class="item" data-nav="sessions"><div class="tile">' + icon('session', 20) + '</div><div class="item-body"><div class="item-title">' + t('sessions.title') + '</div></div><div class="item-chev">' + icon('chev', 18) + '</div></button>' +
        '<button class="item" data-action="sign-out"><div class="tile" style="background:var(--danger-bg);color:var(--danger)">' + icon('logout', 20) + '</div><div class="item-body"><div class="item-title" style="color:var(--danger)">' + t('profile.logout') + '</div></div></button>' +
      '</div>' +
    '</div>';
}
function contactCardHTML(c){
  return '<div class="contact-card" data-contact="' + c.id + '">' +
    '<div class="contact-avatar">' + escapeHtml((c.fullName || c.name || '').split(' ').map(w => w[0]).slice(0, 2).join('')) + '</div>' +
    '<div class="contact-info">' +
      '<div class="contact-number ltr">' + escapeHtml(c.number) + '</div>' +
      '<div class="contact-name ltr">' + escapeHtml(c.name) + '</div>' +
      '<div class="contact-fullname">' + escapeHtml(c.fullName || c.name) + '</div>' +
    '</div>' +
    (c.verified ? '<div class="contact-verified">' + icon('check', 10) + '</div>' : '') +
    '<button data-action="contact-remove" data-id="' + c.id + '" style="color:var(--danger);padding:calc(6px*var(--ui))" aria-label="' + t('ui.remove') + '">' + icon('close', 16) + '</button>' +
  '</div>';
}
/* 12.9.0 — Face ID row (replaces the old on/off biometric switch: Face ID is now mandatory where the device has it) */
const FID_TXT = {
  en:{ on:'On', off:'Off', na:'—', subOn:'Required to sign in and to confirm transfers', subOff:'Tap to turn on — required on this device', subNa:'Not available on this device — your PIN is used', req:'{N} is required and cannot be turned off.', unsup:'Not available on this device.', tapCopy:'Tap to copy' },
  fr:{ on:'Activé', off:'Désactivé', na:'—', subOn:'Obligatoire pour vous connecter et confirmer les transferts', subOff:'Touchez pour activer — obligatoire sur cet appareil', subNa:'Indisponible sur cet appareil — votre code est utilisé', req:'{N} est obligatoire et ne peut pas être désactivé.', unsup:'Indisponible sur cet appareil.', tapCopy:'Touchez pour copier' },
  ar:{ on:'مفعّل', off:'غير مفعّل', na:'—', subOn:'مطلوب لتسجيل الدخول وتأكيد التحويلات', subOff:'المس للتفعيل — مطلوب على هذا الجهاز', subNa:'غير متاح على هذا الجهاز — يُستخدم رمزك', req:'{N} مطلوب ولا يمكن إيقافه.', unsup:'غير متاح على هذا الجهاز.', tapCopy:'المس للنسخ' }
};
function faceIdText(k){
  let n = 'Face ID'; try { n = FaceId.name(); } catch(e){}
  return String(((FID_TXT[LANG] || FID_TXT.en)[k]) || FID_TXT.en[k] || '').replace(/\{N\}/g, n);
}
function faceIdRow(){
  let fi = { supported: null, enrolled: false, name: 'Face ID' };
  try { fi = FaceId.info(); } catch(e){}
  const na = fi.supported === false, on = !na && fi.enrolled;
  return '<button class="settings-row fid-row' + (on ? ' is-on' : '') + '" type="button" data-action="settings-faceid">' +
    '<div class="tile">' + icon('faceid', 20) + '</div>' +
    '<div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(fi.name) + '</div><div class="settings-row-sub">' + escapeHtml(faceIdText(na ? 'subNa' : on ? 'subOn' : 'subOff')) + '</div></div>' +
    '<span class="settings-value fid-state ' + (on ? 'on' : 'off') + '">' + escapeHtml(faceIdText(na ? 'na' : on ? 'on' : 'off')) + '</span></button>';
}
function renderSettings(){
  const setts = Runtime.settings || {};
  const sec = Runtime.security || {};
  const notifsOn = setts.notifications !== false;
  const vibOn = setts.vibration !== false;
  const txConfirmOn = sec.transactionConfirmationRequired !== false;
  const primaryCur = displayCurrency();   /* 12.6.0: default USD */
  const contactCount = Runtime.contacts.length;
  const bankCount = Runtime.bankAccounts.length;
  const isAdmin = Runtime.ctx && Runtime.ctx.role === 'admin';

  let html = '<div class="topbar">' +
      '<button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button>' +
      '<span class="topbar-title">' + t('settings.title') + '</span>' +
      '<span style="width:calc(44px*var(--ui))"></span>' +
    '</div>' +
    '<div class="screen-body" style="padding-top:var(--sp-2)">';

  html += settingsSection(t('settings.sectionProfile'));
  html += '<div class="settings-group">';
  html += '<div class="settings-row" style="cursor:default">' +
      '<div class="tile" style="background:' + (isAdmin ? 'linear-gradient(180deg,var(--accent),var(--accent-600))' : 'var(--accent-soft)') + ';color:' + (isAdmin ? '#fff' : 'var(--accent)') + '">' +
        (isAdmin ? icon('shield', 20) : icon('user', 20)) +
      '</div>' +
      '<div class="settings-row-body">' +
        '<div class="settings-row-title">' + escapeHtml(((Runtime.profile.firstName || '') + ' ' + (Runtime.profile.lastName || '')).trim() || '—') + '</div>' +
        '<div class="settings-row-sub">' + escapeHtml(dispId(Runtime.ctx.yorId || '')) + '</div>' +
      '</div>' +
      (isAdmin ? '<span class="badge badge-accent">ADMIN</span>' : '') +
    '</div>';
  html += '</div>';

  /* 12.9.0: the connected wallet lives here (it used to sit in the home balance card) */
  if (FEATURES.crypto){
    html += settingsSection(t('wc.section'));
    html += '<div class="nwc-wrap" data-nwc-slot>' + (typeof NexWC !== 'undefined' ? NexWC.cardHtml() : '') + '</div>';
  }

  html += settingsSection(t('confirm.title'));
  html += '<div class="settings-group">' +
    '<div class="settings-row" style="cursor:default"><div class="tile">' + icon('mobile', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + t('confirm.title') + '</div><div class="settings-row-sub">' + t('confirm.desc') + '</div></div></div>' +
    '<div style="padding:0 16px 14px;border-top:1px solid var(--border)">' +
      '<div class="field-box" style="margin-top:calc(10px*var(--ui))"><input type="tel" id="confirm-phone" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="+968 7798 6533" value="' + escapeHtml(setts.confirmPhone || '') + '"></div>' +
      '<div class="field-err" id="confirm-phone-err"></div>' +
      '<button class="btn btn-secondary" id="confirm-phone-save" type="button" style="margin-top:calc(8px*var(--ui))">' + t('action.save') + '</button>' +
    '</div>' +
  '</div>';

  html += settingsSection(t('settings.sectionPreferences'));
  html += '<div class="settings-group">' +
    '<div class="settings-row" style="cursor:default"><div class="tile">' + icon('globe', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + t('settings.language') + '</div><div class="settings-row-sub">' + t('settings.languages_list') + '</div></div></div>' +
    '<div style="padding:0 16px 12px;border-bottom:1px solid var(--border)">' +
      '<div class="chips" style="padding-top:2px">' + ['en','fr','ar'].map(l => '<button class="chip" data-lang="' + l + '" ' + (LANG === l ? 'aria-pressed="true"' : 'aria-pressed="false"') + '>' + (l === 'fr' ? 'Français' : l === 'en' ? 'English' : 'العربية') + '</button>').join('') + '</div>' +
    '</div>' +
    '<div class="settings-row" style="cursor:default"><div class="tile">' + icon('sparkle', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + t('settings.theme') + '</div><div class="settings-row-sub" id="set-theme-sub">' + t('theme.' + savedThemeMode()) + '</div></div></div>' +
    '<div style="padding:0 16px 12px;border-bottom:1px solid var(--border)">' +
      '<div class="chips" style="padding-top:2px">' + ['dark','light','system'].map(th => '<button class="chip" data-theme="' + th + '" ' + (savedThemeMode() === th ? 'aria-pressed="true"' : 'aria-pressed="false"') + '>' + t('theme.' + th) + '</button>').join('') + '</div>' +
    '</div>' +
    settingsToggleRow({ icon:'bell', title:t('settings.notifs'), sub:t('settings.notifsDesc'), checked:notifsOn, action:'settings-toggle-notifs' }) +
    Push.rowHtml() +     /* 12.13.0 : alertes sur le téléphone, même application fermée */
    settingsToggleRow({ icon:'vibrate', title:t('settings.vibration'), sub:t('settings.vibrationDesc'), checked:vibOn, action:'settings-toggle-vibration' }) +
    settingsToggleRow({ icon:'device', title:t('settings.desktopMode'), sub:t('settings.desktopModeDesc'), checked:LayoutMode.isDesktop(), action:'layout-toggle' }) +
  '</div>';

  html += settingsSection(t('settings.sectionSecurity'));
  html += '<div class="settings-group">' +
    faceIdRow() +
    settingsToggleRow({ icon:'lock', title:t('settings.txConfirm'), sub:t('settings.txConfirmDesc'), checked:txConfirmOn, action:'settings-toggle-txconfirm' }) +
    settingsLinkRow({ icon:'device', title:t('devices.title'), sub:t('devices.current'), nav:'devices' }) +
    settingsLinkRow({ icon:'session', title:t('sessions.title'), sub:t('sessions.current'), nav:'sessions' }) +
  '</div>';

  html += settingsSection(t('settings.sectionFinance'));
  html += '<div class="settings-group">' +
    (FEATURES.crypto ? settingsLinkRow({ icon:'bank', title:t('settings.banks'), sub: t('banks.choose_account') + ' · ' + bankCount, nav:'banks', value: String(bankCount) }) +
    settingsLinkRow({ icon:'network', title:t('settings.networks'), sub:t('crypto.networks'), nav:'crypto-networks' }) : '') +
    '<div class="settings-row" style="cursor:default"><div class="tile">' + icon('banknote', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + t('settings.primaryCurrency') + '</div><div class="settings-row-sub">' + t('settings.primaryCurrencyDesc') + '</div></div><span class="settings-value" id="set-cur-value">' + escapeHtml(primaryCur) + '</span></div>' +
    '<div style="padding:0 16px 12px;border-bottom:1px solid var(--border)">' +
      '<div class="chips" style="padding-top:2px;flex-wrap:wrap">' + ['OMR','USD','EUR','GBP','AED','SAR','XOF','XAF','QAR','EGP'].map(c => '<button class="chip" data-currency="' + c + '" ' + (primaryCur === c ? 'aria-pressed="true"' : 'aria-pressed="false"') + '>' + c + '</button>').join('') + '</div>' +
    '</div>' +
  '</div>';

  html += settingsSection(t('settings.sectionContacts'));
  html += '<div class="settings-group">' +
    '<div class="settings-row" style="cursor:default"><div class="tile">' + icon('contact', 20) + '</div><div class="settings-row-body"><div class="settings-row-title">' + t('settings.contacts') + '</div><div class="settings-row-sub">' + (contactCount === 1 ? t('settings.numbers_count_one') : tf('settings.numbers_count', { n: contactCount })) + '</div></div></div>' +
    '<div style="padding:calc(8px*var(--ui)) calc(12px*var(--ui));display:flex;flex-direction:column;gap:calc(10px*var(--ui));border-top:1px solid var(--border)">' +
      (contactCount ? Runtime.contacts.map(c => contactCardHTML(c)).join('') : '<div class="empty" style="padding:20px 0"><div class="empty-sub">' + t('contact.empty') + '</div></div>') +
      '<button class="btn btn-secondary" data-nav="contact-add" style="margin-top:calc(6px*var(--ui))">' + icon('plus', 18) + '<span>' + t('contact.add') + '</span></button>' +
    '</div>' +
  '</div>';

  html += settingsSection(t('settings.sectionAccount'));
  html += '<div class="settings-group">' +
    '<div class="settings-row" style="cursor:pointer" data-action="copy" data-copy="' + escapeHtml(dispId(Runtime.ctx.yorId || '')) + '">' +
      '<div class="tile">' + icon('copy', 20) + '</div>' +
      '<div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(t('transfer.yor_id_label')) + '</div><div class="settings-row-sub">' + escapeHtml(faceIdText('tapCopy')) + '</div></div>' +
      '<span class="settings-value ltr">' + escapeHtml(dispId(Runtime.ctx.yorId || '')) + '</span>' +
    '</div>' +
    settingsLinkRow({ icon:'shield', title:t('settings.privacy'), sub:t('settings.privacyDesc'), nav:'privacy' }) +
    settingsLinkRow({ icon:'help', title:t('settings.help'), sub:t('settings.helpDesc'), nav:'help' }) +
    settingsLinkRow({ icon:'info', title:t('settings.about'), sub:t('settings.aboutDesc'), nav:'about', value:'v' + CONFIG.APP.version }) +
    '<button class="settings-row" type="button" data-action="sign-out"><div class="tile" style="background:var(--danger-bg);color:var(--danger)">' + icon('logout', 20) + '</div><div class="settings-row-body"><div class="settings-row-title" style="color:var(--danger)">' + t('profile.logout') + '</div></div></button>' +
  '</div>';

  html += '<div style="height:var(--sp-6)"></div></div>';
  return html;
}
function renderContactAdd(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('contact.add') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="field"><label class="field-label">' + t('contact.number') + '</label><div class="field-box"><input type="tel" id="ct-number" inputmode="numeric" placeholder="77986544" autocomplete="off"></div></div>' +
      '<div class="field"><label class="field-label">' + t('contact.name') + '</label><div class="field-box"><input type="text" id="ct-name" placeholder="ADAME TOURE" autocomplete="off" style="text-transform:uppercase"></div></div>' +
      '<div class="field"><label class="field-label">' + t('contact.fullname') + '</label><div class="field-box"><input type="text" id="ct-fullname" placeholder="ADAME TOURE" autocomplete="off" style="text-transform:uppercase"></div></div>' +
      '<div class="glass-subtle" style="padding:calc(14px*var(--ui));margin-top:calc(8px*var(--ui))"><div class="caption">' + t('contact.preview') + '</div><div id="ct-preview" style="margin-top:calc(8px*var(--ui));font-family:var(--font-mono);font-weight:700">—</div></div>' +
      '<div class="field-err" id="ct-err"></div>' +
      '<button class="btn btn-primary" id="ct-save" style="margin-top:calc(12px*var(--ui))">' + t('action.save') + '</button>' +
    '</div>';
}
