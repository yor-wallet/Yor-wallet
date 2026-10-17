'use strict';

/* ============================================================
   DOMAIN HELPERS
   ============================================================ */
const CurrencyEngine = Object.freeze({
  meta(c){ return CURRENCY_DEF[String(c || '').toUpperCase()] || CURRENCY_DEF.USD; },
  format(a, c, locale){
    c = String(c || 'OMR').toUpperCase();
    const m = CurrencyEngine.meta(c);
    const n = Number(a || 0);
    if (!locale) locale = LANG === 'en' ? 'en-US' : LANG === 'ar' ? 'ar-OM-u-nu-arab' : 'fr-FR';
    const o = { minimumFractionDigits:m.decimals, maximumFractionDigits:m.decimals };
    let num;
    try { num = Math.abs(n).toLocaleString(locale, o); } catch(e){ num = Math.abs(n).toLocaleString('en-US', o); }
    const neg = n < 0 && Math.abs(n) >= Math.pow(10, -m.decimals) / 2;
    /* EN: "OMR 132,977.000"   FR: "132 977,000 OMR"   AR: Arabic digits, code after the number. The value is never altered. */
    if (String(locale).indexOf('en') === 0) return (neg ? '-' : '') + c + ' ' + num;
    return (neg ? '-' : '') + num + ' ' + c;
  },
  formatCrypto(a, sym){
    const s = String(sym || '').toUpperCase();
    const m = CurrencyEngine.meta(s);
    const n = Number(a || 0);
    const maxDec = s === 'BTC' ? 8 : s === 'ETH' ? 6 : Math.min(m.decimals, 8);
    const minDec = n > 0 && n < 0.001 ? 4 : 0;
    return n.toLocaleString('en-US', { minimumFractionDigits:minDec, maximumFractionDigits:maxDec }) + ' ' + s;
  }
});

const ExchangeEngine = Object.freeze({
  isCrypto(sym){ return Object.prototype.hasOwnProperty.call(CRYPTO_PRICES_SEED, String(sym || '').toUpperCase()); },
  cryptoUSD(sym){ return (CRYPTO_PRICES_SEED[String(sym || '').toUpperCase()] || { usd:0 }).usd; },
  rate(from, to){
    if (!from || !to) return null;
    from = String(from).toUpperCase(); to = String(to).toUpperCase();
    if (from === to) return 1;
    const rates = FX_RATES;
    const fc = ExchangeEngine.isCrypto(from);
    const tc = ExchangeEngine.isCrypto(to);
    if (fc && tc){
      const pf = ExchangeEngine.cryptoUSD(from); const pt = ExchangeEngine.cryptoUSD(to);
      return pt > 0 ? pf / pt : null;
    }
    if (fc){
      const pUSD = ExchangeEngine.cryptoUSD(from);
      const rateToOMR = rates['USD'] ? 1 / rates['USD'] : null;
      if (!rateToOMR) return null;
      const omrAmount = pUSD * rateToOMR;
      if (to === 'OMR') return omrAmount;
      return rates[to] != null ? omrAmount * rates[to] : null;
    }
    if (tc){
      const pUSD = ExchangeEngine.cryptoUSD(to);
      if (pUSD <= 0) return null;
      const omrToUSD = rates['USD'] || 2.6008;
      if (from === 'OMR') return (1 * omrToUSD) / pUSD;
      if (rates[from] != null){
        const omrAmount = 1 / rates[from];
        return (omrAmount * omrToUSD) / pUSD;
      }
      return null;
    }
    if (from === 'OMR') return rates[to] != null ? rates[to] : null;
    if (to === 'OMR') return rates[from] != null ? 1 / rates[from] : null;
    if (rates[from] != null && rates[to] != null) return rates[to] / rates[from];
    return null;
  },
  convert(amount, from, to){
    const r = ExchangeEngine.rate(from, to);
    if (r == null) return null;
    return { amount: Math.round(amount * r * 1e8) / 1e8, rate: r, from: String(from).toUpperCase(), to: String(to).toUpperCase() };
  }
});

