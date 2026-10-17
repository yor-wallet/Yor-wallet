'use strict';

/* ===== YOR HOME — services / markets blocks, YOR identity ===== */
const YT = {
  en:{ search:'Search coins & services', est:'Estimated balance', portfolio:'Crypto portfolio', send:'Send', buy:'Buy', receive:'Receive', services:'Services', swap:'Swap', sell:'Sell', banks:'Banks', cards:'Cards', history:'History', networks:'Networks', markets:'Markets', more:'More', recent:'Recent activity', menu:'Menu', profile:'Profile', notifications:'Notifications', settings:'Settings', logout:'Log out', close:'Close', none:'No activity yet' },
  fr:{ search:'Rechercher cryptos et services', est:'Solde estimé', portfolio:'Portefeuille crypto', send:'Envoyer', buy:'Acheter', receive:'Recevoir', services:'Services', swap:'Échanger', sell:'Vendre', banks:'Banques', cards:'Cartes', history:'Historique', networks:'Réseaux', markets:'Marchés', more:'Plus', recent:'Activité récente', menu:'Menu', profile:'Profil', notifications:'Notifications', settings:'Paramètres', logout:'Se déconnecter', close:'Fermer', none:'Aucune activité' },
  ar:{ search:'ابحث عن العملات والخدمات', est:'الرصيد التقديري', portfolio:'محفظة العملات الرقمية', send:'إرسال', buy:'شراء', receive:'استلام', services:'الخدمات', swap:'مبادلة', sell:'بيع', banks:'البنوك', cards:'البطاقات', history:'السجل', networks:'الشبكات', markets:'الأسواق', more:'المزيد', recent:'النشاط الأخير', menu:'القائمة', profile:'الملف الشخصي', notifications:'الإشعارات', settings:'الإعدادات', logout:'تسجيل الخروج', close:'إغلاق', none:'لا يوجد نشاط بعد' }
};
const yt = (k) => (YT[LANG] || YT.en)[k] || YT.en[k];
function ybAvatar(size){
  const p = Runtime.profile || {};
  const ch = String(p.firstName || p.displayName || 'Y').trim().charAt(0).toUpperCase() || 'Y';
  return '<span class="yb-avatar" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .45) + 'px">' + escapeHtml(ch) + '</span>';
}
/* ===== OFFERS (local catalogue, step 2) =====
   All offers live here. The rest of the app only calls getActiveOffers().
   When offers come from Supabase later, only the body of getActiveOffers() changes.
   Every offer is inactive by default: set active:true only when the content is approved.
   Rules: one card at a time, home screen only, dismissed for the session, labelled "Offre". */
const OFFERS = [
  {
    id: 'example-placeholder',
    active: false,                       // keep false until the real offer is approved
    starts: '2026-10-01', ends: '2026-12-31',
    langs: null,                         // null = all languages, or e.g. ['fr','ar']
    countries: null,                     // null = all, or e.g. ['OM']
    title: { fr: 'Offre Friendly', en: 'Friendly offer', ar: 'عرض Friendly' },
    body:  { fr: 'Texte court de l\u2019offre (une phrase).', en: 'Short offer text (one sentence).', ar: 'نص قصير للعرض.' },
    cta:   { fr: 'Voir', en: 'View', ar: 'عرض' },
    target: null                         // in-app screen id opened by the button, or null (no button)
  }
];
const OFFER_LABEL = { fr: 'Offre', en: 'Offer', ar: 'عرض' };
const OFFER_KEY = 'yor.offers.dismissed';

function offersDismissed(){
  try { return JSON.parse(sessionStorage.getItem(OFFER_KEY) || '[]'); } catch(e){ return []; }
}
function dismissOffer(id){
  const list = offersDismissed();
  if (!list.includes(id)) list.push(id);
  try { sessionStorage.setItem(OFFER_KEY, JSON.stringify(list)); } catch(e){}
}
/* The single access point: returns the offers to show now, most relevant first. */
function getActiveOffers(){
  const today = new Date().toISOString().slice(0, 10);
  const country = (Runtime.profile && Runtime.profile.country) || null;
  const done = offersDismissed();
  return OFFERS.filter(o =>
    o.active &&
    (!o.starts || today >= o.starts) &&
    (!o.ends || today <= o.ends) &&
    (!o.langs || o.langs.includes(LANG)) &&
    (!o.countries || (country && o.countries.includes(country))) &&
    !done.includes(o.id)
  );
}
function renderOfferSlot(){
  const o = getActiveOffers()[0];      // one card at a time
  if (!o) return '';
  const tx = k => (o[k] && (o[k][LANG] || o[k].en)) || '';
  return '<section class="yb-sec yb-offer" data-offer-id="' + escapeHtml(o.id) + '"><div class="yb-offer-card">' +
    '<span class="yb-offer-tag">' + escapeHtml(OFFER_LABEL[LANG] || OFFER_LABEL.en) + '</span>' +
    '<button class="yb-offer-x" data-offer-close aria-label="' + escapeHtml(yt('close')) + '">×</button>' +
    '<b>' + escapeHtml(tx('title')) + '</b><p>' + escapeHtml(tx('body')) + '</p>' +
    (o.target ? '<button class="yb-btn p" data-nav="' + escapeHtml(o.target) + '">' + escapeHtml(tx('cta')) + '</button>' : '') +
    '</div></section>';
}
const OfferSlot = {
  init(){
    document.addEventListener('click', e => {
      const x = e.target.closest && e.target.closest('[data-offer-close]');
      if (!x) return;
      e.preventDefault(); e.stopPropagation();
      const sec = x.closest('[data-offer-id]');
      if (sec){ dismissOffer(sec.getAttribute('data-offer-id')); sec.remove(); }
    }, true);
  }
};

