/* Jeux de données pour tests/web.
   Origine : RÉPONSES RÉELLES de https://nile.trongrid.io relevées le 2026-10-09 (appels depuis Supabase pg_net), réduites aux champs lus par le client.
   Les entrées marquées SYNTHÉTIQUE sont fabriquées (format ABI standard, pas une réponse enregistrée). */

export const ADDR = Object.freeze({
  token: 'TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf',
  user: 'TWoXF3efc2EVQj2Fif5kMBNRFAJzRrfaX9',          /* adresse TronLink de l'utilisateur (publique) */
  deployer: 'TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad',
  zero: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'
});
export const HEX = Object.freeze({
  token: '41fa5c869e58b336fc2b2f55661828d1e022a4390e',
  user: '41e485b573cad2a892eae8b3374502a7ccc2ecc096',
  deployer: '419f10b9a51361d13b1b0e6ac8f2d05bd95d65393e'
});

/* RÉEL : /wallet/getblockbynum {"num":0} -> blockID */
export const GENESIS = { blockID: '0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc' };

/* RÉEL (valeurs) : /wallet/getchainparameters, réduit aux deux clés lues */
export const CHAIN_PARAMS = { chainParameter: [{ key: 'getEnergyFee', value: 100 }, { key: 'getTransactionFee', value: 1000 }] };

/* RÉEL : /wallet/getaccount pour une adresse jamais activée (TWoXF3…), et /wallet/getaccountresource idem */
export const EMPTY = {};

/* SYNTHÉTIQUE (ABI standard string / uint) */
const word = n => n.toString(16).padStart(64, '0');
const abiString = s => { const b = Buffer.from(s, 'utf8').toString('hex'); return word(32n) + word(BigInt(s.length)) + b.padEnd(Math.ceil(b.length / 64) * 64, '0'); };
export const constantOk = (hex, energy = 500) => ({ transaction: { ret: [{}] }, constant_result: [hex], result: { result: true }, energy_used: energy });
export const NAME_HEX = abiString('YOR Experimental USDT');
export const SYMBOL_HEX = abiString('YOR-USDT');
export const DECIMALS_HEX = word(6n);

/* RÉEL : balanceOf(user) sur /walletsolidity/triggerconstantcontract -> 0x1b364af8c00 = 1 870 000 000 000 */
export const BALANCE_USER_HEX = '000000000000000000000000000000000000000000000000000001b364af8c00';
export const balanceResponse = hex => constantOk(hex, 564);

/* RÉEL : triggerconstantcontract transfer(deployer, 1 unité) depuis user : succès, energy_used 186182 */
export const SIM_OK = { transaction: { ret: [{}] }, constant_result: [word(1n)], result: { result: true }, energy_used: 186182 };

/* RÉEL : triggerconstantcontract transfer au-delà du solde : result.result reste true, ret[0].ret = FAILED, Error(string) */
export const SIM_REVERT_BALANCE = {
  transaction: { ret: [{ ret: 'FAILED' }] },
  constant_result: ['08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000027594f52555344543a20696e73756666696369656e7420617661696c61626c652062616c616e636500000000000000000000000000000000000000000000000000'],
  result: { result: true, message: 'REVERT opcode executed' },
  energy_used: 35825
};

/* RÉEL : /wallet/triggersmartcontract (visible:false) owner=user, to=deployer, 1,5 unité, fee_limit 30 000 000 sun */
export const BUILD_REQUEST = { from: ADDR.user, to: ADDR.deployer, amountRaw: 1500000n, feeLimitSun: 30000000 };
export const BUILD_RESPONSE = {
  transaction: {
    raw_data: {
      ref_block_bytes: '8c7d',
      ref_block_hash: 'fbe0c95bdf22356f',
      expiration: 1791530466000,
      contract: [{
        parameter: {
          value: {
            owner_address: HEX.user,
            contract_address: HEX.token,
            data: 'a9059cbb0000000000000000000000009f10b9a51361d13b1b0e6ac8f2d05bd95d65393e000000000000000000000000000000000000000000000000000000000016e360'
          },
          type_url: 'type.googleapis.com/protocol.TriggerSmartContract'
        },
        type: 'TriggerSmartContract'
      }],
      timestamp: 1791530408961,
      fee_limit: 30000000
    },
    raw_data_hex: '0a028c7d2208fbe0c95bdf22356f40d0f5a5fc91345aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a1541e485b573cad2a892eae8b3374502a7ccc2ecc096121541fa5c869e58b336fc2b2f55661828d1e022a4390e2244a9059cbb0000000000000000000000009f10b9a51361d13b1b0e6ac8f2d05bd95d65393e000000000000000000000000000000000000000000000000000000000016e3607081b8a2fc913490018087a70e',
    txID: '9f743b9c6c258b0f400946f2ce6d4bf2353805c67e3c8d5bcc99e4752eb7a0fc',
    visible: false
  },
  result: { result: true }
};

