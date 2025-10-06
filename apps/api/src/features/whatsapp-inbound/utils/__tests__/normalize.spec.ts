import { describe, expect, it } from 'vitest';
import { normalizeInboundMessage } from '../normalize';

const baseMessage = {
  id: 'wamid-123',
  key: {
    id: 'key-123',
    remoteJid: '5511999999999@s.whatsapp.net',
  },
  metadata: {
    timestamp: 1700000000,
  },
  messageTimestamp: 1700000001,
};

describe('normalizeInboundMessage', () => {
  it('normalizes simple conversation message', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      conversation: 'Olá, tudo bem?',
    });

    expect(result).toMatchObject({
      id: 'wamid-123',
      clientMessageId: 'key-123',
      conversationId: '5511999999999@s.whatsapp.net',
      type: 'TEXT',
      text: 'Olá, tudo bem?',
      mediaUrl: null,
    });
  });

  it('extracts text from extendedTextMessage payload', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      id: null,
      extendedTextMessage: {
        text: 'Aqui está o link',
        matchedText: 'https://leadengine.io',
      },
    });

    expect(result.text).toBe('Aqui está o link');
    expect(result.id).toMatch(/^wamid-/);
    expect(result.type).toBe('TEXT');
  });

  it('normalizes image message with caption and mimetype', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      imageMessage: {
        caption: 'Comprovante',
        mimetype: 'image/jpeg',
        fileLength: 2048,
        directPath: 'https://example.com/file.jpg',
      },
    });

    expect(result.type).toBe('IMAGE');
    expect(result.caption).toBe('Comprovante');
    expect(result.mediaUrl).toBe('https://example.com/file.jpg');
    expect(result.mimetype).toBe('image/jpeg');
    expect(result.fileSize).toBe(2048);
  });

  it('normalizes location message', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      locationMessage: {
        degreesLatitude: -23.55052,
        degreesLongitude: -46.633308,
        name: 'São Paulo',
      },
    });

    expect(result.type).toBe('LOCATION');
    expect(result.latitude).toBeCloseTo(-23.55052);
    expect(result.longitude).toBeCloseTo(-46.633308);
    expect(result.locationName).toBe('São Paulo');
  });

  it('normalizes contacts array message', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      contactsArrayMessage: [
        {
          displayName: 'Fulano',
          contact: { phoneNumber: '+5511988888888' },
        },
      ],
    });

    expect(result.type).toBe('CONTACT');
    expect(result.contacts).toEqual([
      { name: 'Fulano', phone: '+5511988888888' },
    ]);
  });

  it('normalizes template button reply message', () => {
    const result = normalizeInboundMessage({
      ...baseMessage,
      templateButtonReplyMessage: {
        selectedId: 'confirmar',
        text: 'Confirmar atendimento',
      },
    });

    expect(result.type).toBe('TEMPLATE');
    expect(result.text).toBe('Confirmar atendimento');
    expect(result.buttonPayload).toBe('confirmar');
    expect(result.templatePayload).toEqual({ selectedId: 'confirmar', text: 'Confirmar atendimento' });
  });
});
