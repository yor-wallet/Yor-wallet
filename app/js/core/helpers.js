'use strict';

/* ============================================================
   PORTFOLIO / HELPERS
   ============================================================ */
const PortfolioEngine = Object.freeze({
  snapshot(){
    const rows = (Runtime.wallets || []).map(w => {
      const asset = CRYPTO_ASSETS.find(a => a.id === w.asset || a.symbol === w.asset || a.symbol === w.symbol) || { name: w.symbol, symbol: w.symbol };
      const price = CryptoMarketEngine.price(asset.symbol);
      const change = CryptoMarketEngine.change24h(asset.symbol);
      return {
        walletId: w.id, assetId: asset.id, symbol: asset.symbol, name: asset.name,
        balance: Number(w.balance || 0), available: Number(w.availableBalance || 0),
        price, fiatValue: Number(w.balance || 0) * price, change24h: change, network: w.network
      };
    });
    const total = rows.reduce((s, r) => s + r.fiatValue, 0);
    const changePct = total > 0 ? rows.reduce((s, r) => s + (r.change24h * r.fiatValue), 0) / total : 0;
    return { rows, totalUSD: total, totalChangePct: changePct };
  }
});

function luhnGenerateCardNumber(prefix, length){
  length = length || 16;
  let base = String(prefix || '4532');
  while (base.length < length - 1) base += String(Math.floor(Math.random() * 10));
  let sum = 0, alt = true;
  for (let i = base.length - 1; i >= 0; i--){
    let n = parseInt(base.charAt(i), 10);
    if (alt){ n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + String(check);
}

function qrSvgFor(text){
  const seed = String(text || '');
  const size = 29;
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  function rnd(){ s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }
  const cells = [];
  function finder(ox, oy){ for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++){ const on = (x === 0 || x === 6 || y === 0 || y === 6) || (x >= 2 && x <= 4 && y >= 2 && y <= 4); if (on) cells.push([ox + x, oy + y]); } }
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){ if ((x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8)) continue; if (rnd() > 0.55) cells.push([x, y]); }
  const rects = cells.map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>').join('');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="' + size + '" height="' + size + '" style="width:calc(' + size + 'px*var(--ui));height:calc(' + size + 'px*var(--ui))" fill="#fff"/><g fill="#0A0A0A">' + rects + '</g></svg>';
}

const _sparkCache = new Map();
function sparklineSvg(symbol, w, h){
  w = w || 72; h = h || 32;
  const key = symbol + '|' + w + '|' + h;
  const cached = _sparkCache.get(key);
  if (cached) return cached;
  const seed = String(symbol || 'X').split('').reduce((a, c) => a + c.charCodeAt(0), 7);
  let s = seed >>> 0;
  function rnd(){ s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }
  const n = 20, pts = []; let v = 0.5;
  for (let i = 0; i < n; i++){ v += (rnd() - 0.5) * 0.22; v = Math.max(0.08, Math.min(0.92, v)); pts.push(v); }
  const stepX = w / (n - 1);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + (i * stepX).toFixed(2) + ' ' + ((1 - p) * h).toFixed(2)).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  const color = up ? '#10B981' : '#EF4444';
  const out = '<svg viewBox="0 0 ' + w + ' ' + h + '" fill="none" preserveAspectRatio="none"><path d="' + path + '" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  _sparkCache.set(key, out);
  return out;
}

function receiptToText(r){
  const lines = [];
  lines.push('Friendly Pay — Receipt');
  lines.push('─────────────────────');
  lines.push('Reference: ' + (r.reference || r.transactionId || r.id));
  lines.push('Date: ' + fmtDate(r.createdAt) + ' ' + fmtTime(r.createdAt));
  lines.push('Status: ' + (r.status || 'SUCCESS'));
  lines.push('─────────────────────');
  if (r.beneficiary){
    lines.push('Beneficiary: ' + (r.beneficiary.name || '—'));
    if (r.beneficiary.phone) lines.push('Phone: ' + r.beneficiary.phone);
    if (r.beneficiary.country) lines.push('Country: ' + r.beneficiary.country);
  }
  if (r.network) lines.push('Service: ' + r.network);
  lines.push('─────────────────────');
  const fmtA = (v, s) => v != null ? (s ? CurrencyEngine.formatCrypto(v, s) : CurrencyEngine.format(v, r.currency || 'OMR')) : '—';
  lines.push('Amount sent: ' + fmtA(r.amount, r.asset));
  if (r.destinationAmount != null) lines.push('Amount received: ' + CurrencyEngine.format(r.destinationAmount, r.destinationCurrency || ''));
  if (r.fee) lines.push('Fee: ' + fmtA(r.fee, r.asset));
  if (r.vat) lines.push('VAT: ' + CurrencyEngine.format(r.vat, r.currency || 'OMR'));
  lines.push('Total debited: ' + fmtA(r.total, r.asset));
  lines.push('─────────────────────');
  lines.push('Friendly Pay');
  return lines.join('\n');
}

