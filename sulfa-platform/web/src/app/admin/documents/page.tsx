'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, DOCS_BUCKET } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { describeError, type RpcFailure } from '@/lib/errors';
import type { Doc } from '@/lib/types';
import { Alert, Badge, Button, Card, Dialog, Empty, ErrorBox, Loading, PageHeader, Select, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { fullName, profilesFor, rpc } from '@/components/admin';

function Docs() {
  const { t, date } = useI18n(); const q = useSearchParams(); const router = useRouter();
  const user = q.get('user'); const filter = q.get('status') ?? 'TODO';
  const [dlg, setDlg] = useState<DialogSpec | null>(null); const [fail, setFail] = useState<RpcFailure | null>(null);
  const [mail, setMail] = useState<{ tone: 'success' | 'warn' | 'error'; text: string } | null>(null);
  // after a validation: the sulfa-mailer function sends the queued Arabic e-mail and reports what REALLY happened
  const sendMail = async () => {
    const { data: r, error: e } = await supabase!.functions.invoke('sulfa-mailer', { body: {} });
    if (e || !r) { setMail({ tone: 'error', text: t('mail.failed', { n: 1 }) }); return; }
    if (r.sent > 0) setMail({ tone: 'success', text: t('mail.sent', { n: r.sent }) });
    else if (r.failed > 0) setMail({ tone: 'error', text: t('mail.failed', { n: r.failed }) });
    else if (r.configured === false && r.pending > 0) setMail({ tone: 'warn', text: t('mail.pending') });
  };
  const { data, error, loading, reload } = useLoad(async () => {
    let query = supabase!.from('sulfa_documents').select('*').order('created_at', { ascending: true }).limit(300);
    if (user) query = query.eq('user_id', user);
    if (filter === 'TODO') query = query.in('status', ['PENDING', 'IN_REVIEW']); else if (filter !== 'ALL') query = query.eq('status', filter);
    const docs = await must(query) as Doc[];
    return { docs, people: await profilesFor(docs.map(d => d.user_id)) };
  }, [user, filter]);
  const view = async (d: Doc) => {
    setFail(null);
    const { data: u, error: e } = await supabase!.storage.from(DOCS_BUCKET).createSignedUrl(d.storage_path, 120);   // 2-minute private link
    if (e) setFail(describeError(e)); else window.open(u.signedUrl, '_blank', 'noopener');
  };
  const act = (d: Doc, decision: string) => setDlg({
    title: t('adm.doc.' + decision), confirm: t('adm.doc.' + decision), tone: decision === 'REJECTED' ? 'danger' : 'primary',
    reason: decision === 'REJECTED' || decision === 'REUPLOAD_REQUIRED' ? 'required' : 'optional',
    body: t('adm.doc_b', { type: t('doc.' + d.document_type), name: fullName(data?.people[d.user_id]) }),
    run: async ({ reason }) => { setMail(null); await rpc('sulfa_admin_review_document', { p_id: d.id, p_decision: decision, p_reason: reason || null }); reload(); if (decision === 'VERIFIED') void sendMail(); },
  });
  return (
    <>
      <PageHeader title={t('an.documents')} sub={t('adm.docs_sub')} actions={user ? <Link className="font-bold text-emerald-700" href="/admin/documents/">{t('adm.all_clients')}</Link> : undefined} />
      <Card>
        <div className="mb-4 max-w-xs"><Select value={filter} aria-label={t('common.status')} onChange={e => router.replace(`/admin/documents/?status=${e.target.value}${user ? '&user=' + user : ''}`)}>
          <option value="TODO">{t('adm.filter_todo')}</option><option value="ALL">{t('hist.all')}</option>{['VERIFIED', 'REJECTED', 'REUPLOAD_REQUIRED', 'REPLACED'].map(s => <option key={s} value={s}>{t('st.' + s)}</option>)}
        </Select></div>
        <ErrorBox failure={fail} />
        {mail && <div className="mb-4"><Alert tone={mail.tone} title={t('mail.title')}>{mail.text}</Alert></div>}
        {loading && !data ? <Loading /> : error ? <ErrorBox failure={error} onRetry={reload} /> : data!.docs.length === 0 ? <Empty title={t('adm.no_docs')} /> : (
          <Table head={[t('adm.client'), t('rc.type'), t('common.date'), t('common.status'), t('common.actions')]}>
            {data!.docs.map(d => <tr key={d.id}>
              <Td><Link className="font-bold text-emerald-700" href={`/admin/clients/?id=${d.user_id}`}>{fullName(data!.people[d.user_id])}</Link></Td><Td>{t('doc.' + d.document_type)}</Td><Td>{date(d.created_at, true)}</Td>
              <Td><Badge status={d.status} />{d.review_reason && <p className="mt-1 max-w-[220px] text-xs text-ink-muted">{d.review_reason}</p>}</Td>
              <Td><div className="flex flex-wrap gap-1.5"><Button variant="ghost" className="!min-h-9 !px-3" onClick={() => view(d)}>{t('doc.view')}</Button>
                {d.status === 'PENDING' && <Button variant="secondary" className="!min-h-9 !px-3" onClick={() => act(d, 'IN_REVIEW')}>{t('adm.doc.IN_REVIEW')}</Button>}
                {['PENDING', 'IN_REVIEW', 'REUPLOAD_REQUIRED'].includes(d.status) && <>
                  <Button className="!min-h-9 !px-3" onClick={() => act(d, 'VERIFIED')}>{t('adm.doc.VERIFIED')}</Button>
                  {d.status !== 'REUPLOAD_REQUIRED' && <Button variant="secondary" className="!min-h-9 !px-3" onClick={() => act(d, 'REUPLOAD_REQUIRED')}>{t('adm.doc.REUPLOAD_REQUIRED')}</Button>}
                  <Button variant="danger" className="!min-h-9 !px-3" onClick={() => act(d, 'REJECTED')}>{t('adm.doc.REJECTED')}</Button></>}
              </div></Td></tr>)}
          </Table>)}
      </Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
export default function Page() { return <Suspense><Docs /></Suspense>; }
