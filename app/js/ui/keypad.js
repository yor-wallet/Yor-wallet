'use strict';

/* ============================================================================================================
   KEYPAD — pavé numérique virtuel Friendly Pay (12.9.0), commun à l'écran de verrouillage et à la confirmation de transfert.
   - Touches « verre » rondes : la lumière suit le doigt, une onde part du point touché.
   - Le chiffre tapé s'envole de la touche vers son point dans la ligne de code (animation), le point s'allume et « atterrit ».
   - Touche « mélanger » : place les chiffres au hasard à chaque ouverture (anti-regard par-dessus l'épaule). Réglage mémorisé
     sur cet appareil ; désactivé par défaut.
   - Les classes historiques (yl-key, ps-key, data-k) sont conservées : la logique de saisie reste dans app-lock.js / pin.js.
   ============================================================================================================ */
const Keypad = (() => {
  const SKEY = 'friendly_keypad_shuffle';
  const W = {
    en: { del: 'Delete', shuf: 'Shuffle keys' },
    fr: { del: 'Effacer', shuf: 'Mélanger les touches' },
    ar: { del: 'حذف', shuf: 'خلط الأرقام' }
  };
  const w = (k) => (W[LANG] || W.en)[k];
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const shuffleOn = () => { try { return localStorage.getItem(SKEY) === '1'; } catch (e) { return false; } };
  const setShuffle = (on) => { try { localStorage.setItem(SKEY, on ? '1' : '0'); } catch (e) {} };

  function order(){
    const d = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    if (shuffleOn()){
      const r = new Uint32Array(10); crypto.getRandomValues(r);
      for (let i = 9; i > 0; i--){ const j = r[i] % (i + 1); const t = d[i]; d[i] = d[j]; d[j] = t; }
    }
    return d;
  }
  function keysHtml(cls){
    const d = order();
    let n = 0;
    const key = (v) => '<button type="button" class="fk-key ' + cls + '-key" style="--n:' + (n++) + '" data-k="' + v + '"><span class="fk-d">' + v + '</span><i class="fk-ring" aria-hidden="true"></i></button>';
    const shuf = '<button type="button" class="fk-key fk-fn ' + cls + '-key fn" style="--n:' + (n++) + '" data-shuf="1" aria-pressed="' + (shuffleOn() ? 'true' : 'false') + '" aria-label="' + w('shuf') + '">' + icon('shuffle', 22) + '</button>';
    const last = key(d[9]);
    const del = '<button type="button" class="fk-key fk-fn ' + cls + '-key fn" style="--n:' + (n++) + '" data-k="del" aria-label="' + w('del') + '">' + icon('backspace', 26) + '</button>';
    return d.slice(0, 9).map(key).join('') + shuf + last + del;
  }
  /* cls : préfixe historique ('yl' ou 'ps') */
  function padHtml(cls){ return '<div class="fk-pad ' + cls + '-pad" data-fk-cls="' + cls + '">' + keysHtml(cls) + '</div>'; }

  /* Un point de la ligne de code s'allume : l'orbe part de la touche et atterrit dans le point */
  function fly(btn, dots, idx){
    if (reduced() || !btn || !dots || !btn.animate) return;
    const d = dots.children[idx]; if (!d) return;
    const a = btn.getBoundingClientRect(), b = d.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const o = document.createElement('i'); o.className = 'fk-orb'; o.setAttribute('aria-hidden', 'true');
    o.style.left = (x0 - 7) + 'px'; o.style.top = (y0 - 7) + 'px';
    document.body.appendChild(o);
    const an = o.animate([
      { transform: 'translate(0,0) scale(1.5)', opacity: 1 },
      { transform: 'translate(' + ((x1 - x0) * .55) + 'px,' + ((y1 - y0) * .3 - 22) + 'px) scale(1)', opacity: 1, offset: .55 },
      { transform: 'translate(' + (x1 - x0) + 'px,' + (y1 - y0) + 'px) scale(.7)', opacity: .9 }
    ], { duration: 300, easing: 'cubic-bezier(.3,.7,.2,1)' });
    an.onfinish = () => { try { o.remove(); } catch (e) {} d.classList.remove('land'); void d.offsetWidth; d.classList.add('land'); setTimeout(() => d.classList.remove('land'), 420); };
    an.oncancel = () => { try { o.remove(); } catch (e) {} };
  }
  /* les 6 points s'illuminent ensemble quand le code est complet */
  function bloom(dots){ if (!dots) return; dots.classList.remove('done'); void dots.offsetWidth; dots.classList.add('done'); setTimeout(() => dots.classList.remove('done'), 700); }

  /* root : conteneur de l'écran ; press(valeur, bouton) est appelé à chaque touche (« del » compris) */
  function bind(root, press){
    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('.fk-key'); if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--rx', (((e.clientX - r.left) / Math.max(r.width, 1)) * 100).toFixed(1) + '%');
      b.style.setProperty('--ry', (((e.clientY - r.top) / Math.max(r.height, 1)) * 100).toFixed(1) + '%');
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    });
    root.addEventListener('pointermove', (e) => {
      const b = e.target.closest && e.target.closest('.fk-key'); if (!b || e.pointerType === 'touch') return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--px', (((e.clientX - r.left) / Math.max(r.width, 1)) * 100).toFixed(1) + '%');
      b.style.setProperty('--py', (((e.clientY - r.top) / Math.max(r.height, 1)) * 100).toFixed(1) + '%');
    });
    root.addEventListener('click', (e) => {
      const s = e.target.closest && e.target.closest('[data-shuf]');
      if (s){
        const pad = s.closest('.fk-pad'); if (!pad) return;
        setShuffle(!shuffleOn());
        pad.innerHTML = keysHtml(pad.getAttribute('data-fk-cls') || 'yl');
        pad.classList.remove('reflow'); void pad.offsetWidth; pad.classList.add('reflow');
        try { UIKit.haptic('tap'); } catch (err) {}
        return;
      }
      const b = e.target.closest && e.target.closest('[data-k]');
      if (b) press(b.getAttribute('data-k'), b);
    });
  }
  return { padHtml, bind, fly, bloom, shuffleOn };
})();
