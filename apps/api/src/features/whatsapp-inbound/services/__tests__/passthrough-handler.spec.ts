import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PassthroughMessage } from '@ticketz/storage';

import { createPassthroughHandler, type PassthroughHandlerHelpers } from '../passthrough-handler';
import type { InboundWhatsAppEvent } from '../inbound-lead-service';
import type { NormalizedInboundMessage } from '../../utils/normalize';

describe('createPassthroughHandler', () => {
  const findOrCreateOpenTicketByChat = vi.fn();
  const upsertMessageByExternalId = vi.fn();
  const emitPassthroughRealtimeUpdates = vi.fn();
  const getSocketServer = vi.fn();
  const socketEmit = vi.fn();
  const socketTo = vi.fn((room: string) => ({
    emit: (event: string, payload: unknown) => socketEmit(room, event, payload),
  }));
  const socket = { to: socketTo };
  const inboundMessagesProcessedCounter = { inc: vi.fn() };
  const logger = { info: vi.fn() };

  let helpers: PassthroughHandlerHelpers;
  let normalizeInboundMessageMock: (message: InboundWhatsAppEvent['message']) => NormalizedInboundMessage;
  let sanitizePhoneMock: (value?: string | null) => string | undefined;
  let sanitizeDocumentMock: (value?: string | null, fallbacks?: Array<string | null | undefined>) => string;
  let resolveDeterministicContactIdentifierMock: PassthroughHandlerHelpers['resolveDeterministicContactIdentifier'];
  let pickPreferredNameMock: PassthroughHandlerHelpers['pickPreferredName'];
  let readStringMock: PassthroughHandlerHelpers['readString'];

  const createHandler = () =>
    createPassthroughHandler({
      defaultTenantId: 'default-tenant',
      findOrCreateOpenTicketByChat,
      upsertMessageByExternalId,
      emitPassthroughRealtimeUpdates,
      getSocketServer,
      inboundMessagesProcessedCounter,
      logger,
      helpers,
    });

  let handler: ReturnType<typeof createPassthroughHandler>;

  beforeEach(() => {
    findOrCreateOpenTicketByChat.mockReset();
    upsertMessageByExternalId.mockReset();
    emitPassthroughRealtimeUpdates.mockReset();
    getSocketServer.mockReset();
    socketEmit.mockReset();
    socketTo.mockReset();
    inboundMessagesProcessedCounter.inc.mockReset();
    logger.info.mockReset();

    normalizeInboundMessageMock = (incoming: InboundWhatsAppEvent['message']) => {
      const rawId = typeof incoming.id === 'string' && incoming.id.trim().length > 0 ? incoming.id.trim() : 'normalized-id';
      const rawType = typeof incoming.type === 'string' ? incoming.type.trim().toUpperCase() : 'TEXT';
      const allowedTypes = new Set<NormalizedInboundMessage['type']>([
        'TEXT',
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'DOCUMENT',
        'LOCATION',
        'CONTACT',
        'TEMPLATE',
      ]);
      const normalizedType = allowedTypes.has(rawType as NormalizedInboundMessage['type'])
        ? (rawType as NormalizedInboundMessage['type'])
        : 'TEXT';
      const text = typeof incoming.text === 'string' ? incoming.text : '';
      return {
        id: rawId,
        clientMessageId: null,
        conversationId: null,
        type: normalizedType,
        text,
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
        raw: {},
        brokerMessageTimestamp: null,
        receivedAt: 0,
      } satisfies NormalizedInboundMessage;
    };

    sanitizePhoneMock = (value?: string | null) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const digits = value.replace(/\D/g, '');
      if (digits.length < 4) {
        return undefined;
      }
      return `+${digits}`;
    };

    sanitizeDocumentMock = (value?: string | null, fallbacks: Array<string | null | undefined> = []) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      for (const fallback of fallbacks) {
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
          return fallback.trim();
        }
      }
      return 'wa-generated';
    };

    resolveDeterministicContactIdentifierMock = ({
      instanceId,
      metadataContact,
    }: Parameters<PassthroughHandlerHelpers['resolveDeterministicContactIdentifier']>[0]) => {
      const contactId = typeof metadataContact.id === 'string' ? metadataContact.id : null;
      const session = typeof metadataContact.sessionId === 'string' ? metadataContact.sessionId : null;
      const deterministicId = contactId && instanceId ? `${instanceId}:${contactId}` : contactId;
      return { deterministicId: deterministicId ?? null, contactId, sessionId: session };
    };

    pickPreferredNameMock = (...values: Array<unknown>) => {
      for (const value of values) {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      }
      return null;
    };

    readStringMock = (value: unknown) => {
      if (typeof value !== 'string') {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    helpers = {
      toRecord: (value: unknown) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { ...(value as Record<string, unknown>) };
        }
        return {};
      },
      normalizeInboundMessage: normalizeInboundMessageMock,
      sanitizePhone: sanitizePhoneMock,
      sanitizeDocument: sanitizeDocumentMock,
      resolveDeterministicContactIdentifier: resolveDeterministicContactIdentifierMock,
      pickPreferredName: pickPreferredNameMock,
      readString: readStringMock,
    };

    socketTo.mockImplementation((room: string) => ({ emit: (event: string, payload: unknown) => socketEmit(room, event, payload) }));
    getSocketServer.mockReturnValue(socket);

    handler = createHandler();
  });

  it('reuses deterministic identifiers when phone and document are missing', async () => {
    const baseEvent: InboundWhatsAppEvent = {
      id: 'event-deterministic-1',
      instanceId: 'instance-deterministic',
      direction: 'INBOUND',
      chatId: null,
      externalId: null,
      timestamp: null,
      contact: { name: 'Contato Sem Telefone', phone: null, document: null },
      message: { id: 'message-1', type: 'TEXT', text: 'Olá!' },
      metadata: { contact: { id: 'contact-metadata-1' }, sessionId: 'session-metadata-1' },
      tenantId: 'tenant-deterministic',
      sessionId: null,
    };

    findOrCreateOpenTicketByChat
      .mockResolvedValueOnce({ ticket: { id: 'ticket-1' }, wasCreated: true })
      .mockResolvedValueOnce({ ticket: { id: 'ticket-1' }, wasCreated: false });

    upsertMessageByExternalId
      .mockResolvedValueOnce({ message: { id: 'stored-message-1' } as PassthroughMessage, wasCreated: true })
      .mockResolvedValueOnce({ message: { id: 'stored-message-2' } as PassthroughMessage, wasCreated: false });

    await handler(baseEvent);
    await handler({
      ...baseEvent,
      id: 'event-deterministic-2',
      message: { ...baseEvent.message, id: 'message-2', text: 'Olá novamente!' },
    });

    expect(findOrCreateOpenTicketByChat).toHaveBeenCalledTimes(2);
    const firstCallArgs = findOrCreateOpenTicketByChat.mock.calls[0][0];
    const secondCallArgs = findOrCreateOpenTicketByChat.mock.calls[1][0];

    expect(firstCallArgs.chatId).toBe('instance-deterministic:contact-metadata-1');
    expect(firstCallArgs.phone).toBe('instance-deterministic:contact-metadata-1');
    expect(secondCallArgs.chatId).toBe(firstCallArgs.chatId);
    expect(secondCallArgs.phone).toBe(firstCallArgs.phone);

    expect(upsertMessageByExternalId).toHaveBeenCalledTimes(2);
    expect(upsertMessageByExternalId.mock.calls[0][0]).toMatchObject({
      chatId: 'instance-deterministic:contact-metadata-1',
      externalId: 'message-1',
      direction: 'inbound',
      type: 'text',
    });
    expect(upsertMessageByExternalId.mock.calls[1][0]).toMatchObject({
      chatId: 'instance-deterministic:contact-metadata-1',
      externalId: 'message-2',
    });

    expect(socketEmit).toHaveBeenCalledWith(
      'tenant:tenant-deterministic',
      'messages.new',
      expect.objectContaining({ id: 'stored-message-1' })
    );
    expect(socketEmit).toHaveBeenCalledWith(
      'ticket:ticket-1',
      'messages.new',
      expect.objectContaining({ id: 'stored-message-1' })
    );

    expect(emitPassthroughRealtimeUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-deterministic',
        ticketId: 'ticket-1',
        instanceId: 'instance-deterministic',
      })
    );

    expect(inboundMessagesProcessedCounter.inc).toHaveBeenCalledTimes(2);
    expect(inboundMessagesProcessedCounter.inc).toHaveBeenCalledWith({
      origin: 'passthrough',
      tenantId: 'tenant-deterministic',
      instanceId: 'instance-deterministic',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'passthrough: persisted + emitted messages.new',
      expect.objectContaining({ tenantId: 'tenant-deterministic', ticketId: 'ticket-1' })
    );
  });

  it('falls back to default tenant id when missing and emits socket updates', async () => {
    const event: InboundWhatsAppEvent = {
      id: 'event-default-tenant',
      instanceId: 'instance-2',
      direction: 'INBOUND',
      chatId: null,
      externalId: 'external-2',
      timestamp: '2024-01-01T12:00:00.000Z',
      contact: { name: 'Cliente WhatsApp', phone: '+5511988887777', document: '1234' },
      message: { id: 'message-2', type: 'TEXT', text: 'Olá!' },
      metadata: {},
      tenantId: null,
      sessionId: null,
    };

    findOrCreateOpenTicketByChat.mockResolvedValueOnce({ ticket: { id: 'ticket-default' }, wasCreated: true });
    upsertMessageByExternalId.mockResolvedValueOnce({
      message: { id: 'stored-message-default' } as PassthroughMessage,
      wasCreated: true,
    });

    await handler(event);

    expect(findOrCreateOpenTicketByChat).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'default-tenant', instanceId: 'instance-2' })
    );
    expect(upsertMessageByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'default-tenant',
        direction: 'inbound',
        metadata: expect.objectContaining({
          tenantId: 'default-tenant',
          phoneE164: '+5511988887777',
        }),
      })
    );

    expect(socketEmit).toHaveBeenCalledWith(
      'tenant:default-tenant',
      'messages.new',
      expect.objectContaining({ id: 'stored-message-default' })
    );
    expect(socketEmit).toHaveBeenCalledWith(
      'ticket:ticket-default',
      'messages.new',
      expect.objectContaining({ id: 'stored-message-default' })
    );

    expect(emitPassthroughRealtimeUpdates).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'default-tenant', ticketId: 'ticket-default', instanceId: 'instance-2' })
    );
    expect(inboundMessagesProcessedCounter.inc).toHaveBeenCalledWith({
      origin: 'passthrough',
      tenantId: 'default-tenant',
      instanceId: 'instance-2',
    });
  });
});

