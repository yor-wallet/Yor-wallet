'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useIdempotencyKey } from '@/lib/idem';
import { isAmount } from '@/lib/validate';
import type { Tx } from '@/lib/types';
import { Alert, Badge, Button, Card, Dialog, ErrorBox, Loading, Num, PageHeader, Select, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { SUPER, fullName, profilesFor, rpc, useCan } from '@/components/admin';

type Entry = { id: number; side: 'DEBIT' | 'CREDIT'; amount: number; sulfa_accounts: { code: string } };
const REVERSIBLE = ['CAPITAL_DEPOSIT', 'WITHDRAWAL'];

export default function Ledger() {
  const { t, money, date } = useI18n(); const can = useCan();
  const [type, setType] = useState(''); const [open, setOpen] = useState<string | null>(null); const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [dlg, setDlg] = useState<DialogSpec | null>(null);
  const [capKey, renewCap] = useIdempotencyKey('cap'); const [revKey, renewRev] = useIdempotencyKey('rev');
  const { data, error, loading, reload } = useLoad(async () => {
    let q = supabase!.from('sulfa_transactions').select('*').order('created_at', { ascending: false }).limit(300);
    if (type) q = q.eq('transaction_type', type);
    const [tx, bal] = await Promise.all([must(q), rpc<{ code: string; account_type: string; owner_user_id: string | null; balance: number }[]>('sulfa_admin_account_balances', {})]);
    return { tx: tx as Tx[], bal, people: await profilesFor((tx as Tx[]).map(x => x.user_id)) };
  }, [type]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const { tx, bal, people } = data!;
  const platform = bal.filter(b => b.account_type !== 'CLIENT_WALLET');
  const clients = bal.filter(b => b.account_type === 'CLIENT_WALLET').reduce((s, b) => s + Number(b.balance), 0);
  const toggle = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (!entries[id]) { const e = await must(supabase!.from('sulfa_ledger_entries').select('id, side, amount, sulfa_accounts(code)').eq('transaction_id', id).order('id')) as unknown as Entry[]; setEntries(x => ({ ...x, [id]: e })); }
  };
  const capital = () => setDlg({ title: t('led.cap_t'), confirm: t('led.cap_btn'), tone: 'gold', reference: 'required', reason: 'optional', amount: { label: t('common.amount') },
    body: <>{t('led.cap_b')}<p className="mt-2 font-bold">{t('led.cap_warn')}</p></>,
    run: async ({ amount, reference, reason }) => {
      if (!isAmount(amount)) throw { message: 'sulfa_invalid_amount', code: '22023' };
      await rpc('sulfa_admin_record_capital', { p_amount: Number(amount), p_internal_ref: reference, p_note: reason || null, p_idempotency_key: capKey() }); renewCap(); reload();
    } });
  const reverse = (x: Tx) => setDlg({ title: t('led.rev_t'), confirm: t('led.rev_btn'), tone: 'danger', reason: 'required', body: t('led.rev_b', { ref: x.reference, amount: money(x.amount) }),
    run: async ({ reason }) => { await rpc('sulfa_admin_reverse_transaction', { p_tx: x.id, p_reason: reason, p_idempotency_key: revKey() }); renewRev(); reload(); } });
  return (
    <>
      <PageHeader title={t('an.ledger')} sub={t('led.sub')} actions={can(SUPER) ? <Button variant="gold" onClick={capital}>{t('led.cap_btn')}</Button> : undefined} />
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">{t('led.accounts')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {platform.map(b => <div key={b.code} className="rounded-xl border border-line p-3 dark:border-white/10"><p className="text-xs text-ink-muted">{t('acct.' + b.code)}</p><p className="mt-1 font-extrabold"><Num>{money(b.balance)}</Num></p></div>)}
          <div className="rounded-xl border border-line p-3 dark:border-white/10"><p className="text-xs text-ink-muted">{t('acct.CLIENTS')}</p><p className="mt-1 font-extrabold"><Num>{money(clients)}</Num></p></div>
        </div>
        <p className="mt-4 text-xs text-ink-muted">{t('led.balanced_note')}</p>
      </Card>
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">{t('led.transactions')}</h2>
          <Select className="!w-auto" value={type} onChange={e => setType(e.target.value)} aria-label={t('rc.type')}><option value="">{t('hist.all')}</option>{['CAPITAL_DEPOSIT', 'DISBURSEMENT', 'REPAYMENT', 'WITHDRAWAL', 'REVERSAL'].map(x => <option key={x} value={x}>{t('tx.' + x)}</option>)}</Select></div>
        {tx.length === 0 ? <Alert tone="info">{t('led.empty')}</Alert> : (
          <Table head={[t('common.date'), t('rc.type'), t('common.reference'), t('adm.client'), t('common.amount'), t('dlg.reference'), t('common.status'), '']}>
            {tx.map(x => [
              <tr key={x.id}><Td>{date(x.validated_at, true)}</Td><Td>{t('tx.' + x.transaction_type)}</Td><Td><button className="font-bold text-emerald-700" onClick={() => toggle(x.id)} aria-expanded={open === x.id}><Num>{x.reference}</Num></button></Td>
                <Td>{x.user_id ? fullName(people[x.user_id]) : '—'}</Td><Td><Num>{money(x.amount)}</Num></Td><Td><Num>{x.internal_reference ?? '—'}</Num></Td><Td><Badge status={x.status} /></Td>
                <Td><div className="flex gap-2"><Link className="text-sm font-bold text-emerald-700" href={`/admin/receipt/?tx=${x.id}`}>{t('rc.view')}</Link>
                  {can(SUPER) && x.status === 'RECORDED' && REVERSIBLE.includes(x.transaction_type) && <button className="text-sm font-bold text-red-700" onClick={() => reverse(x)}>{t('led.rev_btn')}</button>}</div></Td></tr>,
              open === x.id && <tr key={x.id + 'e'}><td colSpan={8} className="bg-emerald-50/60 px-4 py-3 dark:bg-white/5">
                {x.note && <p className="mb-2 text-xs text-ink-muted">{x.note}</p>}
                {(entries[x.id] ?? []).map(e => <div key={e.id} className="flex justify-between gap-4 py-1 text-sm"><span>{t('acct.' + (e.sulfa_accounts.code.startsWith('CLIENT:') ? 'CLIENT' : e.sulfa_accounts.code))}</span><span className="font-bold">{t('led.' + e.side)} <Num>{money(e.amount)}</Num></span></div>)}
              </td></tr>])}
          </Table>)}
      </Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
