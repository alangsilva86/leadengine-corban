import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import {
  enqueueInboundMediaJob,
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
import { saveWhatsAppMedia } from '../../../services/whatsapp-media-service';

type PassthroughMetadata = Record<string, unknown>;

const isPersistedMediaUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.includes('X-Amz-Signature=') || trimmed.includes('X-Amz-Credential=');
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

  const resolvedBrokerId =
    readString(metadataRecord.brokerId) ??
    readString(metadataIntegration.brokerId) ??
    null;

  let pendingMediaJob:
    | {
        directPath: string | null;
        mediaKey: string | null;
        mediaType: string | null;
        mimeType: string | null;
        size: number | null;
        fileName: string | null;
        brokerId: string | null;
      }
    | null = null;

  if (passthroughType === 'media' && passthroughMedia) {
    const existingUrl = passthroughMedia.url ?? null;
    const hasPersistedUrl = isPersistedMediaUrl(existingUrl);
    let descriptor: Awaited<ReturnType<typeof saveWhatsAppMedia>> | null = null;
    const resolvedDirectPath = passthroughMedia.directPath ?? directPath ?? null;
    const resolvedMediaKey = passthroughMedia.mediaKey ?? mediaKey ?? null;
    let lastDownloadResult: Awaited<ReturnType<typeof downloadViaBaileys>> | Awaited<
      ReturnType<typeof downloadViaBroker>
    > | null = null;

    try {
      if (!hasPersistedUrl) {
        if (passthroughMedia.base64) {
          const trimmed = passthroughMedia.base64.trim();
          if (trimmed.length > 0) {
            const normalizedBase64 = trimmed.startsWith('data:')
              ? trimmed.substring(trimmed.indexOf(',') + 1)
              : trimmed;
            const uploadBuffer = Buffer.from(normalizedBase64, 'base64');
            const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
              buffer: uploadBuffer,
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              chatId: resolvedChatId,
              messageId: externalIdForUpsert ?? normalizedMessage.id ?? null,
            };

            if (passthroughMedia.fileName) {
              saveInput.originalName = passthroughMedia.fileName;
            }

            if (passthroughMedia.mimeType) {
              saveInput.mimeType = passthroughMedia.mimeType;
            }

            descriptor = await saveWhatsAppMedia(saveInput);

            if (!passthroughMedia.mimeType && saveInput.mimeType) {
              passthroughMedia.mimeType = saveInput.mimeType;
            }

            if (!passthroughMedia.size) {
              passthroughMedia.size = uploadBuffer.length;
            }

            if (!passthroughMedia.fileName && saveInput.originalName) {
              passthroughMedia.fileName = saveInput.originalName;
            }
          }
        } else {
          try {
            lastDownloadResult = await downloadViaBaileys(normalizedMessage.raw);
          } catch (error) {
            logger.warn('passthrough: failed to download media via Baileys', {
              error: mapErrorForLog(error),
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              messageId: externalIdForUpsert,
            });
          }

          if (!lastDownloadResult && (resolvedDirectPath || resolvedMediaKey)) {
            try {
              lastDownloadResult = await downloadViaBroker({
                brokerId: resolvedBrokerId,
                instanceId: instanceIdentifier,
                tenantId: effectiveTenantId,
                mediaKey: resolvedMediaKey,
                directPath: resolvedDirectPath,
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
          } else if (!lastDownloadResult) {
            logger.warn('passthrough: unable to download media due to missing directPath/mediaKey', {
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              messageId: externalIdForUpsert,
              mediaType: normalizedType,
            });
          }

          if (lastDownloadResult && lastDownloadResult.buffer.length > 0) {
            const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
              buffer: lastDownloadResult.buffer,
              tenantId: effectiveTenantId,
              instanceId: instanceIdentifier,
              chatId: resolvedChatId,
              messageId: externalIdForUpsert ?? normalizedMessage.id ?? null,
            };

            const nameCandidate = passthroughMedia.fileName;
            if (nameCandidate) {
              saveInput.originalName = nameCandidate;
            }

            const mimeCandidate =
              passthroughMedia.mimeType ??
              lastDownloadResult.mimeType ??
              null;
            if (mimeCandidate) {
              saveInput.mimeType = mimeCandidate;
            }

            descriptor = await saveWhatsAppMedia(saveInput);

            if (!passthroughMedia.mimeType) {
              passthroughMedia.mimeType =
                lastDownloadResult.mimeType ?? saveInput.mimeType ?? passthroughMedia.mimeType ?? null;
            }
            if (!passthroughMedia.size) {
              passthroughMedia.size = lastDownloadResult.size ?? lastDownloadResult.buffer.length;
            }
            if (!passthroughMedia.fileName && saveInput.originalName) {
              passthroughMedia.fileName = saveInput.originalName;
            }
          } else if (lastDownloadResult) {
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
      passthroughMedia.base64 = null;

      const metadataMedia = toRecord(metadataRecord.media);
      metadataMedia.url = descriptor.mediaUrl;
      metadataMedia.urlExpiresInSeconds = descriptor.expiresInSeconds;
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
      if (resolvedDirectPath || resolvedMediaKey) {
        pendingMediaJob = {
          directPath: resolvedDirectPath,
          mediaKey: resolvedMediaKey,
          mediaType: normalizedType,
          mimeType: passthroughMedia.mimeType ?? lastDownloadResult?.mimeType ?? null,
          size: passthroughMedia.size ?? lastDownloadResult?.size ?? null,
          fileName: passthroughMedia.fileName ?? null,
          brokerId: resolvedBrokerId,
        };

        passthroughMedia.url = null;

        const metadataMedia = toRecord(metadataRecord.media);
        if ('url' in metadataMedia) {
          delete metadataMedia.url;
        }
        if (Object.keys(metadataMedia).length > 0) {
          metadataRecord.media = metadataMedia;
        } else {
          delete metadataRecord.media;
        }

        metadataRecord.media_pending = true;

        logger.warn('passthrough: scheduling async retry for inbound media download', {
          tenantId: effectiveTenantId,
          instanceId: instanceIdentifier,
          messageId: externalIdForUpsert,
          mediaType: normalizedType,
          hasDirectPath: Boolean(resolvedDirectPath),
          hasMediaKey: Boolean(resolvedMediaKey),
        });
      } else {
        logger.warn('passthrough: could not resolve media url for inbound message', {
          tenantId: effectiveTenantId,
          instanceId: instanceIdentifier,
          messageId: externalIdForUpsert,
          mediaType: normalizedType,
        });
      }
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

  if (pendingMediaJob) {
    try {
      await enqueueInboundMediaJob({
        tenantId: effectiveTenantId,
        messageId: passthroughMessage.id,
        messageExternalId: externalIdForUpsert,
        instanceId: instanceIdentifier ?? null,
        brokerId: pendingMediaJob.brokerId ?? null,
        mediaType: pendingMediaJob.mediaType ?? null,
        mediaKey: pendingMediaJob.mediaKey,
        directPath: pendingMediaJob.directPath,
        metadata: {
          mimeType: pendingMediaJob.mimeType,
          size: pendingMediaJob.size,
          fileName: pendingMediaJob.fileName,
        },
      });

      logger.info('passthrough: inbound media retry job enqueued', {
        tenantId: effectiveTenantId,
        instanceId: instanceIdentifier,
        messageId: passthroughMessage.id,
        mediaType: pendingMediaJob.mediaType ?? null,
      });
    } catch (error) {
      logger.error('passthrough: failed to enqueue inbound media retry job', {
        tenantId: effectiveTenantId,
        instanceId: instanceIdentifier,
        messageId: passthroughMessage.id,
        mediaType: pendingMediaJob.mediaType ?? null,
        error: mapErrorForLog(error),
      });
    }
  }

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
