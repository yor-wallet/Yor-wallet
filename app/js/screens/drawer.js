'use strict';

/* Side menu (avatar) — slides from the start edge, RTL-aware */
const YorDrawer = (() => {
  let el = null;
  function close(){ if (!el) return; const e = el; el = null; e.classList.remove('on'); setTimeout(() => e.remove(), 240); }
  function go(r){ close(); setTimeout(() => R.go(r), 120); }
  function open(){
    if (el) return;
    const p = Runtime.profile || {};
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || 'Friendly';
    const items = [['profile','user','profile'],['notifications','bell','notifications'],['history','history','history'],['cards','cards','cards'],['banks','bank','banks'],['crypto-market','chart','markets'],['crypto-networks','network','networks'],['settings','settings','settings']].filter(i => FEATURES.crypto || !CRYPTO_SCREEN_RE.test(i[0]));
    el = document.createElement('div'); el.className = 'yd';
    el.innerHTML = '<div class="yd-bg" data-yd-close></div><aside class="yd-p" role="dialog" aria-modal="true">' +
      '<div class="yd-head">' + ybAvatar(56) + '<div class="yd-who"><b>' + escapeHtml(name) + '</b><small>' + escapeHtml(dispId(p.yorId || '')) + '</small></div><button class="yb-ic" data-yd-close aria-label="' + yt('close') + '">' + icon('close', 20) + '</button></div>' +
      '<nav class="yd-nav">' + items.map(i => '<button data-yd-go="' + i[0] + '">' + icon(i[1], 22) + '<span>' + yt(i[2]) + '</span></button>').join('') + '</nav>' +
      '<button class="yd-out" data-yd-out>' + icon('logout', 20) + '<span>' + yt('logout') + '</span></button></aside>';
    document.body.appendChild(el);
    el.querySelectorAll('[data-yd-close]').forEach(b => b.onclick = close);
    el.querySelectorAll('[data-yd-go]').forEach(b => b.onclick = () => go(b.getAttribute('data-yd-go')));
    el.querySelector('[data-yd-out]').onclick = async () => { close(); try { await AuthEngine.signOut(); } catch(e){} };
    requestAnimationFrame(() => el && el.classList.add('on'));
  }
  function init(){ document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-yb-drawer]'); if (b){ e.preventDefault(); open(); } }); }
  return { init, open, close };
})();
