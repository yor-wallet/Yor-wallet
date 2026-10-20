'use client';
import { useI18n } from '@/lib/i18n';
import type { AppEvent } from '@/lib/types';
import { Badge } from './ui';

export function Timeline({ events }: { events: AppEvent[] }) {
  const { t, date } = useI18n();
  return (
    <ol className="relative space-y-5 border-s-2 border-emerald-100 ps-5 dark:border-white/10">
      {events.map(e => (
        <li key={e.id} className="relative">
          <span className="absolute -start-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 dark:border-emerald-950" />
          <div className="flex flex-wrap items-center gap-2"><Badge status={e.to_status} /><span className="text-xs text-ink-muted">{date(e.created_at, true)} · {t('actor.' + e.actor_role)}</span></div>
          {e.reason && <p className="mt-1 text-sm text-ink-soft dark:text-emerald-50/80">{e.reason}</p>}
        </li>))}
    </ol>
  );
}
