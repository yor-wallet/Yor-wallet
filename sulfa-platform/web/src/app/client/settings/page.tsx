'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { LANGS, LANG_NAMES, type Lang } from '@/lib/i18n/dict';
import { describeError, type RpcFailure } from '@/lib/errors';
import { isPhone } from '@/lib/validate';
import { Alert, Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Select } from '@/components/ui';
import { ThemeToggle } from '@/components/shell';

export default function Settings() {
  const { t, setLang, date } = useI18n(); const { profile, session, refreshProfile } = useAuth();
  const [f, setF] = useState({ first: profile?.first_name ?? '', last: profile?.last_name ?? '', phone: profile?.phone ?? '', lang: (profile?.preferred_language ?? 'ar') as Lang });
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [ok, setOk] = useState(false);
  const [pw, setPw] = useState(''); const [pwBusy, setPwBusy] = useState(false); const [pwMsg, setPwMsg] = useState<RpcFailure | 'ok' | null>(null);
  const phoneBad = f.phone && !isPhone(f.phone);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || phoneBad) return; setBusy(true); setFail(null); setOk(false);
    const { error } = await supabase!.rpc('sulfa_update_my_profile', { p_first: f.first, p_last: f.last, p_phone: f.phone || null, p_language: f.lang });
    setBusy(false);
    if (error) return setFail(describeError(error));
    setOk(true); setLang(f.lang); refreshProfile();
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); if (pw.length < 8 || pwBusy) return; setPwBusy(true); setPwMsg(null);
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setPwBusy(false); setPwMsg(error ? describeError(error) : 'ok'); if (!error) setPw('');
  };
  return (
    <>
      <PageHeader title={t('cn.settings')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('set.profile')}</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('f.first_name')}><Input value={f.first} maxLength={60} onChange={e => setF({ ...f, first: e.target.value })} /></Field>
              <Field label={t('f.last_name')}><Input value={f.last} maxLength={60} onChange={e => setF({ ...f, last: e.target.value })} /></Field>
            </div>
            <Field label={t('f.phone')} hint={t('f.phone_hint')} error={phoneBad ? t('v.phone') : null}><Input dir="ltr" type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t('set.language')}><Select value={f.lang} onChange={e => setF({ ...f, lang: e.target.value as Lang })}>{LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</Select></Field>
            <ErrorBox failure={fail} />{ok && <Alert tone="success">{t('set.saved')}</Alert>}
            <Button type="submit" busy={busy} disabled={!!phoneBad}>{t('common.save')}</Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-extrabold">{t('set.account')}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('auth.email')}</dt><dd dir="ltr" className="font-bold">{session?.user.email}</dd></div>
              {profile && <><div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('set.status')}</dt><dd><Badge status={profile.account_status} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('doc.identity')}</dt><dd><Badge status={profile.identity_status} group="id" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('set.member_since')}</dt><dd className="font-bold">{date(profile.created_at)}</dd></div></>}
            </dl>
            <p className="mt-4 text-xs text-ink-muted">{t('set.email_note')}</p>
          </Card>
          <Card><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">{t('set.theme')}</h2><ThemeToggle /></div></Card>
          <Card>
            <h2 className="mb-4 text-lg font-extrabold">{t('set.password')}</h2>
            <form onSubmit={changePw} className="space-y-4">
              <Field label={t('auth.password')} hint={t('v.password')}><Input type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
              {pwMsg === 'ok' ? <Alert tone="success">{t('set.pw_ok')}</Alert> : <ErrorBox failure={pwMsg} />}
              <Button type="submit" busy={pwBusy} disabled={pw.length < 8} variant="secondary">{t('set.pw_btn')}</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
