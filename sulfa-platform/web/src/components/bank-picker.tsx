'use client';
/* Bank picker for withdrawals: the banks licensed in Oman (table sulfa_banks, kept by the administrator), grouped and
   searchable in Arabic or English, shown with a monogram (never a bank logo). "Other bank" keeps a free-text name. */
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cx, Input } from './ui';
import { Sheet } from './shell';
import { Icon } from './icons';

export type Bank = { code: string; name_ar: string; name_en: string; kind: 'LOCAL' | 'ISLAMIC' | 'SPECIALIZED' | 'FOREIGN'; sort: number };
/** code: a listed bank; null: "other bank" with a free name; undefined: nothing chosen yet */
export type BankChoice = { code?: string | null; name: string };
const KINDS: Bank['kind'][] = ['LOCAL', 'ISLAMIC', 'SPECIALIZED', 'FOREIGN'];
const HUE: Record<Bank['kind'], string> = { LOCAL: 'tile-3d', ISLAMIC: 'tile-3d tile-gold', SPECIALIZED: 'tile-3d tile-blue', FOREIGN: 'tile-3d tile-ink' };
const norm = (s: string) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
const mono = (b: Bank) => b.name_en.replace(/\b(Bank|of|the|Limited|Oman)\b/gi, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || b.name_en.slice(0, 2);

export function BankPicker({ banks, value, onChange }: { banks: Bank[]; value: BankChoice; onChange: (v: BankChoice) => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const label = (b: Bank) => (lang === 'ar' ? b.name_ar : b.name_en);
  const sub = (b: Bank) => (lang === 'ar' ? b.name_en : b.name_ar);
  const list = useMemo(() => {
    const n = norm(q.trim());
    return banks.filter(b => !n || norm(b.name_ar).includes(n) || norm(b.name_en).includes(n) || b.code.toLowerCase().includes(n)).sort((a, b) => a.sort - b.sort);
  }, [banks, q]);
  const chosen = value.code ? banks.find(b => b.code === value.code) : null;
  const pick = (v: BankChoice) => { onChange(v); setOpen(false); setQ(''); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="press group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2 text-start shadow-sm transition hover:border-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-white/10 dark:bg-white/5">
        {chosen ? <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl font-latin text-sm font-black', HUE[chosen.kind])}>{mono(chosen)}</span>
          : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-white/10 dark:text-emerald-200"><Icon name="wallet" size={20} /></span>}
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] text-emerald-950 dark:text-white">{chosen ? label(chosen) : value.code === null ? (value.name || t('bank.other')) : t('bank.pick')}</b>
          {chosen && <span className="block truncate text-xs text-ink-muted">{sub(chosen)}</span>}
        </span>
        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{value.code !== undefined ? t('bank.change') : '›'}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('bank.pick')}>
        <div className="relative mb-4"><Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('bank.search')} aria-label={t('bank.search')} className="!ps-10" />
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-ink-muted"><Icon name="search" size={18} /></span></div>
        {KINDS.map(k => {
          const rows = list.filter(b => b.kind === k); if (!rows.length) return null;
          return (
            <section key={k} className="mb-4">
              <h3 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-gold-600">{t('bank.kind.' + k)}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {rows.map((b, i) => (
                  <li key={b.code} className="sheet-item" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                    <button type="button" onClick={() => pick({ code: b.code, name: b.name_en })} aria-pressed={value.code === b.code}
                      className={cx('press flex w-full items-center gap-3 rounded-2xl border p-2.5 text-start transition', value.code === b.code ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-line bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-white/5')}>
                      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl font-latin text-sm font-black', HUE[b.kind])}>{mono(b)}</span>
                      <span className="min-w-0"><b className="block truncate text-sm text-emerald-950 dark:text-white">{label(b)}</b><span className="block truncate text-xs text-ink-muted">{sub(b)}</span></span>
                      {value.code === b.code && <span className="ms-auto text-emerald-600"><Icon name="check" size={18} /></span>}
                    </button>
                  </li>))}
              </ul>
            </section>);
        })}
        {list.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">{t('bank.none')}</p>}
        <button type="button" onClick={() => pick({ code: null, name: value.code ? '' : value.name })} className="press mb-2 w-full rounded-2xl border border-dashed border-line p-3 text-sm font-bold text-emerald-800 dark:border-white/15 dark:text-emerald-100">{t('bank.other')}</button>
        <p className="text-center text-[11px] text-ink-muted">{t('bank.note')}</p>
      </Sheet>
    </>
  );
}
