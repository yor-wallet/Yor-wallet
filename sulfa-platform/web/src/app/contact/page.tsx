'use client';
import { ContentPage } from '@/components/content';
import { Card } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '';
export default function Page() {
  const { t } = useI18n();
  return <ContentPage p="contact" sections={2} before={
    <Card className="mb-4">
      {SUPPORT ? <p>{t('contact.email')} <a className="font-bold text-emerald-700 underline" dir="ltr" href={`mailto:${SUPPORT}`}>{SUPPORT}</a></p>
        : <p className="text-ink-muted">{t('contact.no_email')}</p>}
    </Card>} />;
}
