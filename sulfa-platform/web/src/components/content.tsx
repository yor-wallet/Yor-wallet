'use client';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { PublicPage } from './shell';
import { Card, PageHeader } from './ui';
import { Reveal } from './motion';

/** text page built from numbered keys: `${p}.title`, `${p}.intro`, `${p}.s{i}.t`, `${p}.s{i}.b` */
export function ContentPage({ p, sections, after, before }: { p: string; sections: number; after?: ReactNode; before?: ReactNode }) {
  const { t } = useI18n();
  return (
    <PublicPage narrow>
      <PageHeader title={t(`${p}.title`)} sub={t(`${p}.intro`)} />
      {before}
      <div className="space-y-4">
        {Array.from({ length: sections }, (_, i) => (
          <Reveal key={i} delay={Math.min(i, 4) * 80}><Card as="article">
            <h2 className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">{t(`${p}.s${i + 1}.t`)}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft dark:text-emerald-50/80">{t(`${p}.s${i + 1}.b`)}</p>
          </Card></Reveal>))}
      </div>
      {after}
    </PublicPage>
  );
}
