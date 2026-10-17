'use strict';

function renderCryptoReceive(){
  const wallets = Runtime.wallets;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.receive') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0"><div class="select-list">' + (wallets.length ? wallets.map(w => { const a = CRYPTO_ASSETS.find(x => x.id === w.assetId || x.symbol === w.symbol); if (!a) return ''; const net = NetworkEngine.get(w.network); return '<button class="select-item" data-receive="' + a.id + '|' + w.network + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + escapeHtml(net ? net.name : w.network) + '</div></span></button>'; }).join('') : '<div class="empty">' + icon('crypto', 56) + '</div>') + '</div></div>';
}
function renderCryptoReceiveAddress(){
  const f = CRYPTO_FLOW.receive;
  if (!f.asset || !f.network){ R.go('crypto-receive'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === f.asset);
  const network = NetworkEngine.get(f.network);
  const wallet = Runtime.wallets.find(w => (w.assetId === f.asset || w.symbol === asset.symbol) && w.network === f.network);
  const address = (wallet && wallet.address) ? wallet.address : AddressEngine.generate(f.network);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + asset.symbol + ' · ' + escapeHtml(network.name) + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0"><div class="qr-wrap"><div class="qr-box">' + qrSvgFor(address) + '</div></div>' +
    '<div><div class="label">' + t('crypto.address') + '</div><div class="addr-box ltr" style="margin-top:calc(8px*var(--ui))">' + escapeHtml(address) + '</div><div class="addr-box-copy" data-copy="' + escapeHtml(address) + '">' + icon('copy', 14) + ' <span>' + t('crypto.copyAddress') + '</span></div></div>' +
    '<div class="net-warning">' + icon('warn', 16) + '<span>' + t('crypto.networkWarning') + '</span></div></div>';
}
function renderCryptoToBank(){
  const wallets = Runtime.wallets.filter(w => Number(w.balance) > 0);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.toBank') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' + (wallets.length ? '<div class="select-list">' + wallets.map(w => { const a = CRYPTO_ASSETS.find(x => x.id === w.assetId || x.symbol === w.symbol); if (!a) return ''; return '<button class="select-item ' + (CRYPTO_FLOW.toBank.asset === a.id ? 'selected' : '') + '" data-tobank-asset="' + a.id + '|' + w.network + '">' + assetLogo(a.symbol, 40, a.tint) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.name) + '</div><div class="select-sub">' + (w.network || '') + ' · ' + escapeHtml(CurrencyEngine.formatCrypto(w.balance, a.symbol)) + '</div></span></button>'; }).join('') + '</div>' : '<div class="empty">' + icon('bank', 56) + '<div class="empty-sub">' + t('banks.no_account') + '</div></div>') + '</div>';
}
function renderCryptoBankAccount(){
  const accs = Runtime.bankAccounts;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('banks.choose_account') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      (accs.length ? '<div class="select-list">' + accs.map(a => '<button class="select-item ' + (CRYPTO_FLOW.toBank.accountId === a.id ? 'selected' : '') + '" data-tobank-account="' + a.id + '">' + icon('bank', 36) + '<span class="select-body"><div class="select-name">' + escapeHtml(a.bankName) + '</div><div class="select-sub ltr">' + escapeHtml(a.iban || '—') + ' · ' + a.currency + '</div></span></button>').join('') + '</div>' : '<div class="empty">' + icon('bank', 56) + '<div class="empty-sub">' + t('banks.no_account') + '</div></div>') +
      '<button class="btn btn-secondary" style="margin:var(--sp-5) var(--sp-5) 0" data-nav="banks-add">' + icon('plus', 18) + ' ' + t('banks.add') + '</button>' +
    '</div>';
}
function renderCryptoBankAmount(){
  const f = CRYPTO_FLOW.toBank;
  if (!f.asset || !f.accountId){ R.go('crypto-to-bank'); return ''; }
  const asset = CRYPTO_ASSETS.find(a => a.id === f.asset);
  const acc = Runtime.bankAccounts.find(a => a.id === f.accountId);
  if (!asset || !acc){ R.go('crypto-to-bank'); return ''; }
  const wallet = Runtime.wallets.find(w => (w.assetId === f.asset || w.symbol === asset.symbol) && w.network === f.network);
  const avail = wallet ? Number(wallet.balance) : 0;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('banks.withdraw') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass" style="padding:var(--sp-4) var(--sp-5);display:flex;align-items:center;gap:calc(12px*var(--ui));margin-bottom:var(--sp-4)">' + icon('bank', 24) + '<div><div class="caption">' + escapeHtml(acc.bankName) + '</div><div class="item-sub ltr">' + escapeHtml(acc.iban || '—') + '</div></div></div>' +
      '<div class="field"><label class="field-label">' + escapeHtml(asset.symbol) + ' · ' + t('crypto.amount') + '</label><div class="field-box"><input type="number" id="tobank-amount" inputmode="decimal" min="0" step="any" placeholder="0.00" style="flex:1"></div></div>' +
      '<div class="caption" style="text-align:end;margin:-8px var(--sp-5) var(--sp-3);color:var(--text-3)">' + t('crypto.available') + ' ' + escapeHtml(CurrencyEngine.formatCrypto(avail, asset.symbol)) + '</div>' +
      '<div class="glass" style="padding:var(--sp-4) var(--sp-5)">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('banks.withdraw_fee') + '</span><span class="caption" id="tobank-fee">—</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('banks.eta') + '</span><span class="caption">' + (acc.days || 5) + ' · ' + t('banks.days') + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span class="caption" style="font-weight:700">' + t('crypto.youReceive') + '</span><span class="caption" style="font-weight:700" id="tobank-receive">—</span></div>' +
      '</div>' +
      '<div class="field-err" id="tobank-err"></div>' +
      '<button class="btn btn-primary" id="tobank-next" disabled>' + t('common.next') + '</button>' +
    '</div>';
}
function renderCryptoBankReview(){
  const f = CRYPTO_FLOW.toBank;
  const asset = CRYPTO_ASSETS.find(a => a.id === f.asset);
  const acc = Runtime.bankAccounts.find(a => a.id === f.accountId);
  if (!asset || !acc || !f.amount){ R.go('crypto-to-bank'); return ''; }
  const label = t('crypto.toBank') + ' ' + CurrencyEngine.formatCrypto(f.amount, asset.symbol);
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('crypto.toBank') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="glass" style="padding:var(--sp-4) var(--sp-5)">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('crypto.asset') + '</span><span class="caption" style="font-weight:700">' + escapeHtml(asset.name) + ' (' + asset.symbol + ')</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('crypto.amount') + '</span><span class="caption" style="font-weight:700">' + escapeHtml(CurrencyEngine.formatCrypto(f.amount, asset.symbol)) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('banks.withdraw_fee') + '</span><span class="caption">' + escapeHtml(CurrencyEngine.formatCrypto(f.fee, asset.symbol)) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('crypto.youReceive') + '</span><span class="caption" style="font-weight:700;color:var(--success)">' + escapeHtml(CurrencyEngine.format(f.fiatEquiv, acc.currency)) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:calc(6px*var(--ui))"><span class="caption">' + t('banks.eta') + '</span><span class="caption">' + t('banks.withdraw_days').replace('{days}', f.days) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span class="caption">' + t('banks.account') + '</span><span class="caption">' + escapeHtml(acc.bankName) + ' · ' + escapeHtml((acc.iban || '').slice(-4)) + '</span></div>' +
      '</div>' +
      '<div class="net-warning">' + icon('warn', 16) + '<span>' + t('banks.choose_eta').replace('{days}', f.days) + '</span></div>' +
      _swipeHtml(label) +
    '</div>';
}
function renderBanks(){
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('banks.title') + '</span><button class="topbar-action" data-nav="banks-add" aria-label="' + t('ui.addBank') + '">' + icon('plus', 18) + '</button></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      (Runtime.bankAccounts.length ? '<div class="section"><span class="section-title">' + t('banks.account') + '</span></div><div class="glass" style="padding:calc(6px*var(--ui)) calc(16px*var(--ui))">' + Runtime.bankAccounts.map(a => '<div class="item" style="cursor:default"><div class="bank-logo">' + (String(a.bankName || 'BK').split(' ').map(w => w[0]).slice(0, 2).join('') || 'BK') + '</div><div class="item-body"><div class="item-title">' + escapeHtml(a.bankName) + '</div><div class="item-sub ltr">' + escapeHtml(a.iban || '—') + '</div></div><div style="display:flex;align-items:center;gap:calc(8px*var(--ui))"><span class="badge badge-success">' + t('banks.verified') + '</span><button class="field-icon" data-bank-remove="' + a.id + '" aria-label="' + t('banks.remove') + '" style="color:var(--danger)">' + icon('trash', 16) + '</button></div></div>').join('') + '</div>' : '') +
      '<div class="section"><span class="section-title">' + t('banks.title') + '</span></div>' +
      '<div class="glass" style="padding:calc(6px*var(--ui)) calc(16px*var(--ui))">' + BANKS.map(b => '<button class="item" data-bank-select="' + b.id + '" style="width:100%;text-align:start;background:none;border:none"><div class="bank-logo">' + b.initials + '</div><div class="item-body"><div class="item-title">' + escapeHtml(b.name) + '</div><div class="item-sub">' + b.country + ' · ' + b.currency + '</div></div><div class="bank-days">' + b.days + '</div></button>').join('') + '</div>' +
    '</div>';
}
function renderBankAdd(){
  const firstBank = BANKS[0] || {};
  const firstPh = IBANEngine.placeholder(firstBank.country || 'OM');
  const firstDays = firstBank.days || 5;
  return '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + t('banks.add') + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
    '<div class="screen-body" style="padding-top:0">' +
      '<div class="field"><label class="field-label">' + t('banks.choose') + '</label><div class="field-box"><select id="bank-select" style="flex:1;background:transparent">' + BANKS.map(b => '<option value="' + b.id + '" data-country="' + b.country + '" data-days="' + b.days + '">' + escapeHtml(b.name) + ' (' + b.country + ')</option>').join('') + '</select></div></div>' +
      '<div id="bank-eta" style="margin:-8px var(--sp-5) var(--sp-4);font-size:calc(12px*var(--ui));color:var(--text-3)">' + icon('clock', 13) + ' ' + t('banks.choose_eta').replace('{days}', firstDays) + '</div>' +
      '<div class="field"><label class="field-label">' + t('banks.holder') + '</label><div class="field-box"><input type="text" id="bank-holder" placeholder="' + t('banks.holder') + '" autocomplete="off"></div></div>' +
      '<div class="field"><label class="field-label">' + t('banks.iban') + '</label><div class="field-box"><input type="text" id="bank-iban" class="ltr" placeholder="' + escapeHtml(firstPh) + '" autocomplete="off" lang="en"></div></div>' +
      '<div class="field-err" id="bank-err"></div>' +
      '<button class="btn btn-primary" id="bank-save">' + t('action.save') + '</button>' +
    '</div>';
}

