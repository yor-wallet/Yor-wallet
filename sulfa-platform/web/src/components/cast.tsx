'use client';
/* "Qui fait quoi": the three roles of the platform, each embodied by an illustrated character. */
import { useI18n } from '@/lib/i18n';
import { Character, type Mood, type Prop } from './characters';
import { Reveal } from './motion';

const ROLES: { who: 'aisha' | 'salim' | 'maryam'; mood: Mood; prop: Prop; tone: string }[] = [
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
            <article className={`group relative h-full overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-b ${r.tone} p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-white/10 dark:from-white/10 dark:to-transparent`}>
              <div className="flex items-end gap-4">
                <Character who={r.who} mood={r.mood} prop={r.prop} title={t('chars.' + r.who)} className="h-48 w-auto shrink-0 transition duration-500 group-hover:scale-105" />
                <div className="pb-3"><p className="text-xs font-bold uppercase tracking-wide text-gold-600">{t(`cast.${r.who}.role`)}</p><h3 className="text-xl font-black text-emerald-950 dark:text-white">{t('chars.' + r.who).split(/[,،]/)[0]}</h3></div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-soft dark:text-emerald-50/85">
                {[1, 2, 3].map(n => <li key={n} className="flex gap-2"><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-[9px] text-white">✓</span>{t(`cast.${r.who}.${n}`)}</li>)}
              </ul>
              <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs italic text-ink-muted dark:bg-white/5">« {t(`cast.${r.who}.quote`)} »</p>
            </article>
          </Reveal>))}
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t('cast.note')}</p>
    </section>
  );
}
