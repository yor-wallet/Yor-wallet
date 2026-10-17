// Tests du MODÈLE DE RÉFÉRENCE (JavaScript). Ils valident la logique des lots et de l'expiration.
// Ils ne s'exécutent pas sur TRON et ne prouvent rien sur le contrat compilé.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YorTokenModel, Revert, MAX_LOTS_PER_OP, MAX_VIEW_LOTS, MAX_UINT, ZERO,
  DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE,
} from '../../model/lot-model.mjs';

const U = 10n ** 6n;                 // 1 jeton = 10^6 unités (6 décimales)
const ADMIN = '0xAdmin', MINTER = '0xMinter', BURNER = '0xBurner';
const A = '0xAlice', B = '0xBob', C = '0xCarol', KEEPER = '0xKeeper';
const T0 = 1_700_000_000;

function fresh() {
  const t = new YorTokenModel({ admin: ADMIN, now: T0 });
  t.grantRole(ADMIN, MINTER_ROLE, MINTER);
  t.grantRole(ADMIN, BURNER_ROLE, BURNER);
  return t;
}
const reverts = (fn, reason) => assert.throws(fn, (e) => e instanceof Revert && (!reason || e.reason.includes(reason)), reason);

test('métadonnées : nom, symbole, 6 décimales', () => {
  const t = fresh();
  assert.equal(t.name, 'YOR Experimental USDT');
  assert.equal(t.symbol, 'YOR-USDT');
  assert.equal(t.decimals, 6);
  assert.equal(t.totalSupply(), 0n);
});

test('rôles : seul l\'admin attribue ; personne ne mint sans MINTER_ROLE', () => {
  const t = fresh();
  reverts(() => t.mint(A, A, 1n * U), 'missing role');          // un utilisateur ne peut pas se créer de jetons
  reverts(() => t.grantRole(A, MINTER_ROLE, A), 'missing role');
  reverts(() => t.burn(A, A, 1n), 'missing role');
  assert.equal(t.hasRole(MINTER_ROLE, MINTER), true);
  t.revokeRole(ADMIN, MINTER_ROLE, MINTER);
  reverts(() => t.mint(MINTER, A, 1n * U), 'missing role');
  assert.throws(() => new YorTokenModel({ admin: ZERO }), Revert);
});

test('mint : crée un lot, augmente la masse, émet Mint + Transfer', () => {
  const t = fresh();
  const id = t.mint(MINTER, A, 100n * U, T0 + 1000);
  assert.equal(t.balanceOf(A), 100n * U);
  assert.equal(t.totalSupply(), 100n * U);
  assert.deepEqual(t.lotAt(A, 0), { id, owner: A, amount: 100n * U, createdAt: T0, expiresAt: T0 + 1000, remainingAmount: 100n * U });
  assert.ok(t.events.some((e) => e.name === 'Mint' && e.lotId === id && e.expiresAt === T0 + 1000));
  assert.ok(t.events.some((e) => e.name === 'Transfer' && e.from === ZERO && e.to === A));
  reverts(() => t.mint(MINTER, ZERO, 1n), 'mint to zero');
  reverts(() => t.mint(MINTER, A, 0n), 'zero amount');
  reverts(() => t.mint(MINTER, A, 1n, T0), 'expiry in the past');
});

test('TEST CRITIQUE (modèle local, PAS la chaîne) : A 1 870 000 -> transfert 50 -> A 1 869 950 / B 50', () => {
  const t = fresh();
  t.mint(MINTER, A, 1_870_000n * U);
  assert.equal(t.balanceOf(A), 1_870_000n * U);
  t.transfer(A, B, 50n * U);
  assert.equal(t.balanceOf(A), 1_869_950n * U);
  assert.equal(t.balanceOf(B), 50n * U);
  assert.equal(t.totalSupply(), 1_870_000n * U);
  assert.equal(t.availableBalanceOf(B), 50n * U);
});

