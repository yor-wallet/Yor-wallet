/* Same formula as the SQL function public.sulfa_quote, in exact decimal arithmetic (BigInt, thousandths of OMR).
 * The browser only PREVIEWS: the amount, fees and schedule that count are the ones the server computes and stores. */

export type QuoteSettings = {
  min_amount: number; max_amount: number; min_term: number; max_term: number;
  fee_fixed: number; fee_percent: number; monthly_rate_percent: number;
};

export type Quote = {
  amount: number; term: number; fee: number; interest: number; total: number; monthly: number; last: number;
  fee_fixed: number; fee_percent: number; monthly_rate_percent: number; currency: 'OMR';
};

export class QuoteError extends Error {}

/** decimal value -> BigInt scaled by 10^scale (rejects more decimals than allowed) */
export function toScaled(v: number | string, scale: number): bigint {
  const s = typeof v === 'number' ? v.toFixed(scale + 2) : String(v).trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new QuoteError('invalid_number');
  const frac = (m[3] ?? '').padEnd(scale + 2, '0');
  if (/[1-9]/.test(frac.slice(scale))) throw new QuoteError('too_many_decimals');
  const n = BigInt(m[2] + frac.slice(0, scale));
  return m[1] ? -n : n;
}

/** n / d rounded half away from zero, like PostgreSQL round(numeric) */
export function divRound(n: bigint, d: bigint): bigint {
  const neg = (n < 0n) !== (d < 0n);
  const an = n < 0n ? -n : n, ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (2n * ad);
  return neg ? -q : q;
}

const fromMilli = (m: bigint) => Number(m) / 1000;

export function computeQuote(s: QuoteSettings, amount: number, term: number): Quote {
  if (!Number.isFinite(amount) || amount < s.min_amount || amount > s.max_amount) throw new QuoteError('sulfa_amount_out_of_range');
  if (!Number.isInteger(term) || term < s.min_term || term > s.max_term) throw new QuoteError('sulfa_term_out_of_range');
  const a = divRound(toScaled(amount, 6), 1000n);                    // round(p_amount, 3) in thousandths
  const feeFixed = toScaled(s.fee_fixed, 3);
  const pct = toScaled(s.fee_percent, 4);                            // ten-thousandths of a percent
  const rate = toScaled(s.monthly_rate_percent, 4);
  const amountRaw = toScaled(amount, 6);                              // the SQL uses p_amount unrounded inside the fee
  // amountRaw (10^-6) × percent (10^-4) / 100  ->  units of 10^-12 OMR ; divide by 10^9 to get thousandths
  const fee = divRound(feeFixed * 1_000_000_000n + amountRaw * pct, 1_000_000_000n);
  const interest = divRound(amountRaw * rate * BigInt(term), 1_000_000_000n);
  const total = a + fee + interest;
  const monthly = divRound(total, BigInt(term));
  const last = total - monthly * BigInt(term - 1);
  return {
    amount: fromMilli(a), term, fee: fromMilli(fee), interest: fromMilli(interest), total: fromMilli(total),
    monthly: fromMilli(monthly), last: fromMilli(last),
    fee_fixed: s.fee_fixed, fee_percent: s.fee_percent, monthly_rate_percent: s.monthly_rate_percent, currency: 'OMR',
  };
}

/** values used only when the server settings cannot be loaded; always shown with a "not loaded" warning */
export const FALLBACK_SETTINGS: QuoteSettings = { min_amount: 500, max_amount: 10000, min_term: 3, max_term: 9, fee_fixed: 0, fee_percent: 0, monthly_rate_percent: 0 };
