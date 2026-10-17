'use strict';

/* ============================================================
   SIDEBAR
   ============================================================ */
function renderSidebar(){
  document.getElementById('sidebar-logo').innerHTML = logoLockup(48);
  const items = [
    { nav:'home', icon:'home', key:'nav.home' },
    { nav:'crypto', icon:'crypto', key:'crypto.title' },
    { nav:'history', icon:'history', key:'nav.history' },
    { nav:'banks', icon:'bank', key:'banks.title' },
    { nav:'notifications', icon:'bell', key:'ui.notifications' },
    { nav:'cards', icon:'cards', key:'nav.cards' },
    { nav:'profile', icon:'profile', key:'nav.profile' },
    { nav:'settings', icon:'settings', key:'settings.title' }
  ];
  const nav = document.getElementById('side-nav');
  nav.innerHTML = items.filter(it => FEATURES.crypto || !CRYPTO_SCREEN_RE.test(it.nav)).map(it => '<a class="side-item" data-nav="' + it.nav + '">' + icon(it.icon, 20) + '<span>' + t(it.key) + '</span></a>').join('');
  nav.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = () => {
      R.go(el.getAttribute('data-nav'));
    };
  });
  const lb = document.getElementById('sidebar-layout');
  if (lb){
    lb.hidden = document.documentElement.getAttribute('data-layout') !== 'desktop';
    lb.innerHTML = icon('device', 20) + '<span>' + t('settings.mobileMode') + '</span>';
    lb.onclick = () => LayoutMode.set('mobile');
  }
  const container = document.getElementById('sidebar-profile');
  if (Runtime.ctx && Runtime.profile){
    const first = Runtime.profile.firstName || '';
    const last = Runtime.profile.lastName || '';
    const initials = ((first[0] || 'U') + (last[0] || 'S')).toUpperCase();
    const isAdmin = Runtime.ctx.role === 'admin';
    container.innerHTML = '<div style="display:flex;align-items:center;gap:calc(12px*var(--ui));padding:calc(12px*var(--ui));border-radius:calc(14px*var(--ui));background:var(--glass-1);border:1px solid var(--border)"><div style="width:calc(36px*var(--ui));height:calc(36px*var(--ui));border-radius:50%;background:linear-gradient(180deg,var(--accent),var(--accent-600));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(13px*var(--ui))">' + initials + '</div><div style="flex:1;min-width:0"><div style="font-size:calc(13px*var(--ui));font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml((first + ' ' + last).trim() || dispId(Runtime.ctx.yorId || '')) + (isAdmin ? ' · ADMIN' : '') + '</div><div style="font-size:calc(11px*var(--ui));color:var(--text-3)">' + escapeHtml(Runtime.ctx.yorId || '') + '</div></div></div>';
  } else {
    container.innerHTML = '';
  }
  container.onclick = () => R.go('profile');
}

