'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import type { Application, Profile, Tx } from '@/lib/types';
import { Alert, Badge, Button, Card, ErrorBox, Loading, Num, must, useLoad } from './ui';

/** Receipt built only from recorded rows. An application receipt is an acknowledgement, never a proof of payment. */
export function Receipt({ tx, app, admin }: { tx?: string | null; app?: string | null; admin?: boolean }) {
  const { t, money, date } = useI18n();
  const [copied, setCopied] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    if (tx) {
      const row = await must(supabase!.from('sulfa_transactions').select('*').eq('id', tx).single()) as Tx;
      const p = row.user_id ? await must(supabase!.from('sulfa_profiles').select('first_name,last_name,user_id').eq('user_id', row.user_id).maybeSingle()) as Profile | null : null;
      let appRef: string | null = null;
      if (row.application_id) appRef = ((await must(supabase!.from('sulfa_applications').select('reference').eq('id', row.application_id).single())) as { reference: string }).reference;
      return { kind: 'tx' as const, row, p, appRef };
    }
    const a = await must(supabase!.from('sulfa_applications').select('*').eq('id', app!).single()) as Application;
    const p = await must(supabase!.from('sulfa_profiles').select('first_name,last_name,user_id').eq('user_id', a.user_id).maybeSingle()) as Profile | null;
    return { kind: 'app' as const, a, p };
  }, [tx, app]);
  if (!tx && !app) return <Alert tone="warn">{t('rc.missing')}</Alert>;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const d = data!;
  const ref = d.kind === 'tx' ? d.row.reference : d.a.reference;
  const copy = async () => { try { await navigator.clipboard.writeText(ref); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  const name = d.p ? `${d.p.first_name} ${d.p.last_name}`.trim() : '—';
  const rows: [string, React.ReactNode][] = d.kind === 'tx'
    ? [[t('rc.type'), t('tx.' + d.row.transaction_type)], [t('common.amount'), <Num key="a">{money(d.row.amount)}</Num>], [t('rc.client'), name],
       ...(d.appRef ? [[t('common.application'), <Num key="r">{d.appRef}</Num>] as [string, React.ReactNode]] : []),
       [t('rc.validated_at'), date(d.row.validated_at, true)], [t('rc.validated_by'), t('rc.by_admin')],
       ...(admin && d.row.internal_reference ? [[t('dlg.reference'), <Num key="i">{d.row.internal_reference}</Num>] as [string, React.ReactNode]] : [])]
    : [[t('rc.type'), t('rc.app_ack')], [t('app.requested'), <Num key="a">{money(d.a.requested_amount)}</Num>], [t('sim.term'), t('sim.months', { n: d.a.requested_term })],
       [t('sim.monthly'), <Num key="m">{money(d.a.quote.monthly)}</Num>], [t('sim.total'), <Num key="t">{money(d.a.quote.total)}</Num>], [t('rc.client'), name], [t('common.date'), date(d.a.created_at, true)]];
  const status = d.kind === 'tx' ? d.row.status : d.a.status;
  return (
    <div className="mx-auto max-w-xl">
      <Card className="!p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 p-6 text-white">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-emerald-100/80">SULFA — سلفه</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black">س</span></div>
          <p className="mt-4 text-sm text-emerald-100/80">{d.kind === 'tx' ? t('rc.title_tx') : t('rc.title_app')}</p>
          <p className="mt-1 text-3xl font-black"><Num>{money(d.kind === 'tx' ? d.row.amount : d.a.requested_amount)}</Num></p>
        </div>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><Num>{ref}</Num><Badge status={status} /></div>
          <dl className="divide-y divide-line text-sm dark:divide-white/10">{rows.map(([k, v], i) => <div key={i} className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">{k}</dt><dd className="text-end font-bold">{v}</dd></div>)}</dl>
          {d.kind === 'tx' && d.row.status === 'REVERSED' && <div className="mt-4"><Alert tone="warn">{t('rc.reversed')}</Alert></div>}
          {d.kind === 'app' && <div className="mt-4"><Alert tone="info">{t('rc.app_note')}</Alert></div>}
          <p className="mt-4 text-xs text-ink-muted">{t('rc.footer')}</p>
        </div>
      </Card>
      <div className="no-print mt-4 flex flex-wrap justify-center gap-2"><Button onClick={() => window.print()}>{t('rc.print')}</Button><Button variant="secondary" onClick={copy}>{copied ? t('rc.copied') : t('rc.copy')}</Button></div>
    </div>
  );
}
