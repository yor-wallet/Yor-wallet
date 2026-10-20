'use client';
/* Cinematic launch (opening) and goodbye (closing) screens of the app.
   Pure CSS animation: light sweep over the icon, expanding gold rings, rising sparks, name reveal. */
import { useI18n } from '@/lib/i18n';
import { cx } from './ui';

const SPARKS = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 0.29) % 2.4, s: 3 + (i % 4) }));

export function LaunchScreen({ leaving, closing }: { leaving?: boolean; closing?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={closing ? t('launch.bye') : 'SULFA'} className={cx('launch fixed inset-0 z-[70] grid place-items-center overflow-hidden text-white', leaving && 'launch-out', closing && 'launch-closing')}>
      <div aria-hidden className="launch-bg absolute inset-0" />
      <div aria-hidden className="launch-pattern absolute inset-0" />
      <div aria-hidden className="absolute inset-0">
        {SPARKS.map((p, i) => <span key={i} className="launch-spark" style={{ left: `${p.x}%`, animationDelay: `${p.d}s`, width: p.s, height: p.s }} />)}
      </div>
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <span aria-hidden className="launch-ring" /><span aria-hidden className="launch-ring launch-ring-2" />
          <span className="launch-icon relative block h-28 w-28 overflow-hidden rounded-[30%] shadow-[0_30px_70px_rgba(0,0,0,.45)]">
            <img src="/brand/icon-rounded-512.png" alt="" width={112} height={112} className="h-full w-full" />
            <span aria-hidden className="launch-sweep" />
          </span>
        </div>
        <p className="launch-name mt-7 text-4xl font-black">{closing ? t('launch.bye') : 'سلفه'}</p>
        <p className="launch-tag mt-2 font-latin text-[11px] font-bold tracking-[5px] text-gold-300">{closing ? t('launch.bye_sub') : 'SULFA FINANCE'}</p>
        {!closing && <span aria-hidden className="launch-bar mt-8 block h-[3px] w-28 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-full rounded-full bg-gradient-to-l from-gold-300 to-gold-500" /></span>}
      </div>
    </div>
  );
}
