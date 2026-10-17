/* Accessoires 3D doux : pièces, avion, cartes, bouclier, cadenas, bulles. Aucun logo de marque tierce (pas de Visa / Mastercard). */
const r1 = (n) => Math.round(n * 10) / 10;

export const sparkle = (x, y, s, fill = '#fff', op = 0.9) =>
  `<path transform="translate(${x} ${y})" d="M0 ${-s} Q${r1(s * 0.14)} ${r1(-s * 0.14)} ${s} 0 Q${r1(s * 0.14)} ${r1(s * 0.14)} 0 ${s} Q${r1(-s * 0.14)} ${r1(s * 0.14)} ${-s} 0 Q${r1(-s * 0.14)} ${r1(-s * 0.14)} 0 ${-s}Z" fill="${fill}" opacity="${op}"/>`;

/* pièce dorée avec la marque « F. » (lettre + point), épaisseur visible */
export const coin = (x, y, r, rot = 0) => `
<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#drop)">
  <circle cy="${r1(r * 0.16)}" r="${r}" fill="#B9780A"/>
  <circle r="${r}" fill="url(#g-coin)"/>
  <circle r="${r1(r * 0.78)}" fill="none" stroke="#C98A0E" stroke-width="${r1(r * 0.1)}" opacity=".6"/>
  <path d="M${r1(-r * 0.2)} ${r1(r * 0.34)} V${r1(-r * 0.34)} H${r1(r * 0.3)} M${r1(-r * 0.2)} ${r1(-r * 0.02)} H${r1(r * 0.2)}" fill="none" stroke="#B87708" stroke-width="${r1(r * 0.17)}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${r1(r * 0.34)}" cy="${r1(r * 0.36)}" r="${r1(r * 0.09)}" fill="#B87708"/>
  <ellipse cx="${r1(-r * 0.34)}" cy="${r1(-r * 0.46)}" rx="${r1(r * 0.34)}" ry="${r1(r * 0.14)}" fill="#fff" opacity=".6" transform="rotate(-35 ${r1(-r * 0.34)} ${r1(-r * 0.46)})"/>
</g>`;

/* bulle ronde avec l'avion « envoyer » */
export const sendBubble = (x, y, r) => `
<g transform="translate(${x} ${y})" filter="url(#drop)">
  <circle r="${r}" fill="url(#g-teal)"/><circle r="${r}" fill="none" stroke="#fff" stroke-width="${r1(r * 0.09)}" opacity=".85"/>
  <path transform="scale(${r1(r / 14)})" d="M-6.5 -0.5 L7 -6 L3.2 7 L0.6 1.2Z" fill="#fff"/><path transform="scale(${r1(r / 14)})" d="M0.6 1.2 L7 -6" stroke="#0B7F75" stroke-width="1" opacity=".5"/>
  <ellipse cx="${r1(-r * 0.3)}" cy="${r1(-r * 0.5)}" rx="${r1(r * 0.42)}" ry="${r1(r * 0.18)}" fill="#fff" opacity=".35" transform="rotate(-30 ${r1(-r * 0.3)} ${r1(-r * 0.5)})"/>
</g>`;

/* téléphone (centré en 0,0 ; 28 × 48) ; contenu d'écran dans un repère 23 × 43 centré */
export const phone = (screen = '', rot = 0) => `
<g transform="rotate(${rot})" filter="url(#drop)">
  <rect x="-14.5" y="-24.5" width="29" height="49" rx="6" fill="url(#g-phone)"/>
  <rect x="-12" y="-22" width="24" height="44" rx="4" fill="url(#g-screen)"/>
  <g transform="translate(-11.5 -21.5)" clip-path="inset(0 round 3.6px)">${screen}</g>
  <rect x="-3.5" y="-21.2" width="7" height="2.2" rx="1.1" fill="#0C1F1D" opacity=".85"/>
  <path d="M-13.5 -20 C-13.5 -23 -11 -24 -8 -24" fill="none" stroke="#fff" stroke-width=".8" opacity=".35"/>
</g>`;

