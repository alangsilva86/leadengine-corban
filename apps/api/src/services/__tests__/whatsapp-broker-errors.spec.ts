import { describe, expect, it } from 'vitest';
import {
  WhatsAppBrokerError,
  translateWhatsAppBrokerError,
} from '../whatsapp-broker-client';

describe('translateWhatsAppBrokerError', () => {
  it('maps timeout errors to BROKER_TIMEOUT', () => {
    const error = new WhatsAppBrokerError('Request timed out', 'REQUEST_TIMEOUT', 408, 'req-timeout');
    const normalized = translateWhatsAppBrokerError(error);
    expect(normalized).toEqual({
      code: 'BROKER_TIMEOUT',
      message: expect.stringContaining('Tempo limite'),
    });
  });

  it('maps rate limit responses to RATE_LIMITED', () => {
    const error = new WhatsAppBrokerError('Rate limit reached', 'RATE_LIMIT_EXCEEDED', 429);
    const normalized = translateWhatsAppBrokerError(error);
    expect(normalized).toEqual({
      code: 'RATE_LIMITED',
      message: expect.stringContaining('Limite de envio'),
    });
  });

  it('maps disconnected session errors to INSTANCE_NOT_CONNECTED', () => {
    const error = new WhatsAppBrokerError('Session disconnected', 'SESSION_NOT_CONNECTED', 409);
    const normalized = translateWhatsAppBrokerError(error);
    expect(normalized).toEqual({
      code: 'INSTANCE_NOT_CONNECTED',
      message: expect.stringContaining('Instância de WhatsApp desconectada'),
    });
  });

  it('maps invalid recipient errors to INVALID_TO', () => {
    const error = new WhatsAppBrokerError('Invalid recipient number', 'INVALID_RECIPIENT', 400);
    const normalized = translateWhatsAppBrokerError(error);
    expect(normalized).toEqual({
      code: 'INVALID_TO',
      message: expect.stringContaining('Número de destino inválido'),
    });
  });

  it('returns null when error cannot be normalized', () => {
    const error = new WhatsAppBrokerError('Unexpected failure', 'BROKER_ERROR', 500);
    const normalized = translateWhatsAppBrokerError(error);
    expect(normalized).toBeNull();
  });
});
