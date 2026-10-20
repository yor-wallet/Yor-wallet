'use client';
import { PublicPage } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { FaqList } from '@/components/marketing';
import { useI18n } from '@/lib/i18n';
export default function Page() {
  const { t } = useI18n();
  return <PublicPage narrow><PageHeader title={t('faq.title')} sub={t('faq.sub')} /><FaqList /></PublicPage>;
}