test('FIFO par ordre d\'arrivée et héritage de l\'échéance chez le destinataire', () => {
  const t = fresh();
  t.mint(MINTER, A, 10n * U, T0 + 100);   // lot 1
  t.mint(MINTER, A, 10n * U);             // lot 2 (sans échéance)
  t.mint(MINTER, A, 10n * U, T0 + 50);    // lot 3
  t.transfer(A, B, 15n * U);              // 10 du lot 1 puis 5 du lot 2
  assert.equal(t.lotAt(A, 0).remainingAmount, 0n);
  assert.equal(t.lotAt(A, 1).remainingAmount, 5n * U);
  assert.equal(t.lotAt(A, 2).remainingAmount, 10n * U);
  assert.equal(t.lotAt(B, 0).expiresAt, T0 + 100);
  assert.equal(t.lotAt(B, 0).remainingAmount, 10n * U);
  assert.equal(t.lotAt(B, 1).expiresAt, 0);
  assert.equal(t.lotAt(B, 1).remainingAmount, 5n * U);
  assert.equal(t.headOf(A), 1);           // le lot 1 est vide : la tête avance
});

test('un lot échu n\'est plus dépensable ; balanceOf garde le brut, availableBalanceOf l\'exclut', () => {
  const t = fresh();
  t.mint(MINTER, A, 30n * U, T0 + 100);
  t.mint(MINTER, A, 20n * U);
  t.advance(101);
  assert.equal(t.balanceOf(A), 50n * U);
  assert.equal(t.expiredBalanceOf(A), 30n * U);
  assert.equal(t.availableBalanceOf(A), 20n * U);
  reverts(() => t.transfer(A, B, 25n * U), 'insufficient available balance');
  t.transfer(A, B, 20n * U);              // seul le lot non échu est dépensé
  assert.equal(t.availableBalanceOf(A), 0n);
  assert.equal(t.balanceOf(A), 30n * U);  // le lot échu reste en attente de expireLots
});

test('expireLots : accessible à tous, brûle exactement le montant échu, émet Expiration', () => {
  const t = fresh();
  t.mint(MINTER, A, 30n * U, T0 + 100);
  t.mint(MINTER, A, 20n * U);
  assert.equal(t.expireLots(KEEPER, A, 10), 0n);          // rien d'échu : aucun effet
  assert.equal(t.events.filter((e) => e.name === 'Expiration').length, 0);
  t.advance(100);                                          // échéance atteinte (<=)
  assert.equal(t.expireLots(KEEPER, A, 10), 30n * U);
  assert.equal(t.balanceOf(A), 20n * U);
  assert.equal(t.totalSupply(), 20n * U);
  assert.equal(t.expiredBalanceOf(A), 0n);
  const ev = t.events.filter((e) => e.name === 'Expiration');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].amount, 30n * U);
  assert.equal(t.headOf(A), 1);
  assert.equal(t.expireLots(KEEPER, A, 10), 0n);          // idempotent
});

test('aucune expiration sans lot ni échéance : un lot sans échéance ne s\'éteint jamais', () => {
  const t = fresh();
  t.mint(MINTER, A, 5n * U);
  t.advance(10 * 365 * 24 * 3600);
  assert.equal(t.expireLots(KEEPER, A, 10), 0n);
  assert.equal(t.availableBalanceOf(A), 5n * U);
  t.transfer(A, B, 5n * U);
  assert.equal(t.balanceOf(B), 5n * U);
});

test('fusion en queue : même échéance -> un seul lot ; échéances différentes -> lots distincts', () => {
  const t = fresh();
  t.mint(MINTER, A, 100n * U, T0 + 500);
  t.transfer(A, B, 10n * U);
  t.transfer(A, B, 10n * U);
  assert.equal(t.lotCount(B), 1);                          // fusion : même échéance que la queue
  assert.equal(t.lotAt(B, 0).remainingAmount, 20n * U);
  t.mint(MINTER, A, 5n * U);                               // lot sans échéance
  t.transfer(A, B, 82n * U);                               // 80 du lot 1 (échéance T0+500) puis 2 du lot 2
  assert.equal(t.lotCount(B), 2);
  assert.equal(t.lotAt(B, 0).remainingAmount, 100n * U);   // 20 + 80 fusionnés
  assert.equal(t.lotAt(B, 0).expiresAt, T0 + 500);
  assert.equal(t.lotAt(B, 1).expiresAt, 0);
  assert.equal(t.lotAt(B, 1).remainingAmount, 2n * U);
  assert.equal(t.balanceOf(A), 3n * U);
});

