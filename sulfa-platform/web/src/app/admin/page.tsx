'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Card, Dialog, ErrorBox, Loading, Num, PageHeader, Stat, useLoad, type DialogSpec } from '@/components/ui';
import { DECIDERS, rpc, useCan } from '@/components/admin';
import { HBars } from '@/components/charts';
import { Portrait } from '@/components/portraits';

type Overview = { reference_capital: number; cash_available: number; capital_recorded: number; receivables: number; fee_income: number; client_balances: number; reserved: number;
  clients: number; applications: Record<string, number>; approved_amount: number; disbursed_amount: number; repaid_amount: number; pending_requested: number;
  withdrawn_amount: number; withdrawals_open: number; documents_pending: number; operators_enabled: number };

export default function Overview() {
  const { t, money } = useI18n(); const can = useCan();
  const [dlg, setDlg] = useState<DialogSpec | null>(null); const [sent, setSent] = useState<number | null>(null);
  const { data, error, loading, reload } = useLoad(() => rpc<Overview>('sulfa_admin_overview', {}), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const o = data!;
  const free = o.cash_available - o.client_balances;                         // cash not already owed to clients
  const remind = () => setDlg({ title: t('ov.remind_t'), body: t('ov.remind_b'), confirm: t('ov.remind_btn'), amount: { label: t('ov.remind_days') },
    run: async ({ amount }) => { setSent(await rpc<number>('sulfa_admin_send_due_reminders', { p_days: Math.round(Number(amount)) })); reload(); } });
  const waiting = (o.applications.SUBMITTED ?? 0) + (o.applications.IN_REVIEW ?? 0) + (o.applications.DOCUMENTS_REQUIRED ?? 0);
  return (
    <>
      <PageHeader title={t('an.overview')} sub={t('ov.sub')} actions={<><Button variant="secondary" onClick={reload}>{t('common.refresh')}</Button>{can(DECIDERS) && <Button variant="gold" onClick={remind}>{t('ov.remind_btn')}</Button>}</>} />
      {sent != null && <div className="mb-4"><Alert tone="success">{t('ov.remind_done', { n: sent })}</Alert></div>}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-gold-300/60 bg-gradient-to-br from-gold-100 to-white p-6 dark:from-gold-500/10 dark:to-transparent">
          <p className="text-sm font-bold text-gold-600">{t('ov.reference_capital')}</p>
          <p className="mt-1 text-4xl font-black text-emerald-950 dark:text-white"><Num>{money(o.reference_capital)}</Num></p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft dark:text-emerald-50/80">{t('ov.reference_note')}</p>
        </div>
        <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-700 to-emerald-950 p-6 text-white shadow-lift">
          <p className="text-sm font-bold text-emerald-100/80">{t('ov.cash')}</p>
          <p className="mt-1 text-4xl font-black"><Num>{money(o.cash_available)}</Num></p>
          <p className="mt-3 text-sm text-emerald-100/80">{t('ov.free', { amount: money(free) })}</p>
          <p className="mt-1 text-xs text-emerald-100/60">{t('ov.cash_note')}</p>
        </div>
      </section>
      {o.cash_available === 0 && <div className="mt-4"><Alert tone="warn" title={t('ov.no_cash_t')}>{t('ov.no_cash_b')} <Link className="font-bold underline" href="/admin/ledger/">{t('an.ledger')}</Link></Alert></div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('ov.capital_recorded')} value={money(o.capital_recorded)} />
        <Stat label={t('ov.receivables')} value={money(o.receivables)} />
        <Stat label={t('ov.fee_income')} value={money(o.fee_income)} />
        <Stat label={t('ov.client_balances')} value={money(o.client_balances)} hint={t('ov.reserved', { amount: money(o.reserved) })} />
        <Stat label={t('ov.disbursed')} value={money(o.disbursed_amount)} tone="emerald" />
        <Stat label={t('ov.repaid')} value={money(o.repaid_amount)} tone="emerald" />
        <Stat label={t('ov.withdrawn')} value={money(o.withdrawn_amount)} />
        <Stat label={t('ov.pending_requested')} value={money(o.pending_requested)} tone="gold" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([['/admin/applications/', 'ov.to_review', waiting], ['/admin/documents/', 'ov.docs_pending', o.documents_pending], ['/admin/withdrawals/', 'ov.wd_open', o.withdrawals_open], ['/admin/clients/', 'an.clients', o.clients]] as const).map(([h, k, n]) => (
          <Link key={h} href={h} className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-emerald-300 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-ink-muted">{t(k)}</p><p className="mt-1 text-3xl font-black"><Num>{n}</Num></p></Link>))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><HBars title={t('viz.funds_title')} format={v => money(v)} rows={[
          { label: t('ov.cash'), value: Number(o.cash_available) }, { label: t('ov.client_balances'), value: Number(o.client_balances) },
          { label: t('viz.free'), value: Math.max(0, free) }, { label: t('ov.receivables'), value: Number(o.receivables) }, { label: t('ov.fee_income'), value: Number(o.fee_income) }]} />
          <p className="mt-3 text-xs text-ink-muted">{t('viz.funds_note')}</p></Card>
        <Card><HBars title={t('viz.funnel_title')} color="var(--series-2)" rows={['SUBMITTED', 'IN_REVIEW', 'DOCUMENTS_REQUIRED', 'APPROVED', 'DISBURSEMENT_PENDING', 'DISBURSED', 'COMPLETED', 'REJECTED', 'CANCELLED']
          .map(st => ({ label: t('st.' + st), value: Number(o.applications[st] ?? 0) }))} />
          {Object.keys(o.applications).length === 0 && <div className="mt-3 flex items-center gap-3"><span className="h-14 w-14 shrink-0 overflow-hidden rounded-full"><Portrait who="maryam" title={t('chars.maryam')} /></span><p className="text-sm text-ink-muted">{t('viz.funnel_empty')}</p></div>}</Card>
      </div>
      <Card className="mt-6"><h2 className="mb-3 text-lg font-extrabold">{t('ov.by_status')}</h2>
        <div className="flex flex-wrap gap-2">{Object.entries(o.applications).map(([s, n]) => <Link key={s} href={`/admin/applications/?status=${s}`} className="rounded-full border border-line px-3 py-1.5 text-sm dark:border-white/10">{t('st.' + s)} · <b><Num>{n}</Num></b></Link>)}
          {Object.keys(o.applications).length === 0 && <p className="text-ink-muted">{t('ov.no_apps')}</p>}</div>
        <p className="mt-4 text-xs text-ink-muted">{t('ov.operators', { n: o.operators_enabled })}</p>
      </Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
