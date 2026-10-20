'use client';
/* "Le parcours en film": an animated, self-playing storyboard of the real SULFA journey.
   ILLUSTRATION ONLY — every name and amount on the phone is fictitious and labelled as such. Nothing here reads or
   writes data. Autoplay stops when the section is off screen, the tab is hidden, or the user prefers reduced motion. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useReducedMotion } from './motion';
import { Portrait } from './portraits';
import { cx, Num } from './ui';

const SCENES = 6;
/** who acts in each scene, and how they react */
const CAST: { who: 'aisha' | 'salim' | 'maryam'; mood: string; prop: string; say: string }[] = [
  { who: 'aisha', mood: 'neutral', prop: 'phone', say: 'film.c1' }, { who: 'aisha', mood: 'happy', prop: 'id', say: 'film.c2' },
  { who: 'maryam', mood: 'focused', prop: 'magnifier', say: 'film.c3' }, { who: 'maryam', mood: 'happy', prop: 'stamp', say: 'film.c4' },
  { who: 'maryam', mood: 'neutral', prop: 'laptop', say: 'film.c5' }, { who: 'aisha', mood: 'happy', prop: 'coins', say: 'film.c6' },
];
const DURATION = 5200;

function Bar({ w, delay = 0 }: { w: string; delay?: number }) {
  return <span className="film-bar block h-2 rounded-full bg-emerald-900/10 dark:bg-white/10" style={{ width: w, animationDelay: `${delay}ms` }} />;
}