function downloadBlob(filename, content, mime){
  try {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
    return true;
  } catch(e){ return false; }
}

/* ============================================================
   DESIGN-SYSTEM HELPERS (12.4.0) — shared by dashboard, history, receipt and cards.
   Nothing here invents data: every function only reads what the server returned.
   ============================================================ */
/* Real status -> display state. Only a status the server calls confirmed is "success".
   A failed status is "failed". Anything else (including a missing or unknown status) is "pending": it is never shown as a success. */
const TX_STATES_OK = ['SUCCESS', 'CONFIRMED', 'COMPLETED'];
const TX_STATES_FAIL = ['FAILED', 'REJECTED', 'DECLINED', 'CANCELLED', 'CANCELED', 'EXPIRED', 'ERROR', 'REFUNDED', 'REVERSED'];   /* 12.5.0: a refunded / reversed operation did not go through, it is never shown as pending */
function txState(status){
  const s = String(status == null ? '' : status).toUpperCase();
  return TX_STATES_OK.indexOf(s) !== -1 ? 'success' : TX_STATES_FAIL.indexOf(s) !== -1 ? 'failed' : 'pending';
}
const TX_STATE_ICON = { success:'check', pending:'clock', failed:'close' };

/* ============================================================
   12.6.0 — DISPLAY CURRENCY OF BALANCES (default: US dollar, changeable in Settings › Primary currency)
   Only BALANCES are shown converted. Transfers, fees, receipts and history keep the currency they were made in.
   The rate comes from ExchangeEngine.rate (FX_RATES): the omani rial is pegged to the dollar (1 OMR = 2.6008 USD); every other pair
   comes from the built-in INDICATIVE table (FX_META) — the original amount is always shown next to the converted one and the rate is written out.
   Nothing is converted when a rate is missing (the original amount is then shown as is).
   ============================================================ */
function displayCurrency(){
  const c = String((typeof Runtime !== 'undefined' && Runtime.settings && Runtime.settings.primaryCurrency) || 'USD').toUpperCase();
  return (c === 'OMR' || (typeof FX_RATES !== 'undefined' && FX_RATES[c] != null)) ? c : 'USD';
}
function balanceView(amount, cur){
  const from = String(cur || 'OMR').toUpperCase(), to = displayCurrency();
  const n = Number(amount);
  const same = { amount: isFinite(n) ? n : 0, currency: from, converted: false, rate: 1, orig: null };
  if (!isFinite(n) || from === to || ExchangeEngine.isCrypto(from)) return same;
  const r = ExchangeEngine.rate(from, to);
  if (r == null || !isFinite(r) || r <= 0) return same;
  return { amount: n * r, currency: to, converted: true, rate: r, orig: { amount: n, currency: from } };
}
/* plain-text balance for lists: "USD 27,336.82 (OMR 10,511.262)" when converted, the original amount otherwise */
function balanceText(amount, cur){
  const v = balanceView(amount, cur);
  return v.converted ? CurrencyEngine.format(v.amount, v.currency) + ' (' + CurrencyEngine.format(v.orig.amount, v.orig.currency) + ')' : CurrencyEngine.format(v.amount, v.currency);
}

/* Sign-up phone (12.6.0): selected dial code + what the person typed -> "+<digits>" (8 to 15 digits) or null.
   A typed "+" / "00" number must start with the selected dial code; one national trunk "0" is dropped. */
