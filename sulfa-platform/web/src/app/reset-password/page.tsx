'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicPage } from '@/components/shell';
import { Alert, Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { describeError, type RpcFailure } from '@/lib/errors';

export default function Page() {
  const { t } = useI18n(); const { session, ready } = useAuth(); const router = useRouter();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null);
  const bad = pw.length < 8 ? t('v.password') : pw !== pw2 ? t('v.password_match') : '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase || busy || bad) return; setBusy(true); setFail(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false); if (error) setFail(describeError(error)); else router.replace('/client/');
  };
  return (
    <PublicPage><Card className="mx-auto max-w-md !p-7">
      <h1 className="text-2xl font-black">{t('auth.reset_t')}</h1>
      {ready && !session ? <div className="mt-6"><Alert tone="warn">{t('auth.reset_no_session')}</Alert></div> : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={t('auth.password')} hint={t('v.password')}><Input type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
          <Field label={t('auth.password2')} error={pw2 && bad ? bad : null}><Input type="password" dir="ltr" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
          <ErrorBox failure={fail} /><Button type="submit" busy={busy} disabled={!!bad} className="w-full">{t('auth.reset_btn')}</Button>
        </form>)}
    </Card></PublicPage>
  );
}