function Screen({ scene }: { scene: number }) {
  const { t, money } = useI18n();
  const Chip = ({ k, tone }: { k: string; tone: 'ok' | 'wait' }) => (
    <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-extrabold', tone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-gold-100 text-gold-600')}>{t(k)}</span>
  );
  switch (scene) {
    case 0: return (
      <div className="space-y-3 p-4">
        <p className="film-in text-sm font-black text-emerald-950">{t('auth.signup_t')}</p>
        {['f.first_name', 'f.last_name', 'auth.email', 'f.phone'].map((k, i) => (
          <div key={k} className="film-in rounded-xl border border-emerald-900/10 bg-white p-2" style={{ animationDelay: `${150 + i * 220}ms` }}>
            <p className="text-[9px] font-bold text-ink-muted">{t(k)}</p>
            <p className="film-type mt-0.5 h-3 overflow-hidden whitespace-nowrap text-[11px] font-bold text-emerald-950" style={{ animationDelay: `${450 + i * 220}ms` }} dir="ltr">
              {['Aisha', 'Al-Harthi', 'aisha@example.om', '+968 9xxx xxxx'][i]}</p>
          </div>))}
        <div className="film-in film-pulse mt-2 rounded-xl bg-emerald-700 py-2 text-center text-[11px] font-extrabold text-white" style={{ animationDelay: '1500ms' }}>{t('auth.signup_btn')}</div>
      </div>);
    case 1: return (
      <div className="space-y-3 p-4">
        <p className="film-in text-sm font-black text-emerald-950">{t('cn.documents')}</p>
        {['doc.id_front', 'doc.id_back'].map((k, i) => (
          <div key={k} className="film-in rounded-xl border border-emerald-900/10 bg-white p-3" style={{ animationDelay: `${200 + i * 500}ms` }}>
            <div className="flex items-center gap-3">
              <div className="film-card grid h-10 w-14 place-items-center rounded-lg bg-gradient-to-br from-emerald-100 to-gold-100 text-lg" style={{ animationDelay: `${300 + i * 500}ms` }}>🪪</div>
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{t(k)}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-900/10"><div className="film-progress h-full rounded-full bg-emerald-600" style={{ animationDelay: `${500 + i * 500}ms` }} /></div></div>
              <span className="film-pop grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[10px] text-white" style={{ animationDelay: `${1700 + i * 500}ms` }}>✓</span>
            </div>
          </div>))}
        <p className="film-in text-center text-[10px] text-ink-muted" style={{ animationDelay: '2600ms' }}>{t('doc.privacy')}</p>
      </div>);
    case 2: return (
      <div className="space-y-3 p-4">
        <div className="film-in flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-gold-400 text-[11px] font-black text-emerald-950">A</span><p className="text-[11px] font-black">{t('an.documents')}</p></div>
        <div className="film-in relative overflow-hidden rounded-xl bg-white p-3" style={{ animationDelay: '200ms' }}>
          <div className="grid h-24 place-items-center rounded-lg bg-gradient-to-br from-emerald-50 to-gold-100 text-4xl">🪪</div>
          <div className="film-scan absolute inset-x-3 top-3 h-8 rounded bg-gradient-to-b from-transparent via-emerald-400/40 to-transparent" />
          <span className="film-stamp absolute end-4 top-6 rotate-[-12deg] rounded-md border-2 border-emerald-600 px-2 py-0.5 text-[11px] font-black text-emerald-700" style={{ animationDelay: '2100ms' }}>{t('st.VERIFIED')} ✓</span>
        </div>
        <div className="space-y-1.5">{[0, 1, 2].map(i => <Bar key={i} w={['90%', '70%', '80%'][i]} delay={400 + i * 150} />)}</div>
        <div className="film-in flex justify-between text-[10px]" style={{ animationDelay: '2400ms' }}><span>{t('doc.identity')}</span><Chip k="id.VERIFIED" tone="ok" /></div>
      </div>);
    case 3: return (
      <div className="space-y-3 p-4">
        <p className="film-in text-sm font-black text-emerald-950">{t('app.summary')}</p>
        <div className="film-in rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-950 p-4 text-white" style={{ animationDelay: '150ms' }}>
          <p className="text-[10px] text-emerald-100/80">{t('app.approved')}</p>
          <p className="film-count mt-1 text-2xl font-black"><Num>{money(2000)}</Num></p>
          <p className="text-[10px] text-emerald-100/70">{t('sim.months', { n: 6 })} · {t('sim.monthly')} <Num>{money(360)}</Num></p>
        </div>
        <div className="film-in flex items-center justify-between rounded-xl bg-white p-2.5 text-[10px]" style={{ animationDelay: '500ms' }}>
          <span className="film-swap relative h-5 w-28"><span className="film-swap-a absolute inset-0"><Chip k="st.IN_REVIEW" tone="wait" /></span><span className="film-swap-b absolute inset-0"><Chip k="st.APPROVED" tone="ok" /></span></span>
          <span className="text-ink-muted">{t('actor.ADMIN')}</span>
        </div>
        <p className="film-in rounded-lg bg-gold-100 p-2 text-[10px] leading-snug text-emerald-950" style={{ animationDelay: '1900ms' }}>{t('app.approved_not_paid')}</p>
      </div>);
    case 4: return (
      <div className="space-y-3 p-4">
        <p className="film-in text-sm font-black text-emerald-950">{t('adm.confirm_t')}</p>
        <div className="film-in rounded-xl border border-emerald-900/10 bg-white p-2" style={{ animationDelay: '150ms' }}>
          <p className="text-[9px] font-bold text-ink-muted">{t('dlg.reference')}</p>
          <p className="film-type mt-0.5 h-3 overflow-hidden whitespace-nowrap text-[11px] font-bold" dir="ltr" style={{ animationDelay: '350ms' }}>TRF-2026-10-0001</p>
        </div>
        <div className="space-y-1">{([['acct.LOANS_RECEIVABLE', 'led.DEBIT', 2160], ['acct.CLIENT', 'led.CREDIT', 2000], ['acct.FEE_INCOME', 'led.CREDIT', 160]] as const).map(([a, s, v], i) => (
          <div key={a} className="film-in flex justify-between rounded-lg bg-white px-2 py-1.5 text-[9px]" style={{ animationDelay: `${1000 + i * 300}ms` }}><span>{t(a)}</span><span className="font-bold">{t(s)} <Num>{money(v)}</Num></span></div>))}</div>
        <div className="film-in rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-950 p-3 text-white" style={{ animationDelay: '2100ms' }}>
          <p className="text-[10px] text-emerald-100/80">{t('dash.available')}</p><p className="film-count text-xl font-black" style={{ animationDelay: '2300ms' }}><Num>{money(2000)}</Num></p>
        </div>
      </div>);
    default: return (
      <div className="space-y-3 p-4">
        <p className="film-in text-sm font-black text-emerald-950">{t('inst.schedule')}</p>
        <ol className="relative space-y-2 border-s-2 border-emerald-900/10 ps-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <li key={i} className="film-in flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[10px]" style={{ animationDelay: `${150 + i * 180}ms` }}>
              <span className={cx('absolute -start-[7px] h-3 w-3 rounded-full border-2 border-white', i === 1 ? 'bg-emerald-600' : 'bg-gold-300')} />
              <span># <Num>{i}</Num></span><Num>{money(360)}</Num>{i === 1 ? <Chip k="st.PAID" tone="ok" /> : <Chip k="st.DUE" tone="wait" />}
            </li>))}
        </ol>
        <p className="film-in text-center text-[10px] font-bold text-emerald-800" style={{ animationDelay: '1600ms' }}>{t('n.REPAYMENT_RECEIVED.t')} ✓</p>
      </div>);
  }
}

