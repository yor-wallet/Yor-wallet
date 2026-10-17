'use strict';
/* ============================================================
   V12 — cards, home and navigation (YOR identity), design system 12.4.0.
   Cards are drawn in CSS: no third-party network mark, no chip, no NFC symbol, no security code.
   A card is a "preview" until the card data says a real issuer issued it.
   ============================================================ */
const V12 = (() => {
  const TH = ['obsidian', 'midnight', 'graphite', 'violet', 'aurora', 'minimal', 'metal'];
  const D = {
    en: { cards:'Cards', addCard:'Add card', freeze:'Freeze', unfreeze:'Unfreeze', frozen:'Frozen', details:'Details', hide:'Hide', settings:'Settings', limits:'Limits', virtual:'Virtual', physical:'Physical',
      cardNumber:'Card number', expiry:'Expiry', cvv:'CVV', holder:'Cardholder', copied:'Copied', online:'Online payments', onlineD:'Use this card on websites and apps', contactless:'Contactless payments', contactlessD:'Tap to pay with this card',
      atm:'ATM withdrawals', atmD:'Withdraw cash at ATMs', monthly:'Monthly limit', noLimit:'No limit', design:'Card design', label:'Card name', terminate:'Terminate card', terminateQ:'Terminate this card? This cannot be undone.',
      confirm:'Confirm', cancel:'Cancel', activity:'Card activity', noPay:'No card payments yet', noPayD:'Payments made with your card will appear here.', security:'Security', spending:'Spending limits', appearance:'Appearance',
      saved:'Saved', froze:'Card frozen', unfroze:'Card unfrozen', gone:'Card terminated', chooseDesign:'Choose a design', create:'Create card', noCards:'No card yet', noCardsD:'Create a Friendly virtual card in seconds.', typeL:'Card type', save:'Save', failed:'Something went wrong',
      hello:'Hello', accounts:'Accounts', allAccounts:'All accounts', send:'Send', receive:'Receive', exchange:'Exchange', more:'More', seeAll:'See all', crypto:'Crypto', transactions:'Transactions', today:'Today', yesterday:'Yesterday', noTx:'No transactions yet',
      personal:'Personal', portfolio:'Portfolio', home:'Home', services:'Services', defName:'Friendly card' },
    fr: { cards:'Cartes', addCard:'Ajouter une carte', freeze:'Bloquer', unfreeze:'D\u00e9bloquer', frozen:'Bloqu\u00e9e', details:'D\u00e9tails', hide:'Masquer', settings:'R\u00e9glages', limits:'Plafonds', virtual:'Virtuelle', physical:'Physique',
      cardNumber:'Num\u00e9ro de carte', expiry:'Expiration', cvv:'CVV', holder:'Titulaire', copied:'Copi\u00e9', online:'Paiements en ligne', onlineD:'Utiliser cette carte sur les sites et applications', contactless:'Paiements sans contact', contactlessD:'Payer en approchant la carte',
      atm:'Retraits aux distributeurs', atmD:'Retirer des esp\u00e8ces', monthly:'Plafond mensuel', noLimit:'Sans plafond', design:'Design de la carte', label:'Nom de la carte', terminate:'R\u00e9silier la carte', terminateQ:'R\u00e9silier cette carte ? Cette action est d\u00e9finitive.',
      confirm:'Confirmer', cancel:'Annuler', activity:'Activit\u00e9 de la carte', noPay:'Aucun paiement par carte', noPayD:'Les paiements effectu\u00e9s avec votre carte appara\u00eetront ici.', security:'S\u00e9curit\u00e9', spending:'Plafonds de d\u00e9penses', appearance:'Apparence',
      saved:'Enregistr\u00e9', froze:'Carte bloqu\u00e9e', unfroze:'Carte d\u00e9bloqu\u00e9e', gone:'Carte r\u00e9sili\u00e9e', chooseDesign:'Choisissez un design', create:'Cr\u00e9er la carte', noCards:'Aucune carte', noCardsD:'Cr\u00e9ez une carte virtuelle Friendly en quelques secondes.', typeL:'Type de carte', save:'Enregistrer', failed:'Une erreur est survenue',
      hello:'Bonjour', accounts:'Comptes', allAccounts:'Tous les comptes', send:'Envoyer', receive:'Recevoir', exchange:'\u00c9changer', more:'Plus', seeAll:'Tout voir', crypto:'Crypto', transactions:'Transactions', today:'Aujourd\'hui', yesterday:'Hier', noTx:'Aucune transaction',
      personal:'Personnel', portfolio:'Portefeuille', home:'Accueil', services:'Services', defName:'Carte Friendly' },
    ar: { cards:'\u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a', addCard:'\u0625\u0636\u0627\u0641\u0629 \u0628\u0637\u0627\u0642\u0629', freeze:'\u062a\u062c\u0645\u064a\u062f', unfreeze:'\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u062c\u0645\u064a\u062f', frozen:'\u0645\u062c\u0645\u0651\u062f\u0629', details:'\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644', hide:'\u0625\u062e\u0641\u0627\u0621', settings:'\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a', limits:'\u0627\u0644\u062d\u062f\u0648\u062f', virtual:'\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629', physical:'\u0645\u0627\u062f\u064a\u0629',
      cardNumber:'\u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', expiry:'\u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621', cvv:'CVV', holder:'\u0635\u0627\u062d\u0628 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', copied:'\u062a\u0645 \u0627\u0644\u0646\u0633\u062e', online:'\u0627\u0644\u062f\u0641\u0639 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a', onlineD:'\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0648\u0627\u0644\u062a\u0637\u0628\u064a\u0642\u0627\u062a', contactless:'\u0627\u0644\u062f\u0641\u0639 \u0628\u062f\u0648\u0646 \u0644\u0645\u0633', contactlessD:'\u0627\u0644\u062f\u0641\u0639 \u0628\u062a\u0642\u0631\u064a\u0628 \u0627\u0644\u0628\u0637\u0627\u0642\u0629',
      atm:'\u0627\u0644\u0633\u062d\u0628 \u0645\u0646 \u0627\u0644\u0635\u0631\u0627\u0641', atmD:'\u0633\u062d\u0628 \u0627\u0644\u0646\u0642\u062f \u0645\u0646 \u0623\u062c\u0647\u0632\u0629 \u0627\u0644\u0635\u0631\u0627\u0641', monthly:'\u0627\u0644\u062d\u062f \u0627\u0644\u0634\u0647\u0631\u064a', noLimit:'\u0628\u062f\u0648\u0646 \u062d\u062f', design:'\u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', label:'\u0627\u0633\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', terminate:'\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', terminateQ:'\u0647\u0644 \u062a\u0631\u064a\u062f \u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629\u061f \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u062a\u0631\u0627\u062c\u0639.',
      confirm:'\u062a\u0623\u0643\u064a\u062f', cancel:'\u0625\u0644\u063a\u0627\u0621', activity:'\u0646\u0634\u0627\u0637 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', noPay:'\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0628\u0627\u0644\u0628\u0637\u0627\u0642\u0629', noPayD:'\u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u062a\u0645 \u0628\u0628\u0637\u0627\u0642\u062a\u0643.', security:'\u0627\u0644\u0623\u0645\u0627\u0646', spending:'\u062d\u062f\u0648\u062f \u0627\u0644\u0625\u0646\u0641\u0627\u0642', appearance:'\u0627\u0644\u0645\u0638\u0647\u0631',
      saved:'\u062a\u0645 \u0627\u0644\u062d\u0641\u0638', froze:'\u062a\u0645 \u062a\u062c\u0645\u064a\u062f \u0627\u0644\u0628\u0637\u0627\u0642\u0629', unfroze:'\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062a\u062c\u0645\u064a\u062f \u0627\u0644\u0628\u0637\u0627\u0642\u0629', gone:'\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', chooseDesign:'\u0627\u062e\u062a\u0631 \u062a\u0635\u0645\u064a\u0645\u0627\u064b', create:'\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', noCards:'\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0637\u0627\u0642\u0629', noCardsD:'\u0623\u0646\u0634\u0626 \u0628\u0637\u0627\u0642\u0629 \u0641\u0631\u0646\u062f\u064a \u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629 \u0641\u064a \u062b\u0648\u0627\u0646\u064d.', typeL:'\u0646\u0648\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0629', save:'\u062d\u0641\u0638', failed:'\u062d\u062f\u062b \u062e\u0637\u0623 \u0645\u0627',
      hello:'\u0645\u0631\u062d\u0628\u0627\u064b', accounts:'\u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a', allAccounts:'\u0643\u0644 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a', send:'\u0625\u0631\u0633\u0627\u0644', receive:'\u0627\u0633\u062a\u0644\u0627\u0645', exchange:'\u062a\u0628\u062f\u064a\u0644', more:'\u0627\u0644\u0645\u0632\u064a\u062f', seeAll:'\u0639\u0631\u0636 \u0627\u0644\u0643\u0644', crypto:'\u0643\u0631\u064a\u0628\u062a\u0648', transactions:'\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a', today:'\u0627\u0644\u064a\u0648\u0645', yesterday:'\u0623\u0645\u0633', noTx:'\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0639\u0627\u0645\u0644\u0627\u062a',
      personal:'\u0634\u062e\u0635\u064a', portfolio:'\u0627\u0644\u0645\u062d\u0641\u0638\u0629', home:'\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629', services:'\u0627\u0644\u062e\u062f\u0645\u0627\u062a', defName:'\u0628\u0637\u0627\u0642\u0629 Friendly' }
  };

  Object.assign(D.en, { active:'Active', tagline:'Your money. Anywhere. Instantly.', signupSub:'Create your account in minutes.', resetSub:'Enter your e-mail and we will send you a reset link.', createAccount:'Create account', language:'Language', notifEmpty:'You are all caught up', notifEmptyD:'New alerts about your money and security will appear here.' });
  Object.assign(D.fr, { active:'Active', tagline:'Votre argent. Partout. Instantan\u00e9ment.', signupSub:'Cr\u00e9ez votre compte en quelques minutes.', resetSub:'Saisissez votre e-mail, nous vous enverrons un lien de r\u00e9initialisation.', createAccount:'Cr\u00e9er un compte', language:'Langue', notifEmpty:'Vous \u00eates \u00e0 jour', notifEmptyD:'Les nouvelles alertes sur votre argent et votre s\u00e9curit\u00e9 appara\u00eetront ici.' });
  Object.assign(D.ar, { active:'\u0646\u0634\u0637\u0629', tagline:'\u0623\u0645\u0648\u0627\u0644\u0643. \u0641\u064a \u0643\u0644 \u0645\u0643\u0627\u0646. \u0641\u0648\u0631\u0627\u064b.', signupSub:'\u0623\u0646\u0634\u0626 \u062d\u0633\u0627\u0628\u0643 \u0641\u064a \u062f\u0642\u0627\u0626\u0642.', resetSub:'\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u0633\u0646\u0631\u0633\u0644 \u0644\u0643 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0639\u064a\u064a\u0646.', createAccount:'\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628', language:'\u0627\u0644\u0644\u063a\u0629', notifEmpty:'\u0644\u0627 \u062c\u062f\u064a\u062f', notifEmptyD:'\u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0627\u0644\u062c\u062f\u064a\u062f\u0629 \u0639\u0646 \u0623\u0645\u0648\u0627\u0644\u0643 \u0648\u0623\u0645\u0627\u0646\u0643.' });

  /* 12.4.0 — honest card states (a card is a "preview" until a real card issuer is connected), card details, themes */
  Object.assign(D.en, { idLabel:'Friendly card ID', idNote:'Reference of this card in Friendly Pay. It is not a payment card number.',
    noActivityTitle:'No card activity', noActivityBody:'Card payments will be listed here.', cardDetails:'Card details',
    showId:'Show card ID', hideId:'Hide card ID', idShort:'Card ID', pinProtected:'Protected by your PIN', statusL:'Status', currencyL:'Currency', created:'Created', historyL:'History',

    th_obsidian:'Obsidian', th_midnight:'Midnight', th_graphite:'Graphite', th_violet:'Orange', th_aurora:'Aurora', th_minimal:'Minimal', th_metal:'Metal', cardOf:'Card', freezeD:'Temporarily block this card' });
  Object.assign(D.fr, { idLabel:'ID de carte Friendly', idNote:'Référence de cette carte dans Friendly Pay. Ce n’est pas un numéro de carte bancaire.',
    noActivityTitle:'Aucune activité de carte', noActivityBody:'Les paiements par carte seront listés ici.', cardDetails:'Détails de la carte',
    showId:'Afficher l’ID de carte', hideId:'Masquer l’ID de carte', idShort:'ID carte', pinProtected:'Protégé par votre code PIN', statusL:'Statut', currencyL:'Devise', created:'Créée le', historyL:'Historique',

    th_obsidian:'Obsidienne', th_midnight:'Minuit', th_graphite:'Graphite', th_violet:'Orange', th_aurora:'Aurore', th_minimal:'Minimal', th_metal:'Métal', cardOf:'Carte', freezeD:'Bloquer temporairement cette carte' });
  Object.assign(D.ar, { idLabel:'معرّف بطاقة فرندي', idNote:'مرجع هذه البطاقة في فرندي باي. وهو ليس رقم بطاقة دفع.',
    noActivityTitle:'لا يوجد نشاط للبطاقة', noActivityBody:'ستُعرض مدفوعات البطاقة هنا.', cardDetails:'تفاصيل البطاقة',
    showId:'إظهار معرّف البطاقة', hideId:'إخفاء معرّف البطاقة', idShort:'المعرّف', pinProtected:'محمي برمز PIN', statusL:'الحالة', currencyL:'العملة', created:'تاريخ الإنشاء', historyL:'السجل',

    th_obsidian:'سبج', th_midnight:'منتصف الليل', th_graphite:'جرافيت', th_violet:'برتقالي', th_aurora:'شفق', th_minimal:'بسيط', th_metal:'معدني', cardOf:'بطاقة', freezeD:'حظر هذه البطاقة مؤقتاً' });
  const vt = k => (D[LANG] && D[LANG][k]) || D.en[k] || k;
  const st = { sel: 0, newTheme: 'obsidian', hideTimer: null, closeOv: null, busy: false, enter: false, fx: null };
  const l4 = c => c.draft ? '\u2022\u2022\u2022\u2022' : String(c.number || '0000').slice(-4);   /* a card being designed has no ID yet */
  const fmtNum = n => String(n || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  const cards = () => Runtime.cards || [];
  const cur = () => cards()[Math.min(st.sel, Math.max(0, cards().length - 1))];
  const MASK = '••••••';
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* A card is a "preview" until the data says a real issuer issued it (c.issued === true). It is never shown as "Active" before. */
  const themeOf = c => (c && TH.indexOf(c.theme) >= 0) ? c.theme : 'midnight';
  const cardState = c => c.frozen ? 'frozen' : (c.issued === true ? 'active' : 'preview');
  const ava = () => {
    const p = Runtime.profile || {};
    const ini = (((p.firstName || 'Y')[0]) + ((p.lastName || 'W')[0])).toUpperCase();
    return p.photo ? '<img src="' + escapeHtml(p.photo) + '" alt="">' : escapeHtml(ini);
  };
  async function save(c, patch){
    const old = {}; Object.keys(patch).forEach(k => { old[k] = c[k]; });
    Object.assign(c, patch);
    try { await UserDataEngine.writeSub(UserContext.requireCtx().uid, 'cards', c.id, c); return true; }
    catch(e){ Object.assign(c, old); toast(vt('failed'), 'error'); return false; }
  }
  /* ---------- card face (CSS-drawn: no network mark, no chip, no NFC symbol, no CVV) ---------- */
  /* 12.9.0: no "preview / not issued" wording is shown on cards; a label appears only for Frozen and Active */
  const stateLbl = s => (s === 'frozen' ? vt('frozen') : s === 'active' ? vt('active') : '');
  function stateChip(c){ const s = cardState(c), l = stateLbl(s); return l ? '<span class="rv-state s-' + s + '">' + l + '</span>' : ''; }
  /* Slot for the card network. It stays EMPTY until the card data itself carries a real network AND a real issuer. */
  function netSlot(c){ return (c.network && c.issuer) ? '<span class="rv-net-slot" data-network="' + escapeHtml(String(c.network)) + '">' + escapeHtml(String(c.network)) + '</span>' : ''; }
  function faceHTML(c){
    const created = c.createdAt ? fmtDate(c.createdAt) : '';
    return '<div class="rv-card th-' + themeOf(c) + (st.enter ? ' rv-enter' : '') + '" data-card="' + escapeHtml(c.id) + '" data-state="' + cardState(c) + '" role="group" aria-label="' + escapeHtml((c.label || vt('defName')) + ' •••• ' + l4(c)) + '"><div class="rv-in">' +
      '<div class="rv-face rv-front">' +
        '<i class="rv-grain" aria-hidden="true"></i><i class="rv-foil" aria-hidden="true"></i>' +
        '<div class="rv-top2"><img class="rv-wm" src="assets/brand/friendly-letters-white.svg" alt="Friendly Pay">' + stateChip(c) + '</div>' +
        '<div class="rv-mid"><span class="rv-name">' + escapeHtml(c.label || vt('defName')) + '</span>' +
          '<span class="rv-num ltr" dir="ltr"><span>\u2022\u2022\u2022\u2022</span><span>\u2022\u2022\u2022\u2022</span><span>\u2022\u2022\u2022\u2022</span><span>' + l4(c) + '</span></span></div>' +
        '<div class="rv-bot"><span class="rv-holder">' + escapeHtml(c.holderName || '') + '</span>' + netSlot(c) + '</div>' +
        (c.frozen ? '<div class="rv-frost' + (st.fx === c.id ? ' in' : '') + '"><i class="rv-sp s1"></i><i class="rv-sp s2"></i><i class="rv-sp s3"></i><i class="rv-sp s4"></i><i class="rv-sp s5"></i><img src="assets/ui/snowflake.svg" alt=""><span>' + vt('frozen') + '</span></div>' : '') +
      '</div>' +
      '<div class="rv-face rv-back"><div class="rv-bk">' +
        '<div class="rv-f"><small>' + vt('idLabel') + '</small><b class="ltr" data-rv-n>•••• •••• •••• ' + l4(c) + '</b><button class="rv-cp" data-rv="copy:number" aria-label="' + escapeHtml(vt('copied')) + '">' + icon('copy', 16) + '</button></div>' +
        '<div class="rv-row"><div class="rv-f"><small>' + vt('holder') + '</small><b class="rv-hold">' + escapeHtml(c.holderName || '') + '</b></div>' +
        (created ? '<div class="rv-f"><small>' + vt('created') + '</small><b class="ltr">' + escapeHtml(created) + '</b></div>' : '') + '</div>' +
        '<p class="rv-note">' + vt('idNote') + '</p>' +
      '</div></div></div></div>';
  }
  function actionsHTML(c){
    const b = (k, ic, lbl, on) => '<button class="rv-act' + (on ? ' on' : '') + '" data-rv="' + k + '"><i>' + icon(ic, 22) + '</i><span' + (k === 'details' ? ' data-lbl="' + escapeHtml(lbl) + '"' : '') + '>' + lbl + '</span></button>';
    return b('freeze', 'lock', c.frozen ? vt('unfreeze') : vt('freeze'), c.frozen) + b('details', 'eye', vt('idShort')) + b('limits', 'chart', vt('limits')) + b('settings', 'settings', vt('details'));
  }
  function switchRow(k, ic, ttl, sub, on){
    return '<button class="rv-row2" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-rv="' + k + '"><span class="tile">' + icon(ic, 20) + '</span><span class="tx"><b>' + ttl + '</b><small>' + sub + '</small></span><span class="rv-sw" aria-hidden="true" aria-checked="' + (on ? 'true' : 'false') + '"></span></button>';
  }
  function toggleHTML(c){
    return switchRow('tg:online', 'globe', vt('online'), vt('onlineD'), c.online !== false) + switchRow('tg:contactless', 'mobile', vt('contactless'), vt('contactlessD'), c.contactless !== false) + switchRow('tg:atm', 'banknote', vt('atm'), vt('atmD'), c.atm !== false);
  }
  const limTxt = c => (c.monthlyLimit > 0 ? CurrencyEngine.format(c.monthlyLimit, c.currency || 'OMR') : vt('noLimit'));
  function metaHTML(c){
    const s = cardState(c);
    return '<b>' + escapeHtml(c.label || vt('defName')) + '</b><span class="ltr">•••• ' + l4(c) + ' · ' + escapeHtml(c.currency || 'OMR') + '</span>' + (stateLbl(s) ? '<br><span class="rv-st s-' + s + '">' + stateLbl(s) + '</span>' : '');
  }
  const topbar = title => '<div class="topbar"><button class="topbar-back" data-action="back" aria-label="' + t('ui.back') + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button><span class="topbar-title">' + title + '</span><span style="width:calc(42px*var(--ui))"></span></div>';
  const swatches = (act, current) => TH.map(x => '<button class="rv-swatch th-' + x + '" data-rv="' + act + ':' + x + '" aria-pressed="' + (current === x ? 'true' : 'false') + '" aria-label="' + escapeHtml(vt('th_' + x)) + '"></button>').join('');
  /* ---------- screens ---------- */
  function renderCardsV12(){
    const all = cards();
    const head = '<div class="rv-title"><h1>' + vt('cards') + '</h1><button class="rv-circ" data-nav="cards-add" aria-label="' + vt('addCard') + '">' + icon('plus', 22) + '</button></div>';
    if (!all.length){
      return '<div class="rv-page">' + head + emptyState('cards', vt('noCards'), vt('noCardsD'),
        '<button class="btn btn-primary" data-nav="cards-add" style="margin:18px auto 0;max-width:280px">' + icon('plus', 18) + '<span>' + vt('addCard') + '</span></button>') + '</div>';
    }
    const c = cur();
    st.enter = !reduced();
    const slides = all.map((x, i) => '<div class="rv-slide" data-i="' + i + '" style="--i:' + i + '">' + faceHTML(x) + '</div>').join('');
    st.enter = false;
    return '<div class="rv-page">' + head +
      '<div class="rv-car" id="rv-car">' + slides + '</div>' +
      (all.length > 1 ? '<div class="rv-dots" id="rv-dots">' + all.map((x, i) => '<i class="' + (i === st.sel ? 'on' : '') + '"></i>').join('') + '</div>' : '') +
      '<div class="rv-meta" id="rv-meta">' + metaHTML(c) + '</div>' +
      '<div class="rv-ca" id="rv-ca">' + actionsHTML(c) + '</div>' +
      '<div><div class="rv-sw-h">' + vt('security') + '</div><div class="rv-set" id="rv-tg">' + toggleHTML(c) + '</div></div>' +
      '<div><div class="rv-sw-h">' + vt('activity') + '</div><div class="rv-set">' + emptyState('clock', vt('noActivityTitle'), vt('noActivityBody')) + '</div></div></div>';
  }
  function renderCardSettings(){
    const c = cur();
    if (!c){ setTimeout(() => R.go('cards'), 0); return ''; }
    const s = cardState(c);
    const info = (ic, ttl, val) => '<div class="rv-row2 static"><span class="tile">' + icon(ic, 20) + '</span><span class="tx"><b>' + ttl + '</b></span><span class="rv-val ltr">' + val + '</span></div>';
    st.enter = !reduced();
    const face = faceHTML(c);
    st.enter = false;
    return topbar(vt('cardDetails')) +
      '<div class="rv-page" style="padding-top:0">' +
        '<div class="rv-pre" style="max-width:340px;margin:0 auto;width:100%">' + face + '</div>' +
        '<div class="rv-set">' +
          (stateLbl(s) ? info('info', vt('statusL'), '<span class="rv-st s-' + s + '">' + stateLbl(s) + '</span>') : '') +
          info('wallet', vt('currencyL'), escapeHtml(c.currency || 'OMR')) +
          (c.createdAt ? info('cal', vt('created'), escapeHtml(fmtDate(c.createdAt))) : '') +
          '<button class="rv-row2" data-rv="details"><span class="tile">' + icon('eye', 20) + '</span><span class="tx"><b data-lbl="' + escapeHtml(vt('showId')) + '">' + vt('showId') + '</b><small>' + vt('pinProtected') + '</small></span>' + icon('chev', 18) + '</button>' +
        '</div>' +
        '<div class="rv-set">' + switchRow('freeze', 'lock', c.frozen ? vt('unfreeze') : vt('freeze'), c.frozen ? vt('frozen') : vt('freezeD'), !!c.frozen) + '</div>' +
        '<div><div class="rv-sw-h">' + vt('security') + '</div><div class="rv-set" id="rv-tg">' + toggleHTML(c) + '</div></div>' +
        '<div><div class="rv-sw-h">' + vt('spending') + '</div><div class="rv-set"><button class="rv-row2" data-rv="limits"><span class="tile">' + icon('chart', 20) + '</span><span class="tx"><b>' + vt('monthly') + '</b><small id="rv-limv">' + escapeHtml(limTxt(c)) + '</small></span>' + icon('chev', 18) + '</button></div></div>' +
        '<div><label class="rv-sw-h" for="rv-label">' + vt('label') + '</label><input class="rv-input" id="rv-label" maxlength="24" value="' + escapeHtml(c.label || '') + '" placeholder="' + vt('defName') + '"></div>' +
        '<div><div class="rv-sw-h">' + vt('design') + '</div><div class="rv-set"><div class="rv-sws">' + swatches('design', themeOf(c)) + '</div></div></div>' +
        '<div><div class="rv-sw-h">' + vt('activity') + '</div><div class="rv-set">' + emptyState('clock', vt('noActivityTitle'), vt('noActivityBody')) + '</div></div>' +
        '<div class="rv-set"><button class="rv-row2 dg" data-rv="terminate"><span class="tile">' + icon('trash', 20) + '</span><span class="tx"><b>' + vt('terminate') + '</b></span></button></div>' +
      '</div>';
  }
  function renderCardsAddV12(){
    const holder = ((Runtime.profile && Runtime.profile.firstName || '') + ' ' + (Runtime.profile && Runtime.profile.lastName || '')).trim().toUpperCase();
    const prev = { id:'x', draft: true, theme: st.newTheme, number: '', holderName: holder };
    return topbar(vt('addCard')) +
      '<div class="rv-page" style="padding-top:0"><div id="rv-prev" style="max-width:360px;margin:0 auto;width:100%">' + faceHTML(prev) + '</div>' +
        '<div><div class="rv-sw-h">' + vt('chooseDesign') + '</div><div class="rv-set"><div class="rv-sws" id="rv-nsw">' + swatches('newTheme', st.newTheme) + '</div></div></div>' +
        '<div><label class="rv-sw-h" for="nc-holder">' + vt('holder') + '</label><input class="rv-input" id="nc-holder" autocapitalize="characters" spellcheck="false" value="' + escapeHtml(holder) + '"></div>' +
        '<div class="field-err" id="nc-err" role="alert"></div>' +
        '<button class="btn btn-primary" data-rv="create">' + icon('check', 18) + '<span>' + vt('create') + '</span></button></div>';
  }
  /* ---------- home ---------- */
  /* amount with the currency code set smaller, so long balances stay on one line */
  function money(a, c){
    const code = String(c || 'OMR').toUpperCase();
    const f = escapeHtml(CurrencyEngine.format(a, code));
    return f.replace(code, '<span class="rv-cur">' + code + '</span>');
  }
  /* 12.6.0: a balance shown in the display currency (default USD); the original amount stays visible next to it */
  function moneyV(a, c){ const v = balanceView(a, c); return money(v.amount, v.currency); }
  function origCap(a, c){ const v = balanceView(a, c); return v.converted ? CurrencyEngine.format(v.orig.amount, v.orig.currency) : ''; }
  function renderHomeV12(){
    if (!Runtime.ctx && !Runtime.profile) return skeletonHome();                 /* nothing loaded yet: shapes only, no numbers */
    const main = mainAccount(); const hide = !!Runtime.hideBalance;
    const unread = (Runtime.notifications || []).filter(n => !n.read).length;
    const p = Runtime.profile || {};
    const others = (Runtime.accounts || []).filter(a => a.type !== 'CRYPTO' && a.type !== 'MAIN').slice(0, 4);
    const txs = visibleTransactions(Runtime.transactions || []).slice(0, 5);
    const showAvail = main.availableBalance != null && Math.abs(Number(main.availableBalance) - Number(main.balance)) > 0.0005;
    const dv = balanceView(main.balance, main.currency);
    let ai = 0;
    const act = (nav, ic, lbl, pr) => '<button class="rv-act' + (pr ? ' p' : '') + '" style="--i:' + (ai++) + '" data-nav="' + nav + '"><i>' + icon(ic, 24) + '</i><span>' + lbl + '</span></button>';
    return '<div class="rv-home ds-home">' +
      '<header class="rv-top">' +
        '<button class="rv-ava" data-yb-drawer aria-label="menu">' + ava() + '</button>' +
        '<div class="rv-hello"><span class="ds-hello-l"><img class="ds-mark" src="assets/brand/logo-mark.svg" alt="">' + vt('hello') + '</span><b>' + escapeHtml(p.firstName || p.displayName || 'Friendly') + '</b></div>' +
        '<button class="rv-circ" data-action="notifications" aria-label="' + escapeHtml(t('ui.notifications')) + '">' + icon('bell', 20) + (unread ? '<span class="rv-bdg">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>' +
        '<button class="rv-circ" data-nav="settings" aria-label="' + escapeHtml(t('ds.settings')) + '">' + icon('settings', 20) + '</button>' +
      '</header>' +
      '<section class="ds-balance" aria-label="' + escapeHtml(t('home.main')) + '">' +
        '<div class="ds-bal-top"><span class="ds-bal-label">' + escapeHtml(t('home.main')) + '</span>' +
          '<button class="ds-eye" data-action="toggle-balance" aria-pressed="' + (hide ? 'true' : 'false') + '">' + icon(hide ? 'eyeOff' : 'eye', 22) + '</button></div>' +
        '<div class="ds-bal-amt ltr' + (hide ? ' is-hidden' : '') + '">' + (hide ? escapeHtml(MASK) : money(dv.amount, dv.currency)) + '</div>' +
        (dv.converted && !hide ? '<div class="ds-bal-orig ltr">' + escapeHtml(CurrencyEngine.format(main.balance, main.currency)) + ' · 1 ' + escapeHtml(main.currency) + ' = ' + dv.rate.toFixed(4) + ' ' + escapeHtml(dv.currency) + '</div>' : '') +
        (showAvail && !hide ? '<div class="ds-bal-sub">' + escapeHtml(t('ds.available')) + ' <b class="ltr">' + moneyV(main.availableBalance, main.currency) + '</b></div>' : '') +
      '</section>' +
      '<nav class="rv-acts" aria-label="' + escapeHtml(vt('more')) + '">' + act('country-select', 'send', vt('send'), true) + act('history', 'history', vt('historyL')) + act('cards', 'cards', vt('cards')) + act('services', 'apps', vt('more')) + '</nav>' +
      (typeof Promos !== 'undefined' ? Promos.html() : '') +
      '<section class="rv-sec"><div class="rv-h"><h2>' + vt('transactions') + '</h2><button data-nav="history">' + vt('seeAll') + '</button></div>' +
        (txs.length ? txGroupedHtml(txs, hide) : '<div class="rv-list">' + emptyState('history', vt('noTx'), t('ds.nohist_body')) + '</div>') + '</section>' +
      '<section class="rv-sec"><div class="rv-h"><h2>' + vt('cards') + '</h2><button data-nav="cards">' + vt('seeAll') + '</button></div><div class="rv-strip">' +
        cards().map(c => '<button class="rv-mini th-' + themeOf(c) + (c.frozen ? ' fz' : '') + '" data-nav="cards" aria-label="' + escapeHtml((c.label || vt('defName')) + ' •••• ' + l4(c)) + '"><span class="rv-mini-st">' + stateLbl(cardState(c)) + '</span><span class="ltr">•••• ' + l4(c) + '</span></button>').join('') +
        '<button class="rv-mini rv-mini-add" data-nav="cards-add">' + icon('plus', 20) + '<span>' + vt('addCard') + '</span></button></div></section>' +
      (others.length ? '<section class="rv-sec"><div class="rv-h"><h2>' + vt('accounts') + '</h2><button data-rv="accts">' + vt('seeAll') + '</button></div><div class="rv-grid2">' +
        others.map(a => '<button class="rv-tile" data-rv="accts"><small>' + escapeHtml(a.name || a.currency) + '</small><b class="ltr">' + (hide ? escapeHtml(MASK) : moneyV(a.balance, a.currency)) + '</b>' + (!hide && origCap(a.balance, a.currency) ? '<span class="rv-cap ltr">' + escapeHtml(origCap(a.balance, a.currency)) + '</span>' : '') + '</button>').join('') +
        '</div></section>' : '') +
      '<div style="height:calc(20px + var(--safe-b))"></div></div>';
  }
  /* ---------- navigation ---------- */
  function buildNav(){
    const nav = document.getElementById('bottom-nav');
    if (!nav || nav.getAttribute('data-v12') === LANG) return;
    nav.setAttribute('data-v12', LANG);
    const it = (nav2, ic, lbl, cta) => cta
      ? '<a class="nav-item nav-cta" data-nav="' + nav2 + '"><span class="nav-cta-tile">' + icon(ic, 26) + '</span><span class="nav-lb">' + lbl + '</span></a>'
      : '<a class="nav-item" data-nav="' + nav2 + '"><span class="nav-ic">' + icon(ic, 24) + '</span><span class="nav-lb">' + lbl + '</span></a>';
    nav.innerHTML = '<div class="nav-dock">' + it('home', 'home', vt('home')) + it('cards', 'cards', vt('cards')) + it('country-select', 'send', vt('send'), true) + it('history', 'history', vt('historyL')) + it('services', 'apps', vt('services')) + '<i class="nav-ind" aria-hidden="true"></i></div>';
    requestAnimationFrame(placeInd);
  }
  /* The highlight pill glides under the active tab (12.9.0). Measured, so it also works in RTL and at any width. */
  function placeInd(){
    const nav = document.getElementById('bottom-nav'); if (!nav) return;
    const dock = nav.querySelector('.nav-dock'), ind = nav.querySelector('.nav-ind'); if (!dock || !ind) return;
    const a = nav.querySelector('.nav-item[aria-current="page"]:not(.nav-cta)');
    if (!a || nav.hidden || !dock.offsetWidth){ ind.style.opacity = '0'; return; }
    const d = dock.getBoundingClientRect(), r = a.getBoundingClientRect();
    ind.style.width = r.width + 'px';
    ind.style.transform = 'translateX(' + (r.left - d.left) + 'px)';
    ind.style.opacity = '1';
    if (!ind.classList.contains('ready')) requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.add('ready')));
  }
  function watchNav(){
    const nav = document.getElementById('bottom-nav'); if (!nav || nav.__ind) return;
    nav.__ind = true;
    if (window.MutationObserver) new MutationObserver(() => requestAnimationFrame(placeInd)).observe(nav, { attributes:true, subtree:true, attributeFilter:['aria-current', 'hidden'] });
    window.addEventListener('resize', () => requestAnimationFrame(placeInd));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInd()).catch(() => {});
  }
  /* ---------- actions ---------- */
  function openOv(html, kind){ if (st.closeOv) { try { st.closeOv(); } catch(e){} } st.closeOv = R.overlay.open(html, { kind: kind || 'modal' }); }
  function closeOv(){ if (st.closeOv){ try { st.closeOv(); } catch(e){} st.closeOv = null; } }
  function setDetailsLabel(open){
    document.querySelectorAll('[data-rv="details"] [data-lbl]').forEach(e => { e.textContent = open ? vt(e.tagName === 'B' ? 'hideId' : 'hide') : e.getAttribute('data-lbl'); });
  }
  function hideDetails(){
    if (st.hideTimer){ clearTimeout(st.hideTimer); st.hideTimer = null; }
    document.querySelectorAll('.rv-card.flip').forEach(el => el.classList.remove('flip'));
    const c = cur(); if (!c) return;
    document.querySelectorAll('[data-rv-n]').forEach(e => { e.textContent = '•••• •••• •••• ' + l4(c); });
    setDetailsLabel(false);
  }
  async function showDetails(){
    const c = cur(); if (!c) return;
    const slide = document.querySelector('.rv-slide[data-i="' + st.sel + '"] .rv-card') || document.querySelector('.rv-card');
    if (slide && slide.classList.contains('flip')){ hideDetails(); return; }
    const pin = await PinEngine.authorize();                       /* the card ID is only shown after the PIN */
    if (!pin.ok){ if (pin.error) toast(t(pin.error), 'error'); return; }
    const sc = document.querySelector('.rv-slide[data-i="' + st.sel + '"] .rv-card') || document.querySelector('.rv-card');
    if (!sc) return;
    const n = sc.querySelector('[data-rv-n]');
    if (n) n.textContent = fmtNum(c.number);
    sc.classList.add('flip'); UIKit.haptic('success');
    setDetailsLabel(true);
    st.hideTimer = setTimeout(hideDetails, 30000);
  }
  function repaint(){
    const c = cur(); if (!c) return;
    const m = document.getElementById('rv-meta'); if (m) m.innerHTML = metaHTML(c);
    const a = document.getElementById('rv-ca'); if (a) a.innerHTML = actionsHTML(c);
    const t2 = document.getElementById('rv-tg'); if (t2) t2.innerHTML = toggleHTML(c);
    const sl = document.querySelector('.rv-slide[data-i="' + st.sel + '"]'); if (sl && !sl.querySelector('.flip')) sl.innerHTML = faceHTML(c);
    document.querySelectorAll('#rv-dots i').forEach((d, i) => d.classList.toggle('on', i === st.sel));
  }
  function shiver(){
    if (reduced()) return;
    setTimeout(() => {
      const el = document.querySelector('.rv-slide[data-i="' + st.sel + '"] .rv-card') || document.querySelector('.rv-card'); if (!el) return;
      el.classList.remove('shiver'); void el.offsetWidth; el.classList.add('shiver');
      setTimeout(() => { el.classList.remove('shiver'); }, 800);
    }, 80);
  }
  async function act(key){
    const c = cur(); const p = key.split(':'); const k = p[0], v = p.slice(1).join(':');
    if (k === 'freeze' && c){ const ok = await save(c, { frozen: !c.frozen }); if (ok){ UIKit.haptic('success'); toast(c.frozen ? vt('froze') : vt('unfroze'), 'success'); st.fx = c.frozen ? c.id : null; if (R.current() === 'card-settings') R.go('card-settings', { force:true, replace:true }); else repaint(); if (c.frozen) shiver(); setTimeout(() => { st.fx = null; }, 1800); } }
    else if (k === 'details') showDetails();
    else if (k === 'settings' && c) R.go('card-settings');
    else if (k === 'tg' && c){ const ok = await save(c, { [v]: !(c[v] !== false) }); if (ok){ UIKit.haptic('tap'); const t2 = document.getElementById('rv-tg'); if (t2) t2.innerHTML = toggleHTML(c); } }
    else if (k === 'limits' && c){
      openOv('<div class="h2" style="margin-bottom:12px">' + vt('monthly') + '</div><div class="rv-lim" style="padding:0">' + [0, 500, 1000, 2500, 5000, 10000].map(n => '<button class="chip" data-rv="lim:' + n + '" aria-pressed="' + ((c.monthlyLimit || 0) === n) + '">' + (n ? CurrencyEngine.format(n, c.currency || 'OMR') : vt('noLimit')) + '</button>').join('') + '</div><button class="btn btn-secondary" data-rv="ov-close" style="margin-top:16px;width:100%">' + vt('cancel') + '</button>', 'sheet');
    }
    else if (k === 'lim' && c){ closeOv(); if (await save(c, { monthlyLimit: Number(v) })){ toast(vt('saved'), 'success'); const e = document.getElementById('rv-limv'); if (e) e.textContent = limTxt(c); } }
    else if (k === 'ov-close') closeOv();
    else if (k === 'design' && c){ if (await save(c, { theme: v })){ document.querySelectorAll('[data-rv^="design:"]').forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-rv') === 'design:' + v ? 'true' : 'false')); const pre = document.querySelector('.rv-pre'); if (pre) pre.innerHTML = faceHTML(c); } }
    else if (k === 'terminate' && c){
      openOv('<div class="h2">' + vt('terminate') + '</div><p style="color:var(--text-2)">' + vt('terminateQ') + '</p><button class="btn btn-danger" data-rv="terminate-yes" style="width:100%">' + vt('confirm') + '</button><button class="btn btn-secondary" data-rv="ov-close" style="width:100%;margin-top:10px">' + vt('cancel') + '</button>', 'modal');
    }
    else if (k === 'terminate-yes' && c){
      closeOv();
      try { await UserDataEngine.deleteSub(UserContext.requireCtx().uid, 'cards', c.id); Runtime.cards = cards().filter(x => x.id !== c.id); st.sel = 0; toast(vt('gone'), 'success'); R.go('cards', { force:true, reset:true }); } catch(e){ toast(vt('failed'), 'error'); }
    }
    else if (k === 'copy' && c){ copyText(String(c.number || ''), vt('copied')); }
    else if (k === 'accts'){
      const rows = (Runtime.accounts || []).filter(a => FEATURES.crypto || a.type !== 'CRYPTO').map(a => '<div class="rv-row2 static"><span class="tile">' + icon(a.type === 'CRYPTO' ? 'crypto' : 'wallet', 20) + '</span><span class="tx"><b>' + escapeHtml(a.currency) + '</b><small>' + escapeHtml(a.name || '') + '</small></span><b class="ltr">' + escapeHtml(Runtime.hideBalance ? MASK : (a.type === 'CRYPTO' ? CurrencyEngine.format(a.balance, a.currency) : balanceText(a.balance, a.currency))) + '</b></div>').join('');
      openOv('<div class="h2" style="margin-bottom:8px">' + vt('allAccounts') + '</div><div class="rv-set">' + rows + '</div><button class="btn btn-secondary" data-rv="ov-close" style="margin-top:14px;width:100%">' + vt('cancel') + '</button>', 'sheet');
    }
    else if (k === 'newTheme'){
      st.newTheme = v;
      document.querySelectorAll('#rv-nsw .rv-swatch').forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-rv') === 'newTheme:' + v ? 'true' : 'false'));
      const rc = document.querySelector('#rv-prev .rv-card'); if (rc){ TH.forEach(x => rc.classList.remove('th-' + x)); rc.classList.add('th-' + v); }
    }
    else if (k === 'create'){
      const holder = (document.getElementById('nc-holder').value || '').trim().replace(/\s+/g, ' '), err = document.getElementById('nc-err');
      err.textContent = ''; if (holder.length < 3){ err.textContent = t('cards.err.holder'); return; }
      if (st.busy) return; st.busy = true;
      try {
        const now = new Date();
        /* a PREVIEW card: a design + a reference ID saved in the account. No security code is generated or stored, nothing claims a payment network. */
        const nc = { id: ID.card(), type: 'VIRTUAL', brand: 'NEX', theme: st.newTheme, holderName: holder.toUpperCase(), number: luhnGenerateCardNumber('9701', 16),
          currency: 'OMR', frozen: false, contactless: true, online: true, atm: true, monthlyLimit: 0, label: '', status: 'PREVIEW', issued: false, createdAt: now.getTime() };
        await UserDataEngine.writeSub(UserContext.requireCtx().uid, 'cards', nc.id, nc);
        Runtime.cards.unshift(nc); st.sel = 0; UIKit.haptic('success'); toast(t('cards.created'), 'success'); R.go('cards', { force:true });
      } catch(e){ err.textContent = t('errors.UNKNOWN_ERROR'); }
      st.busy = false;
    }
  }
  /* ---------- screen hooks ---------- */
  function tilt(host){
    if (reduced()) return;
    let raf = 0, tx = 0, ty = 0, mx = 30, my = 0;
    const el = () => host.querySelector('.rv-card');
    const apply = () => { raf = 0; const c = el(); if (!c) return; c.style.setProperty('--tx', tx.toFixed(2) + 'deg'); c.style.setProperty('--ty', ty.toFixed(2) + 'deg'); c.style.setProperty('--mx', mx + '%'); c.style.setProperty('--my', my + '%'); c.style.setProperty('--shx', (-ty * 1.2).toFixed(1) + 'px'); c.style.setProperty('--sh', '.9'); };
    const mv = e => { const r = host.getBoundingClientRect(); if (!r.width) return; const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); tx = (0.5 - y) * 14; ty = (x - 0.5) * 18; mx = Math.round(x * 100); my = Math.round(y * 100); if (!raf) raf = requestAnimationFrame(apply); };
    const rest = () => { tx = 0; ty = 0; mx = 30; my = 0; if (!raf) raf = requestAnimationFrame(apply); const c = el(); if (c){ c.style.setProperty('--sh', '.5'); c.style.setProperty('--shx', '0px'); } };
    host.addEventListener('pointermove', mv); host.addEventListener('pointerdown', mv); host.addEventListener('pointerup', rest); host.addEventListener('pointerleave', rest); host.addEventListener('pointercancel', rest);
    /* phone tilt: the light on the card follows the real device orientation (iOS asks permission on the first touch) */
    let gyro = false, touching = false;
    const onOri = e => {
      if (touching || e.gamma == null || e.beta == null) return;
      const g = Math.max(-30, Math.min(30, e.gamma)), b = Math.max(-30, Math.min(30, e.beta - 40));
      ty = g * 0.5; tx = -b * 0.35; mx = Math.round(50 + g * 1.6); my = Math.round(50 + b * 1.6);
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const startGyro = () => { if (gyro) return; gyro = true; window.addEventListener('deviceorientation', onOri, true); R.onLeave(() => window.removeEventListener('deviceorientation', onOri, true)); };
    host.addEventListener('pointerdown', () => { touching = true; });
    host.addEventListener('pointerup', () => { touching = false; }); host.addEventListener('pointercancel', () => { touching = false; });
    try {
      if (typeof DeviceOrientationEvent !== 'undefined'){
        if (typeof DeviceOrientationEvent.requestPermission === 'function'){
          host.addEventListener('pointerdown', () => { if (gyro) return; DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') startGyro(); }).catch(() => {}); }, { once:true });
        } else startGyro();
      }
    } catch(e){}
  }
  const LANG_NAMES = { en:'English', fr:'Français', ar:'العربية' };
  function decorateAuth(id){
    const root = document.getElementById(id); if (!root || root.classList.contains('rv-auth')) return;
    const body = root.querySelector('.screen-body'); if (!body) return;
    root.classList.add('rv-auth');
    const oldLogo = body.querySelector('.logo-lockup'); if (oldLogo && oldLogo.parentElement !== body) oldLogo.parentElement.remove();
    const hero = document.createElement('div'); hero.className = 'rv-auth-hero';
    const brandName = LANG === 'ar' ? 'فرندي باي' : 'Friendly Pay';
    hero.innerHTML = '<img class="rv-auth-mark" src="assets/brand/logo-mark.svg" alt="' + brandName + '"><h1>' + brandName + '</h1><p>' + vt(id === 'login' ? 'tagline' : id === 'signup' ? 'signupSub' : 'resetSub') + '</p>';
    body.insertBefore(hero, body.firstChild);
    if (id === 'signup'){ const tt = root.querySelector('.topbar-title'); if (tt) tt.textContent = vt('createAccount'); }
    if (id !== 'reset'){
      const lg = document.createElement('div'); lg.className = 'rv-lang'; lg.setAttribute('role', 'group'); lg.setAttribute('aria-label', vt('language'));
      lg.innerHTML = ['en', 'fr', 'ar'].map(l => '<button type="button" data-v12-lang="' + l + '" aria-pressed="' + (LANG === l) + '">' + LANG_NAMES[l] + '</button>').join('');
      body.appendChild(lg);
    }
  }
  function setLang(l){
    DeviceLang.set(l); LANG = l; applyI18n();
    const nv = document.getElementById('bottom-nav'); if (nv) nv.removeAttribute('data-v12');
    buildNav();
    try { if (typeof renderSidebar === 'function') renderSidebar(); } catch(e){}
    R.go(R.current(), { force:true, replace:true });
  }
  function onScreen(id){
    buildNav();
    if (id === 'login' || id === 'signup' || id === 'reset') decorateAuth(id);
    if (id === 'cards'){
      const car = document.getElementById('rv-car'); if (!car) return;
      const slides = car.querySelectorAll('.rv-slide'); if (st.sel >= slides.length) st.sel = 0;
      if (st.sel && slides[st.sel]) car.scrollLeft = slides[st.sel].offsetLeft - car.offsetLeft - 0;
      slides.forEach(s => tilt(s));
      let t2 = 0;
      car.addEventListener('scroll', () => { if (t2) return; t2 = requestAnimationFrame(() => { t2 = 0; const w = slides[0].offsetWidth + 14; const i = Math.max(0, Math.min(slides.length - 1, Math.round(Math.abs(car.scrollLeft) / w))); if (i !== st.sel){ hideDetails(); st.sel = i; repaint(); } }); }, { passive:true });
      R.onLeave(() => { hideDetails(); });
    }
    if (id === 'card-settings'){
      const pre = document.querySelector('.rv-pre'); if (pre) tilt(pre);
      const lb = document.getElementById('rv-label'); const c = cur();
      if (lb && c) lb.addEventListener('change', async () => { if (await save(c, { label: lb.value.trim() })) toast(vt('saved'), 'success'); });
      R.onLeave(() => { hideDetails(); });
    }
  }
  function init(){
    buildNav(); watchNav();
    const nv = document.getElementById('bottom-nav'); if (nv) nv.__bound = true;
    document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#bottom-nav [data-nav]'); if (a){ e.preventDefault(); R.go(a.getAttribute('data-nav')); } });
    document.addEventListener('click', e => { const l = e.target.closest && e.target.closest('[data-v12-lang]'); if (l){ e.preventDefault(); setLang(l.getAttribute('data-v12-lang')); } });
    document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-rv]'); if (el){ e.preventDefault(); act(el.getAttribute('data-rv')); } });
    /* tap a card on the Cards screen: back to the front if it shows its ID, otherwise open its details screen */
    document.addEventListener('click', e => {
      const card = e.target.closest && e.target.closest('.rv-card');
      if (!card || e.target.closest('[data-rv]') || R.current() !== 'cards') return;
      if (card.classList.contains('flip')){ hideDetails(); return; }
      const slide = card.closest('.rv-slide'); if (slide) st.sel = Number(slide.getAttribute('data-i')) || 0;
      R.go('card-settings');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) hideDetails(); });
  }
  return { vt, init, onScreen, renderCardsV12, renderCardSettings, renderCardsAddV12, renderHomeV12, buildNav };
})();
