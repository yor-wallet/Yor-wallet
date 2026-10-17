'use strict';

/* ============================================================
   CRYPTO SCREENS
   ============================================================ */
function assetRowC(r){
  const asset = CRYPTO_ASSETS.find(a => a.id === r.assetId) || { tint:'#0D9488' };
  return '<div class="asset-row-c" data-nav="crypto-spot" data-asset="' + r.assetId + '">' + assetLogo(r.symbol, 40, asset.tint) + '<div class="asset-info-c"><div class="asset-name-c">' + escapeHtml(r.name) + '</div><div class="asset-sym-c">' + r.symbol + ' · ' + r.network + '</div></div><div class="asset-right-c"><div class="asset-bal-c">' + escapeHtml(CurrencyEngine.formatCrypto(r.balance, r.symbol)) + '</div><div class="asset-fiat-c">' + escapeHtml(CurrencyEngine.format(r.fiatValue, 'USD')) + '</div></div><span class="asset-change-c ' + (r.change24h >= 0 ? 'up' : 'down') + '">' + (r.change24h >= 0 ? '+' : '') + r.change24h.toFixed(2) + '%</span></div>';
}
function renderCryptoPortfolio(){
  const snap = PortfolioEngine.snapshot();
  const recent = Runtime.transactions.filter(t => t.asset || (t.type || '').startsWith('CRYPTO')).slice(0, 4);
  const emptyActivity = !recent.length;
  return '<div class="topbar"><span class="topbar-title">' + t('crypto.portfolio') + '</span><button class="topbar-action" data-nav="crypto-market" aria-label="' + t('ui.market') + '">' + icon('chart', 18) + '</button></div>' +
    '<div class="portfolio-hero"><div class="crypto-orb" aria-hidden="true"><div class="co-ring"></div><div class="co-sphere"><div class="co-tex"></div><div class="co-light"></div></div></div>' +
      '<div class="hero-bal-label">' + t('crypto.totalValue') + simBadge() + '</div>' +
      '<div class="portfolio-value">' + CurrencyEngine.format(snap.totalUSD, 'USD') + '</div>' +
      '<span class="portfolio-change ' + (snap.totalChangePct >= 0 ? 'up' : 'down') + '">' + icon(snap.totalChangePct >= 0 ? 'trending' : 'arrowDownRight', 14) + ' ' + (snap.totalChangePct >= 0 ? '+' : '') + snap.totalChangePct.toFixed(2) + '% (24h)</span>' +
    '</div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="quick">' +
        quickItem('crypto-buy', 'plus', 'crypto.buy') +
        quickItem('crypto-sell', 'minus', 'crypto.sell') +
        quickItem('crypto-swap', 'swap', 'crypto.swap') +
        quickItem('crypto-send', 'send', 'crypto.send') +
        quickItem('crypto-to-bank', 'bank', 'crypto.toBank') +
      '</div>' +
      '<div class="glass" style="padding:calc(6px*var(--ui)) calc(18px*var(--ui))">' + (snap.rows.length ? snap.rows.map(r => assetRowC(r)).join('') : '<div class="empty"><div class="empty-sub">—</div></div>') + '</div>' +
      '<div class="section"><span class="section-title">' + t('crypto.history') + '</span></div>' +
      '<div class="glass" style="padding:calc(6px*var(--ui)) calc(18px*var(--ui))">' +
        (emptyActivity ? '<div class="empty" style="padding:var(--sp-6) 0"><div class="empty-sub">' + t('home.no_tx') + '</div></div>'
          : recent.map(tx => {
              const credit = tx.direction === 'IN';
              const amt = tx.asset ? CurrencyEngine.formatCrypto(tx.amount, tx.asset) : CurrencyEngine.format(tx.amount, tx.currency || 'OMR');
              const typeLabel = tx.type === 'CRYPTO_BUY' ? t('crypto.buy') : tx.type === 'CRYPTO_SELL' ? t('crypto.sell') : tx.type === 'CRYPTO_SWAP' ? t('crypto.swap') : tx.type === 'CRYPTO_TO_BANK' ? t('crypto.toBank') : t('crypto.send');
              const ic = tx.type === 'CRYPTO_BUY' ? 'arrowDownRight' : tx.type === 'CRYPTO_SELL' ? 'arrowUpRight' : tx.type === 'CRYPTO_SWAP' ? 'swap' : 'send';
              return '<div class="crypto-activity-row" data-action="view-tx" data-tx="' + tx.id + '">' +
                '<div class="crypto-activity-icon ' + (credit ? 'credit' : 'debit') + '">' + icon(ic, 18) + '</div>' +
                '<div class="crypto-activity-body"><div class="crypto-activity-title">' + escapeHtml(typeLabel) + ' ' + escapeHtml(tx.asset || '') + '</div>' +
                  '<div class="crypto-activity-sub">' + escapeHtml(timeAgo(tx.createdAt)) + ' · ' + escapeHtml(tx.status || '') + '</div>' +
                '</div>' +
                '<div class="crypto-activity-amount ' + (credit ? 'credit' : '') + '">' + (credit ? '+' : '−') + escapeHtml(amt) + '</div>' +
              '</div>';
            }).join('')) +
      '</div>' +
    '</div>';
}
Object.assign(YT.en, { svcTitle:'Services', gMoney:'Money', gCrypto:'Crypto', gAccount:'Account & help', movers:'Top movers', tabTop:'Top', tabPrice:'Price', tab24:'24h %', help:'Help', privacy:'Privacy', mkt:'Markets', buyC:'Buy crypto', sellC:'Sell crypto', swapC:'Swap', recvC:'Receive crypto', nets:'Networks' });
Object.assign(YT.fr, { svcTitle:'Services', gMoney:'Argent', gCrypto:'Crypto', gAccount:'Compte et aide', movers:'Plus fortes variations', tabTop:'Top', tabPrice:'Prix', tab24:'24h %', help:'Aide', privacy:'Confidentialité', mkt:'Marchés', buyC:'Acheter', sellC:'Vendre', swapC:'Échanger', recvC:'Recevoir', nets:'Réseaux' });
Object.assign(YT.ar, { svcTitle:'الخدمات', gMoney:'الأموال', gCrypto:'العملات الرقمية', gAccount:'الحساب والمساعدة', movers:'الأكثر تحرّكاً', tabTop:'الأبرز', tabPrice:'السعر', tab24:'24 ساعة %', help:'المساعدة', privacy:'الخصوصية', mkt:'الأسواق', buyC:'شراء', sellC:'بيع', swapC:'مبادلة', recvC:'استلام', nets:'الشبكات' });
function ybRows(assets, sortBy){
  if (!assets.length) return '<div class="yb-empty">—</div>';
  const list = assets.slice();
  if (sortBy === 'change') list.sort((a, b) => b.change24h - a.change24h); else list.sort((a, b) => b.price - a.price);
  if (sortBy === 'rank') list.sort((a, b) => b.price - a.price);
  return list.map(a => '<button class="yb-row" data-nav="crypto-spot" data-asset="' + a.id + '">' + assetLogo(a.symbol, 38, a.tint) +
    '<span class="yb-row-m"><b>' + a.symbol + '</b><small>' + escapeHtml(a.name) + '</small></span>' +
    '<span class="yb-spark">' + sparklineSvg(a.symbol) + '</span>' +
    '<span class="yb-row-p">' + escapeHtml(CurrencyEngine.format(a.price, 'USD')) + '</span>' +
    '<span class="yb-chg ' + (a.change24h >= 0 ? 'up' : 'dn') + '">' + (a.change24h >= 0 ? '+' : '') + a.change24h.toFixed(2) + '%</span></button>').join('');
}
function renderMarketRows(assets, sortBy){ return ybRows(assets, sortBy); }
function renderCryptoMarket(){
  const assets = CryptoMarketEngine.list();
  const mv = assets.slice().sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 3);
  return '<div class="yb"><div class="yb-top"><button class="yb-ic" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 22) + '</span></button>' +
    '<h1 class="yb-title">' + yt('mkt') + '</h1><span style="width:44px"></span></div>' +
    '<div class="yb-sec"><div class="yb-h"><h2>' + yt('movers') + '</h2></div><div class="yb-movers">' +
      mv.map(a => '<button class="yb-mv" data-nav="crypto-spot" data-asset="' + a.id + '"><span class="yb-mv-h">' + assetLogo(a.symbol, 28, a.tint) + '<b>' + a.symbol + '</b></span>' +
        '<span class="yb-mv-p">' + escapeHtml(CurrencyEngine.format(a.price, 'USD')) + '</span><span class="yb-chg ' + (a.change24h >= 0 ? 'up' : 'dn') + '">' + (a.change24h >= 0 ? '+' : '') + a.change24h.toFixed(2) + '%</span></button>').join('') +
    '</div></div>' +
    '<div class="yb-search" style="margin-bottom:12px;cursor:text">' + icon('search', 16) + '<input type="text" id="crypto-market-search" placeholder="' + escapeHtml(yt('search')) + '" autocomplete="off" style="flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font-size:16px;height:100%"></div>' +
    '<div class="yb-tabs" id="crypto-market-sort"><button class="yb-tab" data-sort="rank" aria-pressed="true">' + yt('tabTop') + '</button><button class="yb-tab" data-sort="price" aria-pressed="false">' + yt('tabPrice') + '</button><button class="yb-tab" data-sort="change" aria-pressed="false">' + yt('tab24') + '</button></div>' +
    '<div class="yb-list" id="crypto-market-list">' + ybRows(assets, 'rank') + '</div><div style="height:calc(24px + var(--safe-b))"></div></div>';
}
function renderServices(){
  const G = [
    ['gMoney', [['country-select','send','send']].concat(FEATURES.crypto ? [['banks','bank','banks']] : [], [['cards','cards','cards'],['history','history','history']])],
    ['gCrypto', [['crypto-buy','plus','buyC'],['crypto-sell','minus','sellC'],['crypto-swap','swap','swapC'],['crypto-receive','receive','recvC'],['crypto-market','chart','mkt'],['crypto-networks','network','nets']]],
    ['gAccount', [['profile','user','profile'],['notifications','bell','notifications'],['settings','settings','settings'],['help','globe','help'],['privacy','shield','privacy']]]
  ];
  /* groupe Blockchain (YOR-USDT, réseau de test) : administrateurs uniquement */
  if (FEATURES.crypto && typeof canUseChain === 'function' && canUseChain()) G.splice(1, 0, ['gChain', [['chain','wallet','chainTile']]]);
  if (!FEATURES.crypto) G.splice(1, 1);                  /* the Crypto group is hidden with the rest of the crypto section */
  return '<div class="yb"><div class="yb-top"><h1 class="yb-title" style="text-align:start">' + yt('svcTitle') + '</h1></div>' +
    G.map(g => '<section class="yb-sec"><div class="yb-h"><h2>' + yt(g[0]) + '</h2></div><div class="yb-grid">' +
      g[1].map(s => '<button class="yb-svc" data-nav="' + s[0] + '"><span class="yb-svc-i">' + icon(s[1], 24) + '</span><span class="yb-svc-t">' + yt(s[2]) + '</span></button>').join('') + '</div></section>').join('') +
    '<div style="height:calc(24px + var(--safe-b))"></div></div>';
}
