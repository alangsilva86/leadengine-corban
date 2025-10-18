import { randomUUID } from 'node:crypto';
import type { PassthroughMessage } from '@ticketz/storage';
import type { NormalizedInboundMessage } from '../../utils/normalize';
import type { InboundWhatsAppEvent } from './inbound-lead-service';

interface SocketRoomEmitter {
  emit(event: string, payload: unknown): void;
}

interface SocketServerLike {
  to(room: string): SocketRoomEmitter;
}

export interface PassthroughHandlerHelpers {
  toRecord(value: unknown): Record<string, unknown>;
  normalizeInboundMessage(message: InboundWhatsAppEvent['message']): NormalizedInboundMessage;
  sanitizePhone(value?: string | null): string | undefined;
  sanitizeDocument(value?: string | null, fallbacks?: Array<string | null | undefined>): string;
  resolveDeterministicContactIdentifier(args: {
    instanceId?: string | null;
    metadataRecord: Record<string, unknown>;
    metadataContact: Record<string, unknown>;
    sessionId?: string | null;
    externalId?: string | null;
  }): { deterministicId: string | null; contactId: string | null; sessionId: string | null };
  pickPreferredName(...values: Array<unknown>): string | null;
  readString(value: unknown): string | null;
}

export interface PassthroughHandlerDeps {
  defaultTenantId: string;
  findOrCreateOpenTicketByChat: (args: {
    tenantId: string;
    chatId: string;
    displayName: string;
    phone: string;
    instanceId: string | null;
  }) => Promise<{ ticket: { id: string }; wasCreated: boolean }>;
  upsertMessageByExternalId: (input: {
    tenantId: string;
    ticketId: string;
    chatId: string;
    direction: 'inbound' | 'outbound';
    externalId: string;
    type: 'text' | 'media' | 'unknown';
    text: string | null;
    media: {
      mediaType: string;
      url?: string | null;
      mimeType?: string | null;
      fileName?: string | null;
      size?: number | null;
      caption?: string | null;
    } | null;
    metadata: Record<string, unknown>;
    timestamp: number;
  }) => Promise<{ message: PassthroughMessage; wasCreated: boolean }>;
  emitPassthroughRealtimeUpdates: (args: {
    tenantId: string;
    ticketId: string;
    instanceId: string | null;
    message: PassthroughMessage;
    ticketWasCreated: boolean;
  }) => Promise<void>;
  getSocketServer(): SocketServerLike | null;
  inboundMessagesProcessedCounter: { inc(labels: { origin: string; tenantId: string; instanceId: string }): void };
  logger: { info(message: string, context?: Record<string, unknown>): void };
  helpers: PassthroughHandlerHelpers;
}

export type PassthroughHandler = (event: InboundWhatsAppEvent) => Promise<void>;