export const screens = {
  /* écran « envoyer » : bandeau turquoise + bouton + lignes */
  send: `<rect width="23" height="43" fill="#EFFFFC"/><rect width="23" height="15" fill="url(#g-screen-d)"/><circle cx="11.5" cy="7.5" r="4.6" fill="#fff" opacity=".95"/><path d="M9.2 7.7 L14 5.6 L12.5 10 L11.4 8.1Z" fill="#0B7F75"/>
    <rect x="3" y="19" width="17" height="3" rx="1.5" fill="#B7DED8"/><rect x="3" y="25" width="11" height="3" rx="1.5" fill="#D3EEE9"/><rect x="3" y="32" width="17" height="7" rx="3.5" fill="url(#g-teal)"/>`,
  ok: `<rect width="23" height="43" fill="#EFFFFC"/><circle cx="11.5" cy="14" r="7" fill="url(#g-teal)"/><path d="M7.8 14 L10.5 16.8 L15.4 11.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="4" y="26" width="15" height="3" rx="1.5" fill="#B7DED8"/><rect x="6.5" y="32" width="10" height="3" rx="1.5" fill="#D3EEE9"/>`,
  id: `<rect width="23" height="43" fill="#EFFFFC"/><rect x="2.5" y="4" width="18" height="14" rx="3" fill="url(#g-screen-d)"/><circle cx="8" cy="9.5" r="2.6" fill="#fff"/><rect x="12" y="8" width="6.5" height="2" rx="1" fill="#fff" opacity=".9"/><rect x="12" y="11.5" width="4.5" height="2" rx="1" fill="#fff" opacity=".6"/>
    <rect x="3" y="23" width="17" height="3" rx="1.5" fill="#B7DED8"/><rect x="3" y="29" width="12" height="3" rx="1.5" fill="#D3EEE9"/><rect x="3" y="35" width="17" height="5" rx="2.5" fill="url(#g-teal)"/>`,
  scan: `<rect width="23" height="43" fill="#0A3B36"/><g fill="none" stroke="#5CEBD6" stroke-width="1.6" stroke-linecap="round"><path d="M4 11 V6 Q4 4 6 4 H10"/><path d="M13 4 H17 Q19 4 19 6 V11"/><path d="M4 26 V31 Q4 33 6 33 H10"/><path d="M13 33 H17 Q19 33 19 31 V26"/></g>
    <circle cx="11.5" cy="16" r="5" fill="#E9B98A"/><path d="M5.5 29 Q11.5 21 17.5 29Z" fill="#E9B98A"/><circle cx="9.7" cy="15.3" r=".8" fill="#2A1A15"/><circle cx="13.3" cy="15.3" r=".8" fill="#2A1A15"/>
    <rect x="3.5" y="18.2" width="16" height="1.4" rx=".7" fill="#5CEBD6" opacity=".9"/><circle cx="7" cy="38.5" r="1.4" fill="#5CEBD6"/><circle cx="11.5" cy="38.5" r="1.4" fill="#5CEBD6"/><circle cx="16" cy="38.5" r="1.4" fill="#5CEBD6" opacity=".4"/>`,
  card: `<rect width="23" height="43" fill="#EFFFFC"/><rect x="2.5" y="5" width="18" height="11.5" rx="2.4" fill="url(#g-card)"/><rect x="4.5" y="8" width="4" height="3" rx=".8" fill="#F5C040"/>
    <rect x="3" y="21" width="17" height="3" rx="1.5" fill="#B7DED8"/><rect x="3" y="27" width="12" height="3" rx="1.5" fill="#D3EEE9"/><circle cx="17" cy="35.5" r="3.4" fill="#BFE9FF"/>`,
};

