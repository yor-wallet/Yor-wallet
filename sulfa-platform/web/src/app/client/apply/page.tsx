'use client';
import Link from 'next/link';
import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useIdempotencyKey } from '@/lib/idem';
import { describeError, type RpcFailure } from '@/lib/errors';
import type { Application, QuoteJson } from '@/lib/types';
import { Simulator } from '@/components/simulator';
import { Alert, Button, Card, ErrorBox, Num, PageHeader } from '@/components/ui';

function Apply() {
  const { t, money } = useI18n(); const { profile } = useAuth(); const router = useRouter(); const q = useSearchParams();
  const [sel, setSel] = useState({ amount: Number(q.get('amount')) || 2000, term: Number(q.get('term')) || 6 });
  const [quote, setQuote] = useState<QuoteJson | null>(null);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null);
  const [key, renew] = useIdempotencyKey('app');
  const onChange = useCallback((amount: number, term: number) => { setSel({ amount, term }); setQuote(null); setFail(null); }, []);

  const review = async () => {
    setBusy(true); setFail(null);
    const { data, error } = await supabase!.rpc('sulfa_quote', { p_amount: sel.amount, p_term: sel.term });   // the server's figures, not the preview
    setBusy(false);
    if (error) setFail(describeError(error)); else setQuote(data as QuoteJson);
  };
  const submit = async () => {
    if (busy || !quote || !accept) return;
    setBusy(true); setFail(null);
    const { data, error } = await supabase!.rpc('sulfa_submit_application', { p_amount: quote.amount, p_term: quote.term, p_accept_terms: true, p_idempotency_key: key() });
    setBusy(false);
    if (error) { const f = describeError(error); setFail(f); if (f.certain) renew(); return; }
    renew();
    router.push(`/client/applications/?id=${(data as Application).id}&new=1`);
  };
  return (
    <>
      <PageHeader title={t('apply.title')} sub={t('apply.sub')} />
      {profile && profile.identity_status !== 'VERIFIED' && <div className="mb-6"><Alert tone="info" title={t('apply.id_note_t')}>{t('apply.id_note')} <Link className="font-bold underline" href="/client/documents/">{t('dash.id_cta')}</Link></Alert></div>}
      <Simulator cta={false} onChange={onChange} initial={{ amount: Number(q.get('amount')) || 2000, term: Number(q.get('term')) || 6 }} />
      <Card className="mt-6">
        {!quote ? (
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-ink-soft">{t('apply.review_hint', { amount: money(sel.amount), n: sel.term })}</p><Button onClick={review} busy={busy}>{t('apply.review')}</Button></div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-lg font-extrabold">{t('apply.server_quote')}</h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              {([['sim.principal', quote.amount], ['sim.fee', quote.fee], ['sim.interest', quote.interest], ['sim.total', quote.total], ['sim.monthly', quote.monthly], ['sim.last', quote.last]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-emerald-50 p-3 dark:bg-white/5"><dt className="text-xs text-ink-muted">{t(k)}</dt><dd className="mt-1 font-extrabold"><Num>{money(v)}</Num></dd></div>))}
            </dl>
            <p className="text-sm text-ink-muted">{t('apply.term_line', { n: quote.term })}</p>
            <Alert tone="warn">{t('apply.not_offer')}</Alert>
            <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={accept} onChange={e => setAccept(e.target.checked)} />
              <span className="text-sm">{t('apply.accept')} <Link className="font-bold text-emerald-700 underline" href="/terms/">{t('nav.terms')}</Link></span></label>
            <div className="flex flex-wrap gap-2"><Button onClick={submit} busy={busy} disabled={!accept}>{t('apply.submit')}</Button><Button variant="secondary" onClick={() => setQuote(null)} disabled={busy}>{t('common.edit')}</Button></div>
          </div>)}
        <div className="mt-4"><ErrorBox failure={fail} onRetry={quote ? submit : review} /></div>
      </Card>
    </>
  );
}
export default function Page() { return <Suspense><Apply /></Suspense>; }
