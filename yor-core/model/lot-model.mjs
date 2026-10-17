// Modèle de référence (JavaScript) du jeton YOR Experimental USDT.
// Il reproduit EXACTEMENT les règles du contrat contracts/YORExperimentalUSDT.sol :
// lots explicites, consommation FIFO par ordre d'arrivée, lots échus non dépensables,
// héritage de l'échéance au transfert, fusion en queue si même échéance, boucles bornées.
// Il sert à valider la LOGIQUE hors réseau. Ce n'est PAS le contrat et ne prouve rien sur TRON.

export const MAX_LOTS_PER_OP = 50;
export const MAX_VIEW_LOTS = 500;
export const DECIMALS = 6;
export const MAX_UINT = (1n << 256n) - 1n;
export const DEFAULT_ADMIN_ROLE = 'DEFAULT_ADMIN_ROLE';
export const MINTER_ROLE = 'MINTER_ROLE';
export const BURNER_ROLE = 'BURNER_ROLE';
export const ZERO = '0x0000000000000000000000000000000000000000';

export class Revert extends Error {
  constructor(reason) { super(reason); this.name = 'Revert'; this.reason = reason; }
}

const cloneState = (s) => ({
  lots: new Map([...s.lots].map(([k, v]) => [k, { ...v }])),
  lotIds: new Map([...s.lotIds].map(([k, v]) => [k, [...v]])),
  head: new Map(s.head),
  balances: new Map(s.balances),
  allowances: new Map([...s.allowances].map(([k, v]) => [k, new Map(v)])),
  roles: new Map([...s.roles].map(([k, v]) => [k, new Set(v)])),
  totalSupply: s.totalSupply,
  nextLotId: s.nextLotId,
});

export class YorTokenModel {
  constructor({ admin, now = 1_700_000_000 }) {
    if (!admin || admin === ZERO) throw new Revert('YORUSDT: admin is zero');
    this.name = 'YOR Experimental USDT';
    this.symbol = 'YOR-USDT';
    this.decimals = DECIMALS;
    this.now = now;
    this.events = [];
    this.s = {
      lots: new Map(), lotIds: new Map(), head: new Map(), balances: new Map(),
      allowances: new Map(), roles: new Map(), totalSupply: 0n, nextLotId: 1n,
    };
    this._grant(DEFAULT_ADMIN_ROLE, admin);
  }

  // ---------- environnement ----------
  setTime(t) { this.now = t; }
  advance(seconds) { this.now += seconds; }
  _emit(name, args) { this.events.push({ name, ...args }); }

  // Une opération qui échoue ne laisse aucune trace (comme un revert EVM).
  _tx(fn) {
    const snap = cloneState(this.s);
    const evLen = this.events.length;
    try { return fn(); }
    catch (e) { this.s = snap; this.events.length = evLen; throw e; }
  }

  // ---------- rôles ----------
  _has(role, a) { return !!this.s.roles.get(role)?.has(a); }
  _grant(role, a) {
    if (!this.s.roles.has(role)) this.s.roles.set(role, new Set());
    if (!this.s.roles.get(role).has(a)) { this.s.roles.get(role).add(a); this._emit('RoleGranted', { role, account: a }); }
  }
  hasRole(role, a) { return this._has(role, a); }
  _onlyRole(role, caller) { if (!this._has(role, caller)) throw new Revert('YORUSDT: missing role ' + role); }
  grantRole(caller, role, a) { return this._tx(() => { this._onlyRole(DEFAULT_ADMIN_ROLE, caller); this._grant(role, a); }); }
  revokeRole(caller, role, a) {
    return this._tx(() => {
      this._onlyRole(DEFAULT_ADMIN_ROLE, caller);
      if (this._has(role, a)) { this.s.roles.get(role).delete(a); this._emit('RoleRevoked', { role, account: a }); }
    });
  }
  renounceRole(caller, role) {
    return this._tx(() => {
      if (this._has(role, caller)) { this.s.roles.get(role).delete(caller); this._emit('RoleRevoked', { role, account: caller }); }
    });
  }

