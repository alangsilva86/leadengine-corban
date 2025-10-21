import { describe, it, expect } from 'vitest';

import {
  BrokerInboundEventSchema,
  BrokerOutboundMessageSchema,
  BrokerOutboundResponseSchema,
  BrokerWebhookInboundSchema,
} from '../broker-contracts';

describe('broker-contracts', () => {
  it('parses webhook inbound payloads and normalizes timestamp', () => {
    const result = BrokerWebhookInboundSchema.parse({
      event: 'message',
      direction: 'inbound',
      instanceId: 'instance-123',
      timestamp: 1_700_000_000,
      from: {
        phone: '+5511999999999',
      },
      message: {
        id: 'wamid-123',
        conversation: 'Hello there',
      },
      metadata: {},
    });

    expect(result.instanceId).toBe('instance-123');
    expect(result.timestamp).toMatch(/^2023/);
    expect(result.message).toHaveProperty('conversation', 'Hello there');
    expect(result.direction).toBe('inbound');
  });

  it('validates inbound broker queue events', () => {
    const parsed = BrokerInboundEventSchema.parse({
      id: 'event-1',
      type: 'MESSAGE_INBOUND',
      instanceId: 'instance-123',
      timestamp: '2024-04-30T12:00:00.000Z',
      payload: {
        instanceId: 'instance-123',
        timestamp: '2024-04-30T12:00:00.000Z',
        direction: 'inbound',
        contact: {
          phone: '+5511999999999',
          registrations: ['ABC123'],
        },
        message: {
          conversation: 'Ping',
        },
        metadata: {},
      },
    });

    expect(parsed.payload.contact.registrations).toEqual(['ABC123']);
    expect(parsed.timestamp).toBe('2024-04-30T12:00:00.000Z');
    expect(parsed.payload.direction).toBe('INBOUND');
    expect(parsed.type).toBe('MESSAGE_INBOUND');
  });

  it('accepts inbound broker queue events using the event field when type is missing', () => {
    const parsed = BrokerInboundEventSchema.parse({
      id: 'event-2',
      event: 'MESSAGE_OUTBOUND',
      instanceId: 'instance-321',
      timestamp: '2024-05-01T12:00:00.000Z',
      payload: {
        instanceId: 'instance-321',
        timestamp: '2024-05-01T12:00:00.000Z',
        direction: 'outbound',
        contact: {},
        message: { id: 'wamid-123' },
        metadata: {},
      },
    });

    expect(parsed.type).toBe('MESSAGE_OUTBOUND');
    expect(parsed.payload.direction).toBe('OUTBOUND');
    expect(parsed.timestamp).toBe('2024-05-01T12:00:00.000Z');
  });

  it('enforces outbound message contract', () => {
    const parsedMessage = BrokerOutboundMessageSchema.parse({
      sessionId: 'instance-123',
      to: '5511999999999',
      content: 'Mensagem',
    });

    expect(parsedMessage.type).toBe('text');

    const parsedResponse = BrokerOutboundResponseSchema.parse({
      externalId: 'external-1',
      status: 'sent',
    });

    expect(parsedResponse).toEqual({
      externalId: 'external-1',
      status: 'sent',
      timestamp: null,
      raw: null,
    });
  });
});
