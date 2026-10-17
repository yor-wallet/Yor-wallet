'use strict';

/* 12.3.7 : envoi crypto vers n'importe quelle adresse acceptée par le serveur (voir AddressEngine dans core/domain.js) */
Object.assign(TR.en, {
  'crypto.addressUnusual':'This does not look like a standard {net} address. You can still continue, but check the address and the network carefully.',
  'crypto.addressLooksLike':'It looks like a {other} address.',
  'errors.ADDRESS_NETWORK_MISMATCH':'This address belongs to a Friendly Pay wallet on another network. Pick the matching network.',
  'errors.UNSUPPORTED_NETWORK':'This coin is not available on this network.'
});
Object.assign(TR.fr, {
  'crypto.addressUnusual':'Cette adresse ne ressemble pas à une adresse {net} standard. Vous pouvez continuer, mais vérifiez bien l\'adresse et le réseau.',
  'crypto.addressLooksLike':'Elle ressemble à une adresse {other}.',
  'errors.ADDRESS_NETWORK_MISMATCH':'Cette adresse est celle d\'un portefeuille Friendly Pay sur un autre réseau. Choisissez le réseau correspondant.',
  'errors.UNSUPPORTED_NETWORK':'Cette crypto n\'est pas disponible sur ce réseau.'
});
Object.assign(TR.ar, {
  'crypto.addressUnusual':'هذا العنوان لا يشبه عنوان {net} المعتاد. يمكنك المتابعة، لكن تحقق جيداً من العنوان والشبكة.',
  'crypto.addressLooksLike':'يبدو أنه عنوان {other}.',
  'errors.ADDRESS_NETWORK_MISMATCH':'هذا العنوان لمحفظة Friendly Pay على شبكة أخرى. اختر الشبكة المطابقة.',
  'errors.UNSUPPORTED_NETWORK':'هذه العملة غير متاحة على هذه الشبكة.'
});

