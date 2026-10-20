'use client';
/* "Qui fait quoi": the three roles of the platform, each embodied by an illustrative portrait. */
import { useI18n } from '@/lib/i18n';
import { Portrait } from './portraits';
import { Reveal } from './motion';

const ROLES: { who: 'aisha' | 'salim' | 'maryam'; mood?: string; prop?: string; tone: string }[] = [
  { who: 'aisha', mood: 'happy', prop: 'phone', tone: 'from-emerald-50 to-white' },
  { who: 'salim', mood: 'happy', prop: 'coins', tone: 'from-gold-100 to-white' },
  { who: 'maryam', mood: 'focused', prop: 'laptop', tone: 'from-emerald-100 to-white' },
];

export function Cast() {
  const { t } = useI18n();
  return (
    <section className="mt-16" aria-labelledby="cast-h">
      <Reveal><h2 id="cast-h" className="text-3xl font-black text-emerald-950 dark:text-white">{t('cast.title')}</h2><p className="mt-2 max-w-2xl text-ink-muted">{t('cast.sub')}</p></Reveal>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {ROLES.map((r, i) => (
          <Reveal key={r.who} delay={i * 140} from="up">
            <article className={`group relative h-full overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-b ${r.tone} shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-white/10 dark:from-white/10 dark:to-transparent`}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <Portrait who={r.who} large title={t('chars.' + r.who)} className="kenburns transition duration-700 group-hover:scale-[1.06]" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-950/10 to-transparent" />
                <div aria-hidden className="photo-sheen absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="inline-block rounded-full bg-gold-400/95 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950">{t(`cast.${r.who}.role`)}</p>
                  <h3 className="mt-1.5 text-2xl font-black text-white drop-shadow">{t('chars.' + r.who).split(/[,،]/)[0]}</h3>
                </div>
              </div>
              <div className="p-5">
                <ul className="space-y-2 text-sm text-ink-soft dark:text-emerald-50/85">
                  {[1, 2, 3].map(n => <li key={n} className="flex gap-2"><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-[9px] text-white">✓</span>{t(`cast.${r.who}.${n}`)}</li>)}
                </ul>
                <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs italic text-ink-muted dark:bg-white/5">« {t(`cast.${r.who}.quote`)} »</p>
              </div>
            </article>
          </Reveal>))}
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t('cast.note')}</p>
    </section>
  );
}
