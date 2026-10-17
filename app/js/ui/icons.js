'use strict';

/* ============================================================
   SVG ICONS
   ============================================================ */
const IC = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  send:'<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7Z"/>',
  receive:'<path d="M12 5v14M5 12l7 7 7-7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6l-12 12"/>',
  check:'<path d="M5 12l5 5L20 7"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M3 7h16M20 13h-3a2 2 0 0 0 0 4h3"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  cards:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
  crypto:'<circle cx="12" cy="12" r="9"/><path d="M9 9h4a2 2 0 0 1 0 4H9v2h4M11 7v2M11 15v2"/>',
  mobile:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield:'<path d="M12 3l8 4v6c0 5-3.5 8-8 8s-8-3-8-8V7l8-4z"/><path d="M9 12l2 2 4-4"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
  trending:'<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  percent:'<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M19 5L5 19"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  warn:'<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  swap:'<path d="M7 4v13M7 4l-3 3M7 4l3 3M17 20V7M17 20l-3-3M17 20l3-3"/>',
  bank:'<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  banknote:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7M14 21h7"/>',
  network:'<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 6.5l3 3M14 6.5l-3 3M7 17.5l3-3M14 17.5l-3-3"/>',
  arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUpRight:'<path d="M7 17L17 7M7 7h10v10"/>',
  arrowDownRight:'<path d="M7 7l10 10M17 7v10H7"/>',
  sparkle:'<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01"/>',
  vibrate:'<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>',
  contact:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/><circle cx="19" cy="6" r="2.5" fill="currentColor" stroke="none"/>',
  device:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  session:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'
};
const _svgCache = new Map();
function svg(name, size){
  size = size || 20;
  const key = name + '|' + size;
  let s = _svgCache.get(key);
  if (s) return s;
  s = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" style="width:calc(' + size + 'px*var(--ui));height:calc(' + size + 'px*var(--ui))" class="ic" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[name] || '') + '</svg>';
  _svgCache.set(key, s);
  return s;
}
const icon = (name, size) => svg(name, size);

const FLAGS = {
  OM:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#DB0011"/><rect y="13.3" width="30" height="6.7" fill="#008000"/><rect width="8" height="20" fill="#DB0011"/><path d="M2.5 4L4 6.5 1 6.5z" fill="#fff"/></svg>',
  AE:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#009A44"/><rect y="13.3" width="30" height="6.7" fill="#000"/><rect width="8" height="20" fill="#CE1126"/></svg>',
  SA:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#165D31"/><path d="M7 13h16M7 15h14" stroke="#fff" stroke-width="1.2"/></svg>',
  QA:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><path d="M0 0h8l2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2H0z" fill="#8D1B3D"/></svg>',
  KW:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#007A3D"/><rect y="13.3" width="30" height="6.7" fill="#CE1126"/><path d="M0 0l7 6.7v6.7L0 20z" fill="#000"/></svg>',
  BH:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><path d="M0 0h8l3 2.5-3 2.5 3 2.5-3 2.5 3 2.5-3 2.5H0z" fill="#CE1126"/></svg>',
  US:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><g fill="#B22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.16" width="30" height="1.54"/><rect y="9.24" width="30" height="1.54"/><rect y="12.32" width="30" height="1.54"/><rect y="15.4" width="30" height="1.54"/></g><rect width="12" height="10.78" fill="#3C3B6E"/></svg>',
  FR:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ED2939"/></svg>',
  GB:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.6"/></svg>',
  CI:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="10" height="20" fill="#FF8200"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#009A44"/></svg>',
  ML:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="10" height="20" fill="#14B53A"/><rect x="10" width="10" height="20" fill="#FCD116"/><rect x="20" width="10" height="20" fill="#CE1126"/></svg>',
  BF:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="10" fill="#EF2B2D"/><rect y="10" width="30" height="10" fill="#009E49"/></svg>',
  GN:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="10" height="20" fill="#CE1126"/><rect x="10" width="10" height="20" fill="#FCD116"/><rect x="20" width="10" height="20" fill="#009460"/></svg>',
  SD:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="6.7" fill="#D21034"/><rect y="6.7" width="30" height="6.6" fill="#fff"/><rect y="13.3" width="30" height="6.7" fill="#000"/><path d="M0 0l8 10-8 10z" fill="#007229"/></svg>',
  EG:'<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="6.7" fill="#CE1126"/><rect y="6.7" width="30" height="6.6" fill="#fff"/><rect y="13.3" width="30" height="6.7" fill="#000"/></svg>'
};
function flag(iso){ return FLAGS[iso] || FLAGS.US; }

