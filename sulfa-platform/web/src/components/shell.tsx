'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LANGS, LANG_NAMES, type Lang } from '@/lib/i18n/dict';
import { AuthProvider, useAuth } from '@/lib/auth';
import type { AdminRole } from '@/lib/types';
import { cx, Loading, NotConfigured, Alert, LinkButton } from './ui';
import { Icon, type IconName } from './icons';
import { supabase } from '@/lib/supabase';

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
  return <button onClick={flip} aria-pressed={dark} aria-label={t('nav.theme')} className="press grid h-10 w-10 place-items-center rounded-xl border border-line bg-white/80 dark:border-white/10 dark:bg-white/5"><Icon name={dark ? 'moon' : 'sun'} size={19} /></button>;
}

const PUBLIC_ICON: Record<string, IconName> = { '/how-it-works/': 'apply', '/simulator/': 'chart', '/eligibility/': 'check', '/faq/': 'search', '/about/': 'shield' };
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
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white lg:hidden dark:border-white/10 dark:bg-white/5" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(o => !o)}><Icon name="more" size={24} strokeWidth={3} /></button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('nav.menu')}>
        <ul className="grid grid-cols-3 gap-2">
          {PUBLIC_NAV.map(([h, k], n) => (
            <li key={h} className="sheet-item" style={{ animationDelay: `${60 + n * 35}ms` }}><Link href={h} className="press flex h-full flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-card dark:bg-white/5">
              <span className={cx('tile-3d grid h-12 w-12 place-items-center rounded-2xl', TILE[n % 4])}><Icon name={PUBLIC_ICON[h] ?? 'file'} /></span>{t(k)}</Link></li>))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-card dark:bg-white/5"><span className="flex items-center gap-2 text-sm font-bold"><Icon name="globe" size={18} />{t('nav.language')}</span><LangSwitch /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {session ? <LinkButton href={role ? '/admin/' : '/client/'} className="col-span-2">{role ? t('nav.admin') : t('nav.my_space')}</LinkButton>
            : <><LinkButton href="/login/" variant="secondary">{t('nav.login')}</LinkButton><LinkButton href="/signup/">{t('nav.start')}</LinkButton></>}
        </div>
      </Sheet>
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
type NavItem = readonly [href: string, key: string, icon: IconName];
const CLIENT_NAV: readonly NavItem[] = [
  ['/client/', 'cn.dashboard', 'home'], ['/client/apply/', 'cn.apply', 'plus'], ['/client/applications/', 'cn.applications', 'file'],
  ['/client/documents/', 'cn.documents', 'id'], ['/client/installments/', 'cn.installments', 'calendar'], ['/client/withdraw/', 'cn.withdraw', 'out'],
  ['/client/history/', 'cn.history', 'history'], ['/client/notifications/', 'cn.notifications', 'bell'], ['/client/settings/', 'cn.settings', 'settings'],
];
/** the four tabs shown in the bottom bar on phones; everything else is in the "More" sheet */
const CLIENT_TABS = ['/client/', '/client/applications/', '/client/installments/', '/client/notifications/'];
const ADMIN_NAV: readonly NavItem[] = [
  ['/admin/', 'an.overview', 'chart'], ['/admin/applications/', 'an.applications', 'file'], ['/admin/documents/', 'an.documents', 'id'],
  ['/admin/clients/', 'an.clients', 'users'], ['/admin/withdrawals/', 'an.withdrawals', 'out'], ['/admin/repayments/', 'an.repayments', 'in'],
  ['/admin/ledger/', 'an.ledger', 'ledger'], ['/admin/notifications/', 'an.notifications', 'bell'], ['/admin/audit/', 'an.audit', 'search'],
  ['/admin/operators/', 'an.operators', 'plug'], ['/admin/settings/', 'an.settings', 'settings'],
];
const ADMIN_TABS = ['/admin/', '/admin/applications/', '/admin/documents/', '/admin/withdrawals/'];
/** short labels for the tab bar (the full names stay in menus and titles) */
const TAB_LABEL: Record<string, string> = { '/client/': 'tab.home', '/client/applications/': 'tab.apps', '/client/installments/': 'tab.inst', '/client/notifications/': 'tab.notif',
  '/admin/': 'tab.overview', '/admin/applications/': 'tab.apps', '/admin/documents/': 'tab.docs', '/admin/withdrawals/': 'tab.wd' };

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

const TILE = ['', 'tile-gold', 'tile-blue', 'tile-ink'];
function isOn(h: string, path: string) { return h === path || (h !== '/client/' && h !== '/admin/' && path.startsWith(h)); }

/** bottom sheet (phones) / popover (desktop) */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label={title} className="sheet-backdrop absolute inset-0 bg-emerald-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] bg-paper px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-lift dark:bg-emerald-950">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15 dark:bg-white/20" />
        <p className="mb-3 px-1 text-lg font-black">{title}</p>
        {children}
      </div>
    </div>
  );
}

