/* YOR WALLET — configuration blockchain (Phase 4).
   Fonction PURE : elle reçoit un objet d'environnement et renvoie une configuration figée, ou lève ConfigError.
   Règles V2 appliquées ici :
   - développement / testnet : mainnet INTERDIT (jamais de mainnet en dev) ;
   - production + mainnet exige YOR_ALLOW_MAINNET=true explicite ;
   - le jeton expérimental ne peut JAMAIS être configuré sur mainnet ;
   - YOR_TOKEN_CONTRACT_ADDRESS vide => null (aucune adresse inventée) ; sinon somme de contrôle base58 vérifiée ;
   - aucune commission « par défaut » : YOR_FEE_LIMIT_SUN absent => null ;
   - la clé API n'est ni énumérable ni sérialisable (JSON.stringify / console.log ne la montrent pas). */
import { isValidTronAddress, base58ToHex41 } from './address.mjs';

export class ConfigError extends Error {
  constructor(code, message){ super(message); this.name = 'ConfigError'; this.code = code; }
}

export const YOR_ENVS = Object.freeze(['development', 'testnet', 'production']);

export const NETWORKS = Object.freeze({
  shasta:  Object.freeze({ id: 'shasta',  baseUrl: 'https://api.shasta.trongrid.io', isMainnet: false }),
  nile:    Object.freeze({ id: 'nile',    baseUrl: 'https://nile.trongrid.io',        isMainnet: false }),
  mainnet: Object.freeze({ id: 'mainnet', baseUrl: 'https://api.trongrid.io',         isMainnet: true  })
});

export const TOKEN = Object.freeze({
  name: 'YOR Experimental USDT',
  symbol: 'YOR-USDT',
  decimals: 6,
  standard: 'TRC-20',
  experimental: true,
  /* Non lié à Tether : ce jeton n'est pas du USDT et ne doit jamais être présenté comme tel. */
  isTether: false
});

const MAINNET_HOST = 'api.trongrid.io';
const clean = v => (typeof v === 'string' ? v.trim() : '');

export function loadConfig(env = {}){
  const yorEnv = (clean(env.YOR_ENV) || 'development').toLowerCase();
  if (!YOR_ENVS.includes(yorEnv)) throw new ConfigError('INVALID_YOR_ENV', 'YOR_ENV must be development, testnet or production');

  const netId = (clean(env.TRON_NETWORK) || 'shasta').toLowerCase();
  const network = NETWORKS[netId];
  if (!network) throw new ConfigError('INVALID_TRON_NETWORK', 'TRON_NETWORK must be shasta, nile or mainnet');

  if (network.isMainnet){
    if (yorEnv !== 'production') throw new ConfigError('MAINNET_FORBIDDEN', 'mainnet is forbidden outside YOR_ENV=production');
    if (clean(env.YOR_ALLOW_MAINNET) !== 'true') throw new ConfigError('MAINNET_NOT_ALLOWED', 'mainnet requires YOR_ALLOW_MAINNET=true');
  }

  const expRaw = clean(env.YOR_EXPERIMENTAL_TOKEN).toLowerCase();
  if (expRaw !== '' && expRaw !== 'true') throw new ConfigError('NON_EXPERIMENTAL_UNSUPPORTED', 'YOR_EXPERIMENTAL_TOKEN must be true: only the experimental token is implemented');
  if (network.isMainnet) throw new ConfigError('EXPERIMENTAL_TOKEN_ON_MAINNET', 'the experimental token must never be configured on mainnet (needs audit and owner validation)');

  const rawAddr = clean(env.YOR_TOKEN_CONTRACT_ADDRESS);
  let contractAddress = null;
  if (rawAddr !== ''){
    if (!isValidTronAddress(rawAddr)) throw new ConfigError('INVALID_CONTRACT_ADDRESS', 'YOR_TOKEN_CONTRACT_ADDRESS is not a valid TRON address (checksum failed)');
    contractAddress = rawAddr;
  }

  let baseUrl = network.baseUrl;
  const urlRaw = clean(env.TRON_FULLNODE_URL);
  if (urlRaw !== ''){
    let u;
    try { u = new URL(urlRaw); } catch (e){ throw new ConfigError('INVALID_FULLNODE_URL', 'TRON_FULLNODE_URL is not a valid URL'); }
    if (u.protocol !== 'https:') throw new ConfigError('INSECURE_FULLNODE_URL', 'TRON_FULLNODE_URL must use https');
    if (u.hostname === MAINNET_HOST && !network.isMainnet) throw new ConfigError('URL_NETWORK_MISMATCH', 'TRON_FULLNODE_URL points to mainnet while TRON_NETWORK is a testnet');
    baseUrl = u.origin;
  }

  let feeLimitSun = null;
  const feeRaw = clean(env.YOR_FEE_LIMIT_SUN);
  if (feeRaw !== ''){
    if (!/^[1-9]\d{0,15}$/.test(feeRaw)) throw new ConfigError('INVALID_FEE_LIMIT', 'YOR_FEE_LIMIT_SUN must be a positive integer (sun)');
    feeLimitSun = BigInt(feeRaw);
  }

  const cfg = {
    yorEnv,
    network,
    baseUrl,
    token: TOKEN,
    experimentalToken: true,
    contractAddress,
    contractHex: contractAddress ? base58ToHex41(contractAddress) : null,
    feeLimitSun
  };
  const apiKey = clean(env.TRONGRID_API_KEY);
  Object.defineProperty(cfg, 'apiKey', { value: apiKey || null, enumerable: false });
  return Object.freeze(cfg);
}

/** Résumé sans secret, utilisable dans les journaux et les réponses d'API. */
export function describeConfig(cfg){
  return {
    yorEnv: cfg.yorEnv,
    network: cfg.network.id,
    baseUrl: cfg.baseUrl,
    token: { name: cfg.token.name, symbol: cfg.token.symbol, decimals: cfg.token.decimals, experimental: true },
    contractDeployed: cfg.contractAddress !== null,
    contractAddress: cfg.contractAddress,
    feeLimitConfigured: cfg.feeLimitSun !== null,
    apiKey: cfg.apiKey ? 'configured' : 'absent'
  };
}
