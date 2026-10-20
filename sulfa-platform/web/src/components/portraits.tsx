'use client';
/* Refined bust portraits (vector): realistic proportions, soft studio lighting, no outlines.
   Illustrations of ROLES (client, client, administrator) — not real people. */
import { useId } from 'react';
import { cx } from './ui';

type Who = 'aisha' | 'salim' | 'maryam';

const P: Record<Who, { skin: [string, string, string]; bg: [string, string]; cloth: [string, string]; scarf?: [string, string]; lip: string; iris: string }> = {
  aisha: { skin: ['#e2b597', '#c48d6c', '#9c6a4d'], bg: ['#e9f6f0', '#bfe3d3'], cloth: ['#24302d', '#111816'], scarf: ['#4a3d5c', '#241c30'], lip: '#a5524a', iris: '#4a2e1c' },
  salim: { skin: ['#d3a17d', '#ad7955', '#82563a'], bg: ['#fbf3df', '#ecd6a4'], cloth: ['#fbfbf8', '#d9ded9'], lip: '#8e4d3e', iris: '#3a2416' },
  maryam: { skin: ['#ecc4a6', '#d39f7e', '#ab7656'], bg: ['#e4f2ec', '#a9d6c2'], cloth: ['#0c7a5b', '#064734'], scarf: ['#efe2c2', '#c8ad78'], lip: '#b45a52', iris: '#5a3a22' },
};

