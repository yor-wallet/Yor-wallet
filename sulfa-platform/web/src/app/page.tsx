'use client';
import { PublicPage } from '@/components/shell';
import { Simulator } from '@/components/simulator';
import { FaqList, Steps } from '@/components/marketing';
import { LinkButton, Num } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function Home() {
  const { t } = useI18n();
  return (
    <PublicPage>
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_1fr] lg:py-14">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-sm font-bold text-emerald-800 dark:border-white/10 dark:bg-white/5 dark:text-emerald-100"><span className="h-2 w-2 rounded-full bg-gold-400" />{t('home.kicker')}</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.15] text-emerald-950 sm:text-5xl lg:text-6xl dark:text-white">{t('home.h1a')}<br /><span className="bg-gradient-to-l from-emerald-600 to-emerald-900 bg-clip-text text-transparent dark:from-emerald-300 dark:to-gold-300">{t('home.h1b')}</span></h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft dark:text-emerald-50/80">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3"><LinkButton href="/signup/" className="!px-7 !py-3.5">{t('home.cta')}</LinkButton><LinkButton href="/how-it-works/" variant="secondary" className="!px-7 !py-3.5">{t('home.cta2')}</LinkButton></div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft dark:text-emerald-100/80">
            {['home.b1', 'home.b2', 'home.b3'].map(k => <li key={k} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-700">✓</span>{t(k)}</li>)}
          </ul>
        </div>
        <div className="relative animate-rise [animation-delay:.1s]">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-emerald-200/50 to-gold-200/40 blur-2xl dark:from-emerald-500/10 dark:to-gold-500/10" />
          <div className="rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-7 text-white shadow-lift">
            <div className="flex items-center justify-between"><span className="text-sm text-emerald-100/80">{t('home.card_label')}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl font-black">س</span></div>
            <p className="mt-6 text-sm text-emerald-100/70">{t('home.card_range')}</p>
            <p className="mt-1 text-4xl font-black"><Num>500 – 10,000</Num> <span className="text-xl text-gold-300">{t('cur')}</span></p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 p-3"><p className="text-emerald-100/70">{t('home.card_term')}</p><p className="mt-1 font-extrabold">{t('home.card_term_v')}</p></div>
              <div className="rounded-xl bg-white/10 p-3"><p className="text-emerald-100/70">{t('home.card_decision')}</p><p className="mt-1 font-extrabold">{t('home.card_decision_v')}</p></div>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-emerald-100/60">{t('home.card_note')}</p>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="how-h"><h2 id="how-h" className="mb-2 text-3xl font-black text-emerald-950 dark:text-white">{t('how.title')}</h2><p className="mb-6 text-ink-muted">{t('how.sub')}</p><Steps n={4} /></section>

      <section className="mt-16" aria-labelledby="sim-h"><h2 id="sim-h" className="mb-2 text-3xl font-black text-emerald-950 dark:text-white">{t('sim.title')}</h2><p className="mb-6 text-ink-muted">{t('sim.sub')}</p><Simulator /></section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.4fr]" aria-labelledby="faq-h">
        <div><h2 id="faq-h" className="text-3xl font-black text-emerald-950 dark:text-white">{t('faq.title')}</h2><p className="mt-2 text-ink-muted">{t('faq.sub')}</p><LinkButton href="/faq/" variant="secondary" className="mt-5">{t('home.all_faq')}</LinkButton></div>
        <FaqList count={4} />
      </section>

      <section className="mt-16 rounded-[2rem] bg-gradient-to-br from-emerald-800 to-emerald-950 p-8 text-center text-white shadow-lift sm:p-12">
        <h2 className="text-3xl font-black">{t('home.final_t')}</h2><p className="mx-auto mt-3 max-w-xl text-emerald-100/80">{t('home.final_b')}</p>
        <LinkButton href="/signup/" variant="gold" className="mt-6 !px-8">{t('home.final_cta')}</LinkButton>
      </section>
    </PublicPage>
  );
}
