import { describe, expect, it } from 'vitest';
import { remainingAfter, termInsights } from '@/lib/insights';
import { computeQuote } from '@/lib/quote';

const s = { min_amount: 500, max_amount: 10000, min_term: 3, max_term: 9, fee_fixed: 0, fee_percent: 2, monthly_rate_percent: 1 };
describe('simulator insights', () => {
  it('remaining balance: starts at the total, falls by one instalment each month, ends at exactly 0', () => {
    const q = computeQuote(s, 2000, 6);
    expect(remainingAfter(q)).toEqual([2160, 1800, 1440, 1080, 720, 360, 0]);
    const odd = computeQuote({ ...s, fee_percent: 0, monthly_rate_percent: 0 }, 1000, 3);   // 333.333 × 2 + 333.334
    expect(remainingAfter(odd)).toEqual([1000, 666.667, 333.334, 0]);
  });
  it('insights are plain arithmetic on the configured settings', () => {
    const i = termInsights(s, 2000, 6);
    expect(i.cost).toBe(160); expect(i.costPct).toBe(8);
    expect(i.shorter).toEqual({ monthly: computeQuote(s, 2000, 5).monthly, save: 20 });   // one month of 1 % interest on 2000
    expect(i.longer).toEqual({ monthly: computeQuote(s, 2000, 7).monthly, more: 20 });
  });
  it('no "shorter" or "longer" suggestion outside the allowed terms', () => {
    expect(termInsights(s, 2000, 3).shorter).toBeNull();
    expect(termInsights(s, 2000, 9).longer).toBeNull();
  });
});
