'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { Card, Empty, ErrorBox, Input, Loading, PageHeader, Select, Table, Td, Button, must, useLoad } from '@/components/ui';
import { fullName, profilesFor } from '@/components/admin';

type Row = { id: number; actor_id: string | null; actor_role: string; action: string; entity_type: string; entity_id: string | null; reason: string | null; metadata: Record<string, unknown>; created_at: string };
const ENTITIES = ['application', 'document', 'withdrawal', 'repayment', 'transaction', 'profile', 'settings', 'template', 'admin', 'installment'];

export default function Audit() {
  const { t, date } = useI18n();
  const [entity, setEntity] = useState(''); const [q, setQ] = useState(''); const [limit, setLimit] = useState(200);
  const { data, error, loading, reload } = useLoad(async () => {
    let query = supabase!.from('sulfa_audit_logs').select('*').order('id', { ascending: false }).limit(limit);
    if (entity) query = query.eq('entity_type', entity);
    const rows = await must(query) as Row[];
    return { rows, people: await profilesFor(rows.map(r => r.actor_id)) };
  }, [entity, limit]);
  const s = q.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(r => !s || `${r.action} ${r.entity_id ?? ''} ${r.reason ?? ''} ${JSON.stringify(r.metadata)}`.toLowerCase().includes(s));
  return (
    <>
      <PageHeader title={t('an.audit')} sub={t('aud.sub')} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <Input placeholder={t('aud.search')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('aud.search')} />
          <Select value={entity} onChange={e => setEntity(e.target.value)} aria-label={t('aud.entity')}><option value="">{t('hist.all')}</option>{ENTITIES.map(x => <option key={x} value={x}>{x}</option>)}</Select>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorBox failure={error} onRetry={reload} /> : rows.length === 0 ? <Empty title={t('aud.none')} /> : (
          <Table head={[t('common.date'), t('aud.actor'), t('aud.action'), t('aud.entity'), t('aud.reason')]}>
            {rows.map(r => <tr key={r.id}><Td>{date(r.created_at, true)}</Td><Td>{r.actor_id ? fullName(data!.people[r.actor_id]) : '—'}<span className="block text-xs text-ink-muted">{t('actor.' + r.actor_role)}</span></Td>
              <Td><span className="font-latin text-xs font-bold">{r.action}</span></Td><Td><span className="font-latin text-xs">{r.entity_type} {r.entity_id ? '· ' + r.entity_id.slice(0, 8) : ''}</span></Td>
              <Td><span className="text-sm">{r.reason ?? ''}</span>{Object.keys(r.metadata ?? {}).length > 0 && <details className="text-xs"><summary className="cursor-pointer text-ink-muted">{t('aud.details')}</summary><pre dir="ltr" className="max-w-[360px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.metadata, null, 1)}</pre></details>}</Td></tr>)}
          </Table>)}
        {data && data.rows.length >= limit && <div className="mt-4 text-center"><Button variant="secondary" onClick={() => setLimit(l => l + 200)}>{t('aud.more')}</Button></div>}
      </Card>
    </>
  );
}
