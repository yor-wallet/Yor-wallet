'use client';
/* App entry (start_url of the installed app): launch screen, then onboarding — or straight to the user's space. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Portrait } from '@/components/portraits';
import { Img3D, type Asset3D } from '@/components/img3d';
import { Icon, type IconName } from '@/components/icons';
import { LangSwitch } from '@/components/shell';
import { cx } from '@/components/ui';

const SLIDES: { who: 'aisha' | 'salim' | 'maryam'; chip: IconName; tone: string; art: Asset3D }[] = [
  { who: 'aisha', chip: 'check', tone: 'from-emerald-500 to-emerald-800', art: 'idcard' },
  { who: 'salim', chip: 'receipt', tone: 'from-gold-400 to-gold-600', art: 'coins' },
  { who: 'maryam', chip: 'shield', tone: 'from-emerald-700 to-emerald-950', art: 'shield' },
];

export default function AppEntry() {
  const { t } = useI18n(); const { ready, session, role } = useAuth(); const router = useRouter();
  const [splash, setSplash] = useState(true);
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = setTimeout(() => setSplash(false), 1300); return () => clearTimeout(id); }, []);
  useEffect(() => { if (!splash && ready && session) router.replace(role ? '/admin/' : '/client/'); }, [splash, ready, session, role, router]);
  const go = (n: number) => { const el = track.current; if (!el) return; el.scrollTo({ left: (document.documentElement.dir === 'rtl' ? -1 : 1) * n * el.clientWidth, behavior: 'smooth' }); };
  const onScroll = () => { const el = track.current; if (el) setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth)); };

  if (splash || (ready && session)) return (
    <div className="splash fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-emerald-700 via-emerald-900 to-emerald-950 text-white">
      <div aria-hidden className="mesh absolute inset-0 opacity-60" />
      <div className="relative flex flex-col items-center">
        <span className="splash-logo grid h-24 w-24 place-items-center rounded-[30px_30px_30px_10px] bg-white/10 text-6xl font-black shadow-[0_30px_60px_rgba(0,0,0,.35)] backdrop-blur">س</span>
        <p className="splash-name mt-6 text-3xl font-black">سلفه</p>
        <p className="splash-tag mt-1 font-latin text-xs font-bold tracking-[4px] text-gold-300">SULFA FINANCE</p>
      </div>
    </div>
  );

  return (
    <div className="onboard fixed inset-0 flex flex-col bg-paper dark:bg-emerald-950">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <span className="font-black text-emerald-900 dark:text-white">سلفه · SULFA</span><LangSwitch />
      </div>
      <div ref={track} onScroll={onScroll} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain" aria-roledescription="carousel">
        {SLIDES.map((s, k) => (
          <section key={s.who} className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-7 text-center" aria-label={`${k + 1} / ${SLIDES.length}`}>
            <div className={cx('relative mb-6 transition duration-700', i === k ? 'scale-100 opacity-100' : 'scale-90 opacity-40')}>
              <div className={`absolute -inset-6 rounded-full bg-gradient-to-br ${s.tone} opacity-20 blur-2xl`} />
              <Img3D name={s.art} eager={k === 0} className="relative w-72 sm:w-80" />
              <span className="absolute -top-1 start-2 h-16 w-16 overflow-hidden rounded-full shadow-lift ring-4 ring-white dark:ring-emerald-900"><Portrait who={s.who} title={t('chars.' + s.who)} /></span>
              <div className={cx('absolute bottom-6 -end-2 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-emerald-950 shadow-lift dark:bg-emerald-900 dark:text-white', i === k && 'chip-pop')}>
                <span className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ${s.tone} text-white`}><Icon name={s.chip} size={16} /></span>{t(`ob.s${k + 1}.chip`)}</div>
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[3px] text-gold-600">{t(`ob.s${k + 1}.kicker`)}</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight text-emerald-950 dark:text-white">{t(`ob.s${k + 1}.t`)}</h1>
            <p className="mt-3 max-w-sm leading-relaxed text-ink-soft dark:text-emerald-50/80">{t(`ob.s${k + 1}.b`)}</p>
          </section>))}
      </div>
      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mb-5 flex justify-center gap-2">{SLIDES.map((_, k) => <button key={k} aria-label={`${k + 1}`} onClick={() => go(k)} className={cx('h-2 rounded-full transition-all duration-300', i === k ? 'w-7 bg-emerald-700' : 'w-2 bg-ink/20 dark:bg-white/25')} />)}</div>
        {i < SLIDES.length - 1
          ? <button onClick={() => go(i + 1)} className="press w-full rounded-2xl bg-emerald-700 py-4 text-[17px] font-extrabold text-white shadow-[0_14px_30px_rgba(8,127,91,.3)]">{t('ob.next')}</button>
          : <Link href="/signup/" className="press block w-full rounded-2xl bg-emerald-700 py-4 text-center text-[17px] font-extrabold text-white shadow-[0_14px_30px_rgba(8,127,91,.3)]">{t('ob.create')}</Link>}
        <Link href="/login/" className="press mt-3 block w-full rounded-2xl border border-line bg-white py-4 text-center text-[17px] font-extrabold text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-white">{t('ob.login')}</Link>
        <p className="mt-3 text-center text-[11px] text-ink-muted">{t('ob.note')} · <Link href="/" className="font-bold underline">{t('ob.site')}</Link></p>
      </div>
    </div>
  );
}
