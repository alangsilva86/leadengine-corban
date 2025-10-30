import { describe, expect, it } from 'vitest';

import { normalizeUpsertEvent } from '../baileys-raw-normalizer';

const buildBaseEvent = () => ({
  event: 'WHATSAPP_MESSAGES_UPSERT',
  iid: 'instance-1',
  payload: {
    instanceId: 'instance-1',
    tenantId: 'tenant-42',
    sessionId: 'session-9',
    owner: 'server',
    source: 'unit-test',
    timestamp: 1_700_000_000,
    messages: [] as Array<Record<string, unknown>>,
  },
});

describe('normalizeUpsertEvent', () => {
  it('normalizes a simple text message', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-1',
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Maria',
      messageTimestamp: 1_700_000_001,
      message: {
        conversation: 'Olá!',
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    expect(result.ignored).toHaveLength(0);

    const [normalized] = result.normalized;
    expect(normalized.messageType).toBe('text');
    expect(normalized.messageUpsertType).toBeNull();
    expect(normalized.data.instanceId).toBe('instance-1');

    const from = normalized.data.from as Record<string, unknown>;
    expect(from.phone).toBe('5511999999999');
    expect(from.pushName).toBe('Maria');

    const message = normalized.data.message as Record<string, unknown>;
    expect(message.text).toBe('Olá!');
    expect(message.conversation).toBe('Olá!');

    const metadata = normalized.data.metadata as Record<string, unknown>;
    expect((metadata.broker as Record<string, unknown>).messageType).toBe('text');
    expect(metadata.source).toBe('raw_normalized');
    expect((metadata.contact as Record<string, unknown>).isGroup).toBe(false);
  });

  it('captures payload upsert type for notify events', () => {
    const event = buildBaseEvent();
    (event.payload as Record<string, unknown>).type = 'notify';
    event.payload.messages.push({
      key: {
        id: 'wamid-notify',
        remoteJid: '5511888777766@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Notify',
      messageTimestamp: 1_700_000_002,
      message: {
        conversation: 'Evento notify',
      },
    });

    const result = normalizeUpsertEvent(event);
    expect(result.normalized).toHaveLength(1);

    const [normalized] = result.normalized;
    expect(normalized.messageUpsertType).toBe('notify');
    expect(normalized.messageType).toBe('text');
  });

  it('captures raw envelope upsert type for append events', () => {
    const event = buildBaseEvent();
    event.payload.messages = [];

    (event.payload as Record<string, unknown>).raw = {
      type: 'append',
      messages: [
        {
          key: {
            id: 'wamid-append',
            remoteJid: '5511991112222@s.whatsapp.net',
            fromMe: false,
          },
          pushName: 'Append',
          messageTimestamp: 1_700_000_003,
          message: {
            conversation: 'Evento append',
          },
        },
      ],
    } satisfies Record<string, unknown>;

    const result = normalizeUpsertEvent(event);
    expect(result.normalized).toHaveLength(1);

    const [normalized] = result.normalized;
    expect(normalized.messageUpsertType).toBe('append');
    expect(normalized.messageType).toBe('text');
  });

  it('normalizes messages present only in the raw envelope', () => {
    const event = buildBaseEvent();
    event.payload.messages = [];
    delete (event.payload as Record<string, unknown>).owner;
    delete (event.payload as Record<string, unknown>).source;
    delete (event.payload as Record<string, unknown>).timestamp;

    const fallbackTimestamp = 1_700_000_555;

    (event.payload as Record<string, unknown>).raw = {
      owner: 'raw-owner',
      source: 'raw-source',
      timestamp: fallbackTimestamp,
      messages: [
        {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: false,
          },
          pushName: 'Rafa',
          message: {
            conversation: 'Fallback mágico',
          },
        },
      ],
    };

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;
    expect(normalized.messageType).toBe('text');
    expect(normalized.messageUpsertType).toBeNull();

    const message = normalized.data.message as Record<string, unknown>;
    expect(message.text).toBe('Fallback mágico');
    expect(message.conversation).toBe('Fallback mágico');
    expect(message.messageTimestamp).toBe(fallbackTimestamp);

    const metadata = normalized.data.metadata as Record<string, unknown>;
    const broker = metadata.broker as Record<string, unknown>;
    expect(broker.owner).toBe('raw-owner');
    expect(broker.source).toBe('raw-source');
    expect(broker.messageTimestamp).toBe(fallbackTimestamp);

    const isoFallback = new Date(fallbackTimestamp * 1000).toISOString();
    expect(normalized.data.timestamp).toBe(isoFallback);
  });

  it('keeps media attributes for image messages', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-2',
        remoteJid: '5511888888888@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'João',
      messageTimestamp: 1_700_000_100,
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          fileLength: '2048',
          fileName: 'photo.jpg',
          caption: 'Comprovante',
        },
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;
    expect(normalized.messageType).toBe('image');

    const message = normalized.data.message as Record<string, unknown>;
    const imageMessage = message.imageMessage as Record<string, unknown>;
    expect(imageMessage.mimetype).toBe('image/jpeg');
    expect(imageMessage.fileLength).toBe(2048);
    expect(imageMessage.fileName).toBe('photo.jpg');
    expect(message.caption).toBe('Comprovante');

    const metadata = normalized.data.metadata as Record<string, unknown>;
    expect((metadata.broker as Record<string, unknown>).messageType).toBe('image');
  });

  it('marks group messages and preserves participant identifiers', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-3',
        remoteJid: '120363025276989203@g.us',
        participant: '5511555777788@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Silvia',
      messageTimestamp: 1_700_000_200,
      message: {
        extendedTextMessage: {
          text: 'Mensagem em grupo',
        },
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;

    const from = normalized.data.from as Record<string, unknown>;
    expect(from.phone).toBe('5511555777788');

    const metadata = normalized.data.metadata as Record<string, unknown>;
    const contact = metadata.contact as Record<string, unknown>;
    expect(contact.isGroup).toBe(true);
    expect(contact.participantJid).toBe('5511555777788@s.whatsapp.net');
    expect(contact.jid).toBe('120363025276989203@g.us');
  });

  it('captures interactive payload for buttons responses', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-4',
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Marcos',
      messageTimestamp: 1_700_000_300,
      message: {
        buttonsResponseMessage: {
          selectedButtonId: 'btn-1',
          selectedDisplayText: 'Confirmar',
          title: 'Confirmar',
        },
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;
    expect(normalized.messageType).toBe('buttons_response');

    const message = normalized.data.message as Record<string, unknown>;
    const buttons = message.buttonsResponseMessage as Record<string, unknown>;
    expect(buttons.selectedButtonId).toBe('btn-1');
    expect(message.text).toBe('Confirmar');

    const metadata = normalized.data.metadata as Record<string, unknown>;
    const interactive = metadata.interactive as Record<string, unknown>;
    expect(interactive.type).toBe('buttons_response');
  });

  it('returns poll choice metadata when vote message is received', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-5',
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: false,
      },
      messageTimestamp: 1_700_000_400,
      message: {
        pollUpdateMessage: {
          pollCreationMessageId: 'poll-1',
          vote: {
            values: [1, 3],
          },
        },
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;
    expect(normalized.messageType).toBe('poll_choice');

    const message = normalized.data.message as Record<string, unknown>;
    const pollUpdate = message.pollUpdateMessage as Record<string, unknown>;
    expect(pollUpdate.pollCreationMessageId).toBe('poll-1');
    expect(Array.isArray((pollUpdate.vote as Record<string, unknown>).values)).toBe(true);

    const metadata = normalized.data.metadata as Record<string, unknown>;
    const interactive = (metadata.interactive ?? {}) as Record<string, unknown>;
    expect(interactive.type).toBe('poll_choice');
  });

  it('overrides instance, tenant and broker identifiers when provided', () => {
    const event = buildBaseEvent();
    delete (event.payload as Record<string, unknown>).tenantId;
    delete (event.payload as Record<string, unknown>).sessionId;
    event.payload.messages.push({
      key: {
        id: 'wamid-override',
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: false,
      },
      messageTimestamp: 1_700_000_600,
      message: {
        conversation: 'Mensagem override',
      },
    });

    const result = normalizeUpsertEvent(event, {
      instanceId: 'instance-alias',
      tenantId: 'tenant-override',
      brokerId: 'broker-uuid-1',
    });

    expect(result.normalized).toHaveLength(1);
    const [normalized] = result.normalized;
    expect(normalized.data.instanceId).toBe('instance-alias');
    expect(normalized.tenantId).toBe('tenant-override');
    expect(normalized.sessionId).toBe('broker-uuid-1');
    expect(normalized.brokerId).toBe('broker-uuid-1');

    const metadata = normalized.data.metadata as Record<string, unknown>;
    const brokerMeta = metadata.broker as Record<string, unknown>;
    expect(brokerMeta.instanceId).toBe('instance-alias');
    expect(brokerMeta.sessionId).toBe('broker-uuid-1');
    expect(brokerMeta.brokerId).toBe('broker-uuid-1');
  });

  it('ignores messages sent from the instance itself', () => {
    const event = buildBaseEvent();
    event.payload.messages.push({
      key: {
        id: 'wamid-ignored',
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: true,
      },
      messageTimestamp: 1_700_000_500,
      message: {
        conversation: 'Mensagem própria',
      },
    });

    const result = normalizeUpsertEvent(event);

    expect(result.normalized).toHaveLength(0);
    expect(result.ignored).toHaveLength(1);
    expect(result.ignored[0].reason).toBe('from_me');
  });
});
