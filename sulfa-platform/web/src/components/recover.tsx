'use client';
/* Crash safety net. A screen that throws never leaves a blank page: the user sees a calm message and can retry.
   - after a new version is published, an open tab can ask for code files that no longer exist (ChunkLoadError):
     the page reloads itself once, silently;
   - a second crash in a row wipes the local cache (lib/vault), in case a corrupt copy caused it. */
import { Component, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { vault } from '@/lib/vault';

const isChunk = (e: unknown) => /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(String((e as Error)?.message ?? e));

function reloadOnce(): boolean {
  try { if (sessionStorage.getItem('sulfa_reloaded')) return false; sessionStorage.setItem('sulfa_reloaded', '1'); } catch { return false; }
  location.reload(); return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', e => { if (isChunk(e.reason)) reloadOnce(); });
  window.addEventListener('error', e => { if (isChunk(e.error ?? e.message)) reloadOnce(); });
  // a normal visit clears the one-reload flag a little later, so the next real update can reload again
  window.setTimeout(() => { try { sessionStorage.removeItem('sulfa_reloaded'); } catch { /* private mode */ } }, 15_000);
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto my-16 max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-card dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-100 text-2xl">!</div>
      <h2 className="text-xl font-black text-emerald-950 dark:text-white">{t('crash.title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('crash.body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onRetry} className="press rounded-2xl bg-emerald-700 px-6 py-3 font-extrabold text-white">{t('crash.retry')}</button>
        <button onClick={() => location.reload()} className="press rounded-2xl border border-line px-6 py-3 font-extrabold text-emerald-900 dark:border-white/10 dark:text-white">{t('crash.reload')}</button>
      </div>
    </div>
  );
}

export class Recover extends Component<{ children: ReactNode }, { failed: boolean; count: number }> {
  state = { failed: false, count: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    if (isChunk(error) && reloadOnce()) return;
    const count = this.state.count + 1;
    if (count >= 2) vault.wipe();
    this.setState({ count });
    console.error('[SULFA] screen error', error);
  }
  render() { return this.state.failed ? <Fallback onRetry={() => this.setState({ failed: false })} /> : this.props.children; }
}
