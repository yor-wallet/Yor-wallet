'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Tx } from '@/lib/types';
import { Badge, Card, Empty, ErrorBox, Input, Loading, Num, PageHeader, Select, Table, Td, cx, must, useLoad } from '@/components/ui';

const TYPES = ['DISBURSEMENT', 'REPAYMENT', 'WITHDRAWAL', 'REVERSAL'];
/** + for money credited to the client's balance, − for money leaving it; a repayment reduces the debt, not the balance */
const SIGN: Record<string, string> = { DISBURSEMENT: '+', WITHDRAWAL: '−', REPAYMENT: '', REVERSAL: '' };

export default function History() {
  const { t, money, date } = useI18n(); const { session } = useAuth();
  const [type, setType] = useState(''); const [q, setQ] = useState('');
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_transactions').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false }).limit(500)), [], { cache: 'hist' });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const rows = (data as Tx[]).filter(x => (!type || x.transaction_type === type) && (!q || x.reference.toLowerCase().includes(q.toLowerCase().trim())));
  return (
    <>
      <PageHeader title={t('cn.history')} sub={t('hist.sub')} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <Input placeholder={t('hist.search')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('hist.search')} />
          <Select value={type} onChange={e => setType(e.target.value)} aria-label={t('rc.type')}><option value="">{t('hist.all')}</option>{TYPES.map(x => <option key={x} value={x}>{t('tx.' + x)}</option>)}</Select>
        </div>
        {rows.length === 0 ? <Empty title={t('hist.none')} /> : (
          <Table head={[t('common.date'), t('rc.type'), t('common.reference'), t('common.amount'), t('common.status'), '']}>
            {rows.map(x => <tr key={x.id}><Td>{date(x.validated_at, true)}</Td><Td>{t('tx.' + x.transaction_type)}</Td><Td><Num>{x.reference}</Num></Td>
              <Td><Num><span className={cx('font-bold', SIGN[x.transaction_type] === '+' && 'text-emerald-700', SIGN[x.transaction_type] === '−' && 'text-red-700')}>{SIGN[x.transaction_type]}{money(x.amount)}</span></Num></Td>
              <Td><Badge status={x.status} /></Td><Td><Link className="text-sm font-bold text-emerald-700" href={`/client/receipt/?tx=${x.id}`}>{t('rc.view')}</Link></Td></tr>)}
          </Table>)}
      </Card>
    </>
  );
}