const isArabicUi = () => typeof LANG === 'string' && LANG === 'ar';
function logoMark(size){
  size = size || 48;
  return '<img class="logo-mark" src="assets/brand/logo-mark.svg" alt="' + (isArabicUi() ? 'فرندي باي' : 'Friendly Pay') + '" width="' + size + '" height="' + size + '" style="width:calc(' + size + 'px*var(--ui));height:calc(' + size + 'px*var(--ui));border-radius:22%" decoding="async">';
}
function logoLockup(size){
  size = size || 48;
  /* arabe : mot-symbole « فرندي باي » (jamais de lettres espacées : elles casseraient les liaisons de l'écriture arabe) */
  const word = isArabicUi()
    ? '<span class="logo-name logo-name-ar">فرندي</span><span class="logo-sub logo-sub-ar">باي</span>'
    : '<span class="logo-name">Friendly</span><span class="logo-sub">PAY</span>';
  return '<div class="logo-lockup">' + logoMark(size) + '<div class="logo-word">' + word + '</div></div>';
}
const ASSET_INITIALS = { BTC:'₿', ETH:'Ξ', USDT:'₮', USDC:'$', BNB:'BNB', SOL:'SOL', XRP:'XRP', LTC:'Ł' };
function assetLogo(symbol, size, tint){
  size = size || 40;
  const bg = tint || (CRYPTO_ASSETS.find(a => a.symbol === symbol) || { tint:'#0D9488' }).tint;
  const init = ASSET_INITIALS[symbol] || symbol.slice(0, 2);
  return '<div class="asset-coin" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + '">' + init + '</div>';
}
function networkLogo(net, size){
  size = size || 40;
  const tint = net.tint || '#0D9488';
  const init = (net.symbol || 'N').slice(0, 3);
  return '<div class="net-logo" style="width:' + size + 'px;height:' + size + 'px;background:linear-gradient(135deg,' + tint + ',' + tint + 'cc)">' + init + '</div>';
}

function settingsToggleRow({ icon, title, sub, checked, action, id }){
  return '<button class="settings-row" type="button" data-action="' + action + '" id="' + (id || '') + '" role="switch" aria-checked="' + (checked ? 'true' : 'false') + '">' +
    '<div class="tile">' + icon_(icon, 20) + '</div>' +
    '<div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(title) + '</div>' +
    (sub ? '<div class="settings-row-sub">' + escapeHtml(sub) + '</div>' : '') + '</div>' +
    '<span class="switch" aria-hidden="true"></span>' +
  '</button>';
}
function settingsLinkRow({ icon, title, sub, nav, value }){
  return '<button class="settings-row" type="button" data-nav="' + nav + '">' +
    '<div class="tile">' + icon_(icon, 20) + '</div>' +
    '<div class="settings-row-body"><div class="settings-row-title">' + escapeHtml(title) + '</div>' +
    (sub ? '<div class="settings-row-sub">' + escapeHtml(sub) + '</div>' : '') + '</div>' +
    (value ? '<span class="settings-value">' + escapeHtml(value) + '</span>' : '') +
    '<span class="settings-row-chev">' + icon_('chev', 18) + '</span>' +
  '</button>';
}
function settingsSection(title){
  return '<div class="settings-section">' + escapeHtml(title) + '</div>';
}
function icon_(name, size){ return svg(name, size); }

