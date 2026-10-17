/* YOR WALLET — fournisseurs de signature.
   Règle V2 : AUCUNE clé privée, phrase de récupération ou seed dans ce code, dans le HTML/JS public ni dans une table publique.
   Un SigningProvider reçoit une transaction non signée et rend la transaction signée ; la clé reste chez le fournisseur
   (portefeuille externe de l'utilisateur, ou secret d'une fonction serveur côté déploiement testnet).
   Sans fournisseur : « Wallet signing provider not configured » — jamais de signature simulée. */

export const SIGNING_NOT_CONFIGURED_MESSAGE = 'Wallet signing provider not configured';

export class SigningProviderNotConfigured extends Error {
  constructor(){ super(SIGNING_NOT_CONFIGURED_MESSAGE); this.name = 'SigningProviderNotConfigured'; this.code = 'SIGNING_PROVIDER_NOT_CONFIGURED'; }
}

export class SignatureRejected extends Error {
  constructor(message = 'Signature rejected by the user'){ super(message); this.name = 'SignatureRejected'; this.code = 'SIGNATURE_REJECTED'; }
}

/* Interface attendue : { id: string, configured: true, getAddress(): Promise<string>, signTransaction(tx): Promise<signedTx> } */
export const NullSigningProvider = Object.freeze({
  id: 'none',
  configured: false,
  async getAddress(){ throw new SigningProviderNotConfigured(); },
  async signTransaction(){ throw new SigningProviderNotConfigured(); }
});

export function isUsableSigner(signer){
  return !!signer && signer.configured === true
    && typeof signer.signTransaction === 'function' && typeof signer.getAddress === 'function';
}
