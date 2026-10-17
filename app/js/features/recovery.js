'use strict';

/* ============================================================
   PASSWORD RECOVERY (link from the reset e-mail lands here signed-in)
   ============================================================ */
function openRecovery(){
  const close = R.overlay.open(
    '<div class="h2" style="margin-bottom:12px">' + escapeHtml(t('auth.resetTitle')) + '</div>' +
    '<div class="field"><label class="field-label" for="rc-pw">' + escapeHtml(t('auth.code')) + '</label><div class="field-box"><input type="password" id="rc-pw" autocomplete="new-password" class="ltr"></div></div>' +
    '<div class="field-err" id="rc-err" role="alert"></div>' +
    '<button class="btn btn-primary" id="rc-ok" type="button" style="margin-top:12px">' + escapeHtml(t('action.save')) + '</button>',
    { kind:'modal' });
  setTimeout(() => {
    const ok = document.getElementById('rc-ok'); if (!ok) return;
    ok.onclick = async () => {
      const pw = document.getElementById('rc-pw').value, err = document.getElementById('rc-err');
      if (pw.length < 8){ err.textContent = t('auth.err.weak'); return; }
      UIKit.loading(ok, true);
      const r = await AuthEngine.updatePassword(pw);
      UIKit.loading(ok, false);
      if (!r.ok){ err.textContent = t(r.error); return; }
      toast(t('action.save'), 'success'); close();
    };
  }, 60);
}

