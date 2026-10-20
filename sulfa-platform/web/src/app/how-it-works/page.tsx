'use client';
import { PublicPage } from '@/components/shell';
import { LinkButton, PageHeader } from '@/components/ui';
import { Steps } from '@/components/marketing';
import { useI18n } from '@/lib/i18n';
export default function Page() {
  const { t } = useI18n();
  return <PublicPage><PageHeader title={t('how.title')} sub={t('how.sub')} /><Steps /><div className="mt-8"><LinkButton href="/signup/">{t('nav.start')}</LinkButton></div></PublicPage>;
}