test('boucles bornées : au plus MAX_LOTS_PER_OP lots touchés par opération', () => {
  const t = fresh();
  for (let i = 0; i < 60; i++) t.mint(MINTER, A, 1n, i % 2 === 0 ? T0 + 1000 : T0 + 2000);   // 60 lots non fusionnés
  assert.equal(t.lotCount(A), 60);
  reverts(() => t.transfer(A, B, BigInt(MAX_LOTS_PER_OP) + 1n), 'too many lots');
  t.transfer(A, B, BigInt(MAX_LOTS_PER_OP));               // exactement 50 lots : accepté
  assert.equal(t.balanceOf(B), 50n);
  t.transfer(A, B, 10n);                                   // les 10 restants
  assert.equal(t.balanceOf(A), 0n);
  reverts(() => t.transfer(A, B, 1n), 'insufficient available balance');
});

test('atomicité : un transfert refusé ne laisse aucune trace (état et événements)', () => {
  const t = fresh();
  t.mint(MINTER, A, 10n * U, T0 + 10);
  t.advance(20);
  const before = JSON.stringify([...t.s.balances], (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  const evBefore = t.events.length;
  reverts(() => t.transfer(A, B, 5n * U), 'insufficient available balance');
  assert.equal(JSON.stringify([...t.s.balances], (k, v) => (typeof v === 'bigint' ? v.toString() : v)), before);
  assert.equal(t.events.length, evBefore);
  assert.equal(t.lotAt(A, 0).remainingAmount, 10n * U);
});

test('allowance : approve / transferFrom, allowance insuffisante refusée, illimitée respectée', () => {
  const t = fresh();
  t.mint(MINTER, A, 100n * U);
  t.approve(A, C, 30n * U);
  assert.equal(t.allowance(A, C), 30n * U);
  t.transferFrom(C, A, B, 20n * U);
  assert.equal(t.allowance(A, C), 10n * U);
  assert.equal(t.balanceOf(B), 20n * U);
  reverts(() => t.transferFrom(C, A, B, 11n * U), 'insufficient allowance');
  t.approve(A, C, MAX_UINT);
  t.transferFrom(C, A, B, 40n * U);
  assert.equal(t.allowance(A, C), MAX_UINT);
  reverts(() => t.approve(A, ZERO, 1n), 'approve to zero');
});

test('transferts nuls et vers l\'adresse zéro', () => {
  const t = fresh();
  t.mint(MINTER, A, 5n * U);
  t.transfer(A, B, 0n);                                    // autorisé, sans lot touché
  assert.equal(t.lotCount(B), 0);
  reverts(() => t.transfer(A, ZERO, 1n), 'transfer to zero');
  t.transfer(A, A, 2n * U);                                // auto-transfert : masse et solde inchangés
  assert.equal(t.balanceOf(A), 5n * U);
  assert.equal(t._sumRemaining(A), 5n * U);
});

test('burn : réservé à BURNER_ROLE, réduit la masse, ignore les lots échus', () => {
  const t = fresh();
  t.mint(MINTER, A, 10n * U, T0 + 10);
  t.mint(MINTER, A, 10n * U);
  reverts(() => t.burn(A, A, 1n), 'missing role');
  t.advance(11);
  t.burn(BURNER, A, 10n * U);                              // seul le lot non échu est brûlable
  assert.equal(t.totalSupply(), 10n * U);
  reverts(() => t.burn(BURNER, A, 1n), 'insufficient available balance');
  assert.equal(t.expireLots(KEEPER, A, 5), 10n * U);       // le lot échu part par expiration
  assert.equal(t.totalSupply(), 0n);
  assert.equal(t.balanceOf(A), 0n);
});

test('vues paginées : lotsSummary, et refus explicite (pas de réponse partielle silencieuse)', () => {
  const t = fresh();
  for (let i = 0; i < MAX_VIEW_LOTS + 5; i++) t.mint(MINTER, A, 1n, i % 2 === 0 ? T0 + 100 : T0 + 200);
  reverts(() => t.expiredBalanceOf(A), 'too many lots');
  t.advance(150);
  const p1 = t.lotsSummary(A, 0, 300);
  const p2 = t.lotsSummary(A, p1.next, 300);
  assert.equal(p1.next, 300);
  assert.equal(p2.next, MAX_VIEW_LOTS + 5);
  assert.equal(p1.available + p1.expired + p2.available + p2.expired, BigInt(MAX_VIEW_LOTS + 5));
  // expireLotsFrom permet d'atteindre des lots échus situés derrière des lots non échus
  assert.ok(t.expireLotsFrom(KEEPER, A, 0, MAX_LOTS_PER_OP) > 0n);
  reverts(() => t.expireLotsFrom(KEEPER, A, 0, 0), 'bad maxLots');
  reverts(() => t.expireLotsFrom(KEEPER, A, 0, MAX_LOTS_PER_OP + 1), 'bad maxLots');
  reverts(() => t.expireLotsFrom(KEEPER, A, 100000, 1), 'bad start');
});

// ---- test de propriétés : opérations aléatoires reproductibles, invariants vérifiés à chaque pas ----
function prng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; }; }

