'use client';
import { Card } from './ui';
import { Reveal } from './motion';
import { Img3D, type Asset3D } from './img3d';
import { useI18n } from '@/lib/i18n';

export const FAQ_COUNT = 8;
export function FaqList({ count = FAQ_COUNT }: { count?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Reveal key={i} delay={i * 70}><details className="group rounded-2xl border border-line bg-white p-5 shadow-card open:border-emerald-300 dark:border-white/10 dark:bg-emerald-950/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-emerald-950 dark:text-white">{t(`faq.q${i + 1}`)}<span aria-hidden className="text-xl text-emerald-700 transition group-open:rotate-45">＋</span></summary>
          <p className="mt-3 leading-relaxed text-ink-soft dark:text-emerald-50/80">{t(`faq.a${i + 1}`)}</p>
        </details></Reveal>))}
    </div>
  );
}
export const STEPS: Asset3D[] = ['card', 'idcard', 'shield', 'bell', 'coins', 'calendar'];
export function Steps({ n = 6 }: { n?: number }) {
  const { t } = useI18n();
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.slice(0, n).map((ic, i) => (
        <Reveal as="li" key={i} delay={i * 110}><Card className="group h-full transition duration-300 hover:-translate-y-1 hover:shadow-lift">
          <div className="flex items-center gap-3"><Img3D name={ic} float={false} className="-my-2 -ms-2 h-24 w-24 transition duration-500 group-hover:-translate-y-1 group-hover:scale-110" /><span className="font-latin text-sm font-black text-gold-500">0{i + 1}</span></div>
          <h3 className="mt-4 text-lg font-extrabold">{t(`how.s${i + 1}.t`)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-emerald-50/80">{t(`how.s${i + 1}.b`)}</p>
        </Card></Reveal>))}
    </ol>
  );
}