function renderHome(){
  const main = mainAccount();
  const hide = Runtime.hideBalance;
  const bal = hide ? '••••••' : CurrencyEngine.format(main.balance, main.currency);
  const pf = PortfolioEngine.snapshot();
  const pfTxt = hide ? '••••••' : CurrencyEngine.format(pf.totalUSD, 'USD');
  const up = pf.totalChangePct >= 0;
  const svc = [['country-select','send','send'],['crypto-receive','receive','receive'],['crypto-swap','swap','swap'],['crypto-sell','minus','sell'],['banks','bank','banks'],['cards','cards','cards'],['history','history','history'],['crypto-networks','network','networks']];
  const mk = (CryptoMarketEngine.list() || []).slice(0, 6);
  return '<div class="yb">' +
    '<div class="yb-top">' +
      '<button class="yb-ic" data-yb-drawer aria-label="' + yt('menu') + '">' + ybAvatar(36) + '</button>' +
      '<button class="yb-search" data-nav="crypto-market">' + icon('search', 16) + '<span>' + escapeHtml(yt('search')) + '</span></button>' +
      '<button class="yb-ic" data-action="notifications" aria-label="' + yt('notifications') + '">' + icon('bell', 22) + '</button>' +
    '</div>' +
    '<section class="yb-bal">' +
      '<div class="yb-bal-l"><span>' + yt('est') + '</span><button class="yb-eye" data-action="toggle-balance" aria-label="' + t('ui.toggleBalance') + '">' + icon('eye', 16) + '</button></div>' +
      '<div class="yb-bal-v">' + escapeHtml(bal) + '</div>' +
      '<div class="yb-bal-s">' + yt('portfolio') + ' <b>' + escapeHtml(pfTxt) + '</b> <i class="' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + pf.totalChangePct.toFixed(2) + '%</i></div>' +
      '<div class="yb-cta"><button class="yb-btn p" data-nav="country-select">' + yt('send') + '</button><button class="yb-btn" data-nav="crypto-buy">' + yt('buy') + '</button><button class="yb-btn" data-nav="crypto-receive">' + yt('receive') + '</button></div>' +
    '</section>' +
    renderOfferSlot() +
    '<section class="yb-sec"><div class="yb-h"><h2>' + yt('services') + '</h2><button class="yb-more" data-nav="services">' + yt('more') + ' ›</button></div><div class="yb-grid">' +
      svc.map(s => '<button class="yb-svc" data-nav="' + s[0] + '"><span class="yb-svc-i">' + icon(s[1], 24) + '</span><span class="yb-svc-t">' + yt(s[2]) + '</span></button>').join('') +
    '</div></section>' +
    '<section class="yb-sec"><div class="yb-h"><h2>' + yt('markets') + '</h2><button class="yb-more" data-nav="crypto-market">' + yt('more') + ' ›</button></div><div class="yb-list">' +
      mk.map(a => '<button class="yb-row" data-nav="crypto-spot" data-asset="' + a.id + '">' + assetLogo(a.symbol, 36, a.tint) +
        '<span class="yb-row-m"><b>' + a.symbol + '</b><small>' + escapeHtml(a.name) + '</small></span>' +
        '<span class="yb-row-p">' + escapeHtml(CurrencyEngine.format(a.price, 'USD')) + '</span>' +
        '<span class="yb-chg ' + (a.change24h >= 0 ? 'up' : 'dn') + '">' + (a.change24h >= 0 ? '+' : '') + a.change24h.toFixed(2) + '%</span></button>').join('') +
    '</div></section>' +
    '<section class="yb-sec"><div class="yb-h"><h2>' + yt('recent') + '</h2><button class="yb-more" data-nav="history">' + yt('more') + ' ›</button></div>' +
      '<div class="yb-card">' + (Runtime.transactions.length ? Runtime.transactions.slice(0, 5).map(txRow).join('') : '<div class="yb-empty">' + yt('none') + '</div>') + '</div></section>' +
    '<div style="height:calc(24px + var(--safe-b))"></div></div>';
}