const FeeEngine = Object.freeze({
  compute(amount, isIntl){
    const fee = isIntl ? CONFIG.FEES.INTERNATIONAL.flatOMR : CONFIG.FEES.LOCAL.flat;
    const vat = Math.round(fee * CONFIG.VAT.rate * 1000) / 1000;
    return { amount, fee, vat, total: Math.round((amount + fee + vat) * 1000) / 1000 };
  },
  cryptoTrade(amountUSD){ return Math.round(amountUSD * CONFIG.FEES.CRYPTO_TRADE_PCT * 100) / 100; },
  cryptoSwap(amountUSD){ return Math.round(amountUSD * CONFIG.FEES.CRYPTO_SWAP_PCT * 100) / 100; },
  cryptoToBank(amount){ return Math.round(amount * CONFIG.FEES.CRYPTO_TO_BANK_PCT * 1e8) / 1e8; }
});

/* 12.3.7 : l'envoi vers une adresse externe accepte N'IMPORTE QUELLE adresse que le serveur accepte (fonction SQL _crypto_send_external_impl :
   15 à 128 caractères parmi A-Z a-z 0-9 : _ . -). Le format propre au réseau choisi n'est plus un BLOCAGE mais un AVERTISSEMENT
   (`strict:false` + `looksLike`) : la personne décide. Le texte collé est d'abord nettoyé (espaces, retours à la ligne, caractères invisibles,
   préfixe « ethereum: », « bitcoin: »…, paramètres « ?amount= »). Cette fonction de nettoyage est dupliquée à l'identique dans
   features/yor-chain.js (cleanAddressInput) pour l'écran TronLink ; tests/ui/address-any.test.mjs vérifie qu'elles donnent le même résultat. */
const AddressEngine = (() => {
  const MIN_LEN = 15, MAX_LEN = 128;                       // mêmes bornes que le serveur
  const SERVER_CHARS = /^[A-Za-z0-9:_.\-]+$/;              // même jeu de caractères que le serveur
  const INVISIBLE = /[­​-‏‪-‮⁠-⁩﻿]/g;
  const URI_SCHEME = /^(?:bitcoin|ethereum|tron|litecoin|solana|ripple|xrp|bsc|polygon):/i;
  const STRICT = {
    bitcoin: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/,
    ethereum: /^0x[a-fA-F0-9]{40}$/, bsc: /^0x[a-fA-F0-9]{40}$/, polygon: /^0x[a-fA-F0-9]{40}$/,
    tron: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    xrp: /^r[a-zA-HJ-NP-Z0-9]{24,}$/,
    litecoin: /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{20,}$/
  };
  const GUESS_ORDER = ['ethereum', 'tron', 'bitcoin', 'litecoin', 'xrp', 'solana'];   // du plus spécifique au plus large
  function clean(raw){
    let a = String(raw == null ? '' : raw).replace(INVISIBLE, '').replace(/\s+/g, '');
    a = a.replace(/^[("'<\[]+/, '').replace(/[)"'>\],;.]+$/, '');
    a = a.replace(URI_SCHEME, '');
    const q = a.indexOf('?'); if (q >= 0) a = a.slice(0, q);
    a = a.replace(/^(0[xX][a-fA-F0-9]{40})@\d+$/, '$1').replace(/^0X(?=[a-fA-F0-9]{40}$)/, '0x');
    return a;
  }
  function strictOk(networkId, a){
    const re = STRICT[networkId];
    return re ? re.test(a) : a.length >= 20;
  }
  function guess(a, exceptNetworkId){
    for (const id of GUESS_ORDER){ if (id !== exceptNetworkId && STRICT[id].test(a)) return id; }
    return null;
  }
  return Object.freeze({
    MIN_LEN, MAX_LEN, clean,
    /* ok = le serveur l'acceptera (on peut continuer) ; strict = en plus, le format est celui du réseau choisi ; looksLike = réseau probable sinon */
    validate(networkId, address){
      const a = clean(address);
      if (a.length < MIN_LEN || a.length > MAX_LEN || !SERVER_CHARS.test(a)) return { ok:false, strict:false, address:a };
      if (strictOk(networkId, a)) return { ok:true, strict:true, address:a };
      return { ok:true, strict:false, address:a, looksLike: guess(a, networkId) };
    },
    short(a){ if (!a || a.length < 14) return a || ''; return a.slice(0, 8) + '…' + a.slice(-6); },
  generate(networkId){
    const rnd = n => { let s = ''; const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)]; return s; };
    const rndHex = n => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)]; return s; };
    switch(networkId){
      case 'bitcoin': return 'bc1q' + rnd(38).toLowerCase();
      case 'ethereum': case 'bsc': case 'polygon': return '0x' + rndHex(40);
      case 'tron': return 'T' + rnd(33).toUpperCase();
      case 'solana': return rnd(44);
      case 'xrp': return 'r' + rnd(33);
      case 'litecoin': return 'ltc1q' + rnd(38).toLowerCase();
      default: return rnd(40);
    }
  },
  requiresMemo(networkId){ return networkId === 'xrp'; }
  });
})();

