'use client';
import { PublicPage } from '@/components/shell';
import { Simulator } from '@/components/simulator';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
export default function Page() {
  const { t } = useI18n();
  return <PublicPage><PageHeader title={t('sim.title')} sub={t('sim.sub')} /><Simulator /></PublicPage>;
}
