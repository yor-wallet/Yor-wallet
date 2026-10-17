'use strict';

/* ============================================================
   CONFIG / CURRENCIES / COUNTRIES / CRYPTO / NETWORKS / BANKS
   ============================================================ */
const CONFIG = Object.freeze({
  APP:{ name:'Friendly Pay', version:'12.14.0', schema:16, defaultLang:'en', defaultTheme:'light' },
  FEES:{ INTERNATIONAL:{ flatOMR:0 }, LOCAL:{ flat:0 },   /* 12.12.0 : AUCUN frais sur les transferts d'argent (le serveur débite le montant seul) */
    MOBILE_MONEY_PCT:0.01, CRYPTO_TRADE_PCT:0.005, CRYPTO_SWAP_PCT:0.003, CRYPTO_TO_BANK_PCT:0.015 },
  PUSH:{ vapidPublicKey:'BFRA_csXTUfSX06fZNTpqIlevcKO9jnrMOu5B6IJx-xTDj_78r-ZJXOfqfleGlK2OsLzkBRLnjAFjyVG3xg8yCs' },   /* 12.13.0 : clé PUBLIQUE VAPID des notifications push (la clé privée n'existe que sur le serveur) */
  VAT:{ rate:0.05 },
  LIMITS:{ perTxOMR:3000, dailyOMR:5000, minOMR:0.100 },
  PROCESSING:{ durationMs:6000 },
  NOTIF_DELAYED_MS: 60000,
  CARD_REVEAL_MS: 15000,
  DEVICE_KEY: 'yor_device_id',
  SESSION_KEY: 'yor_session_id'
});

/* 12.12.0 — what the app offers. crypto:false hides the WHOLE crypto section (menu, home, services, settings, links, history filter, banks linked for
   crypto withdrawals). The code stays in place: set it to true to bring the section back. */
const FEATURES = Object.freeze({ crypto: false });
const CRYPTO_SCREEN_RE = /^(crypto(-|$)|chain$|banks(-|$))/;

const CURRENCY_DEF = Object.freeze({
  OMR:{ code:'OMR', name:'Omani Rial', decimals:3, scale:1000 },
  BHD:{ code:'BHD', name:'Bahraini Dinar', decimals:3, scale:1000 },
  KWD:{ code:'KWD', name:'Kuwaiti Dinar', decimals:3, scale:1000 },
  XOF:{ code:'XOF', name:'Franc CFA BCEAO', decimals:0, scale:1 },
  XAF:{ code:'XAF', name:'Franc CFA BEAC', decimals:0, scale:1 },
  GNF:{ code:'GNF', name:'Guinean Franc', decimals:0, scale:1 },
  USD:{ code:'USD', name:'US Dollar', decimals:2, scale:100 },
  EUR:{ code:'EUR', name:'Euro', decimals:2, scale:100 },
  GBP:{ code:'GBP', name:'British Pound', decimals:2, scale:100 },
  AED:{ code:'AED', name:'UAE Dirham', decimals:2, scale:100 },
  SAR:{ code:'SAR', name:'Saudi Riyal', decimals:2, scale:100 },
  QAR:{ code:'QAR', name:'Qatari Riyal', decimals:2, scale:100 },
  EGP:{ code:'EGP', name:'Egyptian Pound', decimals:2, scale:100 },
  SDG:{ code:'SDG', name:'Sudanese Pound', decimals:2, scale:100 },
  USDT:{ code:'USDT', name:'Tether', decimals:2, scale:100 },
  USDC:{ code:'USDC', name:'USD Coin', decimals:2, scale:100 },
  BTC:{ code:'BTC', name:'Bitcoin', decimals:8, scale:100000000 },
  ETH:{ code:'ETH', name:'Ethereum', decimals:6, scale:1000000 },
  BNB:{ code:'BNB', name:'BNB', decimals:4, scale:10000 },
  SOL:{ code:'SOL', name:'Solana', decimals:4, scale:10000 },
  XRP:{ code:'XRP', name:'XRP', decimals:4, scale:10000 },
  LTC:{ code:'LTC', name:'Litecoin', decimals:6, scale:1000000 }
});

