'use strict';

/* ============================================================
   FULLSCREEN
   ============================================================ */
function requestFullscreen(){
  try {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn && !document.fullscreenElement && !document.webkitFullscreenElement){ fn.call(el).catch(() => {}); }
  } catch(e){}
}

/* ============================================================
   VIEWPORT ENGINE
   ============================================================ */
const LayoutMode = (() => {
  const KEY = 'yor_layout_mode';   /* UI preference only: no sensitive data */
  const get = () => { try { return localStorage.getItem(KEY) === 'desktop' ? 'desktop' : 'mobile'; } catch(e){ return 'mobile'; } };
  const isDesktop = () => get() === 'desktop';
  function set(mode){
    try { if (mode === 'desktop') localStorage.setItem(KEY, 'desktop'); else localStorage.removeItem(KEY); } catch(e){}
    location.reload();   /* the viewport width is fixed before first paint; the route survives in the URL hash */
  }
  const toggle = () => set(isDesktop() ? 'mobile' : 'desktop');
  return { get, isDesktop, set, toggle };
})();

const ViewportEngine = (() => {
  const root = document.documentElement;
  const vv = window.visualViewport || null;
  let kbOpen = false;
  function setVH(){
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--vh', (h * 0.01) + 'px');
  }
  function onViewportChange(){
    setVH();
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('--kb', kb + 'px');
    const open = kb > 80;
    if (open !== kbOpen){ kbOpen = open; document.body.classList.toggle('kb-open', kbOpen); }
  }
  function onFocusIn(e){
    const el = e.target;
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    setTimeout(() => { try { el.scrollIntoView({ block:'center', behavior:'smooth' }); } catch(err){} }, 120);
  }
  function init(){
    setVH();
    window.addEventListener('resize', onViewportChange, { passive:true });
    window.addEventListener('orientationchange', onViewportChange);
    if (vv){ vv.addEventListener('resize', onViewportChange); vv.addEventListener('scroll', onViewportChange); }
    document.addEventListener('focusin', onFocusIn);
  }
  return { init };
})();

