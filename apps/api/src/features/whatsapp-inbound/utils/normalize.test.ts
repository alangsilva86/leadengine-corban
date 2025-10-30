import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { normalizeInboundMessage } from './normalize';

describe('normalizeInboundMessage', () => {
  const fixedNow = 1_700_000_000_000;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes plain conversation text', () => {
    const message = {
      id: 'wamid-text',
      conversation: '  Hello world  ',
      key: {
        id: 'client-123',
        remoteJid: '5511999999999@s.whatsapp.net',
      },
      messageTimestamp: 1_699_999_999,
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized).toMatchObject({
      id: 'wamid-text',
      clientMessageId: 'client-123',
      conversationId: '5511999999999@s.whatsapp.net',
      type: 'TEXT',
      text: 'Hello world',
      caption: null,
      mediaUrl: null,
      mimetype: null,
      fileSize: null,
      latitude: null,
      longitude: null,
      locationName: null,
      contacts: null,
      buttonPayload: null,
      templatePayload: null,
      brokerMessageTimestamp: 1_699_999_999,
      receivedAt: fixedNow,
    });
    expect(normalized.raw).toEqual(message);
  });

  it('extracts text from extendedTextMessage when conversation is missing', () => {
    const message = {
      id: null,
      extendedTextMessage: {
        text: 'Extended payload message',
      },
      key: {
        id: 'client-456',
        remoteJid: '5511888888888@s.whatsapp.net',
      },
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized.text).toBe('Extended payload message');
    expect(normalized.type).toBe('TEXT');
    expect(normalized.id).toMatch(/^wamid-/);
    expect(normalized.caption).toBeNull();
    expect(normalized.receivedAt).toBe(fixedNow);
  });

  it('normalizes image media with caption and metadata info', () => {
    const message = {
      id: 'wamid-image',
      imageMessage: {
        mimetype: 'image/jpeg',
        fileLength: 204800,
        caption: 'Check this out',
        url: 'https://example.com/path/image.jpg',
      },
      metadata: {
        directPath: 'https://example.com/path/image.jpg',
      },
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized.type).toBe('IMAGE');
    expect(normalized.text).toBe('[Mensagem recebida via WhatsApp]');
    expect(normalized.caption).toBe('Check this out');
    expect(normalized.mediaUrl).toBe('https://example.com/path/image.jpg');
    expect(normalized.mimetype).toBe('image/jpeg');
    expect(normalized.fileSize).toBe(204800);
    expect(normalized.receivedAt).toBe(fixedNow);
  });

  it('normalizes template/button replies capturing payload details', () => {
    const message = {
      id: 'wamid-template',
      buttonsResponseMessage: {
        selectedButtonId: 'btn-123',
        text: 'Option text',
      },
      messageTimestamp: 1_699_000_000,
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized.type).toBe('TEMPLATE');
    expect(normalized.text).toBe('Option text');
    expect(normalized.buttonPayload).toBe('btn-123');
    expect(normalized.templatePayload).toEqual({
      selectedButtonId: 'btn-123',
      text: 'Option text',
    });
    expect(normalized.brokerMessageTimestamp).toBe(1_699_000_000);
  });

  it('normalizes location payloads', () => {
    const message = {
      id: 'wamid-location',
      locationMessage: {
        degreesLatitude: -23.55052,
        degreesLongitude: -46.633308,
        name: 'Sao Paulo',
      },
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized.type).toBe('LOCATION');
    expect(normalized.latitude).toBeCloseTo(-23.55052);
    expect(normalized.longitude).toBeCloseTo(-46.633308);
    expect(normalized.locationName).toBe('Sao Paulo');
  });

  it('normalizes contacts array payloads', () => {
    const message = {
      id: 'wamid-contacts',
      contactsArrayMessage: [
        {
          displayName: 'Alice',
          vcard: {
            name: 'Alice Example',
            phoneNumber: '+5511999999999',
          },
        },
        {
          displayName: '  ',
          contact: {
            name: 'Bob',
            phoneNumber: '5511888888888',
          },
        },
      ],
    } as Record<string, unknown>;

    const normalized = normalizeInboundMessage(message);

    expect(normalized.type).toBe('CONTACT');
    expect(normalized.contacts).toEqual([
      { name: 'Alice', phone: '+5511999999999' },
      { name: 'Bob', phone: '5511888888888' },
    ]);
  });
});
