import { describe, expect, it } from 'vitest';
import {
  extractInstanceFromPayload,
  looksLikeWhatsAppJid,
  resolveInstancePhone,
} from '../../lib/instances';

describe('WhatsApp instance identifier helpers', () => {
  describe('looksLikeWhatsAppJid', () => {
    it('detects strings that resemble WhatsApp JIDs', () => {
      expect(looksLikeWhatsAppJid('5511999999999@s.whatsapp.net')).toBe(true);
      expect(looksLikeWhatsAppJid('5511999999999@S.WHATSAPP.NET')).toBe(true);
    });

    it('rejects non-JID values', () => {
      expect(looksLikeWhatsAppJid('5511999999999@s.whatsapp.com')).toBe(false);
      expect(looksLikeWhatsAppJid(123)).toBe(false);
      expect(looksLikeWhatsAppJid(null)).toBe(false);
    });
  });

  describe('resolveInstancePhone', () => {
    it('prefers explicit phone number fields', () => {
      expect(resolveInstancePhone({ phoneNumber: '+5511999999999' })).toBe('+5511999999999');
      expect(resolveInstancePhone({ number: '+5511888888888' })).toBe('+5511888888888');
      expect(resolveInstancePhone({ metadata: { phoneNumber: '+5511777777777' } })).toBe(
        '+5511777777777'
      );
    });

    it('falls back to broker identifiers and empty string', () => {
      expect(resolveInstancePhone({ metadata: { phone_number: '+5511666666666' } })).toBe(
        '+5511666666666'
      );
      expect(resolveInstancePhone({ jid: '5511555555555@s.whatsapp.net' })).toBe(
        '5511555555555@s.whatsapp.net'
      );
      expect(resolveInstancePhone({})).toBe('');
      expect(resolveInstancePhone(null)).toBe('');
    });
  });

  describe('extractInstanceFromPayload', () => {
    it('extracts instance directly from payload', () => {
      const instance = { id: 'abc', status: 'connected' };
      expect(extractInstanceFromPayload({ instance })).toEqual(instance);
    });

    it('walks nested payloads to find the instance', () => {
      const instance = { id: 'nested-1', status: 'connecting' };
      const payload = { data: { data: { instance } } };
      expect(extractInstanceFromPayload(payload)).toEqual(instance);
    });

    it('returns payloads that look like instances', () => {
      const instance = { id: 'inline-1', status: 'connected' };
      expect(extractInstanceFromPayload(instance)).toEqual(instance);
    });

    it('ignores invalid payload shapes', () => {
      expect(extractInstanceFromPayload(null)).toBeNull();
      expect(extractInstanceFromPayload([])).toBeNull();
      expect(extractInstanceFromPayload('instance')).toBeNull();
      expect(extractInstanceFromPayload({ data: { value: 10 } })).toBeNull();
    });
  });
});
