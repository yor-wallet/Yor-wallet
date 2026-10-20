'use client';
/* Data visualisation for SULFA. Palette (validated with the dataviz validator, light + dark): series-1 emerald =
   principal / paid, series-2 blue = financing cost, series-3 gold = fees / remaining. Every chart: hover tooltip,
   legend (>= 2 series), a table view, text in ink tokens (never in series colour), one y-axis only. */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { cx, Num } from './ui';

const S = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

function Legend({ items }: { items: { color: string; label: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-soft dark:text-emerald-50/80">
      {items.map(i => <li key={i.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}{i.value != null && <b className="text-ink dark:text-white">{i.value}</b>}</li>)}
    </ul>
  );
}

function TableView({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-bold text-emerald-700 dark:text-emerald-300">{label}</summary>
      <div className="mt-2 max-h-56 overflow-auto"><table className="w-full"><thead><tr>{head.map(h => <th key={h} className="py-1 text-start font-bold text-ink-muted">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line dark:border-white/10">{r.map((c, j) => <td key={j} className="py-1">{c}</td>)}</tr>)}</tbody></table></div>
    </details>
  );
}

/** 100 % stacked bar: what the total to repay is made of */
export function CostBreakdown({ principal, interest, fee }: { principal: number; interest: number; fee: number }) {
  const { t, money } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const total = principal + interest + fee || 1;
  const parts = [{ k: 'sim.principal', v: principal }, { k: 'sim.interest', v: interest }, { k: 'sim.fee', v: fee }];
  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  return (
    <div>
      <div className="relative flex h-4 w-full gap-[2px] overflow-visible" dir="ltr" role="img" aria-label={parts.map(p => `${t(p.k)} ${pct(p.v)} %`).join(', ')}>
        {parts.map((p, i) => p.v > 0 && (
          <div key={p.k} className="chart-grow-x relative h-full first:rounded-s-[4px] last:rounded-e-[4px] transition-[filter]" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            style={{ flexBasis: `${(p.v / total) * 100}%`, background: S[i], minWidth: 3, filter: hover != null && hover !== i ? 'saturate(.35) opacity(.6)' : undefined, animationDelay: `${i * 120}ms` }}>
            {hover === i && <span className="absolute bottom-6 start-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-emerald-950 px-2 py-1 text-[11px] font-bold text-white shadow-lift">{t(p.k)} · <Num>{money(p.v)}</Num> · {pct(p.v)} %</span>}
          </div>))}
      </div>
      <div className="mt-3"><Legend items={parts.map((p, i) => ({ color: S[i], label: t(p.k), value: <>{pct(p.v)} %</> }))} /></div>
    </div>
  );
}

/** remaining balance after each instalment, with crosshair + tooltip */
export function BalanceChart({ points, title }: { points: { label: string; value: number; sub?: string }[]; title: string }) {
  const { t, money } = useI18n();
  const box = useRef<SVGSVGElement>(null);
  const [i, setI] = useState<number | null>(null);
  const W = 560, H = 210, L = 64, R = 14, T = 14, B = 30;
  const max = Math.max(...points.map(p => p.value), 1);
  const x = (k: number) => L + (k / Math.max(points.length - 1, 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = points.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)} ${H - B} L${x(0)} ${H - B}Z`;
  const ticks = [0, 0.5, 1].map(f => f * max);
  const pick = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    setI(Math.max(0, Math.min(points.length - 1, Math.round(((px - L) / (W - L - R)) * (points.length - 1)))));
  };
  const cur = i != null ? points[i] : null;
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-bold text-ink dark:text-white">{title}</figcaption>
      <div className="relative" dir="ltr">
        <svg ref={box} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={title} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setI(null)}>
          <defs><linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--series-1)" stopOpacity=".28" /><stop offset="1" stopColor="var(--series-1)" stopOpacity="0" /></linearGradient></defs>
          {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--axis-ink)">{money(v, false)}</text></g>)}
          <path d={area} fill="url(#bal-fill)" />
          <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" className="chart-line" style={{ ['--len' as string]: 1400 }} />
          {points.map((p, k) => <circle key={k} cx={x(k)} cy={y(p.value)} r={k === i ? 6 : 4} fill="var(--series-1)" stroke="var(--paper)" strokeWidth="2" />)}
          {points.map((p, k) => (points.length <= 10 || k % 2 === 0) && <text key={'l' + k} x={x(k)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--axis-ink)">{p.label}</text>)}
          {cur && <line x1={x(i!)} x2={x(i!)} y1={T} y2={H - B} stroke="var(--axis-ink)" strokeDasharray="3 3" />}
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
        </svg>
        {cur && <div className="pointer-events-none absolute top-0 z-10 rounded-xl bg-emerald-950 px-3 py-2 text-xs text-white shadow-lift" style={{ left: `${(x(i!) / W) * 100}%`, transform: `translateX(${i! > points.length / 2 ? '-105%' : '5%'})` }}>
          <b className="block">{cur.sub ?? cur.label}</b><span className="text-emerald-100/80">{t('viz.remaining')}</span> <Num>{money(cur.value)}</Num>
        </div>}
      </div>
      <TableView label={t('viz.table')} head={['#', t('viz.remaining')]} rows={points.map(p => [p.sub ?? p.label, <Num key="v">{money(p.value)}</Num>])} />
    </figure>
  );
}

/** one bar per instalment: paid part + remaining part (real installment rows) */
export function ScheduleBars({ items, title }: { items: { seq: number; due: number; paid: number; date: string }[]; title: string }) {
  const { t, money, date } = useI18n();
  const [h, setH] = useState<number | null>(null);
  const W = 560, H = 190, L = 12, R = 12, T = 12, B = 28;
  const max = Math.max(...items.map(i => i.due), 1);
  const bw = Math.min(46, (W - L - R) / items.length - 8);
  const step = (W - L - R) / items.length;
  const yy = (v: number) => (v / max) * (H - T - B);
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-ink dark:text-white">{title}
        <Legend items={[{ color: S[0], label: t('inst.paid') }, { color: S[2], label: t('inst.left') }]} /></figcaption>
      <div className="relative" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--grid)" />
          {items.map((it, k) => {
            const cx = L + step * k + (step - bw) / 2; const paidH = yy(it.paid); const leftH = Math.max(0, yy(it.due - it.paid) - (it.paid > 0 ? 2 : 0));
            return (
              <g key={it.seq} onPointerEnter={() => setH(k)} onPointerLeave={() => setH(null)} style={{ opacity: h != null && h !== k ? 0.5 : 1 }}>
                <rect x={cx - 4} y={T} width={bw + 8} height={H - T - B} fill="transparent" />
                {it.paid > 0 && <rect className="chart-grow" style={{ animationDelay: `${k * 60}ms` }} x={cx} y={H - B - paidH} width={bw} height={paidH} rx={it.paid >= it.due ? 4 : 0} fill={S[0]} />}
                {leftH > 0 && <rect className="chart-grow" style={{ animationDelay: `${k * 60}ms` }} x={cx} y={T + (H - T - B) - yy(it.due)} width={bw} height={leftH} rx="4" fill={S[2]} />}
                <text x={cx + bw / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--axis-ink)">{it.seq}</text>
              </g>);
          })}
        </svg>
        {h != null && <div className="pointer-events-none absolute top-0 z-10 rounded-xl bg-emerald-950 px-3 py-2 text-xs text-white shadow-lift" style={{ left: `${((L + step * h + step / 2) / W) * 100}%`, transform: `translateX(${h > items.length / 2 ? '-105%' : '5%'})` }}>
          <b className="block"># {items[h].seq} · {date(items[h].date)}</b>{t('inst.paid')} <Num>{money(items[h].paid)}</Num><br />{t('inst.left')} <Num>{money(items[h].due - items[h].paid)}</Num>
        </div>}
      </div>
      <TableView label={t('viz.table')} head={['#', t('inst.due_date'), t('inst.paid'), t('inst.left')]} rows={items.map(i => [i.seq, date(i.date), <Num key="p">{money(i.paid)}</Num>, <Num key="l">{money(i.due - i.paid)}</Num>])} />
    </figure>
  );
}

/** progress ring (single measure: share repaid) */
export function Ring({ value, max, label, sub }: { value: number; max: number; label: string; sub?: ReactNode }) {
  const p = max > 0 ? Math.min(1, value / max) : 0;
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 130 130" className="h-32 w-32 shrink-0" role="img" aria-label={`${label} ${Math.round(p * 100)} %`}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--grid)" strokeWidth="12" />
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--series-1)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - p)} transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
        <text x="65" y="70" textAnchor="middle" fontSize="24" fontWeight="800" fill="currentColor">{Math.round(p * 100)}%</text>
      </svg>
      <div><p className="font-extrabold">{label}</p>{sub && <div className="mt-1 text-sm text-ink-muted">{sub}</div>}</div>
    </div>
  );
}

/** single-series horizontal bars with values (e.g. applications by status) */
export function HBars({ rows, title, color = 'var(--series-1)', format }: { rows: { label: string; value: number; hint?: string }[]; title: string; color?: string; format?: (v: number) => ReactNode }) {
  const max = useMemo(() => Math.max(...rows.map(r => r.value), 1), [rows]);
  return (
    <figure>
      <figcaption className="mb-3 text-sm font-bold text-ink dark:text-white">{title}</figcaption>
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.label} title={r.hint} className="grid grid-cols-[minmax(90px,38%)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-ink-soft dark:text-emerald-50/80">{r.label}</span>
            <span className="h-3 rounded-[4px] bg-[var(--grid)]"><span className="chart-grow-x block h-full rounded-[4px]" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 4 : 0, background: color, animationDelay: `${i * 80}ms` }} /></span>
            <b className={cx('text-end tabular-nums')}><Num>{format ? format(r.value) : r.value}</Num></b>
          </li>))}
      </ul>
    </figure>
  );
}
