'use client';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { renderNotification } from '@/lib/notif';
import type { Application, Installment, Notification, Summary } from '@/lib/types';
import { Ring, ScheduleBars } from '@/components/charts';
import { Character } from '@/components/characters';
import { Alert, Badge, Card, ErrorBox, LinkButton, Loading, Num, PageHeader, Stat, must, useLoad } from '@/components/ui';

export default function Dashboard() {
  const { t, money, date, lang } = useI18n(); const { profile, session } = useAuth();
  const uid = session!.user.id;
  const { data, error, loading, reload } = useLoad(async () => {
    const [summary, apps, notes, inst] = await Promise.all([
      must(supabase!.rpc('sulfa_my_summary')),
      must(supabase!.from('sulfa_applications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)),
      must(supabase!.from('sulfa_notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(4)),
      must(supabase!.from('sulfa_installments').select('*').eq('user_id', uid).order('due_date')),
    ]);
    return { summary: summary as Summary, app: (apps as Application[])[0] ?? null, notes: notes as Notification[], inst: inst as Installment[] };
  }, [uid]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { summary: s, app, notes, inst } = data!;
  const active = app ? inst.filter(i => i.application_id === app.id) : [];
  const payoff = active.filter(i => i.status !== 'PAID').at(-1)?.due_date ?? null;
  const idOk = profile?.identity_status === 'VERIFIED';
  return (
    <>
      <PageHeader title={t('dash.title', { name: profile?.first_name ?? '' })} sub={t('dash.sub')} actions={<LinkButton href="/client/apply/">{t('cn.apply')}</LinkButton>} />
      {!idOk && profile && (
        <div className="mb-6"><Alert tone={profile.identity_status === 'REJECTED' || profile.identity_status === 'REUPLOAD_REQUIRED' ? 'error' : 'warn'} title={t('dash.id_title')}>
          <p>{t('dash.id_' + profile.identity_status)}</p><Link href="/client/documents/" className="mt-2 inline-block font-bold underline">{t('dash.id_cta')}</Link></Alert></div>)}
      <section className="rounded-[1.75rem] bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-6 text-white shadow-lift sm:p-8">
        <p className="text-sm text-emerald-100/80">{t('dash.available')}</p>
        <p className="mt-1 text-4xl font-black sm:text-5xl"><Num>{money(s.available)}</Num></p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-emerald-100/80">
          <span>{t('dash.balance')}{t('common.colon')}<Num>{money(s.balance)}</Num></span>{s.reserved > 0 && <span>{t('dash.reserved')}{t('common.colon')}<Num>{money(s.reserved)}</Num></span>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2"><LinkButton href="/client/withdraw/" variant="gold">{t('cn.withdraw')}</LinkButton><LinkButton href="/client/history/" variant="secondary" className="!border-white/20 !bg-white/10 !text-white">{t('cn.history')}</LinkButton></div>
        <p className="mt-4 text-xs text-emerald-100/60">{t('dash.balance_note')}</p>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('dash.outstanding')} value={money(s.outstanding)} />
        <Stat label={t('dash.next_due')} value={s.next_due ? money(s.next_due.amount) : '—'} hint={s.next_due ? date(s.next_due.date) : t('dash.no_due')} tone="gold" />
        <Stat label={t('dash.repaid')} value={money(s.repaid_total)} />
        <Stat label={t('dash.open_apps')} value={<Num>{s.open_applications}</Num>} />
      </div>
      {active.length > 0 && (
        <Card className="mt-6">
          <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
            <Ring value={s.repaid_total} max={s.repaid_total + s.outstanding} label={t('viz.repaid_share')}
              sub={<>{t('viz.repaid_of', { paid: money(s.repaid_total), total: money(s.repaid_total + s.outstanding) })}{payoff && <><br />{t('viz.payoff', { date: date(payoff) })}</>}</>} />
            <ScheduleBars title={t('viz.schedule_title', { ref: app!.reference })} items={active.map(i => ({ seq: i.seq, due: Number(i.amount_due), paid: Number(i.amount_paid), date: i.due_date }))} />
          </div>
        </Card>)}
      {active.length === 0 && !app && (
        <Card className="mt-6"><div className="flex flex-wrap items-center gap-5">
          <Character who="aisha" mood="happy" prop="phone" wave className="h-40 w-auto" title={t('chars.aisha')} />
          <div className="max-w-md"><p className="text-lg font-extrabold">{t('dash.empty_t')}</p><p className="mt-1 text-sm text-ink-muted">{t('dash.empty_b')}</p><LinkButton href="/client/apply/" className="mt-3">{t('cn.apply')}</LinkButton></div>
        </div></Card>)}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('dash.last_app')}</h2>
          {app ? (
            <Link href={`/client/applications/?id=${app.id}`} className="block rounded-xl border border-line p-4 transition hover:border-emerald-300 dark:border-white/10">
              <div className="flex items-center justify-between gap-3"><Num>{app.reference}</Num><Badge status={app.status} /></div>
              <p className="mt-2 text-2xl font-black"><Num>{money(app.approved_amount ?? app.requested_amount)}</Num></p>
              <p className="text-sm text-ink-muted">{t('sim.months', { n: app.approved_term ?? app.requested_term })} · {date(app.created_at)}</p>
            </Link>) : <p className="text-ink-muted">{t('dash.no_app')}</p>}
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{t('cn.notifications')}</h2>{s.unread > 0 && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-xs font-black text-emerald-950">{s.unread}</span>}</div>
          {notes.length ? <ul className="space-y-3">{notes.map(n => { const r = renderNotification(n, lang); return (
            <li key={n.id} className="border-b border-line pb-3 last:border-0 dark:border-white/10"><p className={'text-sm ' + (n.read_at ? '' : 'font-extrabold')}>{r.title}</p><p className="text-sm text-ink-muted">{r.body}</p></li>); })}</ul>
            : <p className="text-ink-muted">{t('notif.empty')}</p>}
          <Link href="/client/notifications/" className="mt-3 inline-block text-sm font-bold text-emerald-700">{t('common.see_all')}</Link>
        </Card>
      </div>
    </>
  );
}