test('propriétés : invariants conservés sur 3000 opérations aléatoires (5 graines)', () => {
  for (const seed of [1, 7, 42, 2026, 99991]) {
    const r = prng(seed); const t = fresh(); const users = [A, B, C, '0xDave'];
    const pick = (a) => a[Math.floor(r() * a.length)];
    let supplyExpected = 0n;
    for (let step = 0; step < 600; step++) {
      const op = r();
      try {
        if (op < 0.25) { const amt = BigInt(1 + Math.floor(r() * 1000)); const exp = r() < 0.5 ? 0 : t.now + 1 + Math.floor(r() * 500); t.mint(MINTER, pick(users), amt, exp); supplyExpected += amt; }
        else if (op < 0.65) t.transfer(pick(users), pick(users), BigInt(Math.floor(r() * 1200)));
        else if (op < 0.72) { const o = pick(users), s = pick(users), d = pick(users); t.approve(o, s, BigInt(Math.floor(r() * 2000))); t.transferFrom(s, o, d, BigInt(Math.floor(r() * 500))); }
        else if (op < 0.78) { const before = t.totalSupply(); const from = pick(users); const amt = BigInt(1 + Math.floor(r() * 300)); t.burn(BURNER, from, amt); supplyExpected -= amt; assert.equal(t.totalSupply(), before - amt); }
        else if (op < 0.9) t.advance(Math.floor(r() * 120));
        else { const before = t.totalSupply(); const got = t.expireLots(KEEPER, pick(users), 1 + Math.floor(r() * MAX_LOTS_PER_OP)); supplyExpected -= got; assert.equal(t.totalSupply(), before - got); }
      } catch (e) { if (!(e instanceof Revert)) throw e; }
      // invariants
      let sumBal = 0n;
      for (const u of users) {
        const b = t.balanceOf(u); sumBal += b;
        assert.equal(b, t._sumRemaining(u), `solde = somme des lots (graine ${seed}, pas ${step})`);
        const h = t.headOf(u);
        for (let i = 0; i < h; i++) assert.equal(t.lotAt(u, i).remainingAmount, 0n, 'lots avant la tête vides');
        for (let i = 0; i < t.lotCount(u); i++) { const l = t.lotAt(u, i); assert.ok(l.remainingAmount >= 0n && l.remainingAmount <= l.amount); }
        if (t.lotCount(u) - h <= MAX_VIEW_LOTS) assert.equal(t.availableBalanceOf(u) + t.expiredBalanceOf(u), b);
      }
      assert.equal(sumBal, t.totalSupply(), `masse = somme des soldes (graine ${seed}, pas ${step})`);
      assert.equal(t.totalSupply(), supplyExpected, 'masse attendue');
    }
  }
});