function signupPhone(dial, raw){
  const dd = String(dial == null ? '' : dial).replace(/\D/g, '');
  const v = String(raw == null ? '' : raw).trim();
  if (!dd || !v || /[^\d+\s().-]/.test(v)) return null;
  let d = v.replace(/[^\d+]/g, '');
  let full;
  if (d.startsWith('+')) full = d.slice(1);
  else if (d.startsWith('00')) full = d.slice(2);
  else { d = d.replace(/^0/, ''); full = dd + d; }
  if (!/^\d+$/.test(full) || full.indexOf(dd) !== 0) return null;
  if (full.length - dd.length < 5 || full.length < 8 || full.length > 15) return null;
  return '+' + full;
}
/* small status pill: "success" is the normal case in a list, so lists only show it for pending / failed (see txRow) */
function statusPill(state, withIcon, label){
  return '<span class="st st-' + state + '">' + (withIcon ? icon(TX_STATE_ICON[state], 11) : '') + escapeHtml(label || t('tx.st.' + state)) + '</span>';
}
/* human name of an operation from the server kind (FIAT_TRANSFER, CRYPTO_BUY, ...); '' when unknown (nothing is guessed) */
function opLabel(x){
  const k = String((x && (x.kind || x.type)) || '').toUpperCase();
  const key = 'op.' + k;
  const v = t(key);
  return v === key ? '' : v;
}
/* skeleton placeholders (loading states): shape only, no data */
function skeletonRows(n){
  let h = '';
  for (let i = 0; i < (n || 4); i++) h += '<div class="sk-row" aria-hidden="true"><span class="sk sk-dot"></span><span class="sk-col"><span class="sk sk-line w60"></span><span class="sk sk-line w35"></span></span><span class="sk sk-line w22"></span></div>';
  return h;
}
function skeletonHome(){
  return '<div class="rv-home" aria-busy="true" aria-live="polite"><div class="rv-top"><span class="sk sk-circ"></span><span class="sk-col" style="flex:1"><span class="sk sk-line w35"></span><span class="sk sk-line w60"></span></span><span class="sk sk-circ"></span></div>' +
    '<div class="ds-balance"><span class="sk sk-line w35"></span><span class="sk sk-line w80 tall"></span></div>' +
    '<div class="rv-acts">' + [1, 2, 3, 4].map(() => '<span class="sk sk-act"></span>').join('') + '</div>' +
    '<div class="rv-list">' + skeletonRows(4) + '</div></div>';
}
/* day heading ("Today", "Yesterday", "Monday 5 October") and the transaction list grouped by day, shared by dashboard and history */
function txDayLabel(ts){
  const d = new Date(ts); if (isNaN(d.getTime())) return '';
  const n = new Date(), s = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((s(n) - s(d)) / 86400000);
  if (diff === 0) return t('ds.today');
  if (diff === 1) return t('ds.yesterday');
  try { return d.toLocaleDateString(LANG === 'ar' ? 'ar' : LANG, { weekday:'long', day:'numeric', month:'long' }); } catch(e){ return d.toDateString(); }
}
function txGroupedHtml(txs, mask){
  let html = '', last = null;
  txs.forEach(tx => {
    const key = txDayLabel(tx.createdAt);
    if (key !== last){ html += (last !== null ? '</div>' : '') + '<div class="rv-day">' + escapeHtml(key) + '</div><div class="rv-list ds-list">'; last = key; }
    html += txRow(tx, mask);
  });
  return last !== null ? html + '</div>' : html;
}
/* empty state: icon + title + sentence (+ optional action HTML). Never shows a fake example. */
function emptyState(iconName, title, body, actionHtml){
  return '<div class="ds-empty"><div class="ds-empty-ic">' + icon(iconName, 26) + '</div><h3>' + escapeHtml(title) + '</h3>' + (body ? '<p>' + escapeHtml(body) + '</p>' : '') + (actionHtml || '') + '</div>';
}
/* copy to clipboard with a visible confirmation; never claims success when the browser refused */
async function copyText(text, okMsg){
  try { await navigator.clipboard.writeText(String(text)); toast(okMsg || t('action.copy'), 'success'); return true; }
  catch(e){
    try {
      const ta = document.createElement('textarea'); ta.value = String(text); ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
      if (ok){ toast(okMsg || t('action.copy'), 'success'); return true; }
    } catch(e2){}
    toast(t('errors.UNKNOWN_ERROR'), 'error'); return false;
  }
}


/* ============================================================
   Friendly ID display (12.9.0)
   The database keeps its identifiers as YOR-XXXXXX (profiles_yor_id_check) and YOR-TX-… (new_tx_reference): they are NOT
   changed. Users see FRD-… everywhere, and may type FRD-, FRIENDLY- or YOR- when searching for someone.
   ============================================================ */
function dispId(v){ return String(v == null ? '' : v).replace(/^YOR-/i, 'FRD-'); }
function normId(v){ return String(v || '').trim().toUpperCase().replace(/^(FRD|FRIENDLY|YOR)[\s-]*/, 'YOR-'); }
