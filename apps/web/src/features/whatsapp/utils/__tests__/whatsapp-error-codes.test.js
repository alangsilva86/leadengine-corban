import { describe, expect, it } from 'vitest';
import {
  getAllWhatsAppErrorCodes,
  isNormalizedWhatsAppError,
  normalizeWhatsAppErrorCode,
  resolveWhatsAppErrorCopy,
} from '../whatsapp-error-codes.js';

describe('WhatsApp error copy helpers', () => {
  it('exposes all normalized codes', () => {
    const codes = getAllWhatsAppErrorCodes();
    expect(codes).toContain('INSTANCE_NOT_CONNECTED');
    expect(codes).toContain('INVALID_TO');
    expect(codes).toContain('RATE_LIMITED');
    expect(codes).toContain('BROKER_TIMEOUT');
    expect(codes).toContain('BROKER_NOT_CONFIGURED');
  });

  it('normalizes codes regardless of casing and spacing', () => {
    expect(normalizeWhatsAppErrorCode(' rate_limited ')).toBe('RATE_LIMITED');
    expect(normalizeWhatsAppErrorCode('')).toBeNull();
    expect(normalizeWhatsAppErrorCode(null)).toBeNull();
  });

  it('identifies supported codes', () => {
    expect(isNormalizedWhatsAppError('instance_not_connected')).toBe(true);
    expect(isNormalizedWhatsAppError('unknown_code')).toBe(false);
  });

  it('returns friendly copy for supported codes', () => {
    const copy = resolveWhatsAppErrorCopy('invalid_to');
    expect(copy).toMatchObject({
      code: 'INVALID_TO',
      title: expect.stringContaining('Número de destino'),
      description: expect.stringContaining('Revise o número informado'),
    });
  });

  it('guides agents when the broker is not configured', () => {
    const copy = resolveWhatsAppErrorCopy('broker_not_configured');
    expect(copy).toMatchObject({
      code: 'BROKER_NOT_CONFIGURED',
      title: expect.stringContaining('não configurado'),
      description: expect.stringContaining('Conecte uma instância'),
    });
  });

  it('falls back to provided message when code is unknown', () => {
    const fallback = 'Mensagem original';
    const copy = resolveWhatsAppErrorCopy('something_else', fallback);
    expect(copy).toMatchObject({
      code: 'SOMETHING_ELSE',
      title: null,
      description: fallback,
    });
  });
});
