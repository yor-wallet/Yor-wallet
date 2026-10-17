/* YOR WALLET — orchestration d'un transfert on-chain.
   Étapes : validation -> construction (non signée) -> signature par le SigningProvider -> diffusion -> suivi.
   - sans fournisseur de signature : « Wallet signing provider not configured », aucune transaction construite ;
   - la transaction signée doit être identique à celle construite (txID et raw_data_hex) ;
   - « confirmed » n'est émis que sur preuve vérifiée (voir transfer-state.mjs). */
import { isValidTronAddress } from './address.mjs';
import { transition, isTerminal } from './transfer-state.mjs';
import { isUsableSigner, SigningProviderNotConfigured } from './signing.mjs';

export class TransferError extends Error {
  constructor(code, message){ super(message); this.name = 'TransferError'; this.code = code; }
}

export class TransferService {
  #provider; #signer; #now; #onState;

  /** onState({ state, txid?, reason?, evidence? }) : à brancher sur la persistance (index des transactions Supabase). */
  constructor({ provider, signer, now = Date.now, onState = async () => {} }){
    if (!provider) throw new TransferError('NO_PROVIDER', 'a TronProvider is required');
    this.#provider = provider; this.#signer = signer; this.#now = now; this.#onState = onState;
  }

  async execute({ from, to, amountRaw }){
    if (!isValidTronAddress(from) || !isValidTronAddress(to)) throw new TransferError('INVALID_ADDRESS', 'invalid TRON address');
    if (from === to) throw new TransferError('SELF_TRANSFER', 'sender and recipient are the same');
    if (typeof amountRaw !== 'bigint' || amountRaw <= 0n) throw new TransferError('INVALID_AMOUNT', 'amountRaw must be a positive bigint');
    if (!isUsableSigner(this.#signer)) throw new SigningProviderNotConfigured();

    let state = 'draft';
    const emit = async (next, extra = {}) => {
      state = transition(state, next, extra.evidence);
      await this.#onState({ state, ...extra });
    };
    await this.#onState({ state });

    let unsigned;
    try { unsigned = await this.#provider.buildTransferTx({ from, to, amountRaw }); }
    catch (e){ await emit('failed', { reason: e.code || 'BUILD_FAILED' }); throw e; }
    await emit('pending_signature');

    let signed;
    try { signed = await this.#signer.signTransaction(unsigned); }
    catch (e){
      await emit(e && e.code === 'SIGNATURE_REJECTED' ? 'cancelled' : 'failed', { reason: (e && e.code) || 'SIGNING_FAILED' });
      throw e;
    }
    if (!signed || signed.txID !== unsigned.txID || signed.raw_data_hex !== unsigned.raw_data_hex){
      await emit('failed', { reason: 'SIGNED_TX_MISMATCH' });
      throw new TransferError('SIGNED_TX_MISMATCH', 'the signed transaction differs from the one that was built');
    }

    let txid;
    try { ({ txid } = await this.#provider.broadcast(signed)); }
    catch (e){ await emit('failed', { reason: (e && e.code) || 'BROADCAST_FAILED' }); throw e; }
    await emit('broadcasted', { txid });

    const expiresAt = unsigned.raw_data && Number.isFinite(unsigned.raw_data.expiration) ? unsigned.raw_data.expiration : null;
    return { state, txid, expiresAt };
  }

  /** Un pas de suivi (à appeler périodiquement). Renvoie le nouvel état. */
  async refresh({ txid, state, expiresAt = null }){
    if (isTerminal(state)) return state;
    const st = await this.#provider.transactionStatus(txid);
    let cur = state;
    const emit = async (next, extra = {}) => {
      cur = transition(cur, next, extra.evidence);
      await this.#onState({ state: cur, txid, ...extra });
    };
    if (st.state === 'broadcasted'){
      if (expiresAt !== null && this.#now() > expiresAt) await emit('expired', { reason: 'TX_EXPIRED_NOT_FOUND' });
      return cur;
    }
    if (st.state === 'confirming'){
      if (cur === 'broadcasted') await emit('confirming', st.provisional ? { reason: 'PROVISIONAL_' + st.provisional.toUpperCase() } : {});
      return cur;
    }
    if (st.state === 'confirmed'){ await emit('confirmed', { evidence: st.evidence }); return cur; }
    if (st.state === 'failed'){ await emit('failed', { reason: st.reason, evidence: st.evidence }); return cur; }
    return cur;
  }
}
