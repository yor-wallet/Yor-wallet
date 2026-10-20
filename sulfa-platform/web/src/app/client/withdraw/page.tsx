'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useIdempotencyKey } from '@/lib/idem';
import { describeError, type RpcFailure } from '@/lib/errors';
import { isAmount } from '@/lib/validate';
import type { Summary, Withdrawal } from '@/lib/types';
import { Alert, Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Num, PageHeader, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';

export default function Withdraw() {
  const { t, money, date } = useI18n(); const { session, profile } = useAuth(); const uid = session!.user.id;
  const { data, error, loading, reload } = useLoad(async () => {
    const [s, w] = await Promise.all([must(supabase!.rpc('sulfa_my_summary')), must(supabase!.from('sulfa_withdrawals').select('*').eq('user_id', uid).order('created_at', { ascending: false }))]);
    return { s: s as Summary, w: w as Withdrawal[] };
  }, [uid]);
  const [f, setF] = useState({ amount: '', bank: '', holder: profile ? `${profile.first_name} ${profile.last_name}` : '', account: '' });
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [ok, setOk] = useState<Withdrawal | null>(null);
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const [key, renew] = useIdempotencyKey('wd');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { s, w } = data!;
  const amountErr = f.amount && (!isAmount(f.amount) ? t('v.amount') : Number(f.amount) > s.available ? t('err.sulfa_insufficient_funds') : '');
  const valid = isAmount(f.amount) && !amountErr && f.bank.trim() && f.holder.trim() && f.account.trim();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !valid) return;
    setBusy(true); setFail(null); setOk(null);
    const { data: wd, error: er } = await supabase!.rpc('sulfa_request_withdrawal', { p_amount: Number(f.amount), p_bank: f.bank, p_holder: f.holder, p_account: f.account, p_idempotency_key: key() });
    setBusy(false);
    if (er) { const x = describeError(er); setFail(x); if (x.certain) renew(); return; }
    renew(); setOk(wd as Withdrawal); setF(x => ({ ...x, amount: '' })); reload();
  };
  const cancel = (x: Withdrawal) => setDlg({ title: t('wd.cancel_t'), body: t('wd.cancel_b', { ref: x.reference }), confirm: t('wd.cancel_btn'), tone: 'danger',
    run: async () => { await must(supabase!.rpc('sulfa_cancel_withdrawal', { p_id: x.id })); reload(); } });
  return (
    <>
      <PageHeader title={t('cn.withdraw')} sub={t('wd.sub')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <p className="text-sm text-ink-muted">{t('dash.available')}</p><p className="text-3xl font-black"><Num>{money(s.available)}</Num></p>
          {s.reserved > 0 && <p className="mt-1 text-xs text-ink-muted">{t('wd.reserved_note', { amount: money(s.reserved) })}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label={t('common.amount')} error={amountErr || null}><Input inputMode="decimal" dir="ltr" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
            <Field label={t('wd.bank')}><Input value={f.bank} maxLength={80} onChange={e => setF({ ...f, bank: e.target.value })} /></Field>
            <Field label={t('wd.holder')}><Input value={f.holder} maxLength={80} onChange={e => setF({ ...f, holder: e.target.value })} /></Field>
            <Field label={t('wd.account')} hint={t('wd.account_hint')}><Input dir="ltr" value={f.account} maxLength={40} onChange={e => setF({ ...f, account: e.target.value })} /></Field>
            <ErrorBox failure={fail} />
            {ok && <Alert tone="success" title={t('wd.sent_t')}>{t('wd.sent_b', { ref: ok.reference, amount: money(ok.amount) })}</Alert>}
            <Button type="submit" busy={busy} disabled={!valid} className="w-full">{t('wd.submit')}</Button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">{t('wd.note')}</p>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('wd.list')}</h2>
          {w.length === 0 ? <Empty title={t('wd.none')} /> : (
            <Table head={[t('common.reference'), t('common.amount'), t('common.date'), t('common.status'), '']}>
              {w.map(x => <tr key={x.id}><Td><Num>{x.reference}</Num></Td><Td><Num>{money(x.amount)}</Num></Td><Td>{date(x.created_at)}</Td>
                <Td><Badge status={x.status} group="wst" />{x.decision_reason && ['REJECTED', 'FAILED'].includes(x.status) && <p className="mt-1 text-xs text-red-700">{x.decision_reason}</p>}</Td>
                <Td>{['RECEIVED', 'IN_VERIFICATION'].includes(x.status) ? <button className="text-sm font-bold text-red-700" onClick={() => cancel(x)}>{t('wd.cancel_btn')}</button>
                  : x.tx_id ? <Link className="text-sm font-bold text-emerald-700" href={`/client/receipt/?tx=${x.tx_id}`}>{t('rc.view')}</Link> : null}</Td></tr>)}
            </Table>)}
        </Card>
      </div>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
