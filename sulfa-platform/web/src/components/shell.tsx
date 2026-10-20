'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LANGS, LANG_NAMES, type Lang } from '@/lib/i18n/dict';
import { AuthProvider, useAuth } from '@/lib/auth';
import type { AdminRole } from '@/lib/types';
import { cx, Loading, NotConfigured, Alert, LinkButton } from './ui';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    try { if (localStorage.getItem('sulfa_theme') === 'dark') document.documentElement.classList.add('dark'); } catch {}
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return <I18nProvider><AuthProvider>{children}</AuthProvider></I18nProvider>;
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="SULFA — سلفه">
      <span className="grid h-10 w-10 place-items-center rounded-[14px_14px_14px_5px] bg-gradient-to-br from-emerald-500 to-emerald-900 text-2xl font-black text-white shadow-[0_8px_20px_rgba(8,127,91,.25)]">س</span>
      {!compact && <span className="leading-none"><b className="block text-[21px] font-black text-emerald-950 dark:text-white">سلفه</b><small className="font-latin text-[9px] font-bold tracking-[2px] text-ink-muted">SULFA FINANCE</small></span>}
    </Link>
  );
}

export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={cx('relative', className)}>
      <span className="sr-only">{t('nav.language')}</span>
      <select value={lang} onChange={e => setLang(e.target.value as Lang)} className="min-h-10 cursor-pointer rounded-xl border border-line bg-white/80 px-3 text-sm font-bold text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
        {LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
      </select>
    </label>
  );
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const flip = () => {
    const d = !dark; setDark(d); document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('sulfa_theme', d ? 'dark' : 'light'); } catch {}
  };
  return <button onClick={flip} aria-pressed={dark} aria-label={t('nav.theme')} className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white/80 text-lg dark:border-white/10 dark:bg-white/5">{dark ? '☾' : '☀'}</button>;
}

const PUBLIC_NAV = [['/how-it-works/', 'nav.how'], ['/simulator/', 'nav.simulator'], ['/eligibility/', 'nav.eligibility'], ['/faq/', 'nav.faq'], ['/about/', 'nav.about']] as const;

export function SiteHeader() {
  const { t } = useI18n(); const { session, role } = useAuth();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md dark:border-white/10 dark:bg-emerald-950/85">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Brand />
        <nav className="mx-auto hidden items-center gap-6 text-sm font-semibold text-ink-soft lg:flex dark:text-emerald-100/80" aria-label={t('nav.main')}>
          {PUBLIC_NAV.map(([h, k]) => <Link key={h} href={h} className={cx('hover:text-emerald-700', path === h && 'text-emerald-700')}>{t(k)}</Link>)}
        </nav>
        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <LangSwitch className="hidden sm:block" /><ThemeToggle />
          {session
            ? <LinkButton href={role ? '/admin/' : '/client/'} className="hidden sm:inline-flex">{role ? t('nav.admin') : t('nav.my_space')}</LinkButton>
            : <><LinkButton href="/login/" variant="ghost" className="hidden sm:inline-flex">{t('nav.login')}</LinkButton><LinkButton href="/signup/" className="hidden sm:inline-flex">{t('nav.start')}</LinkButton></>}
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white lg:hidden dark:border-white/10 dark:bg-white/5" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(o => !o)}>☰</button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-4 pb-4 lg:hidden dark:border-white/10 dark:bg-emerald-950" aria-label={t('nav.main')}>
          {PUBLIC_NAV.map(([h, k]) => <Link key={h} href={h} className="block border-b border-line py-3 font-semibold dark:border-white/10">{t(k)}</Link>)}
          <div className="mt-3 flex flex-wrap gap-2"><LangSwitch />
            {session ? <LinkButton href={role ? '/admin/' : '/client/'}>{role ? t('nav.admin') : t('nav.my_space')}</LinkButton>
              : <><LinkButton href="/login/" variant="secondary">{t('nav.login')}</LinkButton><LinkButton href="/signup/">{t('nav.start')}</LinkButton></>}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const links = [['/help/', 'nav.help'], ['/contact/', 'nav.contact'], ['/privacy/', 'nav.privacy'], ['/terms/', 'nav.terms'], ['/regulatory/', 'nav.regulatory']] as const;
  return (
    <footer className="mt-20 border-t border-line bg-white/60 dark:border-white/10 dark:bg-emerald-950/40">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div><Brand /><p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">{t('footer.tagline')}</p></div>
        <nav className="flex flex-wrap content-start gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft dark:text-emerald-100/80" aria-label={t('nav.footer')}>
          {links.map(([h, k]) => <Link key={h} href={h} className="hover:text-emerald-700">{t(k)}</Link>)}
        </nav>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-ink-muted dark:border-white/10">© {new Date().getFullYear()} SULFA — سلفه. {t('footer.rights')}</p>
    </footer>
  );
}

