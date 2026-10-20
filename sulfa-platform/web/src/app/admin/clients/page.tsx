'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import type { Application, Profile, Withdrawal } from '@/lib/types';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Input, Loading, Num, PageHeader, Stat, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { DECIDERS, fullName, rpc, useCan } from '@/components/admin';

function Detail({ id }: { id: string }) {
  const { t, money, date } = useI18n(); const can = useCan();
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [p, apps, wds, bal] = await Promise.all([
      must(supabase!.from('sulfa_profiles').select('*').eq('user_id', id).single()),
      must(supabase!.from('sulfa_applications').select('*').eq('user_id', id).order('created_at', { ascending: false })),
      must(supabase!.from('sulfa_withdrawals').select('*').eq('user_id', id).order('created_at', { ascending: false })),
      rpc<{ code: string; balance: number }[]>('sulfa_admin_account_balances', {}),
    ]);
    return { p: p as Profile, apps: apps as Application[], wds: wds as Withdrawal[], balance: bal.find(b => b.code === 'CLIENT:' + id)?.balance ?? 0 };
  }, [id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { p, apps, wds, balance } = data!;
  const setStatus = (s: string) => setDlg({ title: t('adm.status_t', { s: t('st.' + s) }), body: t('adm.status_b', { name: fullName(p) }), confirm: t('common.confirm'), tone: s === 'ACTIVE' ? 'primary' : 'danger', reason: 'required',
    run: async ({ reason }) => { await rpc('sulfa_admin_set_account_status', { p_user: id, p_status: s, p_reason: reason }); reload(); } });
  return (
    <>
      <PageHeader title={fullName(p)} sub={`${p.email ?? ''} · ${p.phone ?? ''}`} actions={<Link href="/admin/clients/" className="font-bold text-emerald-700">← {t('common.back')}</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('dash.balance')} value={money(balance)} tone="emerald" />
        <Stat label={t('doc.identity')} value={<Badge status={p.identity_status} group="id" />} />
        <Stat label={t('set.status')} value={<Badge status={p.account_status} />} />
      </div>
      <Card className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {([['f.nationality', t('country.' + (['OM', 'AE', 'SA', 'KW', 'QA', 'BH'].includes(p.nationality) ? p.nationality : 'OTHER'))], ['f.dob', date(p.date_of_birth)], ['f.gender', p.gender ? t(p.gender === 'M' ? 'f.gender_m' : 'f.gender_f') : '—'],
            ['set.language', p.preferred_language.toUpperCase()], ['set.member_since', date(p.created_at)], ['adm.terms_at', date(p.terms_accepted_at, true)]] as const).map(([k, v]) => <div key={k}><dt className="text-ink-muted">{t(k)}</dt><dd className="font-bold">{v}</dd></div>)}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 dark:border-white/10">
          <Link className="self-center font-bold text-emerald-700" href={`/admin/documents/?user=${id}&status=ALL`}>{t('an.documents')}</Link>
          {can(DECIDERS) && <span className="ms-auto flex gap-2">{p.account_status !== 'ACTIVE' && <Button onClick={() => setStatus('ACTIVE')}>{t('adm.reactivate')}</Button>}
            {p.account_status === 'ACTIVE' && <Button variant="danger" onClick={() => setStatus('SUSPENDED')}>{t('adm.suspend')}</Button>}
            {p.account_status !== 'CLOSED' && <Button variant="secondary" onClick={() => setStatus('CLOSED')}>{t('adm.close')}</Button>}</span>}
        </div>
      </Card>
      <Card className="mt-6"><h2 className="mb-4 text-lg font-extrabold">{t('an.applications')}</h2>
        {apps.length === 0 ? <Empty title={t('dash.no_app')} /> : <Table head={[t('common.reference'), t('common.amount'), t('common.date'), t('common.status')]}>
          {apps.map(a => <tr key={a.id}><Td><Link className="font-bold text-emerald-700" href={`/admin/applications/?id=${a.id}`}><Num>{a.reference}</Num></Link></Td><Td><Num>{money(a.approved_amount ?? a.requested_amount)}</Num></Td><Td>{date(a.created_at)}</Td><Td><Badge status={a.status} /></Td></tr>)}
        </Table>}</Card>
      <Card className="mt-6"><h2 className="mb-4 text-lg font-extrabold">{t('an.withdrawals')}</h2>
        {wds.length === 0 ? <Empty title={t('wd.none')} /> : <Table head={[t('common.reference'), t('common.amount'), t('common.date'), t('common.status')]}>
          {wds.map(w => <tr key={w.id}><Td><Num>{w.reference}</Num></Td><Td><Num>{money(w.amount)}</Num></Td><Td>{date(w.created_at)}</Td><Td><Badge status={w.status} group="wst" /></Td></tr>)}
        </Table>}</Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}

function List() {
  const { t, date } = useI18n(); const [q, setQ] = useState('');
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_profiles').select('*').order('created_at', { ascending: false }).limit(1000)), []);
  const s = q.trim().toLowerCase();
  const rows = ((data ?? []) as Profile[]).filter(p => !s || `${p.first_name} ${p.last_name} ${p.email ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(s));
  return (
    <>
      <PageHeader title={t('an.clients')} sub={t('adm.clients_sub')} />
      <Card>
        <Input className="mb-4" placeholder={t('adm.search_client')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('adm.search_client')} />
        {loading && !data ? <Loading /> : error ? <ErrorBox failure={error} onRetry={reload} /> : rows.length === 0 ? <Empty title={t('adm.no_clients')} /> : (
          <Table head={[t('adm.client'), t('auth.email'), t('doc.identity'), t('set.status'), t('set.member_since')]}>
            {rows.map(p => <tr key={p.user_id}><Td><Link className="font-bold text-emerald-700" href={`/admin/clients/?id=${p.user_id}`}>{fullName(p)}</Link></Td><Td><span dir="ltr">{p.email}</span></Td>
              <Td><Badge status={p.identity_status} group="id" /></Td><Td><Badge status={p.account_status} /></Td><Td>{date(p.created_at)}</Td></tr>)}
          </Table>)}
      </Card>
    </>
  );
}
function Router() { const q = useSearchParams(); const id = q.get('id'); return id ? <Detail id={id} /> : <List />; }
export default function Page() { return <Suspense><Router /></Suspense>; }
