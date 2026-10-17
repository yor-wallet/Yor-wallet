import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, describeConfig, ConfigError, NETWORKS, TOKEN } from '../../src/services/blockchain/config.mjs';
import { CONTRACT } from './helpers.mjs';

const code = fn => { try { fn(); } catch (e){ return e instanceof ConfigError ? e.code : 'OTHER:' + e.message; } return null; };

test('défauts : development + shasta, jeton expérimental, aucun contrat, aucun frais inventé', () => {
  const c = loadConfig({});
  assert.equal(c.yorEnv, 'development');
  assert.equal(c.network.id, 'shasta');
  assert.equal(c.baseUrl, 'https://api.shasta.trongrid.io');
  assert.equal(c.contractAddress, null);
  assert.equal(c.contractHex, null);
  assert.equal(c.feeLimitSun, null);
  assert.equal(c.experimentalToken, true);
  assert.equal(c.token.symbol, 'YOR-USDT');
  assert.equal(c.token.name, 'YOR Experimental USDT');
  assert.equal(c.token.decimals, 6);
  assert.equal(c.token.isTether, false);
});

test('URLs de réseau conformes à la documentation TRON', () => {
  assert.equal(NETWORKS.shasta.baseUrl, 'https://api.shasta.trongrid.io');
  assert.equal(NETWORKS.nile.baseUrl, 'https://nile.trongrid.io');
  assert.equal(NETWORKS.mainnet.baseUrl, 'https://api.trongrid.io');
});

test('mainnet INTERDIT en development et en testnet', () => {
  assert.equal(code(() => loadConfig({ TRON_NETWORK: 'mainnet' })), 'MAINNET_FORBIDDEN');
  assert.equal(code(() => loadConfig({ YOR_ENV: 'development', TRON_NETWORK: 'mainnet', YOR_ALLOW_MAINNET: 'true' })), 'MAINNET_FORBIDDEN');
  assert.equal(code(() => loadConfig({ YOR_ENV: 'testnet', TRON_NETWORK: 'mainnet', YOR_ALLOW_MAINNET: 'true' })), 'MAINNET_FORBIDDEN');
});

test('production + mainnet exige un drapeau explicite, et le jeton expérimental reste refusé sur mainnet', () => {
  assert.equal(code(() => loadConfig({ YOR_ENV: 'production', TRON_NETWORK: 'mainnet' })), 'MAINNET_NOT_ALLOWED');
  assert.equal(code(() => loadConfig({ YOR_ENV: 'production', TRON_NETWORK: 'mainnet', YOR_ALLOW_MAINNET: 'true' })), 'EXPERIMENTAL_TOKEN_ON_MAINNET');
});

test('production sur testnet reste possible (ex. préproduction)', () => {
  const c = loadConfig({ YOR_ENV: 'production', TRON_NETWORK: 'nile' });
  assert.equal(c.network.id, 'nile');
});

test('valeurs invalides refusées', () => {
  assert.equal(code(() => loadConfig({ YOR_ENV: 'staging' })), 'INVALID_YOR_ENV');
  assert.equal(code(() => loadConfig({ TRON_NETWORK: 'ropsten' })), 'INVALID_TRON_NETWORK');
  assert.equal(code(() => loadConfig({ YOR_EXPERIMENTAL_TOKEN: 'false' })), 'NON_EXPERIMENTAL_UNSUPPORTED');
  assert.equal(loadConfig({ YOR_EXPERIMENTAL_TOKEN: 'true' }).experimentalToken, true);
});

test('adresse du contrat : vide => null ; somme de contrôle vérifiée ; rien n\'est deviné', () => {
  assert.equal(loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: '' }).contractAddress, null);
  assert.equal(loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: '   ' }).contractAddress, null);
  const ok = loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: CONTRACT });
  assert.equal(ok.contractAddress, CONTRACT);
  assert.match(ok.contractHex, /^41[0-9a-f]{40}$/);
  const broken = CONTRACT.slice(0, -1) + (CONTRACT.endsWith('a') ? 'b' : 'a');
  assert.equal(code(() => loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: broken })), 'INVALID_CONTRACT_ADDRESS');
  assert.equal(code(() => loadConfig({ YOR_TOKEN_CONTRACT_ADDRESS: 'not-an-address' })), 'INVALID_CONTRACT_ADDRESS');
});

test('URL de nœud : https obligatoire ; une URL mainnet est refusée pour un testnet', () => {
  assert.equal(code(() => loadConfig({ TRON_FULLNODE_URL: 'http://node.example.org' })), 'INSECURE_FULLNODE_URL');
  assert.equal(code(() => loadConfig({ TRON_FULLNODE_URL: 'pas une url' })), 'INVALID_FULLNODE_URL');
  assert.equal(code(() => loadConfig({ TRON_NETWORK: 'nile', TRON_FULLNODE_URL: 'https://api.trongrid.io' })), 'URL_NETWORK_MISMATCH');
  assert.equal(loadConfig({ TRON_FULLNODE_URL: 'https://node.example.org/path' }).baseUrl, 'https://node.example.org');
});

test('plafond de frais : entier positif seulement, jamais de valeur par défaut', () => {
  assert.equal(loadConfig({ YOR_FEE_LIMIT_SUN: '100000000' }).feeLimitSun, 100000000n);
  for (const bad of ['0', '-5', '1.5', 'abc', '1e9', '0100'])
    assert.equal(code(() => loadConfig({ YOR_FEE_LIMIT_SUN: bad })), 'INVALID_FEE_LIMIT', bad);
});

test('la clé API n\'apparaît ni dans JSON.stringify, ni dans Object.keys, ni dans le résumé', () => {
  const c = loadConfig({ TRONGRID_API_KEY: 'secret-key-value' });
  assert.equal(c.apiKey, 'secret-key-value');
  assert.ok(!JSON.stringify(c, (k, v) => (typeof v === 'bigint' ? v.toString() : v)).includes('secret-key-value'));
  assert.ok(!Object.keys(c).includes('apiKey'));
  const d = describeConfig(c);
  assert.equal(d.apiKey, 'configured');
  assert.ok(!JSON.stringify(d).includes('secret-key-value'));
  assert.equal(describeConfig(loadConfig({})).apiKey, 'absent');
});

test('la configuration est figée', () => {
  const c = loadConfig({});
  assert.throws(() => { 'use strict'; c.contractAddress = 'TXYZ'; }, TypeError);
  assert.ok(Object.isFrozen(TOKEN));
});