/* YOR icon set v6: 24px grid, 1.8 stroke, rounded caps, soft duotone fill */
const YOR_ICONS = (() => {
  const duo = (d) => '<path d="' + d + '" fill="currentColor" fill-opacity=".15" stroke="none"/><path d="' + d + '"/>';
  const dc = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="currentColor" fill-opacity=".15" stroke="none"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
  const rr = (x, y, w, h, r) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="currentColor" fill-opacity=".15" stroke="none"/><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"/>';
  return {
    home: duo('M4 10.6 12 4l8 6.6V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.2H9v5.2H5.5A1.5 1.5 0 0 1 4 19z'),
    history: dc(12, 12, 8.5) + '<path d="M12 7.6V12l3 1.9"/>',
    send: duo('M20.5 3.5 3.5 10l6.4 3.8 3.8 6.7z') + '<path d="M20.5 3.5 9.9 13.8"/>',
    receive: '<path d="M12 4v11M7.4 10.6 12 15.2l4.6-4.6"/><path d="M5 19.5h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="M5 12.5l4.6 4.6L19 7.5"/>',
    chev: '<path d="M9.5 6l6 6-6 6"/>',
    back: '<path d="M14.5 6l-6 6 6 6"/>',
    user: dc(12, 8.4, 3.8) + '<path d="M4.6 20c.9-3.7 3.8-5.6 7.4-5.6s6.5 1.9 7.4 5.6"/>',
    profile: dc(12, 8.4, 3.8) + '<path d="M4.6 20c.9-3.7 3.8-5.6 7.4-5.6s6.5 1.9 7.4 5.6"/>',
    wallet: rr(3.5, 6.5, 17, 13, 3.2) + '<path d="M6.5 6.5 15 4a1.5 1.5 0 0 1 1.9 1.4v1.1"/><path d="M15.5 13h2.2"/>',
    globe: dc(12, 12, 8.5) + '<path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z"/>',
    cards: rr(2.8, 5.2, 18.4, 13.6, 3) + '<path d="M2.8 10h18.4M6.5 15h3"/>',
    crypto: dc(12, 12, 8.5) + '<path d="M9.6 8.4h3.1a1.9 1.9 0 0 1 0 3.8H9.6m0 0h3.5a1.9 1.9 0 0 1 0 3.8H9.6M9.6 8.4V16M11.6 7v1.4M11.6 16v1.4"/>',
    mobile: rr(7, 2.8, 10, 18.4, 2.6) + '<path d="M11 17.6h2"/>',
    settings: dc(12, 12, 3.1) + '<path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>',
    lock: rr(5, 10.5, 14, 10, 2.8) + '<path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7M12 14.6v2.2"/>',
    shield: duo('M12 3.2 19.5 6v5.6c0 4.4-3 7.6-7.5 9.2-4.5-1.6-7.5-4.8-7.5-9.2V6z') + '<path d="M8.9 12.1l2.2 2.2 4-4.2"/>',
    eye: '<path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z"/>' + dc(12, 12, 2.9),
    eyeOff: '<path d="M10.6 5.8A9.3 9.3 0 0 1 12 5.6c6 0 9.4 6.4 9.4 6.4a16 16 0 0 1-2.7 3.5M6.6 7.3A15.600 15.600 0 0 0 2.6 12S6 18.4 12 18.4a9 9 0 0 0 4.200-1"/><path d="M9.9 9.9a3 3 0 0 0 4.200 4.200M3.5 3.5l17 17"/>',
    bell: duo('M6 9.5a6 6 0 0 1 12 0c0 5.400 2 6.800 2 6.800H4S6 14.900 6 9.500z') + '<path d="M10 19.800a2.200 2.200 0 0 0 4 0"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 15l3.400-3.800 3 2.600L19 8.200"/>',
    trending: '<path d="M3.500 17l6-6 4 4L21 7.500"/><path d="M15.500 7.500H21V13"/>',
    share: dc(6, 12, 2.6) + dc(17.400, 5.800, 2.600) + dc(17.400, 18.200, 2.600) + '<path d="M8.300 10.800l6.800-3.800M8.300 13.200l6.800 3.800"/>',
    download: '<path d="M12 4v11M7.400 10.800 12 15.400l4.600-4.600"/><path d="M5 19.500h14"/>',
    copy: rr(8.500, 8.500, 11.500, 11.500, 2.600) + '<path d="M15.500 8.500V6.400a2 2 0 0 0-2-2H6.400a2 2 0 0 0-2 2v7.100a2 2 0 0 0 2 2h2.100"/>',
    cal: rr(3.500, 5, 17, 15.500, 3) + '<path d="M3.500 10h17M8 3v4M16 3v4"/>',
    clock: dc(12, 12, 8.500) + '<path d="M12 7.600V12l3 1.900"/>',
    doc: duo('M14 3H7.500A2.500 2.500 0 0 0 5 5.500v13A2.500 2.500 0 0 0 7.500 21h9a2.500 2.500 0 0 0 2.500-2.500V8z') + '<path d="M14 3v5h5M8.800 13h6.400M8.800 16.500h4"/>',
    percent: '<path d="M18.500 5.500l-13 13"/>' + dc(7, 7, 2.300) + dc(17, 17, 2.300),
    logout: '<path d="M9.500 20.500H6.500a2.500 2.500 0 0 1-2.500-2.500V6a2.500 2.500 0 0 1 2.500-2.500h3"/><path d="M15.500 16.500 20 12l-4.500-4.500M20 12H9.500"/>',
    warn: duo('M12 3.800 21 19.500H3z') + '<path d="M12 10v4M12 16.800h.01"/>',
    search: dc(11, 11, 6.800) + '<path d="M20 20l-4-4"/>',
    swap: '<path d="M7.500 4.500v14M7.500 4.500l-3.200 3.200M7.500 4.500l3.200 3.200M16.500 19.500v-14M16.500 19.500l-3.200-3.200M16.500 19.500l3.200-3.200"/>',
    bank: duo('M3.500 9.500 12 4l8.500 5.500z') + '<path d="M5.500 10v7.500M9.800 10v7.500M14.200 10v7.500M18.500 10v7.500M3.500 20.500h17"/>',
    banknote: rr(2.500, 6, 19, 12, 2.600) + dc(12, 12, 2.600),
    qr: rr(3.500, 3.500, 6.500, 6.500, 1.400) + rr(14, 3.500, 6.500, 6.500, 1.400) + rr(3.500, 14, 6.500, 6.500, 1.400) + '<path d="M14 14h3v3M20.500 14v.1M14 20.500h3.500M20.500 17.500v3"/>',
    network: dc(12, 12, 2.800) + dc(5, 5.500, 1.900) + dc(19, 5.500, 1.900) + dc(5, 18.500, 1.900) + dc(19, 18.500, 1.900) + '<path d="M6.400 6.800l3.400 3.400M17.600 6.800l-3.400 3.400M6.400 17.200l3.400-3.400M17.600 17.200l-3.400-3.400"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7M8.500 7H17v8.500"/>',
    arrowDownRight: '<path d="M7 7l10 10M17 8.500V17H8.500"/>',
    sparkle: duo('M12 3l1.900 5.600L19.500 10.500l-5.600 1.900L12 18l-1.900-5.600L4.500 10.500l5.600-1.900z') + '<path d="M19 3v3M17.500 4.500h3"/>',
    trash: '<path d="M4 6.500h16M9.500 6.500V4.500h5v2M6.500 6.500l.9 12.600a2 2 0 0 0 2 1.900h5.200a2 2 0 0 0 2-1.900l.9-12.600M10 11v5.500M14 11v5.500"/>',
    info: dc(12, 12, 8.500) + '<path d="M12 11v5M12 7.900h.01"/>',
    mail: rr(3, 5.500, 18, 13, 2.800) + '<path d="M3.500 8l8.500 6 8.500-6"/>',
    help: dc(12, 12, 8.500) + '<path d="M9.600 9.600a2.500 2.500 0 1 1 3.600 2.200c-.8.400-1.200.9-1.200 1.800M12 16.800h.01"/>',
    vibrate: rr(8, 3, 8, 18, 2.400) + '<path d="M3.500 8.500v7M20.500 8.500v7M11 17.800h2"/>',
    contact: dc(10.500, 8.600, 3.600) + '<path d="M3.600 20c.8-3.400 3.400-5.300 6.900-5.300s6.100 1.900 6.900 5.300M19 6.500v5M16.500 9h5"/>',
    device: rr(6.500, 2.800, 11, 18.400, 2.800) + '<path d="M10.500 17.800h3"/>',
    session: dc(12, 12, 8.500) + '<path d="M12 7.600V12l3 1.900"/>'
  };
})();

