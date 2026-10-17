'use strict';

/* ============================================================
   HISTORY (12.4.0) — transactions grouped by day, filtered by type or by REAL status.
   The card screens live in js/features/v12.js (the old card screens with a network name were removed: those cards are not issued).
   ============================================================ */
const isCryptoTx = x => !!(x.asset || String(x.type || '').startsWith('CRYPTO'));
/* 12.12.0 : with the crypto section hidden, crypto operations are not listed (home, history). Money transfers only. */
function visibleTransactions(txs){ return FEATURES.crypto ? txs : (txs || []).filter(x => !isCryptoTx(x)); }
/* 12.14.0 — search + period + direction, combined with the status chips. Memory only (reset when the app restarts). */
const HIST = { q:'', period:'all', dir:'all' };
function histPeriodStart(p){
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === 'today') return d.getTime();
  if (p === '7d') return d.getTime() - 6 * 864e5;
  if (p === '30d') return d.getTime() - 29 * 864e5;
  if (p === 'month'){ d.setDate(1); return d.getTime(); }
  return 0;
}
function historyFilter(txs, f){
  txs = visibleTransactions(txs);
  const from = histPeriodStart(HIST.period);
  if (from) txs = txs.filter(x => (x.createdAt || 0) >= from);
  if (HIST.dir === 'in') txs = txs.filter(x => x.direction === 'IN');
  if (HIST.dir === 'out') txs = txs.filter(x => x.direction !== 'IN');
  if (HIST.q && typeof txMatches === 'function') txs = txs.filter(x => txMatches(x, HIST.q));
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
Object.assign(TR.en, { 'hist.q':'Name, number, reference or amount', 'hist.period':'Period', 'hist.dir':'Direction', 'hist.p.all':'All dates', 'hist.p.today':'Today', 'hist.p.7d':'7 days', 'hist.p.30d':'30 days', 'hist.p.month':'This month', 'hist.d.all':'In and out', 'hist.d.in':'Received', 'hist.d.out':'Sent' });
Object.assign(TR.fr, { 'hist.q':'Nom, numéro, référence ou montant', 'hist.period':'Période', 'hist.dir':'Sens', 'hist.p.all':'Toutes les dates', 'hist.p.today':'Aujourd’hui', 'hist.p.7d':'7 jours', 'hist.p.30d':'30 jours', 'hist.p.month':'Ce mois-ci', 'hist.d.all':'Entrées et sorties', 'hist.d.in':'Reçues', 'hist.d.out':'Envoyées' });
Object.assign(TR.ar, { 'hist.q':'الاسم أو الرقم أو المرجع أو المبلغ', 'hist.period':'الفترة', 'hist.dir':'الاتجاه', 'hist.p.all':'كل التواريخ', 'hist.p.today':'اليوم', 'hist.p.7d':'7 أيام', 'hist.p.30d':'30 يوماً', 'hist.p.month':'هذا الشهر', 'hist.d.all':'الوارد والصادر', 'hist.d.in':'المستلمة', 'hist.d.out':'المرسلة' });
function renderHistory(){
  const chip = (f, key, on) => '<button class="chip" data-filter="' + f + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + t(key) + '</button>';
  return '<div class="topbar"><span style="width:calc(44px*var(--ui))"></span><span class="topbar-title">' + t('nav.history') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body ds-hist" style="padding-top:0">' +
      '<div class="chips ds-chips" role="group" aria-label="' + escapeHtml(t('nav.history')) + '">' +
        chip('all', 'filter.all', true) + (FEATURES.crypto ? chip('fiat', 'filter.fiat') + chip('crypto', 'filter.crypto') : '') + chip('pending', 'filter.pending') + chip('failed', 'filter.failed') +
      '</div>' +
      '<div class="hist-tools">' +
        '<div class="field-box hist-search"><span class="hist-s-ic" aria-hidden="true">' + icon('search', 18) + '</span><input id="hist-q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="' + escapeHtml(t('hist.q')) + '" aria-label="' + escapeHtml(t('hist.q')) + '"></div>' +
        '<div class="chips ds-chips hist-sub" role="group" aria-label="' + escapeHtml(t('hist.period')) + '">' + ['all', 'today', '7d', '30d', 'month'].map(p => '<button class="chip" data-hp="' + p + '" aria-pressed="' + (HIST.period === p ? 'true' : 'false') + '">' + escapeHtml(t('hist.p.' + p)) + '</button>').join('') + '</div>' +
        '<div class="chips ds-chips hist-sub" role="group" aria-label="' + escapeHtml(t('hist.dir')) + '">' + ['all', 'in', 'out'].map(d => '<button class="chip" data-hd="' + d + '" aria-pressed="' + (HIST.dir === d ? 'true' : 'false') + '">' + escapeHtml(t('hist.d.' + d)) + '</button>').join('') + '</div>' +
      '</div>' +
      '<div id="history-list" aria-live="polite">' + historyListHtml('all') + '</div>' +
    '</div>';
}
