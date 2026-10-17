import { COMMON_DEFS, amina, moussa, awa, salim } from './chars.mjs';
import { sparkle, coin, sendBubble, phone, screens, card, snowBadge, idCard, shield, lock, pinPill, bubble, arc, GLOBAL_DEFS } from './props.mjs';

const W = 240, H = 200;
const wrap = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-hidden="true" focusable="false"><defs>${COMMON_DEFS}${GLOBAL_DEFS}${defs}</defs>${body}</svg>`;
const place = (p, x, sc) => `<g transform="translate(${x} ${H - 150 * sc}) scale(${sc})">${p.svg}</g>`;

/* les deux mains tiennent le téléphone (repère local du personnage 120 × 150) */
function holding(p, id, x, sc, screenKey, rot = 0) {
  const y0 = H - 150 * sc;
  return `<g transform="translate(${x} ${y0}) scale(${sc})">
    <path d="M22 112 C16 129 28 144 46 143" fill="none" stroke="url(#${id}-tp)" stroke-width="17" stroke-linecap="round"/>
    <path d="M98 112 C104 129 92 144 74 143" fill="none" stroke="url(#${id}-tp)" stroke-width="17" stroke-linecap="round"/>
    <path d="M22 112 C16 129 28 144 46 143" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".18" transform="translate(-3 -1)"/>
    <g transform="translate(60 123) scale(1.32)">${phone(screens[screenKey], rot)}</g>
    <ellipse cx="45" cy="143" rx="8" ry="7.4" fill="url(#${id}-sk)"/><ellipse cx="75" cy="143" rx="8" ry="7.4" fill="url(#${id}-sk)"/>
    <ellipse cx="47.6" cy="133" rx="3.4" ry="6" fill="url(#${id}-sk)" transform="rotate(-18 47.6 133)"/><ellipse cx="72.4" cy="133" rx="3.4" ry="6" fill="url(#${id}-sk)" transform="rotate(18 72.4 133)"/>
  </g>`;
}

const bgCircles = (light) => {
  const c = light ? '#0B7F75' : '#fff';
  /* les cercles restent À L'INTÉRIEUR du cadre (haut, gauche et droite : en droite-gauche, le bord droit de l'image se retrouve au milieu de la carte) : sinon l'image les coupe net et laisse un bord visible sur la carte */
  return `<circle cx="152" cy="108" r="86" fill="${c}" opacity="${light ? 0.08 : 0.1}"/><circle cx="72" cy="150" r="60" fill="${c}" opacity="${light ? 0.06 : 0.07}"/><circle cx="198" cy="172" r="40" fill="${c}" opacity="${light ? 0.07 : 0.08}"/>`;
};

/* ---------- 1. Envoyer ---------- */
export function sceneSend() {
  const A = amina('am'), M = moussa('mo');
  const spark = (light) => sparkle(24, 40, 6, '#fff', 0.9) + sparkle(210, 30, 5, '#BDF2E9', 0.9) + sparkle(120, 52, 4, '#fff', 0.7);
  return wrap(A.defs + M.defs, `${bgCircles(false)}
    ${arc(60, 46, 120, -14, 182, 46)}
    ${spark()}
    ${coin(96, 25, 6, -12)}${coin(144, 25, 6, 14)}
    ${place(A, -5, 1.02)}${holding(A, 'am', -5, 1.02, 'send')}
    ${place(M, 124, 1.0)}${holding(M, 'mo', 124, 1.0, 'ok')}
    ${coin(120, 18, 13, 8)}
    ${sendBubble(60, 30, 11)}
    ${sparkle(150, 14, 5, '#FFE08A', 0.95)}`);
}

/* ---------- 2. Friendly ID ---------- */
export function sceneId() {
  const W_ = awa('aw');
  return wrap(W_.defs, `${bgCircles(true)}
    ${sparkle(20, 34, 6, '#0B7F75', 0.55)}${sparkle(112, 20, 4.5, '#F2A91D', 0.95)}${sparkle(224, 60, 5, '#0B7F75', 0.45)}
    ${place(W_, 96, 1.05)}${holding(W_, 'aw', 96, 1.05, 'id')}
    <g transform="translate(60 80) scale(.96)">${idCard(-9)}</g>
    ${coin(30, 142, 11, -10)}${coin(52, 168, 6, 12)}
    ${sendBubble(114, 62, 10)}`);
}

/* ---------- 3. Carte ---------- */
export function sceneCard() {
  const S = salim('sa');
  return wrap(S.defs, `${bgCircles(false)}
    ${sparkle(24, 44, 6, '#fff', 0.9)}${sparkle(214, 34, 5, '#BDF2E9', 0.9)}${sparkle(96, 26, 4, '#FFE08A', 0.95)}
    ${place(S, 106, 1.02)}
    <path d="M123 160 C112 152 111 138 119 127" fill="none" stroke="url(#sa-tp)" stroke-width="17" stroke-linecap="round"/>
    <path d="M123 160 C112 152 111 138 119 127" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".25" transform="translate(-3 0)"/>
    <g transform="translate(94 98)">${card(12, { dark: true })}</g>
    <g transform="translate(78 106) scale(1.06)">${card(-13)}</g>
    <g filter="url(#drop)"><ellipse cx="123" cy="124" rx="8.6" ry="11.5" fill="url(#sa-sk)"/>
      <rect x="107" y="112" width="17" height="6.8" rx="3.4" fill="url(#sa-sk)"/><rect x="105.5" y="119.6" width="18" height="6.8" rx="3.4" fill="url(#sa-sk)"/><rect x="107" y="127.2" width="17" height="6.8" rx="3.4" fill="url(#sa-sk)"/>
      <path d="M108 118.4 H122 M107 126 H122" stroke="#A56F44" stroke-width=".9" opacity=".5"/></g>
    ${snowBadge(114, 62, 12)}
    ${coin(30, 160, 9, 10)}`);
}

/* ---------- 4. Sécurité ---------- */
export function sceneSecure() {
  const M = moussa('mo');
  return wrap(M.defs, `${bgCircles(false)}
    <circle cx="64" cy="102" r="60" fill="#fff" opacity=".1"/><circle cx="64" cy="102" r="47" fill="#fff" opacity=".1"/>
    ${sparkle(20, 56, 6, '#fff', 0.9)}${sparkle(100, 30, 5, '#BDF2E9', 0.95)}${sparkle(214, 40, 5, '#FFE08A', 0.95)}
    ${place(M, 104, 1.02)}${holding(M, 'mo', 104, 1.02, 'scan')}
    ${shield(62, 104, 1.05)}
    ${lock(34, 40, 1.0)}${pinPill(96, 40, 3)}
    ${coin(24, 166, 8, -8)}`);
}

/* ---------- 5. Langues ---------- */
export function sceneLang() {
  const M = moussa('mo'), A = amina('am'), W_ = awa('aw');
  return wrap(M.defs + A.defs + W_.defs, `${bgCircles(true)}
    ${place(M, -16, 0.84)}${place(W_, 138, 0.84)}${place(A, 66, 0.96)}
    ${bubble(44, 44, 54, 24, 'Hello', { fill: 'url(#g-teal)', ink: '#fff', tail: 'l', size: 12 })}
    ${bubble(124, 24, 64, 24, 'Bonjour', { fill: '#fff', ink: '#0A4E48', tail: 'l', size: 12 })}
    ${bubble(196, 46, 56, 24, 'مرحبا', { fill: 'url(#g-gold)', ink: '#6E4700', tail: 'r', size: 14, rtl: true })}
    ${sparkle(16, 100, 5, '#0B7F75', 0.5)}${sparkle(228, 108, 5, '#F2A91D', 0.9)}${sparkle(100, 60, 4, '#0B7F75', 0.45)}`);
}

export const SCENES = { send: sceneSend, id: sceneId, card: sceneCard, secure: sceneSecure, lang: sceneLang };
export const BG = { send: ['#0FA595', '#07625A'], id: ['#EAF9F6', '#C9EEE8'], card: ['#0A4F49', '#06302C'], secure: ['#12A594', '#08665E'], lang: ['#F3FBF9', '#D6F1EC'] };
