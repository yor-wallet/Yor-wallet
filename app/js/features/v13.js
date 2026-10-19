'use strict';

/* ============================================================
   Friendly Pay 13.0.0
   - « Ce mois-ci » : sums of CONFIRMED operations of the current month, read from Runtime.transactions (never estimated).
   - Pull to refresh (home, history, notifications): reloads the account from the server (AuthEngine.hydrateRuntime).
   - Recent recipients on the transfer screen: numbers the person really sent to (their own history), one tap fills the field.
   - Notification centre: grouped by day, unread marker, text built from the server's own data (amount, reference),
     a tap opens the receipt of the linked transaction and marks the alert read on the server.
   Loaded after premium.js (uses its helpers), before wire.js.
   ============================================================ */
Object.assign(TR.en, {
  'v13.month':'This month', 'v13.sent':'Sent', 'v13.received':'Received', 'v13.ops':'{n} operations', 'v13.op1':'1 operation', 'v13.none':'No confirmed operation this month yet.',
  'v13.pull':'Pull to refresh', 'v13.release':'Release to refresh', 'v13.refreshing':'Refreshing…', 'v13.updated':'Updated at {t}', 'v13.offline':'No connection — showing the last data received',
  'v13.recent':'Recent recipients', 'v13.nc.TRANSFER_SENT':'Transfer sent', 'v13.nc.TRANSFER_RECEIVED':'Money received', 'v13.nc.DEPOSIT':'Deposit credited',
  'v13.nc.to':'To {who}', 'v13.nc.from':'From {who}', 'v13.nc.ref':'Ref. {r}', 'v13.nc.unread':'Unread', 'v13.nc.markAll':'Mark all as read', 'v13.nc.empty':'No notification yet'
});
Object.assign(TR.fr, {
  'v13.month':'Ce mois-ci', 'v13.sent':'Envoyé', 'v13.received':'Reçu', 'v13.ops':'{n} opérations', 'v13.op1':'1 opération', 'v13.none':'Aucune opération confirmée ce mois-ci pour l’instant.',
  'v13.pull':'Tirez pour actualiser', 'v13.release':'Relâchez pour actualiser', 'v13.refreshing':'Actualisation…', 'v13.updated':'Mis à jour à {t}', 'v13.offline':'Pas de connexion — dernières données reçues affichées',
  'v13.recent':'Bénéficiaires récents', 'v13.nc.TRANSFER_SENT':'Transfert envoyé', 'v13.nc.TRANSFER_RECEIVED':'Argent reçu', 'v13.nc.DEPOSIT':'Dépôt crédité',
  'v13.nc.to':'À {who}', 'v13.nc.from':'De {who}', 'v13.nc.ref':'Réf. {r}', 'v13.nc.unread':'Non lue', 'v13.nc.markAll':'Tout marquer comme lu', 'v13.nc.empty':'Aucune notification'
});
Object.assign(TR.ar, {
  'v13.month':'هذا الشهر', 'v13.sent':'المُرسَل', 'v13.received':'المُستلَم', 'v13.ops':'{n} عمليات', 'v13.op1':'عملية واحدة', 'v13.none':'لا توجد عملية مؤكدة هذا الشهر بعد.',
  'v13.pull':'اسحب للتحديث', 'v13.release':'اترك للتحديث', 'v13.refreshing':'جارٍ التحديث…', 'v13.updated':'تم التحديث الساعة {t}', 'v13.offline':'لا يوجد اتصال — تُعرض آخر البيانات المستلمة',
  'v13.recent':'المستفيدون الأخيرون', 'v13.nc.TRANSFER_SENT':'تم إرسال التحويل', 'v13.nc.TRANSFER_RECEIVED':'تم استلام أموال', 'v13.nc.DEPOSIT':'تمت إضافة إيداع',
  'v13.nc.to':'إلى {who}', 'v13.nc.from':'من {who}', 'v13.nc.ref':'المرجع {r}', 'v13.nc.unread':'غير مقروء', 'v13.nc.markAll':'تعليم الكل كمقروء', 'v13.nc.empty':'لا توجد إشعارات'
});

