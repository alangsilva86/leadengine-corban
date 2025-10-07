import { describe, expect, it } from 'vitest';

describe('legacy WhatsApp webhook normalisation', () => {
  it('extracts inbound messages from WHATSAPP_MESSAGES_UPSERT payloads', async () => {
    const module = await import('../webhook-routes');
    const { normalizeLegacyMessagesUpsert, buildInboundEvent } = module.__testing;

    const now = Math.trunc(Date.now() / 1000);
    const entry = {
      event: 'WHATSAPP_MESSAGES_UPSERT',
      instanceId: '041teste',
      payload: {
        iid: '041teste',
        type: 'notify',
        messages: [
          {
            key: {
              id: 'wamid-123',
              remoteJid: '5544998539056@s.whatsapp.net',
              fromMe: false,
            },
            messageTimestamp: now,
            pushName: 'Contato QA',
            message: {
              conversation: 'Oi! (simulado via webhook)',
            },
          },
        ],
      },
    } as Record<string, unknown>;

    const normalized = normalizeLegacyMessagesUpsert(entry, { index: 0 });
    expect(normalized).toHaveLength(1);

    const candidate = normalized[0];
    const event = buildInboundEvent(candidate.data, {
      index: 0,
      origin: 'legacy',
      messageIndex: candidate.messageIndex,
    });

    expect(event.instanceId).toBe('041teste');
    expect(event.payload.contact.phone).toBe('5544998539056');
    expect(event.payload.contact.name).toBe('Contato QA');
    expect(event.payload.message).toHaveProperty('conversation', 'Oi! (simulado via webhook)');
    expect(event.payload.metadata).toMatchObject({
      legacyEvent: 'WHATSAPP_MESSAGES_UPSERT',
      remoteJid: '5544998539056@s.whatsapp.net',
      messageIndex: 0,
    });
    expect(event.timestamp).toMatch(/T/);
  });

  it('ignores outbound entries from legacy payloads', async () => {
    const module = await import('../webhook-routes');
    const { normalizeLegacyMessagesUpsert } = module.__testing;

    const entry = {
      event: 'WHATSAPP_MESSAGES_UPSERT',
      instanceId: '041teste',
      payload: {
        iid: '041teste',
        type: 'notify',
        messages: [
          {
            key: {
              id: 'wamid-999',
              remoteJid: '554123456789:12@s.whatsapp.net',
              fromMe: true,
            },
            messageTimestamp: Math.trunc(Date.now() / 1000),
            pushName: 'Operador',
            message: {
              conversation: 'Mensagem enviada',
            },
          },
        ],
      },
    } as Record<string, unknown>;

    const normalized = normalizeLegacyMessagesUpsert(entry, { index: 1 });
    expect(normalized).toHaveLength(0);
  });
});