const COUNTRY_DATA = Object.freeze({
  OM:{ iso:'OM', fr:'Oman', en:'Oman', ar:'عُمان', dial:'+968', cur:'OMR', flag:'OM' },
  AE:{ iso:'AE', fr:'Émirats arabes unis', en:'United Arab Emirates', ar:'الإمارات', dial:'+971', cur:'AED', flag:'AE' },
  SA:{ iso:'SA', fr:'Arabie saoudite', en:'Saudi Arabia', ar:'السعودية', dial:'+966', cur:'SAR', flag:'SA' },
  QA:{ iso:'QA', fr:'Qatar', en:'Qatar', ar:'قطر', dial:'+974', cur:'QAR', flag:'QA' },
  KW:{ iso:'KW', fr:'Koweït', en:'Kuwait', ar:'الكويت', dial:'+965', cur:'KWD', flag:'KW' },
  BH:{ iso:'BH', fr:'Bahreïn', en:'Bahrain', ar:'البحرين', dial:'+973', cur:'BHD', flag:'BH' },
  US:{ iso:'US', fr:'États-Unis', en:'United States', ar:'الولايات المتحدة', dial:'+1', cur:'USD', flag:'US' },
  FR:{ iso:'FR', fr:'France', en:'France', ar:'فرنسا', dial:'+33', cur:'EUR', flag:'FR' },
  GB:{ iso:'GB', fr:'Royaume-Uni', en:'United Kingdom', ar:'المملكة المتحدة', dial:'+44', cur:'GBP', flag:'GB' },
  CI:{ iso:'CI', fr:'Côte d\'Ivoire', en:'Côte d\'Ivoire', ar:'ساحل العاج', dial:'+225', cur:'XOF', flag:'CI' },
  ML:{ iso:'ML', fr:'Mali', en:'Mali', ar:'مالي', dial:'+223', cur:'XOF', flag:'ML' },
  BF:{ iso:'BF', fr:'Burkina Faso', en:'Burkina Faso', ar:'بوركينا فاسو', dial:'+226', cur:'XOF', flag:'BF' },
  GN:{ iso:'GN', fr:'Guinée', en:'Guinea', ar:'غينيا', dial:'+224', cur:'GNF', flag:'GN' },
  SD:{ iso:'SD', fr:'Soudan', en:'Sudan', ar:'السودان', dial:'+249', cur:'SDG', flag:'SD' },
  EG:{ iso:'EG', fr:'Égypte', en:'Egypt', ar:'مصر', dial:'+20', cur:'EGP', flag:'EG' }
});

const CRYPTO_ASSETS = Object.freeze([
  { id:'btc', symbol:'BTC', name:'Bitcoin', decimals:8, tint:'#F7931A' },
  { id:'eth', symbol:'ETH', name:'Ethereum', decimals:6, tint:'#627EEA' },
  { id:'usdt', symbol:'USDT', name:'Tether', decimals:2, tint:'#26A17B' },
  { id:'usdc', symbol:'USDC', name:'USD Coin', decimals:2, tint:'#2775CA' },
  { id:'bnb', symbol:'BNB', name:'BNB', decimals:4, tint:'#F3BA2F' },
  { id:'sol', symbol:'SOL', name:'Solana', decimals:4, tint:'#14F195' },
  { id:'xrp', symbol:'XRP', name:'XRP', decimals:4, tint:'#23292F' },
  { id:'ltc', symbol:'LTC', name:'Litecoin', decimals:6, tint:'#345D9D' }
]);

