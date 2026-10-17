/* YOR WALLET — machine d'états d'un transfert on-chain.
   draft -> pending_signature -> broadcasted -> confirming -> confirmed
   avec failed / expired / cancelled. « confirmed » est impossible sans PREUVE vérifiée
   (txid, numéro de bloc, receipt SUCCESS, transaction solidifiée). */

export const STATES = Object.freeze(['draft', 'pending_signature', 'broadcasted', 'confirming', 'confirmed', 'failed', 'expired', 'cancelled']);

const TRANSITIONS = Object.freeze({
  draft:             ['pending_signature', 'cancelled', 'failed'],
  pending_signature: ['broadcasted', 'cancelled', 'expired', 'failed'],
  broadcasted:       ['confirming', 'confirmed', 'failed', 'expired'],
  confirming:        ['confirmed', 'failed'],
  confirmed:         [],
  failed:            [],
  expired:           [],
  cancelled:         []
});

export class StateError extends Error {
  constructor(code, message){ super(message); this.name = 'StateError'; this.code = code; }
}

export const isTerminal = state => TRANSITIONS[state] !== undefined && TRANSITIONS[state].length === 0;
export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

export function hasConfirmationEvidence(e){
  return !!e && e.solidified === true && e.receiptResult === 'SUCCESS'
    && typeof e.txid === 'string' && /^[0-9a-fA-F]{64}$/.test(e.txid)
    && Number.isInteger(e.blockNumber) && e.blockNumber > 0;
}

export function transition(from, to, evidence){
  if (!STATES.includes(from) || !STATES.includes(to)) throw new StateError('UNKNOWN_STATE', `unknown state ${from} -> ${to}`);
  if (!canTransition(from, to)) throw new StateError('ILLEGAL_TRANSITION', `illegal transition ${from} -> ${to}`);
  if (to === 'confirmed' && !hasConfirmationEvidence(evidence)) throw new StateError('CONFIRMATION_NOT_VERIFIED', 'confirmed requires verified on-chain evidence');
  return to;
}
