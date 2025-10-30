import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { enqueueInboundMediaJob } from '@ticketz/storage';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import type { BrokerLeadRecord } from '../../../config/lead-engine';
import { maskDocument, maskPhone } from '../../../lib/pii';
import {
  inboundMessagesProcessedCounter,
  leadLastContactGauge,
  whatsappInboundMetrics,
} from '../../../lib/metrics';
import { createPerformanceTracker } from '../../../lib/performance-tracker';
import { sendToFailedMessageDLQ } from '../../../lib/failed-message-dlq';
import { sendMessage as sendMessageService } from '../../../services/ticket-service';
import { saveWhatsAppMedia } from '../../../services/whatsapp-media-service';
import { emitToAgreement, emitToTenant, emitToTicket } from '../../../lib/socket-registry';
import {
  normalizeInboundMessage,
  type NormalizedInboundMessage,
  type NormalizedMessageType,
} from '../utils/normalize';
import {
  DEFAULT_DEDUPE_TTL_MS,
  DEFAULT_TENANT_ID,
} from './constants';
import { registerDedupeKey, shouldSkipByDedupe } from './dedupe';
import { mapErrorForLog } from './logging';
import {
  pickPreferredName,
  readString,
  resolveBrokerIdFromMetadata,
  resolveDeterministicContactIdentifier,
  resolveTenantIdentifiersFromMetadata,
  sanitizeDocument,
  sanitizePhone,
  uniqueStringList,
} from './identifiers';
import {
  attemptAutoProvisionWhatsAppInstance,
  ensureInboundQueueForInboundMessage,
  getDefaultQueueId,
  isForeignKeyError,
  isUniqueViolation,
  provisionDefaultQueueForTenant,
  provisionFallbackCampaignForInstance,
  queueCacheByTenant,
  type WhatsAppInstanceRecord,
} from './provisioning';
import { downloadViaBaileys, downloadViaBroker } from './mediaDownloader';
import {
  type InboundMessageDetails,
  type InboundWhatsAppEvent,
} from './types';
import { isHttpUrl, MEDIA_MESSAGE_TYPES, toRecord } from './inbound-lead/helpers';
import {
  extractMediaDownloadDetails,
} from './inbound-lead/media-utils';
import { ensureContact } from './inbound-lead/contact-service';
import { getCampaignCache } from './inbound-lead/state';
import { emitRealtimeUpdatesForInbound } from './realtime-service';
import { upsertLeadFromInbound } from './lead-service';
import { ensureTicketForContact } from './ticket-service';

const campaignCache = getCampaignCache();

const resolveTimelineMessageType = (message: NormalizedInboundMessage): string => {
  switch ((message as any).type) {
    case 'IMAGE':
    case 'VIDEO':
    case 'AUDIO':
    case 'DOCUMENT':
    case 'LOCATION':
    case 'CONTACT':
    case 'TEMPLATE':
      return (message as any).type;
    case 'TEXT':
    default:
      return 'TEXT';
  }
};