const V13 = (() => {
  const money = (a, c) => { const code = String(c || 'OMR').toUpperCase(); return escapeHtml(CurrencyEngine.format(a, code)).replace(code, '<span class="rv-cur">' + code + '</span>'); };
  let lastRefresh = 0;

  /* ---------- this month (confirmed operations only, in the main account currency) ---------- */
  function monthStats(){
    const cur = (mainAccount().currency || 'OMR').toUpperCase();
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    const from = d.getTime();
    let sent = 0, recv = 0, n = 0;
    visibleTransactions(Runtime.transactions || []).forEach(x => {
      if ((x.createdAt || 0) < from || txState(x.status) !== 'success' || String(x.currency || 'OMR').toUpperCase() !== cur) return;
      const a = Number(x.amount); if (!isFinite(a)) return;
      if (x.direction === 'IN') recv += a; else sent += a;
      n++;
    });
    return { cur, sent, recv, n };
  }
  function insightsHtml(){
    if (!Runtime.ctx && !Runtime.profile) return '';
    const m = monthStats(), hide = !!Runtime.hideBalance, max = Math.max(m.sent, m.recv) || 1;
    const bar = (cls, v) => '<i class="v13-bar ' + cls + '" style="--w:' + (hide ? 0 : Math.max(4, Math.round(v / max * 100))) + '%"></i>';
    const val = v => hide ? '••••' : money(v, m.cur);
    return '<section class="v13-month" aria-label="' + escapeHtml(t('v13.month')) + '">' +
      '<div class="v13-mh"><h2>' + escapeHtml(t('v13.month')) + '</h2><span>' + escapeHtml(m.n === 1 ? t('v13.op1') : tf('v13.ops', { n: m.n })) + '</span></div>' +
      (m.n ? '<div class="v13-rows">' +
        '<div class="v13-row"><span class="v13-k"><i class="v13-dot out"></i>' + escapeHtml(t('v13.sent')) + '</span><b class="ltr">' + val(m.sent) + '</b>' + bar('out', m.sent) + '</div>' +
        '<div class="v13-row"><span class="v13-k"><i class="v13-dot in"></i>' + escapeHtml(t('v13.received')) + '</span><b class="ltr">' + val(m.recv) + '</b>' + bar('in', m.recv) + '</div>' +
      '</div>' : '<p class="v13-none">' + escapeHtml(t('v13.none')) + '</p>') +
    '</section>';
  }

  /* ---------- pull to refresh ---------- */
  function bindPull(root, id){
    if (root.__v13pull) return; root.__v13pull = true;
    const ind = document.createElement('div'); ind.className = 'v13-ptr'; ind.setAttribute('aria-live', 'polite');
    ind.innerHTML = '<span class="v13-ptr-ic">' + icon('history', 16) + '</span><span class="v13-ptr-t"></span>';
    root.insertBefore(ind, root.firstChild);
    let y0 = null, dy = 0, busy = false;
    const label = k => { ind.querySelector('.v13-ptr-t').textContent = k; };
    root.addEventListener('touchstart', e => { if (busy || root.scrollTop > 0 || e.touches.length !== 1) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive:true });
    root.addEventListener('touchmove', e => {
      if (y0 == null || busy) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (root.scrollTop > 0){ y0 = null; return; }
      const p = Math.min(1, dy / 80);
      ind.style.setProperty('--p', p.toFixed(3)); ind.classList.toggle('on', dy > 8); ind.classList.toggle('ready', dy >= 80);
      label(t(dy >= 80 ? 'v13.release' : 'v13.pull'));
    }, { passive:true });
    root.addEventListener('touchend', async () => {
      if (y0 == null || busy){ y0 = null; return; }
      const go = dy >= 80; y0 = null; dy = 0;
      if (!go){ ind.classList.remove('on', 'ready'); return; }
      await refresh(ind, id);
    });
  }
  async function refresh(ind, id){
    if (ind){ ind.classList.add('on', 'busy'); ind.querySelector('.v13-ptr-t').textContent = t('v13.refreshing'); }
    try { UIKit.haptic('tap'); } catch(e){}
    let ok = false;
    if (navigator.onLine !== false){ try { await AuthEngine.hydrateRuntime(); ok = true; } catch(e){ ok = false; } }
    if (ok){ lastRefresh = Date.now(); R.go(id, { force:true }); toast(tf('v13.updated', { t: fmtTime(lastRefresh) })); }
    else { toast(t('v13.offline'), 'error'); if (ind) ind.classList.remove('on', 'busy', 'ready'); }
  }

  /* ---------- recent recipients (transfer screen) ---------- */
  function recentRecipients(){
    const seen = {}, out = [];
    visibleTransactions(Runtime.transactions || []).forEach(x => {
      const b = x.beneficiary; if (x.direction === 'IN' || !b || !b.phone) return;
      const d = String(b.phone).replace(/\D/g, ''); if (!/^968[79]\d{7}$/.test(d) || seen[d]) return;
      seen[d] = 1; out.push({ phone: '+' + d, name: typeof receiptBenName === 'function' ? receiptBenName(b) : '' });
    });
    return out.slice(0, 6);
  }
  function wireRecent(root){
    const list = recentRecipients(); if (!list.length || root.querySelector('.v13-recent')) return;
    const box = document.createElement('section'); box.className = 'v13-recent';
    box.innerHTML = '<h3>' + escapeHtml(t('v13.recent')) + '</h3><div class="v13-chips">' + list.map(r =>
      '<button type="button" class="v13-rc" data-v13-phone="' + escapeHtml(r.phone) + '"><span class="v13-rc-ava">' + escapeHtml((r.name || '').trim().slice(0, 1).toUpperCase() || '#') + '</span><span class="v13-rc-t"><b>' + escapeHtml(r.name || formatPhoneIntl(r.phone)) + '</b>' + (r.name ? '<small class="ltr" dir="ltr">' + escapeHtml(formatPhoneIntl(r.phone)) + '</small>' : '') + '</span></button>').join('') + '</div>';
    const anchor = root.querySelector('#sp-next'); if (!anchor) return;
    anchor.insertAdjacentElement('afterend', box);
    box.onclick = e => {
      const b = e.target.closest && e.target.closest('[data-v13-phone]'); if (!b) return;
      const inp = document.getElementById('sp-num'); if (!inp) return;
      inp.value = omFormatLocal(omLocalDigits(b.getAttribute('data-v13-phone')));
      inp.dispatchEvent(new Event('input', { bubbles:true }));
      try { inp.focus({ preventScroll:true }); } catch(e2){}
      try { UIKit.haptic('tap'); } catch(e2){}
    };
  }

  /* ---------- notification centre ---------- */
  const NC_ICON = { TRANSFER_SENT:'send', TRANSFER_RECEIVED:'receive', DEPOSIT:'banknote' };
  function ncText(n){
    const d = n.data || {}, type = String(n.type || '').toUpperCase();
    const title = TR.en['v13.nc.' + type] ? t('v13.nc.' + type) : (n.title || '');
    const amt = d.amount != null && isFinite(Number(d.amount)) ? CurrencyEngine.format(Number(d.amount), d.currency || 'OMR') : '';
    const who = d.to ? formatPhoneIntl(String(d.to)) : d.from ? formatPhoneIntl(String(d.from)) : '';
    const line = type === 'TRANSFER_SENT' && who ? tf('v13.nc.to', { who }) : (type === 'TRANSFER_RECEIVED' && who) ? tf('v13.nc.from', { who }) : (TR.en['v13.nc.' + type] ? '' : (n.message || ''));
    return { title, amt, line, ref: d.reference ? dispId(String(d.reference)) : '', icon: NC_ICON[type] || 'bell' };
  }
  function renderNotifications(){
    const list = (Runtime.notifications || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const unread = list.filter(n => !n.read).length;
    let html = '<div class="topbar px-topbar"><button class="topbar-back" data-action="back" aria-label="' + escapeHtml(t('ui.back')) + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button>' +
      '<span class="topbar-title">' + escapeHtml(t('ui.notifications')) + '</span>' +
      (unread ? '<button class="topbar-action" data-action="mark-notifs" aria-label="' + escapeHtml(t('v13.nc.markAll')) + '">' + icon('check', 18) + '</button>' : '<span style="width:calc(44px*var(--ui))"></span>') + '</div>' +
      '<div class="screen-body v13-nc" style="padding-top:0">';
    if (!list.length) return html + emptyState('bell', V12.vt('notifEmpty'), V12.vt('notifEmptyD')) + '</div>';
    let last = null;
    list.forEach(n => {
      const day = txDayLabel(n.createdAt);
      if (day !== last){ html += (last !== null ? '</div>' : '') + '<div class="rv-day">' + escapeHtml(day) + '</div><div class="rv-list ds-list">'; last = day; }
      const v = ncText(n), tx = n.transactionId && (Runtime.transactions || []).some(x => x.id === n.transactionId);
      html += '<div class="item v13-n' + (n.read ? '' : ' unread') + '"' + (tx ? ' role="button" tabindex="0" data-v13-n="' + escapeHtml(n.id) + '"' : '') + '>' +
        '<div class="tile">' + icon(v.icon, 20) + '</div><div class="item-body"><div class="item-title">' + escapeHtml(v.title) + (n.read ? '' : '<i class="v13-unread" aria-label="' + escapeHtml(t('v13.nc.unread')) + '"></i>') + '</div>' +
        (v.line ? '<div class="item-sub ltr-auto">' + escapeHtml(v.line) + '</div>' : '') +
        '<div class="item-sub v13-meta">' + escapeHtml(fmtTime(n.createdAt)) + (v.ref ? ' · <span class="ltr" dir="ltr">' + escapeHtml(tf('v13.nc.ref', { r: v.ref })) + '</span>' : '') + '</div></div>' +
        (v.amt ? '<div class="item-right"><div class="item-amount ltr">' + escapeHtml(v.amt) + '</div></div>' : '') + '</div>';
    });
    return html + '</div><div style="height:calc(24px + var(--safe-b))"></div></div>';
  }
  function wireNotifications(root){
    root.onclick = async e => {
      const el = e.target.closest && e.target.closest('[data-v13-n]'); if (!el) return;
      const n = (Runtime.notifications || []).find(x => String(x.id) === el.getAttribute('data-v13-n')); if (!n) return;
      if (!n.read){ n.read = true; try { await UserDataEngine.writeSub(UserContext.requireCtx().uid, 'notifications', n.id, { read:true }); } catch(err){} try { Push.syncBadge(); } catch(err){} }
      openTxReceipt(n.transactionId);
    };
  }

  function onScreen(id, root){
    if (id === 'home' || id === 'history' || id === 'notifications') bindPull(root, id);
    if (id === 'country-select') wireRecent(root);
    if (id === 'notifications') wireNotifications(root);
  }
  return { insightsHtml, monthStats, recentRecipients, renderNotifications, onScreen, refresh, ncText };
})();

R.register({ notifications: V13.renderNotifications });
