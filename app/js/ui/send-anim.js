'use strict';

/* ============================================================
   SEND ANIMATION (12.12.0) — shown while a transfer is being made.
   Two phones, a rail between them, a coin that travels from the sender to the recipient. Nothing here is decoration:
   - "secure"  : the transfer is being protected (lock on the sender's phone, the rail draws itself);
   - "send"    : the request is on its way; the coin crosses again and again for as long as the server has not answered;
   - "success" : only once the server confirmed — the coin lands, the recipient's phone gets its check;
   - "fail"    : the server refused or could not be reached — the coin stops, nothing says "sent".
   Right-to-left languages mirror the whole scene (the sender is on the right). "Reduce motion" shows each state without movement.
   The scene is drawn with SVG + CSS (css/motion.css); only the coin's path is driven by script (a quadratic curve), so its position can be
   continued smoothly into the landing.
   ============================================================ */
const SendAnim = (() => {
  const Y = 62, CTRL = [160, -18], CYCLE = 2200;
  const reduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; } };
  const geo = () => { const r = document.documentElement.getAttribute('dir') === 'rtl'; return { r, a: r ? 262 : 58, b: r ? 58 : 262 }; };
  let raf = 0, run = null;

  function phone(x, cls, inner){
    return '<g transform="translate(' + x + ' 70)"><g class="sx-pin ' + cls + '">' +
      '<rect class="sx-body" x="0" y="0" width="60" height="112" rx="14"/><rect class="sx-screen" x="6" y="16" width="48" height="82" rx="8"/><rect class="sx-spk" x="22" y="6" width="16" height="3" rx="1.5"/>' + inner + '</g></g>';
  }
  function svg(){
    const g = geo();
    const arrow = g.r ? 'M38 56H22M27 51l-5 5 5 5' : 'M22 56h16M33 51l5 5-5 5';
    const sender = '<g class="sx-lock"><rect x="21" y="55" width="18" height="13" rx="3"/><path d="M25 55v-4a5 5 0 0 1 10 0v4"/></g><path class="sx-out" d="' + arrow + '"/>';
    const recipient = '<circle class="sx-wait" cx="30" cy="56" r="16"/><circle class="sx-got" cx="30" cy="56" r="16"/><path class="sx-ok" d="M22 56l6 6 11-12" pathLength="100"/><path class="sx-no" d="M24 50l12 12M36 50L24 62" pathLength="100"/>';
    const d = 'M' + g.a + ' ' + Y + ' Q' + CTRL[0] + ' ' + CTRL[1] + ' ' + g.b + ' ' + Y;
    return '<svg class="sx-svg" viewBox="0 0 320 200" focusable="false" aria-hidden="true">' +
      '<defs><linearGradient id="sxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0B7F75"/></linearGradient></defs>' +
      '<path class="sx-rail" d="' + d + '"/><path class="sx-rail-lit" pathLength="100" d="' + d + '"/>' +
      phone(g.a - 30, 'sx-pa', sender) + phone(g.b - 30, 'sx-pb', recipient) +
      '<circle class="sx-ripple" cx="' + g.b + '" cy="126" r="30"/>' +
      '<g class="sx-t2"><circle r="6"/></g><g class="sx-t1"><circle r="9"/></g>' +
      '<g class="sx-coin"><circle class="sx-glow" r="22"/><circle class="sx-disc" r="13"/><circle class="sx-ring" r="8.5"/><circle class="sx-dot" r="2.4"/></g>' +
    '</svg>';
  }

  const pos = (g, u) => { const k = 1 - u; return [k * k * g.a + 2 * k * u * CTRL[0] + u * u * g.b, k * k * Y + 2 * k * u * CTRL[1] + u * u * Y]; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const fade = u => clamp(u / .1, 0, 1) * clamp((1 - u) / .1, 0, 1);
  function put(el, g, u, op, sc){
    if (!el) return;
    const p = pos(g, clamp(u, 0, 1));
    el.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
    el.style.opacity = op.toFixed(3);
  }
  function draw(root, g, u){
    const f = fade(u), sc = 1 - .4 * clamp((u - .88) / .12, 0, 1);
    put(root.querySelector('.sx-coin'), g, u, f, sc);
    put(root.querySelector('.sx-t1'), g, u - .06, .42 * f, sc);
    put(root.querySelector('.sx-t2'), g, u - .12, .22 * f, sc);
  }
  function stop(){ if (raf) cancelAnimationFrame(raf); raf = 0; run = null; }

  function startLoop(root){
    if (run) return;
    const g = geo(), t0 = performance.now();
    run = { mode: 'loop', u: 0 };
    const frame = now => {
      if (!run) return;
      if (!root.isConnected){ stop(); return; }
      if (run.mode === 'loop'){
        run.u = ease(((now - t0) % CYCLE) / CYCLE);
        draw(root, g, run.u);
      } else if (run.mode === 'land'){
        const k = clamp((now - run.t0) / run.dur, 0, 1), u = run.u0 + (1 - run.u0) * (1 - Math.pow(1 - k, 2.2));
        draw(root, g, u);
        if (k >= 1){ const done = run.done; stop(); draw(root, g, 1); if (done) done(); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  /* the coin finishes its crossing (never jumps), then calls done */
  function land(root, done){
    if (!run){ done(); return; }
    run.mode = 'land'; run.t0 = performance.now(); run.u0 = run.u || 0; run.dur = clamp((1 - run.u0) * 700 + 260, 260, 900); run.done = done;
  }

  const KEYS = { secure:'sx.secure', send:'sx.send', success:'sx.success', fail:'sx.fail' };
  /* Sets the phase of the scene on screen. Returns a promise that resolves when the phase is really shown (the landing takes a moment). */
  function setPhase(p){
    const root = document.querySelector('.proc-view');
    if (!root) return Promise.resolve();
    if (p === 'process') p = 'send';
    if (!root.classList.contains('sx-view') || !KEYS[p]){ root.setAttribute('data-phase', p); return Promise.resolve(); }
    const label = root.querySelector('#sx-label');
    const apply = q => { root.setAttribute('data-phase', q); if (label) label.textContent = t(KEYS[q]); };
    if (p === 'send'){ apply('send'); if (!reduced()) startLoop(root); return Promise.resolve(); }
    if (p === 'success'){
      if (reduced() || !run){ stop(); apply('success'); return Promise.resolve(); }
      return new Promise(res => land(root, () => { apply('success'); res(); }));
    }
    if (p === 'fail'){ stop(); root.classList.add('sx-stopped'); apply('fail'); return Promise.resolve(); }
    stop(); apply('secure'); return Promise.resolve();
  }
  return { svg, setPhase, stop };
})();
