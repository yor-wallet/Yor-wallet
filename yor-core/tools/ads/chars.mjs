/* Friendly Pay — personnages originaux, style « 3D doux » en SVG (dégradés, reflets, ombres de contact).
   Chaque personnage est dessiné dans une boîte locale de 120 × 150 (buste). Aucun personnage, logo ou visage existant n'est copié. */
const r1 = (n) => Math.round(n * 10) / 10;

export const SKIN = {
  amina:  { light: '#F6D0A8', base: '#E5AE80', dark: '#C98A5C', cheek: '#F2907F' },
  moussa: { light: '#B07A55', base: '#8C5A3B', dark: '#6A4029', cheek: '#C96A55' },
  awa:    { light: '#9C6846', base: '#7B4B31', dark: '#5B3622', cheek: '#C9625A' },
  salim:  { light: '#E0A87A', base: '#C98F5F', dark: '#A56F44', cheek: '#E48A72' },
};

/* dégradé linéaire / radial utilitaires */
const lin = (id, a, b, x1 = 0.2, y1 = 0, x2 = 0.8, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rad = (id, stops, cx = 0.38, cy = 0.3, r = 0.85) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;

/* ---------- visage commun (yeux, sourcils, nez, bouche, joues) ---------- */
function face(id, s, o) {
  const brow = o.brow || '#2B1B14';
  const smileOpen = o.smile !== 'closed';
  return `
  <g>
    <ellipse cx="45" cy="61.5" rx="5.6" ry="3.8" fill="${s.cheek}" opacity=".34"/>
    <ellipse cx="75" cy="61.5" rx="5.6" ry="3.8" fill="${s.cheek}" opacity=".34"/>
    <path d="M42.5 41.6 Q48.5 38.2 55 40.6" fill="none" stroke="${brow}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M65 40.6 Q71.5 38.2 77.5 41.6" fill="none" stroke="${brow}" stroke-width="2.3" stroke-linecap="round"/>
    <g>
      <ellipse cx="49.5" cy="49.5" rx="3.5" ry="4.5" fill="#2A1A15"/>
      <ellipse cx="70.5" cy="49.5" rx="3.5" ry="4.5" fill="#2A1A15"/>
      <circle cx="48.5" cy="47.8" r="1.35" fill="#fff"/><circle cx="69.5" cy="47.8" r="1.35" fill="#fff"/>
      <circle cx="50.8" cy="51.4" r=".65" fill="#fff" opacity=".85"/><circle cx="71.8" cy="51.4" r=".65" fill="#fff" opacity=".85"/>
    </g>
    <path d="M57.4 58.5 Q60 62 62.6 58.5" fill="none" stroke="${s.dark}" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="59" cy="55.3" rx="1.6" ry="2.6" fill="#fff" opacity=".16"/>
    ${smileOpen
      ? `<path d="M50.8 65.6 Q60 66.8 69.2 65.6 Q66.4 76.4 60 76.4 Q53.6 76.4 50.8 65.6Z" fill="#6E2623"/>
         <path d="M52.6 66.2 Q60 67.3 67.4 66.2 Q65.4 70.4 60 70.4 Q54.6 70.4 52.6 66.2Z" fill="#fff"/>
         <ellipse cx="60" cy="74.2" rx="3.6" ry="1.9" fill="#E36C78"/>`
      : `<path d="M51.5 66 Q60 73.5 68.5 66" fill="none" stroke="#7A2F2A" stroke-width="2.3" stroke-linecap="round"/>`}
  </g>`;
}

/* ---------- tête + cou + torse ---------- */
function base(id, s, o) {
  const top = o.top;
  return {
    defs:
      rad(`${id}-sk`, [[0, s.light], [0.58, s.base], [1, s.dark]], 0.36, 0.28, 0.9) +
      lin(`${id}-nk`, s.dark, s.base, 0, 0, 0, 1) +
      lin(`${id}-tp`, top[0], top[1], 0.15, 0, 0.85, 1) +
      `<linearGradient id="${id}-sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${o.shade ?? 0.26}"/></linearGradient>` +
      `<clipPath id="${id}-nc"><path d="M49 70 L49 96 C49 103 54 107 60 107 C66 107 71 103 71 96 L71 70 Z"/></clipPath>` +
      `<clipPath id="${id}-tc"><path d="M6 150 C6 117 20 101 44 97.5 L76 97.5 C100 101 114 117 114 150 Z"/></clipPath>`,
    torso: `
    <ellipse cx="60" cy="149" rx="52" ry="5" fill="#021f1c" opacity=".18" filter="url(#blur3)"/>
    <path d="M6 150 C6 117 20 101 44 97.5 L76 97.5 C100 101 114 117 114 150 Z" fill="url(#${id}-tp)"/>
    <path d="M6 150 C6 117 20 101 44 97.5 L76 97.5 C100 101 114 117 114 150 Z" fill="url(#${id}-sh)"/>
    <ellipse cx="30" cy="110" rx="19" ry="6.5" fill="#fff" opacity=".2" transform="rotate(-24 30 110)"/>`,
    neck: `
    <path d="M49 70 L49 96 C49 103 54 107 60 107 C66 107 71 103 71 96 L71 70 Z" fill="url(#${id}-nk)"/>
    <g clip-path="url(#${id}-nc)"><ellipse cx="60" cy="79.5" rx="17" ry="7" fill="#000" opacity=".3" filter="url(#blur2)"/></g>`,
    head: `
    <ellipse cx="33.6" cy="52" rx="4.6" ry="6.4" fill="url(#${id}-sk)"/><ellipse cx="86.4" cy="52" rx="4.6" ry="6.4" fill="url(#${id}-sk)"/>
    <ellipse cx="33.8" cy="52.4" rx="2" ry="3.4" fill="${s.dark}" opacity=".5"/><ellipse cx="86.2" cy="52.4" rx="2" ry="3.4" fill="${s.dark}" opacity=".5"/>
    <ellipse cx="60" cy="49" rx="26.5" ry="29.5" fill="url(#${id}-sk)"/>
    <ellipse cx="50" cy="31" rx="13" ry="6" fill="#fff" opacity=".17" transform="rotate(-16 50 31)"/>`,
    face: face(id, s, o),
  };
}

/* ---------- Amina : hijab crème, haut turquoise ---------- */
export function amina(id = 'am') {
  const s = SKIN.amina;
  const b = base(id, s, { top: ['#14B3A1', '#0B7F75'] });
  return {
    defs: b.defs + lin(`${id}-hj`, '#FFF7EA', '#E7CFA8', 0.15, 0, 0.85, 1) + lin(`${id}-hj2`, '#F6E6C8', '#D9BC8E', 0, 0, 0, 1) +
      `<clipPath id="${id}-hc"><path d="M20 60 C14 19 38 3 60 3 C83 3 106 19 100 60 C100 75 105 90 110 106 C97 122 80 127 60 127 C40 127 23 122 10 106 C15 90 20 75 20 60Z"/></clipPath>`,
    svg: `${b.torso}
    <ellipse cx="60" cy="52" rx="25.5" ry="29" fill="url(#${id}-sk)"/>
    ${b.face}
    <g clip-path="url(#${id}-hc)">
      <path d="M-4 0 H124 V150 H-4 Z M34.5 52 a25.5 29 0 1 0 51 0 a25.5 29 0 1 0 -51 0Z" fill="url(#${id}-hj)" fill-rule="evenodd"/>
      <path d="M-4 0 H124 V150 H-4 Z M34.5 52 a25.5 29 0 1 0 51 0 a25.5 29 0 1 0 -51 0Z" fill="url(#${id}-sh)" fill-rule="evenodd"/>
      <path d="M26 98 C36 110 48 118 60 119 C72 118 84 110 94 98" fill="none" stroke="#B89865" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
      <path d="M16 108 C28 110 40 112 52 113" fill="none" stroke="#B89865" stroke-width="1.5" stroke-linecap="round" opacity=".42"/>
      <path d="M104 108 C92 110 80 112 68 113" fill="none" stroke="#B89865" stroke-width="1.5" stroke-linecap="round" opacity=".42"/>
      <path d="M34.5 52 a25.5 29 0 1 0 51 0 a25.5 29 0 1 0 -51 0Z" fill="none" stroke="#B48C56" stroke-width="2" opacity=".32"/>
      <ellipse cx="34" cy="26" rx="22" ry="8" fill="#fff" opacity=".4" transform="rotate(-38 34 26)"/>
    </g>
    <path d="M44 98 C50 109 70 109 76 98 C70 104.5 50 104.5 44 98Z" fill="#0A6A62" opacity=".0"/>`,
  };
}

/* ---------- Moussa : cheveux bouclés courts, barbe légère, chemise moutarde ---------- */
export function moussa(id = 'mo') {
  const s = SKIN.moussa;
  const b = base(id, s, { top: ['#F7C85B', '#E39F23'], brow: '#1E120D' });
  const curls = [];
  for (let i = 0; i < 17; i++) {
    const a = Math.PI * (1.04 + (i / 16) * 0.92);          // arc au-dessus de la tête
    const cx = 60 + Math.cos(a) * 29.5, cy = 46 + Math.sin(a) * 31;
    curls.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${i % 2 ? 7.4 : 6.6}"/>`);
  }
  const curls2 = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * (1.1 + (i / 11) * 0.8);
    curls2.push(`<circle cx="${r1(60 + Math.cos(a) * 21)}" cy="${r1(46 + Math.sin(a) * 24)}" r="7.6"/>`);
  }
  return {
    defs: b.defs + lin(`${id}-hr`, '#3A2A24', '#120A07', 0.2, 0, 0.8, 1),
    svg: `${b.torso}
    <path d="M43 98 C49 111 71 111 77 98 L72 97 C68 103 52 103 48 97Z" fill="#fff"/>
    <path d="M45.5 98 C50 108 70 108 74.5 98" fill="none" stroke="#E7E1D2" stroke-width="1.2"/>
    ${b.neck}
    ${b.head}
    <path d="M35.5 53 C35.5 68 46 77.5 60 77.5 C74 77.5 84.5 68 84.5 53 C80.5 63.5 72 68.5 60 68.5 C48 68.5 39.5 63.5 35.5 53Z" fill="#150C08" opacity=".42"/>
    <g fill="url(#${id}-hr)">${curls.join('')}</g>
    <g fill="url(#${id}-hr)">${curls2.join('')}</g>
    <path d="M34 42 C34 32 40 27 48 25 C42 30 40 36 40 44Z" fill="url(#${id}-hr)"/>
    <path d="M86 42 C86 32 80 27 72 25 C78 30 80 36 80 44Z" fill="url(#${id}-hr)"/>
    <g fill="#fff" opacity=".16"><ellipse cx="46" cy="22" rx="8" ry="3.6" transform="rotate(-30 46 22)"/><ellipse cx="68" cy="16" rx="7" ry="3" transform="rotate(-8 68 16)"/></g>
    ${b.face}`,
  };
}

