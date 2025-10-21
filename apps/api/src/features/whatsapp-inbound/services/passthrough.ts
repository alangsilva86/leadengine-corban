import { Buffer } from 'node:buffer';
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
import { downloadViaBaileys, downloadViaBroker } from './mediaDownloader';
import {
  getWhatsAppUploadsBaseUrl,
  saveWhatsAppMedia,
} from '../../../services/whatsapp-media-service';

type PassthroughMetadata = Record<string, unknown>;

const isPersistedMediaUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const baseUrl = getWhatsAppUploadsBaseUrl().trim().replace(/\/$/, '');
  if (!baseUrl) {
    return false;
  }

  const normalizedBase = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;

  if (trimmed.startsWith(normalizedBase)) {
    return true;
  }

  if (/^https?:\/\//i.test(baseUrl) && trimmed.startsWith(baseUrl)) {
    return true;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.startsWith(normalizedBase);
    } catch {
      return false;
    }
  }

  return false;
};

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
  const metadataIntegration = toRecord(metadataRecord.integration);
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
    externalId: readString(externalId) ?? null,
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
        base64?: string | null;
        mediaKey?: string | null;
        directPath?: string | null;
      }
    | null = null;

  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const readFirstString = (...values: Array<unknown>): string | null => {
    for (const value of values) {
      const parsed = readString(value);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  };

  const candidateMediaRecords: Array<Record<string, unknown>> = [];
  const pushCandidate = (value: unknown) => {
    const record = asRecord(value);
    if (record) {
      candidateMediaRecords.push(record);
    }
  };

  pushCandidate(messageRecord.media);
  pushCandidate(metadataRecord.media);

  const normalizedRawMessage = asRecord(normalizedMessage.raw);
  if (normalizedRawMessage) {
    pushCandidate(normalizedRawMessage.imageMessage);
    pushCandidate(normalizedRawMessage.videoMessage);
    pushCandidate(normalizedRawMessage.audioMessage);
    pushCandidate(normalizedRawMessage.documentMessage);
    pushCandidate(normalizedRawMessage.stickerMessage);
    const nested = asRecord(normalizedRawMessage.message);
    if (nested) {
      pushCandidate(nested.imageMessage);
      pushCandidate(nested.videoMessage);
      pushCandidate(nested.audioMessage);
      pushCandidate(nested.documentMessage);
      pushCandidate(nested.stickerMessage);
    }
  }

  const readFromCandidates = (keys: string[]): string | null => {
    for (const record of candidateMediaRecords) {
      for (const key of keys) {
        const value = readFirstString(record[key]);
        if (value) {
          return value;
        }
      }
    }
    return null;
  };

  const mediaBase64 =
    readFromCandidates(['base64', 'fileBase64', 'data', 'payload', 'body']) ??
    readFirstString(messageRecord.base64, metadataRecord.base64);
  const mediaKey =
    readFromCandidates(['mediaKey', 'media_key', 'mediakey']) ??
    readFirstString(messageRecord.mediaKey, metadataRecord.mediaKey, metadataRecord.media_key);
  const directPath =
    readFromCandidates(['directPath', 'direct_path', 'downloadUrl', 'download_url']) ??
    readFirstString(messageRecord.directPath, metadataRecord.directPath, metadataRecord.direct_path);

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
      base64: mediaBase64,
      mediaKey,
      directPath,
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

  if (passthroughType === 'media' && passthroughMedia) {
    const existingUrl = passthroughMedia.url ?? null;
    const hasPersistedUrl = isPersistedMediaUrl(existingUrl);
    let descriptor: Awaited<ReturnType<typeof saveWhatsAppMedia>> | null = null;

    try {
      if (!hasPersistedUrl) {
        if (passthroughMedia.base64) {
          const trimmed = passthroughMedia.base64.trim();
          if (trimmed.length > 0) {
            const normalizedBase64 = trimmed.startsWith('data:')
              ? trimmed.substring(trimmed.indexOf(',') + 1)
              : trimmed;
            const buffer = Buffer.from(normalizedBase64, 'base64');
            const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
              buffer,
              tenantId: effectiveTenantId,
            };

            if (passthroughMedia.fileName) {
              saveInput.originalName = passthroughMedia.fileName;
            }

            if (passthroughMedia.mimeType) {
              saveInput.mimeType = passthroughMedia.mimeType;
            }

            descriptor = await saveWhatsAppMedia(saveInput);
          }
        } else {
          let downloadResult = null as Awaited<ReturnType<typeof downloadViaBaileys>> | Awaited<
            ReturnType<typeof downloadViaBroker>
          > | null;

          try {
            downloadResult = await downloadViaBaileys(normalizedMessage.raw);
          } catch (error) {
            logger.warn('passthrough: failed to download media via Baileys', {
              error: mapErrorForLog(error),
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              messageId: externalIdForUpsert,
            });
          }

          if (!downloadResult && (passthroughMedia.directPath || passthroughMedia.mediaKey)) {
            const brokerId =
              readString(metadataRecord.brokerId) ??
              readString(metadataIntegration.brokerId) ??
              null;

            try {
              downloadResult = await downloadViaBroker({
                brokerId,
                instanceId: instanceIdentifier,
                tenantId: effectiveTenantId,
                mediaKey: passthroughMedia.mediaKey ?? null,
                directPath: passthroughMedia.directPath ?? null,
                messageId: externalIdForUpsert ?? null,
                mediaType: normalizedType,
              });
            } catch (error) {
              logger.error('passthrough: failed to download media via broker', {
                error: mapErrorForLog(error),
                tenantId: effectiveTenantId,
                instanceId: instanceIdentifier,
                messageId: externalIdForUpsert,
                mediaType: normalizedType,
              });
            }
          } else if (!downloadResult) {
            logger.warn('passthrough: unable to download media due to missing directPath/mediaKey', {
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              messageId: externalIdForUpsert,
              mediaType: normalizedType,
            });
          }

          if (downloadResult && downloadResult.buffer.length > 0) {
            const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
              buffer: downloadResult.buffer,
              tenantId: effectiveTenantId,
            };

            const nameCandidate = passthroughMedia.fileName;
            if (nameCandidate) {
              saveInput.originalName = nameCandidate;
            }

            const mimeCandidate =
              passthroughMedia.mimeType ??
              downloadResult.mimeType ??
              null;
            if (mimeCandidate) {
              saveInput.mimeType = mimeCandidate;
            }

            descriptor = await saveWhatsAppMedia(saveInput);

            if (!passthroughMedia.mimeType && downloadResult.mimeType) {
              passthroughMedia.mimeType = downloadResult.mimeType;
            }
            if (!passthroughMedia.size) {
              passthroughMedia.size = downloadResult.size ?? downloadResult.buffer.length;
            }
          } else if (downloadResult) {
            logger.warn('passthrough: media download returned empty payload', {
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              messageId: externalIdForUpsert,
              mediaType: normalizedType,
            });
          }
        }
      }
    } catch (error) {
      logger.error('passthrough: failed to persist inbound media', {
        tenantId: effectiveTenantId,
        instanceId: instanceIdentifier,
        messageId: externalIdForUpsert,
        mediaType: normalizedType,
        error: mapErrorForLog(error),
      });
    }

    if (descriptor) {
      passthroughMedia.url = descriptor.mediaUrl;
      passthroughMedia.mimeType = passthroughMedia.mimeType ?? descriptor.mimeType;
      passthroughMedia.size = passthroughMedia.size ?? descriptor.size;
      passthroughMedia.base64 = null;

      const metadataMedia = toRecord(metadataRecord.media);
      metadataMedia.url = descriptor.mediaUrl;
      if (passthroughMedia.mimeType) {
        metadataMedia.mimetype = passthroughMedia.mimeType;
      }
      if (passthroughMedia.size !== null && passthroughMedia.size !== undefined) {
        metadataMedia.size = passthroughMedia.size;
      }
      if (passthroughMedia.caption) {
        metadataMedia.caption = passthroughMedia.caption;
      }
      metadataRecord.media = metadataMedia;

      logger.info('passthrough: inbound media stored successfully', {
        tenantId: effectiveTenantId,
        instanceId: instanceIdentifier,
        messageId: externalIdForUpsert,
        mediaType: normalizedType,
        mediaUrl: descriptor.mediaUrl,
      });
    } else if (!hasPersistedUrl) {
      logger.warn('passthrough: could not resolve media url for inbound message', {
        tenantId: effectiveTenantId,
        instanceId: instanceIdentifier,
        messageId: externalIdForUpsert,
        mediaType: normalizedType,
      });
    }
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
