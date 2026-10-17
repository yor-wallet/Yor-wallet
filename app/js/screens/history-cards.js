'use strict';

/* ============================================================
   HISTORY (12.4.0) — transactions grouped by day, filtered by type or by REAL status.
   The card screens live in js/features/v12.js (the old card screens with a network name were removed: those cards are not issued).
   ============================================================ */
const isCryptoTx = x => !!(x.asset || String(x.type || '').startsWith('CRYPTO'));
/* 12.12.0 : with the crypto section hidden, crypto operations are not listed (home, history). Money transfers only. */
function visibleTransactions(txs){ return FEATURES.crypto ? txs : (txs || []).filter(x => !isCryptoTx(x)); }
function historyFilter(txs, f){
  txs = visibleTransactions(txs);
  if (f === 'fiat') return txs.filter(x => !x.asset && !String(x.type || '').startsWith('CRYPTO'));
  if (f === 'crypto') return txs.filter(x => x.asset || String(x.type || '').startsWith('CRYPTO'));
  if (f === 'pending') return txs.filter(x => txState(x.status) === 'pending');
  if (f === 'failed') return txs.filter(x => txState(x.status) === 'failed');
  return txs;
}
function historyListHtml(f){
  const all = visibleTransactions(Runtime.transactions || []);
  if (!all.length && !Runtime.ctx) return skeletonRows(5);                 /* data not loaded yet */
  const txs = historyFilter(all, f || 'all');
  if (!txs.length) return all.length ? emptyState('search', t('ds.nohist_title'), t('ds.nofilter_body')) : emptyState('history', t('ds.nohist_title'), t('ds.nohist_body'));
  return txGroupedHtml(txs, false);
}
function renderHistory(){
  const chip = (f, key, on) => '<button class="chip" data-filter="' + f + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + t(key) + '</button>';
  return '<div class="topbar"><span style="width:calc(44px*var(--ui))"></span><span class="topbar-title">' + t('nav.history') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body ds-hist" style="padding-top:0">' +
      '<div class="chips ds-chips" role="group" aria-label="' + escapeHtml(t('nav.history')) + '">' +
        chip('all', 'filter.all', true) + (FEATURES.crypto ? chip('fiat', 'filter.fiat') + chip('crypto', 'filter.crypto') : '') + chip('pending', 'filter.pending') + chip('failed', 'filter.failed') +
      '</div>' +
      '<div id="history-list" aria-live="polite">' + historyListHtml('all') + '</div>' +
    '</div>';
}