  // ---------- lots ----------
  _ids(a) { if (!this.s.lotIds.has(a)) this.s.lotIds.set(a, []); return this.s.lotIds.get(a); }
  _head(a) { return this.s.head.get(a) ?? 0; }
  _bal(a) { return this.s.balances.get(a) ?? 0n; }
  _isExpired(lot) { return lot.expiresAt !== 0 && lot.expiresAt <= this.now; }

  // Crédite `amount` à `to` avec l'échéance `expiresAt` : fusion en queue si même échéance, sinon nouveau lot.
  _credit(to, expiresAt, amount) {
    const ids = this._ids(to);
    if (ids.length > 0) {
      const tail = this.s.lots.get(ids[ids.length - 1]);
      if (tail.remainingAmount > 0n && tail.expiresAt === expiresAt) {
        tail.amount += amount; tail.remainingAmount += amount;
        this.s.balances.set(to, this._bal(to) + amount);
        this._emit('LotCredited', { owner: to, lotId: tail.id, amount, expiresAt, created: false });
        return tail.id;
      }
    }
    const id = this.s.nextLotId; this.s.nextLotId += 1n;
    this.s.lots.set(id, { id, owner: to, amount, createdAt: this.now, expiresAt, remainingAmount: amount });
    ids.push(id);
    this.s.balances.set(to, this._bal(to) + amount);
    this._emit('LotCredited', { owner: to, lotId: id, amount, expiresAt, created: true });
    return id;
  }

  // Débite `amount` des lots de `from` (FIFO par ordre d'arrivée, lots échus ignorés).
  _consume(from, amount) {
    const ids = this._ids(from);
    const pieces = [];
    let need = amount; let i = this._head(from); let visited = 0;
    while (need > 0n) {
      if (i >= ids.length) throw new Revert('YORUSDT: insufficient available balance');
      if (visited === MAX_LOTS_PER_OP) throw new Revert('YORUSDT: too many lots');
      const lot = this.s.lots.get(ids[i]);
      visited++;
      if (lot.remainingAmount === 0n) { if (i === this._head(from)) this.s.head.set(from, i + 1); i++; continue; }
      if (this._isExpired(lot)) { i++; continue; }
      const take = lot.remainingAmount < need ? lot.remainingAmount : need;
      lot.remainingAmount -= take; need -= take;
      this.s.balances.set(from, this._bal(from) - take);
      pieces.push({ lotId: lot.id, expiresAt: lot.expiresAt, take });
      this._emit('LotDebited', { owner: from, lotId: lot.id, amount: take });
      if (lot.remainingAmount === 0n && i === this._head(from)) this.s.head.set(from, i + 1);
      i++;
    }
    return pieces;
  }

  // ---------- ERC-20 / TRC-20 ----------
  totalSupply() { return this.s.totalSupply; }
  balanceOf(a) { return this._bal(a); }
  allowance(owner, spender) { return this.s.allowances.get(owner)?.get(spender) ?? 0n; }

  _move(from, to, amount) {
    if (to === ZERO) throw new Revert('YORUSDT: transfer to zero');
    if (from === ZERO) throw new Revert('YORUSDT: transfer from zero');
    if (amount > 0n) {
      const pieces = this._consume(from, amount);
      for (const p of pieces) this._credit(to, p.expiresAt, p.take);
    }
    this._emit('Transfer', { from, to, value: amount });
  }
  transfer(caller, to, amount) { return this._tx(() => { this._move(caller, to, amount); return true; }); }
  approve(caller, spender, amount) {
    return this._tx(() => {
      if (spender === ZERO) throw new Revert('YORUSDT: approve to zero');
      if (!this.s.allowances.has(caller)) this.s.allowances.set(caller, new Map());
      this.s.allowances.get(caller).set(spender, amount);
      this._emit('Approval', { owner: caller, spender, value: amount });
      return true;
    });
  }
  transferFrom(caller, from, to, amount) {
    return this._tx(() => {
      const cur = this.allowance(from, caller);
      if (cur !== MAX_UINT) {
        if (cur < amount) throw new Revert('YORUSDT: insufficient allowance');
        this.s.allowances.get(from).set(caller, cur - amount);
      }
      this._move(from, to, amount);
      return true;
    });
  }