/* ---------- Awa : foulard noué orange et jaune, robe menthe à motifs ---------- */
export function awa(id = 'aw') {
  const s = SKIN.awa;
  const b = base(id, s, { top: ['#7FE0CF', '#25AE9D'], brow: '#1D110B' });
  const dots = [[40, 26], [50, 19], [62, 15], [74, 17], [84, 25], [46, 33], [58, 28], [71, 28], [80, 35]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#fff" opacity=".85"/>`).join('');
  return {
    defs: b.defs + lin(`${id}-wr`, '#FFB347', '#F0731F', 0.1, 0, 0.9, 1) + lin(`${id}-wy`, '#FFE08A', '#F6B52E', 0.1, 0, 0.9, 1),
    svg: `${b.torso}
    <path d="M20 128 l6 -10 l6 10 z M38 134 l6 -10 l6 10 z M70 134 l6 -10 l6 10 z M88 128 l6 -10 l6 10 z M54 144 l6 -9 l6 9z" fill="#fff" opacity=".42"/>
    <path d="M42 98 C48 110 72 110 78 98 L72 96.5 C68 103 52 103 48 96.5Z" fill="#128C7C" opacity=".85"/>
    ${b.neck}
    ${b.head}
    <circle cx="29.5" cy="60" r="3.2" fill="#FFD166"/><circle cx="29.5" cy="60" r="1.2" fill="#fff" opacity=".7"/>
    <circle cx="90.5" cy="60" r="3.2" fill="#FFD166"/><circle cx="90.5" cy="60" r="1.2" fill="#fff" opacity=".7"/>
    <path d="M30 44 C24 18 46 3 66 5 C90 7 98 26 90 46 C80 34 70 31 60 32 C50 31 40 34 30 44Z" fill="url(#${id}-wr)"/>
    <path d="M32 40 C40 30 52 26 66 28" fill="none" stroke="#FFD28A" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M36 28 C46 16 62 12 80 18" fill="none" stroke="#C85A12" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    <path d="M64 7 C70 -8 92 -9 99 1 C106 11 98 25 86 21 C80 16 74 15 64 7Z" fill="url(#${id}-wy)"/>
    <path d="M70 6 C78 -2 90 -2 95 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".45"/>
    <path d="M72 12 C80 8 90 12 92 18" fill="none" stroke="#D98B15" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    ${dots}
    ${b.face}`,
  };
}

/* ---------- Salim : kuma blanche brodée, barbe soignée, dishdasha blanche ---------- */
export function salim(id = 'sa') {
  const s = SKIN.salim;
  const b = base(id, s, { top: ['#FFFFFF', '#DCEAE7'], brow: '#20140E', shade: 0.1 });
  return {
    defs: b.defs + lin(`${id}-km`, '#FFFFFF', '#DCE8E6', 0.2, 0, 0.8, 1) + lin(`${id}-hr`, '#3B2A22', '#171009', 0.2, 0, 0.8, 1),
    svg: `${b.torso}
    <path d="M44 98 C50 107 70 107 76 98 L74 118 C70 122 50 122 46 118Z" fill="#E4EEEC"/>
    <path d="M60 107 L60 130" stroke="#0B7F75" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><circle cx="60" cy="132.5" r="3" fill="#0B7F75"/><circle cx="59" cy="131.4" r="1" fill="#fff" opacity=".6"/>
    ${b.neck}
    ${b.head}
    <path d="M33 50 C33 40 37 34 41 32 L41 46 C39 48 36 50 33 50Z" fill="url(#${id}-hr)"/><path d="M87 50 C87 40 83 34 79 32 L79 46 C81 48 84 50 87 50Z" fill="url(#${id}-hr)"/>
    <path d="M35 54 C35 77 46 86 60 86 C74 86 85 77 85 54 C81 66 74 69 60 69 C46 69 39 66 35 54Z" fill="url(#${id}-hr)"/>
    <path d="M50 66.5 C54 63.5 66 63.5 70 66.5 C66 65 54 65 50 66.5Z" fill="url(#${id}-hr)"/>
    <path d="M31 40 C31 20 44 9 60 9 C76 9 89 20 89 40 C80 34 70 32 60 32 C50 32 40 34 31 40Z" fill="url(#${id}-km)"/>
    <path d="M31 40 C40 34 50 32 60 32 C70 32 80 34 89 40 L89.5 36 C80 30 70 28 60 28 C50 28 40 30 30.5 36Z" fill="#0B7F75" opacity=".92"/>
    <g fill="#fff" opacity=".9"><circle cx="42" cy="32.6" r="1.1"/><circle cx="50" cy="30.8" r="1.1"/><circle cx="60" cy="30.2" r="1.1"/><circle cx="70" cy="30.8" r="1.1"/><circle cx="78" cy="32.6" r="1.1"/></g>
    <g fill="none" stroke="#0B7F75" stroke-width="1.3" stroke-linecap="round" opacity=".75"><path d="M44 20 Q60 12 76 20"/><path d="M48 25 Q60 19 72 25"/></g>
    <ellipse cx="48" cy="17" rx="11" ry="4" fill="#fff" opacity=".6" transform="rotate(-24 48 17)"/>
    ${b.face}`,
  };
}

export const people = { amina, moussa, awa, salim };

/* petits éléments communs des scènes */
export const COMMON_DEFS = `
<filter id="blur2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="blur3" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="drop" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="2.6" flood-color="#032B27" flood-opacity=".3"/></filter>
${lin('g-coin', '#FFE9A3', '#F2A91D', 0.15, 0.05, 0.85, 1)}
${lin('g-coin2', '#FFD566', '#D98A0B', 0.1, 0, 0.9, 1)}
${lin('g-teal', '#2FD0BB', '#0B7F75')}
${lin('g-deep', '#0F8F83', '#065A52')}
${lin('g-white', '#FFFFFF', '#DCEFEC')}
${lin('g-phone', '#2B4A47', '#0C1F1D')}
${lin('g-screen', '#EFFFFC', '#BDEFE6')}
${lin('g-screen-d', '#12A594', '#075F57')}
${lin('g-shield', '#43E0C9', '#0B7F75', 0.2, 0, 0.8, 1)}
${lin('g-card', '#12B8A5', '#06504A', 0.1, 0, 0.9, 1)}
${lin('g-gold', '#FFE9A3', '#E8A317')}
`;