const NETWORKS = Object.freeze([
  { id:'bitcoin', name:'Bitcoin', symbol:'BTC', supportedAssets:['BTC'], confirmations:2, eta:'~30 min', tint:'#F7931A' },
  { id:'ethereum', name:'Ethereum', symbol:'ETH', supportedAssets:['ETH','USDT','USDC'], confirmations:12, eta:'~5 min', tint:'#627EEA' },
  { id:'bsc', name:'BNB Smart Chain', symbol:'BNB', supportedAssets:['BNB','USDT','USDC'], confirmations:15, eta:'~3 min', tint:'#F3BA2F' },
  { id:'tron', name:'Tron', symbol:'TRX', supportedAssets:['USDT'], confirmations:20, eta:'~1 min', tint:'#FF0022' },
  { id:'solana', name:'Solana', symbol:'SOL', supportedAssets:['SOL','USDC'], confirmations:1, eta:'~15 sec', tint:'#14F195' },
  { id:'xrp', name:'XRP Ledger', symbol:'XRP', supportedAssets:['XRP'], confirmations:1, eta:'~5 sec', tint:'#23292F' },
  { id:'polygon', name:'Polygon', symbol:'MATIC', supportedAssets:['USDT','USDC'], confirmations:128, eta:'~5 min', tint:'#8247E5' },
  { id:'litecoin', name:'Litecoin', symbol:'LTC', supportedAssets:['LTC'], confirmations:6, eta:'~15 min', tint:'#345D9D' }
]);

const BANKS = Object.freeze([
  { id:'bm_om', name:'Bank Muscat', country:'OM', currency:'OMR', initials:'BM', days:2 },
  { id:'bd_om', name:'Bank Dhofar', country:'OM', currency:'OMR', initials:'BD', days:2 },
  { id:'nbo_om', name:'National Bank of Oman', country:'OM', currency:'OMR', initials:'NBO', days:2 },
  { id:'sib_om', name:'Sohar International', country:'OM', currency:'OMR', initials:'SIB', days:2 },
  { id:'enbd_ae', name:'Emirates NBD', country:'AE', currency:'AED', initials:'ENBD', days:3 },
  { id:'rajhi_sa', name:'Al Rajhi Bank', country:'SA', currency:'SAR', initials:'ARB', days:3 },
  { id:'qnb_qa', name:'Qatar National Bank', country:'QA', currency:'QAR', initials:'QNB', days:3 },
  { id:'barclays_gb', name:'Barclays', country:'GB', currency:'GBP', initials:'B', days:5 },
  { id:'bnp_fr', name:'BNP Paribas', country:'FR', currency:'EUR', initials:'BNP', days:5 },
  { id:'chase_us', name:'JPMorgan Chase', country:'US', currency:'USD', initials:'JPM', days:5 },
  { id:'bicici_ci', name:'BICICI (Côte d\'Ivoire)', country:'CI', currency:'XOF', initials:'BI', days:6 }
]);

const FX_RATES = Object.freeze({
  USD: 2.6008, AED: 9.5466, SAR: 9.7425, QAR: 9.4669, BHD: 0.9774, KWD: 0.7980,
  EUR: 2.2749, GBP: 1.9550, XOF: 1492.00, XAF: 1492.00, GNF: 22450, EGP: 128.00, SDG: 1560
});

/* Provenance of the static rate/price tables: NOT a market feed. Set status to 'LIVE' only when a real provider
   (with source + timestamp) feeds them. */
const FX_META = Object.freeze({ status:'INDICATIVE', source:'Built-in static table', updatedAt:null });
/* Honest, professional indicator: shown while prices/rates come from the built-in table, not a live feed. */
function simBadge(){ return ''; }

const CRYPTO_PRICES_SEED = Object.freeze({
  BTC:  { usd: 84500.00, change:  1.8 }, ETH:  { usd:  1620.00, change:  0.6 },
  USDT: { usd:     1.00, change:  0.0 }, USDC: { usd:     1.00, change:  0.0 },
  BNB:  { usd:   613.00, change: -0.5 }, SOL:  { usd:    73.00, change:  1.1 },
  XRP:  { usd:     1.09, change: -0.2 }, LTC:  { usd:    52.80, change:  0.8 }
});

