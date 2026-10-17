'use strict';

/* ============================================================
   OPENING ART (12.11.0) — écran d'ouverture animé + 4 illustrations de la présentation.
   Aucune image externe : tout est dessiné en SVG / CSS (aux couleurs Friendly : turquoise #0B7F75 → #2DD4BF, blanc).
   Les animations vivent dans css/opening.css ; sans animation (réglage « réduire les animations »), chaque dessin est déjà dans son état final.
   ============================================================ */
const OpeningArt = (() => {
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
  const MARK_F = 'M180 388V196a54 54 0 0 1 54-54H372';
  const MARK_BAR = 'M180 266H326';

  /* ---------- écran d'ouverture ---------- */
  const SPLASH_TXT = {
    en: 'Your money, simple and secure.',
    fr: 'Votre argent, simple et sécurisé.',
    ar: 'أموالك، بسيطة وآمنة.'
  };
  function letters(word){
    return Array.from(word).map((ch, i) => '<span class="sp-l" style="--i:' + i + '" aria-hidden="true">' + esc(ch) + '</span>').join('');
  }
  function splash(lang){
    lang = lang || (typeof LANG === 'string' ? LANG : 'en');
    const ar = lang === 'ar';
    const word = ar
      /* l'arabe est cursif : jamais découpé lettre par lettre (cela casserait les liaisons) ni espacé */
      ? '<span class="sp-name sp-name-ar">فرندي</span><span class="sp-pay sp-pay-ar">باي</span>'
      : '<span class="sp-name" aria-hidden="true">' + letters('Friendly') + '</span><span class="sp-pay" aria-hidden="true">PAY</span>';
    return '' +
      '<div class="sp-bg" aria-hidden="true"><i class="sp-blob sp-b1"></i><i class="sp-blob sp-b2"></i><i class="sp-blob sp-b3"></i><i class="sp-dots"></i></div>' +
      '<div class="sp-core" role="img" aria-label="' + (ar ? 'فرندي باي' : 'Friendly Pay') + '">' +
        '<div class="sp-mark" aria-hidden="true">' +
          '<i class="sp-halo"></i><i class="sp-ring sp-r1"></i><i class="sp-ring sp-r2"></i>' +
          '<svg class="sp-svg" viewBox="0 0 512 512" focusable="false">' +
            '<defs><linearGradient id="sp-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0B7F75"/></linearGradient>' +
            '<clipPath id="sp-clip"><rect width="512" height="512" rx="120"/></clipPath></defs>' +
            '<g class="sp-tile"><rect width="512" height="512" rx="120" fill="url(#sp-g)"/>' +
              '<g clip-path="url(#sp-clip)"><rect class="sp-shine" x="-200" y="-60" width="120" height="640" fill="#fff" opacity=".28"/></g></g>' +
            '<g transform="translate(-20 -9)" fill="none" stroke="#fff" stroke-width="54" stroke-linecap="round" stroke-linejoin="round">' +
              '<path class="sp-f1" pathLength="1" d="' + MARK_F + '"/><path class="sp-f2" pathLength="1" d="' + MARK_BAR + '"/></g>' +
            '<circle class="sp-dot" cx="318" cy="369" r="31" fill="#fff"/>' +
          '</svg>' +
        '</div>' +
        '<div class="sp-word">' + word + '</div>' +
        '<p class="sp-tag">' + esc(SPLASH_TXT[lang] || SPLASH_TXT.en) + '</p>' +
      '</div>' +
      '<div class="sp-foot" aria-hidden="true"><span class="sp-bar"><i></i></span></div>';
  }

  /* ---------- illustrations de la présentation ---------- */
  const DEFS = '<svg class="oa-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="oa-teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0B7F75"/></linearGradient>' +
    '<linearGradient id="oa-teal-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19B9A8"/><stop offset="1" stop-color="#09665E"/></linearGradient>' +
    '<linearGradient id="oa-amber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD77A"/><stop offset="1" stop-color="#F29F1B"/></linearGradient>' +
    '<linearGradient id="oa-card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D9F3EF"/></linearGradient>' +
    '<radialGradient id="oa-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2DD4BF" stop-opacity=".42"/><stop offset="1" stop-color="#2DD4BF" stop-opacity="0"/></radialGradient>' +
    '<clipPath id="oa-tile"><rect x="105" y="73" width="110" height="110" rx="30"/></clipPath>' +
    '<filter id="oa-blur" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>' +
    '</defs></svg>';

  const spark = (x, y, s, d) => '<path class="oa-spark" style="--d:' + d + 's" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z"/>';
  const shadow = (cx, cy, rx) => '<ellipse class="oa-shadow" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="8" fill="#0B7F75" opacity=".22" filter="url(#oa-blur)"/>';
  const svg = (inner, cls) => '<svg class="oa-svg ' + (cls || '') + '" viewBox="26 12 268 236" aria-hidden="true" focusable="false">' + inner + '</svg>';

  /* 1 — bienvenue : la marque au centre, quatre objets qui tournent autour */
  function heroWelcome(){
    const chip = (x, y, cls, body) => '<g transform="translate(' + x + ' ' + y + ')"><g class="oa-chip ' + cls + '">' + body + '</g></g>';
    return svg(
      '<circle class="oa-pulse" cx="160" cy="128" r="116" fill="url(#oa-glow)"/>' +
      '<circle cx="160" cy="128" r="66" fill="none" stroke="var(--accent)" stroke-opacity=".2" stroke-width="1.5"/>' +
      '<circle class="oa-spin-ring" cx="160" cy="128" r="96" fill="none" stroke="var(--accent)" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="1 9" stroke-linecap="round"/>' +
      shadow(160, 216, 46) +
      '<g class="oa-float"><rect x="105" y="73" width="110" height="110" rx="30" fill="url(#oa-teal)"/>' +
        '<path clip-path="url(#oa-tile)" d="M105 73h110v36c-38 20-72 20-110 0z" fill="#fff" opacity=".14"/>' +
        '<g transform="translate(105 73) scale(.215)"><g transform="translate(-20 -9)" fill="none" stroke="#fff" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"><path d="' + MARK_F + '"/><path d="' + MARK_BAR + '"/></g><circle cx="318" cy="369" r="31" fill="#fff"/></g>' +
      '</g>' +
      '<g class="oa-orbit">' +
        chip(160, 32, 'oa-c1', '<circle r="21" fill="url(#oa-amber)"/><circle r="14.5" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2"/><path d="M0-7 6 0 0 7-6 0Z" fill="#fff"/>') +
        chip(256, 128, 'oa-c2', '<rect x="-21" y="-21" width="42" height="42" rx="13" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".18"/><path d="M0-11 10-6.5v5.5c0 6.5-4.5 10.5-10 12.5-5.5-2-10-6-10-12.5v-5.5z" fill="none" stroke="#0B7F75" stroke-width="2.6" stroke-linejoin="round"/><path d="M-4.5 0 -1 3.5 5-3" fill="none" stroke="#0B7F75" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>') +
        chip(160, 224, 'oa-c3', '<rect x="-21" y="-21" width="42" height="42" rx="13" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".18"/><path d="M10-10-2 2M10-10 4 11 0 3-8-1l18-9Z" transform="translate(-1 0)" fill="none" stroke="#0B7F75" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>') +
        chip(64, 128, 'oa-c4', '<rect x="-25" y="-16" width="50" height="32" rx="8" fill="url(#oa-teal-d)"/><rect x="-25" y="-8" width="50" height="6" fill="#fff" opacity=".22"/><rect x="-19" y="4" width="11" height="7" rx="2" fill="#fff" opacity=".85"/>') +
      '</g>' +
      spark(60, 52, 1, 0) + spark(268, 60, .8, .8) + spark(274, 206, 1, 1.5) + spark(50, 206, .7, .4)
    , 'oa-welcome');
  }

  /* 2 — envoyer : une pièce traverse l'arc d'une personne à l'autre, le destinataire reçoit */
  function heroSend(){
    const person = (cx, cy, cls) =>
      '<g class="' + cls + '"><circle cx="' + cx + '" cy="' + cy + '" r="36" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".2" stroke-width="1.5"/>' +
      '<circle cx="' + cx + '" cy="' + (cy - 8) + '" r="11" fill="url(#oa-teal)"/><path d="M' + (cx - 20) + ' ' + (cy + 24) + 'c2-12 10-17 20-17s18 5 20 17a36 36 0 0 1-40 0Z" fill="url(#oa-teal)"/></g>';
    return svg(
      '<circle class="oa-pulse" cx="160" cy="130" r="118" fill="url(#oa-glow)"/>' +
      shadow(70, 206, 34) + shadow(250, 206, 34) +
      '<path class="oa-flow" d="M100 130Q160 28 220 130" fill="none" stroke="var(--accent)" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 10"/>' +
      '<g class="oa-bolt" transform="translate(160 66)"><circle r="15" fill="url(#oa-teal)"/><path d="M2-8-5 2h5l-2 7 7-10H2l2-7Z" fill="#fff"/></g>' +
      person(70, 150, 'oa-from') + person(250, 150, 'oa-to') +
      '<circle class="oa-ripple" cx="250" cy="150" r="38" fill="none" stroke="var(--accent)" stroke-width="3"/>' +
      '<g class="oa-coin"><g transform="translate(100 130)"><circle r="14" fill="url(#oa-amber)"/><circle r="9.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.8"/><path d="M0-4.5 4 0 0 4.5-4 0Z" fill="#fff"/></g></g>' +
      '<g transform="translate(274 120)"><g class="oa-ok"><circle r="14" fill="#16A37F"/><path d="M-6 0 -2 4 6-4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g></g>' +
      '<rect x="36" y="196" width="68" height="22" rx="11" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".18"/><rect x="216" y="196" width="68" height="22" rx="11" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".18"/>' +
      '<text x="70" y="211.5" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" font-weight="700" fill="#0B7F75" direction="ltr">FRD-••••</text>' +
      '<text x="250" y="211.5" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" font-weight="700" fill="#0B7F75" direction="ltr">FRD-••••</text>' +
      spark(160, 28, .9, .2) + spark(40, 90, .7, 1) + spark(286, 84, .8, .6)
    , 'oa-send');
  }

  /* 3 — crypto : pile de pièces, une pièce qui tourne, un graphique qui monte, un échange */
  function heroCrypto(){
    const coinFace = (r) => '<circle r="' + r + '" fill="url(#oa-amber)"/><circle r="' + (r * .7) + '" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.2"/><path d="M0-' + (r * .34) + ' ' + (r * .3) + ' 0 0 ' + (r * .34) + ' -' + (r * .3) + ' 0Z" fill="#fff"/>';
    const bar = (x, h, d) => '<rect class="oa-bar" style="--d:' + d + 's" x="' + x + '" y="' + (214 - h) + '" width="13" height="' + h + '" rx="4" fill="url(#oa-teal-d)"/>';
    return svg(
      '<circle class="oa-pulse" cx="160" cy="130" r="118" fill="url(#oa-glow)"/>' +
      shadow(160, 218, 58) +
      '<g><ellipse cx="160" cy="208" rx="46" ry="14" fill="#C97D0F"/><rect x="114" y="190" width="92" height="18" fill="#E3920F"/><ellipse cx="160" cy="190" rx="46" ry="14" fill="url(#oa-amber)"/>' +
        '<ellipse cx="160" cy="184" rx="46" ry="14" fill="#C97D0F"/><rect x="114" y="166" width="92" height="18" fill="#E3920F"/><ellipse cx="160" cy="166" rx="46" ry="14" fill="url(#oa-amber)"/>' +
        '<ellipse cx="160" cy="160" rx="46" ry="14" fill="#C97D0F"/><rect x="114" y="142" width="92" height="18" fill="#E3920F"/><ellipse cx="160" cy="142" rx="46" ry="14" fill="url(#oa-amber)"/>' +
        '<ellipse cx="160" cy="142" rx="30" ry="8.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/></g>' +
      '<g class="oa-hover"><g transform="translate(160 84)"><g class="oa-flip">' + coinFace(34) + '</g></g></g>' +
      '<g class="oa-chart"><rect x="28" y="112" width="84" height="102" rx="18" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".16"/>' +
        bar(42, 28, 0) + bar(61, 44, .12) + bar(80, 62, .24) +
        '</g>' +
      '<g class="oa-swap" transform="translate(262 150)"><circle r="30" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".16"/>' +
        '<g class="oa-swap-arrows" fill="none" stroke="#0B7F75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M-12-4h20m-6-6 6 6-6 6"/><path d="M12 6H-8m6-6-6 6 6 6" transform="translate(0 2)"/></g></g>' +
      spark(60, 44, .9, .3) + spark(276, 66, .8, 1) + spark(40, 232, .6, .7)
    , 'oa-crypto');
  }

  /* 4 — sécurité : bouclier avec coche qui se dessine, code à 6 chiffres qui se remplit, balayage du visage */
  function heroSecure(){
    const dot = (x, i) => '<circle class="oa-pin" style="--i:' + i + '" cx="' + x + '" cy="214" r="6"/>';
    return svg(
      '<circle class="oa-pulse" cx="160" cy="112" r="112" fill="url(#oa-glow)"/>' +
      '<circle class="oa-shield-ring" cx="160" cy="108" r="78" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
      shadow(160, 190, 52) +
      '<g class="oa-float"><path d="M160 44 224 70v46c0 40-26 66-64 80-38-14-64-40-64-80V70z" fill="url(#oa-teal)"/>' +
        '<path d="M160 44 224 70v46c0 40-26 66-64 80z" fill="#fff" opacity=".12"/>' +
        '<path class="oa-check" pathLength="1" d="M132 118 152 138 190 98" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<g transform="translate(52 62)"><g class="oa-face"><rect x="-26" y="-26" width="52" height="52" rx="14" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".16"/>' +
        '<g fill="none" stroke="#0B7F75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M-17-9v-6a2 2 0 0 1 2-2h6M17-9v-6a2 2 0 0 0-2-2h-6M-17 9v6a2 2 0 0 0 2 2h6M17 9v6a2 2 0 0 1-2 2h-6"/><path d="M-6-4v3M6-4v3M-5 7q5 5 10 0" stroke-width="2.6"/></g>' +
        '<rect class="oa-scan" x="-18" y="-1" width="36" height="3" rx="1.5" fill="var(--accent)"/></g></g>' +
      '<g transform="translate(268 70)"><g class="oa-lock"><rect x="-24" y="-24" width="48" height="48" rx="14" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".16"/>' +
        '<rect x="-10" y="-3" width="20" height="15" rx="4" fill="url(#oa-teal-d)"/><path d="M-6-3v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#0B7F75" stroke-width="3" stroke-linecap="round"/></g></g>' +
      '<rect x="90" y="196" width="140" height="36" rx="18" fill="url(#oa-card)" stroke="#0B7F75" stroke-opacity=".18"/>' +
      dot(112, 0) + dot(131, 1) + dot(150, 2) + dot(170, 3) + dot(189, 4) + dot(208, 5) +
      spark(40, 150, .8, .5) + spark(284, 150, .9, 1.1)
    , 'oa-secure');
  }

  const HEROES = [heroWelcome, heroSend, heroCrypto, heroSecure];
  function hero(i){ const f = HEROES[i]; return f ? f() : ''; }

  return { splash, hero, DEFS, count: HEROES.length };
})();
