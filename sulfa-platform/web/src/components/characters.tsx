'use client';
/* Illustrated characters (vector, hand-built): Aisha (client, shayla + abaya), Salim (client, dishdasha + kuma),
   Maryam (administrator, hijab + blazer + badge). They are ILLUSTRATIONS, not real people.
   Animated parts: blink, breathing, held object, gesture — all disabled by prefers-reduced-motion (globals.css). */
import { useId, type ReactNode } from 'react';
import { cx } from './ui';

export type Mood = 'neutral' | 'happy' | 'focused';
export type Prop = 'phone' | 'id' | 'magnifier' | 'stamp' | 'laptop' | 'coins' | 'none';

const SKIN = { aisha: ['#c58c69', '#a8714f', '#e3ad8c'], salim: ['#b47a55', '#94603f', '#d39a74'], maryam: ['#d29a76', '#b07a58', '#ebbb9a'] } as const;

function Face({ skin, mood, g, glasses, beard }: { skin: readonly string[]; mood: Mood; g: string; glasses?: boolean; beard?: boolean }) {
  return (
    <g>
      <ellipse cx="100" cy="74" rx="25" ry="30" fill={`url(#${g}-skin)`} />
      <path d="M77 82 Q80 100 100 104 Q120 100 123 82 Q118 98 100 100 Q82 98 77 82Z" fill={skin[1]} opacity=".35" />
      <ellipse cx="86" cy="86" rx="5" ry="3" fill="#e27d74" opacity=".28" /><ellipse cx="114" cy="86" rx="5" ry="3" fill="#e27d74" opacity=".28" />
      <g className="char-blink">
        <ellipse cx="90" cy="74" rx="4.2" ry={mood === 'happy' ? 2.6 : 3.4} fill="#fff" />
        <ellipse cx="110" cy="74" rx="4.2" ry={mood === 'happy' ? 2.6 : 3.4} fill="#fff" />
        <circle className="char-eye" cx="90.6" cy="74.4" r="2.4" fill="#2b1a12" /><circle className="char-eye" cx="110.6" cy="74.4" r="2.4" fill="#2b1a12" />
        <circle cx="91.4" cy="73.4" r=".8" fill="#fff" /><circle cx="111.4" cy="73.4" r=".8" fill="#fff" />
        <path d="M85 71 Q90 68.6 95 71" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d="M105 71 Q110 68.6 115 71" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
      <path d={mood === 'focused' ? 'M84 65 Q90 62 96 64.5' : 'M84 64.5 Q90 61 96 63.5'} stroke="#2b1a12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={mood === 'focused' ? 'M104 64.5 Q110 62 116 65' : 'M104 63.5 Q110 61 116 64.5'} stroke="#2b1a12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M100 76 Q98 84 96.5 86 Q100 88 103 86" stroke={skin[1]} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {beard && <path d="M78 82 Q79 104 100 109 Q121 104 122 82 Q119 96 110 99 Q100 95 90 99 Q81 96 78 82Z" fill="#2a1d16" opacity=".88" />}
      {beard && <path d="M91 92 Q100 89 109 92 Q100 94.5 91 92Z" fill="#2a1d16" />}
      {mood === 'happy'
        ? <path d="M91 92 Q100 100 109 92 Q100 96 91 92Z" fill="#8c2f2a" stroke="#6e2420" strokeWidth=".8" />
        : mood === 'focused'
          ? <path d="M94 93.5 Q100 95 106 93.5" stroke="#8c3b33" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          : <path d="M92.5 92.5 Q100 97 107.5 92.5" stroke="#8c3b33" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {glasses && <g fill="none" stroke="#3a2f2a" strokeWidth="1.4"><rect x="82" y="68" width="15" height="12" rx="5" /><rect x="103" y="68" width="15" height="12" rx="5" /><path d="M97 73 Q100 71.5 103 73" /></g>}
    </g>
  );
}

function Held({ prop }: { prop: Prop }) {
  switch (prop) {
    case 'phone': return (
      <g className="char-held">
        <rect x="112" y="140" width="24" height="42" rx="5" fill="#111" /><rect x="114" y="143" width="20" height="36" rx="3.4" fill="#e9f7f0" />
        <rect x="117" y="148" width="14" height="6" rx="2" fill="#087f5b" /><rect x="117" y="157" width="10" height="2.4" rx="1.2" fill="#9fb8ae" /><rect x="117" y="161" width="13" height="2.4" rx="1.2" fill="#9fb8ae" />
        <rect x="117" y="168" width="14" height="6" rx="2" fill="#d6b36a" className="char-glow" />
      </g>);
    case 'id': return (
      <g className="char-held">
        <rect x="108" y="146" width="40" height="27" rx="4" fill="#f7f1e2" stroke="#c49a45" strokeWidth="1.2" />
        <rect x="112" y="151" width="11" height="14" rx="2" fill="#c9d9d2" /><circle cx="117.5" cy="156" r="3" fill="#8aa79b" /><path d="M112.5 165 Q117.5 159 122.5 165Z" fill="#8aa79b" />
        <rect x="126" y="152" width="18" height="2.4" rx="1.2" fill="#9db3aa" /><rect x="126" y="157" width="14" height="2.4" rx="1.2" fill="#9db3aa" /><rect x="126" y="162" width="16" height="2.4" rx="1.2" fill="#9db3aa" />
        <rect x="112" y="168" width="32" height="2" rx="1" fill="#d6b36a" />
      </g>);
    case 'magnifier': return (
      <g className="char-held char-scan">
        <circle cx="132" cy="146" r="13" fill="#dff5eb" fillOpacity=".55" stroke="#3a2f2a" strokeWidth="3" /><path d="M141 156 L152 170" stroke="#5a3b22" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M125 141 Q129 137 134 138" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>);
    case 'stamp': return (
      <g className="char-held char-stamp">
        <rect x="120" y="128" width="12" height="18" rx="5" fill="#6b3f22" /><rect x="114" y="146" width="24" height="9" rx="2.5" fill="#3a2f2a" /><rect x="113" y="155" width="26" height="4" rx="1.5" fill="#087f5b" />
      </g>);
    case 'laptop': return (
      <g>
        <path d="M58 196 L142 196 L152 210 L48 210Z" fill="#c9d2cf" /><rect x="64" y="150" width="72" height="46" rx="4" fill="#2b3633" />
        <rect x="68" y="154" width="64" height="38" rx="2" fill="#0d3b31" /><rect x="72" y="158" width="26" height="5" rx="1.5" fill="#3fb68a" className="char-glow" />
        <rect x="72" y="167" width="56" height="2.5" rx="1" fill="#5d8b7d" /><rect x="72" y="172" width="44" height="2.5" rx="1" fill="#5d8b7d" /><rect x="72" y="177" width="50" height="2.5" rx="1" fill="#5d8b7d" />
        <rect x="104" y="158" width="24" height="5" rx="1.5" fill="#d6b36a" />
      </g>);
    case 'coins': return (
      <g className="char-held">
        {[0, 1, 2, 3].map(i => <ellipse key={i} cx="128" cy={176 - i * 5} rx="12" ry="4.2" fill={i % 2 ? '#e3c98a' : '#d6b36a'} stroke="#a27c2f" strokeWidth=".8" />)}
        <ellipse cx="128" cy="160" rx="12" ry="4.2" fill="#f0dca8" stroke="#a27c2f" strokeWidth=".8" />
      </g>);
    default: return null;
  }
}

/** a hand: palm, thumb and finger creases (rotate with `r`) */
function Hand({ x, y, r = 0, fill, line }: { x: number; y: number; r?: number; fill: string; line: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M-7 -6 Q-8 4 -4 8 Q2 10 7 6 Q9 -2 6 -7 Q0 -10 -7 -6Z" fill={fill} />
      <path d="M-7 -3 Q-12 -1 -11 3 Q-9 5 -6 3" fill={fill} stroke={line} strokeWidth=".6" />
      <path d="M-2 7.5 L-2.5 3 M1.5 8.5 L1 3.5 M5 6.5 L4.2 2" stroke={line} strokeWidth=".7" strokeLinecap="round" opacity=".7" />
    </g>
  );
}

/** one character; `prop` is what the hands hold */
export function Character({ who, mood = 'neutral', prop = 'none', className, title, wave }: { who: 'aisha' | 'salim' | 'maryam'; mood?: Mood; prop?: Prop; className?: string; title?: string; wave?: boolean }) {
  const g = useId().replace(/:/g, '');
  const skin = SKIN[who];
  const holds = prop !== 'none' && prop !== 'laptop';
  const outfit = who === 'aisha' ? ['#1f2725', '#2f3a37', '#121816'] : who === 'salim' ? ['#f6f5f0', '#dfe3df', '#c5ccc7'] : ['#0b6a50', '#0d7f60', '#074b39'];
  return (
    <svg viewBox="0 0 200 300" className={cx('char', className)} role="img" aria-label={title ?? ''}>
      <defs>
        <radialGradient id={`${g}-skin`} cx="45%" cy="38%" r="70%"><stop offset="0" stopColor={skin[2]} /><stop offset=".65" stopColor={skin[0]} /><stop offset="1" stopColor={skin[1]} /></radialGradient>
        <linearGradient id={`${g}-cloth`} x1="0" x2="1"><stop offset="0" stopColor={outfit[1]} /><stop offset=".55" stopColor={outfit[0]} /><stop offset="1" stopColor={outfit[2]} /></linearGradient>
        <linearGradient id={`${g}-scarf`} x1="0" y1="0" x2="1" y2="1">
          {who === 'aisha' ? <><stop offset="0" stopColor="#3b2f4a" /><stop offset="1" stopColor="#1f1828" /></> : <><stop offset="0" stopColor="#efdfb6" /><stop offset="1" stopColor="#c9ad73" /></>}
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="288" rx="58" ry="7" fill="#063b32" opacity=".16" />
      <g className="char-breathe">
        {/* body / garment */}
        {who === 'maryam' ? (
          <g>
            <path d="M58 132 Q100 112 142 132 L150 236 Q100 246 50 236Z" fill={`url(#${g}-cloth)`} />
            <path d="M88 122 L100 160 L112 122 Q100 128 88 122Z" fill="#f7f9f8" /><path d="M100 160 L92 128 M100 160 L108 128" stroke="#d9e2de" strokeWidth="1" />
            <path d="M70 136 L88 124 L96 170Z M130 136 L112 124 L104 170Z" fill="#095a44" opacity=".55" />
            <path d="M54 236 L146 236 L140 282 L60 282Z" fill="#2b3633" /><rect x="60" y="276" width="32" height="8" rx="4" fill="#1a201e" /><rect x="108" y="276" width="32" height="8" rx="4" fill="#1a201e" />
            <path d="M92 124 Q100 150 108 124" stroke="#d6b36a" strokeWidth="1.6" fill="none" /><rect x="104" y="150" width="14" height="19" rx="2.5" fill="#fff" stroke="#d6b36a" strokeWidth="1.2" />
            <rect x="106.5" y="153" width="9" height="2.4" rx="1.2" fill="#087f5b" /><rect x="106.5" y="158" width="9" height="1.6" rx=".8" fill="#9db3aa" /><rect x="106.5" y="161.5" width="6" height="1.6" rx=".8" fill="#9db3aa" />
          </g>
        ) : (
          <g>
            <path d="M60 130 Q100 112 140 130 L152 280 Q100 292 48 280Z" fill={`url(#${g}-cloth)`} />
            {[82, 100, 118].map((x, i) => <path key={x} d={`M${x} ${150 + i * 6} Q${x + (i - 1) * 4} 220 ${x + (i - 1) * 10} 278`} stroke={who === 'salim' ? '#c9d0cb' : '#3d4a46'} strokeWidth="1.3" fill="none" opacity=".8" />)}
            {who === 'salim' && <g><path d="M100 118 L100 172" stroke="#d3dad5" strokeWidth="1.4" /><path d="M100 120 Q97 142 99 162" stroke="#c49a45" strokeWidth="1.6" fill="none" /><circle cx="99" cy="164" r="3.2" fill="#c49a45" /><path d="M97 166 L95 184 M99 167 L99 186 M101 166 L103 184" stroke="#c49a45" strokeWidth="1" /></g>}
            {who === 'aisha' && <g><path d="M60 270 Q100 280 140 270" stroke="#c49a45" strokeWidth="2" fill="none" opacity=".9" /><path d="M64 263 Q100 273 136 263" stroke="#c49a45" strokeWidth=".8" fill="none" strokeDasharray="2 3" /></g>}
            <ellipse cx="80" cy="284" rx="14" ry="5" fill={who === 'salim' ? '#6b4a32' : '#151a19'} /><ellipse cx="120" cy="284" rx="14" ry="5" fill={who === 'salim' ? '#6b4a32' : '#151a19'} />
          </g>
        )}
        <path d="M66 132 Q100 118 134 132 Q100 126 66 136Z" fill="#fff" opacity=".12" />
        {/* neck */}
        <path d="M90 98 L90 116 Q100 122 110 116 L110 98Z" fill={skin[1]} />
        {/* arms */}
        <g className={wave ? 'char-wave' : undefined} style={{ transformOrigin: '64px 132px' }}>
          <path d="M64 130 Q48 160 52 202" stroke={`url(#${g}-cloth)`} strokeWidth="19" strokeLinecap="round" fill="none" />
          <Hand x={52} y={206} r={8} fill={`url(#${g}-skin)`} line={skin[1]} />
          {who === 'aisha' && <path d="M45 196 Q52 200 59 196" stroke="#c49a45" strokeWidth="1.6" fill="none" />}
        </g>
        <g>
          <path d={holds ? 'M136 130 Q150 156 128 168' : prop === 'laptop' ? 'M136 130 Q148 160 126 196' : 'M136 130 Q152 160 148 202'} stroke={`url(#${g}-cloth)`} strokeWidth="19" strokeLinecap="round" fill="none" />
          {who === 'salim' && holds && <rect x="118" y="160" width="9" height="6" rx="2" fill="#2b3633" transform="rotate(-25 122 163)" />}
        </g>
        <Held prop={prop} />
        {holds && <Hand x={126} y={170} r={-30} fill={`url(#${g}-skin)`} line={skin[1]} />}
        {prop === 'laptop' && <Hand x={124} y={197} r={-80} fill={`url(#${g}-skin)`} line={skin[1]} />}
        {/* head + headwear */}
        <g className="char-head">
          {who === 'aisha' && <path d="M66 70 Q66 30 100 28 Q134 30 134 70 L136 104 Q130 124 146 142 Q118 132 100 116 Q82 132 54 142 Q70 124 64 104Z" fill={`url(#${g}-scarf)`} />}
          {who === 'maryam' && <path d="M68 70 Q68 32 100 30 Q132 32 132 70 L134 102 Q126 120 140 132 Q116 126 100 114 Q84 126 60 132 Q74 120 66 102Z" fill={`url(#${g}-scarf)`} />}
          <Face skin={skin} mood={mood} g={g} glasses={who === 'maryam'} beard={who === 'salim'} />
          {who === 'aisha' && <path d="M74 56 Q100 34 126 56 Q118 46 100 45 Q82 46 74 56Z" fill="#2a2236" />}
          {who === 'maryam' && <path d="M75 56 Q100 36 125 56 Q116 47 100 46 Q84 47 75 56Z" fill="#d8c08a" />}
          {who === 'salim' && <g>
            <path d="M76 58 Q76 34 100 33 Q124 34 124 58 Q100 52 76 58Z" fill="#fbfaf4" stroke="#d9d6c8" strokeWidth="1" />
            <path d="M78 54 Q100 48 122 54" stroke="#087f5b" strokeWidth="2.2" fill="none" /><path d="M80 48 Q100 42 120 48" stroke="#c49a45" strokeWidth="1.6" fill="none" strokeDasharray="3 2" />
            <path d="M85 42 Q100 37 115 42" stroke="#087f5b" strokeWidth="1.4" fill="none" strokeDasharray="2 2" /><circle cx="100" cy="36.5" r="2" fill="#c49a45" />
            <path d="M75 62 Q76 70 78 74 M125 62 Q124 70 122 74" stroke="#2a1d16" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="75" cy="76" rx="3.5" ry="6" fill={skin[1]} /><ellipse cx="125" cy="76" rx="3.5" ry="6" fill={skin[1]} />
          </g>}
        </g>
      </g>
    </svg>
  );
}

/** a character with a speech bubble that pops in */
export function Speaking({ children, bubble, side = 'end', className }: { children: ReactNode; bubble: ReactNode; side?: 'start' | 'end'; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      {children}
      <div className={cx('char-bubble absolute top-2 max-w-[190px] rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-snug text-emerald-950 shadow-lift', side === 'end' ? 'end-0 translate-x-1/3 rtl:-translate-x-1/3' : 'start-0 -translate-x-1/3 rtl:translate-x-1/3')}>
        {bubble}
      </div>
    </div>
  );
}
