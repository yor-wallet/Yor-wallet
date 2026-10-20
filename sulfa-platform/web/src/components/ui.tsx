'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useI18n } from '@/lib/i18n';
import { describeError, type RpcFailure } from '@/lib/errors';
import { configured } from '@/lib/supabase';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- buttons, links */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
const VARIANT: Record<Variant, string> = {
  primary: 'gloss bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:brightness-110',
  secondary: 'border border-line bg-white text-emerald-900 hover:border-emerald-300 dark:border-white/10 dark:bg-white/5 dark:text-emerald-50',
  ghost: 'text-emerald-800 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-white/5',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  gold: 'bg-gradient-to-b from-gold-300 to-gold-500 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_10px_22px_-8px_rgba(168,122,34,.6)] hover:brightness-105',
};
const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[15px] font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.98]';

export function Button({ variant = 'primary', busy, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || busy} aria-busy={busy || undefined} className={cx(BTN, VARIANT[variant], className)}>
      {busy && <Spinner small />}{children}
    </button>
  );
}
export function LinkButton({ href, variant = 'primary', className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return <Link href={href} className={cx(BTN, VARIANT[variant], className)}>{children}</Link>;
}

/* ---------------------------------------------------------------- layout atoms */
export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-2xl border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-emerald-950/60', className)}>{children}</As>;
}
export function PageHeader({ title, sub, actions, desktopOnly }: { title: string; sub?: string; actions?: ReactNode; desktopOnly?: boolean }) {
  return (
    <header className={cx('mb-6 flex-wrap items-end justify-between gap-3 animate-rise', desktopOnly ? 'hidden lg:flex' : 'page-head flex')}>
      <div><h1 className="text-[28px] font-black leading-tight text-emerald-950 dark:text-white sm:text-3xl">{title}</h1>{sub && <p className="mt-1 text-ink-muted dark:text-emerald-100/70">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'gold' | 'emerald' | 'plain' }) {
  return (
    <div className={cx('rounded-2xl border p-4', tone === 'gold' ? 'border-gold-300/60 bg-gold-100/60 dark:bg-gold-500/10' : tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-800/20' : 'border-line bg-white dark:border-white/10 dark:bg-white/5')}>
      <div className="text-sm text-ink-muted dark:text-emerald-100/70">{label}</div>
      <div className="mt-1 font-num text-xl font-extrabold tabular-nums text-emerald-950 dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted dark:text-emerald-100/60">{hint}</div>}
    </div>
  );
}
export function Spinner({ small }: { small?: boolean }) {
  return <span role="status" aria-hidden className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', small ? 'h-4 w-4' : 'h-6 w-6')} />;
}
export function Loading() {
  const { t } = useI18n();
  return <div className="flex items-center gap-3 p-6 text-ink-muted"><Spinner /> {t('common.loading')}</div>;
}
export function Empty({ title, children, art }: { title: string; children?: ReactNode; art?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center dark:border-white/15">
      {art ?? <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-white/5">◌</div>}
      <p className="font-bold text-emerald-950 dark:text-white">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'error' | 'success'; title?: string; children?: ReactNode }) {
  const c = { info: 'border-emerald-200 bg-emerald-50 text-emerald-900', warn: 'border-gold-300 bg-gold-100 text-emerald-950', error: 'border-red-200 bg-red-50 text-red-900', success: 'border-emerald-300 bg-emerald-100 text-emerald-950' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border p-4 text-sm leading-relaxed', c)}>
      {title && <p className="mb-1 font-bold">{title}</p>}{children}
    </div>
  );
}
export function ErrorBox({ failure, onRetry }: { failure: RpcFailure | null; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!failure) return null;
  return (
    <Alert tone={failure.certain ? 'error' : 'warn'} title={failure.certain ? t('err.title') : t('err.uncertain_title')}>
      <p>{t(failure.key)}</p>
      {!failure.certain && <p className="mt-1">{t('err.uncertain_hint')}</p>}
      {onRetry && <button className="mt-2 font-bold underline" onClick={onRetry}>{failure.certain ? t('common.retry') : t('common.check_again')}</button>}
    </Alert>
  );
}
export function NotConfigured() {
  const { t } = useI18n();
  if (configured) return null;
  return <Alert tone="warn" title={t('cfg.missing_title')}>{t('cfg.missing_body')}</Alert>;
}

/* ---------------------------------------------------------------- status badge */
const TONES: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  wait: 'bg-gold-100 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
};
const TONE_OF: Record<string, keyof typeof TONES> = {
  VERIFIED: 'ok', APPROVED: 'ok', DISBURSED: 'ok', COMPLETED: 'ok', PAID: 'ok', CONFIRMED: 'ok', RECORDED: 'ok', ACTIVE: 'ok',
  SUBMITTED: 'wait', IN_REVIEW: 'wait', PENDING: 'wait', DOCUMENTS_REQUIRED: 'wait', DISBURSEMENT_PENDING: 'wait', RECEIVED: 'wait',
  IN_VERIFICATION: 'wait', PROCESSING: 'wait', DUE: 'wait', PARTIAL: 'wait', REUPLOAD_REQUIRED: 'wait', NOT_SUBMITTED: 'neutral',
  REJECTED: 'bad', FAILED: 'bad', SUSPENDED: 'bad', CLOSED: 'neutral', CANCELLED: 'neutral', REVERSED: 'neutral', REPLACED: 'neutral', DRAFT: 'neutral',
};
export function Badge({ status, group = 'st' }: { status: string; group?: string }) {
  const { t } = useI18n();
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', TONES[TONE_OF[status] ?? 'neutral'])}>{t(`${group}.${status}`)}</span>;
}

/* ---------------------------------------------------------------- form fields */
const FIELD = 'w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-white/15 dark:bg-white/5 dark:text-white';
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-emerald-950 dark:text-emerald-50">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-bold text-red-700">{error}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(FIELD, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(FIELD, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(FIELD, p.className)} />;

/* ---------------------------------------------------------------- tables */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-muted dark:border-white/10">{head.map((h, i) => <th key={i} className="px-2 py-2 text-start font-bold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line dark:divide-white/10">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('px-2 py-3 align-middle', className)}>{children}</td>;
export const Num = ({ children }: { children: ReactNode }) => <span dir="ltr" className="font-num tabular-nums">{children}</span>;

/* ---------------------------------------------------------------- dialog with mandatory reason / reference */
export type DialogSpec = {
  title: string; body?: ReactNode; confirm: string; tone?: 'primary' | 'danger' | 'gold';
  reason?: 'required' | 'optional'; reference?: 'required'; amount?: { label: string; max?: number }; extra?: ReactNode;
  run: (v: { reason: string; reference: string; amount: string }) => Promise<void>;
};
export function Dialog({ spec, onClose }: { spec: DialogSpec | null; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState(''); const [reference, setReference] = useState(''); const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState<RpcFailure | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (spec) { setReason(''); setReference(''); setAmount(''); setFail(null); if (!d.open) d.showModal(); } else if (d.open) d.close();
  }, [spec]);
  if (!spec) return <dialog ref={ref} />;
  const missing = (spec.reason === 'required' && !reason.trim()) || (spec.reference === 'required' && !reference.trim()) || (spec.amount && !(Number(amount) > 0));
  const go = async () => {
    if (busy || missing) return;
    setBusy(true); setFail(null);
    try { await spec.run({ reason: reason.trim(), reference: reference.trim(), amount }); onClose(); }
    catch (e) { setFail(describeError(e)); }
    finally { setBusy(false); }
  };
  return (
    <dialog ref={ref} onClose={onClose} onCancel={e => { if (busy) e.preventDefault(); }}
      className="app-dialog w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-0 text-ink shadow-lift backdrop:bg-emerald-950/50 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-emerald-950 dark:text-white">
      <div className="space-y-4 p-6">
        <h2 className="text-xl font-extrabold">{spec.title}</h2>
        {spec.body && <div className="text-sm leading-relaxed text-ink-soft dark:text-emerald-100/80">{spec.body}</div>}
        {spec.amount && <Field label={spec.amount.label}><Input inputMode="decimal" dir="ltr" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} /></Field>}
        {spec.reference && <Field label={t('dlg.reference')} hint={t('dlg.reference_hint')}><Input dir="ltr" value={reference} maxLength={80} onChange={e => setReference(e.target.value)} /></Field>}
        {spec.reason && <Field label={spec.reason === 'required' ? t('dlg.reason_required') : t('dlg.reason_optional')}><Textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></Field>}
        {spec.extra}
        <ErrorBox failure={fail} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant={spec.tone ?? 'primary'} onClick={go} busy={busy} disabled={!!missing}>{spec.confirm}</Button>
        </div>
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- data loading */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | null; error: RpcFailure | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<RpcFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true; setLoading(true);
    fn().then(d => { if (alive) { setData(d); setError(null); } }, e => { if (alive) setError(describeError(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN(x => x + 1), []);
  return { data, error, loading, reload };
}

/** unwraps a supabase-js result: throws the error object so describeError can classify it */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function must<T = any>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}
