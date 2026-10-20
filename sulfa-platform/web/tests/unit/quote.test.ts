/* The browser preview must give EXACTLY what the server function gives. quote-fixtures.json was produced by the real
   SQL function public.sulfa_quote on PostgreSQL 16 (supabase/tests/gen-quote-fixtures.sh): 5 fee settings × 9 amounts × 7 terms. */
import { describe, expect, it } from 'vitest';
import fixtures from './quote-fixtures.json';
import { computeQuote, divRound, toScaled, QuoteError, type QuoteSettings } from '@/lib/quote';

const base = { min_amount: 500, max_amount: 10000, min_term: 3, max_term: 9 };
type Fx = { settings: { fee_fixed: number; fee_percent: number; monthly_rate_percent: number }; amount: number; term: number; quote: Record<string, number> };

describe('computeQuote = public.sulfa_quote', () => {
  it(`matches the SQL function on all ${(fixtures as Fx[]).length} recorded cases`, () => {
    let n = 0;
    for (const f of fixtures as Fx[]) {
      const s: QuoteSettings = { ...base, ...f.settings };
      const q = computeQuote(s, f.amount, f.term);
      for (const k of ['amount', 'fee', 'interest', 'total', 'monthly', 'last'] as const)
        expect(q[k], `${k} for ${JSON.stringify(f.settings)} ${f.amount} × ${f.term}`).toBe(Number(f.quote[k]));
      n++;
    }
    expect(n).toBe(315);
  });
  it('the schedule always adds up to the total (last instalment absorbs the rounding)', () => {
    for (const f of fixtures as Fx[]) {
      const q = computeQuote({ ...base, ...f.settings }, f.amount, f.term);
      expect(Math.round((q.monthly * (q.term - 1) + q.last) * 1000)).toBe(Math.round(q.total * 1000));
    }
  });
  it('known example from the SQL tests: 2000 OMR / 6 months, 2 % fee, 1 %/month', () => {
    const q = computeQuote({ ...base, fee_fixed: 0, fee_percent: 2, monthly_rate_percent: 1 }, 2000, 6);
    expect([q.fee, q.interest, q.total, q.monthly]).toEqual([40, 120, 2160, 360]);
  });
  it('refuses what the server refuses', () => {
    const s = { ...base, fee_fixed: 0, fee_percent: 0, monthly_rate_percent: 0 };
    expect(() => computeQuote(s, 499.999, 6)).toThrow('sulfa_amount_out_of_range');
    expect(() => computeQuote(s, 10000.001, 6)).toThrow('sulfa_amount_out_of_range');
    expect(() => computeQuote(s, 1000, 2)).toThrow('sulfa_term_out_of_range');
    expect(() => computeQuote(s, 1000, 10)).toThrow('sulfa_term_out_of_range');
    expect(() => computeQuote(s, 1000, 4.5)).toThrow(QuoteError);
  });
  it('exact decimal helpers: half away from zero, no float drift', () => {
    expect(divRound(5n, 2n)).toBe(3n); expect(divRound(-5n, 2n)).toBe(-3n); expect(divRound(4n, 3n)).toBe(1n);
    expect(toScaled('0.1', 3) + toScaled('0.2', 3)).toBe(toScaled('0.3', 3));
    expect(() => toScaled('1.0001', 3)).toThrow('too_many_decimals');
  });
});