/* RÉEL : gettransactioninfobyid du mint (nœud complet = nœud solidity ici). Contient l'événement Transfer(0 -> user, 1 870 000). */
export const MINT_INFO = {
  id: '7d4fbdfad22e3dd4f0919167a185d87f8d943efa358643a002b9e4dd98b7e8bf',
  fee: 19732300,
  blockNumber: 71666573,
  blockTimeStamp: 1791529626000,
  contractResult: [word(1n)],
  contract_address: HEX.token,
  receipt: { energy_fee: 19354300, energy_usage_total: 193543, net_fee: 378000, result: 'SUCCESS' },
  log: [
    { address: 'fa5c869e58b336fc2b2f55661828d1e022a4390e', topics: ['c9cfc74aabdce19f1ff03d15ae38ce937684282bdf69e7d8d71b18c027a7c2f1', '000000000000000000000000e485b573cad2a892eae8b3374502a7ccc2ecc096', word(1n)], data: '000000000000000000000000000000000000000000000000000001b364af8c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001' },
    { address: 'fa5c869e58b336fc2b2f55661828d1e022a4390e', topics: ['c0d4f6366a203444ceed5e9718e9728e50e7a5115680a49c7823a31e5f67b762', '000000000000000000000000e485b573cad2a892eae8b3374502a7ccc2ecc096', word(1n)], data: '000000000000000000000000000000000000000000000000000001b364af8c000000000000000000000000000000000000000000000000000000000000000000' },
    { address: 'fa5c869e58b336fc2b2f55661828d1e022a4390e', topics: ['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', word(0n), '000000000000000000000000e485b573cad2a892eae8b3374502a7ccc2ecc096'], data: '000000000000000000000000000000000000000000000000000001b364af8c00' }
  ]
};

/* RÉEL : gettransactioninfobyid d'une transaction inconnue -> objet vide */
export const INFO_MISSING = {};

/* RÉEL : /v1/accounts/<user>/transactions/trc20?contract_address=…&only_confirmed=true */
export const HISTORY = {
  data: [{
    transaction_id: '7d4fbdfad22e3dd4f0919167a185d87f8d943efa358643a002b9e4dd98b7e8bf',
    token_info: { symbol: 'YOR-USDT', address: ADDR.token, decimals: 6, name: 'YOR Experimental USDT' },
    block_timestamp: 1791529626000,
    from: ADDR.zero,
    to: ADDR.user,
    type: 'Transfer',
    value: '1870000000000'
  }],
  success: true,
  meta: { at: 1791530173012, page_size: 1 }
};

/* Informations d'un transfert user -> deployer (SYNTHÉTIQUE : même forme que MINT_INFO, topics/data d'un transfert de 1,5). */
export function transferInfo({ txid, blockNumber = 71670000, result = 'SUCCESS', from = HEX.user, to = HEX.deployer, amount = 1500000n, withEvent = true, resMessage } = {}) {
  const w = hex41 => '000000000000000000000000' + hex41.slice(2);
  const info = {
    id: txid, fee: 18618200, blockNumber, blockTimeStamp: 1791530500000, contractResult: [word(1n)], contract_address: HEX.token,
    receipt: { energy_fee: 18618200, energy_usage_total: 186182, net_usage: 345, result },
    log: withEvent ? [{ address: 'fa5c869e58b336fc2b2f55661828d1e022a4390e', topics: ['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', w(from), w(to)], data: word(amount) }] : []
  };
  if (resMessage) info.resMessage = resMessage;
  return info;
}

export { word };
