import { describe, expect, it } from 'vitest';

import {
  formatMetricValue,
  formatPhoneNumber,
  formatRelativeTime,
  formatTimestampLabel,
  formatWhatsAppNumber,
  humanizeLabel,
} from '../formatting';

describe('WhatsApp formatting helpers', () => {
  it('formats metric values gracefully', () => {
    expect(formatMetricValue(1234)).toBe('1.234');
    expect(formatMetricValue('custom')).toBe('custom');
    expect(formatMetricValue(null)).toBe('—');
  });

  it('formats phone numbers with DDD and optional ninth digit', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneNumber('1132654321')).toBe('(11) 3265-4321');
    expect(formatPhoneNumber(null)).toBe('—');
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

  it('formats WhatsApp numbers for display and never returns a JID', () => {
    expect(formatWhatsAppNumber('5511912345678')).toBe('+55 11 91234-5678');
    expect(formatWhatsAppNumber('5511912345678@s.whatsapp.net')).toBe('+55 11 91234-5678');
    expect(formatWhatsAppNumber('5511912345678:7@s.whatsapp.net')).toBe('+55 11 91234-5678');
    expect(formatWhatsAppNumber('1132654321')).toBe('+55 11 3265-4321');
    expect(formatWhatsAppNumber('14155552671')).toBe('+55 14 15555-2671');
    expect(formatWhatsAppNumber('447911123456')).toBe('+447911123456');
    expect(formatWhatsAppNumber('abc')).toBeNull();
    expect(formatWhatsAppNumber(null)).toBeNull();
  });

  it('formats relative times in pt-BR', () => {
    const now = Date.parse('2026-01-10T12:00:00Z');
    expect(formatRelativeTime('2026-01-10T11:59:40Z', now)).toBe('agora mesmo');
    expect(formatRelativeTime('2026-01-10T11:55:00Z', now)).toBe('há 5 minutos');
    expect(formatRelativeTime('2026-01-09T12:00:00Z', now)).toBe('ontem');
    expect(formatRelativeTime('invalid', now)).toBeNull();
  });
});
