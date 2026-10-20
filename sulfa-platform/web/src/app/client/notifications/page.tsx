'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { renderNotification } from '@/lib/notif';
import type { Notification } from '@/lib/types';
import { Img3D } from '@/components/img3d';
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, cx, must, useLoad } from '@/components/ui';

const LINK: Record<string, (id: string) => string> = { application: id => `/client/applications/?id=${id}`, document: () => '/client/documents/', withdrawal: () => '/client/withdraw/', repayment: () => '/client/installments/', installment: () => '/client/installments/' };

export default function Notifications() {
  const { t, date, lang } = useI18n(); const { session } = useAuth();
  const { data, error, loading, reload } = useLoad(() => must(supabase!.from('sulfa_notifications').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false }).limit(200)), []);
  const list = (data ?? []) as Notification[];
  const unread = list.filter(n => !n.read_at).map(n => n.id);
  // opening the page marks what is shown as read (server function, own notifications only)
  useEffect(() => { if (unread.length) supabase!.rpc('sulfa_mark_notifications_read', { p_ids: unread }).then(() => {}); }, [unread.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox failure={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title={t('cn.notifications')} sub={t('notif.sub')} actions={<Button variant="secondary" onClick={reload}>{t('common.refresh')}</Button>} />
      {list.length === 0 ? <Empty title={t('notif.empty')} art={<Img3D name="bell" className="mx-auto -mt-4 mb-1 w-40" />} /> : (
        <Card className="!p-0"><ul className="divide-y divide-line dark:divide-white/10">
          {list.map(n => { const r = renderNotification(n, lang); const href = n.entity_type && LINK[n.entity_type] ? LINK[n.entity_type](n.entity_id ?? '') : null; return (
            <li key={n.id} className={cx('flex gap-4 p-5', !n.read_at && 'bg-emerald-50/60 dark:bg-white/5')}>
              <span aria-hidden className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read_at ? 'bg-line' : 'bg-gold-400')} />
              <div className="min-w-0 flex-1"><p className="font-extrabold">{r.title}</p><p className="mt-1 text-sm text-ink-soft dark:text-emerald-50/80">{r.body}</p>
                <p className="mt-2 text-xs text-ink-muted">{date(n.created_at, true)}{href && <> · <Link className="font-bold text-emerald-700" href={href}>{t('common.open')}</Link></>}</p></div>
            </li>); })}
        </ul></Card>)}
    </>
  );
}
