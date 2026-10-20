'use client';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Installment, Repayment, Application } from '@/lib/types';
import { Img3D } from '@/components/img3d';
import { Alert, Badge, Card, Empty, ErrorBox, Loading, Num, PageHeader, Table, Td, must, useLoad } from '@/components/ui';

export default function Installments() {
  const { t, money, date } = useI18n(); const { session } = useAuth(); const uid = session!.user.id;
  const { data, error, loading, reload } = useLoad(async () => {
    const [inst, reps, apps] = await Promise.all([
      must(supabase!.from('sulfa_installments').select('*').eq('user_id', uid).order('due_date')),
      must(supabase!.from('sulfa_repayments').select('*').eq('user_id', uid).order('recorded_at', { ascending: false })),
      must(supabase!.from('sulfa_applications').select('id, reference').eq('user_id', uid)),
    ]);
    return { inst: inst as Installment[], reps: reps as Repayment[], ref: Object.fromEntries((apps as Pick<Application, 'id' | 'reference'>[]).map(a => [a.id, a.reference])) };
  }, [uid]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { inst, reps, ref } = data!;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={t('cn.installments')} sub={t('inst.sub')} />
      <div className="mb-6"><Alert tone="info" title={t('inst.how_t')}>{t('inst.how_b')}</Alert></div>
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">{t('inst.schedule')}</h2>
        {inst.length === 0 ? <Empty title={t('inst.none')} art={<Img3D name="calendar" className="mx-auto -mt-4 mb-1 w-40" />} /> : (
          <Table head={[t('common.reference'), '#', t('inst.due_date'), t('inst.due'), t('inst.paid'), t('inst.left'), t('common.status')]}>
            {inst.map(i => { const late = i.status !== 'PAID' && i.due_date < today; return (
              <tr key={i.id} className={late ? 'bg-red-50/60 dark:bg-red-500/5' : ''}><Td><Num>{ref[i.application_id]}</Num></Td><Td><Num>{i.seq}</Num></Td><Td>{date(i.due_date)}{late && <span className="ms-2 text-xs font-bold text-red-700">{t('inst.late')}</span>}</Td>
                <Td><Num>{money(i.amount_due)}</Num></Td><Td><Num>{money(i.amount_paid)}</Num></Td><Td><Num>{money(i.amount_due - i.amount_paid)}</Num></Td><Td><Badge status={i.status} /></Td></tr>); })}
          </Table>)}
      </Card>
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-extrabold">{t('inst.repayments')}</h2>
        {reps.length === 0 ? <Empty title={t('inst.no_rep')} /> : (
          <Table head={[t('common.reference'), t('common.application'), t('common.amount'), t('common.date'), '']}>
            {reps.map(r => <tr key={r.id}><Td><Num>{r.reference}</Num></Td><Td><Num>{ref[r.application_id]}</Num></Td><Td><Num>{money(r.amount)}</Num></Td><Td>{date(r.recorded_at, true)}</Td>
              <Td><Link className="font-bold text-emerald-700" href={`/client/receipt/?tx=${r.tx_id}`}>{t('rc.view')}</Link></Td></tr>)}
          </Table>)}
      </Card>
    </>
  );
}
