'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { describeError, type RpcFailure } from '@/lib/errors';
import { Alert, Badge, Button, Card, Dialog, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td, must, useLoad, type DialogSpec } from '@/components/ui';
import { SUPER, fullName, profilesFor, rpc, useCan } from '@/components/admin';

type S = { reference_capital: number; min_amount: number; max_amount: number; min_term: number; max_term: number; fee_fixed: number; fee_percent: number; monthly_rate_percent: number;
  default_language: string; max_open_applications: number; notifications_enabled: boolean; updated_at: string };
type Admin = { user_id: string; email: string; role: string; active: boolean; created_at: string };
const NUM: (keyof S)[] = ['reference_capital', 'min_amount', 'max_amount', 'min_term', 'max_term', 'fee_fixed', 'fee_percent', 'monthly_rate_percent', 'max_open_applications'];

export default function AdminSettings() {
  const { t, date } = useI18n(); const can = useCan(); const { session } = useAuth();
  const [f, setF] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [ok, setOk] = useState(false);
  const [dlg, setDlg] = useState<DialogSpec | null>(null); const [email, setEmail] = useState(''); const [role, setRole] = useState('REVIEWER');
  const { data, error, loading, reload } = useLoad(async () => {
    const [s, admins] = await Promise.all([must(supabase!.from('sulfa_settings').select('*').single()), must(supabase!.from('sulfa_admins').select('*').order('created_at'))]);
    return { s: s as S, admins: admins as Admin[], people: await profilesFor((admins as Admin[]).map(a => a.user_id)) };
  }, []);
  useEffect(() => { if (data) setF(Object.fromEntries(Object.entries(data.s).map(([k, v]) => [k, String(v)]))); }, [data]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  const superAdmin = can(SUPER);
  const save = async () => {
    setBusy(true); setFail(null); setOk(false);
    const p: Record<string, unknown> = { default_language: f.default_language, notifications_enabled: f.notifications_enabled === 'true' };
    for (const k of NUM) p[k] = Number(f[k]);
    try { await rpc('sulfa_admin_update_settings', { p }); setOk(true); reload(); } catch (e) { setFail(describeError(e)); }
    setBusy(false);
  };
  const addAdmin = () => setDlg({ title: t('aset.add_t'), confirm: t('common.confirm'), body: t('aset.add_b', { email, role: t('role.' + role) }),
    run: async () => {
      const p = await must(supabase!.from('sulfa_profiles').select('user_id').ilike('email', email.trim()).maybeSingle()) as { user_id: string } | null;
      if (!p) throw { message: 'sulfa_user_not_found', code: 'P0002' };
      await rpc('sulfa_admin_set_admin', { p_user: p.user_id, p_role: role, p_active: true }); setEmail(''); reload();
    } });
  const toggle = (a: Admin) => setDlg({ title: a.active ? t('aset.disable') : t('aset.enable'), confirm: t('common.confirm'), tone: a.active ? 'danger' : 'primary', body: a.email,
    run: async () => { await rpc('sulfa_admin_set_admin', { p_user: a.user_id, p_role: a.role, p_active: !a.active }); reload(); } });
  return (
    <>
      <PageHeader title={t('an.settings')} sub={t('aset.sub')} />
      {!superAdmin && <div className="mb-4"><Alert tone="info">{t('aset.readonly')}</Alert></div>}
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">{t('aset.financing')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUM.map(k => <Field key={k} label={t('aset.' + k)} hint={k === 'reference_capital' ? t('aset.reference_hint') : undefined}><Input dir="ltr" inputMode="decimal" disabled={!superAdmin} value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>)}
          <Field label={t('aset.default_language')}><Select disabled={!superAdmin} value={f.default_language ?? 'ar'} onChange={e => setF({ ...f, default_language: e.target.value })}><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></Select></Field>
          <Field label={t('aset.notifications_enabled')}><Select disabled={!superAdmin} value={f.notifications_enabled ?? 'true'} onChange={e => setF({ ...f, notifications_enabled: e.target.value })}><option value="true">{t('common.yes')}</option><option value="false">{t('common.no')}</option></Select></Field>
        </div>
        <p className="mt-4 text-xs text-ink-muted">{t('aset.updated', { date: date(data!.s.updated_at, true) })}</p>
        <div className="mt-4 space-y-3"><ErrorBox failure={fail} />{ok && <Alert tone="success">{t('set.saved')}</Alert>}{superAdmin && <Button busy={busy} onClick={save}>{t('common.save')}</Button>}</div>
      </Card>
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-extrabold">{t('aset.admins')}</h2>
        <Table head={[t('auth.email'), t('adm.client'), t('aset.role'), t('common.status'), '']}>
          {data!.admins.map(a => <tr key={a.user_id}><Td><span dir="ltr">{a.email}</span></Td><Td>{fullName(data!.people[a.user_id])}</Td><Td>{t('role.' + a.role)}</Td><Td><Badge status={a.active ? 'ACTIVE' : 'SUSPENDED'} /></Td>
            <Td>{superAdmin && a.user_id !== session?.user.id && <button className="text-sm font-bold text-emerald-700" onClick={() => toggle(a)}>{a.active ? t('aset.disable') : t('aset.enable')}</button>}</Td></tr>)}
        </Table>
        {superAdmin && <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_200px_auto] dark:border-white/10">
          <Field label={t('aset.add_email')} hint={t('aset.add_hint')}><Input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label={t('aset.role')}><Select value={role} onChange={e => setRole(e.target.value)}>{['REVIEWER', 'ADMIN', 'SUPER_ADMIN'].map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}</Select></Field>
          <Button className="self-end" onClick={addAdmin} disabled={!email.includes('@')}>{t('aset.add_btn')}</Button>
        </div>}
      </Card>
      <Dialog spec={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
