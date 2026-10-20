'use client';
import { useState } from 'react';
import { PublicPage } from '@/components/shell';
import { Alert, Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { describeError, type RpcFailure } from '@/lib/errors';

export default function Page() {
  const { t } = useI18n();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase || busy) return; setBusy(true); setFail(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password/` });
    setBusy(false); if (error) setFail(describeError(error)); else setDone(true);
  };
  return (
    <PublicPage><Card className="mx-auto max-w-md !p-7">
      <h1 className="text-2xl font-black">{t('auth.forgot_t')}</h1><p className="mt-1 text-sm text-ink-muted">{t('auth.forgot_sub')}</p>
      {done ? <div className="mt-6"><Alert tone="success">{t('auth.forgot_done')}</Alert></div> : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={t('auth.email')}><Input type="email" dir="ltr" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <ErrorBox failure={fail} /><Button type="submit" busy={busy} className="w-full" disabled={!supabase}>{t('auth.forgot_btn')}</Button>
        </form>)}
    </Card></PublicPage>
  );
}