export function PublicPage({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <SiteHeader />
      <main id="main" className={cx('mx-auto px-4 py-8 sm:px-6 sm:py-12', narrow ? 'max-w-3xl' : 'max-w-6xl')}><NotConfigured />{children}</main>
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- signed-in areas */
const CLIENT_NAV = [
  ['/client/', 'cn.dashboard', '◈'], ['/client/apply/', 'cn.apply', '＋'], ['/client/applications/', 'cn.applications', '▤'],
  ['/client/documents/', 'cn.documents', '⎙'], ['/client/installments/', 'cn.installments', '◷'], ['/client/withdraw/', 'cn.withdraw', '↗'],
  ['/client/history/', 'cn.history', '≡'], ['/client/notifications/', 'cn.notifications', '◔'], ['/client/settings/', 'cn.settings', '⚙'],
] as const;
const ADMIN_NAV = [
  ['/admin/', 'an.overview', '◈'], ['/admin/applications/', 'an.applications', '▤'], ['/admin/documents/', 'an.documents', '⎙'],
  ['/admin/clients/', 'an.clients', '☺'], ['/admin/withdrawals/', 'an.withdrawals', '↗'], ['/admin/repayments/', 'an.repayments', '↙'],
  ['/admin/ledger/', 'an.ledger', '≡'], ['/admin/notifications/', 'an.notifications', '◔'], ['/admin/audit/', 'an.audit', '⌕'],
  ['/admin/operators/', 'an.operators', '⇄'], ['/admin/settings/', 'an.settings', '⚙'],
] as const;

function Guard({ admin, roles, children }: { admin?: boolean; roles?: AdminRole[]; children: ReactNode }) {
  const { ready, session, role, profile, profileError } = useAuth(); const { t } = useI18n();
  const router = useRouter(); const path = usePathname();
  useEffect(() => { if (ready && !session) router.replace('/login/?next=' + encodeURIComponent(path)); }, [ready, session, router, path]);
  if (!ready || !session) return <Loading />;
  if (admin && !role) return <div className="p-6"><Alert tone="error" title={t('guard.admin_only')}>{t('guard.admin_only_body')}</Alert></div>;
  if (roles && role && !roles.includes(role)) return <Alert tone="warn" title={t('guard.role_title')}>{t('guard.role_body', { roles: roles.join(', ') })}</Alert>;
  if (!admin && profileError) return <div className="p-6"><Alert tone="error" title={t('guard.profile_error')}>{t('err.uncertain_hint')}</Alert></div>;
  if (!admin && profile && profile.account_status !== 'ACTIVE') return <div className="p-6"><Alert tone="error" title={t('guard.suspended')}>{t('guard.suspended_body')}</Alert></div>;
  return <>{children}</>;
}

function SpaceShell({ nav, title, admin, children }: { nav: readonly (readonly [string, string, string])[]; title: string; admin?: boolean; children: ReactNode }) {
  const { t } = useI18n(); const { profile, role, signOut, session } = useAuth();
  const path = usePathname(); const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : session?.user.email ?? '';
  const out = async () => { await signOut(); router.replace('/'); };
  const navEl = (
    <nav className="space-y-1" aria-label={title}>
      {nav.map(([h, k, ic]) => {
        const on = h === path || (h !== '/client/' && h !== '/admin/' && path.startsWith(h));
        return <Link key={h} href={h} aria-current={on ? 'page' : undefined} className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition', on ? 'bg-emerald-700 text-white shadow-card' : 'text-ink-soft hover:bg-emerald-50 dark:text-emerald-100/80 dark:hover:bg-white/5')}><span aria-hidden className="w-5 text-center">{ic}</span>{t(k)}</Link>;
      })}
    </nav>
  );
  return (
    <div className="min-h-screen overflow-x-clip lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-e border-line bg-white/70 p-4 lg:block dark:border-white/10 dark:bg-emerald-950/50">
        <div className="sticky top-4 space-y-6"><Brand />
          {admin && <span className="inline-block rounded-full bg-gold-100 px-3 py-1 text-xs font-extrabold text-gold-600">{t('admin.badge')} · {role ? t('role.' + role) : ''}</span>}
          {navEl}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-white/10 dark:bg-emerald-950/85">
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white lg:hidden dark:border-white/10 dark:bg-white/5" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(o => !o)}>☰</button>
          <span className="lg:hidden"><Brand compact /></span>
          <span className="truncate text-sm text-ink-muted">{t('nav.hello', { name })}</span>
          <div className="ms-auto flex items-center gap-2"><LangSwitch className="hidden sm:block" /><ThemeToggle />
            <button onClick={out} className="min-h-10 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-white/5">{t('nav.logout')}</button></div>
        </header>
        {open && <div className="border-b border-line bg-white p-4 lg:hidden dark:border-white/10 dark:bg-emerald-950">{navEl}<div className="mt-3"><LangSwitch /></div></div>}
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><NotConfigured /><Guard admin={admin}>{children}</Guard></main>
      </div>
    </div>
  );
}

export const ClientShell = ({ children }: { children: ReactNode }) => { const { t } = useI18n(); return <SpaceShell nav={CLIENT_NAV} title={t('cn.title')}>{children}</SpaceShell>; };
export const AdminShell = ({ children }: { children: ReactNode }) => { const { t } = useI18n(); return <SpaceShell nav={ADMIN_NAV} title={t('an.title')} admin>{children}</SpaceShell>; };
export function RoleGate({ roles, children }: { roles: AdminRole[]; children: ReactNode }) { return <Guard admin roles={roles}>{children}</Guard>; }
