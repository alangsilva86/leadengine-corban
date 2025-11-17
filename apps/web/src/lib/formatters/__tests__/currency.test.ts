import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../currency';

describe('formatCurrency', () => {
  it('returns the configured fallback when the value is not formatable', () => {
    expect(formatCurrency(null, { fallback: '—' })).toBe('—');
    expect(formatCurrency('texto', { fallback: 'N/A' })).toBe('N/A');
  });

  it('applies configurable rounding using the provided precision', () => {
    expect(
      formatCurrency(123.456, {
        roundingMode: 'floor',
        roundingPrecision: 2,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe('R$\u00a0123,45');

    expect(
      formatCurrency(123.451, {
        roundingMode: 'ceil',
        roundingPrecision: 2,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe('R$\u00a0123,46');
  });
});
