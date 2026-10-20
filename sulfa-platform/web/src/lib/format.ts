import type { Lang } from './i18n/dict';

const LOCALE: Record<Lang, string> = { ar: 'ar-OM', fr: 'fr-FR', en: 'en-GB' };
export const CURRENCY_LABEL: Record<Lang, string> = { ar: 'ر.ع', fr: 'OMR', en: 'OMR' };

/** OMR always has 3 decimals (baisa). Latin digits everywhere for amounts and references. */
export function money(v: number | string | null | undefined, lang: Lang, withCurrency = true): string {
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  const s = new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: 3, maximumFractionDigits: 3, numberingSystem: 'latn' } as Intl.NumberFormatOptions)
    .format(Number.isFinite(n) ? n : 0);
  return withCurrency ? `${s} ${CURRENCY_LABEL[lang]}` : s;
}

export function date(v: string | number | Date | null | undefined, lang: Lang, withTime = false): string {
  if (v == null || v === '') return '—';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    numberingSystem: 'latn', timeZone: 'Asia/Muscat',
  } as Intl.DateTimeFormatOptions).format(d);
}

export const percent = (v: number, lang: Lang) =>
  new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 4, numberingSystem: 'latn' } as Intl.NumberFormatOptions).format(v) + ' %';
