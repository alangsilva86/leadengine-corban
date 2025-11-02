import { describe, expect, it } from 'vitest';
import { extractQrPayload, getQrImageSrc, isLikelyBaileysPayload } from '../qr.js';

describe('WhatsApp QR helpers', () => {
  it('returns immediate src for data URLs and base64 strings', () => {
    const dataUrl = getQrImageSrc('data:image/png;base64,AAA');
    expect(dataUrl).toMatchObject({ immediate: 'data:image/png;base64,AAA', needsGeneration: false, available: true });

    const base64 = getQrImageSrc('QkFTRTY0U1RSSU5HISE=');
    expect(base64).toMatchObject({ immediate: 'data:image/png;base64,QkFTRTY0U1RSSU5HISE=', needsGeneration: false, available: true });
  });

  it('flags payloads requiring QR generation', () => {
    const baileys = getQrImageSrc('123,456,789,100');
    expect(baileys).toMatchObject({ needsGeneration: true, isBaileys: true, available: true });
  });

  it('propagates availability metadata when QR não está pronto', () => {
    const unavailable = getQrImageSrc({ available: false, reason: 'UNAVAILABLE' });
    expect(unavailable).toMatchObject({ available: false, reason: 'UNAVAILABLE', code: null, needsGeneration: false });
  });

  it('extracts qr payloads from nested structures', () => {
    const payload = {
      qrPayload: {
        qrCode: '123',
        qrExpiresAt: '2024-01-01T00:00:00Z',
        data: { qr: '123' },
      },
    };

    const extracted = extractQrPayload(payload);
    expect(extracted).toMatchObject({ qr: '123', qrCode: '123', expiresAt: '2024-01-01T00:00:00Z' });
  });

  it('detects baileys-like payloads', () => {
    expect(isLikelyBaileysPayload('123,456,789,100')).toBe(true);
    expect(isLikelyBaileysPayload({ qr: 'abc@foo' })).toBe(true);
    expect(isLikelyBaileysPayload(null)).toBe(false);
  });
});
