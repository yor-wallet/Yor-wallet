'use client';
import { useRef, useState } from 'react';
import { supabase, DOCS_BUCKET } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { describeError, type RpcFailure } from '@/lib/errors';
import type { Doc } from '@/lib/types';
import { Alert, Badge, Button, Card, ErrorBox, Loading, PageHeader, must, useLoad } from '@/components/ui';
import { Img3D } from '@/components/img3d';
import { SelfieCapture } from '@/components/selfie';

const TYPES = ['id_front', 'id_back', 'selfie', 'address_proof', 'other'] as const;
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX = 8 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

function Slot({ type, docs, uid, onDone }: { type: (typeof TYPES)[number]; docs: Doc[]; uid: string; onDone: () => void }) {
  const { t, date } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [local, setLocal] = useState('');
  const current = docs.find(d => d.document_type === type && d.status !== 'REPLACED');
  const canUpload = !current || ['REJECTED', 'REUPLOAD_REQUIRED', 'PENDING'].includes(current.status);
  const pick = async (f: File | undefined) => {
    setLocal(''); setFail(null);
    if (!f) return;
    if (!MIME.includes(f.type)) return setLocal(t('doc.bad_type'));
    if (f.size > MAX) return setLocal(t('doc.too_big'));
    setBusy(true);
    try {
      const path = `${uid}/${type}-${Date.now()}.${EXT[f.type]}`;               // private bucket, own folder only (storage policy)
      const up = await supabase!.storage.from(DOCS_BUCKET).upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      await must(supabase!.rpc('sulfa_register_document', { p_type: type, p_path: path }));
      onDone();
    } catch (e) { setFail(describeError(e)); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const view = async () => {
    if (!current) return;
    const { data, error } = await supabase!.storage.from(DOCS_BUCKET).createSignedUrl(current.storage_path, 120);
    if (error) setFail(describeError(error)); else window.open(data.signedUrl, '_blank', 'noopener');
  };
  return (
    <Card className={type === 'selfie' ? 'flex flex-col md:row-span-2' : 'flex flex-col'}>
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{t('doc.' + type)}</h3><p className="text-xs text-ink-muted">{t('doc.' + type + '_hint')}</p></div>{current ? <Badge status={current.status} /> : <Badge status="NOT_SUBMITTED" />}</div>
      {current?.review_reason && <div className="mt-3"><Alert tone={current.status === 'VERIFIED' ? 'success' : 'warn'} title={t('app.admin_reason')}>{current.review_reason}</Alert></div>}
      {current && <p className="mt-3 text-xs text-ink-muted">{t('doc.sent_on', { date: date(current.created_at, true) })}</p>}
      {type === 'selfie' && canUpload && <SelfieCapture busy={busy} onSend={pick} />}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {canUpload && type !== 'selfie' && <><input ref={input} type="file" accept={MIME.join(',')} className="sr-only" id={'f-' + type} onChange={e => pick(e.target.files?.[0])} />
          <Button busy={busy} onClick={() => input.current?.click()} variant={current ? 'secondary' : 'primary'}>{current ? t('doc.replace') : t('doc.upload')}</Button></>}
        {current && <Button variant="ghost" onClick={view}>{t('doc.view')}</Button>}
      </div>
      {local && <p className="mt-2 text-xs font-bold text-red-700">{local}</p>}
      <div className="mt-2"><ErrorBox failure={fail} /></div>
    </Card>
  );
}

export default function Documents() {
  const { t } = useI18n(); const { session, profile, refreshProfile } = useAuth();
  const uid = session!.user.id;
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_documents').select('*').eq('user_id', uid).order('created_at', { ascending: false })), [uid], { cache: 'docs' });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const done = () => { reload(); refreshProfile(); };
  return (
    <>
      <div className="flex items-center gap-4"><div className="min-w-0 flex-1"><PageHeader title={t('cn.documents')} sub={t('doc.sub')} /></div><Img3D name="idcard" className="-mt-6 w-32 shrink-0 sm:w-40" alt="" /></div>
      <div className="mb-6 flex flex-wrap items-center gap-3"><span className="font-bold">{t('doc.identity')}</span>{profile && <Badge status={profile.identity_status} group="id" />}</div>
      <div className="mb-6"><Alert tone="info">{t('doc.required3')}</Alert></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{TYPES.map(ty => <Slot key={ty} type={ty} docs={data as Doc[]} uid={uid} onDone={done} />)}</div>
      <p className="mt-6 text-sm text-ink-muted">{t('doc.privacy')}</p>
    </>
  );
}
