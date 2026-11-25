import { describe, expect, it } from 'vitest';

import { formatMetricValue, formatTimestampLabel, humanizeLabel } from '../formatting';

describe('WhatsApp formatting helpers', () => {
  it('formats metric values gracefully', () => {
    expect(formatMetricValue(1234)).toBe('1.234');
    expect(formatMetricValue('custom')).toBe('custom');
    expect(formatMetricValue(null)).toBe('—');
  });

  it('formats timestamps using pt-BR locale when possible', () => {
    const iso = '2023-10-05T12:34:56.000Z';
    const formatted = formatTimestampLabel(iso);
    expect(typeof formatted).toBe('string');
    expect(formatted).not.toBe('—');
    expect(formatTimestampLabel('invalid-date')).toBe('—');
  });

  it('humanizes labels replacing separators and casing words', () => {
    expect(humanizeLabel('connection_status')).toBe('Connection Status');
    expect(humanizeLabel('  latest-update ')).toBe('Latest Update');
    expect(humanizeLabel('')).toBe('Atualização');
  });
});