Object.assign(IC, YOR_ICONS);

/* ============================================================
   FRIENDLY ICON SET (12.9.0) — new drawings, 24px grid, 1.9 stroke, round caps.
   Signature: every filled icon has a soft "shadow" shape (class d2) offset by 1.4px behind the line drawing, tinted by --ic2
   (falls back to currentColor). The shadow snaps into place on press and "pops" on the active tab (css/friendly.css).
   The eye is line-only on purpose (transparent). Names are unchanged from the previous set, plus apps / faceid / backspace / shuffle.
   ============================================================ */
const FRIENDLY_ICONS = (() => {
  const s2 = (d) => '<path class="d2" d="' + d + '"/>';
  const c2 = (cx, cy, r) => '<circle class="d2" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
  const r2 = (x, y, w, h, r) => '<rect class="d2" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"/>';
  const p = (d) => '<path d="' + d + '"/>';
  const c = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
  const r = (x, y, w, h, rx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '"/>';
  const person = c2(12, 8.2, 3.6) + c(12, 8.2, 3.6) + p('M4.8 20.2c.8-3.8 3.7-5.7 7.2-5.7s6.4 1.9 7.2 5.7');
  const clock = c2(12, 12, 8.3) + c(12, 12, 8.3) + p('M12 7.6V12l3.1 1.9');
  return {
    home: s2('M5.6 10.2 12 4.8l6.4 5.4V19a1.5 1.5 0 0 1-1.5 1.5H7.1A1.5 1.5 0 0 1 5.6 19z') + p('M3.4 11.4 12 4l8.6 7.4') + p('M5.6 9.9V19a1.5 1.5 0 0 0 1.5 1.5h9.8a1.5 1.5 0 0 0 1.5-1.5V9.9') + p('M10 20.5v-4.6a2 2 0 0 1 4 0v4.6'),
    cards: r2(3, 5.5, 18, 13, 3.4) + r(3, 5.5, 18, 13, 3.4) + p('M3 10.2h18') + p('M7 15.2h3.4'),
    send: s2('M20.6 3.4 14 20.6l-3.6-7L3.4 10z') + p('M20.6 3.4 14 20.6l-3.6-7L3.4 10z') + p('M20.6 3.4 10.4 13.6'),
    crypto: s2('M12 3.4l7.4 4.2v8.8L12 20.6l-7.4-4.2V7.6z') + p('M12 3.4l7.4 4.2v8.8L12 20.6l-7.4-4.2V7.6z') + p('M12 8.3l3.2 3.7-3.2 3.7-3.2-3.7z'),
    apps: r2(4, 4, 6.4, 6.4, 2) + r2(13.6, 4, 6.4, 6.4, 2) + r2(4, 13.6, 6.4, 6.4, 2) + r2(13.6, 13.6, 6.4, 6.4, 2) + r(4, 4, 6.4, 6.4, 2) + r(13.6, 4, 6.4, 6.4, 2) + r(4, 13.6, 6.4, 6.4, 2) + r(13.6, 13.6, 6.4, 6.4, 2),
    history: c2(12.4, 12.4, 7.6) + p('M12.4 4.4a8 8 0 1 1-7.7 5.8') + p('M4.2 4.6v4.2h4.2') + p('M12.4 8.2v4.2l2.9 1.8'),
    receive: r2(4.5, 16.6, 15, 3.8, 1.9) + p('M12 3.8v11M7.5 10.6 12 15.1l4.5-4.5') + p('M4.5 19.4h15'),
    plus: p('M12 5v14M5 12h14'),
    minus: p('M5 12h14'),
    close: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
    check: p('M5 12.6l4.7 4.6L19 7.6'),
    chev: p('M9.5 5.8l6.2 6.2-6.2 6.2'),
    back: p('M14.5 5.8 8.3 12l6.2 6.2'),
    user: person,
    profile: person,
    wallet: r2(3.4, 6.6, 17.2, 13, 3.6) + r(3.4, 6.6, 17.2, 13, 3.6) + p('M6.6 6.6l9.6-3a1.4 1.4 0 0 1 1.8 1.3v1.7') + p('M14.6 13.1h3.8'),
    globe: c2(12, 12, 8.4) + c(12, 12, 8.4) + p('M3.6 12h16.8') + p('M12 3.6c2.4 2.4 3.4 5.2 3.4 8.4s-1 6-3.4 8.4c-2.4-2.4-3.4-5.2-3.4-8.4s1-6 3.4-8.4z'),
    mobile: r2(6.8, 2.8, 10.4, 18.4, 3) + r(6.8, 2.8, 10.4, 18.4, 3) + p('M10.6 17.8h2.8'),
    device: r2(6.8, 2.8, 10.4, 18.4, 3) + r(6.8, 2.8, 10.4, 18.4, 3) + p('M10.6 17.8h2.8'),
    settings: p('M4 7h8.6M17.6 7H20M4 12h2.6M11.6 12H20M4 17h8.9M17.9 17H20') + c2(15.1, 7, 2.5) + c(15.1, 7, 2.5) + c2(9.1, 12, 2.5) + c(9.1, 12, 2.5) + c2(15.4, 17, 2.5) + c(15.4, 17, 2.5),
    lock: r2(5, 10.4, 14, 10.2, 3) + r(5, 10.4, 14, 10.2, 3) + p('M8.2 10.4V7.9a3.8 3.8 0 0 1 7.6 0v2.5') + p('M12 14.7v2.4'),
    shield: s2('M12 3.4 19.6 6.2v5.5c0 4.3-3 7.5-7.6 9.1-4.6-1.6-7.6-4.8-7.6-9.1V6.2z') + p('M12 3.4 19.6 6.2v5.5c0 4.3-3 7.5-7.6 9.1-4.6-1.6-7.6-4.8-7.6-9.1V6.2z') + p('M8.9 12l2.2 2.2 4.1-4.3'),
    eye: p('M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z') + c(12, 12, 2.9),
    eyeOff: p('M10.4 5.9A8.6 8.6 0 0 1 12 5.8c6 0 9.4 6.2 9.4 6.2a16 16 0 0 1-3 3.7M6.5 7.6A15.600 15.600 0 0 0 2.6 12S6 18.2 12 18.2a9 9 0 0 0 4-.9') + p('M9.8 9.9a3 3 0 0 0 4.200 4.200') + p('M4 4l16 16'),
    bell: s2('M12 4a5.700 5.700 0 0 0-5.700 5.700v4L4.500 16.800v.7h15v-.7l-1.800-3.100v-4A5.700 5.700 0 0 0 12 4z') + p('M12 4a5.700 5.700 0 0 0-5.700 5.700v4L4.500 16.800v.7h15v-.7l-1.800-3.100v-4A5.700 5.700 0 0 0 12 4z') + p('M9.800 20.300a2.400 2.400 0 0 0 4.400 0'),
    chart: p('M6 20v-6M12 20V5.500M18 20v-9.500'),
    trending: p('M3.500 16.500l5.500-5.500 4 4 7.500-8') + p('M15 7h5.500v5.500'),
    share: c2(6.200, 12, 2.600) + c2(17.400, 5.800, 2.600) + c2(17.400, 18.200, 2.600) + c(6.200, 12, 2.600) + c(17.400, 5.800, 2.600) + c(17.400, 18.200, 2.600) + p('M8.500 10.800l6.600-3.800M8.500 13.200l6.600 3.800'),
    download: p('M12 4v11M7.500 10.600 12 15.100l4.500-4.500') + p('M4.500 19.500h15'),
    copy: r2(8.800, 8.800, 11.200, 11.200, 3) + r(8.800, 8.800, 11.200, 11.200, 3) + p('M15.500 8.800V6.700a2.200 2.200 0 0 0-2.200-2.200H6.700a2.200 2.200 0 0 0-2.200 2.200v6.600a2.200 2.200 0 0 0 2.200 2.200h2.100'),
    cal: r2(3.500, 5, 17, 15.500, 3.400) + r(3.500, 5, 17, 15.500, 3.400) + p('M3.500 10h17M8 3v4M16 3v4'),
    clock: clock,
    session: clock,
    doc: s2('M14 3.600H7.600A2.600 2.600 0 0 0 5 6.200v11.600A2.600 2.600 0 0 0 7.600 20.400h8.800A2.600 2.600 0 0 0 19 17.800V8.600z') + p('M14 3.600H7.600A2.600 2.600 0 0 0 5 6.200v11.600A2.600 2.600 0 0 0 7.600 20.400h8.800A2.600 2.600 0 0 0 19 17.800V8.600z') + p('M13.800 3.800v4.800h4.900M8.800 13h6.400M8.800 16.500h4'),
    percent: p('M18.500 5.500l-13 13') + c2(7.200, 7.200, 2.400) + c(7.200, 7.200, 2.400) + c2(16.800, 16.800, 2.400) + c(16.800, 16.800, 2.400),
    logout: p('M9.500 20.500H6.800A2.800 2.800 0 0 1 4 17.700V6.300a2.800 2.800 0 0 1 2.800-2.800h2.700') + p('M15.500 16.500 20 12l-4.500-4.500M20 12H9.500'),
    warn: s2('M12 3.800 21.200 19.800H2.800z') + p('M12 3.800 21.200 19.800H2.800z') + p('M12 10v4.200M12 16.900h.01'),
    search: c2(11, 11, 6.800) + c(11, 11, 6.800) + p('M20 20l-4.200-4.200'),
    swap: p('M5 8.500h12.500M14.500 5.500l3 3-3 3') + p('M19 15.500H6.500M9.500 12.500l-3 3 3 3'),
    bank: s2('M3.500 9.600 12 4l8.500 5.600z') + p('M3.500 9.600 12 4l8.500 5.600z') + p('M5.800 12.600v4.800M10 12.600v4.800M14 12.600v4.800M18.200 12.600v4.800M3.500 20.500h17'),
    banknote: r2(2.500, 6, 19, 12, 3) + r(2.500, 6, 19, 12, 3) + c(12, 12, 2.600),
    qr: r2(3.500, 3.500, 6.500, 6.500, 1.600) + r(3.500, 3.500, 6.500, 6.500, 1.600) + r(14, 3.500, 6.500, 6.500, 1.600) + r(3.500, 14, 6.500, 6.500, 1.600) + p('M14 14h3v3M20.500 14v.1M14 20.500h3.500M20.500 17.500v3'),
    network: c2(12, 12, 2.800) + c(12, 12, 2.800) + c(5, 5.500, 1.900) + c(19, 5.500, 1.900) + c(5, 18.500, 1.900) + c(19, 18.500, 1.900) + p('M6.400 6.800l3.400 3.400M17.600 6.800l-3.400 3.400M6.400 17.200l3.400-3.400M17.600 17.200l-3.400-3.400'),
    arrowRight: p('M5 12h14M13 6l6 6-6 6'),
    arrowUpRight: p('M7 17 17 7M8.500 7H17v8.500'),
    arrowDownRight: p('M7 7l10 10M17 8.500V17H8.500'),
    sparkle: s2('M12 3.800c.7 4.100 2.300 5.700 6.400 6.400-4.100.7-5.700 2.300-6.400 6.400-.7-4.100-2.300-5.700-6.400-6.400 4.100-.7 5.700-2.300 6.400-6.400z') + p('M12 3.800c.7 4.100 2.300 5.700 6.400 6.400-4.100.7-5.700 2.300-6.400 6.400-.7-4.100-2.300-5.700-6.400-6.400 4.100-.7 5.700-2.300 6.400-6.400z') + p('M18.500 15.500v4M16.500 17.500h4'),
    trash: s2('M6.500 7.500h11l-.8 11.400a2 2 0 0 1-2 1.800H9.300a2 2 0 0 1-2-1.800z') + p('M4 6.500h16M9.500 6.500V4.500h5v2M6.600 7.500l.7 11.400a2 2 0 0 0 2 1.800h5.400a2 2 0 0 0 2-1.800l.7-11.400M10 11v5.500M14 11v5.500'),
    info: c2(12, 12, 8.400) + c(12, 12, 8.400) + p('M12 11v5M12 7.900h.01'),
    mail: r2(3, 5.500, 18, 13, 3.200) + r(3, 5.500, 18, 13, 3.200) + p('M3.800 8.200 12 14l8.200-5.800'),
    help: c2(12, 12, 8.400) + c(12, 12, 8.400) + p('M9.600 9.600a2.500 2.500 0 1 1 3.600 2.200c-.8.400-1.200.9-1.200 1.800M12 16.800h.01'),
    vibrate: r2(8, 3, 8, 18, 2.600) + r(8, 3, 8, 18, 2.600) + p('M3.500 8.500v7M20.500 8.500v7M11 17.800h2'),
    contact: c2(10.500, 8.600, 3.600) + c(10.500, 8.600, 3.600) + p('M3.600 20c.8-3.400 3.400-5.300 6.900-5.300s6.100 1.900 6.900 5.300M19 6.500v5M16.500 9h5'),
    backspace: s2('M9.200 5.600h9.300a1.600 1.600 0 0 1 1.600 1.600v9.600a1.600 1.600 0 0 1-1.600 1.600H9.200L3.600 12z') + p('M9.200 5.600h9.300a1.600 1.600 0 0 1 1.600 1.600v9.600a1.600 1.600 0 0 1-1.600 1.600H9.200L3.600 12z') + p('M12.800 9.600l4.200 4.800M17 9.600l-4.200 4.800'),
    shuffle: p('M3.500 7.500h3c4.200 0 5 9 9.200 9h3.800M3.500 16.500h3c1.700 0 2.800-1.300 3.700-3M13.500 10.300c.9-1.700 2-2.800 3.700-2.800h2.300') + p('M17.500 5l2.500 2.500-2.500 2.500M17.500 14l2.500 2.500-2.500 2.500'),
    faceid: p('M4 8.200V6.600A2.600 2.600 0 0 1 6.600 4H8.200M15.800 4h1.600A2.600 2.600 0 0 1 20 6.600v1.600M20 15.800v1.600a2.600 2.600 0 0 1-2.600 2.600h-1.600M8.200 20H6.600A2.600 2.600 0 0 1 4 17.400v-1.600') + p('M9.200 9.600v1.600M14.800 9.600v1.600M12 9.600v3.700h-.8M9.200 15.600c.8 1 1.700 1.500 2.800 1.500s2-.5 2.800-1.500')
  };
})();
Object.assign(IC, FRIENDLY_ICONS);