/* carte bancaire stylisée (96 × 60, centrée en 0,0) — marque « F. », puce, ondes ; AUCUN logo de réseau de cartes */
export const card = (rot = 0, opts = {}) => {
  const { dark = false } = opts;
  const g = dark ? 'url(#g-deep)' : 'url(#g-card)';
  return `
<g transform="rotate(${rot})" filter="url(#drop)">
  <rect x="-48" y="-30" width="96" height="60" rx="8.5" fill="${g}"/>
  <path d="M-48 8 C-20 -8 6 -4 48 -22 L48 -21.5 C48 -25 45 -30 40 -30 L-39.5 -30 C-44.6 -30 -48 -26.6 -48 -21.5Z" fill="#fff" opacity=".12"/>
  <circle cx="30" cy="22" r="24" fill="#fff" opacity=".06"/><circle cx="40" cy="30" r="20" fill="#fff" opacity=".06"/>
  <rect x="-38" y="-14" width="16" height="12.5" rx="2.6" fill="url(#g-gold)"/><path d="M-38 -7.8 H-22 M-30 -14 V-1.5" stroke="#B87708" stroke-width=".9" opacity=".6"/>
  <g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"><path d="M-14 -11 q4 4 0 8"/><path d="M-10 -13 q6 6 0 12"/><path d="M-6 -15 q8 8 0 16"/></g>
  <g transform="translate(30 -14)"><path d="M-6 8 V-8 H7 M-6 0 H4" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="8" r="2.2" fill="#fff"/></g>
  <g fill="#fff" opacity=".9"><circle cx="-36" cy="14" r="1.8"/><circle cx="-30" cy="14" r="1.8"/><circle cx="-24" cy="14" r="1.8"/><circle cx="-18" cy="14" r="1.8"/><circle cx="-8" cy="14" r="1.8"/><circle cx="-2" cy="14" r="1.8"/><circle cx="4" cy="14" r="1.8"/><circle cx="10" cy="14" r="1.8"/></g>
  <rect x="-38" y="20" width="26" height="3.2" rx="1.6" fill="#fff" opacity=".5"/>
  <rect x="-47.4" y="-29.4" width="94.8" height="58.8" rx="8" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
</g>`;
};

export const snowBadge = (x, y, r = 11) => `
<g transform="translate(${x} ${y})" filter="url(#drop)"><circle r="${r}" fill="url(#g-ice)"/><circle r="${r}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".9"/>
  <g stroke="#fff" stroke-width="1.7" stroke-linecap="round">${[0, 60, 120].map((a) => `<path transform="rotate(${a})" d="M0 ${-r * 0.62} V${r * 0.62}"/>`).join('')}</g>
  <g stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none"><path d="M-2.2 ${-r * 0.5} L0 ${-r * 0.3} L2.2 ${-r * 0.5}"/><path d="M-2.2 ${r * 0.5} L0 ${r * 0.3} L2.2 ${r * 0.5}"/></g></g>`;

/* carte d'identité Friendly ID : l'identifiant est MASQUÉ (« FRD-•••••• »), jamais un vrai numéro */
export const idCard = (rot = 0) => `
<g transform="rotate(${rot})" filter="url(#drop)">
  <rect x="-50" y="-31" width="100" height="62" rx="9" fill="url(#g-white)"/>
  <path d="M-50 -22 a9 9 0 0 1 9 -9 H41 a9 9 0 0 1 9 9 V-14 H-50Z" fill="url(#g-teal)"/>
  <g transform="translate(-37 -22.5)"><path d="M-3.6 5 V-5 H4.2 M-3.6 0 H2.2" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5.2" cy="5" r="1.3" fill="#fff"/></g>
  <text x="-26" y="-18.4" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="7.4" font-weight="800" fill="#fff" letter-spacing=".5">Friendly ID</text>
  <circle cx="-30" cy="6" r="11.5" fill="#D9F2EE"/><circle cx="-30" cy="1.4" r="4.6" fill="#0B7F75"/><path d="M-39.5 14.6 Q-30 3 -20.5 14.6Z" fill="#0B7F75"/>
  <text x="-12" y="3" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="8.2" font-weight="800" fill="#0A4E48" letter-spacing=".4">FRD-••••••</text>
  <rect x="-12" y="9" width="40" height="3.4" rx="1.7" fill="#BFE5DF"/><rect x="-12" y="16" width="26" height="3.4" rx="1.7" fill="#D6EEEA"/>
  <circle cx="38" cy="20" r="5.2" fill="url(#g-teal)"/><path d="M35.6 20 L37.5 22 L40.7 18" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="-49.4" y="-30.4" width="98.8" height="60.8" rx="8.6" fill="none" stroke="#fff" stroke-opacity=".7"/>
</g>`;