const NetworkEngine = Object.freeze({
  all(){ return NETWORKS; },
  get(id){ return NETWORKS.find(n => n.id === id) || null; },
  compatible(symbol){ return NETWORKS.filter(n => n.supportedAssets.includes(String(symbol).toUpperCase())); }
});

const GasFeeEngine = Object.freeze({
  estimate(networkId, asset){
    const map = { bitcoin: 0.000035, litecoin: 0.0001, ethereum: 0.0021, bsc: 0.0005, polygon: 0.0012, tron: 1.2, solana: 0.000005, xrp: 0.00002 };
    const fee = map[networkId];
    if (fee == null) return { amount: 0, symbol: asset, usd: 0 };
    const priceUSD = (CRYPTO_PRICES_SEED[asset] || { usd:0 }).usd;
    return { amount: fee, symbol: asset, usd: fee * priceUSD };
  }
});

const CryptoMarketEngine = Object.freeze({
  price(symbol){ return (CRYPTO_PRICES_SEED[String(symbol).toUpperCase()] || { usd:0 }).usd; },
  change24h(symbol){ return (CRYPTO_PRICES_SEED[String(symbol).toUpperCase()] || { change:0 }).change; },
  list(){ return CRYPTO_ASSETS.map(a => ({ id: a.id, symbol: a.symbol, name: a.name, tint: a.tint, price: CryptoMarketEngine.price(a.symbol), change24h: CryptoMarketEngine.change24h(a.symbol) })); }
});

const ContactsEngine = Object.freeze({
  all(){ return Runtime.contacts || []; },
  byNumber(num){
    const digits = String(num || '').replace(/\D/g, '');
    if (!digits || digits.length < 6) return null;
    return ContactsEngine.all().find(c => {
      const cd = String(c.digits || c.number || '').replace(/\D/g, '');
      return cd === digits || (cd.length >= 6 && digits.length >= 6 && (cd.endsWith(digits.slice(-6)) || digits.endsWith(cd.slice(-6))));
    }) || null;
  },
  async add({ number, name, fullName, country }){
    const uid = UserContext.requireCtx().uid;
    const digits = String(number || '').replace(/\D/g, '');
    if (digits.length < 6) throw new Error('Invalid number');
    if (!name || name.length < 2) throw new Error('Name required');
    const existing = Runtime.contacts.find(c => c.digits === digits);
    const entry = {
      id: existing ? existing.id : ID.contact(),
      number, digits, name: name.toUpperCase(),
      fullName: (fullName || name).toUpperCase(),
      country: country || 'OM',
      verified: true, createdAt: Date.now()
    };
    await UserDataEngine.writeSub(uid, 'contacts', entry.id, entry);
    if (existing) Object.assign(existing, entry); else Runtime.contacts.push(entry);
    return entry;
  },
  async remove(id){
    const uid = UserContext.requireCtx().uid;
    await UserDataEngine.deleteSub(uid, 'contacts', id);
    Runtime.contacts = Runtime.contacts.filter(c => c.id !== id);
  },
  mask(name){
    if (!name) return '—';
    const clean = String(name).toUpperCase().replace(/\s+/g, '');
    if (clean.length <= 6) return clean;
    const head = clean.slice(0, 3);
    const tail = clean.slice(-4);
    const hash = '#'.repeat(Math.max(3, clean.length - 7));
    return head + hash + tail;
  }
});

