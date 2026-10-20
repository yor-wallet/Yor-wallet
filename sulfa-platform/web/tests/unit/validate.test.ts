import { describe, expect, it } from 'vitest';
import { age, isAmount, isPhone } from '@/lib/validate';
import { money } from '@/lib/format';

describe('validation and formatting', () => {
  it('age counts full years', () => {
    const now = new Date(2026, 9, 20);
    expect(age('2008-10-20', now)).toBe(18); expect(age('2008-10-21', now)).toBe(17);
  });
  it('phone in international format, amount with ≤ 3 decimals', () => {
    expect(isPhone('+96890012345')).toBe(true); expect(isPhone('90012345')).toBe(false);
    expect(isAmount('12.345')).toBe(true); expect(isAmount('12.3456')).toBe(false); expect(isAmount('0')).toBe(false);
  });
  it('OMR always shows 3 decimals with latin digits', () => {
    expect(money(1234.5, 'en')).toBe('1,234.500 OMR');
    expect(money(1234.5, 'ar')).toMatch(/^1[,٬]234[.٫]500 ر\.ع$/);
  });
});