function SpaceShell({ nav, tabs, title, admin, children }: { nav: readonly NavItem[]; tabs: string[]; title: string; admin?: boolean; children: ReactNode }) {
  const { t } = useI18n(); const { profile, role, signOut, session } = useAuth();
  const path = usePathname(); const router = useRouter();
  const [more, setMore] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => setMore(false), [path]);
  useEffect(() => {                                                       // unread badge on the bell tab (own notifications, RLS)
    if (!supabase || !session || admin) return;
    supabase.from('sulfa_notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [session, admin, path]);
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : session?.user.email ?? '';
  const out = async () => { await signOut(); router.replace('/app/'); };
  const current = nav.find(([h]) => isOn(h, path)) ?? nav[0];
  const tabItems = tabs.map(h => nav.find(n => n[0] === h)!).filter(Boolean);
  const moreOn = !tabItems.some(([h]) => isOn(h, path));
  return (
    <div className="app-root min-h-[100dvh] overflow-x-clip lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden border-e border-line bg-white/70 p-4 lg:block dark:border-white/10 dark:bg-emerald-950/50">
        <div className="sticky top-4 space-y-6"><Brand />
          {admin && <span className="inline-block rounded-full bg-gold-100 px-3 py-1 text-xs font-extrabold text-gold-600">{t('admin.badge')} · {role ? t('role.' + role) : ''}</span>}
          <nav className="space-y-1" aria-label={title}>
            {nav.map(([h, k, ic]) => {
              const on = isOn(h, path);
              return <Link key={h} href={h} aria-current={on ? 'page' : undefined} className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition', on ? 'tile-3d' : 'text-ink-soft hover:bg-emerald-50 dark:text-emerald-100/80 dark:hover:bg-white/5')}><Icon name={ic} size={20} />{t(k)}</Link>;
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0">
        {/* top bar: app-style on phones (title of the current tab), full header on desktop */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-emerald-950/80">
          <div className="flex items-center gap-3">
            <span className="lg:hidden"><Brand compact /></span>
            <span className="min-w-0 truncate text-sm text-ink-muted lg:block">{t('nav.hello', { name })}</span>
            <div className="ms-auto flex items-center gap-2"><LangSwitch className="hidden sm:block" /><ThemeToggle />
              <button onClick={out} className="hidden min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 sm:inline-flex dark:text-emerald-100 dark:hover:bg-white/5"><Icon name="logout" size={18} />{t('nav.logout')}</button></div>
          </div>
          <p className="shell-title mt-2 text-[28px] font-black leading-tight text-emerald-950 lg:hidden dark:text-white">{current[0] === '/client/' ? t('dash.title', { name: profile?.first_name ?? '' }) : t(current[1])}</p>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5 sm:px-6 sm:py-8 lg:pb-8"><NotConfigured /><Guard admin={admin}>{children}</Guard></main>
      </div>

      {/* bottom tab bar (phones / tablets) */}
      <nav aria-label={title} className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-emerald-950/85">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabItems.map(([h, k, ic]) => {
            const on = isOn(h, path);
            return (
              <li key={h}><Link href={h} aria-current={on ? 'page' : undefined} className={cx('tab relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10.5px] font-bold', on ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink-muted')}>
                <span className={cx('grid h-8 w-14 place-items-center rounded-full transition', on && 'tile-3d')}><Icon name={ic} size={21} /></span>
                <span className="max-w-full truncate px-1">{t(TAB_LABEL[h] ?? k)}</span>
                {ic === 'bell' && unread > 0 && <span className="absolute end-[22%] top-1.5 grid min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-paper">{unread > 9 ? '9+' : unread}</span>}
              </Link></li>);
          })}
          <li><button onClick={() => setMore(true)} aria-expanded={more} className={cx('tab flex w-full flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10.5px] font-bold', moreOn ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink-muted')}>
            <span className={cx('grid h-8 w-14 place-items-center rounded-full', moreOn && 'tile-3d')}><Icon name="more" size={26} strokeWidth={3} /></span>{t('nav.more')}</button></li>
        </ul>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={t('nav.more')}>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card dark:bg-white/5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-700 text-lg font-black text-white">{(profile?.first_name || name || '?').slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><p className="truncate font-extrabold">{name}</p><p className="truncate text-xs text-ink-muted" dir="ltr">{session?.user.email}</p></div>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {nav.filter(([h]) => !tabs.includes(h)).map(([h, k, ic], n) => (
            <li key={h} className="sheet-item" style={{ animationDelay: `${60 + n * 35}ms` }}><Link href={h} className="press flex h-full flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-card dark:bg-white/5">
              <span className={cx('tile-3d grid h-12 w-12 place-items-center rounded-2xl', TILE[n % 4])}><Icon name={ic} /></span>{t(k)}</Link></li>))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-card dark:bg-white/5"><span className="flex items-center gap-2 text-sm font-bold"><Icon name="globe" size={18} />{t('nav.language')}</span><LangSwitch /></div>
        <button onClick={out} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 p-3.5 font-extrabold text-red-700 dark:bg-red-500/10 dark:text-red-300"><Icon name="logout" size={18} />{t('nav.logout')}</button>
      </Sheet>
    </div>
  );
}

export const ClientShell = ({ children }: { children: ReactNode }) => { const { t } = useI18n(); return <SpaceShell nav={CLIENT_NAV} tabs={CLIENT_TABS} title={t('cn.title')}>{children}</SpaceShell>; };
export const AdminShell = ({ children }: { children: ReactNode }) => { const { t } = useI18n(); return <SpaceShell nav={ADMIN_NAV} tabs={ADMIN_TABS} title={t('an.title')} admin>{children}</SpaceShell>; };
export function RoleGate({ roles, children }: { roles: AdminRole[]; children: ReactNode }) { return <Guard admin roles={roles}>{children}</Guard>; }