  // ---------- émission / destruction (rôles) ----------
  mint(caller, to, amount, expiresAt = 0) {
    return this._tx(() => {
      this._onlyRole(MINTER_ROLE, caller);
      if (to === ZERO) throw new Revert('YORUSDT: mint to zero');
      if (amount <= 0n) throw new Revert('YORUSDT: zero amount');
      if (expiresAt !== 0 && expiresAt <= this.now) throw new Revert('YORUSDT: expiry in the past');
      const lotId = this._credit(to, expiresAt, amount);
      this.s.totalSupply += amount;
      this._emit('Mint', { to, amount, lotId, expiresAt });
      this._emit('Transfer', { from: ZERO, to, value: amount });
      return lotId;
    });
  }
  burn(caller, from, amount) {
    return this._tx(() => {
      this._onlyRole(BURNER_ROLE, caller);
      if (amount <= 0n) throw new Revert('YORUSDT: zero amount');
      this._consume(from, amount);
      this.s.totalSupply -= amount;
      this._emit('Burn', { from, amount });
      this._emit('Transfer', { from, to: ZERO, value: amount });
    });
  }

  // ---------- expiration (accessible à tous, ne brûle que des lots réellement échus) ----------
  expireLotsFrom(_caller, owner, start, maxLots) {
    return this._tx(() => {
      if (maxLots <= 0 || maxLots > MAX_LOTS_PER_OP) throw new Revert('YORUSDT: bad maxLots');
      const ids = this._ids(owner);
      if (start > ids.length) throw new Revert('YORUSDT: bad start');
      const end = Math.min(start + maxLots, ids.length);
      let total = 0n;
      for (let i = start; i < end; i++) {
        const lot = this.s.lots.get(ids[i]);
        if (lot.remainingAmount > 0n && this._isExpired(lot)) {
          const amt = lot.remainingAmount; lot.remainingAmount = 0n;
          this.s.balances.set(owner, this._bal(owner) - amt);
          this.s.totalSupply -= amt; total += amt;
          this._emit('Expiration', { owner, lotId: lot.id, amount: amt });
          this._emit('Transfer', { from: owner, to: ZERO, value: amt });
        }
      }
      let h = this._head(owner); let steps = 0;
      while (h < ids.length && steps < MAX_LOTS_PER_OP && this.s.lots.get(ids[h]).remainingAmount === 0n) { h++; steps++; }
      this.s.head.set(owner, h);
      return total;
    });
  }
  expireLots(caller, owner, maxLots) { return this.expireLotsFrom(caller, owner, this._head(owner), maxLots); }

  // ---------- lecture ----------
  expiredBalanceOf(a) {
    const ids = this._ids(a); const h = this._head(a);
    if (ids.length - h > MAX_VIEW_LOTS) throw new Revert('YORUSDT: too many lots, use lotsSummary');
    let sum = 0n;
    for (let i = h; i < ids.length; i++) { const l = this.s.lots.get(ids[i]); if (l.remainingAmount > 0n && this._isExpired(l)) sum += l.remainingAmount; }
    return sum;
  }
  availableBalanceOf(a) { return this._bal(a) - this.expiredBalanceOf(a); }
  lotsSummary(a, start, count) {
    const ids = this._ids(a); const end = Math.min(start + count, ids.length);
    let available = 0n; let expired = 0n;
    for (let i = start; i < end; i++) {
      const l = this.s.lots.get(ids[i]);
      if (l.remainingAmount === 0n) continue;
      if (this._isExpired(l)) expired += l.remainingAmount; else available += l.remainingAmount;
    }
    return { available, expired, next: end };
  }
  lotCount(a) { return this._ids(a).length; }
  headOf(a) { return this._head(a); }
  lotAt(a, index) { const ids = this._ids(a); if (index >= ids.length) throw new Revert('YORUSDT: bad index'); return { ...this.s.lots.get(ids[index]) }; }
  // Invariant utile aux tests : somme des lots restants.
  _sumRemaining(a) { let s = 0n; for (const id of this._ids(a)) s += this.s.lots.get(id).remainingAmount; return s; }
  _allOwners() { return [...this.s.lotIds.keys()]; }
}
