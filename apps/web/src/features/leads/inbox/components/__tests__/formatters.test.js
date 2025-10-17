import { describe, it, expect, afterEach, vi } from 'vitest';

import { formatCurrency, formatDocument } from '../../utils/formatters.js';

describe('formatters.formatCurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an em dash when value is not a finite number', () => {
    expect(formatCurrency('1000')).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
    expect(formatCurrency(Infinity)).toBe('—');
  });

  it('delegates formatting to Number#toLocaleString with BRL currency options', () => {
    const value = 1234.56;
    const spy = vi.spyOn(Number.prototype, 'toLocaleString').mockReturnValue('R$ 1.234,56');

    const result = formatCurrency(value);

    expect(result).toBe('R$ 1.234,56');
    expect(spy).toHaveBeenCalledWith('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  });
});

describe('formatters.formatDocument', () => {
  it('returns an em dash when value is falsy', () => {
    expect(formatDocument('')).toBe('—');
    expect(formatDocument(null)).toBe('—');
    expect(formatDocument(undefined)).toBe('—');
  });

  it('formats CPF numbers with punctuation when it has 11 digits', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01');
    expect(formatDocument('123.456.789-01')).toBe('123.456.789-01');
  });

  it('returns the original value when digits length is not 11', () => {
    expect(formatDocument('1234')).toBe('1234');
  });
});
