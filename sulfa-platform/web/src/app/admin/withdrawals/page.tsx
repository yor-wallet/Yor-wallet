'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import type { Withdrawal } from '@/lib/types';
import { Alert, Badge, Button, Card, Dialog, Empty, ErrorBox, Loading, Num, PageHeader, Select, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { DECIDERS, fullName, profilesFor, rpc, useCan } from '@/components/admin';

const NEXT: Record<string, string[]> = { RECEIVED: ['VERIFY', 'PROCESS', 'REJECT'], IN_VERIFICATION: ['PROCESS', 'CONFIRM', 'REJECT'], PROCESSING: ['CONFIRM', 'REJECT', 'FAIL'], CONFIRMED: ['PAY', 'REJECT', 'FAIL'] };
const OPEN = Object.keys(NEXT);

function W() {
  const { t, money, date } = useI18n(); const can = useCan(); const q = useSearchParams(); const router = useRouter();
  const filter = q.get('status') ?? 'OPEN';
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    let query = supabase!.from('sulfa_withdrawals').select('*').order('created_at', { ascending: true }).limit(300);
    if (filter === 'OPEN') query = query.in('status', OPEN); else if (filter !== 'ALL') query = query.eq('status', filter);
    const w = await must(query) as Withdrawal[];
    return { w, people: await profilesFor(w.map(x => x.user_id)) };
  }, [filter]);
  const act = (w: Withdrawal, a: string) => setDlg({
    title: t('adm.wd.' + a), confirm: t('adm.wd.' + a), tone: a === 'PAY' ? 'gold' : ['REJECT', 'FAIL'].includes(a) ? 'danger' : 'primary',
    reason: ['REJECT', 'FAIL'].includes(a) ? 'required' : 'optional', reference: a === 'PAY' ? 'required' : undefined,
    body: <>{t('adm.wd_b', { ref: w.reference, amount: money(w.amount), name: fullName(data?.people[w.user_id]) })}
      <dl className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-white/5"><div>{t('wd.bank')} : <b>{w.bank_name}</b></div><div>{t('wd.holder')} : <b>{w.account_holder}</b></div><div>{t('wd.account')} : <b dir="ltr">{w.bank_account}</b></div></dl>
      {a === 'PAY' && <p className="mt-2 font-bold">{t('adm.pay_warn')}</p>}</>,
    run: async ({ reason, reference }) => { await rpc('sulfa_admin_withdrawal_action', { p_id: w.id, p_action: a, p_reason: reason || null, p_internal_ref: reference || null }); reload(); },
  });
  return (
    <>
      <PageHeader title={t('an.withdrawals')} sub={t('adm.wd_sub')} />
      <div className="mb-4"><Alert tone="info">{t('adm.wd_flow')}</Alert></div>
      <Card>
        <div className="mb-4 max-w-xs"><Select value={filter} aria-label={t('common.status')} onChange={e => router.replace(`/admin/withdrawals/?status=${e.target.value}`)}>
          <option value="OPEN">{t('adm.filter_open')}</option><option value="ALL">{t('hist.all')}</option>{['PAID', 'REJECTED', 'FAILED', 'CANCELLED'].map(s => <option key={s} value={s}>{t('wst.' + s)}</option>)}
        </Select></div>
        {loading && !data ? <Loading /> : error ? <ErrorBox failure={error} onRetry={reload} /> : data!.w.length === 0 ? <Empty title={t('wd.none')} /> : (
          <Table head={[t('common.reference'), t('adm.client'), t('common.amount'), t('common.date'), t('common.status'), t('common.actions')]}>
            {data!.w.map(w => <tr key={w.id}><Td><Num>{w.reference}</Num></Td><Td><Link className="font-bold text-emerald-700" href={`/admin/clients/?id=${w.user_id}`}>{fullName(data!.people[w.user_id])}</Link></Td>
              <Td><Num>{money(w.amount)}</Num></Td><Td>{date(w.created_at, true)}</Td><Td><Badge status={w.status} group="wst" /></Td>
              <Td><div className="flex flex-wrap gap-1.5">{can(DECIDERS) && (NEXT[w.status] ?? []).map(a => <Button key={a} variant={a === 'PAY' ? 'gold' : ['REJECT', 'FAIL'].includes(a) ? 'danger' : 'secondary'} className="!min-h-9 !px-3" onClick={() => act(w, a)}>{t('adm.wd.' + a)}</Button>)}
                {w.tx_id && <Link className="self-center text-sm font-bold text-emerald-700" href={`/admin/receipt/?tx=${w.tx_id}`}>{t('rc.view')}</Link>}</div></Td></tr>)}
          </Table>)}
      </Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
export default function Page() { return <Suspense><W /></Suspense>; }
