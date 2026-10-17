'use strict';

/* ============================================================================================================
   Friendly Pay — « Connect Wallet » (Reown AppKit / WalletConnect), 12.7.0
   - CONNEXION SEULEMENT : cette fonction lit l'adresse publique du portefeuille. Elle n'envoie aucune transaction et ne
     demande aucune signature. Les cles privees / phrases de recuperation ne sont JAMAIS demandees ni stockees :
     elles restent dans le portefeuille de l'utilisateur (TronLink, etc.).
   - Reseau : TRON Nile (testnet) uniquement, le seul reseau utilise par l'application (voir yor-chain.js).
   - Le SDK (js/vendor/reown-appkit.js, ~2,4 Mo) est charge A LA DEMANDE : au premier clic, ou au demarrage seulement
     si une session WalletConnect precedente existe. Genere par `npm run build:walletconnect` ; ne pas modifier a la main.
   ============================================================================================================ */
Object.assign(TR.en, {
  'wc.section':'Wallet','wc.connect':'Connect Wallet','wc.connecting':'Connecting…','wc.loading':'Loading…','wc.disconnect':'Disconnect','wc.change':'Manage',
  'wc.status.disconnected':'Not connected','wc.status.connecting':'Connecting…','wc.status.connected':'Connected','wc.status.reconnecting':'Reconnecting…',
  'wc.net.nile':'Nile Testnet','wc.net.wrong':'Wrong network ({net}). Switch your wallet to Nile Testnet.',
  'wc.note':'Connecting only shares your public address. Friendly Pay never asks for your private key or recovery phrase, and nothing is sent without your approval in your wallet.',
  'wc.copy':'Copy address','wc.copied':'Address copied','wc.disconnected':'Wallet disconnected',
  'wc.err.LOAD_FAILED':'Could not load the wallet connection. Check your internet connection and try again.',
  'wc.err.INIT_FAILED':'Wallet connection could not start. Try again later.',
  'wc.err.CONNECT_ERROR':'The connection was refused or failed. Nothing was shared.',
  'wc.err.OPEN_FAILED':'Could not open the wallet window. Try again.',
  'wc.err.DISCONNECT_ERROR':'Could not disconnect cleanly. Try again.',
  'wc.err.NO_PROJECT':'Wallet connection is not configured.',
  'wc.help.title':'Trouble connecting?',
  'wc.help.1':'Tap “Connect Wallet”, then choose your wallet in the list or scan the QR code with it.',
  'wc.help.2':'On iPhone, if your wallet does not open by itself, open Friendly Pay from your wallet’s built-in browser instead of Safari.',
  'wc.help.3':'This app uses the TRON Nile test network. Switch your wallet to Nile Testnet first. Not every wallet offers it; TronLink does.',
  'wc.help.4':'Nothing is sent when you connect, and you can disconnect at any time.'
});
Object.assign(TR.fr, {
  'wc.section':'Portefeuille','wc.connect':'Connecter un portefeuille','wc.connecting':'Connexion…','wc.loading':'Chargement…','wc.disconnect':'Déconnecter','wc.change':'Gérer',
  'wc.status.disconnected':'Non connecté','wc.status.connecting':'Connexion…','wc.status.connected':'Connecté','wc.status.reconnecting':'Reconnexion…',
  'wc.net.nile':'Nile Testnet','wc.net.wrong':'Mauvais réseau ({net}). Passez votre portefeuille sur Nile Testnet.',
  'wc.note':'La connexion partage uniquement votre adresse publique. Friendly Pay ne demande jamais votre clé privée ni votre phrase de récupération, et rien n\'est envoyé sans votre approbation dans votre portefeuille.',
  'wc.copy':'Copier l\'adresse','wc.copied':'Adresse copiée','wc.disconnected':'Portefeuille déconnecté',
  'wc.err.LOAD_FAILED':'Impossible de charger la connexion de portefeuille. Vérifiez votre connexion internet puis réessayez.',
  'wc.err.INIT_FAILED':'La connexion de portefeuille n\'a pas pu démarrer. Réessayez plus tard.',
  'wc.err.CONNECT_ERROR':'La connexion a été refusée ou a échoué. Rien n\'a été partagé.',
  'wc.err.OPEN_FAILED':'Impossible d\'ouvrir la fenêtre du portefeuille. Réessayez.',
  'wc.err.DISCONNECT_ERROR':'La déconnexion n\'a pas pu se faire proprement. Réessayez.',
  'wc.err.NO_PROJECT':'La connexion de portefeuille n\'est pas configurée.',
  'wc.help.title':'Un problème pour vous connecter ?',
  'wc.help.1':'Touchez « Connecter un portefeuille », puis choisissez votre portefeuille dans la liste ou scannez le QR code avec lui.',
  'wc.help.2':'Sur iPhone, si votre portefeuille ne s\'ouvre pas tout seul, ouvrez Friendly Pay depuis le navigateur intégré de votre portefeuille plutôt que depuis Safari.',
  'wc.help.3':'Cette application utilise le réseau de test TRON Nile. Passez d\'abord votre portefeuille sur Nile Testnet. Tous les portefeuilles ne le proposent pas ; TronLink le propose.',
  'wc.help.4':'Rien n\'est envoyé lors de la connexion, et vous pouvez vous déconnecter à tout moment.'
});
Object.assign(TR.ar, {
  'wc.section':'المحفظة','wc.connect':'ربط المحفظة','wc.connecting':'جارٍ الاتصال…','wc.loading':'جارٍ التحميل…','wc.disconnect':'قطع الاتصال','wc.change':'إدارة',
  'wc.status.disconnected':'غير متصل','wc.status.connecting':'جارٍ الاتصال…','wc.status.connected':'متصل','wc.status.reconnecting':'جارٍ إعادة الاتصال…',
  'wc.net.nile':'شبكة Nile التجريبية','wc.net.wrong':'شبكة خاطئة ({net}). حوّل محفظتك إلى شبكة Nile التجريبية.',
  'wc.note':'الربط يشارك عنوانك العام فقط. لا يطلب فرندي باي مفتاحك الخاص أو عبارة الاسترداد أبدًا، ولا يُرسل أي شيء دون موافقتك داخل محفظتك.',
  'wc.copy':'نسخ العنوان','wc.copied':'تم نسخ العنوان','wc.disconnected':'تم قطع اتصال المحفظة',
  'wc.err.LOAD_FAILED':'تعذّر تحميل ربط المحفظة. تحقق من اتصالك بالإنترنت وأعد المحاولة.',
  'wc.err.INIT_FAILED':'تعذّر بدء ربط المحفظة. أعد المحاولة لاحقًا.',
  'wc.err.CONNECT_ERROR':'تم رفض الاتصال أو فشل. لم تتم مشاركة أي شيء.',
  'wc.err.OPEN_FAILED':'تعذّر فتح نافذة المحفظة. أعد المحاولة.',
  'wc.err.DISCONNECT_ERROR':'تعذّر قطع الاتصال بشكل سليم. أعد المحاولة.',
  'wc.err.NO_PROJECT':'ربط المحفظة غير مُعدّ.',
  'wc.help.title':'هل تواجه مشكلة في الربط؟',
  'wc.help.1':'اضغط «ربط المحفظة» ثم اختر محفظتك من القائمة أو امسح رمز QR بها.',
  'wc.help.2':'على iPhone، إذا لم تُفتح محفظتك تلقائيًا، افتح فرندي باي من المتصفح المدمج في المحفظة بدل Safari.',
  'wc.help.3':'يستخدم هذا التطبيق شبكة TRON Nile التجريبية. حوّل محفظتك إلى Nile Testnet أولاً. ليست كل المحافظ توفّرها؛ TronLink توفّرها.',
  'wc.help.4':'لا يُرسل أي شيء عند الربط، ويمكنك قطع الاتصال في أي وقت.'
});

