'use strict';

function renderNotifications(){
  const list = Runtime.notifications;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('ui.notifications') + '</span><button class="topbar-action" data-action="mark-notifs" aria-label="' + t('ui.markRead') + '">' + icon('check', 18) + '</button></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      (list.length ? '<div class="glass" style="padding:calc(6px*var(--ui)) calc(18px*var(--ui))">' + list.map(n => '<div class="item" style="cursor:default"><div class="tile">' + icon('bell', 20) + '</div><div class="item-body"><div class="item-title">' + escapeHtml(n.title) + '</div><div class="item-sub" style="white-space:normal">' + escapeHtml(n.message) + '</div><div class="caption" style="margin-top:calc(4px*var(--ui))">' + escapeHtml(timeAgo(n.createdAt)) + '</div></div></div>').join('') + '</div>' : '<div class="rv-empty" style="padding-top:12vh"><div style="color:var(--accent)">' + icon('bell', 48) + '</div><div style="font-weight:800;font-size:calc(18px*var(--ui));margin-top:12px">' + V12.vt('notifEmpty') + '</div><div style="color:var(--text-2);margin-top:6px">' + V12.vt('notifEmptyD') + '</div></div>') +
    '</div>';
}
function infoScreenTop(titleKey){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t(titleKey) + '</span><span style="width:calc(44px*var(--ui))"></span></div>';
}
function renderPrivacy(){
  const blocks = [1, 2, 3].map(n =>
    '<div class="glass" style="padding:var(--sp-5)"><div class="settings-row-title" style="margin-bottom:calc(6px*var(--ui))">' + t('privacy.p' + n + 't') + '</div>' +
    '<div class="settings-row-sub" style="line-height:1.6">' + t('privacy.p' + n) + '</div></div>').join('');
  return infoScreenTop('privacy.title') +
    '<div class="screen-body" style="padding-top:var(--sp-2)"><p class="caption" style="line-height:1.6">' + t('privacy.intro') + '</p>' + blocks + '<div style="height:var(--sp-6)"></div></div>';
}
function renderHelp(){
  const faq = [1, 2, 3].map(n =>
    '<details class="glass faq-item"><summary>' + t('help.q' + n) + '<span class="faq-chev">' + icon('chev', 16) + '</span></summary><div class="faq-a">' + t('help.a' + n) + '</div></details>').join('');
  const email = 'yordigitalefinance@gmail.com';
  return infoScreenTop('help.title') +
    '<div class="screen-body" style="padding-top:var(--sp-2)"><p class="caption" style="line-height:1.6">' + t('help.intro') + '</p>' + faq +
    '<a class="btn btn-primary" href="mailto:' + email + '" style="text-decoration:none;margin-top:var(--sp-2)">' + icon('mail', 18) + '<span>' + t('help.contact') + '</span></a>' +
    '<div class="caption" style="text-align:center">' + t('help.contactDesc') + ' <span class="ltr">' + email + '</span></div>' +
    '<div style="height:var(--sp-6)"></div></div>';
}
function renderAbout(){
  return infoScreenTop('about.title') +
    '<div class="screen-body" style="padding-top:var(--sp-2);align-items:center;text-align:center">' +
      '<div style="margin:var(--sp-6) 0 var(--sp-4)">' + logoLockup(64) + '</div>' +
      '<div class="glass" style="padding:var(--sp-5);width:100%"><div class="settings-row-sub">' + t('about.version') + '</div><div class="settings-row-title ltr" style="font-family:var(--font-mono)">v' + CONFIG.APP.version + '</div></div>' +
      '<p class="caption" style="line-height:1.6">' + t('about.company') + '</p><p class="caption">' + t('about.rights') + '</p>' +
    '</div>';
}
function renderDevices(){
  const current = DeviceEngine.current();
  const list = Runtime.devices || [];
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('devices.title') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass" style="padding:calc(6px*var(--ui)) calc(18px*var(--ui))">' + (list.length ? list.map(d => '<div class="item" style="cursor:default"><div class="tile">' + icon('device', 20) + '</div><div class="item-body"><div class="item-title">' + escapeHtml(d.platform || '—') + ' · ' + escapeHtml(d.browser || '—') + (d.deviceId === current ? ' <span class="badge badge-success" style="margin-inline-start:6px">' + t('devices.current') + '</span>' : '') + '</div><div class="item-sub">' + escapeHtml(d.deviceId || '') + '</div><div class="caption" style="margin-top:calc(4px*var(--ui))">' + t('devices.lastActive') + ' · ' + escapeHtml(timeAgo(d.lastSeen || Date.now())) + '</div></div></div>').join('') : '<div class="empty" style="padding:var(--sp-6) 0"><div class="empty-sub">—</div></div>') + '</div>' +
    '</div>';
}
function renderSessions(){
  const current = SessionEngine.current();
  const list = Runtime.sessions || [];
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('sessions.title') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass" style="padding:calc(6px*var(--ui)) calc(18px*var(--ui))">' + (list.length ? list.map(s => '<div class="item" style="cursor:default"><div class="tile">' + icon('session', 20) + '</div><div class="item-body"><div class="item-title">' + escapeHtml(s.sessionId || '') + (s.sessionId === current ? ' <span class="badge badge-success" style="margin-inline-start:6px">' + t('sessions.current') + '</span>' : '') + '</div><div class="item-sub">' + escapeHtml(s.deviceId || '') + '</div><div class="caption" style="margin-top:calc(4px*var(--ui))">' + t('sessions.createdAt') + ' · ' + escapeHtml(timeAgo(s.createdAt || Date.now())) + ' · ' + escapeHtml(s.status || 'active') + '</div></div></div>').join('') : '<div class="empty" style="padding:var(--sp-6) 0"><div class="empty-sub">—</div></div>') + '</div>' +
    '</div>';
}

