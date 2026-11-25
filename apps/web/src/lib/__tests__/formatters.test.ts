import { describe, expect, it } from 'vitest';

import { formatBRL, formatCurrencyBRL } from '../currency';
import { getInitials, getPersonInitials } from '../initials';
import { extractWhatsAppDigits, formatPhone, formatPhoneNumber, formatWhatsAppNumber, maskPhoneInput, toE164 } from '../phone';
import { formatRelativeLong, formatRelativeShort, formatRelativeTime, toDate } from '../relative-time';

// Intl usa espaço não separável entre "R$" e o valor.
const nbsp = (value: string) => value.replace(/ /g, ' ');

describe('@/lib/phone', () => {
  it('formats phone numbers with DDD and optional ninth digit', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneNumber('1132654321')).toBe('(11) 3265-4321');
    expect(formatPhoneNumber('5511987654321')).toBe('+55 (11) 98765-4321');
    expect(formatPhoneNumber(null)).toBe('—');
    expect(formatPhoneNumber('abc')).toBe('abc');
  });

  it('formats contact phones and returns null when empty', () => {
    expect(formatPhone('556233334444')).toBe('+55 (62) 3333-4444');
    expect(formatPhone('5562999776655')).toBe('+55 (62) 99977-6655');
    expect(formatPhone('')).toBeNull();
  });

  it('masks typing and converts to E.164', () => {
    expect(maskPhoneInput('629')).toBe('(62) 9');
    expect(maskPhoneInput('62999776655')).toBe('(62) 99977-6655');
    expect(toE164('(62) 99977-6655')).toBe('+5562999776655');
    expect(toE164('(62) 89977-6655')).toBeNull();
    expect(toE164('+447911123456')).toBe('+447911123456');
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
    expect(extractWhatsAppDigits('5511912345678:7@s.whatsapp.net')).toBe('5511912345678');
  });
});

describe('@/lib/initials', () => {
  it('uses first and last names, two letters for a single word by default', () => {
    expect(getInitials('Ana Paula Souza')).toBe('AS');
    expect(getInitials('Ana')).toBe('AN');
    expect(getInitials('  ')).toBe('?');
    expect(getInitials(null, { fallback: '??' })).toBe('??');
    expect(getInitials('Ana', { singleWordLetters: 1 })).toBe('A');
  });

  it('ignores phone-like names for people in the Inbox', () => {
    expect(getPersonInitials('João Silva')).toBe('JS');
    expect(getPersonInitials('Ana')).toBe('A');
    expect(getPersonInitials('+55 11 99999-0000', '')).toBe('');
    expect(getPersonInitials('Ana 123 Souza')).toBe('AS');
  });
});

describe('@/lib/relative-time', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');

  it('formats compact relative times for lists', () => {
    expect(formatRelativeShort('2026-01-10T11:59:40Z', now)).toBe('agora');
    expect(formatRelativeShort('2026-01-10T11:55:00Z', now)).toBe('há 5 min');
    expect(formatRelativeShort('2026-01-10T09:00:00Z', now)).toBe('há 3 h');
    expect(formatRelativeShort('2026-01-08T12:00:00Z', now)).toBe('há 2 d');
    expect(formatRelativeShort(null, now)).toBeNull();
  });

  it('formats natural relative times in pt-BR', () => {
    expect(formatRelativeTime('2026-01-10T11:59:40Z', now)).toBe('agora mesmo');
    expect(formatRelativeTime('2026-01-10T11:55:00Z', now)).toBe('há 5 minutos');
    expect(formatRelativeTime('2026-01-09T12:00:00Z', now)).toBe('ontem');
    expect(formatRelativeTime('invalid', now)).toBeNull();
  });

  it('formats long relative times and rejects invalid dates', () => {
    expect(formatRelativeLong(new Date(Date.now() - 5 * 60_000))).toBe('há 5 minutos');
    expect(formatRelativeLong('invalid')).toBeNull();
    expect(toDate('')).toBeNull();
  });
});

describe('@/lib/currency', () => {
  it('formats potential values and hides empty ones', () => {
    expect(formatBRL(12000)).toBe(nbsp('R$ 12.000'));
    expect(formatBRL(0)).toBeNull();
    expect(formatBRL(null)).toBeNull();
    expect(formatBRL(Number.NaN)).toBeNull();
  });

  it('formats raw amounts with or without cents', () => {
    expect(formatCurrencyBRL(0)).toBe(nbsp('R$ 0'));
    expect(formatCurrencyBRL(1234.5, { cents: true })).toBe(nbsp('R$ 1.234,50'));
  });
});