function renderCryptoNetworks(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.networks') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0"><div class="select-list">' + NETWORKS.map(n => '<div class="select-item" style="cursor:default">' + networkLogo(n, 40) + '<span class="select-body"><div class="select-name">' + escapeHtml(n.name) + '</div><div class="select-sub">' + n.supportedAssets.join(' · ') + '</div></span></div>').join('') + '</div></div>';
}
function renderCryptoSpot(){
  const aid = (location.hash.split('/')[3] || 'btc');
  const asset = CRYPTO_ASSETS.find(a => a.id === aid) || CRYPTO_ASSETS[0];
  const price = CryptoMarketEngine.price(asset.symbol);
  const change = CryptoMarketEngine.change24h(asset.symbol);
  const high = price * (1 + Math.abs(change) / 100 * 0.6);
  const low = price * (1 - Math.abs(change) / 100 * 0.6);
  const vol = price * 12500;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + asset.symbol + ' / USD</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="spot-header">' + assetLogo(asset.symbol, 48, asset.tint) + '<div class="spot-pair"><div class="spot-pair-name">' + asset.symbol + '</div><div class="spot-pair-quote">' + escapeHtml(asset.name) + '</div></div></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass" style="padding:var(--sp-4) var(--sp-5)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div class="caption">' + t('crypto.price') + '</div><div class="amount amount-md" style="margin-top:calc(4px*var(--ui))">' + CurrencyEngine.format(price, 'USD') + '</div></div><span class="asset-change-c ' + (change >= 0 ? 'up' : 'down') + '">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%</span></div>' +
        '<div style="margin-top:var(--sp-4);height:calc(56px*var(--ui))">' + sparklineSvg(asset.symbol, 320, 56) + '</div>' +
        '<div class="crypto-stats-grid">' +
          '<div class="crypto-stat"><div class="crypto-stat-l">High 24h</div><div class="crypto-stat-v">' + CurrencyEngine.format(high, 'USD') + '</div></div>' +
          '<div class="crypto-stat"><div class="crypto-stat-l">Low 24h</div><div class="crypto-stat-v">' + CurrencyEngine.format(low, 'USD') + '</div></div>' +
          '<div class="crypto-stat"><div class="crypto-stat-l">Volume</div><div class="crypto-stat-v">' + CurrencyEngine.format(vol, 'USD') + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="crypto-spot-actions">' +
        '<button class="primary" data-spot-action="buy" data-asset="' + asset.id + '">' + icon('plus', 18) + '<span>' + t('crypto.buy') + '</span></button>' +
        '<button data-spot-action="sell" data-asset="' + asset.id + '">' + icon('minus', 18) + '<span>' + t('crypto.sell') + '</span></button>' +
        '<button data-spot-action="swap" data-asset="' + asset.id + '">' + icon('swap', 18) + '<span>' + t('crypto.swap') + '</span></button>' +
      '</div>' +
    '</div>';
}
function renderCryptoBuy(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.buy') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0"><div class="select-list">' + CRYPTO_ASSETS.map(a => '<button class="select-item ' + (CRYPTO_FLOW.fromMain.asset === a.id ? 'selected' : '') + '" data-crypto-buy-asset="' + a.id + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + a.symbol + ' · ' + CurrencyEngine.format(CryptoMarketEngine.price(a.symbol), 'USD') + '</div></span></button>').join('') + '</div></div>';
}
function renderCryptoSell(){
  const wallets = Runtime.wallets.filter(w => Number(w.balance) > 0);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.sell') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' + (wallets.length ? '<div class="select-list">' + wallets.map(w => { const a = CRYPTO_ASSETS.find(x => x.id === w.assetId || x.symbol === w.symbol); if (!a) return ''; return '<button class="select-item ' + (CRYPTO_FLOW.sell.asset === a.id ? 'selected' : '') + '" data-crypto-sell-asset="' + a.id + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + escapeHtml(CurrencyEngine.formatCrypto(w.balance, a.symbol)) + '</div></span></button>'; }).join('') + '</div>' : '<div class="empty">' + icon('crypto', 56) + '</div>') + '</div>';
}
function renderCryptoSwap(){
  const wallets = Runtime.wallets.filter(w => Number(w.balance) > 0);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.swap') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0"><div class="select-list">' + wallets.map(w => { const a = CRYPTO_ASSETS.find(x => x.id === w.assetId || x.symbol === w.symbol); if (!a) return ''; return '<button class="select-item ' + (CRYPTO_FLOW.swap.fromAsset === a.id ? 'selected' : '') + '" data-swap-from="' + a.id + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + escapeHtml(CurrencyEngine.formatCrypto(w.balance, a.symbol)) + '</div></span></button>'; }).join('') + '</div></div>';
}
function renderCryptoSend(){
  const wallets = Runtime.wallets.filter(w => Number(w.balance) > 0);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.send') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' + (wallets.length ? '<div class="select-list">' + wallets.map(w => { const a = CRYPTO_ASSETS.find(x => x.id === w.assetId || x.symbol === w.symbol); if (!a) return ''; return '<button class="select-item ' + (CRYPTO_FLOW.send.asset === a.id ? 'selected' : '') + '" data-send-asset="' + a.id + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + (w.network || '') + ' · ' + escapeHtml(CurrencyEngine.formatCrypto(w.balance, a.symbol)) + '</div></span></button>'; }).join('') + '</div>' : '<div class="empty">' + icon('crypto', 56) + '</div>') + '</div>';
}
function _swipeHtml(label){
  return '<div class="swipe-track" id="swipe" role="presentation"><div class="swipe-fill"></div><div class="swipe-label" id="swipe-label">' + escapeHtml(label) + '</div><div class="swipe-thumb" id="swipe-thumb" tabindex="0" role="button" aria-label="' + escapeHtml(label) + '">' + icon('send', 24) + '</div></div>' +
    '<button class="btn btn-primary swipe-kb-confirm" id="swipe-kb-confirm" aria-label="' + escapeHtml(label) + '">' + icon('send', 20) + '<span>' + escapeHtml(label) + '</span></button>';
}
function renderCryptoBuyAmount(){
  const aid = CRYPTO_FLOW.fromMain.asset;
  if (!aid){ R.go('crypto-buy'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === aid);
  if (!asset){ R.go('crypto-buy'); return ''; }
  const price = CryptoMarketEngine.price(asset.symbol);
  const main = mainAccount();
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.buy') + ' ' + asset.symbol + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div style="display:flex;align-items:center;gap:calc(14px*var(--ui));padding:var(--sp-5) 0">' + assetLogo(asset.symbol, 48, asset.tint) +
        '<div><div style="font-size:calc(17px*var(--ui));font-weight:700">' + escapeHtml(asset.name) + '</div>' +
        '<div class="caption" style="margin-top:calc(3px*var(--ui))">1 ' + asset.symbol + ' = ' + CurrencyEngine.format(price, 'USD') + '</div></div></div>' +
      '<div class="field"><label class="field-label">' + t('crypto.fiatSpend') + ' (OMR)</label><div class="field-box"><input type="number" id="buy-fiat" inputmode="decimal" placeholder="0.000" min="0.1" step="0.001"></div></div>' +
      '<div class="crypto-quick-amounts" data-quick-target="buy-fiat"><button data-quick-pct="25">25%</button><button data-quick-pct="50">50%</button><button data-quick-pct="75">75%</button><button data-quick-pct="100">MAX</button></div>' +
      '<div id="buy-preview" style="min-height:calc(56px*var(--ui));margin:var(--sp-2) 0"></div>' +
      '<div class="field-err" id="buy-err" role="alert"></div>' +
      '<div class="caption" style="text-align:end;margin-bottom:var(--sp-3)">' + t('crypto.balance') + ' : <strong>' + CurrencyEngine.format(main.availableBalance, 'OMR') + '</strong></div>' +
      '<button class="btn btn-primary" id="buy-next" disabled>' + icon('check', 18) + '<span>' + t('crypto.confirmBuy') + '</span></button>' +
    '</div>';
}
function renderCryptoSellAmount(){
  const aid = CRYPTO_FLOW.sell.asset;
  if (!aid){ R.go('crypto-sell'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === aid);
  const wallet = Runtime.wallets.find(w => w.assetId === aid || w.symbol === (asset && asset.symbol));
  if (!asset || !wallet){ R.go('crypto-sell'); return ''; }
  const price = CryptoMarketEngine.price(asset.symbol);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.sell') + ' ' + asset.symbol + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div style="display:flex;align-items:center;gap:calc(14px*var(--ui));padding:var(--sp-5) 0">' + assetLogo(asset.symbol, 48, asset.tint) +
        '<div><div style="font-size:calc(17px*var(--ui));font-weight:700">' + escapeHtml(asset.name) + '</div>' +
        '<div class="caption" style="margin-top:calc(3px*var(--ui))">1 ' + asset.symbol + ' = ' + CurrencyEngine.format(price, 'USD') + '</div></div></div>' +
      '<div class="field"><label class="field-label">' + t('crypto.youPay') + ' (' + asset.symbol + ')</label><div class="field-box"><input type="number" id="sell-amt" inputmode="decimal" placeholder="0.00000000" min="0"></div></div>' +
      '<div class="crypto-quick-amounts" data-quick-target="sell-amt"><button data-quick-pct="25">25%</button><button data-quick-pct="50">50%</button><button data-quick-pct="75">75%</button><button data-quick-pct="100">MAX</button></div>' +
      '<div id="sell-preview" style="min-height:calc(56px*var(--ui));margin:var(--sp-2) 0"></div>' +
      '<div class="field-err" id="sell-err" role="alert"></div>' +
      '<div class="caption" style="text-align:end;margin-bottom:var(--sp-3)">' + t('crypto.balance') + ' : <strong>' + CurrencyEngine.formatCrypto(wallet.balance, asset.symbol) + '</strong></div>' +
      '<button class="btn btn-primary" id="sell-next" disabled>' + icon('check', 18) + '<span>' + t('crypto.confirmSell') + '</span></button>' +
    '</div>';
}
function renderCryptoSwapTo(){
  const fromId = CRYPTO_FLOW.swap.fromAsset;
  if (!fromId){ R.go('crypto-swap'); return ''; }
  const fromAsset = CRYPTO_ASSETS.find(a => a.id === fromId);
  const others = CRYPTO_ASSETS.filter(a => a.id !== fromId);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.chooseSwapTo') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass-subtle" style="padding:calc(12px*var(--ui)) calc(16px*var(--ui));display:flex;align-items:center;gap:calc(12px*var(--ui));margin-bottom:var(--sp-4)">' +
        '<div class="caption" style="flex:1">' + t('crypto.from') + ' : <strong>' + escapeHtml(fromAsset ? fromAsset.name : '') + '</strong></div>' + icon('swap', 18) + '</div>' +
      '<div class="select-list">' + others.map(a => '<button class="select-item ' + (CRYPTO_FLOW.swap.toAsset === a.id ? 'selected' : '') + '" data-swap-to="' + a.id + '">' +
        assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + a.symbol + ' · ' + CurrencyEngine.format(CryptoMarketEngine.price(a.symbol), 'USD') + '</div></span></button>').join('') +
      '</div></div>';
}
function renderCryptoSwapAmount(){
  const fromId = CRYPTO_FLOW.swap.fromAsset;
  const toId = CRYPTO_FLOW.swap.toAsset;
  if (!fromId || !toId){ R.go('crypto-swap'); return ''; }
  const fromAsset = CRYPTO_ASSETS.find(a => a.id === fromId);
  const toAsset = CRYPTO_ASSETS.find(a => a.id === toId);
  const wallet = Runtime.wallets.find(w => w.assetId === fromId || w.symbol === fromAsset.symbol);
  const fromPrice = CryptoMarketEngine.price(fromAsset.symbol);
  const toPrice = CryptoMarketEngine.price(toAsset.symbol);
  const rate = toPrice > 0 ? fromPrice / toPrice : 0;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + escapeHtml(fromAsset.symbol) + ' → ' + escapeHtml(toAsset.symbol) + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div style="display:flex;align-items:center;gap:calc(10px*var(--ui));padding:var(--sp-5) 0">' +
        assetLogo(fromAsset.symbol, 40, fromAsset.tint) + '<div style="padding:calc(6px*var(--ui))">' + icon('swap', 20) + '</div>' + assetLogo(toAsset.symbol, 40, toAsset.tint) +
        '<div style="margin-left:8px;flex:1"><div style="font-size:calc(13px*var(--ui));color:var(--text-2)">' + t('crypto.rate') + '</div><div style="font-weight:700">1 ' + fromAsset.symbol + ' ≈ ' + rate.toFixed(6) + ' ' + toAsset.symbol + '</div></div></div>' +
      '<div class="field"><label class="field-label">' + t('crypto.youPay') + ' (' + fromAsset.symbol + ')</label><div class="field-box"><input type="number" id="swap-amt" inputmode="decimal" placeholder="0.00000000" min="0"></div></div>' +
      '<div class="crypto-quick-amounts" data-quick-target="swap-amt"><button data-quick-pct="25">25%</button><button data-quick-pct="50">50%</button><button data-quick-pct="75">75%</button><button data-quick-pct="100">MAX</button></div>' +
      '<div id="swap-preview" style="min-height:calc(56px*var(--ui));margin:var(--sp-2) 0"></div>' +
      '<div class="field-err" id="swap-err" role="alert"></div>' +
      '<div class="caption" style="text-align:end;margin-bottom:var(--sp-3)">' + t('crypto.balance') + ' : <strong>' + (wallet ? CurrencyEngine.formatCrypto(wallet.balance, fromAsset.symbol) : '0') + '</strong></div>' +
      '<button class="btn btn-primary" id="swap-next" disabled>' + icon('check', 18) + '<span>' + t('crypto.confirmSwap') + '</span></button>' +
    '</div>';
}
function renderCryptoSendNetwork(){
  const aid = CRYPTO_FLOW.send.asset;
  if (!aid){ R.go('crypto-send'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === aid);
  if (!asset){ R.go('crypto-send'); return ''; }
  const nets = NetworkEngine.compatible(asset.symbol);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.chooseNetwork') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div style="display:flex;align-items:center;gap:calc(12px*var(--ui));padding:var(--sp-4) 0">' + assetLogo(asset.symbol, 40, asset.tint) + '<div class="caption">' + t('crypto.send') + ' ' + escapeHtml(asset.name) + '</div></div>' +
      '<div class="select-list">' + nets.map(n => '<button class="select-item ' + (CRYPTO_FLOW.send.network === n.id ? 'selected' : '') + '" data-send-net="' + n.id + '">' +
        networkLogo(n, 40) + '<span class="select-body"><div class="select-name">' + escapeHtml(n.name) + '</div><div class="select-sub">' + n.supportedAssets.join(' · ') + '</div></span></button>').join('') +
      '</div></div>';
}
function renderCryptoSendAddress(){
  const aid = CRYPTO_FLOW.send.asset;
  const nid = CRYPTO_FLOW.send.network;
  if (!aid || !nid){ R.go('crypto-send'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === aid);
  const net = NetworkEngine.get(nid);
  const needsMemo = AddressEngine.requiresMemo(nid);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + escapeHtml(asset.symbol) + ' · ' + escapeHtml(net.name) + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="field"><label class="field-label">' + t('crypto.enterSendAddr') + '</label><div class="field-box"><input type="text" id="send-addr" class="ltr" placeholder="' + escapeHtml(AddressEngine.generate(nid).slice(0, 18)) + '…" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off"></div></div>' +
      (needsMemo ? '<div class="field"><label class="field-label">' + t('crypto.memo') + '</label><div class="field-box"><input type="text" id="send-memo" class="ltr" placeholder="Memo" autocomplete="off" spellcheck="false"></div></div>' : '') +
      '<div id="addr-status" style="min-height:calc(48px*var(--ui));margin:var(--sp-2) 0"></div>' +
      '<div class="net-warning" style="margin-bottom:var(--sp-4)">' + icon('warn', 16) + '<span>' + t('crypto.networkWarning') + '</span></div>' +
      '<button class="btn btn-primary" id="addr-next" disabled>' + icon('check', 18) + '<span>' + t('common.next') + '</span></button>' +
    '</div>';
}
function renderCryptoSendAmount(){
  const aid = CRYPTO_FLOW.send.asset;
  const nid = CRYPTO_FLOW.send.network;
  const addr = CRYPTO_FLOW.send.address;
  if (!aid || !nid || !addr){ R.go('crypto-send'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === aid);
  const wallet = Runtime.wallets.find(w => w.assetId === aid || w.symbol === asset.symbol);
  const gas = GasFeeEngine.estimate(nid, asset.symbol);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.send') + ' ' + asset.symbol + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass-subtle" style="padding:calc(12px*var(--ui)) calc(16px*var(--ui));border-radius:var(--r-md);margin-bottom:var(--sp-4);word-break:break-all">' +
        '<div class="caption">' + t('crypto.address') + '</div>' +
        '<div class="addr-box ltr" style="margin-top:calc(6px*var(--ui));font-size:calc(13px*var(--ui))">' + escapeHtml(AddressEngine.short(addr)) + '</div></div>' +
      '<div class="field"><label class="field-label">' + t('crypto.amount') + ' (' + asset.symbol + ')</label><div class="field-box"><input type="number" id="sendamt-input" inputmode="decimal" placeholder="0.00000000" min="0"></div></div>' +
      '<div class="crypto-quick-amounts" data-quick-target="sendamt-input"><button data-quick-pct="25">25%</button><button data-quick-pct="50">50%</button><button data-quick-pct="75">75%</button><button data-quick-pct="100">MAX</button></div>' +
      '<div id="sendamt-preview" style="min-height:calc(56px*var(--ui));margin:var(--sp-2) 0"></div>' +
      '<div class="field-err" id="sendamt-err" role="alert"></div>' +
      '<div class="caption" style="text-align:end;margin-bottom:calc(4px*var(--ui))">' + t('crypto.networkFee') + ' : ≈ ' + CurrencyEngine.formatCrypto(gas.amount, asset.symbol) + '</div>' +
      '<div class="caption" style="text-align:end;margin-bottom:var(--sp-3)">' + t('crypto.balance') + ' : <strong>' + (wallet ? CurrencyEngine.formatCrypto(wallet.balance, asset.symbol) : '0') + '</strong></div>' +
      '<button class="btn btn-primary" id="sendamt-next" disabled>' + icon('check', 18) + '<span>' + t('crypto.confirmSend') + '</span></button>' +
    '</div>';
}
function renderCryptoReview(){
  const p = CRYPTO_FLOW.pending;
  if (!p){ R.go('crypto'); return ''; }
  const d = p.data;
  const titles = { BUY: t('crypto.reviewBuy'), SELL: t('crypto.reviewSell'), SWAP: t('crypto.reviewSwap'), SEND: t('crypto.reviewSend') };
  const rows = [];
  if (p.kind === 'BUY'){ rows.push([t('crypto.fiatSpend'), CurrencyEngine.format(d.fiatAmount, 'OMR')]); rows.push([t('crypto.youGet'), CurrencyEngine.formatCrypto(d.amount, (d.asset || {}).symbol || '')]); }
  if (p.kind === 'SELL'){ rows.push([t('crypto.youPay'), CurrencyEngine.formatCrypto(d.amount, (d.asset || {}).symbol || '')]); rows.push([t('crypto.fiatReceive'), CurrencyEngine.format(d.fiatReceived || 0, 'OMR')]); }
  if (p.kind === 'SWAP'){ rows.push([t('crypto.youPay'), CurrencyEngine.formatCrypto(d.amount, (d.asset || {}).symbol || '')]); rows.push([t('crypto.youGet'), CurrencyEngine.formatCrypto(d.destinationAmount || 0, (d.toAssetObj || {}).symbol || '')]); }
  if (p.kind === 'SEND'){ rows.push([t('crypto.amount'), CurrencyEngine.formatCrypto(d.amount, (d.asset || {}).symbol || '')]); rows.push([t('crypto.address'), d.toAddress || '', true]); if (d.memo) rows.push([t('crypto.memo'), d.memo]); }
  rows.push([t('crypto.fee'), CurrencyEngine.formatCrypto(d.fee || 0, (d.asset || {}).symbol || '')]);
  if (d.networkFee) rows.push([t('crypto.networkFee'), CurrencyEngine.formatCrypto(d.networkFee, (d.asset || {}).symbol || '')]);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + escapeHtml(titles[p.kind] || 'Review') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass-elevated receipt-panel">' +
        '<div class="receipt-benef"><div class="receipt-avatar">' + icon('crypto', 24) + '</div><div class="receipt-benef-body">' +
          '<div class="receipt-benef-label">' + escapeHtml(p.kind) + '</div>' +
          '<div class="receipt-benef-name">' + escapeHtml((d.asset || {}).name || '') + (d.toAssetObj ? ' → ' + escapeHtml(d.toAssetObj.name) : '') + '</div>' +
          (d.network ? '<div class="receipt-benef-phone ltr">' + escapeHtml(d.network) + '</div>' : '') +
        '</div></div>' +
      '</div>' +
      '<div class="summary">' + rows.map((r, i) => '<div class="summary-row' + (i === rows.length - 1 && !d.networkFee ? ' total' : '') + '"><span class="summary-k">' + escapeHtml(r[0]) + '</span><span class="summary-v' + (r[2] ? ' ltr' : '') + '"' + (r[2] ? ' style="word-break:break-all;max-width:70%"' : '') + '>' + escapeHtml(r[1]) + '</span></div>').join('') + '</div>' +
      '<div style="margin-top:var(--sp-4)">' + _swipeHtml(t('crypto.swipe')) + '</div>' +
    '</div>';
}
