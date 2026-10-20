'use client';
import { ContentPage } from '@/components/content';
import { LinkButton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
export default function Page() {
  const { t } = useI18n();
  return <ContentPage p="elig" sections={4} after={<div className="mt-8 flex flex-wrap gap-3"><LinkButton href="/signup/">{t('nav.start')}</LinkButton><LinkButton href="/simulator/" variant="secondary">{t('nav.simulator')}</LinkButton></div>} />;
}
