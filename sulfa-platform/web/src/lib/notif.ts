import { translate, type Lang } from './i18n/dict';
import { money, date } from './format';
import type { Notification } from './types';

/** Every template key the SQL functions can emit (tests/unit/notifications.test.ts checks this against the migration). */
export const TEMPLATE_KEYS = [
  'WELCOME', 'ACCOUNT_UPDATED', 'DOCUMENT_RECEIVED', 'DOCUMENT_VERIFIED', 'DOCUMENT_REJECTED', 'DOCUMENT_REUPLOAD_REQUIRED',
  'APPLICATION_SUBMITTED', 'APPLICATION_IN_REVIEW', 'APPLICATION_DOCUMENTS_REQUIRED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED',
  'DISBURSEMENT_PREPARING', 'DISBURSEMENT_CONFIRMED', 'REPAYMENT_RECEIVED', 'INSTALLMENT_DUE',
  'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_CONFIRMED', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_FAILED',
  'ACCOUNT_STATUS_ACTIVE', 'ACCOUNT_STATUS_SUSPENDED', 'ACCOUNT_STATUS_CLOSED', 'IDENTITY_VERIFIED',
] as const;

/** Builds the text from the recorded parameters only (amounts, references, dates copied from the database rows). */
export function renderNotification(n: Pick<Notification, 'template_key' | 'params'>, lang: Lang): { title: string; body: string } {
  const p = (n.params ?? {}) as Record<string, unknown>;
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries(p)) {
    if (val == null) continue;
    if (['amount', 'outstanding', 'monthly'].includes(k)) v[k] = money(val as number, lang);
    else if (['date', 'first_due'].includes(k)) v[k] = date(String(val), lang);
    else if (k === 'document_type') v[k] = translate(lang, 'doc.' + String(val));
    else if (k === 'identity_status') v[k] = translate(lang, 'id.' + String(val));
    else v[k] = String(val);
  }
  const key = TEMPLATE_KEYS.includes(n.template_key as never) ? n.template_key : 'GENERIC';
  let body = translate(lang, `n.${key}.b`, v);
  if (v.reason && ['DOCUMENT_REJECTED', 'DOCUMENT_REUPLOAD_REQUIRED', 'APPLICATION_REJECTED', 'APPLICATION_DOCUMENTS_REQUIRED', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_FAILED', 'ACCOUNT_STATUS_SUSPENDED', 'ACCOUNT_STATUS_CLOSED'].includes(key))
    body += ' ' + translate(lang, 'n.reason', { reason: v.reason });
  return { title: translate(lang, `n.${key}.t`), body };
}
