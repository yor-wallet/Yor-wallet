'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useIdempotencyKey } from '@/lib/idem';
import { isAmount } from '@/lib/validate';
import type { AppEvent, Application, Installment, QuoteJson, Repayment } from '@/lib/types';
import { Timeline } from '@/components/timeline';
import { Alert, Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Num, PageHeader, Select, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { DECIDERS, fullName, profilesFor, rpc, useCan } from '@/components/admin';

const STATUSES = ['SUBMITTED', 'IN_REVIEW', 'DOCUMENTS_REQUIRED', 'APPROVED', 'DISBURSEMENT_PENDING', 'DISBURSED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const OPEN = ['SUBMITTED', 'IN_REVIEW', 'DOCUMENTS_REQUIRED'];

function ApproveExtra({ app, onQuote }: { app: Application; onQuote: (a: string, n: string) => void }) {
  const { t, money } = useI18n();
  const [amount, setAmount] = useState(String(app.requested_amount)); const [term, setTerm] = useState(String(app.requested_term));
  const [q, setQ] = useState<QuoteJson | null>(app.quote); const [err, setErr] = useState('');
  const check = async () => {
    setErr('');
    const { data, error } = await supabase!.rpc('sulfa_quote', { p_amount: Number(amount), p_term: Number(term) });
    if (error) { setQ(null); setErr(t('err.' + (/sulfa_[a-z_]+/.exec(error.message)?.[0] ?? 'unknown'))); } else { setQ(data as QuoteJson); onQuote(amount, term); }
  };
  return (
    <div className="space-y-3 rounded-xl bg-emerald-50 p-4 dark:bg-white/5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('adm.approved_amount')}><Input dir="ltr" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setQ(null); onQuote('', ''); }} /></Field>
        <Field label={t('sim.term')}><Input dir="ltr" inputMode="numeric" value={term} onChange={e => { setTerm(e.target.value); setQ(null); onQuote('', ''); }} /></Field>
      </div>
      <Button variant="secondary" onClick={check}>{t('adm.recompute')}</Button>
      {err && <p className="text-sm font-bold text-red-700">{err}</p>}
      {q && <p className="text-sm">{t('sim.total')} <b><Num>{money(q.total)}</Num></b> · {t('sim.monthly')} <b><Num>{money(q.monthly)}</Num></b> · {t('sim.fee')} <Num>{money(q.fee)}</Num> · {t('sim.interest')} <Num>{money(q.interest)}</Num></p>}
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const { t, money, date } = useI18n(); const can = useCan();
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const [disbKey, renewDisb] = useIdempotencyKey('disb');                  // kept until the server confirms: a retry can never post twice
  const [repKey, renewRep] = useIdempotencyKey('rep');
  const { data, error, loading, reload } = useLoad(async () => {
    const a = await must(supabase!.from('sulfa_applications').select('*').eq('id', id).single()) as Application;
    const [ev, inst, reps, docs, people] = await Promise.all([
      must(supabase!.from('sulfa_application_events').select('*').eq('application_id', id).order('id')),
      must(supabase!.from('sulfa_installments').select('*').eq('application_id', id).order('seq')),
      must(supabase!.from('sulfa_repayments').select('*').eq('application_id', id).order('recorded_at', { ascending: false })),
      must(supabase!.from('sulfa_documents').select('id, document_type, status').eq('user_id', a.user_id).neq('status', 'REPLACED')),
      profilesFor([a.user_id]),
    ]);
    return { a, ev: ev as AppEvent[], inst: inst as Installment[], reps: reps as Repayment[], docs: docs as { id: string; document_type: string; status: string }[], p: people[a.user_id] };
  }, [id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { a, ev, inst, reps, docs, p } = data!;
  const outstanding = inst.reduce((s, i) => s + (i.amount_due - i.amount_paid), 0);
  const decide = (action: string, tone: DialogSpec['tone'], reason: DialogSpec['reason']) => {
    let adj = { amount: '', term: '' };
    setDlg({
      title: t('adm.act.' + action), confirm: t('adm.act.' + action), tone, reason,
      body: action === 'APPROVE' ? (p?.identity_status !== 'VERIFIED' ? <Alert tone="error">{t('err.sulfa_identity_not_verified')}</Alert> : t('adm.approve_b')) : t('adm.decide_b', { ref: a.reference }),
      extra: action === 'APPROVE' ? <ApproveExtra app={a} onQuote={(x, n) => { adj = { amount: x, term: n }; }} /> : undefined,
      run: async ({ reason: r }) => {
        await rpc('sulfa_admin_decide_application', { p_id: a.id, p_action: action, p_reason: r || null, p_amount: adj.amount ? Number(adj.amount) : null, p_term: adj.term ? Number(adj.term) : null });
        reload();
      },
    });
  };
  const prepare = () => setDlg({ title: t('adm.prepare_t'), body: t('adm.prepare_b'), confirm: t('adm.prepare_btn'),
    run: async () => { await rpc('sulfa_admin_disbursement', { p_id: a.id, p_action: 'PREPARE', p_internal_ref: null, p_idempotency_key: null }); reload(); } });
  const confirmDisb = () => setDlg({ title: t('adm.confirm_t'), confirm: t('adm.confirm_btn'), tone: 'gold', reference: 'required',
    body: <>{t('adm.confirm_b', { amount: money(a.approved_amount), ref: a.reference })}<p className="mt-2 font-bold">{t('adm.confirm_warn')}</p></>,
    run: async ({ reference }) => { await rpc('sulfa_admin_disbursement', { p_id: a.id, p_action: 'CONFIRM', p_internal_ref: reference, p_idempotency_key: disbKey() }); renewDisb(); reload(); } });
  const repay = () => setDlg({ title: t('adm.repay_t'), confirm: t('adm.repay_btn'), reference: 'required', amount: { label: t('adm.repay_amount', { max: money(outstanding) }), max: outstanding },
    body: t('adm.repay_b'),
    run: async ({ reference, amount }) => {
      if (!isAmount(amount)) throw { message: 'sulfa_invalid_amount', code: '22023' };
      await rpc('sulfa_admin_record_repayment', { p_application: a.id, p_amount: Number(amount), p_internal_ref: reference, p_idempotency_key: repKey() }); renewRep(); reload();
    } });
  const q = a.approved_quote ?? a.quote;
  const decider = can(DECIDERS);
  return (
    <>
      <PageHeader title={a.reference} sub={`${fullName(p)} · ${date(a.created_at, true)}`} actions={<Link href="/admin/applications/" className="font-bold text-emerald-700">← {t('common.back')}</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">{t('app.summary')}</h2><Badge status={a.status} /></div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-ink-muted">{t('app.requested')}</dt><dd className="font-extrabold"><Num>{money(a.requested_amount)}</Num> · {t('sim.months', { n: a.requested_term })}</dd></div>
              {a.approved_amount != null && <div><dt className="text-xs text-ink-muted">{t('app.approved')}</dt><dd className="font-extrabold text-emerald-700"><Num>{money(a.approved_amount)}</Num> · {t('sim.months', { n: a.approved_term })}</dd></div>}
              {([['sim.fee', q.fee], ['sim.interest', q.interest], ['sim.total', q.total], ['sim.monthly', q.monthly]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-ink-muted">{t(k)}</dt><dd className="font-bold"><Num>{money(v)}</Num></dd></div>)}
            </dl>
            {a.decision_reason && <p className="mt-4 text-sm"><b>{t('app.admin_reason')}{t('common.colon')}</b> {a.decision_reason}</p>}
            {decider ? (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4 dark:border-white/10">
                {a.status === 'SUBMITTED' && <Button variant="secondary" onClick={() => decide('IN_REVIEW', 'primary', 'optional')}>{t('adm.act.IN_REVIEW')}</Button>}
                {OPEN.includes(a.status) && a.status !== 'DOCUMENTS_REQUIRED' && <Button variant="secondary" onClick={() => decide('REQUEST_DOCUMENTS', 'primary', 'required')}>{t('adm.act.REQUEST_DOCUMENTS')}</Button>}
                {OPEN.includes(a.status) && <Button onClick={() => decide('APPROVE', 'primary', 'optional')}>{t('adm.act.APPROVE')}</Button>}
                {OPEN.includes(a.status) && <Button variant="danger" onClick={() => decide('REJECT', 'danger', 'required')}>{t('adm.act.REJECT')}</Button>}
                {a.status === 'APPROVED' && <Button onClick={prepare}>{t('adm.prepare_btn')}</Button>}
                {a.status === 'DISBURSEMENT_PENDING' && <Button variant="gold" onClick={confirmDisb}>{t('adm.confirm_btn')}</Button>}
                {a.status === 'DISBURSED' && outstanding > 0 && <Button variant="gold" onClick={repay}>{t('adm.repay_btn')}</Button>}
                {a.disbursement_tx_id && <Link className="self-center font-bold text-emerald-700" href={`/admin/receipt/?tx=${a.disbursement_tx_id}`}>{t('rc.view')}</Link>}
              </div>) : <p className="mt-4 text-sm text-ink-muted">{t('adm.reviewer_readonly')}</p>}
          </Card>
          {inst.length > 0 && <Card><h2 className="mb-4 text-lg font-extrabold">{t('cn.installments')} · {t('inst.left')} <Num>{money(outstanding)}</Num></h2>
            <Table head={['#', t('inst.due_date'), t('inst.due'), t('inst.paid'), t('common.status')]}>
              {inst.map(i => <tr key={i.id}><Td><Num>{i.seq}</Num></Td><Td>{date(i.due_date)}</Td><Td><Num>{money(i.amount_due)}</Num></Td><Td><Num>{money(i.amount_paid)}</Num></Td><Td><Badge status={i.status} /></Td></tr>)}
            </Table></Card>}
          {reps.length > 0 && <Card><h2 className="mb-4 text-lg font-extrabold">{t('inst.repayments')}</h2>
            <Table head={[t('common.reference'), t('common.amount'), t('dlg.reference'), t('common.date')]}>
              {reps.map(r => <tr key={r.id}><Td><Link className="font-bold text-emerald-700" href={`/admin/receipt/?tx=${r.tx_id}`}><Num>{r.reference}</Num></Link></Td><Td><Num>{money(r.amount)}</Num></Td><Td><Num>{r.internal_reference}</Num></Td><Td>{date(r.recorded_at, true)}</Td></tr>)}
            </Table></Card>}
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-extrabold">{t('adm.client')}</h2>
            <p className="font-bold">{fullName(p)}</p><p className="text-sm text-ink-muted" dir="ltr">{p?.email} · {p?.phone}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Badge status={p?.identity_status ?? 'NOT_SUBMITTED'} group="id" />{p && <Badge status={p.account_status} />}</div>
            <ul className="mt-3 space-y-1 text-sm">{docs.map(d => <li key={d.id} className="flex justify-between gap-2"><span>{t('doc.' + d.document_type)}</span><Badge status={d.status} /></li>)}</ul>
            <div className="mt-3 flex gap-4 text-sm font-bold"><Link className="text-emerald-700" href={`/admin/documents/?user=${a.user_id}`}>{t('an.documents')}</Link><Link className="text-emerald-700" href={`/admin/clients/?id=${a.user_id}`}>{t('adm.client_file')}</Link></div>
          </Card>
          <Card><h2 className="mb-4 text-lg font-extrabold">{t('app.timeline')}</h2><Timeline events={ev} /></Card>
        </div>
      </div>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}

function List() {
  const { t, money, date } = useI18n(); const q = useSearchParams(); const router = useRouter();
  const status = q.get('status') ?? 'OPEN';
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useLoad(async () => {
    let query = supabase!.from('sulfa_applications').select('*').order('created_at', { ascending: false }).limit(300);
    if (status === 'OPEN') query = query.in('status', OPEN); else if (status !== 'ALL') query = query.eq('status', status);
    const apps = await must(query) as Application[];
    return { apps, people: await profilesFor(apps.map(a => a.user_id)) };
  }, [status]);
  const s = search.trim().toLowerCase();
  const rows = (data?.apps ?? []).filter(a => !s || a.reference.toLowerCase().includes(s) || fullName(data!.people[a.user_id]).toLowerCase().includes(s));
  return (
    <>
      <PageHeader title={t('an.applications')} sub={t('adm.apps_sub')} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]">
          <Input placeholder={t('adm.search')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('adm.search')} />
          <Select value={status} onChange={e => router.replace(`/admin/applications/?status=${e.target.value}`)} aria-label={t('common.status')}>
            <option value="OPEN">{t('adm.filter_open')}</option><option value="ALL">{t('hist.all')}</option>{STATUSES.map(x => <option key={x} value={x}>{t('st.' + x)}</option>)}
          </Select>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorBox failure={error} onRetry={reload} /> : rows.length === 0 ? <Empty title={t('adm.no_apps')} /> : (
          <Table head={[t('common.reference'), t('adm.client'), t('common.amount'), t('sim.term'), t('common.date'), t('common.status')]}>
            {rows.map(a => <tr key={a.id}><Td><Link className="font-bold text-emerald-700" href={`/admin/applications/?id=${a.id}`}><Num>{a.reference}</Num></Link></Td><Td>{fullName(data!.people[a.user_id])}</Td>
              <Td><Num>{money(a.approved_amount ?? a.requested_amount)}</Num></Td><Td>{t('sim.months', { n: a.approved_term ?? a.requested_term })}</Td><Td>{date(a.created_at)}</Td><Td><Badge status={a.status} /></Td></tr>)}
          </Table>)}
      </Card>
    </>
  );
}

function Router() { const q = useSearchParams(); const id = q.get('id'); return id ? <Detail id={id} /> : <List />; }
export default function Page() { return <Suspense><Router /></Suspense>; }
