import { describe, expect, it } from 'vitest';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';

import { normalizeSendError } from '../send-errors';
import { WhatsAppBrokerError, WhatsAppBrokerNotConfiguredError } from '../../../services/whatsapp-broker-client';

// Códigos que o web usa para cópia/nova tentativa/"Reconectar" (apps/web/src/features/whatsapp/utils/whatsapp-error-codes.js).
describe('normalizeSendError', () => {
  it.each([
    ['REQUEST_TIMEOUT', 408, 'BROKER_TIMEOUT', 408],
    ['GATEWAY_TIMEOUT', undefined, 'BROKER_TIMEOUT', 504],
    ['SESSION_NOT_CONNECTED', 409, 'INSTANCE_NOT_CONNECTED', 409],
    ['SESSION_NOT_FOUND', undefined, 'INSTANCE_NOT_CONNECTED', 409],
    ['RATE_LIMIT_EXCEEDED', 429, 'RATE_LIMITED', 429],
    ['INVALID_RECIPIENT', 400, 'INVALID_TO', 400],
    ['INVALID_JID', undefined, 'INVALID_TO', 422],
    ['MESSAGE_REJECTED', 500, 'BROKER_ERROR', 500],
    ['BROKER_AUTH', 401, 'BROKER_ERROR', 502],
  ] as const)('maps broker %s (%s) to %s / HTTP %s keeping the raw code', (rawCode, brokerStatus, code, status) => {
    const error = new WhatsAppBrokerError('broker failure', { code: rawCode, brokerStatus, requestId: 'req-1' });

    expect(normalizeSendError(error)).toEqual({
      status,
      code,
      message: expect.any(String),
      brokerCode: rawCode,
      brokerStatus: brokerStatus ?? null,
      requestId: 'req-1',
    });
  });

  it('maps a missing broker configuration to BROKER_NOT_CONFIGURED (503)', () => {
    expect(normalizeSendError(new WhatsAppBrokerNotConfiguredError())).toMatchObject({
      status: 503,
      code: 'BROKER_NOT_CONFIGURED',
      brokerCode: null,
    });
  });

  it('normalizes raw transport codes that the canonical table does not know', () => {
    const error = new WhatsAppTransportError('session closed', { code: 'SESSION_DISCONNECTED', status: 410 });

    expect(normalizeSendError(error)).toMatchObject({
      status: 410,
      code: 'INSTANCE_NOT_CONNECTED',
      brokerCode: 'SESSION_DISCONNECTED',
    });
    expect(
      normalizeSendError(new WhatsAppTransportError('no transport', { code: 'TRANSPORT_NOT_CONFIGURED' }))
    ).toMatchObject({ status: 503, code: 'BROKER_NOT_CONFIGURED' });
  });

  it('ignores errors that do not come from the broker', () => {
    expect(normalizeSendError(new Error('boom'))).toBeNull();
    expect(normalizeSendError(null)).toBeNull();
  });
});