export const processStandardInboundEvent = async (
  event: InboundWhatsAppEvent,
  now: number,
  { preloadedInstance }: { preloadedInstance?: WhatsAppInstanceRecord | null }
): Promise<boolean> => {
  const perfTracker = createPerformanceTracker({ operation: 'processStandardInboundEvent' });
  perfTracker.start('total');

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

  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;
  let metricsInstanceId = instanceIdentifier ?? 'unknown';
  const normalizedPhone = sanitizePhone(contact.phone);
  const metadataRecord = toRecord(event.metadata);
  const metadataContact = toRecord(metadataRecord.contact);
  const deterministicIdentifiers = resolveDeterministicContactIdentifier({
    instanceId: instanceIdentifier,
    metadataRecord,
    metadataContact,
    sessionId:
      readString(eventSessionId) ?? readString(metadataRecord.sessionId) ?? readString((metadataRecord as any).session_id),
    externalId: externalId ?? null,
  });
  const document = sanitizeDocument(contact.document, [
    normalizedPhone,
    deterministicIdentifiers.deterministicId,
    deterministicIdentifiers.contactId,
    deterministicIdentifiers.sessionId,
    instanceIdentifier,
  ]);
  const requestId = readString((metadataRecord as any)['requestId']);
  const resolvedBrokerId = resolveBrokerIdFromMetadata(metadataRecord);
  const metadataTenantRecord = toRecord((metadataRecord as any).tenant);
  const metadataPushName = readString((metadataContact as any)['pushName']) ?? readString((metadataRecord as any)['pushName']);
  const resolvedAvatar = [
    (contact as any).avatarUrl,
    (metadataContact as any).avatarUrl,
    (metadataContact as any).profilePicUrl,
    (metadataContact as any).profilePicture,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const resolvedName = pickPreferredName(contact.name, (contact as any).pushName, metadataPushName);

  const normalizedEventTenantId =
    typeof eventTenantId === 'string' && eventTenantId.trim().length > 0 ? eventTenantId.trim() : null;
  let metadataTenantId = readString((metadataRecord as any)['tenantId']);
  let metricsTenantId =
    normalizedEventTenantId ??
    metadataTenantId ??
    (typeof DEFAULT_TENANT_ID === 'string' ? DEFAULT_TENANT_ID : null) ??
    'unknown';

  let perfEnded = false;
  const finalize = (result: boolean): boolean => {
    if (!perfEnded) {
      const totalDuration = perfTracker.end('total');

      whatsappInboundMetrics.observeLatency(
        {
          origin: 'webhook',
          tenantId: metricsTenantId ?? 'unknown',
          instanceId: metricsInstanceId ?? 'unknown',
        },
        totalDuration
      );

      if (totalDuration > 1000) {
        perfTracker.logSummary('info');
      }

      perfEnded = true;
    }
    return result;
  };

  if (normalizedEventTenantId) {
    if (!metadataTenantId || metadataTenantId !== normalizedEventTenantId) {
      (metadataRecord as any).tenantId = normalizedEventTenantId;
      metadataTenantId = normalizedEventTenantId;
    }
  } else if (eventTenantId && !metadataTenantId) {
    (metadataRecord as any).tenantId = eventTenantId;
    metadataTenantId = eventTenantId;
  }

  if (metadataTenantId) {
    let tenantRecordUpdated = false;
    const tenantRecordId = readString((metadataTenantRecord as any)['id']);
    if (!tenantRecordId || tenantRecordId !== metadataTenantId) {
      (metadataTenantRecord as any)['id'] = metadataTenantId;
      tenantRecordUpdated = true;
    }
    const tenantRecordTenantId = readString((metadataTenantRecord as any)['tenantId']);
    if (!tenantRecordTenantId || tenantRecordTenantId !== metadataTenantId) {
      (metadataTenantRecord as any)['tenantId'] = metadataTenantId;
      tenantRecordUpdated = true;
    }
    if (tenantRecordUpdated || (!metadataRecord.tenant && Object.keys(metadataTenantRecord).length > 0)) {
      (metadataRecord as any).tenant = metadataTenantRecord;
    }
  }

  const tenantIdForBrokerLookup = normalizedEventTenantId ?? metadataTenantId ?? null;

  (metadataRecord as any).direction = direction;
  if (chatId && !(metadataRecord as any).chatId) (metadataRecord as any).chatId = chatId;
  if (eventSessionId && !(metadataRecord as any).sessionId) (metadataRecord as any).sessionId = eventSessionId;

  const metadataBroker =
    (metadataRecord as any).broker && typeof (metadataRecord as any).broker === 'object'
      ? ((metadataRecord as any).broker as Record<string, unknown>)
      : null;
  if (metadataBroker) {
    (metadataBroker as any).direction = direction;
    (metadataBroker as any).instanceId = (metadataBroker as any).instanceId ?? instanceId;
    if (resolvedBrokerId && (!(metadataBroker as any).id || (metadataBroker as any).id !== resolvedBrokerId)) {
      (metadataBroker as any).id = resolvedBrokerId;
    }
  } else {
    (metadataRecord as any).broker = { direction, instanceId, ...(resolvedBrokerId ? { id: resolvedBrokerId } : {}) };
  }

  if (resolvedBrokerId && (!(metadataRecord as any).brokerId || (metadataRecord as any).brokerId !== resolvedBrokerId)) {
    (metadataRecord as any).brokerId = resolvedBrokerId;
  }

  const tenantIdentifiersForAutoProvision = resolveTenantIdentifiersFromMetadata(metadataRecord);

  let instance: WhatsAppInstanceRecord | null = preloadedInstance ?? null;
  let resolvedInstanceId = instanceIdentifier;

  if (!instance && resolvedInstanceId) {
    instance = await attemptAutoProvisionWhatsAppInstance({
      brokerId: resolvedBrokerId,
      tenantId: tenantIdForBrokerLookup,
      instanceId: resolvedInstanceId,
      tenantIdentifiers: tenantIdentifiersForAutoProvision,
    });
  }

  if (!instance) {
    instance = await attemptAutoProvisionWhatsAppInstance({
      brokerId: resolvedBrokerId,
      tenantId: tenantIdForBrokerLookup,
      tenantIdentifiers: tenantIdentifiersForAutoProvision,
    });
  }

  if (!instance && resolvedBrokerId) {
    const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId: resolvedBrokerId };
    instance = await prisma.whatsAppInstance.findFirst({
      where: brokerLookupWhere,
      select: { id: true, tenantId: true, brokerId: true },
    });
  }

  if (!instance && tenantIdForBrokerLookup) {
    instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: tenantIdForBrokerLookup },
      select: { id: true, tenantId: true, brokerId: true },
    });
  }

  if (!instance) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚙️ Instância WhatsApp não localizada', {
      requestId,
      tenantId: tenantIdForBrokerLookup,
      brokerId: resolvedBrokerId ?? null,
      instanceId: instanceIdentifier,
    });
    return finalize(false);
  }

  if (!resolvedInstanceId) {
    resolvedInstanceId = instance.id;
  }

  metricsInstanceId = resolvedInstanceId ?? metricsInstanceId;
  metricsTenantId = instance.tenantId ?? metricsTenantId;

  const tenantId = instance.tenantId;

  const cacheKey = `${tenantId}:${instance.id}`;
  const campaigns = await campaignCache.getOrSet(cacheKey, async () =>
    prisma.campaign.findMany({
      where: { tenantId, whatsappInstanceId: instance.id, status: 'active' },
      select: {
        id: true,
        name: true,
        status: true,
        whatsappInstanceId: true,
        tenantId: true,
        agreementId: true,
      },
    })
  );

  if (!campaigns.length) {
    const fallbackCampaign = await provisionFallbackCampaignForInstance(tenantId, instance.id);
    if (fallbackCampaign) {
      campaigns.push({
        id: fallbackCampaign.id,
        name: fallbackCampaign.name,
        status: fallbackCampaign.status,
        whatsappInstanceId: fallbackCampaign.whatsappInstanceId,
        tenantId: fallbackCampaign.tenantId,
        agreementId: fallbackCampaign.agreementId,
      });
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa — fallback provisionado', {
        requestId,
        tenantId,
        instanceId: instance.id,
        fallbackCampaignId: fallbackCampaign.id,
        messageId: (message as any).id ?? null,
      });
    } else {
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa para a instância — seguindo mesmo assim', {
        requestId,
        tenantId,
        instanceId: instance.id,
        messageId: (message as any).id ?? null,
      });
    }
  }

  const leadName = resolvedName ?? 'Contato WhatsApp';
  const registrations = uniqueStringList((contact as any).registrations || null);
  const leadIdBase = (message as any).id || `${instance.id}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  const queueResolution = await ensureInboundQueueForInboundMessage({
    tenantId,
    requestId: requestId ?? null,
    instanceId: instance.id ?? null,
  });

  if (!queueResolution.queueId) {
    if (queueResolution.error) {
      logger.warn('🎯 LeadEngine • WhatsApp :: 🧱 Mensagem estacionada por ausência de fila padrão', {
        requestId,
        tenantId,
        instanceId: instance.id,
        reason: queueResolution.error.reason,
        recoverable: queueResolution.error.recoverable,
      });
    }
    return finalize(false);
  }

  const queueId = queueResolution.queueId;

  const contactRecord = await ensureContact(tenantId, {
    phone: normalizedPhone,
    name: leadName,
    document,
    registrations,
    timestamp,
    avatar: resolvedAvatar ?? null,
  });

  const ticketMetadata: Record<string, unknown> = {
    source: 'WHATSAPP',
    instanceId,
    campaignIds: campaigns.map((campaign) => campaign.id),
    pipelineStep: 'follow-up',
  };

  const ticketSubject =
    contactRecord.displayName || contactRecord.fullName || contactRecord.primaryPhone || 'Contato WhatsApp';

  const ticketId = await ensureTicketForContact(tenantId, contactRecord.id, queueId, ticketSubject, ticketMetadata);
  if (!ticketId) {
    logger.error('🎯 LeadEngine • WhatsApp :: 🚧 Não consegui garantir o ticket para a mensagem inbound', {
      requestId,
      tenantId,
      instanceId: instance.id,
      messageId: (message as any).id ?? null,
    });
    return finalize(false);
  }

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);
  const messageKeyRecord =
    message && typeof message === 'object' && 'key' in message && (message as any).key && typeof (message as any).key === 'object'
      ? ((message as any).key as { id?: string | null })
      : null;

  const messageExternalId =
    readString(externalId) ??
    readString((normalizedMessage as any).id) ??
    readString((message as InboundMessageDetails).id) ??
    readString(messageKeyRecord?.id) ??
    (event as any).id ??
    randomUUID();

  if (messageExternalId && !(metadataRecord as any).externalId) {
    (metadataRecord as any).externalId = messageExternalId;
  }

  const metadataBrokerRecord =
    (metadataRecord as any).broker && typeof (metadataRecord as any).broker === 'object'
      ? ((metadataRecord as any).broker as Record<string, unknown>)
      : null;
  if (metadataBrokerRecord) {
    if (messageExternalId && !(metadataBrokerRecord as any).messageId) {
      (metadataBrokerRecord as any).messageId = messageExternalId;
    }
    (metadataBrokerRecord as any).direction = direction;
    (metadataBrokerRecord as any).instanceId = (metadataBrokerRecord as any).instanceId ?? instanceId;
  } else if (messageExternalId) {
    (metadataRecord as any).broker = { direction, instanceId, messageId: messageExternalId };
  }

  const brokerTimestamp = (normalizedMessage as any).brokerMessageTimestamp;
  const normalizedTimestamp = (() => {
    if (typeof brokerTimestamp === 'number') {
      return brokerTimestamp > 1_000_000_000_000 ? brokerTimestamp : brokerTimestamp * 1000;
    }
    if (timestamp) {
      const parsed = Date.parse(timestamp as any);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  })();

  const dedupeKeyMessage = `${tenantId}:${messageExternalId ?? (normalizedMessage as any).id}`;
  if (direction === 'INBOUND' && (await shouldSkipByDedupe(dedupeKeyMessage, now))) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mensagem ignorada (janela de dedupe em ação)', {
      requestId,
      tenantId,
      ticketId,
      brokerMessageId: (normalizedMessage as any).id,
      dedupeKey: dedupeKeyMessage,
    });
    return finalize(true);
  }

  let downloadedMediaSuccessfully = false;
  let signedMediaUrlExpiresIn: number | null = null;
  let pendingMediaJobDetails:
    | {
        directPath: string | null;
        mediaKey: string | null;
        mediaType: NormalizedMessageType | null;
        fileName: string | null;
        mimeType: string | null;
        size: number | null;
      }
    | null = null;

  const shouldAttemptMediaDownload =
    MEDIA_MESSAGE_TYPES.has((normalizedMessage as any).type) &&
    !isHttpUrl((normalizedMessage as any).mediaUrl ?? undefined);

  if (shouldAttemptMediaDownload) {
    const mediaDetails = extractMediaDownloadDetails(normalizedMessage, metadataRecord);
    const hasDownloadMetadata = Boolean(mediaDetails.directPath || mediaDetails.mediaKey);

    let downloadResult:
      | Awaited<ReturnType<typeof downloadViaBaileys>>
      | Awaited<ReturnType<typeof downloadViaBroker>>
      | null = null;

    try {
      downloadResult = await Promise.race([
        downloadViaBaileys(mediaDetails.raw, mediaDetails.rawKey ?? undefined),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (!downloadResult) {
        logger.debug('🎯 LeadEngine • WhatsApp :: ⏱️ Download de mídia via Baileys timeout - será processado em background', {
          requestId,
          tenantId,
          instanceId,
          messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        });
      }
    } catch (error) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao baixar mídia inbound diretamente via Baileys', {
        error: mapErrorForLog(error),
        requestId,
        tenantId,
        instanceId,
        brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
      });
    }

    if (!downloadResult) {
      if (!hasDownloadMetadata) {
        logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Metadados insuficientes para download de mídia inbound', {
          requestId,
          tenantId,
          instanceId,
          brokerId: resolvedBrokerId ?? null,
          messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
          mediaType: (normalizedMessage as any).type,
        });
      } else {
        logger.info('🎯 LeadEngine • WhatsApp :: ⬇️ Baixando mídia inbound a partir do broker', {
          requestId,
          tenantId,
          instanceId,
          brokerId: resolvedBrokerId ?? null,
          messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
          mediaType: (normalizedMessage as any).type,
          hasDirectPath: Boolean(mediaDetails.directPath),
          hasMediaKey: Boolean(mediaDetails.mediaKey),
        });

        try {
          downloadResult = await Promise.race([
            downloadViaBroker({
              brokerId: resolvedBrokerId ?? null,
              instanceId: resolvedInstanceId,
              tenantId,
              mediaKey: mediaDetails.mediaKey,
              directPath: mediaDetails.directPath,
              messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
              mediaType: (normalizedMessage as any).type,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);

          if (!downloadResult) {
            logger.debug('🎯 LeadEngine • WhatsApp :: ⏱️ Download de mídia via broker timeout - será processado em background', {
              requestId,
              tenantId,
              instanceId,
              messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
            });
          }
        } catch (error) {
          logger.error('🎯 LeadEngine • WhatsApp :: ❌ Falha ao baixar mídia inbound via broker', {
            error: mapErrorForLog(error),
            requestId,
            tenantId,
            instanceId,
            brokerId: resolvedBrokerId ?? null,
            messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
            mediaType: (normalizedMessage as any).type,
          });
        }
      }

      if (!downloadedMediaSuccessfully && hasDownloadMetadata) {
        pendingMediaJobDetails = {
          directPath: mediaDetails.directPath,
          mediaKey: mediaDetails.mediaKey,
          mediaType: (normalizedMessage as any).type,
          fileName: mediaDetails.fileName,
          mimeType: mediaDetails.mimeType,
          size: mediaDetails.size,
        };
        (metadataRecord as any)['media_pending'] = true;
      }
    }

    if (downloadResult && downloadResult.buffer.length > 0) {
      const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
        buffer: downloadResult.buffer,
        tenantId,
        instanceId: instanceIdentifier as string,
        chatId,
        messageId: externalId ?? (normalizedMessage as any).id ?? null,
      };

      if (mediaDetails.fileName) saveInput.originalName = mediaDetails.fileName;

      const mimeCandidate =
        (normalizedMessage as any).mimetype ??
        mediaDetails.mimeType ??
        downloadResult.mimeType ??
        null;

      if (mimeCandidate) saveInput.mimeType = mimeCandidate;

      const descriptor = await saveWhatsAppMedia(saveInput);
      signedMediaUrlExpiresIn = descriptor.expiresInSeconds;

      const resolvedMimeType =
        (normalizedMessage as any).mimetype ??
        mediaDetails.mimeType ??
        downloadResult.mimeType ??
        saveInput.mimeType ??
        null;
      if (!(normalizedMessage as any).mimetype && resolvedMimeType) {
        (normalizedMessage as any).mimetype = resolvedMimeType;
      }

      const resolvedSize =
        (normalizedMessage as any).fileSize ??
        mediaDetails.size ??
        downloadResult.size ??
        downloadResult.buffer.length;
      if (!(normalizedMessage as any).fileSize && resolvedSize !== null) {
        (normalizedMessage as any).fileSize = resolvedSize;
      }

      const resolvedFileName =
        mediaDetails.fileName ?? downloadResult.fileName ?? saveInput.originalName ?? null;

      (normalizedMessage as any).mediaUrl = descriptor.mediaUrl;
      downloadedMediaSuccessfully = true;

      const metadataMedia = toRecord((metadataRecord as any).media);
      (metadataMedia as any).url = descriptor.mediaUrl;
      (metadataMedia as any).urlExpiresInSeconds = descriptor.expiresInSeconds;
      if ((normalizedMessage as any).caption) (metadataMedia as any).caption = (normalizedMessage as any).caption;
      if ((normalizedMessage as any).mimetype) (metadataMedia as any).mimetype = (normalizedMessage as any).mimetype;
      if ((normalizedMessage as any).fileSize !== null && (normalizedMessage as any).fileSize !== undefined) {
        (metadataMedia as any).size = (normalizedMessage as any).fileSize;
      }
      if (resolvedFileName) (metadataMedia as any).fileName = resolvedFileName;

      (metadataRecord as any).media = metadataMedia;
      if ('media_pending' in metadataRecord) delete (metadataRecord as Record<string, unknown>).media_pending;
      pendingMediaJobDetails = null;

      logger.info('🎯 LeadEngine • WhatsApp :: ✅ Mídia inbound baixada e armazenada localmente', {
        requestId,
        tenantId,
        instanceId,
        brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
        mediaUrl: descriptor.mediaUrl,
        fileName: resolvedFileName,
        size: (normalizedMessage as any).fileSize ?? null,
      });
    } else if (downloadResult) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Download de mídia inbound retornou payload vazio', {
        requestId,
        tenantId,
        instanceId,
        brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
      });
    }
  }

  const currentMediaUrl = (normalizedMessage as any).mediaUrl ?? null;
  if (!downloadedMediaSuccessfully && currentMediaUrl && !isHttpUrl(currentMediaUrl)) {
    (normalizedMessage as any).mediaUrl = null;
    const metadataMedia = (metadataRecord as any).media;
    if (metadataMedia && typeof metadataMedia === 'object' && !Array.isArray(metadataMedia)) {
      delete (metadataMedia as Record<string, unknown>)['url'];
      if (Object.keys(metadataMedia as Record<string, unknown>).length === 0) {
        delete (metadataRecord as any).media;
      }
    }
  }

  let persistedMessage: Awaited<ReturnType<typeof sendMessageService>> | null = null;

  const timelineMessageType = resolveTimelineMessageType(normalizedMessage);

  try {
    const resolvedMediaUrl =
      downloadedMediaSuccessfully || isHttpUrl((normalizedMessage as any).mediaUrl ?? undefined)
        ? (normalizedMessage as any).mediaUrl
        : null;

    const messageMetadata: Record<string, unknown> = {
      broker: {
        messageId: messageExternalId ?? (normalizedMessage as any).id,
        clientMessageId: (normalizedMessage as any).clientMessageId,
        conversationId: (normalizedMessage as any).conversationId,
        instanceId,
        campaignIds: campaigns.map((campaign) => campaign.id),
      },
      externalId: messageExternalId ?? undefined,
      media: resolvedMediaUrl
        ? {
            url: resolvedMediaUrl,
            mimetype: (normalizedMessage as any).mimetype,
            caption: (normalizedMessage as any).caption,
            size: (normalizedMessage as any).fileSize,
            urlExpiresInSeconds: signedMediaUrlExpiresIn ?? undefined,
          }
        : undefined,
      location:
        (normalizedMessage as any).latitude || (normalizedMessage as any).longitude
          ? {
              latitude: (normalizedMessage as any).latitude,
              longitude: (normalizedMessage as any).longitude,
              name: (normalizedMessage as any).locationName,
            }
          : undefined,
      contacts: (normalizedMessage as any).contacts ?? undefined,
      raw: (normalizedMessage as any).raw,
      eventMetadata: event.metadata ?? {},
      receivedAt: (normalizedMessage as any).receivedAt,
      brokerMessageTimestamp: (normalizedMessage as any).brokerMessageTimestamp,
      normalizedTimestamp,
    };

    if (pendingMediaJobDetails) (messageMetadata as any).media_pending = true;

    persistedMessage = await sendMessageService(tenantId, undefined, {
      ticketId,
      content: (normalizedMessage as any).text ?? '[Mensagem]',
      type: timelineMessageType,
      direction,
      externalId: messageExternalId ?? undefined,
      mediaUrl: resolvedMediaUrl ?? undefined,
      metadata: messageMetadata,
    });
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: 💾 Falha ao salvar a mensagem inbound na timeline do ticket', {
      error: mapErrorForLog(error),
      requestId,
      tenantId,
      ticketId,
      messageId: (message as any).id ?? null,
    });

    sendToFailedMessageDLQ(
      messageExternalId ?? (normalizedMessage as any).id ?? 'unknown',
      tenantId,
      error,
      {
        instanceId: resolvedInstanceId,
        failureCount: 1,
        payload: normalizedMessage,
        metadata: { requestId, ticketId, reason: 'message_persistence_failed' },
      }
    );
  }

  if (persistedMessage) {
    await registerDedupeKey(dedupeKeyMessage, now, DEFAULT_DEDUPE_TTL_MS);

    const providerMessageId = (normalizedMessage as any).id ?? null;

    if (pendingMediaJobDetails) {
      try {
        await enqueueInboundMediaJob({
          tenantId,
          messageId: persistedMessage.id,
          messageExternalId: messageExternalId ?? providerMessageId,
          instanceId: resolvedInstanceId,
          brokerId: resolvedBrokerId ?? null,
          mediaType: pendingMediaJobDetails.mediaType ?? null,
          mediaKey: pendingMediaJobDetails.mediaKey,
          directPath: pendingMediaJobDetails.directPath,
          metadata: {
            requestId: requestId ?? null,
            eventId: (event as any).id ?? null,
            fileName: pendingMediaJobDetails.fileName,
            mimeType: pendingMediaJobDetails.mimeType,
            size: pendingMediaJobDetails.size,
          },
        });
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao enfileirar job de mídia inbound', {
          error: mapErrorForLog(error),
          tenantId,
          ticketId,
          instanceId,
          messageId: persistedMessage.id,
        });
      }
    }

    await emitRealtimeUpdatesForInbound({
      tenantId,
      ticketId,
      instanceId: resolvedInstanceId,
      message: persistedMessage,
      providerMessageId,
      emitTicketRealtimeEvents: false,
    });

    let inboundLeadId: string | null = null;

    if (direction === 'INBOUND') {
      try {
        const { lead } = await upsertLeadFromInbound({
          tenantId,
          contactId: contactRecord.id,
          ticketId,
          instanceId: resolvedInstanceId,
          providerMessageId,
          message: persistedMessage,
        });
        inboundLeadId = lead.id;
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao sincronizar lead inbound', {
          error: mapErrorForLog(error),
          requestId,
          tenantId,
          ticketId,
          instanceId,
          contactId: contactRecord.id,
          messageId: persistedMessage.id,
          providerMessageId,
        });
      }
    }

    inboundMessagesProcessedCounter.inc({
      origin: 'legacy',
      tenantId,
      instanceId: resolvedInstanceId ?? 'unknown',
    });

    logger.info('🎯 LeadEngine • WhatsApp :: ✅ Mensagem inbound processada', {
      requestId,
      tenantId,
      ticketId,
      contactId: contactRecord.id,
      instanceId,
      messageId: persistedMessage.id,
      providerMessageId,
      leadId: inboundLeadId,
    });
  }

  const allocationTargets: Array<{
    campaign: (typeof campaigns)[number] | null;
    target: { campaignId?: string; instanceId?: string };
  }> =
    campaigns.length
      ? campaigns.map((campaign) => ({ campaign, target: { campaignId: campaign.id } }))
      : resolvedInstanceId
      ? [{ campaign: null, target: { instanceId: resolvedInstanceId } }]
      : [];

  if (!campaigns.length && !resolvedInstanceId) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Instância sem identificador para alocação fallback', {
      requestId,
      tenantId,
      instanceId: resolvedInstanceId ?? instanceId ?? null,
      messageId: (message as any).id ?? null,
    });
  }

  for (const { campaign, target } of allocationTargets) {
    const campaignId = campaign?.id ?? null;
    const agreementId = campaign?.agreementId || 'unknown';
    const allocationDedupeKey = campaignId
      ? `${tenantId}:${campaignId}:${document || normalizedPhone || leadIdBase}`
      : `${tenantId}:${resolvedInstanceId}:${document || normalizedPhone || leadIdBase}`;

    if (campaignId && (await shouldSkipByDedupe(allocationDedupeKey, now))) {
      logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
        requestId,
        tenantId,
        campaignId,
        instanceId: resolvedInstanceId,
        messageId: (message as any).id ?? null,
        phone: maskPhone(normalizedPhone ?? null),
        dedupeKey: allocationDedupeKey,
      });
      continue;
    }

    const brokerLead: BrokerLeadRecord & { raw: Record<string, unknown> } = {
      id: campaignId ? `${leadIdBase}:${campaignId}` : `${leadIdBase}:instance:${resolvedInstanceId}`,
      fullName: leadName,
      document,
      registrations,
      agreementId,
      tags: ['inbound-whatsapp'],
      raw: {
        from: contact,
        message,
        metadata: event.metadata ?? {},
        receivedAt: timestamp ?? new Date(now).toISOString(),
      },
    };
    if (normalizedPhone) brokerLead.phone = normalizedPhone;

    try {
      const { newlyAllocated, summary } = await addAllocations(tenantId, target, [brokerLead]);
      await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);

      if (newlyAllocated.length > 0) {
        const allocation = newlyAllocated[0]!;
        logger.info('🎯 LeadEngine • WhatsApp :: 🎯 Lead inbound alocado com sucesso', {
          tenantId,
          campaignId: allocation.campaignId ?? campaignId,
          instanceId,
          allocationId: allocation.allocationId,
          phone: maskPhone(normalizedPhone ?? null),
          leadId: allocation.leadId,
        });

        const realtimePayload = {
          tenantId,
          campaignId: allocation.campaignId ?? null,
          agreementId: allocation.agreementId ?? null,
          instanceId: allocation.instanceId,
          allocation,
          summary,
        };

        emitToTenant(tenantId, 'leadAllocations.new', realtimePayload);
        if (allocation.agreementId && allocation.agreementId !== 'unknown') {
          emitToAgreement(allocation.agreementId, 'leadAllocations.new', realtimePayload);
        }
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        logger.debug('🎯 LeadEngine • WhatsApp :: ⛔ Lead inbound já alocado recentemente — ignorando duplicidade', {
          tenantId,
          campaignId: campaignId ?? undefined,
          instanceId: resolvedInstanceId,
          phone: maskPhone(normalizedPhone ?? null),
        });
        await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);
        continue;
      }

      logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
        error: mapErrorForLog(error),
        tenantId,
        campaignId: campaignId ?? undefined,
        instanceId: resolvedInstanceId,
        phone: maskPhone(normalizedPhone ?? null),
      });
    }
  }

  return finalize(!!persistedMessage);
};

export const __testing = {
  processStandardInboundEvent,
};