export const shield = (x, y, k = 1) => `
<g transform="translate(${x} ${y}) scale(${k})" filter="url(#drop)">
  <path d="M0 -36 C15 -30 27 -28 36 -28 L36 5 C36 24 19 36 0 44 C-19 36 -36 24 -36 5 L-36 -28 C-27 -28 -15 -30 0 -36Z" fill="url(#g-shield)"/>
  <path d="M0 -29 C12 -24 22 -22.5 29.5 -22.5 L29.5 4.6 C29.5 20 16 30 0 37 C-16 30 -29.5 20 -29.5 4.6 L-29.5 -22.5 C-22 -22.5 -12 -24 0 -29Z" fill="#fff" opacity=".14"/>
  <path d="M0 -36 C-15 -30 -27 -28 -36 -28 L-36 5 C-36 24 -19 36 0 44Z" fill="#fff" opacity=".16"/>
  <path d="M-14 3 L-4.5 12.5 L15 -9" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="-17" cy="-20" rx="9" ry="3.6" fill="#fff" opacity=".45" transform="rotate(-24 -17 -20)"/>
</g>`;

export const lock = (x, y, k = 1) => `
<g transform="translate(${x} ${y}) scale(${k})" filter="url(#drop)">
  <path d="M-8 -3 V-9 a8 8 0 0 1 16 0 V-3" fill="none" stroke="#E8A317" stroke-width="4.6" stroke-linecap="round"/>
  <rect x="-13" y="-5" width="26" height="21" rx="5.5" fill="url(#g-gold)"/>
  <circle cx="0" cy="4.6" r="2.7" fill="#9A6A0A"/><rect x="-1.1" y="5" width="2.2" height="5.5" rx="1.1" fill="#9A6A0A"/>
  <ellipse cx="-6" cy="-0.8" rx="5" ry="1.8" fill="#fff" opacity=".5" transform="rotate(-12 -6 -0.8)"/>
</g>`;

export const pinPill = (x, y, filled = 3) => `
<g transform="translate(${x} ${y})" filter="url(#drop)"><rect x="-27" y="-9" width="54" height="18" rx="9" fill="#fff" opacity=".96"/>
  ${[0, 1, 2, 3].map((i) => `<circle cx="${-16.5 + i * 11}" cy="0" r="3.4" ${i < filled ? 'fill="url(#g-teal)"' : 'fill="none" stroke="#8CCFC6" stroke-width="1.6"'}/>`).join('')}</g>`;

/* bulle de dialogue (queue à gauche ou à droite) */
export const bubble = (x, y, w, h, text, { fill = '#fff', ink = '#0A4E48', tail = 'l', size = 11, rtl = false } = {}) => `
<g transform="translate(${x} ${y})" filter="url(#drop)">
  <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2.6}" fill="${fill}"/>
  <path d="${tail === 'l' ? `M${-w / 2 + 10} ${h / 2 - 1} L${-w / 2 + 6} ${h / 2 + 8} L${-w / 2 + 19} ${h / 2 - 1}Z` : `M${w / 2 - 10} ${h / 2 - 1} L${w / 2 - 6} ${h / 2 + 8} L${w / 2 - 19} ${h / 2 - 1}Z`}" fill="${fill}"/>
  <text x="0" y="${r1(size * 0.36)}" text-anchor="middle" font-family="Inter,Segoe UI,Tahoma,Arial,sans-serif" font-size="${size}" font-weight="800" fill="${ink}"${rtl ? ' direction="rtl"' : ''}>${text}</text>
  <rect x="${-w / 2 + 3}" y="${-h / 2 + 2.4}" width="${w - 6}" height="${r1(h * 0.28)}" rx="${r1(h * 0.14)}" fill="#fff" opacity=".35"/>
</g>`;

/* pointillés d'un envoi (arc entre deux personnes) */
export const arc = (x1, y1, cx, cy, x2, y2, color = '#fff') =>
  `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6.5" opacity=".85"/>`;

export const GLOBAL_DEFS = `<linearGradient id="g-ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9EEFF"/><stop offset="1" stop-color="#4FB0EA"/></linearGradient>`;