const IBANEngine = Object.freeze({
  FMTS: {
    OM:{ len:23, ph:'OM00 0000 0000 0000 0000 000' },
    AE:{ len:23, ph:'AE00 0000 0000 0000 0000 000' },
    SA:{ len:24, ph:'SA00 0000 0000 0000 0000 0000' },
    QA:{ len:29, ph:'QA00 XXXX 0000 0000 0000 0000 00000' },
    KW:{ len:30, ph:'KW00 XXXX 0000 0000 0000 0000 0000 00' },
    BH:{ len:22, ph:'BH00 XXXX 0000 0000 0000 00' },
    GB:{ len:22, ph:'GB00 XXXX 0000 0000 0000 00' },
    FR:{ len:27, ph:'FR00 0000 0000 0000 0000 0000 000' },
    EG:{ len:29, ph:'EG00 0000 0000 0000 0000 0000 0000' },
    CI:{ len:28, ph:'CI00 X000 0000 0000 0000 0000 0000' },
    ML:{ len:28, ph:'ML00 X000 0000 0000 0000 0000 0000' },
    BF:{ len:28, ph:'BF00 0000 0000 0000 0000 0000 0000' },
    GN:{ len:24, ph:'GN00 0000 0000 0000 0000 0000' },
    US:{ len:0, ph:'Routing + Account number' }
  },
  fmt(country){ return this.FMTS[country] || { len:15, ph:'Account number' }; },
  placeholder(country){ return this.fmt(country).ph; },
  /* ISO 13616 check: structure, country, length, then mod-97 checksum (catches typos). */
  validate(iban, country){
    const clean = String(iban || '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(clean)) return {ok:false, reason:'format'};
    const cc = clean.slice(0, 2);
    if (country && cc !== String(country).toUpperCase()) return {ok:false, reason:'country'};
    const f = this.FMTS[cc];
    if (f && f.len === 0) return clean.length >= 8 ? {ok:true} : {ok:false, reason:'length'};
    if (f && clean.length !== f.len) return {ok:false, reason:'length'};
    const rearranged = clean.slice(4) + clean.slice(0, 4);
    let rem = 0;
    for (const ch of rearranged){
      const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of v){ rem = (rem * 10 + Number(d)) % 97; }
    }
    if (rem !== 1) return {ok:false, reason:'checksum'};
    return {ok:true};
  }
});

