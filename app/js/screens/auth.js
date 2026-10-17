'use strict';

/* ============================================================
   RENDER FUNCTIONS — all read from Runtime (current user only)
   ============================================================ */
function mainAccount(){
  return (Runtime.accounts || []).find(a => a.type === 'MAIN') || { balance:0, availableBalance:0, currency:'OMR', name:'Main OMR', id:null };
}

function renderLogin(){
  return '<div class="topbar"><span class="topbar-title">Friendly Pay</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:var(--sp-4);max-width:calc(460px*var(--ui));margin:0 auto;width:100%">' +
      '<div style="display:flex;justify-content:center;padding:var(--sp-4) 0">' + logoLockup(56) + '</div>' +
      '<div class="field"><label class="field-label" for="au-email">' + t('auth.username') + '</label><div class="field-box"><input type="email" id="au-email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" class="ltr"></div></div>' +
      '<div class="field"><label class="field-label" for="au-pass">' + t('auth.code') + '</label><div class="field-box"><input type="password" id="au-pass" autocomplete="current-password" class="ltr"><button type="button" class="field-icon" data-auth-toggle="au-pass" aria-label="' + t('auth.show') + '" style="padding:calc(6px*var(--ui))">' + icon('eye', 18) + '</button></div></div>' +
      '<div class="field-err" id="login-err" style="text-align:center" role="alert"></div>' +
      '<button class="btn btn-primary" id="au-submit" type="button">' + t('auth.signin') + '</button>' +
      '<button class="btn btn-ghost" id="au-to-signup" type="button">' + t('auth.noAccount') + '</button>' +
      '<button class="btn btn-ghost" id="au-to-reset" type="button" style="font-size:calc(13px*var(--ui))">' + t('auth.forgot') + '</button>' +
    '</div>';
}

/* dial-code picker for the mandatory sign-up phone (12.6.0): "OM +968", Oman first */
function signupDialSelect(){
  const data = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : { OM:{ iso:'OM', dial:'+968', en:'Oman' } };
  const lang = (typeof LANG !== 'undefined' && data.OM && data.OM[LANG]) ? LANG : 'en';
  const rows = Object.keys(data).map(k => data[k]).filter(c => c && c.dial);
  return '<select id="su-dial" class="su-dial" aria-label="' + t('auth.dial') + '">' + rows.map(c =>
    '<option value="' + escapeHtml(c.iso) + '" data-dial="' + escapeHtml(c.dial) + '"' + (c.iso === 'OM' ? ' selected' : '') + '>' + escapeHtml(c.iso + ' ' + c.dial) + '</option>').join('') + '</select>';
}

function renderSignup(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('auth.signupTitle') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:var(--sp-4);max-width:calc(460px*var(--ui));margin:0 auto;width:100%">' +
      '<div style="display:flex;justify-content:center;padding:var(--sp-2) 0">' + logoLockup(48) + '</div>' +
      '<div class="field"><label class="field-label" for="su-first">' + t('auth.firstName') + '</label><div class="field-box"><input type="text" id="su-first" autocomplete="given-name"></div></div>' +
      '<div class="field"><label class="field-label" for="su-last">' + t('auth.lastName') + '</label><div class="field-box"><input type="text" id="su-last" autocomplete="family-name"></div></div>' +
      '<div class="field"><label class="field-label" for="su-email">' + t('auth.username') + '</label><div class="field-box"><input type="email" id="su-email" autocomplete="email" autocapitalize="off" spellcheck="false" class="ltr"></div></div>' +
      '<div class="field"><label class="field-label" for="su-phone">' + t('auth.phone') + ' *</label><div class="field-box su-phone ltr">' + signupDialSelect() + '<input type="tel" id="su-phone" inputmode="tel" autocomplete="tel-national" required aria-required="true" aria-describedby="su-phone-hint" placeholder="' + t('auth.phonePh') + '" class="ltr"></div><div class="caption" id="su-phone-hint" style="margin-top:calc(6px*var(--ui))">' + t('auth.phoneHint') + '</div></div>' +
      '<div class="field"><label class="field-label" for="su-pass">' + t('auth.code') + '</label><div class="field-box"><input type="password" id="su-pass" autocomplete="new-password" minlength="8" class="ltr"><button type="button" class="field-icon" data-auth-toggle="su-pass" aria-label="' + t('auth.show') + '" style="padding:calc(6px*var(--ui))">' + icon('eye', 18) + '</button></div></div>' +
      '<div class="field-err" id="signup-err" role="alert"></div>' +
      '<button class="btn btn-primary" id="su-submit" type="button">' + t('auth.signup') + '</button>' +
      '<button class="btn btn-ghost" id="su-to-login" type="button">' + t('auth.haveAccount') + '</button>' +
    '</div>';
}

function renderReset(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('auth.resetTitle') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:var(--sp-4);max-width:calc(460px*var(--ui));margin:0 auto;width:100%">' +
      '<div class="field"><label class="field-label" for="rs-email">' + t('auth.username') + '</label><div class="field-box"><input type="email" id="rs-email" autocomplete="email" class="ltr"></div></div>' +
      '<div class="field-err" id="reset-err" role="alert"></div>' +
      '<button class="btn btn-primary" id="rs-submit" type="button">' + t('auth.resetSend') + '</button>' +
    '</div>';
}

