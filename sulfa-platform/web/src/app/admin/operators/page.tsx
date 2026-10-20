'use client';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { Alert, Card, Empty, ErrorBox, Loading, PageHeader, Table, Td, Badge, must, useLoad } from '@/components/ui';

type Op = { id: string; name: string; country: string | null; currencies: string[]; operation_types: string[]; enabled: boolean };

export default function Operators() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_operators').select('*').order('id')), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const ops = data as Op[];
  return (
    <>
      <PageHeader title={t('an.operators')} sub={t('op.sub')} />
      <div className="mb-6"><Alert tone="info" title={t('op.local_t')}>{t('op.local_b')}</Alert></div>
      <Card>
        {ops.length === 0 ? <Empty title={t('op.none')}>{t('op.none_b')}</Empty> : (
          <Table head={['ID', t('op.name'), t('op.types'), t('common.status')]}>
            {ops.map(o => <tr key={o.id}><Td><span className="font-latin">{o.id}</span></Td><Td>{o.name}</Td><Td>{o.operation_types.join(', ')}</Td><Td><Badge status={o.enabled ? 'ACTIVE' : 'CLOSED'} /></Td></tr>)}
          </Table>)}
      </Card>
      <Card className="mt-6"><h2 className="mb-2 text-lg font-extrabold">{t('op.future_t')}</h2><p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft dark:text-emerald-50/80">{t('op.future_b')}</p></Card>
    </>
  );
}
