import { describe, expect, it } from 'vitest';

import { normalizeWhatsAppStatus, WHATSAPP_STATUS } from '@leadengine/wa-status';

import {
  mapBrokerInstanceStatusToDbStatus,
  mapBrokerStatusToDbStatus,
  mapNormalizedStatusToDbStatus,
} from './status-mapper';

describe('whatsapp status mappers', () => {
  it('uses connected flag when broker status is missing', () => {
    const brokerStatus = {
      status: undefined,
      connected: true,
      qr: null,
      qrCode: null,
      qrExpiresAt: null,
      expiresAt: null,
    };

    expect(mapBrokerStatusToDbStatus(brokerStatus)).toBe('connected');
  });

  it('maps QR-required states to connecting', () => {
    expect(mapBrokerInstanceStatusToDbStatus('qr_required')).toBe('connecting');
  });

  it('treats reconnecting as a connecting state for persistence', () => {
    const normalized = normalizeWhatsAppStatus({ status: 'reconnecting', connected: false });
    expect(mapNormalizedStatusToDbStatus(normalized.status)).toBe('connecting');
    expect(mapNormalizedStatusToDbStatus(WHATSAPP_STATUS.CONNECTING)).toBe('connecting');
  });
});
