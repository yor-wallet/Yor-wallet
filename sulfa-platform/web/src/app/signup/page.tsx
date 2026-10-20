'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicPage } from '@/components/shell';
import { Alert, Button, Card, ErrorBox, Field, Input, Select } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { describeError, type RpcFailure } from '@/lib/errors';
import { age, isEmail, isPhone } from '@/lib/validate';

function Signup() {
  const { t, lang } = useI18n(); const { session, ready } = useAuth();
  const router = useRouter(); const q = useSearchParams();
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '+968', nationality: 'OM', gender: '', dob: '', pw: '', pw2: '', terms: false });
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [sent, setSent] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (ready && session) router.replace('/client/apply/' + (q.get('amount') ? `?amount=${q.get('amount')}&term=${q.get('term') ?? ''}` : '')); }, [ready, session, router, q]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.first.trim()) e.first = t('v.required'); if (!f.last.trim()) e.last = t('v.required');
    if (!isEmail(f.email)) e.email = t('v.email');
    if (!isPhone(f.phone)) e.phone = t('v.phone');
    if (!f.dob) e.dob = t('v.required'); else if (age(f.dob) < 18) e.dob = t('v.adult');
    if (f.pw.length < 8) e.pw = t('v.password'); if (f.pw !== f.pw2) e.pw2 = t('v.password_match');
    if (!f.terms) e.terms = t('v.terms');
    setErr(e); return Object.keys(e).length === 0;
  };
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); if (!supabase || busy || !validate()) return;
    setBusy(true); setFail(null);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.pw,
      options: { emailRedirectTo: `${location.origin}/login/`, data: { first_name: f.first.trim(), last_name: f.last.trim(), phone: f.phone.trim(), nationality: f.nationality, gender: f.gender || null, date_of_birth: f.dob, language: lang, terms_accepted: true } },
    });
    setBusy(false);
    if (error) return setFail(describeError(error));
    if (!data.session) setSent(true);                                     // e-mail confirmation required by the project settings
  };
  if (sent) return <Card className="mx-auto max-w-md !p-7"><Alert tone="success" title={t('auth.check_email_t')}>{t('auth.check_email_b', { email: f.email.trim() })}</Alert></Card>;
  return (
    <Card className="mx-auto max-w-2xl !p-7">
      <h1 className="text-2xl font-black">{t('auth.signup_t')}</h1><p className="mt-1 text-sm text-ink-muted">{t('auth.signup_sub')}</p>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label={t('f.first_name')} error={err.first}><Input autoComplete="given-name" value={f.first} onChange={set('first')} maxLength={60} /></Field>
        <Field label={t('f.last_name')} error={err.last}><Input autoComplete="family-name" value={f.last} onChange={set('last')} maxLength={60} /></Field>
        <Field label={t('auth.email')} error={err.email}><Input type="email" dir="ltr" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label={t('f.phone')} hint={t('f.phone_hint')} error={err.phone}><Input type="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label={t('f.nationality')}><Select value={f.nationality} onChange={set('nationality')}>{['OM', 'AE', 'SA', 'KW', 'QA', 'BH', 'OTHER'].map(c => <option key={c} value={c === 'OTHER' ? 'XX' : c}>{t('country.' + c)}</option>)}</Select></Field>
        <Field label={t('f.gender')}><Select value={f.gender} onChange={set('gender')}><option value="">{t('f.gender_none')}</option><option value="M">{t('f.gender_m')}</option><option value="F">{t('f.gender_f')}</option></Select></Field>
        <Field label={t('f.dob')} error={err.dob}><Input type="date" dir="ltr" value={f.dob} onChange={set('dob')} /></Field>
        <div />
        <Field label={t('auth.password')} hint={t('v.password')} error={err.pw}><Input type="password" dir="ltr" autoComplete="new-password" value={f.pw} onChange={set('pw')} /></Field>
        <Field label={t('auth.password2')} error={err.pw2}><Input type="password" dir="ltr" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} /></Field>
        <label className="flex items-start gap-3 sm:col-span-2"><input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={f.terms} onChange={set('terms')} />
          <span className="text-sm">{t('auth.accept_pre')} <Link className="font-bold text-emerald-700 underline" href="/terms/">{t('nav.terms')}</Link> · <Link className="font-bold text-emerald-700 underline" href="/privacy/">{t('nav.privacy')}</Link>{err.terms && <span className="block text-xs font-bold text-red-700">{err.terms}</span>}</span></label>
        <div className="sm:col-span-2 space-y-3"><ErrorBox failure={fail} /><Button type="submit" busy={busy} className="w-full" disabled={!supabase}>{t('auth.signup_btn')}</Button></div>
      </form>
      <p className="mt-5 text-sm">{t('auth.have_account')} <Link className="font-bold text-emerald-700" href="/login/">{t('nav.login')}</Link></p>
    </Card>
  );
}
export default function Page() { return <PublicPage><Suspense><Signup /></Suspense></PublicPage>; }