export const createPassthroughHandler = (deps: PassthroughHandlerDeps): PassthroughHandler => {
  const {
    defaultTenantId,
    findOrCreateOpenTicketByChat,
    upsertMessageByExternalId,
    emitPassthroughRealtimeUpdates,
    getSocketServer,
    inboundMessagesProcessedCounter,
    logger,
    helpers,
  } = deps;

  return async (event) => {
    const { instanceId, contact, message, timestamp, direction, chatId, externalId, tenantId, sessionId } = event;

    const effectiveTenantId =
      (typeof tenantId === 'string' && tenantId.trim().length > 0 ? tenantId.trim() : null) ?? defaultTenantId;
    const instanceIdentifier =
      typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;

    const metadataRecord = helpers.toRecord(event.metadata);
    const metadataContact = helpers.toRecord(metadataRecord.contact);
    const messageRecord = helpers.toRecord(message);

    const contactPhone = helpers.readString(contact.phone);
    const metadataContactPhone = helpers.readString(metadataContact.phone);
    const metadataRecordPhone = helpers.readString(metadataRecord.phone);
    const normalizedPhone =
      helpers.sanitizePhone(contactPhone) ??
      helpers.sanitizePhone(metadataContactPhone) ??
      helpers.sanitizePhone(metadataRecordPhone);

    const deterministicIdentifiers = helpers.resolveDeterministicContactIdentifier({
      instanceId: instanceIdentifier,
      metadataRecord,
      metadataContact,
      sessionId: helpers.readString(sessionId) ??
        helpers.readString(metadataRecord.sessionId) ??
        helpers.readString(metadataRecord.session_id),
      externalId,
    });

    const document = helpers.sanitizeDocument(helpers.readString(contact.document), [
      normalizedPhone,
      deterministicIdentifiers.deterministicId,
      deterministicIdentifiers.contactId,
      deterministicIdentifiers.sessionId,
      instanceIdentifier,
    ]);

    const normalizedMessage = helpers.normalizeInboundMessage(message);
    const passthroughDirection =
      typeof direction === 'string' && direction.toUpperCase() === 'OUTBOUND' ? 'outbound' : 'inbound';

    const remoteJidCandidate =
      helpers.readString(chatId) ??
      helpers.readString(messageRecord.chatId) ??
      helpers.readString(metadataRecord.chatId) ??
      helpers.readString(metadataRecord.remoteJid) ??
      helpers.readString(metadataContact.remoteJid) ??
      helpers.readString(contact.phone);

    const resolvedChatId =
      remoteJidCandidate ??
      normalizedPhone ??
      document ??
      deterministicIdentifiers.deterministicId ??
      helpers.readString(externalId) ??
      normalizedMessage.id ??
      event.id ??
      randomUUID();

    const externalIdForUpsert =
      helpers.readString(externalId) ??
      helpers.readString(messageRecord.id) ??
      normalizedMessage.id ??
      event.id ??
      randomUUID();

    const normalizedType = normalizedMessage.type;
    let passthroughType: 'text' | 'media' | 'unknown' = 'unknown';
    let passthroughText: string | null = null;
    let passthroughMedia: {
      mediaType: string;
      url?: string | null;
      mimeType?: string | null;
      fileName?: string | null;
      size?: number | null;
      caption?: string | null;
    } | null = null;

    if (normalizedType === 'IMAGE' || normalizedType === 'VIDEO' || normalizedType === 'AUDIO' || normalizedType === 'DOCUMENT') {
      passthroughType = 'media';
      const mediaType = normalizedType.toLowerCase();
      passthroughText = normalizedMessage.caption ?? normalizedMessage.text ?? null;
      passthroughMedia = {
        mediaType,
        url: normalizedMessage.mediaUrl ?? null,
        mimeType: normalizedMessage.mimetype ?? null,
        size: normalizedMessage.fileSize ?? null,
        caption: normalizedMessage.caption ?? null,
      };
    } else if (
      normalizedType === 'TEXT' ||
      normalizedType === 'TEMPLATE' ||
      normalizedType === 'CONTACT' ||
      normalizedType === 'LOCATION'
    ) {
      passthroughType = 'text';
      passthroughText = normalizedMessage.text ?? null;
    } else {
      passthroughType = 'unknown';
      passthroughText = normalizedMessage.text ?? null;
    }

    const metadataForUpsert: Record<string, unknown> = {
      ...metadataRecord,
      tenantId: effectiveTenantId,
      chatId: resolvedChatId,
      direction: passthroughDirection,
      sourceInstance: instanceIdentifier,
      remoteJid: remoteJidCandidate ?? resolvedChatId,
      phoneE164: normalizedPhone ?? null,
    };

    const displayName =
      helpers.pickPreferredName(contact.name, contact.pushName, helpers.readString(metadataContact.pushName)) ??
      'Contato WhatsApp';

    const { ticket: passthroughTicket, wasCreated: ticketWasCreated } = await findOrCreateOpenTicketByChat({
      tenantId: effectiveTenantId,
      chatId: resolvedChatId,
      displayName,
      phone: normalizedPhone ?? deterministicIdentifiers.deterministicId ?? document ?? resolvedChatId,
      instanceId: instanceIdentifier,
    });

    const { message: passthroughMessage, wasCreated: messageWasCreated } = await upsertMessageByExternalId({
      tenantId: effectiveTenantId,
      ticketId: passthroughTicket.id,
      chatId: resolvedChatId,
      direction: passthroughDirection,
      externalId: externalIdForUpsert,
      type: passthroughType,
      text: passthroughText,
      media: passthroughMedia,
      metadata: metadataForUpsert,
      timestamp: (() => {
        if (typeof normalizedMessage.brokerMessageTimestamp === 'number') {
          return normalizedMessage.brokerMessageTimestamp;
        }
        if (typeof timestamp === 'string') {
          const parsed = Date.parse(timestamp);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return Date.now();
      })(),
    });

    const socket = getSocketServer();
    if (socket) {
      socket.to(`tenant:${effectiveTenantId}`).emit('messages.new', passthroughMessage);
      socket.to(`ticket:${passthroughTicket.id}`).emit('messages.new', passthroughMessage);
    }

    logger.info('passthrough: persisted + emitted messages.new', {
      tenantId: effectiveTenantId,
      ticketId: passthroughTicket.id,
      direction: passthroughDirection,
      externalId: externalIdForUpsert,
      messageWasCreated,
      ticketWasCreated,
    });

    await emitPassthroughRealtimeUpdates({
      tenantId: effectiveTenantId,
      ticketId: passthroughTicket.id,
      instanceId: instanceIdentifier,
      message: passthroughMessage,
      ticketWasCreated,
    });

    inboundMessagesProcessedCounter.inc({
      origin: 'passthrough',
      tenantId: effectiveTenantId,
      instanceId: instanceIdentifier ?? 'unknown',
    });
  };
};

