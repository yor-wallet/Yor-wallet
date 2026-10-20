'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicPage } from '@/components/shell';
import { Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { describeError, type RpcFailure } from '@/lib/errors';

function Login() {
  const { t } = useI18n(); const { session, role, ready } = useAuth();
  const router = useRouter(); const q = useSearchParams();
  const next = q.get('next') ?? '';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '';
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null);
  useEffect(() => { if (ready && session) router.replace(safeNext || (role ? '/admin/' : '/client/')); }, [ready, session, role, safeNext, router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase || busy) return;
    setBusy(true); setFail(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setFail(describeError(error));
    setBusy(false);
  };
  return (
    <Card className="mx-auto max-w-md !p-7">
      <h1 className="text-2xl font-black">{t('auth.login_t')}</h1><p className="mt-1 text-sm text-ink-muted">{t('auth.login_sub')}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t('auth.email')}><Input type="email" autoComplete="email" dir="ltr" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label={t('auth.password')}><Input type="password" autoComplete="current-password" dir="ltr" required value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <ErrorBox failure={fail} />
        <Button type="submit" busy={busy} className="w-full" disabled={!supabase}>{t('auth.login_btn')}</Button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm"><Link className="font-bold text-emerald-700" href="/forgot-password/">{t('auth.forgot')}</Link><Link className="font-bold text-emerald-700" href="/signup/">{t('auth.no_account')}</Link></div>
    </Card>
  );
}
export default function Page() { return <PublicPage><Suspense><Login /></Suspense></PublicPage>; }
