'use client';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { computeQuote, FALLBACK_SETTINGS, type QuoteSettings } from '@/lib/quote';
import type { PublicSettings } from '@/lib/types';
import { Alert, Card, LinkButton, Num } from './ui';
import { useTween } from './motion';

/** settings configured by the administrator (sulfa_settings), read through the public function */
export function usePublicSettings(): { settings: QuoteSettings; loaded: boolean; failed: boolean } {
  const [s, setS] = useState<{ settings: QuoteSettings; loaded: boolean; failed: boolean }>({ settings: FALLBACK_SETTINGS, loaded: false, failed: false });
  useEffect(() => {
    if (!supabase) { setS(x => ({ ...x, failed: true })); return; }
    supabase.rpc('sulfa_public_settings').then(({ data, error }) => {
      if (error || !data) setS(x => ({ ...x, failed: true }));
      else { const p = data as PublicSettings; setS({ loaded: true, failed: false, settings: { min_amount: +p.min_amount, max_amount: +p.max_amount, min_term: p.min_term, max_term: p.max_term, fee_fixed: +p.fee_fixed, fee_percent: +p.fee_percent, monthly_rate_percent: +p.monthly_rate_percent } }); }
    });
  }, []);
  return s;
}

export function Simulator({ cta = true, onChange, initial }: { cta?: boolean; onChange?: (amount: number, term: number) => void; initial?: { amount: number; term: number } }) {
  const { t, money } = useI18n();
  const { settings: s, loaded, failed } = usePublicSettings();
  const [amount, setAmount] = useState(initial?.amount || 2000);
  const [term, setTerm] = useState(initial?.term || 6);
  useEffect(() => { setAmount(a => Math.min(Math.max(a, s.min_amount), s.max_amount)); setTerm(x => Math.min(Math.max(x, s.min_term), s.max_term)); }, [s]);
  useEffect(() => { onChange?.(amount, term); }, [amount, term, onChange]);
  const q = useMemo(() => { try { return computeQuote(s, amount, term); } catch { return null; } }, [s, amount, term]);
  const monthlyShown = useTween(q?.monthly ?? 0);
  const terms = Array.from({ length: s.max_term - s.min_term + 1 }, (_, i) => s.min_term + i);
  return (
    <Card className="!p-6 sm:!p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="sim-amount" className="mb-2 flex items-baseline justify-between text-sm font-bold"><span>{t('sim.amount')}</span>
              <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200"><Num>{money(amount)}</Num></span></label>
            <input id="sim-amount" type="range" className="w-full" min={s.min_amount} max={s.max_amount} step={100} value={amount}
              onChange={e => setAmount(Number(e.target.value))} aria-valuetext={money(amount)} />
            <div className="mt-1 flex justify-between text-xs text-ink-muted"><Num>{money(s.min_amount)}</Num><Num>{money(s.max_amount)}</Num></div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t('sim.term')}</legend>
            <div className="flex flex-wrap gap-2">
              {terms.map(n => (
                <button key={n} type="button" onClick={() => setTerm(n)} aria-pressed={term === n}
                  className={'min-h-11 min-w-14 rounded-xl border px-3 text-sm font-bold transition ' + (term === n ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-line bg-white hover:border-emerald-400 dark:border-white/15 dark:bg-white/5')}>
                  {t('sim.months', { n })}
                </button>))}
            </div>
          </fieldset>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-lift">
          <p className="text-sm text-emerald-100/80">{t('sim.monthly')}</p>
          <p className="mt-1 text-4xl font-black" aria-live="polite"><Num>{q ? money(Math.round(monthlyShown * 1000) / 1000) : '—'}</Num></p>
          <dl className="mt-6 space-y-2 text-sm">
            {q && ([['sim.principal', q.amount], ['sim.fee', q.fee], ['sim.interest', q.interest], ['sim.total', q.total]] as const).map(([k, v]) => (
              <div key={k} className={'flex justify-between gap-4 ' + (k === 'sim.total' ? 'border-t border-white/20 pt-2 font-extrabold' : '')}><dt className="text-emerald-100/80">{t(k)}</dt><dd><Num>{money(v)}</Num></dd></div>))}
            {q && q.last !== q.monthly && <div className="flex justify-between gap-4 text-xs text-emerald-100/70"><dt>{t('sim.last')}</dt><dd><Num>{money(q.last)}</Num></dd></div>}
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-emerald-100/70">{t('sim.disclaimer')}</p>
          {cta && <LinkButton href={`/signup/?amount=${amount}&term=${term}`} variant="gold" className="mt-5 w-full">{t('sim.cta')}</LinkButton>}
        </div>
      </div>
      {!loaded && failed && <div className="mt-6"><Alert tone="warn">{t('sim.not_loaded')}</Alert></div>}
    </Card>
  );
}
