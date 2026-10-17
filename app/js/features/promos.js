'use strict';

/* ===== FRIENDLY PAY 12.10.0 — carrousel de publicités de l'accueil =====
   Quatre cartes illustrées (personnages originaux dessinés pour Friendly Pay, assets/ads/ad-*.svg) placées sous les actions rapides.
   Règles :
   - chaque carte porte l'étiquette « Publicité » ; elle ne promet rien que l'application ne fait pas aujourd'hui (aucun frais, délai ou taux annoncé) ;
   - aucun logo ni nom de marque tiers ; (12.12.0 : la carte « Friendly ID » est retirée, on ne reçoit plus par identifiant dans l'interface) ;
   - défilement tactile natif (scroll-snap), compatible droite-gauche ; défilement automatique seulement si l'écran n'est pas touché et
     si l'appareil n'a pas demandé « réduire les animations » ;
   - « Masquer » cache le carrousel jusqu'à la fin de la session (sessionStorage) ; rien n'est stocké durablement. */
const Promos = (() => {
  const KEY = 'yor.promos.dismissed';
  const AUTO_MS = 6500;
  const ITEMS = [
    { id: 'send', tone: 'send', nav: 'country-select', art: 'assets/ads/ad-send.svg',
      title: { fr: 'Envoyez à vos proches', en: 'Send to your loved ones', ar: 'أرسل إلى أحبّائك' },
      body:  { fr: 'Quelques gestes suffisent, depuis votre téléphone.', en: 'A few taps are all it takes, right from your phone.', ar: 'بضع لمسات تكفي، من هاتفك مباشرة.' },
      cta:   { fr: 'Envoyer', en: 'Send', ar: 'إرسال' } },
    { id: 'card', tone: 'card', nav: 'cards', art: 'assets/ads/ad-card.svg',
      title: { fr: 'Vos cartes Friendly', en: 'Your Friendly cards', ar: 'بطاقاتك من فرندي' },
      body:  { fr: 'Gelez ou dégelez une carte en un geste.', en: 'Freeze or unfreeze a card with one tap.', ar: 'جمّد البطاقة أو ألغِ التجميد بلمسة واحدة.' },
      cta:   { fr: 'Mes cartes', en: 'My cards', ar: 'بطاقاتي' } },
    { id: 'secure', tone: 'secure', nav: 'settings', art: 'assets/ads/ad-secure.svg',
      title: { fr: 'Votre compte protégé', en: 'Your account, protected', ar: 'حسابك محمي' },
      body:  { fr: 'Code PIN et Face ID gardent l’accès à votre argent.', en: 'PIN and Face ID guard access to your money.', ar: 'رمز PIN وFace ID يحميان الوصول إلى أموالك.' },
      cta:   { fr: 'Réglages', en: 'Settings', ar: 'الإعدادات' } },
    { id: 'lang', tone: 'lang', nav: 'settings', art: 'assets/ads/ad-lang.svg',
      title: { fr: 'Friendly parle votre langue', en: 'Friendly speaks your language', ar: 'فرندي بلغتك' },
      body:  { fr: 'Français, English et العربية, à votre choix.', en: 'Français, English and العربية, your choice.', ar: 'العربية وEnglish وFrançais، كما تفضّل.' },
      cta:   { fr: 'Langue', en: 'Language', ar: 'اللغة' } },
  ];
  const UI = {
    fr: { tag: 'Publicité', region: 'Publicités Friendly', hide: 'Masquer', hideLbl: 'Masquer les publicités', go: (i, n) => 'Aller à la carte ' + i + ' sur ' + n, slide: (i, n) => i + ' sur ' + n },
    en: { tag: 'Ad', region: 'Friendly ads', hide: 'Hide', hideLbl: 'Hide ads', go: (i, n) => 'Go to card ' + i + ' of ' + n, slide: (i, n) => i + ' of ' + n },
    ar: { tag: 'إعلان', region: 'إعلانات فرندي', hide: 'إخفاء', hideLbl: 'إخفاء الإعلانات', go: (i, n) => 'الانتقال إلى البطاقة ' + i + ' من ' + n, slide: (i, n) => i + ' من ' + n },
  };
  const lang = () => (typeof LANG === 'string' && UI[LANG]) ? LANG : 'en';
  const tx = (o) => o[lang()] || o.en;
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  function dismissed() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function dismiss() { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* l'état reste en mémoire de la page */ } }
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  /* HTML du carrousel (chaîne vide si masqué pour la session) */
  function html() {
    if (dismissed()) return '';
    const u = UI[lang()], n = ITEMS.length;
    return '<section class="rv-sec rv-promos" data-promos role="region" aria-roledescription="carousel" aria-label="' + esc(u.region) + '">' +
      '<div class="rv-promo-track" data-promo-track tabindex="0">' +
      ITEMS.map((it, i) =>
        '<article class="rv-promo t-' + it.tone + '" data-promo-slide role="group" aria-roledescription="slide" aria-label="' + esc(u.slide(i + 1, n)) + '">' +
          '<div class="rv-promo-txt"><span class="rv-promo-tag">' + esc(u.tag) + '</span>' +
            '<h3>' + esc(tx(it.title)) + '</h3><p>' + esc(tx(it.body)) + '</p>' +
            '<button class="rv-promo-cta" type="button" data-nav="' + esc(it.nav) + '">' + esc(tx(it.cta)) + '</button></div>' +
          '<img class="rv-promo-art" src="' + esc(it.art) + '" alt="" width="240" height="200" decoding="async"' + (i ? ' loading="lazy"' : '') + ' draggable="false">' +
        '</article>').join('') +
      '</div>' +
      '<div class="rv-promo-foot"><div class="rv-promo-dots">' +
        ITEMS.map((it, i) => '<button type="button" class="rv-promo-dot' + (i === 0 ? ' on' : '') + '" data-promo-dot="' + i + '" aria-label="' + esc(u.go(i + 1, n)) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>').join('') +
      '</div><button type="button" class="rv-promo-hide" data-promo-hide aria-label="' + esc(u.hideLbl) + '">' + esc(u.hide) + '</button></div>' +
    '</section>';
  }

  const slidesOf = (root) => Array.prototype.slice.call(root.querySelectorAll('[data-promo-slide]'));
  function currentIndex(root) {
    const s = slidesOf(root);
    if (s.length < 2) return 0;
    const step = Math.abs(s[1].getBoundingClientRect().left - s[0].getBoundingClientRect().left) || 1;
    const t = root.querySelector('[data-promo-track]');
    return Math.max(0, Math.min(s.length - 1, Math.round(Math.abs(t.scrollLeft) / step)));
  }
  function paintDots(root, idx) {
    root.querySelectorAll('[data-promo-dot]').forEach((d, i) => {
      const on = i === idx;
      d.classList.toggle('on', on);
      if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
  }
  function goTo(root, idx, smooth) {
    const s = slidesOf(root)[idx];
    if (!s) return;
    /* 12.14.0: only the track scrolls. scrollIntoView() also scrolled every parent (#screens moved sideways by ~18 px and every later
       screen was drawn shifted; the page could jump vertically while being read). Works left-to-right and right-to-left. */
    const t = s.parentElement, s0 = slidesOf(root)[0]; if (!t || !s0) return;
    const left = s.offsetLeft - s0.offsetLeft;      /* absolute position (negative in right-to-left, as browsers expect) */
    try { t.scrollTo({ left, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' }); } catch (e) { t.scrollLeft = left; }
  }

  let timer = null, raf = 0;
  function tick() {
    const root = document.querySelector('[data-promos]');
    if (!root || root.dataset.touched === '1' || document.hidden || reduceMotion()) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > (window.innerHeight || 800)) return;          // hors de l'écran : on n'anime pas
    const n = ITEMS.length;
    goTo(root, (currentIndex(root) + 1) % n, true);
  }
  function stopAuto(root) { if (root) root.dataset.touched = '1'; }

  function init() {
    if (init.done) return;
    init.done = true;
    /* clics : points, « Masquer » */
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      const dot = t.closest('[data-promo-dot]');
      if (dot) { const root = dot.closest('[data-promos]'); stopAuto(root); goTo(root, Number(dot.getAttribute('data-promo-dot')), true); return; }
      const hide = t.closest('[data-promo-hide]');
      if (hide) { e.preventDefault(); e.stopPropagation(); dismiss(); const root = hide.closest('[data-promos]'); if (root) root.remove(); }
    }, true);
    /* le défilement met à jour les points ; le toucher arrête le défilement automatique */
    document.addEventListener('scroll', (e) => {
      const t = e.target;
      if (!t || !t.matches || !t.matches('[data-promo-track]')) return;
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; const root = t.closest('[data-promos]'); if (root) paintDots(root, currentIndex(root)); });
    }, true);
    ['pointerdown', 'touchstart', 'wheel', 'keydown', 'focusin'].forEach((ev) => document.addEventListener(ev, (e) => {
      const root = e.target && e.target.closest ? e.target.closest('[data-promos]') : null;
      if (root) stopAuto(root);
    }, { capture: true, passive: true }));
    timer = setInterval(tick, AUTO_MS);
  }

  return { html, init, ITEMS, _dismiss: dismiss };
})();
