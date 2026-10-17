'use strict';

/* ============================================================
   DEVICE ENGINE — independent from user identity
   ============================================================ */
/* ===== PROVIDER LAYER =====
   The UI and business logic talk to these providers only. Each one delegates to the existing engine.
   To connect a real source later, replace the body of the provider here; no screen changes.
   Behaviour is unchanged: these are thin wrappers, evaluated at call time. */
const FXProvider = Object.freeze({
  id: 'built-in-table',
  rate(from, to){ return ExchangeEngine.rate(from, to); },
  meta(){ return { status: FX_META.status, source: FX_META.source, updatedAt: FX_META.updatedAt }; }
});
const MarketDataProvider = Object.freeze({
  id: 'built-in-table',
  list(){ return CryptoMarketEngine.list(); },
  price(symbol){ return CryptoMarketEngine.price(symbol); },
  change24h(symbol){ return CryptoMarketEngine.change24h(symbol); },
  meta(){ return { status: FX_META.status, source: FX_META.source, updatedAt: FX_META.updatedAt }; }
});
const CountryServiceProvider = Object.freeze({
  countries(){ return CountryTransferEngine.allCountries(); },
  services(iso){ return CountryTransferEngine.services(iso); },
  config(iso){ return CountryTransferEngine.getConfig(iso); }
});
const PortfolioProvider = Object.freeze({
  snapshot(){ return PortfolioEngine.snapshot(); }
});

const DeviceEngine = (() => {
  function readLocal(){
    try { return localStorage.getItem(CONFIG.DEVICE_KEY); } catch(e){ return null; }
  }
  function writeLocal(id){
    try { localStorage.setItem(CONFIG.DEVICE_KEY, id); } catch(e){}
  }
  function describe(){
    const ua = navigator.userAgent || '';
    let platform = 'Web';
    if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
    else if (/Android/i.test(ua)) platform = 'Android';
    else if (/Macintosh/i.test(ua)) platform = 'macOS';
    else if (/Windows/i.test(ua)) platform = 'Windows';
    else if (/Linux/i.test(ua)) platform = 'Linux';
    let browser = 'Browser';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\//i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    return { platform, browser, language: navigator.language || 'en' };
  }
  function ensure(){
    let id = readLocal();
    if (!id){ id = ID.device(); writeLocal(id); }
    return id;
  }
  return { ensure, describe, current: () => readLocal() };
})();

/* ============================================================
   SESSION ENGINE — independent from device and user
   ============================================================ */
const SessionEngine = (() => {
  function readLocal(){
    try { return sessionStorage.getItem(CONFIG.SESSION_KEY); } catch(e){ return null; }
  }
  function writeLocal(id){
    try { if (id) sessionStorage.setItem(CONFIG.SESSION_KEY, id); else sessionStorage.removeItem(CONFIG.SESSION_KEY); } catch(e){}
  }
  function start(){ const id = ID.session(); writeLocal(id); return id; }
  function current(){ return readLocal(); }
  function end(){ writeLocal(null); }
  return { start, current, end };
})();

/* ============================================================
   USER CONTEXT — single source of truth for the current session
   ============================================================ */
const UserContext = (() => {
  let ctx = null;
  function reset(){ ctx = null; }
  function set(next){ ctx = next; }
  function get(){ return ctx; }
  function requireCtx(){
    if (!ctx || !ctx.uid || !ctx.userId) {
      reset();
      throw new Error('NO_USER_CONTEXT');
    }
    return ctx;
  }
  return { set, get, reset, requireCtx };
})();

/* ============================================================
   USER DATA ENGINE — Supabase scoped to current user only
   ============================================================ */
