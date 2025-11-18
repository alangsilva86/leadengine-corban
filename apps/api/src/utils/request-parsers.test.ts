import { describe, it, expect } from 'vitest';

import { normalizeQueryValue } from './request-parsers';

describe('normalizeQueryValue', () => {
  it('trims single string values', () => {
    expect(normalizeQueryValue('  hello ')).toBe('hello');
  });

  it('returns undefined for empty entries', () => {
    expect(normalizeQueryValue('   ')).toBeUndefined();
    expect(normalizeQueryValue(undefined)).toBeUndefined();
  });

  it('reads the first valid string from arrays', () => {
    expect(normalizeQueryValue(['   ', ' value '])).toBe('value');
  });

  it('skips non-string entries when scanning arrays', () => {
    expect(normalizeQueryValue([null, 123, ' ok '])).toBe('ok');
  });
});
