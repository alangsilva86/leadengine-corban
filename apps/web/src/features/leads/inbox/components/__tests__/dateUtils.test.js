import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  ensureDate,
  formatDateTime,
  getFirstString,
  getFirstValidDate,
} from '../../utils/dateUtils.js';

describe('dateUtils.ensureDate', () => {
  it('returns the same instance when value is already a valid Date', () => {
    const original = new Date('2024-01-10T12:30:00Z');
    const result = ensureDate(original);
    expect(result).toBe(original);
  });

  it('parses primitive values into Date when valid', () => {
    const result = ensureDate('2024-02-15T08:45:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2024-02-15T08:45:00.000Z');
  });

  it('returns null for falsy or invalid inputs', () => {
    expect(ensureDate(null)).toBeNull();
    expect(ensureDate(undefined)).toBeNull();
    expect(ensureDate('invalid-date')).toBeNull();
  });
});

describe('dateUtils.formatDateTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the input cannot be converted to a valid date', () => {
    expect(formatDateTime('not-a-date')).toBeNull();
  });

  it('delegates formatting to Date#toLocaleString with default options', () => {
    const value = new Date('2024-03-20T10:15:00Z');
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('formatted-value');

    const result = formatDateTime(value);

    expect(result).toBe('formatted-value');
    expect(spy).toHaveBeenCalledWith('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  it('allows overriding default locale options', () => {
    const value = new Date('2024-03-21T11:25:00Z');
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('formatted');

    formatDateTime(value, { month: 'long' });

    expect(spy).toHaveBeenCalledWith('pt-BR', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
});

describe('dateUtils.getFirstValidDate', () => {
  it('returns the first valid date matching the provided paths', () => {
    const payload = {
      createdAt: '2024-01-01T09:00:00Z',
      metadata: {
        createdAt: '2024-01-02T09:00:00Z',
      },
    };

    const result = getFirstValidDate(payload, [
      ['nonExistent'],
      ['createdAt'],
      ['metadata', 'createdAt'],
    ]);

    expect(result).not.toBeNull();
    expect(result?.value).toBe('2024-01-01T09:00:00Z');
    expect(result?.date).toBeInstanceOf(Date);
    expect(result?.date.toISOString()).toBe('2024-01-01T09:00:00.000Z');
    expect(result?.path).toEqual(['createdAt']);
  });

  it('returns null when none of the provided paths is a valid date', () => {
    const payload = { foo: 'bar' };
    const result = getFirstValidDate(payload, [['foo']]);
    expect(result).toBeNull();
  });
});

describe('dateUtils.getFirstString', () => {
  it('returns the first non-empty string found in the provided paths', () => {
    const payload = {
      lastMessagePreview: '  Último contato  ',
      metadata: { lastMessagePreview: 'Outro valor' },
    };

    const result = getFirstString(payload, [
      ['metadata', 'missing'],
      ['lastMessagePreview'],
      ['metadata', 'lastMessagePreview'],
    ]);

    expect(result).toBe('Último contato');
  });

  it('returns null when no valid string is found', () => {
    const payload = { foo: 123 };
    const result = getFirstString(payload, [['foo'], ['bar']]);
    expect(result).toBeNull();
  });
});
