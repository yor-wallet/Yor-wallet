'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { AppEvent, Application, Installment } from '@/lib/types';
import { Timeline } from '@/components/timeline';
import { Alert, Badge, Button, Card, Dialog, Empty, ErrorBox, LinkButton, Loading, Num, PageHeader, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';

const CANCELLABLE = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'DOCUMENTS_REQUIRED'];

function Detail({ id, isNew }: { id: string; isNew: boolean }) {
  const { t, money, date } = useI18n();
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [a, ev, inst] = await Promise.all([
      must(supabase!.from('sulfa_applications').select('*').eq('id', id).single()),
      must(supabase!.from('sulfa_application_events').select('*').eq('application_id', id).order('id')),
      must(supabase!.from('sulfa_installments').select('*').eq('application_id', id).order('seq')),
    ]);
    return { a: a as Application, ev: ev as AppEvent[], inst: inst as Installment[] };
  }, [id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { a, ev, inst } = data!;
  const q = a.approved_quote ?? a.quote;
  const cancel = () => setDlg({ title: t('app.cancel_t'), body: t('app.cancel_b', { ref: a.reference }), confirm: t('app.cancel_btn'), tone: 'danger',
    run: async () => { await must(supabase!.rpc('sulfa_cancel_application', { p_id: a.id })); reload(); } });
  return (
    <>
      <PageHeader title={a.reference} sub={t('app.submitted_on', { date: date(a.created_at, true) })}
        actions={<><LinkButton href={`/client/receipt/?app=${a.id}`} variant="secondary">{t('rc.view')}</LinkButton>{CANCELLABLE.includes(a.status) && <Button variant="secondary" onClick={cancel}>{t('app.cancel_btn')}</Button>}</>} />
      {isNew && <div className="mb-6"><Alert tone="success" title={t('app.new_t')}>{t('app.new_b')}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">{t('app.summary')}</h2><Badge status={a.status} /></div>
          {a.decision_reason && ['REJECTED', 'DOCUMENTS_REQUIRED'].includes(a.status) && <div className="mt-4"><Alert tone={a.status === 'REJECTED' ? 'error' : 'warn'} title={t('app.admin_reason')}>{a.decision_reason}</Alert></div>}
          {a.status === 'DOCUMENTS_REQUIRED' && <Link href="/client/documents/" className="mt-3 inline-block font-bold text-emerald-700 underline">{t('dash.id_cta')}</Link>}
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-muted">{t('app.requested')}</dt><dd className="font-extrabold"><Num>{money(a.requested_amount)}</Num> · {t('sim.months', { n: a.requested_term })}</dd></div>
            {a.approved_amount != null && <div><dt className="text-xs text-ink-muted">{t('app.approved')}</dt><dd className="font-extrabold text-emerald-700"><Num>{money(a.approved_amount)}</Num> · {t('sim.months', { n: a.approved_term })}</dd></div>}
            {([['sim.fee', q.fee], ['sim.interest', q.interest], ['sim.total', q.total], ['sim.monthly', q.monthly]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-ink-muted">{t(k)}</dt><dd className="font-bold"><Num>{money(v)}</Num></dd></div>)}
          </dl>
          <p className="mt-4 text-xs text-ink-muted">{a.approved_quote ? t('app.quote_approved') : t('app.quote_requested')}</p>
          {a.status === 'APPROVED' || a.status === 'DISBURSEMENT_PENDING' ? <div className="mt-4"><Alert tone="info">{t('app.approved_not_paid')}</Alert></div> : null}
          {a.disbursed_at && <p className="mt-4 text-sm">{t('app.disbursed_on', { date: date(a.disbursed_at, true) })} {a.disbursement_tx_id && <Link className="font-bold text-emerald-700 underline" href={`/client/receipt/?tx=${a.disbursement_tx_id}`}>{t('rc.view')}</Link>}</p>}
        </Card>
        <Card><h2 className="mb-4 text-lg font-extrabold">{t('app.timeline')}</h2><Timeline events={ev} /></Card>
      </div>
      {inst.length > 0 && (
        <Card className="mt-6"><h2 className="mb-4 text-lg font-extrabold">{t('cn.installments')}</h2>
          <Table head={['#', t('inst.due_date'), t('inst.due'), t('inst.paid'), t('common.status')]}>
            {inst.map(i => <tr key={i.id}><Td><Num>{i.seq}</Num></Td><Td>{date(i.due_date)}</Td><Td><Num>{money(i.amount_due)}</Num></Td><Td><Num>{money(i.amount_paid)}</Num></Td><Td><Badge status={i.status} /></Td></tr>)}
          </Table></Card>)}
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}

function List() {
  const { t, money, date } = useI18n(); const { session } = useAuth();
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_applications').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false })), [], { cache: 'apps' });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const apps = data as Application[];
  return (
    <>
      <PageHeader title={t('cn.applications')} actions={<LinkButton href="/client/apply/">{t('cn.apply')}</LinkButton>} />
      {apps.length === 0 ? <Empty title={t('dash.no_app')}><LinkButton href="/client/apply/" className="mt-3">{t('cn.apply')}</LinkButton></Empty> : (
        <Card><Table head={[t('common.reference'), t('common.amount'), t('sim.term'), t('common.date'), t('common.status')]}>
          {apps.map(a => <tr key={a.id}><Td><Link className="font-bold text-emerald-700" href={`/client/applications/?id=${a.id}`}><Num>{a.reference}</Num></Link></Td>
            <Td><Num>{money(a.approved_amount ?? a.requested_amount)}</Num></Td><Td>{t('sim.months', { n: a.approved_term ?? a.requested_term })}</Td><Td>{date(a.created_at)}</Td><Td><Badge status={a.status} /></Td></tr>)}
        </Table></Card>)}
    </>
  );
}

function Router() { const q = useSearchParams(); const id = q.get('id'); return id ? <Detail id={id} isNew={q.get('new') === '1'} /> : <List />; }
export default function Page() { return <Suspense><Router /></Suspense>; }