const UserDataEngine = (() => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ITEM_COLLECTIONS = ['cards','bankAccounts','contacts','beneficiaries','devices','sessions','receipts'];
  const FIAT_KINDS = ['FIAT_TRANSFER','ADMIN_DEPOSIT','FIAT_EXTERNAL'];
  const ms = v => (v ? new Date(v).getTime() : Date.now());
  function must(res){ if (res.error) throw res.error; return res.data; }

  async function readProfile(uid){
    const d = must(await sb.from('profiles').select('*').eq('id', uid).maybeSingle());
    if (!d) return null;
    return {
      uid: d.id, userId: d.user_id, yorId: d.yor_id, email: d.email, role: d.role,
      firstName: d.first_name || '', lastName: d.last_name || '', phone: d.phone || '',
      country: d.country || 'OM', photo: d.photo || null,
      kyc: d.kyc || { status:'UNVERIFIED', level:0, verifiedAt:null }, createdAt: ms(d.created_at)
    };
  }
  /* user_docs(user_id, doc_name, data) : preferences, security */
  async function readDoc(uid, name, fallback){
    const d = must(await sb.from('user_docs').select('data').eq('user_id', uid).eq('doc_name', name).maybeSingle());
    return d ? d.data : fallback;
  }
  async function writeDoc(uid, name, data){
    const cur = await readDoc(uid, name, {});
    must(await sb.from('user_docs').upsert(
      { user_id: uid, doc_name: name, data: Object.assign({}, cur, data) },
      { onConflict: 'user_id,doc_name' }));
  }
  /* user_items(user_id, collection, item_id, data) : cards, bankAccounts, contacts, beneficiaries, devices, sessions, receipts */
  async function readCollection(uid, sub){
    const rows = must(await sb.from('user_items').select('item_id,data').eq('user_id', uid).eq('collection', sub).limit(500)) || [];
    return rows.map(r => Object.assign({ id: r.item_id }, r.data));
  }
  async function writeSub(uid, sub, id, data){
    if (sub === 'accounts' || sub === 'cryptoWallets' || sub === 'transactions') throw new Error('READ_ONLY_COLLECTION');
    if (sub === 'notifications'){
      /* only server notifications (uuid) can be marked read; client-only ones are not persisted */
      if (UUID.test(String(id)) && data && data.read === true) must(await sb.from('notifications').update({ read: true }).eq('id', id).eq('user_id', uid));
      return;
    }
    if (ITEM_COLLECTIONS.indexOf(sub) === -1) return;
    const cur = must(await sb.from('user_items').select('data').eq('user_id', uid).eq('collection', sub).eq('item_id', String(id)).maybeSingle());
    must(await sb.from('user_items').upsert(
      { user_id: uid, collection: sub, item_id: String(id), data: Object.assign({}, cur ? cur.data : {}, data) },
      { onConflict: 'user_id,collection,item_id' }));
  }
  async function deleteSub(uid, sub, id){
    if (sub === 'notifications'){
      if (UUID.test(String(id))) must(await sb.from('notifications').delete().eq('id', id).eq('user_id', uid));
      return;
    }
    if (ITEM_COLLECTIONS.indexOf(sub) === -1) return;
    must(await sb.from('user_items').delete().eq('user_id', uid).eq('collection', sub).eq('item_id', String(id)));
  }
  async function readAccounts(uid){
    const rows = must(await sb.from('accounts').select('*').eq('user_id', uid)) || [];
    return rows.map(a => ({
      id: a.id, type: a.type, name: a.name || ((a.type === 'MAIN' ? 'Main ' : a.type + ' ') + a.currency),
      currency: a.currency, balance: Number(a.balance), availableBalance: Number(a.available_balance),
      reservedBalance: Number(a.reserved_balance || 0), status: a.status, country: a.country || 'OM', createdAt: ms(a.created_at)
    }));
  }
  async function readWallets(uid){
    const rows = must(await sb.from('crypto_wallets').select('*').eq('user_id', uid)) || [];
    return rows.map(w => ({
      id: w.id, asset: w.asset, assetId: String(w.asset).toLowerCase(), symbol: w.asset, network: w.network, address: w.address,
      balance: Number(w.balance), availableBalance: Number(w.available_balance), lockedBalance: Number(w.locked_balance || 0)
    }));
  }
  /* my_transactions() : each user only gets their own side (direction computed server-side) */
  async function readTransactions(uid){
    const rows = must(await sb.rpc('my_transactions', { p_limit: 200 })) || [];
    return rows.map(r => {
      const fiat = FIAT_KINDS.indexOf(r.kind) !== -1;
      const meta = r.meta || {};
      const o = Object.assign({}, meta, {
        id: r.id, reference: r.reference, kind: r.kind,
        type: fiat ? 'TRANSFER' : (r.kind === 'CRYPTO_TRANSFER' ? 'CRYPTO_SEND' : r.kind),
        direction: r.direction, status: r.status === 'CONFIRMED' ? 'SUCCESS' : r.status,
        currency: fiat ? r.asset : (meta.currency || 'OMR'),
        amount: Number(r.amount), fee: Number(r.fee), vat: 0, total: Number(r.total),
        network: r.network || undefined, note: r.note || undefined, createdAt: ms(r.created_at)
      });
      if (!fiat) o.asset = r.asset;
      if (r.counterparty_name || r.counterparty_yor_id){
        o.beneficiary = { name: r.counterparty_name || dispId(r.counterparty_yor_id), yorId: r.counterparty_yor_id || undefined };
      }
      return o;
    });
  }
  async function readReceipts(uid){
    const l = await readCollection(uid, 'receipts');
    return l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 100);
  }
  async function readNotifications(uid){
    const srv = must(await sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending:false }).limit(100)) || [];
    return srv.map(n => ({ id: n.id, type: n.type, title: n.title, message: n.message, read: n.read,
      transactionId: n.transaction_id, data: n.data || {}, createdAt: ms(n.created_at) }));
  }
  const readCards = uid => readCollection(uid, 'cards');
  const readBankAccounts = uid => readCollection(uid, 'bankAccounts');
  const readContacts = uid => readCollection(uid, 'contacts');
  const readBeneficiaries = uid => readCollection(uid, 'beneficiaries');
  const readDevices = uid => readCollection(uid, 'devices');
  const readSessions = uid => readCollection(uid, 'sessions');

  return {
    readProfile, readDoc, writeDoc, readAccounts, readTransactions, readReceipts, readNotifications,
    readCards, readWallets, readBankAccounts, readContacts, readBeneficiaries, readDevices, readSessions,
    writeSub, deleteSub
  };
})();

/* ============================================================
   RUNTIME STATE — only ever holds the current user's data
   ============================================================ */
const Runtime = {
  ctx: null,
  profile: null,
  settings: null,
  security: null,
  accounts: [],
  transactions: [],
  receipts: [],
  notifications: [],
  cards: [],
  wallets: [],
  bankAccounts: [],
  contacts: [],
  beneficiaries: [],
  devices: [],
  sessions: [],
  lang: 'en',
  theme: 'light',
  hideBalance: false
};
function resetRuntime(){
  Runtime.ctx = null;
  Runtime.profile = null;
  Runtime.settings = null;
  Runtime.security = null;
  Runtime.accounts = [];
  Runtime.transactions = [];
  Runtime.receipts = [];
  Runtime.notifications = [];
  Runtime.cards = [];
  Runtime.wallets = [];
  Runtime.bankAccounts = [];
  Runtime.contacts = [];
  Runtime.beneficiaries = [];
  Runtime.devices = [];
  Runtime.sessions = [];
  Runtime.hideBalance = false;
}

