/* YOR WALLET — solde de TEST explicite.
   Règle V2 : 1 870 000 n'existe que comme « TEST BALANCE » étiqueté, ou comme valeur réellement lue par balanceOf().
   Ce module ne crédite rien : il décrit seulement la quantité à minter (par un MINTER_ROLE, sur un testnet)
   et refuse de servir hors développement/testnet. Jamais de « balance = 1870000 » dans une table ou dans l'interface. */
import { parseUnits } from './units.mjs';

export const TEST_BALANCE = Object.freeze({
  label: 'TEST BALANCE',
  units: '1870000',
  raw: parseUnits('1870000', 6)       /* 1_870_000_000_000n */
});

export function testBalanceFor(config){
  if (!config || (config.yorEnv !== 'development' && config.yorEnv !== 'testnet') || config.network.isMainnet){
    throw new Error('TEST BALANCE is only available in development/testnet, never on mainnet');
  }
  return TEST_BALANCE;
}
