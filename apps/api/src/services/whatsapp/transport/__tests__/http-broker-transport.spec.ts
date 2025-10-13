import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';

const sendMessageMock = vi.fn();
const checkRecipientMock = vi.fn();
const getStatusMock = vi.fn();

vi.mock('../../../whatsapp-broker-client', async () => {
  const actual = await vi.importActual<typeof import('../../../whatsapp-broker-client')>(
    '../../../whatsapp-broker-client'
  );

  return {
    ...actual,
    whatsappBrokerClient: {
      sendMessage: sendMessageMock,
      checkRecipient: checkRecipientMock,
      getStatus: getStatusMock,
    },
  };
});

describe('HttpBrokerTransport', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
    checkRecipientMock.mockReset();
    getStatusMock.mockReset();
  });

  it('delegates text sends to the broker client and normalizes the response', async () => {
    const { HttpBrokerTransport } = await import('../http-broker-transport');
    sendMessageMock.mockResolvedValue({
      externalId: 'msg-1',
      status: 'DELIVERED',
      timestamp: '2024-01-01T00:00:00.000Z',
      raw: { foo: 'bar' },
    });

    const transport = new HttpBrokerTransport();
    const result = await transport.sendText({
      sessionId: 'inst-1',
      to: '+5511999999999',
      message: 'Hello',
      previewUrl: false,
      externalId: 'local-1',
    });

    expect(sendMessageMock).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        to: '+5511999999999',
        type: 'text',
        content: 'Hello',
      }),
      undefined
    );
    expect(result).toEqual({
      externalId: 'msg-1',
      status: 'DELIVERED',
      timestamp: '2024-01-01T00:00:00.000Z',
      raw: { foo: 'bar' },
      transport: 'http',
    });
  });

  it('normalizes recipient checks into a canonical structure', async () => {
    const { HttpBrokerTransport } = await import('../http-broker-transport');
    checkRecipientMock.mockResolvedValue({ exists: true, canReceive: false, reason: 'Opt-out' });

    const transport = new HttpBrokerTransport();
    const result = await transport.checkRecipient({ sessionId: 'inst-1', to: '+5511988877766' });

    expect(checkRecipientMock).toHaveBeenCalledWith({
      sessionId: 'inst-1',
      instanceId: undefined,
      to: '+5511988877766',
    });
    expect(result).toEqual({
      exists: true,
      canReceive: true,
      reason: 'Opt-out',
      raw: { exists: true, canReceive: false, reason: 'Opt-out' },
    });
  });

  it('wraps broker errors into transport errors with canonical metadata', async () => {
    const { HttpBrokerTransport } = await import('../http-broker-transport');
    const { WhatsAppBrokerError } = await vi.importActual<typeof import('../../../whatsapp-broker-client')>(
      '../../../whatsapp-broker-client'
    );

    sendMessageMock.mockRejectedValue(
      new WhatsAppBrokerError('Too many requests', {
        code: 'RATE_LIMITED',
        brokerStatus: 429,
        requestId: 'req-1',
      })
    );

    const transport = new HttpBrokerTransport();

    await expect(
      transport.sendText({ sessionId: 'inst-1', to: '+5511999999999', message: 'Hello' })
    ).rejects.toBeInstanceOf(WhatsAppTransportError);

    try {
      await transport.sendText({ sessionId: 'inst-1', to: '+5511999999999', message: 'Hello' });
    } catch (error) {
      if (!(error instanceof WhatsAppTransportError)) {
        throw error;
      }

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.transport).toBe('http');
      expect(error.requestId).toBe('req-1');
      expect(error.canonical?.code).toBe('RATE_LIMITED');
    }
  });
});