const COUNTRY_TRANSFER_CONFIG = Object.freeze({
  OM: { iso:'OM', name:{fr:'Oman',en:'Oman',ar:'عُمان'}, dial:'+968', currency:'OMR', flag:'OM',
    services:[
      { id:'local_phone', key:'LOCAL_PHONE', name:{fr:'Transfert local par téléphone',en:'Local phone transfer',ar:'تحويل محلي'}, identifierType:'PHONE', icon:'mobile', primary:true },
      { id:'local_bank', key:'LOCAL_BANK', name:{fr:'Virement bancaire local',en:'Local bank transfer',ar:'تحويل بنكي'}, identifierType:'IBAN', icon:'bank' }
    ]},
  AE: { iso:'AE', name:{fr:'Émirats arabes unis',en:'UAE',ar:'الإمارات'}, dial:'+971', currency:'AED', flag:'AE',
    services:[
      { id:'local_transfer', key:'LOCAL', name:{fr:'Transfert local',en:'Local transfer',ar:'تحويل محلي'}, identifierType:'SERVICE_ID', icon:'globe', primary:true },
      { id:'bank_transfer', key:'BANK', name:{fr:'Virement bancaire (IBAN)',en:'Bank transfer (IBAN)',ar:'تحويل بنكي'}, identifierType:'IBAN', icon:'bank' }
    ]},
  SA: { iso:'SA', name:{fr:'Arabie saoudite',en:'Saudi Arabia',ar:'السعودية'}, dial:'+966', currency:'SAR', flag:'SA',
    services:[
      { id:'local_transfer', key:'LOCAL', name:{fr:'Transfert local',en:'Local transfer',ar:'تحويل محلي'}, identifierType:'SERVICE_ID', icon:'globe', primary:true },
      { id:'bank_transfer', key:'BANK', name:{fr:'Virement bancaire (IBAN)',en:'Bank transfer',ar:'تحويل بنكي'}, identifierType:'IBAN', icon:'bank' }
    ]},
  US: { iso:'US', name:{fr:'États-Unis',en:'United States',ar:'الولايات المتحدة'}, dial:'+1', currency:'USD', flag:'US',
    services:[
      { id:'us_bank', key:'BANK', name:{fr:'Virement bancaire (ACH)',en:'Bank transfer (ACH)',ar:'تحويل ACH'}, identifierType:'ROUTING_ACCOUNT', icon:'bank', primary:true }
    ]},
  CI: { iso:'CI', name:{fr:'Côte d\'Ivoire',en:'Côte d\'Ivoire',ar:'ساحل العاج'}, dial:'+225', currency:'XOF', flag:'CI',
    services:[
      { id:'orange_money_ci', key:'ORANGE', name:{fr:'Orange Money',en:'Orange Money',ar:'Orange Money'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true },
      { id:'mtn_momo_ci', key:'MTN', name:{fr:'MTN MoMo',en:'MTN MoMo',ar:'MTN MoMo'}, identifierType:'MOBILE_MONEY', icon:'mobile' },
      { id:'wave_ci', key:'WAVE', name:{fr:'Wave',en:'Wave',ar:'Wave'}, identifierType:'MOBILE_MONEY', icon:'mobile' },
      { id:'bank_ci', key:'BANK', name:{fr:'Virement bancaire',en:'Bank transfer',ar:'تحويل بنكي'}, identifierType:'IBAN', icon:'bank' }
    ]},
  ML: { iso:'ML', name:{fr:'Mali',en:'Mali',ar:'مالي'}, dial:'+223', currency:'XOF', flag:'ML',
    services:[
      { id:'orange_money_ml', key:'ORANGE', name:{fr:'Orange Money',en:'Orange Money',ar:'Orange Money'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true },
      { id:'moov_ml', key:'MOOV', name:{fr:'Moov Money',en:'Moov Money',ar:'Moov Money'}, identifierType:'MOBILE_MONEY', icon:'mobile' }
    ]},
  BF: { iso:'BF', name:{fr:'Burkina Faso',en:'Burkina Faso',ar:'بوركينا فاسو'}, dial:'+226', currency:'XOF', flag:'BF',
    services:[
      { id:'orange_money_bf', key:'ORANGE', name:{fr:'Orange Money',en:'Orange Money',ar:'Orange Money'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true }
    ]},
  GN: { iso:'GN', name:{fr:'Guinée',en:'Guinea',ar:'غينيا'}, dial:'+224', currency:'GNF', flag:'GN',
    services:[
      { id:'orange_money_gn', key:'ORANGE', name:{fr:'Orange Money',en:'Orange Money',ar:'Orange Money'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true }
    ]},
  EG: { iso:'EG', name:{fr:'Égypte',en:'Egypt',ar:'مصر'}, dial:'+20', currency:'EGP', flag:'EG',
    services:[
      { id:'vodafone_eg', key:'VODAFONE', name:{fr:'Vodafone Cash',en:'Vodafone Cash',ar:'Vodafone Cash'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true },
      { id:'bank_eg', key:'BANK', name:{fr:'Virement bancaire',en:'Bank transfer',ar:'تحويل بنكي'}, identifierType:'IBAN', icon:'bank' }
    ]},
  SD: { iso:'SD', name:{fr:'Soudan',en:'Sudan',ar:'السودان'}, dial:'+249', currency:'SDG', flag:'SD',
    services:[
      { id:'bankak_sd', key:'BANKAK', name:{fr:'Bankak',en:'Bankak',ar:'Bankak'}, identifierType:'MOBILE_MONEY', icon:'mobile', primary:true }
    ]}
});

const IdentifierEngine = Object.freeze({
  label(type){
    const map = { PHONE:'identifier.phone', IBAN:'identifier.iban', ACCOUNT_NUMBER:'identifier.account',
      ROUTING_ACCOUNT:'identifier.routing', MOBILE_MONEY:'identifier.mobile_money', EMAIL:'identifier.email',
      SERVICE_ID:'identifier.service_id', YOR_ID:'transfer.yor_id_label' };
    return t(map[type] || 'identifier.service_id');
  },
  placeholder(type){
    switch(type){
      case 'PHONE': return '7 79 86 54 44';
      case 'IBAN': return 'AE00 0000 0000 0000 0000 000';
      case 'ACCOUNT_NUMBER': return '0000 0000 0000';
      case 'ROUTING_ACCOUNT': return '021000021 / 1234567890';
      case 'MOBILE_MONEY': return '07 00 00 00 00';
      case 'EMAIL': return 'user@example.com';
      case 'YOR_ID': return 'FRD-XXXXXX';
      case 'SERVICE_ID': return '@username';
      default: return '';
    }
  },
  validate(type, value){
    const v = String(value || '').trim();
    const digits = v.replace(/\D/g, '');
    switch(type){
      case 'PHONE': case 'MOBILE_MONEY': return digits.length >= 6 && digits.length <= 15 ? {ok:true} : {ok:false, reason:t('errors.INVALID_PHONE')};
      case 'IBAN': return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/i.test(v.replace(/\s/g, '')) ? {ok:true} : {ok:false, reason:'IBAN invalid'};
      case 'ACCOUNT_NUMBER': return digits.length >= 6 && digits.length <= 20 ? {ok:true} : {ok:false, reason:t('errors.INVALID_ACCOUNT')};
      case 'ROUTING_ACCOUNT': {
        const parts = v.split('/').map(s => s.trim());
        return parts.length === 2 && /^\d{9}$/.test(parts[0]) && /^\d{6,17}$/.test(parts[1]) ? {ok:true} : {ok:false, reason:'Invalid format'};
      }
      case 'EMAIL': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? {ok:true} : {ok:false, reason:'Invalid email'};
      case 'YOR_ID': return /^YOR-[A-Z0-9]{6,}$/i.test(normId(v)) ? {ok:true} : {ok:false, reason:'Invalid Friendly ID'};
      case 'SERVICE_ID': return v.length >= 4 ? {ok:true} : {ok:false, reason:'Invalid identifier'};
      default: return v.length >= 3 ? {ok:true} : {ok:false, reason:'Invalid value'};
    }
  }
});

const INTERNAL_SERVICE_DEF = Object.freeze({
  id: 'yor_internal',
  key: 'INTERNAL',
  name: { fr: 'Friendly Pay (Envoi interne)', en: 'Friendly Pay (Internal)', ar: 'Friendly Pay (داخلي)' },
  identifierType: 'YOR_ID',
  icon: 'send',
  primary: false,
  internal: true
});

const CountryTransferEngine = Object.freeze({
  allCountries(){ return Object.values(COUNTRY_TRANSFER_CONFIG); },
  getConfig(iso){ return COUNTRY_TRANSFER_CONFIG[iso] || null; },
  services(iso){
    const c = CountryTransferEngine.getConfig(iso);
    const base = c ? c.services.slice() : [];
    return [INTERNAL_SERVICE_DEF].concat(base);
  },
  getService(iso, serviceId){
    if (serviceId === INTERNAL_SERVICE_DEF.id) return INTERNAL_SERVICE_DEF;
    const c = CountryTransferEngine.getConfig(iso);
    return c ? c.services.find(s => s.id === serviceId) : null;
  },
  recognize({ country, serviceId, identifierType, value }){
    const contact = ContactsEngine.byNumber(value);
    if (contact && (identifierType === 'PHONE' || identifierType === 'MOBILE_MONEY')){
      return { found:true, source:'LINKED_CONTACT', name: contact.fullName, masked: contact.name, phone: contact.number, verified: true };
    }
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 6){
      const found = (Runtime.beneficiaries || []).find(b => {
        if (b.country !== country) return false;
        const bd = String(b.phone || '').replace(/\D/g, '');
        return bd && bd.endsWith(digits.slice(-6));
      });
      if (found) return { found:true, source:'BENEFICIARY', name: found.name, masked: ContactsEngine.mask(found.name), phone: found.phone, verified: true };
    }
    return { found:false, source:'NEW' };
  }
});

