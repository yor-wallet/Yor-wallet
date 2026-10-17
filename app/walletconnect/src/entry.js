/* Friendly Pay — enveloppe Reown AppKit (WalletConnect), TRON Nile uniquement.
   Expose window.NexAppKit. Connexion SEULEMENT : aucune transaction, aucune signature n'est demandee d'ici.
   Aucune cle privee / phrase de recuperation : le portefeuille de l'utilisateur garde ses cles. */
import { createAppKit } from '@reown/appkit';
import { TronAdapter } from '@reown/appkit-adapter-tron';
import { tronNileTestnet } from '@reown/appkit/networks';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';

const NS = 'tron';
const NILE_CAIP = 'tron:0xcd8690dc';
let modal = null;
let unsubs = [];
const listeners = new Set();
const state = { ready: false, status: 'disconnected', isConnected: false, address: null, networkId: null, networkName: null, wrongNetwork: false, walletName: null, error: null };

function emit() { const snap = getState(); listeners.forEach((fn) => { try { fn(snap); } catch (e) { console.error(e); } }); }
function getState() { return Object.assign({}, state); }
function setError(code, detail) { state.error = code ? { code, detail: detail ? String(detail) : '' } : null; emit(); }

function readNetwork() {
  try {
    const n = modal && modal.getCaipNetwork ? modal.getCaipNetwork(NS) : null;
    state.networkId = n ? String(n.caipNetworkId || '') : null;
    state.networkName = n ? String(n.name || '') : null;
    state.wrongNetwork = !!(state.isConnected && state.networkId && state.networkId !== NILE_CAIP);
  } catch (e) { /* ignore */ }
}
function readWallet() {
  try { const w = modal && modal.getWalletInfo ? modal.getWalletInfo(NS) : null; state.walletName = w && w.name ? String(w.name) : null; } catch (e) { state.walletName = null; }
}

function init(opts) {
  if (modal) return getState();
  try {
    const adapter = new TronAdapter({ walletAdapters: [new TronLinkAdapter({ openUrlWhenWalletNotFound: false, checkTimeout: 3000 })] });
    modal = createAppKit({
      adapters: [adapter],
      networks: [tronNileTestnet],
      defaultNetwork: tronNileTestnet,
      projectId: opts.projectId,
      metadata: opts.metadata,
      themeMode: opts.themeMode || 'dark',
      themeVariables: opts.themeVariables || {},
      allowUnsupportedChain: false,
      features: { analytics: false, email: false, socials: false, onramp: false, swaps: false, send: false, history: false, receive: false, pay: false }
    });
    unsubs.push(modal.subscribeAccount((acc) => {
      const st = acc && acc.status ? String(acc.status) : 'disconnected';
      state.status = st;
      state.isConnected = !!(acc && acc.isConnected);
      state.address = state.isConnected && acc.address ? String(acc.address) : null;
      if (state.isConnected) state.error = null;
      readNetwork(); readWallet(); emit();
    }, NS));
    unsubs.push(modal.subscribeNetwork(() => { readNetwork(); emit(); }));
    unsubs.push(modal.subscribeEvents((ev) => {
      const name = ev && ev.data && ev.data.event;
      if (name === 'CONNECT_ERROR') setError('CONNECT_ERROR', ev.data.properties && ev.data.properties.message);
      else if (name === 'DISCONNECT_ERROR') setError('DISCONNECT_ERROR', ev.data.properties && ev.data.properties.message);
    }));
    state.ready = true; state.error = null;
    readNetwork(); readWallet(); emit();
  } catch (e) {
    modal = null; state.ready = false;
    setError('INIT_FAILED', e && e.message);
  }
  return getState();
}

async function open() {
  if (!modal) throw new Error('NOT_INITIALIZED');
  state.error = null; emit();
  try { await modal.open({ view: 'Connect', namespace: NS }); }
  catch (e) { setError('OPEN_FAILED', e && e.message); }
}
async function disconnect() {
  if (!modal || !state.isConnected) return; // rien a deconnecter : pas d'erreur
  try { await modal.disconnect(NS); }
  catch (e) { setError('DISCONNECT_ERROR', e && e.message); }
}
function close() { try { modal && modal.close(); } catch (e) { /* ignore */ } }
function setTheme(mode) { try { modal && modal.setThemeMode && modal.setThemeMode(mode === 'light' ? 'light' : 'dark'); } catch (e) { /* ignore */ } }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

window.NexAppKit = Object.freeze({ init, open, close, disconnect, setTheme, getState, subscribe, NILE_CAIP });