export function Film() {
  const { t, dir } = useI18n();
  const reduced = useReducedMotion();
  const [back, fwd] = dir === 'rtl' ? ['›', '‹'] : ['‹', '›'];
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const box = useRef<HTMLElement>(null);
  const elapsed = useRef(0);

  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    const el = box.current; if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const go = useCallback((i: number) => { setScene((i + SCENES) % SCENES); elapsed.current = 0; setProgress(0); }, []);
  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      if (document.visibilityState === 'visible') elapsed.current += now - last;
      last = now;
      if (elapsed.current >= DURATION) { go(scene + 1); return; }
      setProgress(elapsed.current / DURATION);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, scene, go]);

  return (
    <section ref={box} aria-labelledby="film-h" className="relative mt-16 overflow-hidden rounded-[2rem] bg-emerald-950 px-5 py-10 text-white shadow-lift sm:px-10 sm:py-14">
      <div aria-hidden className="mesh absolute inset-0 opacity-70" />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-gold-300"><span className="film-dot h-2 w-2 rounded-full bg-red-500" />{t('film.badge')}</span>
          <h2 id="film-h" className="mt-4 text-3xl font-black sm:text-4xl">{t('film.title')}</h2>
          <p className="mt-2 max-w-xl text-emerald-100/80">{t('film.sub')}</p>
          <ol className="mt-8 space-y-2" aria-label={t('film.chapters')}>
            {Array.from({ length: SCENES }, (_, i) => (
              <li key={i}>
                <button onClick={() => go(i)} aria-current={i === scene ? 'step' : undefined}
                  className={cx('group flex w-full items-start gap-4 rounded-2xl p-3 text-start transition', i === scene ? 'bg-white/10' : 'hover:bg-white/5')}>
                  <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl font-latin text-sm font-black transition', i === scene ? 'bg-gold-400 text-emerald-950' : i < scene ? 'bg-emerald-600 text-white' : 'bg-white/10 text-emerald-100')}>{i < scene ? '✓' : `0${i + 1}`}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold">{t(`film.s${i + 1}.t`)}</span>
                    {i === scene && <span className="film-in mt-1 block text-sm text-emerald-100/80">{t(`film.s${i + 1}.b`)}</span>}
                    {i === scene && <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gold-400" style={{ width: `${progress * 100}%` }} /></span>}
                  </span>
                </button>
              </li>))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={() => setPlaying(p => !p)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-extrabold text-emerald-950 transition hover:bg-gold-300" aria-pressed={playing}>
              {playing ? '❚❚ ' + t('film.pause') : '▶ ' + t('film.play')}</button>
            <button onClick={() => go(scene - 1)} className="min-h-11 rounded-xl border border-white/20 px-4 font-bold hover:bg-white/10" aria-label={t('film.prev')}>{back}</button>
            <button onClick={() => go(scene + 1)} className="min-h-11 rounded-xl border border-white/20 px-4 font-bold hover:bg-white/10" aria-label={t('film.next')}>{fwd}</button>
          </div>
          <p className="mt-4 text-xs text-emerald-100/60">{t('film.note')}</p>
        </div>
        <div className="relative mx-auto ps-28 sm:ps-44 lg:ps-52">
          <div key={'c' + scene} className="char-enter absolute bottom-10 start-0 z-20 flex w-44 flex-col items-start gap-2 sm:w-52">
            <div className="char-bubble rounded-2xl rounded-es-sm bg-white px-3 py-2.5 text-xs font-bold leading-snug text-emerald-950 shadow-lift">{t(CAST[scene].say)}</div>
            <div className="flex items-center gap-2"><span className="h-14 w-14 overflow-hidden rounded-full shadow-lift ring-2 ring-white"><Portrait who={CAST[scene].who} title={t('chars.' + CAST[scene].who)} /></span>
              <span className="text-[11px] font-bold text-emerald-100/80">{t('chars.' + CAST[scene].who)}</span></div>
          </div>
          <div className="phone relative h-[560px] w-[280px] rounded-[2.6rem] border-[10px] border-black bg-black shadow-[0_40px_80px_rgba(0,0,0,.45)]">
            <div className="absolute start-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black rtl:translate-x-1/2" />
            <div className="h-full overflow-hidden rounded-[2rem] bg-paper text-ink">
              <div className="flex items-center justify-between px-5 pb-1 pt-3 font-latin text-[10px] font-bold text-ink-soft"><span>9:41</span><span>●●● ▮</span></div>
              <div className="flex items-center gap-2 border-b border-emerald-900/10 px-4 pb-2"><span className="grid h-7 w-7 place-items-center rounded-[9px_9px_9px_3px] bg-gradient-to-br from-emerald-500 to-emerald-900 text-sm font-black text-white">س</span><b className="text-sm">سلفه</b>
                <span className="ms-auto rounded-full bg-gold-100 px-2 py-0.5 text-[9px] font-bold text-gold-600">{t('film.demo')}</span></div>
              <div key={scene} className="film-screen" aria-live="polite"><Screen scene={scene} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
