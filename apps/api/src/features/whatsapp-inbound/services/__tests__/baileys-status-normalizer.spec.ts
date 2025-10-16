import { describe, expect, it } from 'vitest';

import { normalizeBaileysMessageStatus } from '../baileys-status-normalizer';

describe('normalizeBaileysMessageStatus', () => {
  it('maps numeric statuses to message status', () => {
    expect(normalizeBaileysMessageStatus(0)).toBe('PENDING');
    expect(normalizeBaileysMessageStatus(1)).toBe('SENT');
    expect(normalizeBaileysMessageStatus(2)).toBe('DELIVERED');
    expect(normalizeBaileysMessageStatus(3)).toBe('READ');
    expect(normalizeBaileysMessageStatus(4)).toBe('READ');
  });

  it('handles bigint and string representations', () => {
    expect(normalizeBaileysMessageStatus(BigInt(2))).toBe('DELIVERED');
    expect(normalizeBaileysMessageStatus('3')).toBe('READ');
    expect(normalizeBaileysMessageStatus(' delivered ')).toBe('DELIVERED');
  });

  it('defaults to SENT for unknown values', () => {
    expect(normalizeBaileysMessageStatus('unknown')).toBe('SENT');
    expect(normalizeBaileysMessageStatus(null)).toBe('SENT');
    expect(normalizeBaileysMessageStatus(undefined)).toBe('SENT');
    expect(normalizeBaileysMessageStatus(99)).toBe('SENT');
    expect(normalizeBaileysMessageStatus(-1)).toBe('PENDING');
  });
});
