import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keccak_256 } from './stubs/keccak.mjs';

/* Le faux keccak du banc est vérifié sur des vecteurs publics connus (sinon les sélecteurs de fonction du banc seraient faux). */
const k = (s) => Buffer.from(keccak_256(new TextEncoder().encode(s))).toString('hex');

test('keccak-256 du banc : vecteurs connus (vide, MINTER_ROLE OpenZeppelin, sélecteurs ERC-20 / AccessControl)', () => {
  assert.equal(k(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(k('MINTER_ROLE'), '9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6');
  assert.equal(k('grantRole(bytes32,address)').slice(0, 8), '2f2ff15d');
  assert.equal(k('transfer(address,uint256)').slice(0, 8), 'a9059cbb');
  assert.equal(k('balanceOf(address)').slice(0, 8), '70a08231');
});
