import { describe, expect, it } from 'vitest';

import { formatDateTime } from '../datetime.js';

const OPTIONS = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

describe('formatDateTime', () => {
  it('formats Date instances using the configured locale', () => {
    const input = new Date('2024-01-01T12:34:00.000Z');

    expect(formatDateTime(input)).toBe(input.toLocaleString('pt-BR', OPTIONS));
  });

  it('formats ISO strings using the configured locale', () => {
    const input = '2024-06-15T08:45:00.000Z';

    expect(formatDateTime(input)).toBe(new Date(input).toLocaleString('pt-BR', OPTIONS));
  });

  it('returns an em dash for invalid values', () => {
    expect(formatDateTime('invalid-date')).toBe('—');
    expect(formatDateTime(NaN)).toBe('—');
    expect(formatDateTime(Infinity)).toBe('—');
  });

  it('returns an em dash for nullish inputs', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('   ')).toBe('—');
  });
});
