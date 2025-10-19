import { randomUUID } from 'node:crypto';
import {
  findOrCreateOpenTicketByChat,
  upsertMessageByExternalId,
  type PassthroughMessage,
} from '@ticketz/storage';

import { logger } from '../../../config/logger';
import { prisma } from '../../../lib/prisma';
import { inboundMessagesProcessedCounter } from '../../../lib/metrics';
import {
  emitToAgreement,
  emitToTenant,
  emitToTicket,
  getSocketServer,
} from '../../../lib/socket-registry';
import { normalizeInboundMessage } from '../utils/normalize';
import { DEFAULT_TENANT_ID } from './constants';
import {
  pickPreferredName,
  readString,
  resolveDeterministicContactIdentifier,
  sanitizeDocument,
  sanitizePhone,
} from './identifiers';
import { mapErrorForLog } from './logging';
import {
  type InboundMessageDetails,
  type InboundWhatsAppEvent,
} from './types';
import { resolveTicketAgreementId } from './ticket-utils';

type PassthroughMetadata = Record<string, unknown>;

const toRecord = (value: unknown): PassthroughMetadata => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as PassthroughMetadata) };
  }
  return {};
};

export const emitPassthroughRealtimeUpdates = async ({
  tenantId,
  ticketId,
  instanceId,
  message,
  ticketWasCreated,
}: {
  tenantId: string;
  ticketId: string;
  instanceId: string | null;
  message: PassthroughMessage;
  ticketWasCreated: boolean;
}) => {
  try {
    const ticketRecord = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticketRecord) {
      logger.warn('passthrough: skipped realtime updates due to missing ticket record', {
        tenantId,
        ticketId,
      });
      return;
    }

    const agreementId = resolveTicketAgreementId(ticketRecord);

    const ticketPayload = {
      tenantId,
      ticketId: ticketRecord.id,
      agreementId,
      instanceId: instanceId ?? null,
      messageId: message.id,
      providerMessageId: message.externalId ?? null,
      ticketStatus: ticketRecord.status,
      ticketUpdatedAt: ticketRecord.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      ticket: ticketRecord,
    };

    emitToTicket(ticketRecord.id, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (agreementId) {
      emitToAgreement(agreementId, 'tickets.updated', ticketPayload);
    }

    if (ticketWasCreated) {
      emitToTicket(ticketRecord.id, 'tickets.new', ticketPayload);
      emitToTenant(tenantId, 'tickets.new', ticketPayload);
      if (agreementId) {
        emitToAgreement(agreementId, 'tickets.new', ticketPayload);
      }
    }
  } catch (error) {
    logger.error('passthrough: failed to emit ticket realtime events', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
    });
  }
};

export const handlePassthroughIngest = async (
  event: InboundWhatsAppEvent
): Promise<void> => {
  const {
    instanceId,
    contact,
    message,
    timestamp,
    direction,
    chatId,
    externalId,
    tenantId: eventTenantId,
    sessionId: eventSessionId,
  } = event;

  const effectiveTenantId =
    (typeof eventTenantId === 'string' && eventTenantId.trim().length > 0
      ? eventTenantId.trim()
      : null) ?? DEFAULT_TENANT_ID;
  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;
  const metadataRecord = toRecord(event.metadata);
  const metadataContact = toRecord(metadataRecord.contact);
  const messageRecord = toRecord(message);

  const contactPhone = readString(contact.phone);
  const metadataContactPhone = readString(metadataContact.phone);
  const metadataRecordPhone = readString(metadataRecord.phone);
  const normalizedPhone =
    sanitizePhone(contactPhone) ??
    sanitizePhone(metadataContactPhone) ??
    sanitizePhone(metadataRecordPhone);
  const deterministicIdentifiers = resolveDeterministicContactIdentifier({
    instanceId: instanceIdentifier,
    metadataRecord,
    metadataContact,
    sessionId:
      readString(eventSessionId) ??
      readString(metadataRecord.sessionId) ??
      readString(metadataRecord.session_id),
    externalId,
  });
  const document = sanitizeDocument(readString(contact.document), [
    normalizedPhone,
    deterministicIdentifiers.deterministicId,
    deterministicIdentifiers.contactId,
    deterministicIdentifiers.sessionId,
    instanceIdentifier,
  ]);

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);
  const passthroughDirection =
    typeof direction === 'string' && direction.toUpperCase() === 'OUTBOUND' ? 'outbound' : 'inbound';

  const remoteJidCandidate =
    readString(chatId) ??
    readString(messageRecord.chatId) ??
    readString(metadataRecord.chatId) ??
    readString(metadataRecord.remoteJid) ??
    readString(metadataContact.remoteJid) ??
    readString(contact.phone);

  const resolvedChatId =
    remoteJidCandidate ??
    normalizedPhone ??
    document ??
    deterministicIdentifiers.deterministicId ??
    readString(externalId) ??
    normalizedMessage.id ??
    event.id ??
    randomUUID();

  const externalIdForUpsert =
    readString(externalId) ??
    readString(messageRecord.id) ??
    normalizedMessage.id ??
    event.id ??
    randomUUID();

  const normalizedType = normalizedMessage.type;
  let passthroughType: 'text' | 'media' | 'unknown' = 'unknown';
  let passthroughText: string | null = null;
  let passthroughMedia:
    | {
        mediaType: string;
        url?: string | null;
        mimeType?: string | null;
        fileName?: string | null;
        size?: number | null;
        caption?: string | null;
      }
    | null = null;

  if (
    normalizedType === 'IMAGE' ||
    normalizedType === 'VIDEO' ||
    normalizedType === 'AUDIO' ||
    normalizedType === 'DOCUMENT'
  ) {
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

  const metadataForUpsert = {
    ...metadataRecord,
    tenantId: effectiveTenantId,
    chatId: resolvedChatId,
    direction: passthroughDirection,
    sourceInstance: instanceIdentifier,
    remoteJid: remoteJidCandidate ?? resolvedChatId,
    phoneE164: normalizedPhone ?? null,
  };

  const displayName =
    pickPreferredName(
      contact.name,
      contact.pushName,
      readString(metadataContact.pushName)
    ) ?? 'Contato WhatsApp';

  const { ticket: passthroughTicket, wasCreated: ticketWasCreated } =
    await findOrCreateOpenTicketByChat({
      tenantId: effectiveTenantId,
      chatId: resolvedChatId,
      displayName,
      phone:
        normalizedPhone ??
        deterministicIdentifiers.deterministicId ??
        document ??
        resolvedChatId,
      instanceId: instanceIdentifier,
    });

  const {
    message: passthroughMessage,
    wasCreated: messageWasCreated,
  } = await upsertMessageByExternalId({
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