const NexWC = (function(){
  /* Identifiant de projet Reown : public par conception (il est visible dans tout site qui utilise WalletConnect).
     Il est protege par la liste de domaines autorises du tableau de bord Reown (dashboard.reown.com → Domain). */
  const PROJECT_ID = 'af2149939e459cc712a573792d710fb0';
  const BUNDLE_URL = 'js/vendor/reown-appkit.js';
  const st = { loading: false, loaded: false, loadError: null, busy: false, last: null };
  let loadPromise = null, unsub = null;

  function lang(k, vars){ let s = t(k); if (vars) Object.keys(vars).forEach(x => { s = s.replace('{' + x + '}', vars[x]); }); return s; }
  function api(){ return window.NexAppKit || null; }
  function snap(){ const a = api(); return a ? a.getState() : { ready:false, status:'disconnected', isConnected:false, address:null, error:null, wrongNetwork:false, networkName:null, walletName:null }; }
  function short(a){ a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-6) : a; }
  function themeMode(){ return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function loadScript(){
    if (api()) return Promise.resolve();
    if (loadPromise) return loadPromise;
    st.loading = true; st.loadError = null; paint();
    loadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BUNDLE_URL; s.async = true;
      s.onload = () => api() ? resolve() : reject(new Error('NexAppKit missing'));
      s.onerror = () => reject(new Error('script load failed'));
      document.head.appendChild(s);
    }).then(() => { st.loaded = true; st.loading = false; }, (e) => {
      st.loading = false; st.loadError = 'LOAD_FAILED'; loadPromise = null; paint(); throw e;
    });
    return loadPromise;
  }
  function ensureReady(){
    return loadScript().then(() => {
      const a = api();
      if (!PROJECT_ID) { st.loadError = 'NO_PROJECT'; paint(); throw new Error('NO_PROJECT'); }
      a.init({
        projectId: PROJECT_ID,
        themeMode: themeMode(),
        themeVariables: { '--w3m-accent': '#0F766E', '--w3m-border-radius-master': '2px', '--w3m-z-index': 2000 },
        metadata: { name: 'Friendly Pay', description: 'Friendly Pay — connect a TRON wallet (view only, no transaction).', url: location.origin, icons: [location.origin + '/assets/icons/icon-512.png'] }
      });
      if (!unsub) unsub = a.subscribe(() => paint());
      if (!a.getState().ready) { st.loadError = a.getState().error ? a.getState().error.code : 'INIT_FAILED'; paint(); throw new Error('INIT_FAILED'); }
      st.loadError = null; paint();
    });
  }

  async function connect(){
    if (st.busy) return; st.busy = true; paint();
    try { await ensureReady(); await api().open(); } catch (e) { /* l'erreur est affichee par paint() */ }
    finally { st.busy = false; paint(); }
  }
  async function disconnect(){
    if (st.busy || !api()) return; st.busy = true; paint();
    try { await api().disconnect(); if (!snap().error) toast(t('wc.disconnected'), 'success'); } catch (e) { /* idem */ }
    finally { st.busy = false; paint(); }
  }

  function errCode(){ const s = snap(); return st.loadError || (s.error && s.error.code) || null; }
  function statusKey(){
    const s = snap();
    if (st.loading || st.busy && !s.isConnected) return 'connecting';
    if (s.isConnected) return 'connected';
    return s.status === 'connecting' ? 'connecting' : s.status === 'reconnecting' ? 'reconnecting' : 'disconnected';
  }
  function dotCls(k, wrong){ return 'nwc-dot ' + (wrong ? 'wait' : k === 'connected' ? 'ok' : k === 'disconnected' ? 'off' : 'wait'); }

  /* Bloc place dans la carte de solde de l'accueil. Rendu synchrone a partir de l'etat courant. */
  function cardHtml(){
    const s = snap(), k = statusKey(), err = errCode();
    const e = escapeHtml, wrong = !!(s.isConnected && s.wrongNetwork);
    let h = '<div class="nwc" data-nwc role="group" aria-label="' + e(t('wc.connect')) + '">';
    h += '<div class="nwc-row">';
    h += '<span class="nwc-st" role="status" aria-live="polite"><i class="' + dotCls(k, wrong) + '"></i>' + e(t('wc.status.' + k)) + (s.isConnected && s.walletName ? ' · ' + e(s.walletName) : '') + '</span>';
    if (s.isConnected && s.address){
      h += '<button class="nwc-addr ltr" type="button" data-nwc-act="copy" data-address="' + e(s.address) + '" title="' + e(t('wc.copy')) + '" aria-label="' + e(t('wc.copy') + ': ' + s.address) + '">' + e(short(s.address)) + '</button>';
    }
    h += '</div>';
    h += '<div class="nwc-row nwc-actions">';
    if (s.isConnected){
      h += '<button class="nwc-btn" type="button" data-nwc-act="open"' + (st.busy ? ' disabled' : '') + '>' + e(t('wc.change')) + '</button>';
      h += '<button class="nwc-btn nwc-ghost" type="button" data-nwc-act="disconnect"' + (st.busy ? ' disabled' : '') + '>' + e(t('wc.disconnect')) + '</button>';
    } else {
      const lbl = st.loading ? t('wc.loading') : (st.busy || k === 'connecting') ? t('wc.connecting') : t('wc.connect');
      h += '<button class="nwc-btn nwc-primary" type="button" data-nwc-act="connect"' + (st.busy || st.loading ? ' disabled aria-busy="true"' : '') + '>' + e(lbl) + '</button>';
    }
    h += '</div>';
    if (wrong) h += '<p class="nwc-msg warn" role="alert">' + e(lang('wc.net.wrong', { net: s.networkName || '?' })) + '</p>';
    if (err) h += '<p class="nwc-msg bad" role="alert">' + e(t('wc.err.' + err) === 'wc.err.' + err ? t('wc.err.CONNECT_ERROR') : t('wc.err.' + err)) + '</p>';
    h += '<p class="nwc-note">' + e(t('wc.note')) + '</p>';
    if (!s.isConnected || wrong || err){
      /* aide de connexion : liste courte, repliée par défaut (balise native, sans JavaScript) */
      h += '<details class="nwc-help"><summary>' + e(t('wc.help.title')) + '</summary><ol>' + [1, 2, 3, 4].map(i => '<li>' + e(t('wc.help.' + i)) + '</li>').join('') + '</ol></details>';
    }
    return h + '</div>';
  }
  function paint(){ document.querySelectorAll('[data-nwc-slot]').forEach(el => { el.innerHTML = cardHtml(); }); }

  function init(){
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-nwc-act]'); if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      const a = b.getAttribute('data-nwc-act');
      if (a === 'connect' || a === 'open') connect();
      else if (a === 'disconnect') disconnect();
      else if (a === 'copy') copyText(b.getAttribute('data-address'), t('wc.copied'));
    }, true);
    /* Le theme de la fenetre AppKit suit celui de l'application. */
    try { new MutationObserver(() => { const a = api(); if (a) a.setTheme(themeMode()); }).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] }); } catch (e) {}
    /* Reconnexion automatique : on ne charge le SDK au demarrage que si une session WalletConnect existe deja. */
    let had = false;
    try {
      for (let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i) || '';
        if (/^wc@2:client:.*session$/.test(key)){ const v = localStorage.getItem(key) || ''; if (v.length > 2 && v !== '[]'){ had = true; break; } }
      }
    } catch (e) {}
    if (had) { const go = () => ensureReady().catch(() => {}); setTimeout(go, 1500); }
  }
  return { init, cardHtml, paint, connect, disconnect, _state: snap };
})();
