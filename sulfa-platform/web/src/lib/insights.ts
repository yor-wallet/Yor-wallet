/* Computed insights for the simulator — derived from the same exact formula as the server (quote.ts). Nothing invented:
   each sentence is arithmetic on the configured settings. */
import { computeQuote, type Quote, type QuoteSettings } from './quote';

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** balance left to repay after k instalments, k = 0..term (exact: equal instalments, rounding absorbed by the last) */
export function remainingAfter(q: Quote): number[] {
  return Array.from({ length: q.term + 1 }, (_, k) => (k === q.term ? 0 : r3(q.total - q.monthly * k)));
}

export function termInsights(s: QuoteSettings, amount: number, term: number) {
  const q = computeQuote(s, amount, term);
  const cost = r3(q.fee + q.interest);
  const alt = (n: number) => { try { return computeQuote(s, amount, n); } catch { return null; } };
  const sh = term - 1 >= s.min_term ? alt(term - 1) : null;
  const lo = term + 1 <= s.max_term ? alt(term + 1) : null;
  return {
    cost, costPct: Math.round((cost / q.amount) * 1000) / 10,
    shorter: sh ? { monthly: sh.monthly, save: r3(q.total - sh.total) } : null,
    longer: lo ? { monthly: lo.monthly, more: r3(lo.total - q.total) } : null,
    perDay: r3(q.monthly / 30),
  };
}
