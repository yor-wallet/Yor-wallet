'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { LANGS, type Lang } from '@/lib/i18n/dict';
import { TEMPLATE_KEYS, renderNotification } from '@/lib/notif';
import { describeError, type RpcFailure } from '@/lib/errors';
import { Alert, Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td, Textarea, must, useLoad } from '@/components/ui';
import { SUPER, rpc, useCan } from '@/components/admin';

type Log = { id: number; template_key: string; language: string; to_email: string | null; status: string; created_at: string };
type Tpl = { key: string; language: string; subject: string; body: string; updated_at: string };

export default function AdminNotifications() {
  const { t, date } = useI18n(); const can = useCan();
  const [key, setKey] = useState<string>(TEMPLATE_KEYS[0]); const [lang, setLang] = useState<Lang>('ar');
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null); const [ok, setOk] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [log, tpl] = await Promise.all([must(supabase!.from('sulfa_email_log').select('*').order('created_at', { ascending: false }).limit(200)), must(supabase!.from('sulfa_message_templates').select('*'))]);
    return { log: log as Log[], tpl: tpl as Tpl[] };
  }, []);
  const load = (k: string, l: Lang) => {
    setKey(k); setLang(l); setOk(false); setFail(null);
    const saved = data?.tpl.find(x => x.key === k && x.language === l);
    const def = renderNotification({ template_key: k, params: {} }, l);
    setSubject(saved?.subject ?? def.title); setBody(saved?.body ?? def.body);
  };
  const save = async () => {
    setBusy(true); setFail(null); setOk(false);
    try { await rpc('sulfa_admin_upsert_template', { p_key: key, p_language: lang, p_subject: subject, p_body: body }); setOk(true); reload(); } catch (e) { setFail(describeError(e)); }
    setBusy(false);
  };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title={t('an.notifications')} sub={t('an_n.sub')} />
      <div className="mb-6"><Alert tone="warn" title={t('an_n.no_provider_t')}>{t('an_n.no_provider_b')}</Alert></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('an_n.templates')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('an_n.key')}><Select value={key} onChange={e => load(e.target.value, lang)}>{TEMPLATE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</Select></Field>
            <Field label={t('set.language')}><Select value={lang} onChange={e => load(key, e.target.value as Lang)}>{LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}</Select></Field>
          </div>
          <div className="mt-3 space-y-3">
            <Field label={t('an_n.subject')}><Input value={subject} onChange={e => setSubject(e.target.value)} dir={lang === 'ar' ? 'rtl' : 'ltr'} /></Field>
            <Field label={t('an_n.body')} hint={t('an_n.vars')}><Textarea rows={6} value={body} onChange={e => setBody(e.target.value)} dir={lang === 'ar' ? 'rtl' : 'ltr'} /></Field>
            <ErrorBox failure={fail} />{ok && <Alert tone="success">{t('set.saved')}</Alert>}
            <div className="flex gap-2"><Button variant="secondary" onClick={() => load(key, lang)}>{t('an_n.load')}</Button>{can(SUPER) && <Button busy={busy} onClick={save} disabled={!subject.trim() || !body.trim()}>{t('common.save')}</Button>}</div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('an_n.log')}</h2>
          <Table head={[t('common.date'), t('an_n.key'), t('auth.email'), t('common.status')]}>
            {data!.log.map(l => <tr key={l.id}><Td>{date(l.created_at, true)}</Td><Td><span className="font-latin text-xs">{l.template_key}</span></Td><Td><span dir="ltr" className="text-xs">{l.to_email}</span></Td><Td><Badge status={l.status} group="mail" /></Td></tr>)}
          </Table>
        </Card>
      </div>
    </>
  );
}
