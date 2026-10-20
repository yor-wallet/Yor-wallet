'use client';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import type { Application, Installment, Repayment } from '@/lib/types';
import { Alert, Card, Empty, ErrorBox, Loading, Num, PageHeader, Table, Td, must, useLoad } from '@/components/ui';
import { fullName, profilesFor } from '@/components/admin';

export default function Repayments() {
  const { t, money, date } = useI18n();
  const { data, error, loading, reload } = useLoad(async () => {
    const [reps, apps, inst] = await Promise.all([
      must(supabase!.from('sulfa_repayments').select('*').order('recorded_at', { ascending: false }).limit(300)),
      must(supabase!.from('sulfa_applications').select('*').eq('status', 'DISBURSED').order('disbursed_at')),
      must(supabase!.from('sulfa_installments').select('*').neq('status', 'PAID').order('due_date')),
    ]) as [Repayment[], Application[], Installment[]];
    const people = await profilesFor([...reps.map(r => r.user_id), ...apps.map(a => a.user_id)]);
    return { reps, apps, inst, people };
  }, []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { reps, apps, inst, people } = data!;
  const today = new Date().toISOString().slice(0, 10);
  const due = (id: string) => inst.filter(i => i.application_id === id);
  return (
    <>
      <PageHeader title={t('an.repayments')} sub={t('adm.rep_sub')} />
      <div className="mb-6"><Alert tone="info">{t('adm.rep_how')}</Alert></div>
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">{t('adm.rep_active')}</h2>
        {apps.length === 0 ? <Empty title={t('adm.rep_none_active')} /> : (
          <Table head={[t('common.reference'), t('adm.client'), t('inst.left'), t('dash.next_due'), '']}>
            {apps.map(a => { const d = due(a.id); const left = d.reduce((s, i) => s + i.amount_due - i.amount_paid, 0); const next = d[0]; const late = next && next.due_date < today; return (
              <tr key={a.id}><Td><Num>{a.reference}</Num></Td><Td>{fullName(people[a.user_id])}</Td><Td><Num>{money(left)}</Num></Td>
                <Td>{next ? <span className={late ? 'font-bold text-red-700' : ''}>{date(next.due_date)} · <Num>{money(next.amount_due - next.amount_paid)}</Num>{late && ' · ' + t('inst.late')}</span> : '—'}</Td>
                <Td><Link className="font-bold text-emerald-700" href={`/admin/applications/?id=${a.id}`}>{t('adm.repay_btn')}</Link></Td></tr>); })}
          </Table>)}
      </Card>
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-extrabold">{t('adm.rep_recorded')}</h2>
        {reps.length === 0 ? <Empty title={t('inst.no_rep')} /> : (
          <Table head={[t('common.reference'), t('adm.client'), t('common.amount'), t('dlg.reference'), t('common.date')]}>
            {reps.map(r => <tr key={r.id}><Td><Link className="font-bold text-emerald-700" href={`/admin/receipt/?tx=${r.tx_id}`}><Num>{r.reference}</Num></Link></Td><Td>{fullName(people[r.user_id])}</Td><Td><Num>{money(r.amount)}</Num></Td><Td><Num>{r.internal_reference}</Num></Td><Td>{date(r.recorded_at, true)}</Td></tr>)}
          </Table>)}
      </Card>
    </>
  );
}
