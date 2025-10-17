import { describe, expect, it } from 'vitest';
import { formatMetricValue, formatPhoneNumber, formatTimestampLabel, humanizeLabel } from '../formatting.js';

describe('WhatsApp formatting helpers', () => {
  it('formats metric values gracefully', () => {
    expect(formatMetricValue(1234)).toBe('1.234');
    expect(formatMetricValue('custom')).toBe('custom');
    expect(formatMetricValue(null)).toBe('—');
  });

  it('formats timestamps with locale fallback', () => {
    const iso = '2024-01-01T12:34:56.000Z';
    const formatted = formatTimestampLabel(iso);
    expect(typeof formatted).toBe('string');
    expect(formatTimestampLabel('invalid')).toBe('—');
  });

  it('formats brazilian phone numbers', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneNumber('1132654321')).toBe('(11) 3265-4321');
    expect(formatPhoneNumber(null)).toBe('—');
  });

  it('humanizes labels into title case', () => {
    expect(humanizeLabel('connection_status')).toBe('Connection Status');
    expect(humanizeLabel('')).toBe('Atualização');
  });
});
