/* YOR WALLET — conversion montants (entiers bruts <-> texte). Jamais de flottants pour de l'argent. */

export class UnitsError extends Error {
  constructor(message){ super(message); this.name = 'UnitsError'; this.code = 'INVALID_AMOUNT'; }
}

/** 1_869_950_000_000n, 6 -> "1869950" ; 1500000n, 6 -> "1.5" */
export function formatUnits(raw, decimals = 6){
  const n = BigInt(raw);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const base = 10n ** BigInt(decimals);
  const whole = (abs / base).toString();
  const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + whole + (frac ? '.' + frac : '');
}

/** "1869950" -> "1,869,950" (séparateur de milliers pour l'affichage). */
export function groupThousands(text, sep = ','){
  const [whole, frac] = String(text).split('.');
  const neg = whole.startsWith('-');
  const digits = neg ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (neg ? '-' : '') + grouped + (frac ? '.' + frac : '');
}

/** "1.5", 6 -> 1500000n. Refuse signes, exposants, séparateurs, et plus de décimales que le jeton n'en a. */
export function parseUnits(text, decimals = 6){
  if (typeof text !== 'string' || !/^\d+(\.\d+)?$/.test(text)) throw new UnitsError('invalid amount format');
  const [whole, frac = ''] = text.split('.');
  if (frac.length > decimals) throw new UnitsError('too many decimals');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}
