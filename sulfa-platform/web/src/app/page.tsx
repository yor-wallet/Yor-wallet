'use client';
import { PublicPage } from '@/components/shell';
import { Simulator } from '@/components/simulator';
import { FaqList, Steps } from '@/components/marketing';
import { Film } from '@/components/film';
import { CountUp, Reveal, Tilt } from '@/components/motion';
import { LinkButton, Num } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Home() {
  const { t } = useI18n();
  const pillars = ['home.p1', 'home.p2', 'home.p3', 'home.p4', 'home.p5', 'home.p6'];
  return (
    <PublicPage>
      <section className="relative grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_1fr] lg:py-14">
        <div aria-hidden className="hero-glow pointer-events-none absolute -top-24 end-[-10%] -z-10 h-[460px] w-[460px] rounded-full bg-gradient-to-br from-emerald-300/40 to-gold-200/50 blur-3xl dark:from-emerald-500/15 dark:to-gold-500/10" />
        <div>
          <Reveal><span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-sm font-bold text-emerald-800 dark:border-white/10 dark:bg-white/5 dark:text-emerald-100"><span className="film-dot h-2 w-2 rounded-full bg-gold-400" />{t('home.kicker')}</span></Reveal>
          <Reveal delay={90}><h1 className="mt-5 text-4xl font-black leading-[1.15] text-emerald-950 sm:text-5xl lg:text-6xl dark:text-white">{t('home.h1a')}<br /><span className="bg-gradient-to-l from-emerald-600 to-emerald-900 bg-clip-text text-transparent dark:from-emerald-300 dark:to-gold-300">{t('home.h1b')}</span></h1></Reveal>
          <Reveal delay={180}><p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft dark:text-emerald-50/80">{t('home.lead')}</p></Reveal>
          <Reveal delay={270}><div className="mt-8 flex flex-wrap gap-3"><LinkButton href="/signup/" className="btn-sheen !px-7 !py-3.5">{t('home.cta')}</LinkButton><LinkButton href="#film-h" variant="secondary" className="!px-7 !py-3.5">▶ {t('home.watch')}</LinkButton></div></Reveal>
          <Reveal delay={360}><ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft dark:text-emerald-100/80">
            {['home.b1', 'home.b2', 'home.b3'].map(k => <li key={k} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-700">✓</span>{t(k)}</li>)}
          </ul></Reveal>
        </div>
        <Reveal from="zoom" delay={150} className="relative">
          <div aria-hidden className="float-slower absolute -start-6 top-10 -z-10 h-24 w-24 rounded-3xl bg-gold-300/40 blur-xl" />
          <div aria-hidden className="float-slow absolute -bottom-6 end-4 -z-10 h-32 w-32 rounded-full bg-emerald-400/30 blur-2xl" />
          <Tilt className="float-slow">
            <div className="shine relative rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-7 text-white shadow-lift">
              <div aria-hidden className="tilt-glare pointer-events-none absolute inset-0 rounded-[2rem]" />
              <div className="flex items-center justify-between"><span className="text-sm text-emerald-100/80">{t('home.card_label')}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl font-black">س</span></div>
              <p className="mt-6 text-sm text-emerald-100/70">{t('home.card_range')}</p>
              <p className="mt-1 text-4xl font-black"><Num><CountUp to={500} format={fmtInt} duration={900} /> – <CountUp to={10000} format={fmtInt} /></Num> <span className="gold-text text-xl">{t('cur')}</span></p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur"><p className="text-emerald-100/70">{t('home.card_term')}</p><p className="mt-1 font-extrabold">{t('home.card_term_v')}</p></div>
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur"><p className="text-emerald-100/70">{t('home.card_decision')}</p><p className="mt-1 font-extrabold">{t('home.card_decision_v')}</p></div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-emerald-100/60">{t('home.card_note')}</p>
            </div>
          </Tilt>
        </Reveal>
      </section>

      <div className="-mx-4 mt-6 overflow-hidden border-y border-line/80 bg-white/50 py-4 sm:-mx-6 dark:border-white/10 dark:bg-white/5" aria-hidden>
        <div className="marquee text-sm font-bold text-emerald-900/80 dark:text-emerald-100/70">
          {[...pillars, ...pillars].map((k, i) => <span key={i} className="flex items-center gap-2 whitespace-nowrap"><span className="text-gold-500">◆</span>{t(k)}</span>)}
        </div>
      </div>

      <section className="mt-14 grid gap-4 sm:grid-cols-3" aria-label={t('home.figures')}>
        {([['home.f1', 500, 10000], ['home.f2', 3, 9], ['home.f3', 0, 0]] as const).map(([k, a, b], i) => (
          <Reveal key={k} delay={i * 120}><div className="rounded-2xl border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-white/5">
            <p className="text-3xl font-black text-emerald-800 dark:text-emerald-200"><Num>{k === 'home.f3' ? '100 %' : <><CountUp to={a} format={fmtInt} /> – <CountUp to={b} format={fmtInt} /></>}</Num></p>
            <p className="mt-1 text-sm text-ink-muted">{t(k)}</p></div></Reveal>))}
      </section>

      <section className="mt-16" aria-labelledby="how-h">
        <Reveal><h2 id="how-h" className="mb-2 text-3xl font-black text-emerald-950 dark:text-white">{t('how.title')}</h2><p className="mb-6 text-ink-muted">{t('how.sub')}</p></Reveal>
        <Steps n={4} />
      </section>

      <Film />

      <section className="mt-16" aria-labelledby="sim-h">
        <Reveal><h2 id="sim-h" className="mb-2 text-3xl font-black text-emerald-950 dark:text-white">{t('sim.title')}</h2><p className="mb-6 text-ink-muted">{t('sim.sub')}</p></Reveal>
        <Reveal from="zoom"><Simulator /></Reveal>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.4fr]" aria-labelledby="faq-h">
        <Reveal from="left"><h2 id="faq-h" className="text-3xl font-black text-emerald-950 dark:text-white">{t('faq.title')}</h2><p className="mt-2 text-ink-muted">{t('faq.sub')}</p><LinkButton href="/faq/" variant="secondary" className="mt-5">{t('home.all_faq')}</LinkButton></Reveal>
        <Reveal from="right"><FaqList count={4} /></Reveal>
      </section>

      <Reveal from="zoom"><section className="shine relative mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 to-emerald-950 p-8 text-center text-white shadow-lift sm:p-12">
        <div aria-hidden className="mesh absolute inset-0 opacity-40" />
        <div className="relative"><h2 className="text-3xl font-black">{t('home.final_t')}</h2><p className="mx-auto mt-3 max-w-xl text-emerald-100/80">{t('home.final_b')}</p>
          <LinkButton href="/signup/" variant="gold" className="btn-sheen mt-6 !px-8">{t('home.final_cta')}</LinkButton></div>
      </section></Reveal>
    </PublicPage>
  );
}