export function Portrait({ who, className, title, smile = true, ring }: { who: Who; className?: string; title?: string; smile?: boolean; ring?: boolean }) {
  const g = useId().replace(/:/g, '');
  const c = P[who];
  const woman = who !== 'salim';
  return (
    <svg viewBox="0 0 200 200" className={cx('portrait', className)} role="img" aria-label={title ?? ''}>
      <defs>
        <radialGradient id={`${g}b`} cx="50%" cy="35%" r="75%"><stop offset="0" stopColor={c.bg[0]} /><stop offset="1" stopColor={c.bg[1]} /></radialGradient>
        <radialGradient id={`${g}s`} cx="42%" cy="36%" r="72%"><stop offset="0" stopColor={c.skin[0]} /><stop offset=".62" stopColor={c.skin[1]} /><stop offset="1" stopColor={c.skin[2]} /></radialGradient>
        <linearGradient id={`${g}n`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.skin[2]} /><stop offset="1" stopColor={c.skin[1]} /></linearGradient>
        <linearGradient id={`${g}c`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.cloth[0]} /><stop offset="1" stopColor={c.cloth[1]} /></linearGradient>
        {c.scarf && <linearGradient id={`${g}h`} x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stopColor={c.scarf[0]} /><stop offset="1" stopColor={c.scarf[1]} /></linearGradient>}
        <radialGradient id={`${g}l`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <clipPath id={`${g}k`}><circle cx="100" cy="100" r="100" /></clipPath>
      </defs>
      <g clipPath={`url(#${g}k)`}>
        <rect width="200" height="200" fill={`url(#${g}b)`} />
        <circle cx="62" cy="48" r="70" fill={`url(#${g}l)`} />
        {/* shoulders */}
        <path d="M18 200 Q24 150 66 138 Q100 130 134 138 Q176 150 182 200Z" fill={`url(#${g}c)`} />
        {who === 'salim' && <g><path d="M100 140 L100 200" stroke="#d6dcd7" strokeWidth="1.2" /><path d="M98 142 Q95 162 97 178" stroke="#c49a45" strokeWidth="1.8" fill="none" /><ellipse cx="97" cy="181" rx="3" ry="4" fill="#c49a45" /><path d="M60 150 Q80 160 92 150 M140 150 Q120 160 108 150" stroke="#e3e7e3" strokeWidth="2" fill="none" /></g>}
        {who === 'maryam' && <g><path d="M84 138 L100 176 L116 138 Q100 146 84 138Z" fill="#f8faf9" /><path d="M66 146 L86 138 L98 186Z M134 146 L114 138 L102 186Z" fill="#053d2d" opacity=".5" /><path d="M90 140 Q100 166 110 140" stroke="#d6b36a" strokeWidth="1.2" fill="none" /><rect x="118" y="160" width="20" height="26" rx="3" fill="#fff" /><rect x="121" y="164" width="14" height="3" rx="1.5" fill="#087f5b" /><rect x="121" y="170" width="14" height="2" rx="1" fill="#a9b9b2" /><rect x="121" y="174" width="9" height="2" rx="1" fill="#a9b9b2" /></g>}
        {/* scarf back layer */}
        {woman && <path d="M52 92 Q50 34 100 30 Q150 34 148 92 Q150 128 166 156 Q130 150 100 140 Q70 150 34 156 Q50 128 52 92Z" fill={`url(#${g}h)`} />}
        {/* neck */}
        <path d="M86 112 Q86 134 84 140 Q100 150 116 140 Q114 134 114 112Z" fill={`url(#${g}n)`} />
        {/* scarf wrap under the chin, covering the neck (shayla / hijab) */}
        {woman && <path d="M64 96 Q72 126 100 133 Q128 126 136 96 L146 150 Q100 166 54 150Z" fill={`url(#${g}h)`} />}
        {woman && <g fill="none" stroke="#000" opacity=".14" strokeWidth="1.4"><path d="M70 132 Q100 150 130 132" /><path d="M62 146 Q100 160 138 146" /><path d="M58 112 Q60 132 72 144" /><path d="M142 112 Q140 132 128 144" /></g>}
        {/* ears (man) */}
        {!woman && <g><ellipse cx="66" cy="92" rx="5.5" ry="9" fill={c.skin[1]} /><ellipse cx="134" cy="92" rx="5.5" ry="9" fill={c.skin[1]} /></g>}
        {/* face */}
        <path d="M68 84 Q68 46 100 44 Q132 46 132 84 Q132 112 116 124 Q106 131 100 131 Q94 131 84 124 Q68 112 68 84Z" fill={`url(#${g}s)`} />
        <path d="M70 96 Q74 118 90 127 Q100 132 110 127 Q126 118 130 96 Q124 116 100 120 Q76 116 70 96Z" fill={c.skin[2]} opacity=".22" />
        <ellipse cx="84" cy="100" rx="8" ry="4.5" fill="#e07a6e" opacity=".16" /><ellipse cx="116" cy="100" rx="8" ry="4.5" fill="#e07a6e" opacity=".16" />
        {/* eyes */}
        <g className="char-blink">
          {[86, 114].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 8} 86 Q${x} 80 ${x + 8} 86 Q${x} 90 ${x - 8} 86Z`} fill="#fbf7f2" />
              <circle cx={x + (i ? -0.6 : 0.6)} cy="85.6" r="3.6" fill={c.iris} /><circle cx={x + (i ? -0.6 : 0.6)} cy="85.6" r="1.7" fill="#140b06" />
              <circle cx={x + 1.4} cy="84.2" r="1" fill="#fff" />
              <path d={`M${x - 8.6} 86 Q${x} 79 ${x + 8.6} 86`} stroke="#2a1a10" strokeWidth={woman ? 1.6 : 1.2} fill="none" strokeLinecap="round" />
              {woman && <path d={`M${x + (i ? -8.4 : 8.4)} 85.6 l${i ? -2.4 : 2.4} -1.6`} stroke="#2a1a10" strokeWidth="1.1" strokeLinecap="round" />}
              <path d={`M${x - 6} 89.4 Q${x} 91.6 ${x + 6} 89.4`} stroke={c.skin[2]} strokeWidth=".7" fill="none" opacity=".6" />
            </g>))}
        </g>
        <path d="M76 76 Q86 71.5 95 74.5" stroke={woman ? '#3a2416' : '#24160d'} strokeWidth={woman ? 2 : 2.8} fill="none" strokeLinecap="round" />
        <path d="M105 74.5 Q114 71.5 124 76" stroke={woman ? '#3a2416' : '#24160d'} strokeWidth={woman ? 2 : 2.8} fill="none" strokeLinecap="round" />
        {/* nose */}
        <path d="M98 88 Q97 99 94.5 104 Q97 107 100 106.5 Q103 107 105.5 104" stroke={c.skin[2]} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".75" />
        <ellipse cx="100" cy="99" rx="2.2" ry="6" fill="#fff" opacity=".18" />
        {/* beard (man) */}
        {!woman && <g><path d="M70 100 Q72 126 92 133 Q100 136 108 133 Q128 126 130 100 Q126 116 116 119 Q108 115 100 116 Q92 115 84 119 Q74 116 70 100Z" fill="#1e140e" /><path d="M89 112 Q100 107 111 112 Q100 110.5 89 112Z" fill="#1e140e" /></g>}
        {/* mouth */}
        {smile
          ? <g><path d="M90 113 Q100 121 110 113 Q100 116.5 90 113Z" fill={c.lip} /><path d="M91 113 Q100 115 109 113" stroke="#fff" strokeWidth=".9" opacity=".6" fill="none" /><path d="M90 113 Q100 110.5 110 113" stroke={c.lip} strokeWidth="1.4" fill="none" strokeLinecap="round" /></g>
          : <path d="M91 114 Q100 116.5 109 114" stroke={c.lip} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        {/* headwear front */}
        {woman && <path d="M66 82 Q64 40 100 38 Q136 40 134 82 Q132 64 118 56 Q100 50 82 56 Q68 64 66 82Z" fill={`url(#${g}h)`} />}
        {woman && <path d="M66 82 Q70 112 84 126 Q70 122 62 104Z M134 82 Q130 112 116 126 Q130 122 138 104Z" fill={`url(#${g}h)`} opacity=".95" />}
        {woman && <path d="M74 50 Q100 38 126 50" stroke="#fff" strokeWidth="1.4" opacity=".22" fill="none" />}
        {woman && <g fill="none" stroke="#000" opacity=".12" strokeWidth="1.2"><path d="M60 70 Q56 100 64 124" /><path d="M140 70 Q144 100 136 124" /><path d="M80 40 Q66 50 62 70" /></g>}
        {woman && <path d="M67 84 Q72 108 86 124" stroke="#000" opacity=".12" strokeWidth="2" fill="none" />}
        {woman && <path d="M133 84 Q128 108 114 124" stroke="#000" opacity=".12" strokeWidth="2" fill="none" />}
        {who === 'maryam' && <g fill="none" stroke="#5a463a" strokeWidth="1.5"><rect x="76" y="79" width="20" height="14" rx="6" /><rect x="104" y="79" width="20" height="14" rx="6" /><path d="M96 85 Q100 83 104 85" /></g>}
        {!woman && <g>
          <path d="M66 72 Q64 40 100 38 Q136 40 134 72 Q100 62 66 72Z" fill="#fdfcf6" />
          <path d="M67 68 Q100 58 133 68" stroke="#087f5b" strokeWidth="2.6" fill="none" /><path d="M70 60 Q100 51 130 60" stroke="#c49a45" strokeWidth="1.6" fill="none" strokeDasharray="3 2.4" />
          <path d="M76 52 Q100 45 124 52" stroke="#087f5b" strokeWidth="1.5" fill="none" strokeDasharray="2.4 2.4" /><path d="M84 45 Q100 41 116 45" stroke="#c49a45" strokeWidth="1.2" fill="none" />
          <path d="M66 72 Q100 64 134 72 L134 75 Q100 67 66 75Z" fill="#000" opacity=".08" />
          <path d="M67 76 Q68 86 70 92 M133 76 Q132 86 130 92" stroke="#1e140e" strokeWidth="3.4" strokeLinecap="round" />
        </g>}
      </g>
      {ring && <circle cx="100" cy="100" r="97" fill="none" stroke="#fff" strokeWidth="6" />}
    </svg>
  );
}
